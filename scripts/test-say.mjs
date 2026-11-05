// Tests the pure parts of "Say something" in Ask Euno (src/js/87-ask-say.js): turning a take's sounds into words, and finding library
// clips that contain what was said. The model itself is not run here: node scripts/test-say.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const read = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const clips = [
  { id: 'c1', videoId: 'v1', words: [{ w: 'I', s: 0, e: 0.2 }, { w: 'think', s: 0.2, e: 0.6 }, { w: 'so,', s: 0.6, e: 0.9 }, { w: 'though.', s: 0.9, e: 1.3 }] },
  { id: 'c2', videoId: 'v1', words: [] },
  { id: 'c3', videoId: 'v1', archived: true, words: [{ w: 'think', s: 0, e: 1 }] },
  { id: 'c4', videoId: 'gone', words: [{ w: 'think', s: 0, e: 1 }] },
];
const ctx = {
  console, URLSearchParams, Map, Set, Proxy, Float32Array, Date, performance,
  location: { search: '' }, N_: (s) => s, t: (s) => s, Phones: { attachExternalWords: (seq, ext) => ({ ...seq, external: ext }) },
  Store: { all: () => clips, get: (k, id) => (k === 'videos' ? (id === 'v1' ? { id } : null) : null) },
};
vm.createContext(ctx);
vm.runInContext(read('54-pron-source.js') + '\n' + read('87-ask-say.js') + '\nthis.__say = { sayNorm, sayTokens, sayFindClips, sayUnits };', ctx);
const { sayNorm, sayTokens, sayFindClips, sayUnits } = ctx.__say;

eq(sayNorm('Don’t,'), "don't");
eq(sayTokens('  Think  so! '), ['think', 'so']);

// finding clips: a run of words anywhere in a clip; archived clips, clips of removed videos and clips without words are skipped
let f = { text: 'think so', hits: null, unlabelled: 0 };
sayFindClips(f);
eq(f.hits.map((h) => [h.clipId, h.a, h.b, h.said, h.before, h.after]), [['c1', 0.2, 0.9, 'think so,', 'I', 'though.']]);
assert.equal(f.unlabelled, 1);
f = { text: 'so think', hits: null, unlabelled: 0 }; sayFindClips(f); eq(f.hits, []);
f = { text: '', hits: null, unlabelled: 0 }; sayFindClips(f); eq(f.hits, []);

// sounds -> words: a phone the model was unsure of is marked, with and without word labels
const ph = (sym, conf, word, extWord) => ({ sym, t0: 0, t1: 0.1, conf, word, extWord });
const seq = { phones: [ph('θ', 0.9, 0, 0), ph('ɪ', 0.3, 0, 0), ph('ŋ', 0.9, 0, 0), ph('k', 0.9, 1, 1)], words: [{ first: 0, last: 2, t0: 0, t1: 0.3 }, { first: 3, last: 3, t0: 0.3, t1: 0.4 }], quality: { level: 'good' } };
const plain = sayUnits(seq, null);
eq(plain.map((u) => [u.t, u.p.map((x) => x.s).join('')]), [[null, 'θɪŋ'], [null, 'k']]);
eq(plain[0].p.map((x) => x.lo), [false, true, false]);
const ext = { source: 'asr', words: [{ text: 'thing', t0: 0, t1: 0.3 }, { text: 'k', t0: 0.3, t1: 0.4 }] };
const labelled = sayUnits(seq, ext);
eq(labelled.map((u) => u.t), ['thing', 'k']);
console.log('say tests passed');
