// Google Drive sync: the server only holds each user's Drive refresh token (sealed, in `private`)
// and hands the browser short-lived access tokens. Videos and recordings go straight between
// the browser and the user's own Drive; they never pass through this server.
//
// Scope: drive.file, which only reaches files this app created (non-sensitive, so no Google
// security review). Sign-in and Drive use the same OAuth client and the same redirect URI;
// the short-lived OAuth cookie says which flow came back.
import { randomToken, cookie, OAUTH_COOKIE, redirectUri, bytesToB64url } from './auth.js';
import { sealSecret, openSecret } from './crypto.js';
import { getPrivate, setPrivate } from './reminders.js';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const PRIVATE_KEY = 'drive';

async function sha256B64url(text) { return bytesToB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }

/** Start connecting Drive for a signed-in user: the Google consent URL and the OAuth cookie. */
export async function startDrive(request, env, user, next) {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(request, env),
    response_type: 'code',
    scope: DRIVE_SCOPE,
    include_granted_scopes: 'true',
    access_type: 'offline',
    prompt: 'consent', // Google only returns a refresh token on a consent screen
    login_hint: user.email,
    state,
    code_challenge: await sha256B64url(verifier),
    code_challenge_method: 'S256',
  });
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({ purpose: 'drive', state, verifier, next, userId: user.id })));
  return { url: `${GOOGLE_AUTH}?${q}`, cookie: cookie(OAUTH_COOKIE, payload, 600) };
}

