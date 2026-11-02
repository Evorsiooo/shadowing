/* ---------- word labels for the Pronunciation tab: Whisper base.en in a Web Worker, on the learner's device ----------
   Euno clips have no transcripts, so the words come from speech recognition run once on the speaker's clip audio. They are only a
   caption laid over the time axis: the phone comparison (24-phones.js) never reads them, so a wrong word is a wrong label, never a
   wrong "difference". Off until the learner turns it on (Heavy feature 'words', Settings → Analysis), a separate download from the
   pronunciation model, and the tab works without it (sounds only).

   Stored on the clip, next to clip.model:
     clip.words    = [{ w, s, e, x? }]   word, start, end in seconds from the clip start; x: 1 = the learner fixed the spelling
     clip.wordsFor = { start, end, model, timing: 'word'|'phrase', at }   what they were made from
   Both are cleared when the clip's start or end changes (50-panel.js), because the times would no longer fit.
   Worker: src/words/worker.mjs (transformers.js + ONNX Runtime Web, WebAssembly only). Pure parts and tests: src/words/engine.mjs. */
const Words = (() => {
  const WORKER_URL = '__WORDS_WORKER_URL__';
  const WASM_BASE = '__WORDS_WASM_BASE__';
  const MODEL_ID = 'whisper-base.en-q8';
  const CACHE = 'euno-words-model-v1';
  const FLAG = 'wordsModel'; // localStorage: the model finished loading once on this device
  const EXPECTED_BYTES = 80e6; // model files (about 77 MB) plus tokenizer and config; used for the progress bar only
  const CREDIT = 'Word labels: Whisper (OpenAI, MIT) as ONNX files by Xenova, run on your device with transformers.js (Apache-2.0).';
  const state = { state: 'not-downloaded', progress: 0, bytes: 0, slow: false, credit: CREDIT, error: undefined };
  const listeners = new Set();
  const emit = (patch) => { Object.assign(state, patch); const s = { ...state }; listeners.forEach((f) => { try { f(s); } catch { /* a listener must not break the engine */ } }); };
  const worker = Heavy.worker(WORKER_URL, {
    module: true, idleMs: 60000,
    onProgress: (v) => { if (state.state === 'downloading') emit({ bytes: v.loaded, progress: Math.min(0.99, v.loaded / Math.max(EXPECTED_BYTES, v.total || 0)) }); },
  });

  function supported() {
    if (typeof WebAssembly !== 'object') return { ok: false, reason: 'WebAssembly is not available in this browser.' };
    if (typeof Worker !== 'function') return { ok: false, reason: 'Web Workers are not available.' };
    if (typeof caches === 'undefined') return { ok: false, reason: 'The browser cache is not available (private window?).' };
    return { ok: true };
  }
  async function cacheHas() { try { return (await (await caches.open(CACHE)).keys()).length > 0; } catch { return false; } }
  const init = (async () => {
    const s = supported();
    if (!s.ok) return emit({ state: 'unsupported', error: { code: 'unsupported', message: s.reason } });
    if (lsGet(FLAG, '') === MODEL_ID && (await cacheHas())) emit({ state: 'downloaded', progress: 1 });
  })();

  /* load the model (downloads it the first time, then reads it from the device's cache). Call inside Heavy.run. */
  async function load(signal) {
    await init;
    if (state.state === 'unsupported') throw Object.assign(new Error(state.error.message), { code: 'unsupported' });
    const first = state.state === 'not-downloaded' || state.state === 'error';
    emit({ state: first ? 'downloading' : 'loading', progress: first ? 0 : 1, error: undefined });
    try {
      await worker.call('load', { wasmBase: new URL(WASM_BASE, location.href).href }, [], signal);
      lsSet(FLAG, MODEL_ID);
      emit({ state: 'ready', progress: 1 });
    } catch (e) {
      emit(e instanceof HeavyError && e.code === 'cancelled' ? { state: lsGet(FLAG, '') === MODEL_ID ? 'downloaded' : 'not-downloaded', progress: 0 } : { state: 'error', error: { code: e.code || 'load-failed', message: e.message } });
      throw e;
    }
  }

  /* samples: mono 16 kHz Float32Array. Call inside Heavy.run. Returns { words: [{w,s,e}], timing, model } */
  async function transcribe(samples, signal) {
    await load(signal);
    const copy = samples.slice(); // the worker takes ownership of its copy
    const dur = samples.length / 16000, t0 = performance.now();
    const r = await worker.call('transcribe', { samples: copy }, [copy.buffer], signal);
    if (performance.now() - t0 > Math.max(8000, 3 * dur * 1000)) emit({ slow: true });
    return r;
  }

  /* the clip's words, made now if the learner turned the feature on and the clip has none. Resolves to the stored list (empty if no speech was found), or null
     (feature off, no audio yet, or it failed: the tab then shows sounds only). Throws HeavyError when the run fails. */
  const running = new Map();
  function ensure(clip) {
    if (clip.words && clip.wordsFor) return Promise.resolve(clip.words);
    if (!Heavy.isOn('words')) return Promise.resolve(null);
    if (running.has(clip.id)) return running.get(clip.id);
    const p = (async () => {
      const samples = VideoAudio.slice(clip.videoId, clip.start, clip.end);
      if (!samples) return null;
      const res = await Heavy.run('words', ({ signal }) => transcribe(samples, signal), { timeoutMs: state.state === 'downloaded' || state.state === 'ready' ? Math.max(180000, 12 * (clip.end - clip.start) * 1000) : 900000 } /* the first run also downloads the model */);
      const now = Store.get('clips', clip.id);
      if (!now || now.start !== clip.start || now.end !== clip.end) return null; // the learner moved the clip meanwhile: these times no longer fit
      Store.patch('clips', clip.id, { words: res.words, wordsFor: { start: clip.start, end: clip.end, model: res.model, timing: res.timing, at: new Date().toISOString() } });
      return res.words;
    })().finally(() => running.delete(clip.id));
    running.set(clip.id, p);
    return p;
  }

  /* the learner fixed a word's spelling (empty text removes the word). Times stay; the fix is kept if the words are ever re-read */
  function edit(clipId, list) {
    const words = list.map((x) => ({ ...x, w: String(x.w || '').trim() })).filter((x) => x.w).slice(0, 400);
    Store.patch('clips', clipId, { words });
    return words;
  }

  async function remove() {
    worker.terminate();
    try { await caches.delete(CACHE); } catch { /* ignore */ }
    lsSet(FLAG, '');
    emit({ state: supported().ok ? 'not-downloaded' : 'unsupported', progress: 0, bytes: 0, error: undefined });
  }

  return {
    MODEL_ID, CREDIT, supported, ensure, edit, remove, transcribe, load,
    isRunning: (clipId) => running.has(clipId),
    status: () => ({ ...state }),
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    ready: init,
  };
})();

Heavy.register('words', {
  name: N_('Word labels'),
  about: N_('Reads the words of a clip so the Pronunciation tab can show them. Speech recognition runs on this device; nothing is sent anywhere. It can mishear, and you can fix a word.'),
  sizeMB: 80, minMemGB: 4, minCores: 4,
  cacheNames: ['euno-words-model-v1'],
  remove: () => Words.remove(),
});
