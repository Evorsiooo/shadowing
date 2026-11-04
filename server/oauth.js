// OAuth 2.1 for the per-user MCP server (/mcp), so Claude, ChatGPT and Gemini can connect on a
// user's behalf. The app is its own authorization server, built on the existing Google sign-in:
//   GET  /.well-known/oauth-protected-resource[/mcp]   which server signs people in for /mcp (RFC 9728)
//   GET  /.well-known/oauth-authorization-server       endpoints and what they support (RFC 8414)
//   POST /oauth/register    apps register themselves (RFC 7591), always as public clients
//   GET  /oauth/authorize   consent page (signs the user in with Google first)
//   POST /oauth/authorize   the user's Allow / Don't allow
//   POST /oauth/token       authorization_code (PKCE S256 required) and refresh_token (rotated)
//   POST /oauth/revoke      disconnect (RFC 7009)
// Codes and tokens are random; only their SHA-256 is stored. Every token belongs to one user.
import { randomToken, sha256Hex, bytesToB64url, requireUser, sameOrigin } from './auth.js';
import { requestLang, tr } from './i18n.js';
import { uuid, safeEqual } from './util.js';
import { EUNO_MARK } from './euno-mark.js';

export const SCOPE = 'practice:read';
const CODE_TTL = 5 * 60_000;
const ACCESS_TTL = 3600_000;
const REFRESH_TTL = 60 * 86400_000;
const REQUEST_TTL = 10 * 60_000;
// Registration needs no account, so cap it site-wide: each app registers once per connection.
const REGISTER_PER_HOUR = 300;

/* ---------- where apps may send people back to ---------- */
// Only the AI apps we support (and loopback, for command-line clients such as Claude Code or Gemini CLI).
// An app that registers any other redirect is refused, so a lookalike can't collect someone's token.
// MCP_EXTRA_REDIRECTS (comma-separated https URL prefixes) adds more without a code change.
const KNOWN_APPS = [
  { name: 'Claude', test: (u) => u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname) && u.pathname === '/api/mcp/auth_callback' },
  { name: 'ChatGPT', test: (u) => u.protocol === 'https:' && u.hostname === 'chatgpt.com' && u.pathname.startsWith('/connector') },
  // Gemini returns through Google's OAuth relay (developer reports; Google doesn't document the address)
  { name: 'Gemini', test: (u) => u.protocol === 'https:' && (['oauth-redirect.googleusercontent.com', 'oauth-redirect-sandbox.googleusercontent.com', 'oauth-redirect-test.googleusercontent.com'].includes(u.hostname) || u.hostname === 'gemini.google.com') },
];
const isLoopback = (u) => u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);

function parseUrl(s) { try { const u = new URL(s); return u.hash || u.username || u.password ? null : u; } catch { return null; } }

/** Which app a redirect URI belongs to, or null if it isn't allowed. */
export function redirectApp(uri, env = {}) {
  const u = typeof uri === 'string' && uri.length <= 500 ? parseUrl(uri) : null;
  if (!u) return null;
  const known = KNOWN_APPS.find((a) => a.test(u));
  if (known) return { name: known.name, host: u.hostname };
  if (isLoopback(u)) return { name: null, host: u.hostname, loopback: true };
  const extra = String(env.MCP_EXTRA_REDIRECTS || '').split(',').map((s) => s.trim()).filter((s) => s.startsWith('https://'));
  if (extra.some((p) => uri.startsWith(p))) return { name: null, host: u.hostname };
  return null;
}

/** Does `uri` match one the client registered? Loopback ports may differ (RFC 8252 7.3). */
export function redirectMatches(registered, uri) {
  if (registered.includes(uri)) return true;
  const u = parseUrl(uri);
  if (!u || !isLoopback(u)) return false;
  return registered.some((r) => {
    const v = parseUrl(r);
    return v && isLoopback(v) && v.hostname === u.hostname && v.pathname === u.pathname && v.search === u.search;
  });
}

/* ---------- metadata ---------- */
export const mcpUrl = (origin) => `${origin}/mcp`;

export function protectedResourceMetadata(origin) {
  return {
    resource: mcpUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Euno Shadowing',
    resource_documentation: `${origin}/`,
  };
}