/** Finish connecting: swap the code for tokens and keep the refresh token, sealed. */
export async function finishDrive(request, env, userId, code, verifier) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request, env), grant_type: 'authorization_code',
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google refused the Drive connection (${d.error || r.status}).`);
  if (!String(d.scope || '').split(' ').includes(DRIVE_SCOPE)) throw new Error('Google didn’t grant access to Drive. Tick the Drive box on the consent screen and try again.');
  if (!d.refresh_token) throw new Error('Google didn’t return a long-lived token. Try connecting again.');
  // which Google account's Drive this is, to show in Settings (best effort)
  let email = null;
  try {
    const a = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { authorization: `Bearer ${d.access_token}` } });
    if (a.ok) email = (await a.json()).user?.emailAddress || null;
  } catch { /* not needed */ }
  const old = await readDrive(env, userId);
  await setPrivate(env.DB, userId, PRIVATE_KEY, JSON.stringify({ token: await sealSecret(env, userId, 'drive', d.refresh_token), email, connected: Date.now() }));
  if (old && old.refreshToken && old.refreshToken !== d.refresh_token) revoke(old.refreshToken);
}

async function readDrive(env, userId) {
  const raw = await getPrivate(env.DB, userId, PRIVATE_KEY);
  if (!raw) return null;
  const row = JSON.parse(raw);
  let refreshToken = null;
  try { refreshToken = await openSecret(env, userId, 'drive', row.token); } catch (e) { console.error('drive token unreadable', e.message); }
  return { ...row, refreshToken };
}

export async function driveStatus(env, userId) {
  const raw = await getPrivate(env.DB, userId, PRIVATE_KEY);
  if (!raw) return { connected: false };
  const row = JSON.parse(raw);
  return { connected: true, email: row.email || null, since: row.connected || null };
}

/** A fresh access token for the browser (about an hour). Throws status 409 when Drive must be reconnected. */
export async function driveAccessToken(env, userId) {
  const row = await readDrive(env, userId);
  if (!row) throw Object.assign(new Error('Google Drive isn’t connected.'), { status: 409, reconnect: true });
  if (!row.refreshToken) throw Object.assign(new Error('Reconnect Google Drive in Settings → Storage.'), { status: 409, reconnect: true });
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: row.refreshToken, grant_type: 'refresh_token' }),
  });
  const d = await r.json().catch(() => ({}));
  if (d.error === 'invalid_grant') {
    // access was removed from the Google account: forget the token so the app offers to reconnect
    await setPrivate(env.DB, userId, PRIVATE_KEY, null);
    throw Object.assign(new Error('Google Drive access was removed. Reconnect it in Settings → Storage.'), { status: 409, reconnect: true });
  }
  if (!r.ok || !d.access_token) throw Object.assign(new Error(`Google didn’t give a Drive token (${d.error || r.status}).`), { status: 502 });
  return { accessToken: d.access_token, expiresAt: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
}

/** Disconnect: revoke the token at Google and forget it. Files already in Drive stay there. */
export async function disconnectDrive(env, userId) {
  const row = await readDrive(env, userId).catch(() => null);
  await setPrivate(env.DB, userId, PRIVATE_KEY, null);
  if (row && row.refreshToken) await revoke(row.refreshToken);
}

function revoke(token) {
  return fetch(GOOGLE_REVOKE, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }).catch(() => {});
}

const UPLOAD_ORIGIN = 'https://www.googleapis.com/upload/drive/v3/files';
// Drive wants every piece but the last to be a multiple of 256 KB
const PIECE = 16 * 1024 * 1024;

/**
 * Copy one file from the old R2 storage straight into the user's Drive folder (server to Google,
 * so a big video never has to pass through the browser). One call copies one 16 MB piece, so no
 * single request runs long: call it first without `session`, then again with the returned
 * `session` and `offset` until it says done. With `check`, it only asks Google where to carry on. Returns { done, session, offset, size } or
 * { done: true, fileId, size, type }.
 */
export async function copyR2ToDrive(env, userId, { key, name, folderId, mediaId, kind, session, offset, check }) {
  const head = await env.FILES.head(key);
  if (!head) throw Object.assign(new Error('That file isn’t in the old storage any more.'), { status: 404 });
  const type = (head.httpMetadata && head.httpMetadata.contentType) || 'application/octet-stream';
  const size = head.size;
  if (!session) {
    const { accessToken } = await driveAccessToken(env, userId);
    const start = await fetch(`${UPLOAD_ORIGIN}?uploadType=resumable&fields=id`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': type, 'x-upload-content-length': String(size) },
      body: JSON.stringify({ name, parents: [folderId], appProperties: { euno: '1', mediaId, kind: kind || '' } }),
    });
    if (!start.ok) {
      const d = await start.json().catch(() => ({}));
      throw Object.assign(new Error(`Google Drive refused the upload (${(d.error && d.error.message) || start.status}).`), { status: 502 });
    }
    session = start.headers.get('location');
    offset = 0;
  }
  // only ever send bytes to a Drive upload session
  if (typeof session !== 'string' || !session.startsWith(`${UPLOAD_ORIGIN}?`)) throw Object.assign(new Error('Bad upload session.'), { status: 400 });
  offset = Number(offset) || 0;
  if (offset < 0 || offset > size || (offset < size && offset % (256 * 1024))) throw Object.assign(new Error('Bad upload offset.'), { status: 400 });
  // `check` asks Google how much of the file it already has (after a piece failed partway)
  const length = check ? 0 : Math.min(PIECE, size - offset);
  let body = new Uint8Array(0);
  if (length > 0) {
    const obj = await env.FILES.get(key, { range: { offset, length } });
    if (!obj) throw Object.assign(new Error('That file isn’t in the old storage any more.'), { status: 404 });
    body = new Uint8Array(await obj.arrayBuffer());
  }
  const range = length > 0 ? `bytes ${offset}-${offset + length - 1}/${size}` : `bytes */${size}`;
  const put = await fetch(session, { method: 'PUT', headers: { 'content-range': range }, body });
  if (put.status === 308) {
    // Google says how much it has; carry on from there
    const m = /bytes=0-(\d+)/.exec(put.headers.get('range') || '');
    return { done: false, session, offset: m ? Number(m[1]) + 1 : 0, size };
  }
  const d = await put.json().catch(() => ({}));
  if (!put.ok || !d.id) {
    const gone = put.status === 404 || put.status === 410;
    throw Object.assign(new Error(gone ? 'The Drive upload expired. Press Move again.' : `The upload to Google Drive failed (${(d.error && d.error.message) || put.status}).`), { status: 502, restart: gone });
  }
  return { done: true, fileId: d.id, size, type };
}
