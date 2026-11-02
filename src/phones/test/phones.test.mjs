import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKENS } from '../tokens.mjs';
import { decodeCtc, groupWords } from '../ctc.mjs';
import { alignPhones, compare, suggest, distance, pairKey } from '../align.mjs';
import { transcribe, analyseSequences, attachExternalWords, fingerprint } from '../engine.mjs';
import { fbank } from '../fbank.mjs';
import { planChunks } from '../quality.mjs';

const id = (s) => TOKENS.indexOf(s);
/** log-probs for a frame list; each entry a token string or null for blank, with given peak prob. */
function frames(list, V = TOKENS.length, p = 0.97) {
  const lp = new Float32Array(list.length * V).fill(Math.log((1 - p) / (V - 1)));
  list.forEach((s, t) => { lp[t * V + (s == null ? 0 : id(s))] = Math.log(p); });
  return lp;
}
const mk = (syms, conf = 0.95, word = 0) => syms.map((s, i) => ({ sym: s, t0: i * 0.1, t1: i * 0.1 + 0.04, conf, word }));

test('token table is the 127-entry ZIPA table', () => { assert.equal(TOKENS.length, 127); assert.equal(TOKENS[3], '▁'); assert.equal(TOKENS[123], 'θ'); });

test('ctc decode: collapses repeats, merges modifiers, finds words', () => {
  const l = ['▁', 'θ', 'θ', null, 'r', null, 'i', 'ː', null, '▁', 's', 'ə', '˞'];
  const d = decodeCtc(frames(l), l.length, TOKENS.length, TOKENS, 0.04, null);
  assert.deepEqual(d.phones.map((p) => p.sym), ['θ', 'r', 'iː', 's', 'ɚ'].map((s) => (s === 'ɚ' ? 'ə˞' : s)));
  const w = groupWords(d.phones);
  assert.equal(w.length, 2); assert.equal(d.phones[0].t0, 0.04);
});

test('ctc decode: phones on silent frames are dropped, not invented', () => {
  const l = ['a', null, 'b', null, 'k'];
  const mask = Uint8Array.from([1, 1, 0, 0, 1]);
  const d = decodeCtc(frames(l), l.length, TOKENS.length, TOKENS, 0.04, mask);
  assert.deepEqual(d.phones.map((p) => p.sym), ['a', 'k']);
  assert.equal(d.droppedOnSilence, 1);
});

test('distances: near sounds are near, unrelated are far', () => {
  assert.ok(distance('ɹ', 'ɻ') < 0.2);
  assert.ok(distance('θ', 's') < distance('θ', 'm'));
  assert.ok(distance('iː', 'i') < 0.2);
  assert.ok(distance('i', 'ɑ') > 0.5);
  assert.equal(distance('a', 'a'), 0);
});

test('align: th->s substitution, a dropped final sound, an added vowel', () => {
  const sp = mk(['θ', 'r', 'iː', 'w', 'ɪ', 'ð', 'k', 'ɑ', 'm']);
  const lp = mk(['s', 'r', 'iː', 'w', 'ɪ', 'ð', 'ə', 'k', 'ɑ']);
  const c = compare({ phones: sp }, { phones: lp });
  const pairs = c.diffs.map((d) => d.pair).sort();
  assert.deepEqual(pairs, ['m→∅', '∅→ə', 'θ→s'].sort());
  assert.equal(pairKey(null, 'ə'), '∅→ə');
});

test('align: identical strings give no differences and 100% agreement', () => {
  const a = mk(['h', 'ɛ', 'l', 'oʊ'.slice(0, 1), 'ʊ']);
  const c = compare({ phones: a }, { phones: mk(['h', 'ɛ', 'l', 'o', 'ʊ']) });
  assert.equal(c.diffs.length, 0); assert.equal(c.stats.agreement, 1);
});

test('weak flags: vowel reduction and low confidence are not suggested', () => {
  const sp = mk(['b', 'ə', 't', 'θ', 'r'], 0.95), lp = mk(['b', 'ɪ', 't', 's', 'r'], 0.95);
  lp[3].conf = 0.4;
  const c = compare({ phones: sp }, { phones: lp });
  assert.ok(c.diffs.every((d) => d.weak));
  assert.deepEqual(suggest(c), []);
});

test('suggest: at most 3, one per word, never padded', () => {
  const sp = mk(['θ', 'ð', 'ʃ', 's', 'f'], 0.95), lp = mk(['s', 'z', 's', 'θ', 'v'], 0.95);
  sp.forEach((p, i) => (p.word = i)); lp.forEach((p, i) => (p.word = i));
  const c = compare({ phones: sp }, { phones: lp });
  assert.ok(suggest(c).length <= 3 && suggest(c).length >= 1);
});

test('fbank: shapes and finite values; chunk plan cuts at quiet spots', () => {
  const x = new Float32Array(16000 * 45).map((_, i) => (i % 16000 < 8000 ? 0.3 * Math.sin(i * 0.1) : 0.0001));
  const f = fbank(x.subarray(0, 16000));
  assert.equal(f.frames, 100); assert.ok(f.data.every(Number.isFinite));
  const ch = planChunks(x);
  assert.ok(ch.length >= 3 && ch.every(([a, b]) => b - a <= 20 * 16000 + 1));
  assert.equal(ch.at(-1)[1], x.length);
});

test('engine: fake model end to end, with external words attached by time overlap', async () => {
  const sym = ['▁', 'θ', null, 'r', 'iː'.slice(0, 1), null, 'ː', null, null, '▁', 'k', 'æ', 't', null];
  const T = 13 * 25; // 13 chunks worth of frames is irrelevant; make it match the audio below
  const audio = new Float32Array(16000 * 1).map((_, i) => (i > 800 && i < 11000 ? 0.3 : 0.001) * Math.sin(i * 0.2) * (1 + 0.5 * Math.sin(i * 0.003)));
  const runModel = async (feats, nFrames) => { const To = Math.floor(nFrames / 4); const list = new Array(To).fill(null); sym.forEach((s, k) => { list[k + 2] = s; }); return { logProbs: frames(list), T: To, V: TOKENS.length }; };
  const seq = await transcribe(audio, { runModel });
  assert.deepEqual(seq.phones.map((p) => p.sym), ['θ', 'r', 'iː', 'k', 'æ', 't']);
  assert.equal(seq.words.length, 2);
  assert.ok(Math.abs(seq.frameSec - 0.04) < 0.003);
  const ext = { source: 'asr', words: [{ text: 'three', t0: 0, t1: 0.4 }, { text: 'cat', t0: 0.4, t1: 0.9 }] };
  const withExt = attachExternalWords(seq, ext);
  assert.equal(withExt.phones[0].extWord, 0); assert.equal(withExt.phones.at(-1).extWord, 1);
  assert.equal(seq.phones[0].extWord, undefined);
  const r = analyseSequences(seq, seq, 'k');
  assert.equal(r.comparison.diffs.length, 0);
});

test('fingerprint differs for different audio, same for same', () => {
  const a = new Float32Array(5000).map((_, i) => Math.sin(i)), b = a.slice(); b[100] += 0.5;
  assert.equal(fingerprint(a), fingerprint(a.slice()));
  assert.notEqual(fingerprint(a), fingerprint(new Float32Array(5000).map((_, i) => Math.cos(i))));
});
