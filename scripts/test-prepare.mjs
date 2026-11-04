// Tests clip preparation (src/js/27-prepare.js) with stand-ins for the engines: node scripts/test-prepare.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const store = new Map();
const recordings = { r1: { id: 'r1' } };
const clips = { c1: { id: 'c1', videoId: 'v1', start: 1, end: 5 } };
const calls = { transcribe: 0, words: 0, load: 0 };
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Promise, Date, performance,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
  navigator: { deviceMemory: 8, hardwareConcurrency: 8, userAgent: 'Desktop' }, Worker: function () {}, WebAssembly: {},
  addEventListener() {}, t: (s) => s,
  lsGet: (k, d) => { const v = store.get('s:' + k); return v == null ? d : JSON.parse(v); }, lsSet: (k, v) => store.set('s:' + k, JSON.stringify(v)),
  targetLang: () => 'en',
  Store: { get: (c, id) => ({ clips, recordings }[c] || {})[id], patch: (c, id, f) => Object.assign(({ clips, recordings }[c])[id], f) },
  VideoAudio: { slice: () => new Float32Array(16000 * 4), ensure: async () => ({ status: 'ready' }) },
  Pron: { on: () => true, reason: (e) => String(e && e.message) },
  PhonesAdapter: { ready: () => true },
  Phones: {
    MODEL_ID: 'm1', fingerprint: () => 'fp1',
    load: async () => { calls.load++; },
    transcribe: async (s, o) => { calls.transcribe++; o.onProgress && o.onProgress(2, 4); o.onProgress && o.onProgress(4, 4); return { frameSec: 0.04012345, durationSec: 4, phones: [{ sym: 'a', t0: 0.123456, t1: 0.2, conf: 0.87654 }], words: [{ first: 0, last: 0, t0: 0.123456, t1: 0.2 }] }; },
  },
  Words: { supported: () => ({ ok: true }), onStatus: () => () => {}, ensure: async (c) => { calls.words++; Object.assign(clips[c.id], { words: [{ w: 'hi', s: 0, e: 1 }], wordsFor: { start: c.start, end: c.end } }); } },
  PronTab: { wordsFailed: new Set() },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('21-heavy.js') + '\n' + read('27-prepare.js') + '\nthis.Heavy = Heavy; this.Prep = Prep;', ctx);
const { Heavy, Prep } = ctx;
Heavy.register('pronunciation', { name: 'P', sizeMB: 71, minMemGB: 4, minCores: 4 });
Heavy.register('words', { name: 'W', sizeMB: 80, minMemGB: 4, minCores: 4 });
Heavy.enable('pronunciation'); Heavy.enable('words');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

await test('the speaker\'s sounds and words are worked out once and saved on the clip', async () => {
  const seen = [];
  await Prep.ensure(clips.c1, { onProgress: (p) => seen.push(`${p.stage}:${p.step}/${p.steps}`) });
  assert.equal(calls.transcribe, 1); assert.equal(calls.words, 1);
  const sp = clips.c1.speakerPhones;
  assert.equal(sp.model, 'm1'); assert.equal(sp.fp, 'fp1'); assert.equal(sp.start, 1); assert.equal(sp.seq.phones[0].t0, 0.123); assert.equal(sp.seq.phones[0].conf, 0.88);
  assert.ok(seen.includes('speaker:1/2') && seen.includes('words:2/2'));
  await Prep.ensure(clips.c1); // nothing left to do
  assert.equal(calls.transcribe, 1); assert.equal(calls.words, 1);
  assert.equal(Prep.speakerSeq(clips.c1).fp, 'fp1');
});
await test('a changed range or another model does not reuse the saved sounds', async () => {
  assert.equal(Prep.speakerSeq({ ...clips.c1, end: 6 }), null);
  assert.equal(Prep.speakerSeq({ ...clips.c1, speakerPhones: { ...clips.c1.speakerPhones, model: 'other' } }), null);
});
await test('around: one progress across the prepare steps and the take', async () => {
  delete clips.c1.speakerPhones; delete clips.c1.wordsFor; delete clips.c1.words;
  const seen = [];
  await Prep.around(clips.c1, 2, (p) => seen.push(p), async (onP) => { onP({ stage: 'take', step: 1, steps: 2, fraction: 0.5 }); onP({ stage: 'compare', step: 2, steps: 2, fraction: 1 }); });
  const last = seen[seen.length - 1];
  assert.equal(last.steps, 4); assert.equal(last.step, 4); assert.equal(last.fraction, 1);
  assert.ok(seen.every((p, i) => i === 0 || p.fraction >= seen[i - 1].fraction));
});
await test('features that are off are skipped', async () => {
  delete clips.c1.speakerPhones; delete clips.c1.wordsFor; delete clips.c1.words;
  Heavy.disable('words'); calls.transcribe = 0; calls.words = 0;
  await Prep.ensure(clips.c1);
  assert.equal(calls.words, 0); assert.equal(calls.transcribe, 1);
});
await test('background work waits for playback; an urgent request for the same clip does not', async () => {
  delete clips.c1.speakerPhones; calls.transcribe = 0;
  let playing = true; Heavy.idleBlockers.push(() => playing);
  const bg = Prep.ensure(clips.c1, { background: true });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(calls.transcribe, 0); // yielding to playback
  await Prep.ensure(clips.c1); // urgent: same run, no longer yields
  assert.equal(calls.transcribe, 1); await bg;
  playing = false;
});
await test('a take\'s comparison is saved on its recording and reused only while it fits', async () => {
  const ph = (sym, t0) => ({ sym, t0, t1: t0 + 0.1234, conf: 0.9, word: 0 });
  const res = { learner: { model: 'm1', phones: [ph('s', 0.12345)], words: [], frameSec: 0.04, durationSec: 4, timingsMs: {}, external: {} }, comparison: { diffs: [{ id: 'sub:0:0', kind: 'sub', pair: 'θ→s', speaker: { i: 0, sym: 'θ', t0: 0.1, t1: 0.2, conf: 0.912 }, learner: { i: 0, sym: 's', t0: 0.1, t1: 0.2, conf: 0.9 }, t0: 0.1, t1: 0.2, learnerT0: 0.1, learnerT1: 0.2, distance: 0.456, confidence: 0.8765, weak: false }], ops: [{ op: 'sub' }], stats: { subs: 1 } }, status: 'ok', suggested: ['sub:0:0'] };
  Prep.saveTake('r1', clips.c1, res, 'fp1');
  const a = recordings.r1.takeAnalysis;
  assert.equal(a.learner.phones[0].t0, 0.123); assert.equal(a.learner.timingsMs, undefined); assert.equal(a.diffs[0].confidence, 0.88); assert.equal(a.speakerFp, 'fp1');
  const given = { fp: 'fp1', seq: { phones: [] } };
  assert.equal(Prep.savedTake('r1', clips.c1, given).suggested[0], 'sub:0:0');
  assert.equal(Prep.savedTake('r1', clips.c1, { ...given, fp: 'other' }), null);
  assert.equal(Prep.savedTake('r1', { ...clips.c1, end: 9 }, given), null);
  assert.equal(Prep.savedTake('nope', clips.c1, given), null);
});
console.log(`${n} passed`);
