// One-shot Cloudflare setup for the GitHub-connected Pages project. Safe to re-run:
// every step skips what already exists. Cloudflare builds and deploys the site itself
// on every push to main; this script sets up everything around it.
//
// Before running: connect the GitHub repo in the Cloudflare dashboard (see README).
//
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/setup.mjs
//
// Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and KEY_ENCRYPTION_KEY in the environment are stored as Pages secrets.
// Flags: --project <name> (default "shadowing")
//
// Afterwards commit wrangler.toml (database id) and merge it to main.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT = opt('project', 'shadowing');
const DB_NAME = 'shadowing';
const BUCKET = 'shadowing-files';
if (!TOKEN || !ACCOUNT) die('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.');

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' };
const tomlPath = join(root, 'wrangler.toml');
let toml = readFileSync(tomlPath, 'utf8');

function die(msg) { console.error(`\n✗ ${msg}`); process.exit(1); }
function step(msg) { console.log(`\n→ ${msg}`); }
function wrangler(argv, { input, allowFail = false } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...argv], { cwd: root, env, input, encoding: 'utf8', stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    if (allowFail) return out;
    die(`wrangler ${argv.join(' ')} failed:\n${out}`);
  }
}
async function cf(method, path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!d.success) throw new Error(`${method} ${path}: ${JSON.stringify(d.errors || d)}`);
  return d.result;
}
function setVar(name, value) {
  const re = new RegExp(`^${name} = ".*"$`, 'm');
  toml = re.test(toml) ? toml.replace(re, `${name} = "${value}"`) : toml;
  writeFileSync(tomlPath, toml);
}

// 1. D1 database
step('D1 database');
const dbs = await cf('GET', `/accounts/${ACCOUNT}/d1/database?name=${DB_NAME}`);
let db = (dbs || []).find((d) => d.name === DB_NAME);
if (!db) { db = await cf('POST', `/accounts/${ACCOUNT}/d1/database`, { name: DB_NAME }); console.log('  created'); } else console.log('  exists');
toml = toml.replace(/database_id = ".*"/, `database_id = "${db.uuid}"`);
writeFileSync(tomlPath, toml);
wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote']);
console.log('  migrations applied');

// 2. R2 bucket
step('R2 bucket');
const out = wrangler(['r2', 'bucket', 'create', BUCKET], { allowFail: true });
console.log(/already exists/i.test(out) ? '  exists' : '  created');

// 3. Pages project (created by connecting the GitHub repo in the dashboard)
step('Pages project');
let project;
try { project = await cf('GET', `/accounts/${ACCOUNT}/pages/projects/${PROJECT}`); } catch {
  die(`No Pages project called "${PROJECT}" yet. In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git → pick the shadowing repo, name it "${PROJECT}", production branch main, build command "npm run build", output directory "dist". Then re-run this script.`);
}
const host = project.subdomain;
console.log(`  found: https://${host}${project.source ? ` (builds from ${project.source.config.owner}/${project.source.config.repo_name})` : ''}`);
toml = toml.replace(/^name = ".*"$/m, `name = "${PROJECT}"`);
writeFileSync(tomlPath, toml);

// 4. Secrets: Google sign-in (see docs/ACCOUNTS.md for creating the OAuth client)
step('Secrets');
for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'KEY_ENCRYPTION_KEY']) {
  if (process.env[name]) {
    wrangler(['pages', 'secret', 'put', name, '--project-name', PROJECT], { input: process.env[name] });
    console.log(`  ${name} set`);
  } else console.log(`  ${name} not in the environment; ${name === 'KEY_ENCRYPTION_KEY' ? 'AI keys stay off' : 'sign-in stays off'} until you add it`);
}

console.log(`\n✓ Done.
  App:  https://${host}/app
  Next: commit wrangler.toml and merge it to main. Cloudflare redeploys with the database and storage settings.\n`);
