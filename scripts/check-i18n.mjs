// Checks the interface translations (src/i18n/*.json) against the t(), tp() and N_() calls in src/js:
// every string used must have a French and Spanish translation with the same {placeholders},
// and every translation must still be used. Also checks the server's messages (server/messages.js).
// Exits with 1 when something is missing.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['fr', 'es'];
const STR = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\`(?:[^\`\\$]|\\.)*\``;
const unquote = (s) => JSON.parse('"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/\\`/g, '`').replace(/(?<!\\)"/g, '\\"') + '"');

const used = new Map(); // key -> first place it's used
const dir = join(root, 'src', 'js');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== '01-i18n.js')) {
  const src = readFileSync(join(dir, f), 'utf8');
  const add = (k, i) => { if (!used.has(k)) used.set(k, `${f}:${src.slice(0, i).split('\n').length}`); };
  for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])(?:t|N_)\(\s*(${STR})`, 'g'))) add(unquote(m[1]), m.index);
  for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])tp\(\s*[^,]+,\s*(${STR})\s*,\s*(${STR})`, 'g'))) add(`${unquote(m[1])}|${unquote(m[2])}`, m.index);
}

const table = {};
for (const f of readdirSync(join(root, 'src', 'i18n')).filter((f) => f.endsWith('.json'))) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(root, 'src', 'i18n', f), 'utf8')))) table[k] = { ...(table[k] || {}), ...v, _file: f };
}

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const problems = [];
for (const [k, where] of used) {
  const e = table[k];
  for (const l of LANGS) {
    if (!e || !e[l]) { problems.push(`missing ${l}: ${JSON.stringify(k)} (${where})`); continue; }
    if (vars(e[l]) !== vars(k)) problems.push(`placeholders differ in ${l}: ${JSON.stringify(k)} -> ${JSON.stringify(e[l])}`);
    if (k.includes('|') !== e[l].includes('|')) problems.push(`plural forms differ in ${l}: ${JSON.stringify(k)}`);
  }
}
// the server's own messages (server/messages.js): complete, with matching placeholders, and every tr()/T() key present
const { MESSAGES } = await import('../server/messages.js');
for (const [k, e] of Object.entries(MESSAGES)) for (const l of LANGS) {
  if (!e[l]) problems.push(`server message missing ${l}: ${JSON.stringify(k)}`);
  else if (vars(e[l]) !== vars(k)) problems.push(`server placeholders differ in ${l}: ${JSON.stringify(k)}`);
}
for (const f of readdirSync(join(root, 'server')).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(root, 'server', f), 'utf8');
  for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.])(?:T\(|tr\(\s*\w+,)\s*(${STR})`, 'g'))) {
    const k = unquote(m[1]);
    if (!MESSAGES[k]) problems.push(`server message not in server/messages.js: ${JSON.stringify(k)} (${f})`);
  }
}
const unused = Object.keys(table).filter((k) => !used.has(k));
for (const k of unused) problems.push(`unused (${table[k]._file}): ${JSON.stringify(k)}`);
console.log(`${used.size} strings in use, ${Object.keys(table).length} translated`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('All interface strings are translated.');
