// Proves the admin routes are admin-only and do what the admin page needs.
// Runs against a local dev server with the local D1 database, like test-accounts.mjs:
//   npm run build && npx wrangler d1 migrations apply shadowing --local && npx wrangler pages dev
//   node scripts/test-admin.mjs            (BASE=http://localhost:8788 by default)
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8788';
const sql = (command) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'shadowing', '--local', '--json', '--command', command], { encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
const run = randomBytes(4).toString('hex');
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };

function makeUser(name, role = 'user') {
  const id = `test${name}${run}`;
  const token = randomBytes(32).toString('base64url');
  const sid = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  sql(`INSERT INTO users (id, google_sub, email, name, role, created) VALUES ('${id}', 'sub-${id}', '${id}@example.com', '${name}', '${role}', ${now});
       INSERT INTO sessions (id, user_id, created, expires, last_seen) VALUES ('${sid}', '${id}', ${now}, ${now + 86400000}, ${now});`);
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { cookie: `__Host-euno_session=${token}`, ...(body != null ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, data };
  };
  return { id, email: `${id}@example.com`, call };
}

const Admin = makeUser('Admin', 'admin');
const U = makeUser('U');
const V = makeUser('V');
const signupBefore = (await Admin.call('GET', '/api/admin/signup')).data.mode;

// only admins get in
for (const [m, p] of [['GET', '/api/admin/users'], ['GET', '/api/admin/signup'], ['PUT', '/api/admin/signup'], ['GET', '/api/admin/invites'], ['POST', '/api/admin/invites'], ['GET', '/api/admin/support'], ['DELETE', `/api/admin/users/${V.id}`]]) {
  check((await U.call(m, p, m === 'GET' ? null : { mode: 'invite', confirm: V.email })).status === 403, `a normal user gets 403 on ${m} ${p}`);
}
check((await fetch(`${BASE}/api/admin/users`)).status === 401, 'no cookie, no admin');
check((await Admin.call('PUT', '/api/admin/signup', { mode: 'open' }, { origin: 'https://evil.example' })).status === 403, 'cross-site admin writes are refused');

// users
const users = (await Admin.call('GET', '/api/admin/users')).data.users;
const u = users.find((x) => x.id === U.id);
check(u && u.email === U.email && typeof u.sessions === 'number', 'the user list has each account with a session count');
check(users.find((x) => x.id === Admin.id).self === true, 'the admin’s own row is marked');
check(!JSON.stringify(users).includes('google_sub') && !JSON.stringify(users).includes('sub-'), 'the user list leaves out Google ids');
check((await Admin.call('PATCH', `/api/admin/users/${Admin.id}`, { disabled: true })).status === 400, 'the admin can’t disable themselves');
check((await Admin.call('PATCH', `/api/admin/users/${U.id}`, { disabled: true })).status === 200, 'the admin disables U');
check((await U.call('GET', '/api/docs')).status === 401, 'U is signed out straight away');
check(JSON.parse(sql(`SELECT disabled FROM users WHERE id = '${U.id}'`))[0].results[0].disabled === 1, 'U is marked disabled');
check((await Admin.call('PATCH', `/api/admin/users/${U.id}`, { disabled: false })).status === 200, 'the admin enables U again');
check((await Admin.call('DELETE', `/api/admin/users/${V.id}`, { confirm: 'nope@example.com' })).status === 400, 'deleting needs the email typed in');
await V.call('PUT', '/api/docs/notes/x', { a: 1 });
check((await Admin.call('DELETE', `/api/admin/users/${V.id}`, { confirm: V.email })).status === 200, 'the admin deletes V');
check((await V.call('GET', '/api/docs')).status === 401, 'V’s session is gone');
check(JSON.parse(sql(`SELECT (SELECT COUNT(*) FROM docs WHERE user_id = '${V.id}') + (SELECT COUNT(*) FROM users WHERE id = '${V.id}') AS n`))[0].results[0].n === 0, 'nothing of V’s is left');
check((await Admin.call('DELETE', `/api/admin/users/nope${run}`, { confirm: 'x' })).status === 404, 'unknown users are 404');

// sign-up mode
check((await Admin.call('PUT', '/api/admin/signup', { mode: 'closed-ish' })).status === 400, 'only open or invite are accepted');
check((await Admin.call('PUT', '/api/admin/signup', { mode: 'invite' })).data.mode === 'invite', 'sign-up switches to invite-only');
check((await Admin.call('GET', '/api/admin/signup')).data.mode === 'invite', 'and stays that way');
const invitePage = await fetch(`${BASE}/auth/google`, { redirect: 'manual' });
check(invitePage.status === 200 && (await invitePage.text()).includes('invite code'), 'sign-in now asks new people for an invite code');

// invite codes
check((await Admin.call('POST', '/api/admin/invites', { maxUses: 0 })).status === 400, 'uses must be at least 1');
const inv = (await Admin.call('POST', '/api/admin/invites', { maxUses: 2, expiresDays: 7, note: 'test' })).data.invite;
check(/^EUNO-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(inv.code) && inv.max_uses === 2 && inv.expires > Date.now(), 'a code is generated with uses and expiry');
const startWith = await fetch(`${BASE}/auth/google?invite=${inv.code}`, { redirect: 'manual' });
check(startWith.status === 302 || startWith.status === 503, 'a valid code goes on to Google');
sql(`UPDATE users SET invite_code = '${inv.code}' WHERE id = '${U.id}'`);
const listed = (await Admin.call('GET', '/api/admin/invites')).data.invites.find((i) => i.code === inv.code);
check(listed.status === 'active' && listed.usedBy.some((x) => x.email === U.email), 'the list shows who used a code');
check((await Admin.call('DELETE', `/api/admin/invites/${inv.code}`)).status === 200, 'the admin revokes the code');
check((await Admin.call('GET', '/api/admin/invites')).data.invites.find((i) => i.code === inv.code).status === 'ended', 'a revoked code shows as ended');
const startRevoked = await fetch(`${BASE}/auth/google?invite=${inv.code}`, { redirect: 'manual' });
check(startRevoked.status === 200 && (await startRevoked.text()).includes('isn’t valid'), 'a revoked code no longer works');

// support inbox
// (U was signed out when disabled, so this arrives like a visitor's message)
check((await U.call('POST', '/api/support', { email: U.email, message: `Inbox test ${run}` })).status === 200, 'the contact form accepts a message');
const msg = (await Admin.call('GET', '/api/admin/support')).data.messages.find((m) => m.message === `Inbox test ${run}`);
check(msg && msg.status === 'open' && msg.email === U.email.toLowerCase(), 'contact-form messages show up in the inbox');
check((await Admin.call('PATCH', `/api/admin/support/${msg.id}`, { status: 'done' })).data.status === 'done', 'a message can be marked handled');
check((await Admin.call('DELETE', `/api/admin/support/${msg.id}`)).status === 200, 'a message can be deleted');

// clean up
await Admin.call('PUT', '/api/admin/signup', { mode: signupBefore });
sql(`DELETE FROM invites WHERE code = '${inv.code}'`);
sql(`DELETE FROM users WHERE id = '${U.id}'`);
await Admin.call('DELETE', '/api/account', { confirm: Admin.email });
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
