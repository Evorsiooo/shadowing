// Tests the safety layer (src/js/21-heavy.js) with fake browser pieces: node scripts/test-heavy.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const store = new Map();
const events = {};
const make = (nav = {}) => {
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Promise, Date,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, userAgent: 'Desktop', ...nav },
    performance: { memory: null },
    Worker: function () {}, WebAssembly: {},
    addEventListener: (n, f) => { events[n] = f; },
    t: (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)),
    lsGet: (k, d) => { try { const v = store.get('shadowing:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    lsSet: (k, v) => store.set('shadowing:' + k, JSON.stringify(v)),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../src/js/21-heavy.js', import.meta.url), 'utf8') + '\nthis.Heavy = Heavy; this.HeavyError = HeavyError;', ctx);
  return ctx;
};
const def = { name: 'X', sizeMB: 71, minMemGB: 4, minCores: 4 };
let n = 0;
const test = async (name, fn) => { store.clear(); await fn(); n++; console.log('ok  ' + name); };

await test('off by default, on after enable', async () => {
  const { Heavy } = make(); Heavy.register('p', def);
  assert.equal(Heavy.isOn('p'), false);
  await assert.rejects(Heavy.run('p', async () => 1), { code: 'off' });
  assert.equal(Heavy.enable('p'), true);
  assert.equal(await Heavy.run('p', async () => 7), 7);
});
await test('weak device is refused; unknown memory only warns', async () => {
  let w = make({ deviceMemory: 2 }); w.Heavy.register('p', def);
  assert.equal(w.Heavy.check('p').level, 'no'); assert.equal(w.Heavy.enable('p'), false);
  w = make({ deviceMemory: undefined, hardwareConcurrency: 2, userAgent: 'iPhone Mobile' }); w.Heavy.register('p', def);
  const c = w.Heavy.check('p'); assert.equal(c.level, 'warn'); assert.equal(c.reasons.length, 3); assert.equal(w.Heavy.enable('p'), true);
});
await test('missing Worker or WebAssembly is refused', async () => {
  const w = make(); w.Worker = undefined; vm.runInContext('Worker = undefined', w); w.Heavy.register('p', def);
  assert.equal(w.Heavy.check('p').level, 'no');
});
await test('crash loop: a flag left behind turns the feature off', async () => {
  let w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  const hang = w.Heavy.run('p', () => new Promise(() => {}), { timeoutMs: 60000 }); hang.catch(() => {});
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(w.Heavy.state('p').pending, 'flag set before work');
  w = make(); w.Heavy.register('p', def); // "the browser restarted"
  assert.equal(w.Heavy.isOn('p'), false); assert.equal(w.Heavy.state('p').off, 'crash');
  assert.equal(w.Heavy.state('p').noticed, false);
});
await test('a normal close clears the flag (no false crash)', async () => {
  const w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  w.Heavy.run('p', () => new Promise(() => {}), { timeoutMs: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 20)); events.pagehide();
  const w2 = make(); w2.Heavy.register('p', def); assert.equal(w2.Heavy.isOn('p'), true);
});
await test('timeout aborts the job and counts as a failure; off after two', async () => {
  const w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  let aborted = false;
  const slow = () => w.Heavy.run('p', ({ signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => { aborted = true; })), { timeoutMs: 30 });
  await assert.rejects(slow(), { code: 'timeout' }); assert.ok(aborted);
  assert.equal(w.Heavy.isOn('p'), true);
  await assert.rejects(slow(), { code: 'timeout' });
  assert.equal(w.Heavy.isOn('p'), false); assert.equal(w.Heavy.state('p').off, 'slow');
});
await test('success resets the failure count; cancel is not a failure', async () => {
  const w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  await assert.rejects(w.Heavy.run('p', async () => { throw new Error('boom'); }), { code: 'failed' });
  await w.Heavy.run('p', async () => 1);
  await assert.rejects(w.Heavy.run('p', async () => { throw new Error('boom'); }));
  assert.equal(w.Heavy.isOn('p'), true);
  const ctl = new AbortController(); const r = w.Heavy.run('p', () => new Promise(() => {}), { signal: ctl.signal }); ctl.abort();
  await assert.rejects(r, { code: 'cancelled' });
  assert.equal(w.Heavy.isOn('p'), true);
});
await test('out of memory turns it off at once', async () => {
  const w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  await assert.rejects(w.Heavy.run('p', async () => { throw new RangeError('Array buffer allocation failed'); }), { code: 'out-of-memory' });
  assert.equal(w.Heavy.state('p').off, 'memory');
});
await test('one job at a time; low heap refuses without blame; recording defers', async () => {
  const w = make(); w.Heavy.register('p', def); w.Heavy.enable('p');
  const order = [];
  const a = w.Heavy.run('p', async () => { order.push('a1'); await new Promise((r) => setTimeout(r, 30)); order.push('a2'); });
  const b = w.Heavy.run('p', async () => { order.push('b'); });
  await Promise.all([a, b]); assert.deepEqual(order, ['a1', 'a2', 'b']);
  w.performance.memory = { jsHeapSizeLimit: 100, usedJSHeapSize: 90 };
  await assert.rejects(w.Heavy.run('p', async () => 1), { code: 'low-memory' }); assert.equal(w.Heavy.isOn('p'), true);
  w.performance.memory = null;
  let rec = true; w.Heavy.blockers.push(() => rec); let ran = false;
  const c = w.Heavy.run('p', async () => { ran = true; }); await new Promise((r) => setTimeout(r, 100)); assert.equal(ran, false);
  rec = false; await c; assert.equal(ran, true);
});
await test('consent is tied to the download size; delete data resets everything', async () => {
  let removed = false;
  const w = make(); w.Heavy.register('p', { ...def, remove: async () => { removed = true; } }); w.Heavy.enable('p');
  const w2 = make(); w2.Heavy.register('p', { ...def, sizeMB: 300 }); assert.equal(w2.Heavy.isOn('p'), false, 'bigger model needs fresh consent');
  await w.Heavy.removeData('p'); assert.ok(removed); assert.equal(w.Heavy.isOn('p'), false); assert.equal(w.Heavy.state('p').consentMB, 0);
});
await test('turning it on starts the download at once; turning it off (cancel) stops it', async () => {
  const w = make(); let started = 0, signal = null;
  w.Heavy.register('p', { ...def, prefetch: ({ signal: s }) => { started++; signal = s; return new Promise((_, rej) => s.addEventListener('abort', () => rej(new Error('aborted')))); } });
  assert.equal(w.Heavy.enable('p'), true);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(started, 1); assert.equal(w.Heavy.downloading('p'), true);
  assert.equal(w.Heavy.enable('p'), true); assert.equal(started, 1, 'a second call joins the running download');
  w.Heavy.disable('p'); await new Promise((r) => setTimeout(r, 5));
  assert.equal(signal.aborted, true); assert.equal(w.Heavy.downloading('p'), false);
  assert.equal(w.Heavy.downloadError('p'), null, 'a stop by the learner is not an error');
  assert.equal(w.Heavy.isOn('p'), false);
});
await test('a failed download is reported, not swallowed; features without a download are unaffected', async () => {
  const w = make(); w.Heavy.register('p', { ...def, prefetch: async () => { throw new Error('HTTP 503'); } }); w.Heavy.register('q', { ...def, sizeMB: 0 });
  w.Heavy.enable('p'); w.Heavy.enable('q'); await new Promise((r) => setTimeout(r, 5));
  assert.equal(w.Heavy.downloadError('p'), 'HTTP 503'); assert.equal(w.Heavy.isOn('p'), true); assert.equal(w.Heavy.downloading('q'), false);
  assert.equal(w.Heavy.downloadError('q'), null);
});
console.log(`${n} tests passed`);