export function authServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [SCOPE, 'offline_access'],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/`,
  };
}

/** The 401 that starts sign-in: it points apps at the protected resource metadata. */
export function unauthorized(origin, error = null) {
  const parts = [`resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`, `scope="${SCOPE}"`];
  if (error) parts.unshift(`error="${error}"`);
  return new Response(JSON.stringify({ error: error || 'unauthorized', error_description: 'Sign in to Euno Shadowing to use this server.' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'www-authenticate': `Bearer ${parts.join(', ')}`, 'cache-control': 'no-store', ...CORS },
  });
}

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
  'access-control-max-age': '86400',
};

function oauthJson(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache', ...CORS } });
}
const oauthError = (error, description, status = 400) => oauthJson({ error, error_description: description }, status);

/* ---------- registration ---------- */
export async function register(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return oauthError('invalid_client_metadata', 'Send the client metadata as a JSON object.');
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 10) return oauthError('invalid_redirect_uri', 'Send 1 to 10 redirect_uris.');
  for (const u of uris) {
    if (!redirectApp(u, env)) return oauthError('invalid_redirect_uri', `Euno Shadowing only works with Claude, ChatGPT and Gemini, and doesn’t accept the redirect ${String(u).slice(0, 200)}.`);
  }
  const grants = body.grant_types || ['authorization_code', 'refresh_token'];
  if (!Array.isArray(grants) || !grants.includes('authorization_code')) return oauthError('invalid_client_metadata', 'grant_types must include authorization_code.');
  // Public by default (Claude, ChatGPT). An app that asks for a secret (Gemini asks for client_secret_basic) gets one;
  // only its hash is kept, and the token endpoint then requires it.
  const method = ['client_secret_basic', 'client_secret_post'].includes(body.token_endpoint_auth_method) ? body.token_endpoint_auth_method : 'none';
  const secret = method === 'none' ? null : randomToken(32);
  const name = typeof body.client_name === 'string' ? body.client_name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) : null;
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM oauth_clients WHERE created > ?').bind(now - 3600_000).first();
  if (recent && recent.n >= REGISTER_PER_HOUR) {
    return new Response(JSON.stringify({ error: 'temporarily_unavailable', error_description: 'Too many apps registered in the last hour. Try again later.' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '600', 'cache-control': 'no-store', ...CORS } });
  }
  const id = `mcp_${uuid()}`;
  await env.DB.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created, auth_method, secret_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, name, JSON.stringify(uris), now, method, secret ? await sha256Hex(secret) : null).run();
  if (Math.random() < 0.05) await cleanup(env.DB);
  return oauthJson({
    client_id: id,
    client_id_issued_at: Math.floor(now / 1000),
    ...(name ? { client_name: name } : {}),
    redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: method,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    scope: SCOPE,
  }, 201);
}

async function cleanup(db) {
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM oauth_tokens WHERE expires < ?').bind(now),
    db.prepare('DELETE FROM oauth_requests WHERE expires < ?').bind(now),
    // clients that registered a day ago and were never approved by anyone (a sign-in lasts 10 minutes)
    db.prepare('DELETE FROM oauth_clients WHERE created < ? AND id NOT IN (SELECT client_id FROM oauth_grants)').bind(now - 86400_000),
  ]);
}

async function getClient(db, id) {
  if (typeof id !== 'string' || !/^mcp_[0-9a-f]{32}$/.test(id)) return null;
  const row = await db.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
  return row ? { ...row, redirect_uris: JSON.parse(row.redirect_uris) } : null;
}

/** RFC 8707: a `resource`, when sent, must be this server's /mcp (the bare site address is accepted too). */
function resourceOk(resource, origin) {
  if (!resource) return true;
  const r = String(resource).replace(/\/+$/, '');
  return r === mcpUrl(origin) || r === origin;
}

/** Keep the latest sign-in failure on the app's row, to diagnose apps that only say "try again". */
async function noteError(db, clientId, message) {
  if (clientId) await db.prepare('UPDATE oauth_clients SET last_error = ? WHERE id = ?').bind(`${new Date().toISOString()} ${message}`.slice(0, 500), clientId).run().catch(() => {});
}

/* ---------- authorize ---------- */
export async function authorizeGet(request, env, url) {
  const db = env.DB;
  const origin = url.origin;
  let params;
  let requestId = url.searchParams.get('request');
  let row = null;
  if (requestId) {
    row = await db.prepare('SELECT * FROM oauth_requests WHERE id = ? AND expires > ?').bind(requestId, Date.now()).first();
    if (!row) return page('This sign-in has expired', '<p>Go back to the app you were connecting and start again.</p>', 400);
    params = JSON.parse(row.params);
    params.client_id = row.client_id;
  } else {
    params = Object.fromEntries(['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource'].map((k) => [k, url.searchParams.get(k)]));
  }

  // Problems with the client or redirect are shown here, never sent to an unverified redirect.
  const client = await getClient(db, params.client_id);
  if (!client) { await noteError(db, params.client_id, 'authorize: unknown client'); return page('Unknown app', '<p>This app isn’t registered with Euno Shadowing. Remove the connection in the app and add it again.</p>', 400); }
  if (!params.redirect_uri && client.redirect_uris.length === 1) params.redirect_uri = client.redirect_uris[0];
  if (!params.redirect_uri || !redirectMatches(client.redirect_uris, params.redirect_uri) || !redirectApp(params.redirect_uri, env)) {
    await noteError(db, client.id, `authorize: redirect_uri not registered: ${params.redirect_uri}`);
    return page('Can’t connect this app', '<p>The app asked to return somewhere it didn’t register.</p>', 400);
  }

  if (!row) {
    const fail = async (error, description) => {
      await noteError(db, client.id, `authorize: ${error}: ${description} (${url.search.slice(0, 300)})`);
      return redirectWith(params.redirect_uri, { error, error_description: description, state: params.state, iss: origin });
    };
    if (params.response_type !== 'code') return await fail('unsupported_response_type', 'Only response_type=code is supported.');
    if (!params.code_challenge || params.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(params.code_challenge)) return await fail('invalid_request', 'PKCE with S256 is required.');
    if (!resourceOk(params.resource, origin)) return await fail('invalid_target', `The resource must be ${mcpUrl(origin)}.`);
    if (params.state && params.state.length > 8192) return await fail('invalid_request', 'state is too long.');
    requestId = randomToken(24);
    const keep = { redirect_uri: params.redirect_uri, state: params.state || null, code_challenge: params.code_challenge, scope: params.scope || null, resource: params.resource || null };
    await db.prepare('INSERT INTO oauth_requests (id, client_id, user_id, params, expires) VALUES (?, ?, NULL, ?, ?)')
      .bind(requestId, client.id, JSON.stringify(keep), Date.now() + REQUEST_TTL).run();
    if (Math.random() < 0.05) await cleanup(db);
  }

  const auth = await requireUser(request, env);
  const resume = `/oauth/authorize?request=${requestId}`;
  if (!auth.ok) {
    if (auth.status === 403) return page('Can’t connect', `<p>${esc(auth.reason)}</p>`, 403);
    return new Response(null, { status: 302, headers: { location: `/auth/google?next=${encodeURIComponent(resume)}`, 'cache-control': 'no-store' } });
  }
  // the request belongs to whoever first opened it signed in
  if (row && row.user_id && row.user_id !== auth.userId) return page('This sign-in belongs to someone else', '<p>Go back to the app you were connecting and start again.</p>', 403);
  await db.prepare('UPDATE oauth_requests SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)').bind(auth.userId, requestId, auth.userId).run();
  return consentPage(requestId, client, params.redirect_uri, auth, env, requestLang(request));
}

export async function authorizePost(request, env, url) {
  if (!sameOrigin(request)) return page('Request refused', '<p>That came from another site.</p>', 403);
  const auth = await requireUser(request, env);
  if (!auth.ok) return page('You’re signed out', '<p>Go back to the app you were connecting and start again.</p>', 401);
  const form = await request.formData().catch(() => null);
  const requestId = form && String(form.get('request') || '');
  if (!requestId) return page('Something went wrong', '<p>Go back to the app you were connecting and start again.</p>', 400);
  const db = env.DB;
  // one use: the row is deleted as it's read
  const row = await db.prepare('DELETE FROM oauth_requests WHERE id = ? AND user_id = ? AND expires > ? RETURNING *').bind(requestId, auth.userId, Date.now()).first();
  if (!row) return page('This sign-in has expired', '<p>Go back to the app you were connecting and start again.</p>', 400);
  const params = JSON.parse(row.params);
  const client = await getClient(db, row.client_id);
  if (!client || !redirectMatches(client.redirect_uris, params.redirect_uri)) return page('Unknown app', '<p>Go back to the app you were connecting and start again.</p>', 400);
  const back = (q) => redirectWith(params.redirect_uri, { ...q, state: params.state, iss: url.origin });
  if (form.get('decision') !== 'allow') return back({ error: 'access_denied', error_description: 'The user didn’t allow access.' });

  const app = redirectApp(params.redirect_uri, env) || {};
  const now = Date.now();
  let grant = await db.prepare('SELECT id FROM oauth_grants WHERE user_id = ? AND client_id = ?').bind(auth.userId, client.id).first();
  if (!grant) {
    grant = { id: uuid() };
    await db.prepare('INSERT INTO oauth_grants (id, user_id, client_id, client_name, redirect_host, scope, created, last_used) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)')
      .bind(grant.id, auth.userId, client.id, app.name || client.name || null, app.host || null, SCOPE, now).run();
  }
  const code = randomToken(32);
  await db.prepare("INSERT INTO oauth_tokens (id, kind, grant_id, user_id, client_id, data, expires) VALUES (?, 'code', ?, ?, ?, ?, ?)")
    .bind(await sha256Hex(code), grant.id, auth.userId, client.id, JSON.stringify({ redirect_uri: params.redirect_uri, code_challenge: params.code_challenge }), now + CODE_TTL).run();
  return back({ code });
}

function redirectWith(uri, query) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(query)) if (v != null) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: u.toString(), 'cache-control': 'no-store' } });
}

/* ---------- token ---------- */
async function readForm(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const b = await request.json().catch(() => ({}));
    return new Map(Object.entries(b || {}).map(([k, v]) => [k, String(v)]));
  }
  const text = await request.text();
  return new Map(new URLSearchParams(text));
}

/** Client credentials from an HTTP Basic header (Gemini sends them there) or the body. */
function credentialsFrom(request, form) {
  const basic = /^Basic\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (basic) {
    try {
      const raw = atob(basic[1].trim());
      const i = raw.indexOf(':');
      const dec = (v) => decodeURIComponent(v.replace(/\+/g, ' '));
      return i < 0 ? { id: dec(raw), secret: null } : { id: dec(raw.slice(0, i)), secret: dec(raw.slice(i + 1)) };
    } catch { return { id: null, secret: null }; }
  }
  return { id: form.get('client_id') || null, secret: form.get('client_secret') || null };
}

/** The calling client, checking its secret when it registered with one. Public clients' secrets are ignored. */
async function authenticateClient(db, request, form) {
  const { id, secret } = credentialsFrom(request, form);
  const client = await getClient(db, id);
  if (!client) return { error: 'Unknown client. Register again.' };
  if (client.secret_hash && (!secret || !safeEqual(await sha256Hex(secret), client.secret_hash))) {
    await noteError(db, client.id, 'token: wrong or missing client secret');
    return { error: 'Wrong client secret.' };
  }
  return { client };
}

export async function token(request, env, url) {
  const form = await readForm(request);
  const db = env.DB;
  const { client, error } = await authenticateClient(db, request, form);
  if (!client) return oauthError('invalid_client', error, 401);
  const fail = async (code, description) => { await noteError(db, client.id, `token: ${code}: ${description}`); return oauthError(code, description); };
  if (!resourceOk(form.get('resource'), url.origin)) return fail('invalid_target', `The resource must be ${mcpUrl(url.origin)}.`);
  const grantType = form.get('grant_type');
  const now = Date.now();

  if (grantType === 'authorization_code') {
    const code = form.get('code') || '';
    const row = await db.prepare("DELETE FROM oauth_tokens WHERE id = ? AND kind = 'code' AND client_id = ? RETURNING *").bind(await sha256Hex(code), client.id).first();
    if (!row || row.expires < now) return fail('invalid_grant', 'The code is wrong, used or expired.');
    const data = JSON.parse(row.data || '{}');
    if (form.get('redirect_uri') && form.get('redirect_uri') !== data.redirect_uri) return fail('invalid_grant', 'redirect_uri doesn’t match.');
    const verifier = form.get('code_verifier') || '';
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || (await s256(verifier)) !== data.code_challenge) return fail('invalid_grant', 'PKCE check failed.');
    return oauthJson(await issueTokens(db, row));
  }

  if (grantType === 'refresh_token') {
    const rt = form.get('refresh_token') || '';
    // rotation: the old refresh token is gone the moment it's used
    const row = await db.prepare("DELETE FROM oauth_tokens WHERE id = ? AND kind = 'refresh' AND client_id = ? RETURNING *").bind(await sha256Hex(rt), client.id).first();
    if (!row || row.expires < now) return oauthError('invalid_grant', 'The refresh token is wrong, used or expired.');
    const ok = await db.prepare('SELECT g.id FROM oauth_grants g JOIN users u ON u.id = g.user_id WHERE g.id = ? AND u.disabled = 0').bind(row.grant_id).first();
    if (!ok) return oauthError('invalid_grant', 'This connection was removed.');
    return oauthJson(await issueTokens(db, row));
  }
  return fail('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

async function s256(verifier) { return bytesToB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))); }

async function issueTokens(db, { grant_id, user_id, client_id }) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const now = Date.now();
  const ins = "INSERT INTO oauth_tokens (id, kind, grant_id, user_id, client_id, data, expires) VALUES (?, ?, ?, ?, ?, NULL, ?)";
  await db.batch([
    db.prepare(ins).bind(await sha256Hex(access), 'access', grant_id, user_id, client_id, now + ACCESS_TTL),
    db.prepare(ins).bind(await sha256Hex(refresh), 'refresh', grant_id, user_id, client_id, now + REFRESH_TTL),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope: SCOPE };
}

/* ---------- revoke ---------- */
export async function revoke(request, env) {
  const form = await readForm(request);
  const t = form.get('token') || '';
  const { client } = await authenticateClient(env.DB, request, form);
  const clientId = client && client.id;
  const row = t ? await env.DB.prepare('SELECT grant_id, client_id FROM oauth_tokens WHERE id = ?').bind(await sha256Hex(t)).first() : null;
  // revoking either token disconnects the app; unknown tokens still get 200 (RFC 7009)
  if (row && row.client_id === clientId) await removeGrant(env.DB, row.grant_id);
  return new Response(null, { status: 200, headers: { 'cache-control': 'no-store', ...CORS } });
}

/* ---------- checking a bearer token on /mcp ---------- */
/** The user an access token belongs to, or null. */
export async function verifyBearer(request, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/i.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT t.user_id, t.grant_id, g.last_used, u.email FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id JOIN users u ON u.id = t.user_id WHERE t.id = ? AND t.kind = 'access' AND t.expires > ? AND u.disabled = 0",
  ).bind(await sha256Hex(m[1]), now).first();
  if (!row) return null;
  if (!row.last_used || now - row.last_used > 600_000) await env.DB.prepare('UPDATE oauth_grants SET last_used = ? WHERE id = ?').bind(now, row.grant_id).run();
  return { userId: row.user_id, email: row.email };
}

/* ---------- the user's connected apps (Settings) ---------- */
export async function listGrants(db, userId) {
  const { results } = await db.prepare('SELECT id, client_name, redirect_host, created, last_used FROM oauth_grants WHERE user_id = ? ORDER BY created DESC').bind(userId).all();
  return results.map((g) => ({ id: g.id, name: g.client_name || g.redirect_host || 'An app', host: g.redirect_host, created: g.created, lastUsed: g.last_used }));
}

export async function removeGrant(db, grantId, userId = null) {
  const g = await db.prepare(`SELECT id FROM oauth_grants WHERE id = ?${userId ? ' AND user_id = ?' : ''}`).bind(...(userId ? [grantId, userId] : [grantId])).first();
  if (!g) return false;
  await db.batch([
    db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ?').bind(grantId),
    db.prepare('DELETE FROM oauth_grants WHERE id = ?').bind(grantId),
  ]);
  return true;
}

/** Everything OAuth keeps for a user (account deletion). */
export function deleteUserStatements(db, userId) {
  return [
    db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM oauth_grants WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM oauth_requests WHERE user_id = ?').bind(userId),
  ];
}

/* ---------- pages ---------- */
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

// written in the user's language here (tr), since its sentences wrap the app's name and the email in tags
function consentPage(requestId, client, redirectUri, auth, env, lang = 'en') {
  const T = (en, vars) => tr(lang, en, vars);
  const app = redirectApp(redirectUri, env);
  const appName = app.name || (app.loopback ? T('An app on your computer') : app.host);
  const calls = client.name && client.name !== app.name ? ` <span class="small">${esc(T('(it calls itself “{name}”)', { name: client.name }))}</span>` : '';
  const body = `
    <p>${T('{app}{calls} wants to read your Euno Shadowing practice data.', { app: `<strong>${esc(appName)}</strong>`, calls })}</p>
    <ul>
      <li>${esc(T('Your clips, sessions, notes, issues, check-ins and settings'))}</li>
      <li>${esc(T('Read only: it can’t change or delete anything'))}</li>
      <li>${esc(T('Not your recordings, AI keys or Discord webhook'))}</li>
    </ul>
    <p class="small">${T('Signed in as {email}. After you choose, you’ll go back to {host}.', { email: `<!--email_off-->${esc(auth.email)}<!--/email_off-->`, host: `<strong>${esc(app.host)}</strong>` })}${app.loopback ? ` ${esc(T('Only allow this if you just started connecting an app on this computer.'))}` : ''} ${esc(T('You can disconnect it any time in Settings → Connections.'))}</p>
    <form method="post" action="/oauth/authorize" class="row">
      <input type="hidden" name="request" value="${esc(requestId)}">
      <button class="btn" type="submit" name="decision" value="allow">${esc(T('Allow'))}</button>
      <button class="btn ghost" type="submit" name="decision" value="deny">${esc(T('Don’t allow'))}</button>
    </form>`;
  return page(T('Connect {app}?', { app: appName }), body);
}

function page(title, body, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Euno Shadowing</title>
<style>
:root{color-scheme:light;--bg:#f6f7f3;--card:#fff;--fg:#111316;--muted:#5f645b;--green:#45b52a;--sunk:#eceee9;--ctl:#8a9085;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#111316;--card:#1b1e1a;--fg:#eceee9;--muted:#9da296;--sunk:#252923;--ctl:#7d8378;--bad:#ff8a80}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Rubik,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box;-webkit-font-smoothing:antialiased}
main{max-width:440px;width:100%;position:relative;padding-top:64px}
.mark{position:absolute;top:0;left:28px;width:96px;height:96px}.mark svg{width:100%;height:100%;display:block}
.card{position:relative;background:var(--card);border-radius:36px;padding:32px 28px 28px}
h1{font-size:1.5rem;font-weight:600;letter-spacing:-.015em;line-height:1.2;margin:0 0 .6rem}a{color:inherit;text-decoration-color:var(--green);text-decoration-thickness:2px;text-underline-offset:3px}ul{padding-left:1.2rem}
.row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.25rem}
.btn{display:inline-flex;align-items:center;min-height:44px;background:var(--green);color:#111316;border:0;border-radius:999px;padding:0 1.3rem;font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.btn.ghost{background:var(--sunk);color:var(--fg)}
.small{font-size:.9rem;color:var(--muted)}.bad{color:var(--bad)}
</style></head><body><main><span class="mark" aria-hidden="true">${EUNO_MARK}</span><div class="card"><h1>${esc(title)}</h1>${body}</div></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
      'referrer-policy': 'same-origin', // not no-referrer: that makes the Allow form send Origin: null
    },
  });
}
