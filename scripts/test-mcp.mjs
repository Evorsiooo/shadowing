// Proves the MCP server's OAuth works end to end and that each app only ever reaches its own user's data.
// Runs against a local dev server with the local D1 database:
//   npm run build && npx wrangler d1 migrations apply shadowing --local && npx wrangler pages dev
//   node scripts/test-mcp.mjs            (BASE=http://localhost:8788 by default)
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8788';
const sql = (command) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'shadowing', '--local', '--json', '--command', command], { encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
const run = randomBytes(4).toString('hex');
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };
const b64url = (b) => Buffer.from(b).toString('base64url');
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const GEMINI = 'https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-test';

function makeUser(name) {
  const id = `mcp${name}${run}`;
  const token = randomBytes(32).toString('base64url');
  const sid = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  sql(`INSERT INTO users (id, google_sub, email, name, role, created) VALUES ('${id}', 'sub-${id}', '${id}@example.com', '${name}', 'user', ${now});
       INSERT INTO sessions (id, user_id, created, expires, last_seen) VALUES ('${sid}', '${id}', ${now}, ${now + 86400000}, ${now});`);
  const cookie = `__Host-euno_session=${token}`;
  const api = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  return { id, cookie, api };
}

const form = (o) => new URLSearchParams(o).toString();
const post = (path, body, headers = {}) => fetch(BASE + path, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: form(body) });

async function registerClient(redirect, extra = {}) {
  const r = await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Test', redirect_uris: [redirect], ...extra }) });
  return { status: r.status, data: await r.json() };
}

/** Run the whole sign-in as `user` and return {tokens, clientId}. */
async function connect(user, redirect = CLAUDE, { decision = 'allow', clientId = null } = {}) {
  const cid = clientId || (await registerClient(redirect)).data.client_id;
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const q = new URLSearchParams({ response_type: 'code', client_id: cid, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'practice:read', resource: `${BASE}/mcp` });
  const page = await fetch(`${BASE}/oauth/authorize?${q}`, { headers: { cookie: user.cookie }, redirect: 'manual' });
  const html = await page.text();
  const request = (/name="request" value="([^"]+)"/.exec(html) || [])[1];
  const done = await post('/oauth/authorize', { request, decision }, { cookie: user.cookie, origin: BASE });
  const loc = new URL(done.headers.get('location'));
  const code = loc.searchParams.get('code');
  return { cid, verifier, code, loc, html, request };
}

async function exchange(cid, code, verifier, redirect = CLAUDE, headers = {}) {
  const body = { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect, resource: `${BASE}/mcp` };
  if (!headers.authorization) body.client_id = cid;
  const r = await post('/oauth/token', body, headers);
  return { status: r.status, data: await r.json() };
}

let rpcId = 1;
async function mcp(token, method, params = {}) {
  const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }) });
  return { status: r.status, data: await r.json().catch(() => null), headers: r.headers };
}
const tool = async (token, name, args = {}) => {
  const r = await mcp(token, 'tools/call', { name, arguments: args });
  const res = r.data && r.data.result;
  return res && !res.isError ? JSON.parse(res.content[0].text) : { error: res ? res.content[0].text : r.status };
};

const A = makeUser('A');
const B = makeUser('B');
await A.api('PUT', '/api/docs/notes/n1', { sentence: 'Go and grab the car', off: 'flat vowel in go', date: '2026-10-10' });
await A.api('PUT', '/api/docs/issues/i1', { name: 'GOAT vowel', status: 'open', noteIds: ['n1'] });
await B.api('PUT', '/api/docs/notes/n1', { sentence: 'B secret sentence', off: 'B only', date: '2026-10-11' });

// discovery
const unauth = await fetch(`${BASE}/mcp`, { method: 'POST', body: '{}' });
check(unauth.status === 401 && /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/.test(unauth.headers.get('www-authenticate')), 'unauthenticated /mcp answers 401 pointing at the metadata');
const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
check(prm.resource === `${BASE}/mcp` && prm.authorization_servers[0] === BASE, 'protected resource metadata names this server');
const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
check(asm.registration_endpoint && asm.code_challenge_methods_supported.includes('S256') && asm.token_endpoint_auth_methods_supported.includes('none'), 'authorization server metadata offers registration, S256 and public clients');

