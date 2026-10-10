// Builds the app into single-file pages:
//   dist/artifact.html — page body for publishing as a Claude artifact (the platform adds the document skeleton)
//   dist/index.html    — standalone page (open locally or host anywhere, e.g. GitHub Pages)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
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
writeFileSync(join(root, 'dist', 'artifact.html'), body);
writeFileSync(
  join(root, 'dist', 'index.html'),
  `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
console.log(`built dist/artifact.html and dist/index.html (${(body.length / 1024).toFixed(0)} KB)`);
