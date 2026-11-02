/* Web Worker: Whisper base.en through transformers.js and ONNX Runtime Web (WebAssembly, no WebGPU), on the user's device.
   Messages in:  { id, type: 'load', payload: { wasmBase } }  |  { id, type: 'transcribe', payload: { samples } }
   Messages out: { id, ok: true, result } | { id, ok: false, error } | { progress: true, id, value: { loaded, total } }
   The model files are cached in the Cache API under CACHE (not transformers.js's default name), so Settings can delete them. */
import { pipeline, env } from '@huggingface/transformers';
import { createWordsEngine, MODEL } from './engine.mjs';

const CACHE = 'euno-words-model-v1';
env.allowLocalModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = {
  match: async (key) => (await caches.open(CACHE)).match(key),
  put: async (key, response) => (await caches.open(CACHE)).put(key, response),
};

const engine = createWordsEngine({
  async loadPipeline(onProgress) {
    const files = {};
    return pipeline('automatic-speech-recognition', MODEL.repo, {
      dtype: MODEL.dtype,
      device: 'wasm',
      progress_callback: (p) => {
        if (p && p.status === 'progress' && p.file) {
          files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
          const all = Object.values(files);
          onProgress({ loaded: all.reduce((n, f) => n + f.loaded, 0), total: all.reduce((n, f) => n + f.total, 0) });
        }
      },
    });
  },
});

onmessage = async (e) => {
  const { id, type, payload } = e.data || {};
  try {
    if (type === 'load') {
      if (payload && payload.wasmBase) env.backends.onnx.wasm.wasmPaths = payload.wasmBase;
      await engine.load((value) => postMessage({ progress: true, id, value }));
      postMessage({ id, ok: true, result: true });
    } else if (type === 'transcribe') {
      if (!engine.loaded) throw new Error('The word model is not loaded.');
      postMessage({ id, ok: true, result: await engine.transcribe(payload.samples) });
    } else throw new Error('Unknown message: ' + type);
  } catch (err) {
    postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
