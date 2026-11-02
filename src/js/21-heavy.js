/* ---------- safe heavy features: models that download megabytes and use a lot of memory ----------
   Pronunciation analysis and transcription run a neural model in the browser. On a weak phone or an old laptop that can
   freeze the tab or crash the browser, so every such feature goes through this file:

   - OFF until the learner turns it on, on this device (Settings, Analysis tab). Never synced: a strong laptop and a weak
     phone share an account. Turning it on shows the download size first (consent is remembered for that size).
   - capability check before it is offered: Worker + WebAssembly, device memory, cores, Save-Data, storage room.
   - a crash-loop guard: a "working" flag is saved before a model loads and cleared when the work ends. If the page
     starts and finds the flag still set, the browser died mid-work, so the feature turns itself off instead of
     reloading into the same crash.
   - a watchdog: Heavy.run() times a job out, counts failures and turns the feature off after two (one for out-of-memory).
   - one heavy job at a time, never while a pass is being recorded, never when the JS heap is nearly full.
   - Heavy.worker() keeps the model in a Web Worker and terminates it when idle, which frees its memory.
   Everything else in the app works with every feature off.

   How an engine uses it (the engines themselves are separate files):

     Heavy.register('pronunciation', { name: 'Pronunciation analysis', about: 'One sentence', sizeMB: 71, minMemGB: 4, minCores: 4,
                                       cacheNames: ['euno-phones-v1'], remove: async () => { … } });
     if (!Heavy.isOn('pronunciation')) return;                 // offer nothing when off
     const res = await Heavy.run('pronunciation', async ({ signal }) => { … }, { timeoutMs: 60000 });
     // errors are HeavyError with .code: 'off' | 'timeout' | 'low-memory' | 'cancelled' | 'failed'; handle them quietly
*/
class HeavyError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const Heavy = (() => {
  const KEY = 'heavy'; // localStorage on this device only
  const MAX_FAILS = 2;
  const features = new Map();
  const listeners = new Set();
  const blockers = []; // functions returning true while heavy work should wait (e.g. a recording is in progress)
  let queue = Promise.resolve();
  let storageMB = null; // free storage estimate, filled in by refreshDevice()

  const all = () => lsGet(KEY, {});
  const get = (id) => ({ on: false, consentMB: 0, pending: 0, fails: 0, off: null, ...(all()[id] || {}) });
  function put(id, patch) {
    const a = all();
    a[id] = { ...get(id), ...patch, ...(patch.off ? { noticed: false } : {}) };
    lsSet(KEY, a);
    for (const f of listeners) { try { f(id); } catch { /* a listener must not break the guard */ } }
  }
  const spec = (id) => features.get(id);

  function device() {
    const nav = navigator;
    const uad = nav.userAgentData;
    return {
      memGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null, // Chrome and Edge only; capped at 8
      cores: nav.hardwareConcurrency || null,
      saveData: !!(nav.connection && nav.connection.saveData),
      mobile: uad && typeof uad.mobile === 'boolean' ? uad.mobile : /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || ''),
      worker: typeof Worker === 'function',
      wasm: typeof WebAssembly === 'object',
      storageMB,
    };
  }
  async function refreshDevice() {
    try { const e = await navigator.storage.estimate(); storageMB = Math.floor(((e.quota || 0) - (e.usage || 0)) / 1048576); } catch { storageMB = null; }
    return device();
  }

  /* can this device run the feature? level 'no' = don't offer it; 'warn' = allowed after the learner sees the reasons */
  function check(id) {
    const s = spec(id), d = device();
    const no = [], warn = [];
    if (!d.worker || !d.wasm) no.push(t('This browser can’t run it (it needs Web Workers and WebAssembly).'));
    const minMem = s.minMemGB || 4;
    if (d.memGB != null && d.memGB < minMem) no.push(t('This device reports {gb} GB of memory and this needs at least {min} GB.', { gb: d.memGB, min: minMem }));
    if (d.memGB == null) warn.push(t('This browser doesn’t say how much memory the device has, so it can’t be checked.'));
    if (d.cores != null && d.cores < (s.minCores || 4)) warn.push(t('Only {n} processor cores: it will be slow.', { n: d.cores }));
    if (d.mobile) warn.push(t('Phones and tablets can struggle with it and it drains the battery.'));
    if (d.saveData) warn.push(t('Data saver is on, and the download is large.'));
    if (d.storageMB != null && s.sizeMB && d.storageMB < s.sizeMB * 3) warn.push(t('Little free storage is left for the download ({mb} MB).', { mb: Math.max(0, d.storageMB) }));
    return { level: no.length ? 'no' : warn.length ? 'warn' : 'ok', reasons: no.concat(warn) };
  }

  function register(id, def) {
    features.set(id, def);
    // the crash-loop guard: the flag was left set, so the last run never finished and the browser likely died
    const st = get(id);
    if (st.pending) put(id, { pending: 0, on: false, off: 'crash' });
  }
  /* a normal close or navigation isn't a crash; killed tabs never fire pagehide, which is what the guard looks for */
  addEventListener('pagehide', () => { const a = all(); let ch = false; for (const k of Object.keys(a)) if (a[k].pending) { a[k].pending = 0; ch = true; } if (ch) lsSet(KEY, a); });

  function isOn(id) {
    const s = spec(id);
    if (!s) return false;
    const st = get(id);
    return st.on && !st.off && (!s.sizeMB || st.consentMB >= s.sizeMB) && check(id).level !== 'no';
  }
  /* turn on after the learner has agreed to the download size. False if this device can't run it */
  function enable(id) {
    const s = spec(id);
    if (!s || check(id).level === 'no') return false;
    put(id, { on: true, consentMB: s.sizeMB || 0, off: null, fails: 0, pending: 0 });
    return true;
  }
  function disable(id, reason = null) { put(id, { on: false, off: reason, pending: 0 }); }

  function memoryPressure() {
    const m = performance.memory; // Chrome only
    return !!(m && m.jsHeapSizeLimit && m.usedJSHeapSize / m.jsHeapSizeLimit > 0.75);
  }
  const waitIdle = async (signal) => { while (blockers.some((f) => { try { return f(); } catch { return false; } })) { if (signal.aborted) throw new HeavyError('cancelled'); await new Promise((r) => setTimeout(r, 400)); } };

  /* run one job under the watchdog. job({ signal }) must stop when signal aborts (terminate its worker).
     opts: timeoutMs (default 60 s), signal (the caller's own cancel) */
  function run(id, job, opts = {}) {
    const next = queue.then(() => runNow(id, job, opts));
    queue = next.catch(() => {});
    return next;
  }
  async function runNow(id, job, { timeoutMs = 60000, signal: outer } = {}) {
    if (!isOn(id)) throw new HeavyError('off', 'This feature is off on this device.');
    const ctl = new AbortController();
    const cancel = () => ctl.abort();
    if (outer) { if (outer.aborted) throw new HeavyError('cancelled'); outer.addEventListener('abort', cancel, { once: true }); }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
    try {
      await waitIdle(ctl.signal);
      if (memoryPressure()) throw new HeavyError('low-memory', 'The page is using nearly all the memory the browser allows.');
      put(id, { pending: Date.now() });
      const res = await Promise.race([
        job({ signal: ctl.signal }),
        new Promise((_, rej) => ctl.signal.addEventListener('abort', () => rej(new HeavyError(timedOut ? 'timeout' : 'cancelled')), { once: true })),
      ]);
      put(id, { pending: 0, fails: 0 });
      return res;
    } catch (e) {
      // a job that stops because the watchdog aborted it reports 'cancelled' itself; it was really a timeout
      const code = timedOut ? 'timeout' : e instanceof HeavyError ? e.code : /memory|alloc/i.test(String(e && e.message)) ? 'out-of-memory' : 'failed';
      const err = e instanceof HeavyError && e.code === code ? e : new HeavyError(code, e && e.message);
      if (code === 'cancelled' || code === 'low-memory' || code === 'off') put(id, { pending: 0 }); // not the feature's fault
      else {
        const fails = get(id).fails + 1;
        const why = code === 'out-of-memory' ? 'memory' : code === 'timeout' ? 'slow' : 'failures';
        if (code === 'out-of-memory' || fails >= MAX_FAILS) put(id, { pending: 0, fails, on: false, off: why });
        else put(id, { pending: 0, fails });
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (outer) outer.removeEventListener('abort', cancel);
    }
  }

  /* a Web Worker with a call/reply protocol and an idle timeout (terminating it frees the model's memory).
     Worker side: onmessage = async (e) => { const { id, type, payload } = e.data; try { postMessage({ id, ok: true, result }) } catch (err) { postMessage({ id, ok: false, error: String(err) }) } }
     An optional { progress: true, id, value } message calls onProgress. */
  function worker(url, { idleMs = 30000, onProgress } = {}) {
    let w = null, seq = 0, idle = 0;
    const waiting = new Map();
    const fail = (err) => { for (const p of waiting.values()) p.rej(err); waiting.clear(); };
    const stop = () => { clearTimeout(idle); if (w) { w.terminate(); w = null; } fail(new HeavyError('cancelled', 'The worker was stopped.')); };
    function open() {
      w = new Worker(url);
      w.onmessage = (e) => {
        const m = e.data || {};
        if (m.progress) { onProgress && onProgress(m.value, m.id); return; }
        const p = waiting.get(m.id);
        if (!p) return;
        waiting.delete(m.id);
        if (m.ok) p.res(m.result); else p.rej(new HeavyError(/memory|alloc/i.test(String(m.error)) ? 'out-of-memory' : 'failed', String(m.error)));
        if (!waiting.size) { clearTimeout(idle); idle = setTimeout(stop, idleMs); }
      };
      w.onerror = (e) => { const err = new HeavyError('failed', e && e.message); if (w) { w.terminate(); w = null; } fail(err); };
      w.onmessageerror = () => { if (w) { w.terminate(); w = null; } fail(new HeavyError('failed', 'Unreadable message from the worker.')); };
    }
    return {
      call(type, payload, transfer = [], signal) {
        if (!w) open();
        clearTimeout(idle);
        const id = ++seq;
        return new Promise((res, rej) => {
          waiting.set(id, { res, rej });
          if (signal) signal.addEventListener('abort', () => { stop(); }, { once: true });
          w.postMessage({ id, type, payload }, transfer);
        });
      },
      terminate: stop,
      get alive() { return !!w; },
    };
  }

  /* delete everything the feature downloaded and forget the learner's consent */
  async function removeData(id) {
    const s = spec(id);
    if (s && s.remove) { try { await s.remove(); } catch { /* keep going: the caches below are the part that frees space */ } }
    if (s && s.cacheNames && typeof caches === 'object') for (const n of s.cacheNames) { try { await caches.delete(n); } catch { /* ignore */ } }
    put(id, { on: false, consentMB: 0, off: null, fails: 0, pending: 0 });
  }

  return {
    register, check, isOn, enable, disable, run, worker, removeData, device, refreshDevice, blockers,
    state: get, spec, markNoticed(id) { const a = all(); if (a[id]) { a[id].noticed = true; lsSet(KEY, a); } },
     list: () => [...features.keys()],
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /* testing hooks */
    _reset() { features.clear(); queue = Promise.resolve(); },
  };
})();
