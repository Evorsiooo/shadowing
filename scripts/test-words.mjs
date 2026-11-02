// Tests the main-thread side of the word labels (src/js/26-words.js) and how words reach the Pronunciation tab
// (src/js/54-pron-source.js) with fake browser pieces: node scripts/test-words.mjs. The Whisper model itself is NOT run here
// (src/words/test covers the engine with a fake pipeline); see the PR for what is and isn't verified.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // objects from the vm have another Array
const read = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const store = new Map();
const clips = new Map();
let workerCalls = [];
let workerImpl = async (type) => (type === 'load' ? true : { words: [{ w: 'hello', s: 0.1, e: 0.5 }], timing: 'word', model: 'whisper-base.en-q8' });
function FakeWorker() {
  this.postMessage = ({ id, type, payload }) => {
    workerCalls.push(type);
    Promise.resolve().then(() => workerImpl(type, payload)).then(
      (result) => this.onmessage({ data: { id, ok: true, result } }),
      (err) => this.onmessage({ data: { id, ok: false, error: String(err.message) } }));
  };
  this.terminate = () => {};
}
const cacheStore = { keys: async () => [{}], delete: async () => true };
const ctx = {
  console, setTimeout, clearTimeout, AbortController, Promise, Date, URL, performance, Float32Array,
  location: { href: 'https://x.test/app/', search: '' },
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
  navigator: { deviceMemory: 8, hardwareConcurrency: 8, userAgent: 'Desktop' },
  Worker: FakeWorker, WebAssembly: {}, caches: { open: async () => cacheStore, delete: async () => true },
  addEventListener() {},
  t: (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)),
  lsGet: (k, d) => { try { const v = store.get('shadowing:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  lsSet: (k, v) => store.set('shadowing:' + k, JSON.stringify(v)),
  N_: (s) => s,
  Store: { get: (_, id) => clips.get(id), patch: (_, id, p) => { const c = { ...clips.get(id), ...p }; clips.set(id, c); return c; } },
  VideoAudio: { slice: () => new Float32Array(16000 * 2) },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('21-heavy.js') + '\n' + read('26-words.js').replaceAll('__WORDS_WORKER_URL__', '/w.js').replaceAll('__WORDS_WASM_BASE__', '/w/') + '\nthis.Heavy = Heavy; this.Words = Words; this.HeavyError = HeavyError;', ctx);
const { Heavy, Words } = ctx;
const clip = () => ({ id: 'c1', videoId: 'v', start: 10, end: 12 });
let n = 0;
const test = async (name, fn) => { store.clear(); clips.clear(); workerCalls = []; workerImpl = async (type) => (type === 'load' ? true : { words: [{ w: 'hello', s: 0.1, e: 0.5 }], timing: 'word', model: 'whisper-base.en-q8' }); await fn(); n++; console.log('ok  ' + name); };

await test('registered as its own feature, off by default, 80 MB consent', async () => {
  assert.ok(Heavy.list().includes('words'));
  assert.equal(Heavy.isOn('words'), false);
  assert.equal(Heavy.spec('words').sizeMB, 80);
  assert.equal(await Words.ensure(clip()), null, 'nothing is downloaded or run while off');
  eq(workerCalls, []);
});
await test('on: loads, transcribes once, stores words + wordsFor on the clip, never twice', async () => {
  clips.set('c1', clip());
  assert.equal(Heavy.enable('words'), true);
  const [a, b] = await Promise.all([Words.ensure(clip()), Words.ensure(clip())]);
  eq(a, [{ w: 'hello', s: 0.1, e: 0.5 }]); assert.equal(a, b);
  eq(workerCalls, ['load', 'transcribe'], 'concurrent calls share one run');
  const c = clips.get('c1');
  assert.equal(c.words.length, 1); assert.equal(c.wordsFor.start, 10); assert.equal(c.wordsFor.end, 12); assert.equal(c.wordsFor.timing, 'word');
  assert.equal(Words.status().state, 'ready'); assert.equal(store.get('shadowing:wordsModel'), '"whisper-base.en-q8"');
  workerCalls = [];
  eq(await Words.ensure(c), c.words); eq(workerCalls, [], 'a clip that has words is not read again');
});
await test('empty result is stored (so the tab does not retry forever)', async () => {
  clips.set('c1', clip()); Heavy.enable('words');
  workerImpl = async (type) => (type === 'load' ? true : { words: [], timing: 'word', model: 'm' });
  eq(await Words.ensure(clip()), []);
  assert.ok(clips.get('c1').wordsFor);
  workerCalls = []; await Words.ensure(clips.get('c1')); eq(workerCalls, []);
});
await test('a clip moved while the words were being read does not get stale words', async () => {
  clips.set('c1', clip()); Heavy.enable('words');
  workerImpl = async (type) => { if (type === 'transcribe') clips.set('c1', { ...clip(), start: 11 }); return type === 'load' ? true : { words: [{ w: 'x', s: 0, e: 1 }], timing: 'word', model: 'm' }; };
  assert.equal(await Words.ensure(clip()), null);
  assert.equal(clips.get('c1').words, undefined);
});
await test('failures are reported, counted by the guard, and switch the feature off after two', async () => {
  clips.set('c1', clip()); Heavy.enable('words');
  workerImpl = async () => { throw new Error('boom'); };
  await assert.rejects(Words.ensure(clip()), { code: 'failed' });
  assert.equal(Words.status().state, 'error');
  assert.equal(Heavy.isOn('words'), true);
  await assert.rejects(Words.ensure(clip()));
  assert.equal(Heavy.isOn('words'), false); assert.equal(Heavy.state('words').off, 'failures');
});
await test('out of memory switches it off at once', async () => {
  clips.set('c1', clip()); Heavy.enable('words');
  workerImpl = async () => { throw new Error('std::bad_alloc: out of memory'); };
  await assert.rejects(Words.ensure(clip()), { code: 'out-of-memory' });
  assert.equal(Heavy.state('words').off, 'memory');
});
await test('edit keeps times, trims, drops empty words', async () => {
  clips.set('c1', clip());
  const out = Words.edit('c1', [{ w: ' Hello ', s: 0, e: 1, x: 1 }, { w: '  ', s: 1, e: 2 }, { w: 'there', s: 2, e: 3 }]);
  eq(out, [{ w: 'Hello', s: 0, e: 1, x: 1 }, { w: 'there', s: 2, e: 3 }]);
  eq(clips.get('c1').words, out);
});
await test('Delete downloaded data removes the cache, the flag and the consent', async () => {
  Heavy.enable('words'); store.set('shadowing:wordsModel', '"whisper-base.en-q8"');
  await Heavy.removeData('words');
  assert.equal(Heavy.isOn('words'), false); assert.equal(store.get('shadowing:wordsModel'), '""'); assert.equal(Words.status().state, 'not-downloaded');
});

// ---- words reaching the Pronunciation tab ----
const ctx2 = { console, location: { search: '' }, Phones: undefined };
vm.createContext(ctx2);
vm.runInContext(read('54-pron-source.js') + '\nthis.pronWords = pronWords;', ctx2);
await test('pronWords: text and its clip.words index come from the overlapping word; unlabelled sounds stay null', async () => {
  const S = { phones: [{ sym: 'h', extWord: 0 }, { sym: 'i', extWord: 0 }, { sym: 'x' }], words: [{ first: 0, last: 1, t0: 0, t1: 0.4 }, { first: 2, last: 2, t0: 0.5, t1: 0.6 }] };
  const out = ctx2.pronWords(S, [], { source: 'asr', words: [{ text: 'hi', t0: 0, t1: 0.4 }] });
  assert.equal(out[0].text, 'hi'); assert.equal(out[0].ext, 0); assert.equal(out[1].text, null); assert.equal(out[1].ext, null);
});
console.log(`${n} passed`);
