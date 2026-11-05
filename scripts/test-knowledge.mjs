// Tests the research notes matcher (src/js/86-knowledge.js) against src/knowledge/entries.json: node scripts/test-knowledge.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const KNOWLEDGE = JSON.parse(readFileSync(new URL('../src/knowledge/entries.json', import.meta.url), 'utf8'));
const ctx = { KNOWLEDGE, String, Set, Array };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../src/js/86-knowledge.js', import.meta.url), 'utf8') + '\nthis.Know = Know;', ctx);
const ids = (...q) => Array.from(ctx.Know.pick(q), (e) => e.id);

// every entry has what the prompt needs
for (const e of KNOWLEDGE) {
  for (const k of ['id', 'question', 'evidence', 'answer', 'keywords']) assert.ok(e[k], `${e.id || '?'} lacks ${k}`);
  assert.ok(e.sources.length, `${e.id} has no sources`);
  assert.ok(e.sources.every((s) => s.cite && s.read), `${e.id}: a source lacks cite or read level`);
  assert.ok(ctx.Know.render(e).length < 4001);
}
assert.equal(new Set(KNOWLEDGE.map((e) => e.id)).size, KNOWLEDGE.length);

const cases = [
  ['Does sleep help me learn?', 'B8-sleep'],
  ['How far behind the speaker should I be?', 'D2-lag'],
  ['Should I slow the audio down?', 'C9-speed'],
  ['How many times should I repeat the same clip?', 'B3-repetitions'],
  ['Is it true shadowing works because of mirror neurons?', 'G6-mirror-neurons'],
  ["I'm embarrassed and nervous, does anxiety matter?", 'F3-anxiety'],
  ['I stopped improving, is that a plateau?', 'F2-plateaus'],
  ['Should I read the transcript or subtitles first?', 'D1-transcripts'],
  ['How often should I practise and for how many minutes?', 'B1-frequency'],
  ['Does shadowing improve pronunciation and accent?', 'A2-pronunciation'],
  ['Does shadowing improve listening comprehension?', 'A3-listening'],
  ['Which French sounds are hardest?', 'J2-french-sounds'],
  ['Les voyelles nasales et la liaison en français', 'J2b-french-nasals-liaison'],
  ['¿Cuántas repeticiones debo hacer?', 'B3-repetitions'],
  ['¿Qué acento español debo copiar, el de Argentina o el de México?', 'J6-regional-varieties'],
  ['Pourquoi je stagne, je ne progresse plus', 'F2-plateaus'],
];
for (const [q, want] of cases) assert.ok(ids(q).includes(want), `"${q}" should find ${want}, found ${ids(q)}`);

// small talk and unrelated questions bring nothing
for (const q of ['hi', 'thanks!', 'test', 'What is the weather today?', 'Can you write a poem about cats?']) assert.deepEqual(ids(q), [], q);
// a short follow-up borrows the question before it
assert.ok(ids('How many times should I repeat the same clip?', 'and for French?').includes('B3-repetitions'));
assert.ok(ctx.Know.pick(['Does sleep help me learn?']).length <= 3);
console.log('knowledge ok:', KNOWLEDGE.length, 'entries');
