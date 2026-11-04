// Tests clip preparation (src/js/27-prepare.js) with stand-ins for the engines: node scripts/test-prepare.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const store = new Map();
const clips = { c1: { id: 'c1', videoId: 'v1', start: 1, end: 5 } };
const calls = { transcribe: 0, words: 0, load: 0 };
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Promise, Date, performance,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
  navigator: { deviceMemory: 8, hardwareConcurrency: 8, userAgent: 'Desktop' }, Worker: function () {}, WebAssembly: {},
  addEventListener() {}, t: (s) => s,
  lsGet: (k, d) => { const v = store.get('s:' + k); return v == null ? d : JSON.parse(v); }, lsSet: (k, v) => store.set('s:' + k, JSON.stringify(v)),
  targetLang: () => 'en',
  Store: { get: (c, id) => ({ clips }[c] || {})[id], patch: (c, id, f) => Object.assign(clips[id], f) },
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
console.log(`${n} passed`);