// registration
check((await registerClient('https://evil.example.com/cb')).status === 400, 'an unknown redirect can’t register');
check((await registerClient('http://example.com/cb')).status === 400, 'a non-loopback http redirect can’t register');
const gem = await registerClient(GEMINI, { token_endpoint_auth_method: 'client_secret_basic' });
check(gem.status === 201 && gem.data.token_endpoint_auth_method === 'none' && !gem.data.client_secret, 'Gemini’s client_secret_basic request becomes a public client');
check((await registerClient('http://127.0.0.1:33418/callback')).status === 201, 'a loopback redirect (Claude Code, Gemini CLI) can register');

// sign-in as A through Claude
const a = await connect(A);
check(a.html.includes('Connect Claude?') && a.html.includes('claude.ai'), 'the consent page names Claude and where it returns to');
check(a.loc.origin + a.loc.pathname === CLAUDE && a.loc.searchParams.get('state') === 'xyz' && a.loc.searchParams.get('iss') === BASE && a.code, 'Allow sends a code back to Claude with state and iss');
check((await exchange(a.cid, a.code, b64url(randomBytes(32)))).status === 400, 'a wrong PKCE verifier is refused');
const a2 = await connect(A, CLAUDE, { clientId: a.cid });
const ta = await exchange(a2.cid, a2.code, a2.verifier);
check(ta.status === 200 && ta.data.access_token && ta.data.refresh_token && ta.data.token_type === 'Bearer', 'the code becomes an access and a refresh token');
check((await exchange(a2.cid, a2.code, a2.verifier)).status === 400, 'a code works only once');

const denied = await connect(A, CLAUDE, { decision: 'deny', clientId: a.cid });
check(denied.loc.searchParams.get('error') === 'access_denied' && !denied.code, '“Don’t allow” returns access_denied');

// a consent request opened by A can't be approved by B
{
  const q = new URLSearchParams({ response_type: 'code', client_id: a.cid, redirect_uri: CLAUDE, code_challenge: b64url(randomBytes(32)), code_challenge_method: 'S256' });
  const html = await (await fetch(`${BASE}/oauth/authorize?${q}`, { headers: { cookie: A.cookie } })).text();
  const request = /name="request" value="([^"]+)"/.exec(html)[1];
  const r = await post('/oauth/authorize', { request, decision: 'allow' }, { cookie: B.cookie, origin: BASE });
  check(r.status === 400 && !r.headers.get('location'), 'B can’t approve a sign-in A started');
  const x = await post('/oauth/authorize', { request, decision: 'allow' }, { cookie: A.cookie, origin: 'https://evil.example.com' });
  check(x.status === 403, 'a cross-site approval is refused');
}
check((await fetch(`${BASE}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: a.cid, redirect_uri: 'https://claude.ai/api/mcp/other', code_challenge: b64url(randomBytes(32)), code_challenge_method: 'S256' })}`, { headers: { cookie: A.cookie }, redirect: 'manual' })).status === 400, 'a redirect the app didn’t register is refused without redirecting');
const signedOut = await fetch(`${BASE}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: a.cid, redirect_uri: CLAUDE, code_challenge: b64url(randomBytes(32)), code_challenge_method: 'S256' })}`, { redirect: 'manual' });
check(signedOut.status === 302 && /^\/auth\/google\?next=%2Foauth%2Fauthorize%3Frequest%3D/.test(signedOut.headers.get('location')), 'a signed-out user is sent to Google sign-in and back to the consent page');

