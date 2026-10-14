// Sets up the VAPID key pair that push notifications are signed with, once:
//   node scripts/push-keys.mjs            makes a pair (kept in .secrets/vapid.json, git-ignored) and
//                                         sets VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the Pages project
//                                         and on the reminders Worker
//   node scripts/push-keys.mjs --dev      writes them to .dev.vars instead, for `npm run dev`
// Running it again reuses the saved pair. A new pair would cut off every device that turned
// notifications on (they'd have to turn them on again), so don't replace it without a reason.
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { b64u } from '../server/webpush.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, '.secrets', 'vapid.json');

let keys;
if (existsSync(file)) {
  keys = JSON.parse(readFileSync(file, 'utf8'));
  console.log('Using the saved key pair in .secrets/vapid.json');
} else {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  keys = {
    VAPID_PUBLIC_KEY: b64u.encode(await crypto.subtle.exportKey('raw', pair.publicKey)),
    VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d,
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(keys, null, 2) + '\n', { mode: 0o600 });
  console.log('Made a new key pair and saved it in .secrets/vapid.json');
}

if (process.argv.includes('--dev')) {
  const vars = join(root, '.dev.vars');
  const have = existsSync(vars) ? readFileSync(vars, 'utf8') : '';
  for (const [k, v] of Object.entries(keys)) if (!new RegExp(`^${k}=`, 'm').test(have)) appendFileSync(vars, `${have && !have.endsWith('\n') ? '\n' : ''}${k}=${v}\n`);
  console.log('Added the keys to .dev.vars');
} else {
  const wrangler = (args, value) => execFileSync('npx', ['wrangler', ...args], { input: value, stdio: ['pipe', 'inherit', 'inherit'], cwd: root });
  for (const [k, v] of Object.entries(keys)) {
    wrangler(['pages', 'secret', 'put', k, '--project-name', 'shadowing'], v);
    wrangler(['secret', 'put', k, '-c', 'workers/reminders/wrangler.toml'], v);
  }
  console.log(`Done. Public key: ${keys.VAPID_PUBLIC_KEY}\nRedeploy the reminders Worker (npm run deploy:reminders) if it was deployed before this change.`);
}
