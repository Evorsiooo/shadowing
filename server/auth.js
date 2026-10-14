// Accounts: Sign in with Google (OpenID Connect, code flow with PKCE, state and nonce) and
// cookie sessions stored in D1. Every /api route calls requireUser(), which fails closed.
import { uuid } from './util.js';
import { disconnectDrive } from './drive.js';
import { deleteUserStatements as oauthRows } from './oauth.js';

export const SESSION_COOKIE = '__Host-euno_session';
export const OAUTH_COOKIE = '__Host-euno_oauth';
const SESSION_DAYS = 30;
const DAY = 86400_000;
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/* ---------- small helpers ---------- */
export function b64urlToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
export function bytesToB64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePart(s) { return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))); }
export function randomToken(bytes = 32) { return bytesToB64url(crypto.getRandomValues(new Uint8Array(bytes))); }
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256B64url(text) { return bytesToB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }

export function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  for (const part of c.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}
export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
}
const isLocal = (request) => ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);

/* ---------- sessions ---------- */
// The local-dev bypass only ever works on localhost, so setting DEV_NO_AUTH in production does nothing.
async function devUser(env) {
  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, name, role, created) VALUES ('dev', 'dev@localhost', 'Dev', 'admin', ?)").bind(now).run();
  return { userId: 'dev', email: 'dev@localhost', name: 'Dev', role: 'admin', picture: null };
}

/** The signed-in user for this request, or { ok: false, status, reason }. */
export async function requireUser(request, env) {
  if (env.DEV_NO_AUTH === '1' && isLocal(request)) return { ok: true, ...(await devUser(env)) };
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 100) return { ok: false, status: 401, reason: 'Not signed in.' };
  const sid = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT s.expires, s.last_seen, u.id, u.email, u.name, u.picture, u.role, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
  ).bind(sid).first();
  const now = Date.now();
  if (!row || row.expires < now) return { ok: false, status: 401, reason: 'Your sign-in has expired.' };
  if (row.disabled) return { ok: false, status: 403, reason: 'This account is disabled.' };
  if (now - row.last_seen > DAY / 24) {
    // sliding expiry, written at most once an hour
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen = ?, expires = ? WHERE id = ?').bind(now, now + SESSION_DAYS * DAY, sid),
      env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, row.id),
    ]);
  }
  return { ok: true, userId: row.id, email: row.email, name: row.name, picture: row.picture, role: row.role };
}

export async function createSession(env, userId) {
  const token = randomToken(32);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, created, expires, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now, now + SESSION_DAYS * DAY, now).run();
  // tidy up expired sessions now and then
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now).run();
  return cookie(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

export async function endSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
  return cookie(SESSION_COOKIE, '', 0);
}

