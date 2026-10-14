// Proves accounts are isolated: user A can't read, change or delete user B's data.
// Runs against a local dev server with the local D1 database:
//   npm run build && npx wrangler d1 migrations apply shadowing --local && npx wrangler pages dev
//   node scripts/test-accounts.mjs            (BASE=http://localhost:8788 by default)
// It creates two throwaway users with sessions straight in the local database, then uses the API as each.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8788';
const sql = (command) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'shadowing', '--local', '--json', '--command', command], { encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
const run = randomBytes(4).toString('hex');
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };

function makeUser(name) {
  const id = `test${name}${run}`;
  const token = randomBytes(32).toString('base64url');
  const sid = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  sql(`INSERT INTO users (id, google_sub, email, name, role, created) VALUES ('${id}', 'sub-${id}', '${id}@example.com', '${name}', 'user', ${now});
       INSERT INTO sessions (id, user_id, created, expires, last_seen) VALUES ('${sid}', '${id}', ${now}, ${now + 86400000}, ${now});`);
  const call = async (method, path, body, headers = {}) => {
    const raw = body instanceof Uint8Array;
    const r = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { cookie: `__Host-euno_session=${token}`, ...(body != null && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body == null ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, data, text };
  };
  return { id, email: `${id}@example.com`, call };
}

const A = makeUser('A');
const B = makeUser('B');

// documents
await A.call('PUT', '/api/docs/notes/shared-id', { sentence: 'A’s secret' });
await B.call('PUT', '/api/docs/notes/shared-id', { sentence: 'B’s own' });
const aDocs = (await A.call('GET', '/api/docs')).data.data;
const bDocs = (await B.call('GET', '/api/docs')).data.data;
check(aDocs.notes['shared-id'].sentence === 'A’s secret', 'A reads its own note');
check(bDocs.notes['shared-id'].sentence === 'B’s own', 'the same id is a separate note for B');
check(!Object.keys(bDocs.videos).length && !Object.keys(bDocs.sessions).length, 'B sees none of the existing (migrated) data');
await B.call('DELETE', '/api/docs/notes/shared-id');
check((await A.call('GET', '/api/docs')).data.data.notes['shared-id'], 'B deleting "its" note leaves A’s note alone');

// files
const up = await A.call('POST', '/api/files?kind=rec', new Uint8Array([1, 2, 3, 4]), { 'content-type': 'audio/webm' });
check(up.status === 200 && up.data.key.startsWith(`u/${A.id}/rec/`), 'A’s upload is stored under A’s prefix');
check((await A.call('GET', `/api/files/${up.data.key}`)).status === 200, 'A can read its file');
check((await B.call('GET', `/api/files/${up.data.key}`)).status === 404, 'B can’t read A’s file');
check((await B.call('DELETE', `/api/files/${up.data.key}`)).status === 404, 'B can’t delete A’s file');
const legacy = JSON.parse(sql("SELECT key FROM files WHERE key NOT LIKE 'u/%' LIMIT 1"))[0].results[0];
if (legacy) check((await B.call('GET', `/api/files/${legacy.key}`)).status === 404, 'B can’t read a pre-accounts file owned by someone else');
const mp = await B.call('POST', '/api/uploads', { filename: 'x.mp4', type: 'video/mp4' });
check((await B.call('PUT', `/api/uploads/${mp.data.uploadId}/1?key=${encodeURIComponent(`u/${A.id}/video/x.mp4`)}`, new Uint8Array([1]))).status === 400, 'B can’t write a multipart part into A’s prefix');

// reminders, AI, cross-site writes
await A.call('PUT', '/api/reminders', { webhook: 'https://discord.com/api/webhooks/123456/abcdefghijklmnopqrstuvwxyz' });
check((await A.call('GET', '/api/reminders')).data.configured === true, 'A’s webhook is saved');
check((await B.call('GET', '/api/reminders')).data.configured === false, 'B doesn’t see A’s webhook');
check((await A.call('POST', '/api/claude', { off: 'x' })).status === 403, 'non-admins can’t use the server AI key');
check((await A.call('PUT', '/api/docs/notes/x', { a: 1 }, { origin: 'https://evil.example' })).status === 403, 'cross-site writes are refused');
check((await fetch(`${BASE}/api/docs`)).status === 401, 'no cookie, no data');
check((await A.call('GET', '/api/me')).data.email === A.email, '/api/me returns the signed-in user');

// contact form
check((await fetch(`${BASE}/api/support`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Hello there' }) })).status === 400, 'contact form needs an email when signed out');
check((await B.call('POST', '/api/support', { message: 'Hello from B' })).status === 200, 'contact form works signed in');

// account deletion
check((await A.call('DELETE', '/api/account', { confirm: 'wrong@example.com' })).status === 400, 'deletion needs the email typed in');
check((await A.call('DELETE', '/api/account', { confirm: A.email })).status === 200, 'A deletes its account');
check((await A.call('GET', '/api/docs')).status === 401, 'A’s session is gone');
const left = JSON.parse(sql(`SELECT (SELECT COUNT(*) FROM docs WHERE user_id = '${A.id}') + (SELECT COUNT(*) FROM private WHERE user_id = '${A.id}') + (SELECT COUNT(*) FROM files WHERE user_id = '${A.id}') + (SELECT COUNT(*) FROM users WHERE id = '${A.id}') AS n`))[0].results[0].n;
check(left === 0, 'nothing of A’s is left in the database');
check((await B.call('GET', '/api/docs')).status === 200, 'B is unaffected');

// clean up B
await B.call('DELETE', '/api/account', { confirm: B.email });
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
