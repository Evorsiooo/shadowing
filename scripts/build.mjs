// Builds the app into dist/ for Cloudflare Pages:
//   dist/index.html — the whole app as one page (styles and scripts inlined)
//   dist/_headers   — security headers
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const js = readdirSync(join(src, 'js'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `/* ---- ${f} ---- */\n` + readFileSync(join(src, 'js', f), 'utf8'))
  .join('\n');
if (js.includes('</script')) throw new Error('A script contains "</script", which would break the inline page.');

const body = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('/*@STYLES@*/', () => css)
  .replace('/*@SCRIPTS@*/', () => js);

mkdirSync(join(root, 'dist'), { recursive: true });
rmSync(join(root, 'dist', 'artifact.html'), { force: true });
const appPage = `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
// The app is served at /app (signed-in only, see functions/app/_middleware.js).
mkdirSync(join(root, 'dist', 'app'), { recursive: true });
writeFileSync(join(root, 'dist', 'app', 'index.html'), appPage);
// Until the landing page exists, / shows the app too.
writeFileSync(join(root, 'dist', 'index.html'), appPage);
writeFileSync(
  join(root, 'dist', '_headers'),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: microphone=(self), camera=(), geolocation=()\n`,
);
console.log(`built dist/index.html (${(body.length / 1024).toFixed(0)} KB)`);