/* ---------- Google OpenID Connect ---------- */
export function redirectUri(request, env) {
  return env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/auth/google/callback`;
}

/** Start sign-in: returns the Google URL and the short-lived cookie holding state, nonce and the PKCE verifier. */
export async function startGoogle(request, env, { next, invite }) {
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(48);
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(request, env),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: await sha256B64url(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({ state, nonce, verifier, next, invite: invite || null })));
  return { url: `${GOOGLE_AUTH}?${q}`, cookie: cookie(OAUTH_COOKIE, payload, 600) };
}

export function readOAuthCookie(request) {
  const v = readCookie(request, OAUTH_COOKIE);
  if (!v) return null;
  try { return decodePart(v); } catch { return null; }
}

export async function exchangeCode(request, env, code, verifier) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request, env), grant_type: 'authorization_code',
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id_token) throw new Error(`Google refused the sign-in (${d.error || r.status}).`);
  return d.id_token;
}

let certCache = { at: 0, keys: [] };
async function googleKeys(force = false) {
  if (!force && Date.now() - certCache.at < 3600_000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(GOOGLE_CERTS);
  if (!r.ok) throw new Error(`Google keys ${r.status}`);
  const { keys = [] } = await r.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

/**
 * Verify a Google ID token and return its claims. `keys` can be passed in (tests);
 * otherwise Google's published keys are fetched and cached.
 */
export async function verifyIdToken(token, { clientId, nonce, keys = null, now = Date.now() }) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Bad token.');
  let header, payload;
  try { header = decodePart(parts[0]); payload = decodePart(parts[1]); } catch { throw new Error('Bad token.'); }
  if (header.alg !== 'RS256') throw new Error('Bad token algorithm.');
  let jwk = (keys || (await googleKeys())).find((k) => k.kid === header.kid);
  if (!jwk && !keys) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key.');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Bad signature.');
  const t = Math.floor(now / 1000);
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error('Token from another issuer.');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!clientId || !auds.includes(clientId)) throw new Error('Token is for another app.');
  if (!payload.exp || payload.exp < t - 60) throw new Error('Sign-in expired. Try again.');
  if (payload.iat && payload.iat > t + 300) throw new Error('Token not yet valid.');
  if (!nonce || payload.nonce !== nonce) throw new Error('Sign-in didn’t match. Try again.');
  if (!payload.sub) throw new Error('Token has no account id.');
  if (!payload.email || payload.email_verified !== true) throw new Error('Your Google account’s email address isn’t verified.');
  return payload;
}

/* ---------- users ---------- */
export async function getConfig(db, key, fallback = null) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
  return row ? row.value : fallback;
}

/** Normalise an invite code the way people type it. */
export function cleanInvite(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40) || null;
}
export async function inviteUsable(db, code) {
  if (!code) return false;
  const row = await db.prepare('SELECT max_uses, uses, expires FROM invites WHERE code = ?').bind(code).first();
  return !!row && row.uses < row.max_uses && (!row.expires || row.expires > Date.now());
}

/**
 * Find or create the account for verified Google claims. Linking order: Google id, then a
 * row with the same email and no Google id yet (how Adrien's migrated account gets linked).
 * Returns { user } or { error, code } (code: 'invite' | 'disabled').
 */
export async function upsertGoogleUser(env, claims, invite) {
  const db = env.DB;
  const email = String(claims.email).toLowerCase();
  const now = Date.now();
  const isAdmin = adminEmails(env).includes(email);
  let user = await db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(claims.sub).first();
  if (!user) {
    user = await db.prepare('SELECT * FROM users WHERE email = ? AND google_sub IS NULL').bind(email).first();
    if (user) await db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').bind(claims.sub, user.id).run();
  }
  if (user) {
    if (user.disabled) return { error: 'This account is disabled.', code: 'disabled' };
    const role = isAdmin ? 'admin' : user.role;
    await db.prepare('UPDATE users SET email = ?, name = ?, picture = ?, role = ?, last_seen = ? WHERE id = ?')
      .bind(email, claims.name || null, claims.picture || null, role, now, user.id).run();
    return { user: { ...user, email, role } };
  }
  // new account
  const signup = await getConfig(db, 'signup', 'open');
  let code = null;
  if (signup === 'invite' && !isAdmin) {
    code = cleanInvite(invite);
    if (!(await inviteUsable(db, code))) return { error: 'Sign-up is invite-only right now. Enter a valid invite code.', code: 'invite' };
    const used = await db.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ? AND uses < max_uses AND (expires IS NULL OR expires > ?)').bind(code, now).run();
    if (!used.meta.changes) return { error: 'That invite code has been used up or has ended.', code: 'invite' };
  } else if (signup === 'closed' && !isAdmin) {
    return { error: 'Sign-up is closed right now.', code: 'invite' };
  }
  const id = uuid();
  try {
    await db.prepare('INSERT INTO users (id, google_sub, email, name, picture, role, invite_code, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, claims.sub, email, claims.name || null, claims.picture || null, isAdmin ? 'admin' : 'user', code, now, now).run();
  } catch (e) {
    // the email belongs to a row already linked to a different Google account
    if (/UNIQUE/i.test(e.message)) return { error: 'This email is already linked to a different Google account.', code: 'conflict' };
    throw e;
  }
  return { user: { id, email, role: isAdmin ? 'admin' : 'user' } };
}

/** Delete an account and everything the server keeps for it. */
export async function deleteUser(env, userId) {
  const db = env.DB;
  await disconnectDrive(env, userId).catch(() => {}); // revoke the app's Drive access; their files stay in their Drive
  await db.batch([
    db.prepare('DELETE FROM docs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM private WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    ...oauthRows(db, userId), // apps connected to the MCP server
    db.prepare('UPDATE support_messages SET user_id = NULL WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
}

/** Reject cross-site writes: a mutating request must come from this site (or a non-browser client). */
export function sameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}