// the tools as A
const init = await mcp(ta.data.access_token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
check(init.data.result && init.data.result.protocolVersion === '2025-06-18' && init.data.result.capabilities.tools, 'initialize works');
const list = await mcp(ta.data.access_token, 'tools/list');
check(list.data.result.tools.every((t) => t.annotations && t.annotations.readOnlyHint === true), 'every tool is marked read-only');
check(!list.data.result.tools.some((t) => /put|delete|sql|write/i.test(t.name)), 'there are no write or SQL tools');
const ov = await tool(ta.data.access_token, 'get_overview');
check(ov.openIssues && ov.openIssues.length === 1 && ov.openIssues[0].name === 'GOAT vowel', 'get_overview shows A’s open issue');
const an = await tool(ta.data.access_token, 'get_record', { collection: 'notes', id: 'n1' });
check(an.sentence === 'Go and grab the car', 'A’s token reads A’s note');
const sr = await tool(ta.data.access_token, 'search', { query: 'secret' });
check(sr.results && sr.results.length === 0, 'A’s search never finds B’s note');
const sr2 = await tool(ta.data.access_token, 'search', { query: 'vowel' });
check(sr2.results.length === 2, 'search finds A’s note and issue');
const f = await tool(ta.data.access_token, 'fetch', { id: sr2.results[0].id });
check(f.text && f.id === sr2.results[0].id, 'fetch opens a search result');
const lr = await tool(ta.data.access_token, 'list_records', { collection: 'notes' });
check(lr.total === 1 && lr.records[0].sentence === 'Go and grab the car', 'list_records lists only A’s notes');

// B through Gemini (client id in a Basic header, as Gemini sends it)
const b = await connect(B, GEMINI, { clientId: gem.data.client_id });
const tb = await exchange(b.cid, b.code, b.verifier, GEMINI, { authorization: `Basic ${Buffer.from(`${b.cid}:ignored-secret`).toString('base64')}` });
check(tb.status === 200, 'Gemini’s token request with a Basic header works');
const bn = await tool(tb.data.access_token, 'get_record', { collection: 'notes', id: 'n1' });
check(bn.sentence === 'B secret sentence', 'the same note id gives B its own note');
check((await tool(tb.data.access_token, 'get_overview')).openIssues.length === 0, 'B’s overview has none of A’s issues');

// refresh rotation
const r1 = await post('/oauth/token', { grant_type: 'refresh_token', refresh_token: ta.data.refresh_token, client_id: a.cid });
const r1d = await r1.json();
check(r1.status === 200 && r1d.refresh_token && r1d.refresh_token !== ta.data.refresh_token, 'refreshing gives a new refresh token');
const r2 = await post('/oauth/token', { grant_type: 'refresh_token', refresh_token: ta.data.refresh_token, client_id: a.cid });
check(r2.status === 400 && (await r2.json()).error === 'invalid_grant', 'an old refresh token is refused with invalid_grant');
const r3 = await post('/oauth/token', { grant_type: 'refresh_token', refresh_token: r1d.refresh_token, client_id: gem.data.client_id });
check(r3.status === 400, 'another client can’t use A’s refresh token');

// Settings → Connected apps
const conns = await A.api('GET', '/api/connections');
check(conns.data.connections.length === 1 && conns.data.connections[0].name === 'Claude', 'A sees Claude in Connected apps');
check(!(await B.api('GET', '/api/connections')).data.connections.some((c) => c.id === conns.data.connections[0].id), 'B can’t see A’s connection');
check((await B.api('DELETE', `/api/connections/${conns.data.connections[0].id}`)).status === 404, 'B can’t disconnect A’s app');
check((await mcp(r1d.access_token, 'tools/list')).status === 200, 'the refreshed access token works');
await A.api('DELETE', `/api/connections/${conns.data.connections[0].id}`);
check((await mcp(r1d.access_token, 'tools/list')).status === 401, 'disconnecting stops the app’s token at once');

// disabled account
sql(`UPDATE users SET disabled = 1 WHERE id = '${B.id}'`);
check((await mcp(tb.data.access_token, 'tools/list')).status === 401, 'a disabled account’s token stops working');

// the site-wide registration cap
{
  const now = Date.now();
  const n = Number(JSON.parse(sql(`SELECT COUNT(*) AS n FROM oauth_clients WHERE created > ${now - 3600000}`))[0].results[0].n);
  const fill = Math.max(0, 300 - n);
  const values = Array.from({ length: fill }, (_, i) => `('mcp_cap${run}${String(i).padStart(4, '0')}', NULL, '[]', ${now})`).join(',');
  if (fill) sql(`INSERT INTO oauth_clients (id, name, redirect_uris, created) VALUES ${values}`);
  check((await registerClient(CLAUDE)).status === 429, 'registration stops at 300 new apps an hour');
  sql(`DELETE FROM oauth_clients WHERE id LIKE 'mcp_cap${run}%'`);
}

// tidy up
for (const u of [A, B]) sql(`DELETE FROM docs WHERE user_id = '${u.id}'; DELETE FROM sessions WHERE user_id = '${u.id}'; DELETE FROM oauth_tokens WHERE user_id = '${u.id}'; DELETE FROM oauth_grants WHERE user_id = '${u.id}'; DELETE FROM oauth_requests WHERE user_id = '${u.id}'; DELETE FROM users WHERE id = '${u.id}';`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
