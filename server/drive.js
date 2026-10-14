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
