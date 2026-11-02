import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseWords, spreadPhrases, createWordsEngine, MODEL } from '../engine.mjs';

const r = (x) => Math.round(x * 100) / 100;
test('words are trimmed, punctuation stripped, apostrophes kept, non-speech dropped', () => {
  const out = normaliseWords([
    { text: ' [BLANK_AUDIO]', timestamp: [0, 1] }, { text: ' Hello,', timestamp: [0.2, 0.6] }, { text: " don't", timestamp: [0.6, 0.9] },
    { text: ' (music)', timestamp: [1, 2] }, { text: ' ...', timestamp: [2, 2.1] }, { text: ' world.', timestamp: [2.2, 2.7] },
  ], 3);
  assert.deepEqual(out.map((x) => x.w), ['Hello', "don't", 'world']);
});
test('times are clamped, ordered, rounded and a swallowed pause is capped', () => {
  const out = normaliseWords([
    { text: 'one', timestamp: [0.123, 5.0] }, { text: 'two', timestamp: [0.05, 0.4] }, { text: 'three', timestamp: [9, 9.5] }, { text: 'four', timestamp: [1.0, null] },
  ], 4);
  assert.equal(out[0].s, 0.12);
  assert.ok(out[0].e <= 0.62, 'one is capped at 0.5 s'); // max(0.5, .13*3)
  assert.ok(out[1].s >= out[0].s, 'never starts before the previous word');
  assert.ok(out.every((x) => x.e > x.s && x.e <= 4));
  assert.equal(out.length, 3, 'a word that starts after the clip ends is dropped');
  assert.equal(r(out[2].e - out[2].s), 0.3, 'a missing end becomes start + 0.3 s');
});
test('empty or odd input gives an empty list', () => {
  assert.deepEqual(normaliseWords(undefined, 2), []);
  assert.deepEqual(normaliseWords([{ text: '', timestamp: [0, 1] }, null], 2), []);
});
test('phrase fallback spreads words by letter count', () => {
  const out = spreadPhrases([{ text: 'aa bbbb', timestamp: [0, 3] }], 3);
  assert.equal(out.length, 2);
  assert.equal(out[0].s, 0); assert.equal(out[0].e, 1); assert.equal(out[1].s, 1); assert.equal(out[1].e, 3);
});
test('engine: needs load, returns word timing, falls back to phrases when the model has no alignment heads', async () => {
  const calls = [];
  const fake = async (samples, o) => {
    calls.push(o.return_timestamps);
    if (o.return_timestamps === 'word' && fake.noHeads) throw new Error('Model generation config has no `alignment_heads`, token-level timestamps not available.');
    return { chunks: o.return_timestamps === 'word' ? [{ text: ' Hi', timestamp: [0.1, 0.4] }, { text: ' there', timestamp: [0.5, 1.0] }] : [{ text: ' Hi there', timestamp: [0.1, 1.0] }] };
  };
  const eng = createWordsEngine({ loadPipeline: async (cb) => { cb({ loaded: 1, total: 2 }); return fake; } });
  const one = new Float32Array(16000);
  await assert.rejects(eng.transcribe(one), /not loaded/);
  let seen; await eng.load((p) => { seen = p; }); assert.deepEqual(seen, { loaded: 1, total: 2 });
  const a = await eng.transcribe(one);
  assert.equal(a.timing, 'word'); assert.equal(a.model, MODEL.id); assert.deepEqual(a.words.map((x) => x.w), ['Hi', 'there']);
  fake.noHeads = true;
  const b = await eng.transcribe(one);
  assert.equal(b.timing, 'phrase'); assert.deepEqual(b.words.map((x) => x.w), ['Hi', 'there']);
  assert.deepEqual((await eng.transcribe(new Float32Array(100))).words, [], 'clips under 0.3 s have no words');
  fake.other = true; const bad = createWordsEngine({ loadPipeline: async () => async () => { throw new Error('out of memory'); } }); await bad.load(() => {});
  await assert.rejects(bad.transcribe(one), /out of memory/);
});
test('a failed load can be retried', async () => {
  let n = 0;
  const eng = createWordsEngine({ loadPipeline: async () => { if (++n === 1) throw new Error('network'); return async () => ({ chunks: [] }); } });
  await assert.rejects(eng.load(() => {}), /network/);
  await eng.load(() => {}); assert.equal(eng.loaded, true);
});
