// Tests that a take analysed afterwards is filed under the day it was recorded (Pron.record with `day`, src/js/24-pron.js): node scripts/test-pron-late.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const docs = {};
const ctx = {
  console, Date, Math, Map, Set, t: (s) => s, tp: (n, a) => a,
  Store: { get: (c, id) => (c === 'meta' ? docs[id] : null), put: (c, o) => { if (c === 'meta') docs[o.id] = o; else o.id = 'n1'; return o; }, patch() {}, schedule() {}, data: { notes: {} } },
  settings: () => ({}), targetLang: () => 'en', Session: { active: false }, linkIssue() {}, Heavy: { register() {} }, N_: (s) => s,
};
vm.createContext(ctx);
vm.runInContext(read('00-util.js') + '\n' + read('24-pron.js') + '\nthis.Pron = Pron;', ctx);
const { Pron } = ctx;
const ph = (n) => ({ v: 1, diffs: Array.from({ length: n }, (_, i) => ({ a: i, b: i + 0.3, words: 'w' + i, speaker: ['θ'], you: ['s'], from: 'θ', to: 's', conf: 0.7 })), sounds: { 'θ': 4 } });
const now = ctx.dayKey(), ago = (n) => ctx.addDays(now, -n);
let k = 0;
const rec = (n, day) => Pron.record(ph(n), { clip: { id: 'c1' }, token: 'tok' + k++, recId: 'r' + k, sessionId: 's', pass: 1, step: 'again', day });
rec(1, now);
rec(1, ago(5)); rec(1, ago(3)); rec(1, ago(3));
const e = Pron.doc().tally['θ→s'];
assert.deepEqual(JSON.parse(JSON.stringify(e.days)), [ago(5), ago(3), now].sort());
assert.equal(e.last, now); assert.equal(e.first, ago(5)); assert.equal(e.f, 4);
assert.deepEqual(JSON.parse(JSON.stringify(e.bk.map((b) => b.d))), [ago(5), ago(3), now].sort());
assert.equal(e.bk.find((b) => b.d === ago(3)).o, 8); // two takes that day, 4 chances each
assert.equal(e.recId, 'r1', 'an older take does not replace the newest example');
console.log('ok  an older take is filed under its own day, in order');
