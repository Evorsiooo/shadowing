/* ---------- in-browser pronunciation engine: client side (global `Phones`) ----------
   Runs a phone recogniser (ZIPA-small, int8) in a Web Worker on the user's own device, compares the learner's take with
   the speaker's audio phone by phone, and caches results on the device. Nothing is sent anywhere; the only network
   use is the one-time model download from Hugging Face. Types: src/phones/contract.d.ts. Not wired into the UI here. */
const Phones = (() => {
  const REPO = 'anyspeech/zipa-small-crctc-300k';
  const MODEL_ID = 'zipa-small-crctc-300k-int8';
  const CREDIT = 'Pronunciation model: ZIPA (Jian Zhu et al., ACL 2025), CC BY 4.0, run on your device with ONNX Runtime Web (MIT).';
  const CACHE = 'euno-phones-model-v1';
  const WORKER_URL = '__PHONES_WORKER_URL__';
  const WASM_BASE = '__PHONES_WASM_BASE__';
  // used only if the file listing can't be read; the listing is the first choice
  const FALLBACK_FILES = ['exp/model.int8.onnx', 'model.int8.onnx', 'onnx/model.int8.onnx'];
  const SLOW = { minMs: 8000, perAudio: 1.5, hardMinMs: 120000, hardPerAudio: 8 };
  const state = { state: 'not-downloaded', progress: 0, bytes: 0, slow: false, credit: CREDIT, error: undefined };
  const listeners = new Set();
  let worker = null, loading = null, seq = 0, lastRun = null;
  const pending = new Map();

  const emit = (patch) => { Object.assign(state, patch, { at: Date.now() }); /* `at`: when the state last changed, so the UI can tell a stalled download */ const s = { ...state }; listeners.forEach((f) => { try { f(s); } catch { /* a listener must not break the engine */ } }); };
  const fail = (code, message) => Object.assign(new Error(message), { code });

  function supported() {
    if (typeof WebAssembly !== 'object') return { ok: false, reason: 'WebAssembly is not available in this browser.' };
    if (typeof Worker !== 'function') return { ok: false, reason: 'Web Workers are not available.' };
    if (typeof caches === 'undefined') return { ok: false, reason: 'The browser cache is not available (private window?).' };
    return { ok: true };
  }

  async function cacheHas() { try { return !!(await (await caches.open(CACHE)).match('model')); } catch { return false; } }

  async function init() {
    const s = supported();
    if (!s.ok) return emit({ state: 'unsupported', error: { code: 'unsupported', message: s.reason } });
    if (await cacheHas()) emit({ state: 'downloaded', progress: 1 });
  }
  const ready = init();

  /** Find the int8 file in the repo listing; fall back to likely paths. Returns {url, size, sha256|null}. */
  async function resolveModel() {
    const base = `https://huggingface.co/${REPO}`;
    try {
      const r = await fetch(`https://huggingface.co/api/models/${REPO}/tree/main?recursive=true`, { credentials: 'omit' });
      if (r.ok) {
        const files = (await r.json()).filter((f) => f.type === 'file' && /\.onnx$/i.test(f.path));
        const pick = files.find((f) => /(^|\/)model\.int8\.onnx$/i.test(f.path)) || files.find((f) => /int8/i.test(f.path));
        if (pick) return { url: `${base}/resolve/main/${pick.path}`, size: pick.size || 0, sha256: (pick.lfs && pick.lfs.oid) || null };
      }
    } catch { /* fall through to the guesses */ }
    for (const p of FALLBACK_FILES) {
      const url = `${base}/resolve/main/${p}`;
      try { const h = await fetch(url, { method: 'HEAD', credentials: 'omit' }); if (h.ok) return { url, size: +h.headers.get('content-length') || 0, sha256: null }; } catch { /* next */ }
    }
    throw fail('download-failed', 'Could not find the model file on Hugging Face.');
  }

  async function sha256Hex(buf) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  let downloading = null;
  /* opts.signal stops the download: a stop by the learner goes back to 'not-downloaded', a stop with reason.code 'stalled' is an error */
  function download(opts = {}) {
    if (state.state === 'unsupported') return Promise.reject(fail('unsupported', state.error.message));
    if (downloading) return downloading;
    const signal = opts.signal;
    downloading = (async () => {
      await ready;
      if (await cacheHas()) { emit({ state: state.state === 'ready' ? 'ready' : 'downloaded', progress: 1 }); return; }
      emit({ state: 'downloading', progress: 0, bytes: 0, error: undefined });
      try {
        const m = await resolveModel();
        if (signal && signal.aborted) throw fail('cancelled', 'Stopped.');
        const resp = await fetch(m.url, { credentials: 'omit', signal });
        if (!resp.ok || !resp.body) throw fail('download-failed', `Model download failed (HTTP ${resp.status}).`);
        const total = +resp.headers.get('content-length') || m.size || 0;
        const reader = resp.body.getReader();
        const parts = []; let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); got += value.length;
          emit({ progress: total ? Math.min(0.99, got / total) : 0, bytes: got });
        }
        const buf = new Uint8Array(got); let o = 0;
        for (const p of parts) { buf.set(p, o); o += p.length; }
        if (m.sha256 && (await sha256Hex(buf)) !== m.sha256) throw fail('download-failed', 'The downloaded model did not match its checksum.');
        const c = await caches.open(CACHE);
        await c.put('model', new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'x-source': m.url, 'x-sha256': m.sha256 || '' } }));
        emit({ state: 'downloaded', progress: 1, bytes: got });
      } catch (e) {
        if (signal && signal.aborted) {
          const why = signal.reason;
          if (!(why && why.code === 'stalled')) { emit({ state: 'not-downloaded', progress: 0, bytes: 0, error: undefined }); throw fail('cancelled', 'Stopped.'); }
          e = fail('stalled', why.message);
        }
        emit({ state: 'error', error: { code: e.code || 'download-failed', message: e.message } });
        throw e;
      } finally { downloading = null; }
    })();
    return downloading;
  }

  function post(msg, transfer, onProgress) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ ...msg, id }, transfer || []);
    });
  }
  function startWorker() {
    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.onmessage = (ev) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      if (ev.data.progress) { if (p.onProgress) p.onProgress(ev.data.done, ev.data.total); return; }
      pending.delete(ev.data.id);
      ev.data.ok ? p.resolve(ev.data) : p.reject(fail(ev.data.code || 'load-failed', ev.data.message));
    };
    worker.onerror = (ev) => { stopWorker(fail('load-failed', ev.message || 'The pronunciation worker failed to start.')); };
  }
  function stopWorker(err) {
    if (worker) worker.terminate();
    worker = null; loading = null;
    for (const p of pending.values()) p.reject(err || fail('cancelled', 'Stopped.'));
    pending.clear();
    if (state.state === 'ready' || state.state === 'loading') emit({ state: 'downloaded' });
  }
  /* the learner stopped the model while it was loading into memory: it stays downloaded */
  function stop() { stopWorker(fail('cancelled', 'Stopped.')); }

  function load() {
    if (loading) return loading;
    loading = (async () => {
      await download();
      emit({ state: 'loading' });
      try {
        const hit = await (await caches.open(CACHE)).match('model');
        const bytes = await hit.arrayBuffer();
        if (!worker) startWorker();
        await post({ type: 'load', bytes, wasmBase: new URL(WASM_BASE, location.href).href }, [bytes]);
        emit({ state: 'ready' });
      } catch (e) {
        const code = e.code === 'out-of-memory' ? 'out-of-memory' : 'load-failed';
        if (worker) worker.terminate();
        worker = null; loading = null;
        if (e.code === 'cancelled') { emit({ state: 'downloaded', error: undefined }); throw e; }
        emit({ state: 'error', error: { code, message: e.message } });
        throw fail(code, e.message);
      }
    })();
    return loading;
  }

  /* opts: originSec, external, onProgress(doneSec, totalSec), cache (keep the speaker's sounds per clip: they never change) */
  async function transcribe(samples, opts = {}) {
    const ckey = opts.cache && !opts.external ? `${MODEL_ID}|seq|${fingerprint(samples)}` : null;
    if (ckey) { const hit = await getResult(ckey); if (hit && hit.seq) { if (opts.onProgress) opts.onProgress(1, 1); return hit.seq; } }
    await load();
    const dur = samples.length / 16000;
    const copy = samples.slice(); // the worker takes ownership of its copy; the caller keeps theirs
    const t0 = performance.now();
    const hard = Math.max(SLOW.hardMinMs, SLOW.hardPerAudio * dur * 1000);
    let timer;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => { stopWorker(fail('too-slow', 'The pronunciation check took too long on this device.')); rej(fail('too-slow', 'The pronunciation check took too long on this device.')); }, hard); });
    try {
      const r = await Promise.race([post({ type: 'transcribe', samples: copy, originSec: opts.originSec || 0, external: opts.external }, [copy.buffer], opts.onProgress), timeout]);
      const ms = performance.now() - t0;
      if (ckey) putResult(ckey, { v: 1, key: ckey, createdAt: Date.now(), seq: r.seq });
      if (ms > Math.max(SLOW.minMs, SLOW.perAudio * dur * 1000)) emit({ slow: true });
      return r.seq;
    } finally { clearTimeout(timer); }
  }

  async function compare(speaker, learner) {
    await load();
    return (await post({ type: 'compare', speaker, learner })).comparison;
  }

  /* results cache: the engine's own IndexedDB (not the app Store, which syncs to the server) */
  const DB = { name: 'euno-phones', store: 'results', keep: 200 };
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB.store);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const idb = async (mode, fn) => { const d = await db(); try { return await new Promise((res, rej) => { const tx = d.transaction(DB.store, mode); const out = fn(tx.objectStore(DB.store)); tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); }); } finally { d.close(); } };
  const getResult = async (key) => { try { return await idb('readonly', (s) => s.get(key)); } catch { return undefined; } };
  async function putResult(key, value) {
    try {
      await idb('readwrite', (s) => s.put(value, key));
      const all = await idb('readonly', (s) => s.getAll());
      if (all && all.length > DB.keep) {
        const keys = await idb('readonly', (s) => s.getAllKeys());
        const old = all.map((v, i) => [v.createdAt, keys[i]]).sort((a, b) => a[0] - b[0]).slice(0, all.length - DB.keep);
        await idb('readwrite', (s) => { old.forEach(([, k]) => s.delete(k)); });
      }
    } catch { /* caching is best effort */ }
  }

  function fingerprint(samples) {
    let h = 2166136261 >>> 0;
    const step = Math.max(1, Math.floor(samples.length / 2000));
    for (let i = 0; i < samples.length; i += step) h = Math.imul(h ^ (Math.round(samples[i] * 32767) & 0xffff), 16777619) >>> 0;
    return `${samples.length}.${h.toString(36)}`;
  }

  /* opts.onProgress({ fraction 0..1, step, steps, stage: 'speaker'|'take'|'compare', cachedSpeaker }) counts the audio read so far (the model works in chunks of up to 20 s, so a short clip moves in one or two jumps).
     The same take asked for twice (review card and tab) shares one run. */
  const running = new Map();
  /* opts.speakerSeq = { fp, seq }: the speaker's sounds read earlier (kept on the clip, so the speaker audio isn't needed here) */
  function analyse(speaker, learner, opts = {}) {
    const key = `${MODEL_ID}|${opts.speakerSeq ? opts.speakerSeq.fp : fingerprint(speaker)}|${fingerprint(learner)}`;
    let r = running.get(key);
    if (!r) {
      r = { subs: new Set(), last: null };
      r.promise = analyseNow(key, speaker, learner, opts, (p) => { r.last = p; r.subs.forEach((f) => { try { f(p); } catch { /* a listener must not break the engine */ } }); }).finally(() => running.delete(key));
      running.set(key, r);
    }
    if (opts.onProgress) { r.subs.add(opts.onProgress); if (r.last) opts.onProgress(r.last); }
    return r.promise;
  }
  async function analyseNow(key, speaker, learner, opts, report) {
    const hit = await getResult(key);
    if (hit) return hit;
    const given = opts.speakerSeq;
    const spKey = given ? null : `${MODEL_ID}|seq|${fingerprint(speaker)}`;
    const cachedSpeaker = !!given || !!(await getResult(spKey));
    const spSec = cachedSpeaker ? 0 : speaker.length / 16000, lrSec = learner.length / 16000, cmpSec = 0.03 * (spSec + lrSec) + 0.1;
    const total = spSec + lrSec + cmpSec, steps = cachedSpeaker ? 2 : 3;
    const prog = (stage, step, doneSec) => report({ fraction: Math.min(1, doneSec / total), step, steps, stage, cachedSpeaker });
    const t0 = performance.now();
    prog(cachedSpeaker ? 'take' : 'speaker', 1, 0);
    const sp = given ? given.seq : await transcribe(speaker, { originSec: opts.speakerOriginSec, external: opts.external, cache: !opts.external, onProgress: (d) => prog('speaker', 1, d) });
    const t1 = performance.now();
    const lr = await transcribe(learner, { onProgress: (d) => prog('take', steps - 1, spSec + d) });
    const t2 = performance.now();
    prog('compare', steps, spSec + lrSec);
    const w = await post({ type: 'compare', speaker: sp, learner: lr });
    const t3 = performance.now();
    lastRun = { speakerMs: Math.round(t1 - t0), cachedSpeaker, takeMs: Math.round(t2 - t1), compareMs: Math.round(t3 - t2), speakerSec: given ? null : Math.round(speaker.length / 1600) / 10, takeSec: Math.round(learner.length / 1600) / 10, speakerTimings: sp.timingsMs, takeTimings: lr.timingsMs };
    try { console.info('pronunciation analysis timings (ms) ' + JSON.stringify(lastRun)); } catch { /* no console */ }
    const comparison = w.comparison;
    let status = 'ok', suggested = [];
    if (sp.quality.level !== 'good') status = 'speaker-low-quality';
    else if (lr.quality.level !== 'good') status = 'learner-low-quality';
    else { suggested = w.suggested; if (!suggested.length) status = 'nothing-found'; }
    const result = { v: 1, key, createdAt: Date.now(), speaker: sp, learner: lr, comparison, status, suggested };
    putResult(key, result);
    return result;
  }

  /* same rule as src/phones/engine.mjs attachExternalWords: a phone belongs to the external word its midpoint falls in (or just before) */
  function attachExternalWords(seq, ext) {
    const ws = ext.words, phones = seq.phones.map((p) => {
      const q = { ...p }; delete q.extWord;
      const mid = (p.t0 + p.t1) / 2;
      const k = ws.findIndex((w) => w.t1 >= mid);
      if (k >= 0 && ws[k].t0 - 0.05 <= mid) q.extWord = k;
      return q;
    });
    return { ...seq, phones, external: ext };
  }

  async function remove() {
    stopWorker();
    try { await caches.delete(CACHE); } catch { /* ignore */ }
    try { await idb('readwrite', (s) => s.clear()); } catch { /* ignore */ }
    emit({ state: supported().ok ? 'not-downloaded' : 'unsupported', progress: 0, bytes: 0, error: undefined });
  }

  return {
    MODEL_ID, CREDIT, supported,
    status: () => ({ ...state }),
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    ready, download, load, stop, remove, lastRun: () => lastRun, transcribe, compare, analyse, attachExternalWords, fingerprint,
  };
})();
