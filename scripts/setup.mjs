// One-shot Cloudflare setup + deploy. Safe to re-run: every step skips what already exists.
//
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/setup.mjs --email you@example.com
//
// Optional: ANTHROPIC_API_KEY in the environment is stored as a Pages secret.
// Flags: --project <name> (default "shadowing"), --new-mcp-token, --skip-access, --skip-deploy
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT = opt('project', 'shadowing');
const EMAIL = opt('email', process.env.ALLOWED_EMAIL || '');
const DB_NAME = 'shadowing';
const BUCKET = 'shadowing-files';
if (!TOKEN || !ACCOUNT) die('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.');
if (!EMAIL && !flag('skip-access')) die('Pass --email <the email you sign in with>.');

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' };
const tomlPath = join(root, 'wrangler.toml');
let toml = readFileSync(tomlPath, 'utf8');
const secretsDir = join(root, '.secrets');

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

// 3. Pages project
step('Pages project');
const pOut = wrangler(['pages', 'project', 'create', PROJECT, '--production-branch', 'main'], { allowFail: true });
console.log(/already exists|A project with this name already exists/i.test(pOut) ? '  exists' : '  created');
const host = `${PROJECT}.pages.dev`;

// 4. Cloudflare Access: lock the site to your email, let /mcp/* through (it has its own secret)
if (!flag('skip-access')) {
  step('Cloudflare Access');
  let org;
  try { org = await cf('GET', `/accounts/${ACCOUNT}/access/organizations`); } catch (e) {
    die(`Couldn't read your Zero Trust organisation. Open the Cloudflare dashboard → Zero Trust once, pick a team name and the Free plan, then re-run.\n  (${e.message})`);
  }
  const team = org.auth_domain;
  const apps = await cf('GET', `/accounts/${ACCOUNT}/access/apps`);
  const policies = await cf('GET', `/accounts/${ACCOUNT}/access/policies`);
  const ensurePolicy = async (name, body) => policies.find((p) => p.name === name) || cf('POST', `/accounts/${ACCOUNT}/access/policies`, { name, ...body });
  const allow = await ensurePolicy(`${PROJECT}: only me`, { decision: 'allow', include: [{ email: { email: EMAIL } }] });
  const bypass = await ensurePolicy(`${PROJECT}: MCP bypass`, { decision: 'bypass', include: [{ everyone: {} }] });
  const ensureApp = async (name, domains, policy, extra = {}) => {
    const body = {
      name, type: 'self_hosted', domain: domains[0], self_hosted_domains: domains,
      policies: [{ id: policy.id, precedence: 1 }], app_launcher_visible: false, ...extra,
    };
    const cur = apps.find((a) => a.name === name);
    return cur ? cf('PUT', `/accounts/${ACCOUNT}/access/apps/${cur.id}`, body) : cf('POST', `/accounts/${ACCOUNT}/access/apps`, body);
  };
  const app = await ensureApp(`${PROJECT} app`, [host, `*.${host}`], allow, { session_duration: '720h' });
  await ensureApp(`${PROJECT} MCP`, [`${host}/mcp`], bypass);
  setVar('ACCESS_TEAM_DOMAIN', team);
  setVar('ACCESS_AUD', app.aud);
  setVar('ALLOWED_EMAIL', EMAIL);
  console.log(`  ${host} is locked to ${EMAIL} (sign-in lasts 30 days); /mcp bypasses Access`);
}

// 5. Secrets
step('Secrets');
mkdirSync(secretsDir, { recursive: true });
const tokenFile = join(secretsDir, 'mcp-token');
let mcpToken = existsSync(tokenFile) && !flag('new-mcp-token') ? readFileSync(tokenFile, 'utf8').trim() : '';
if (!mcpToken) {
  mcpToken = randomBytes(24).toString('base64url');
  writeFileSync(tokenFile, mcpToken + '\n', { mode: 0o600 });
}
wrangler(['pages', 'secret', 'put', 'MCP_TOKEN', '--project-name', PROJECT], { input: mcpToken });
console.log('  MCP_TOKEN set');
if (process.env.ANTHROPIC_API_KEY) {
  wrangler(['pages', 'secret', 'put', 'ANTHROPIC_API_KEY', '--project-name', PROJECT], { input: process.env.ANTHROPIC_API_KEY });
  console.log('  ANTHROPIC_API_KEY set');
} else console.log('  ANTHROPIC_API_KEY not in the environment; Claude feedback stays off until you add it');

// 6. Build and deploy
if (!flag('skip-deploy')) {
  step('Build and deploy');
  execFileSync('node', ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
  wrangler(['pages', 'deploy', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true']);
}
writeFileSync(join(secretsDir, 'mcp-url.txt'), `https://${host}/mcp/${mcpToken}\n`, { mode: 0o600 });
console.log(`\n✓ Done.\n  App:  https://${host}\n  MCP:  saved in .secrets/mcp-url.txt (add it in claude.ai → Settings → Connectors → Add custom connector)\n`);
