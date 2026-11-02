/* Web Worker: runs the ZIPA model with onnxruntime-web (WASM, single thread, because the app is not cross-origin isolated)
   and the engine core. Messages in: load | transcribe | compare. Every reply: {id, ok, ...} or {id, ok:false, code, message}. */
import * as ort from 'onnxruntime-web/wasm';
import { transcribe, analyseSequences } from './engine.mjs';
import { compare, suggest } from './align.mjs';

let session = null;

function codeOf(e) {
  const m = String((e && e.message) || e);
  return /memory|alloc|oom/i.test(m) ? 'out-of-memory' : 'load-failed';
}

/** ZIPA's CTC head returns log-probabilities; if a build returns raw logits, normalise per frame. */
function logSoftmaxIfNeeded(data, T, V) {
  let s = 0;
  for (let v = 0; v < V; v++) s += Math.exp(data[v]);
  if (Math.abs(s - 1) < 0.02) return data;
  const out = new Float32Array(data.length);
  for (let t = 0; t < T; t++) {
    let m = -Infinity;
    for (let v = 0; v < V; v++) m = Math.max(m, data[t * V + v]);
    let z = 0;
    for (let v = 0; v < V; v++) z += Math.exp(data[t * V + v] - m);
    const lz = m + Math.log(z);
    for (let v = 0; v < V; v++) out[t * V + v] = data[t * V + v] - lz;
  }
  return out;
}

async function runModel(feats, frames) {
  const x = new ort.Tensor('float32', feats, [1, frames, 80]);
  const xl = new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1]);
  const out = await session.run({ x, x_lens: xl });
  const o = out[Object.keys(out)[0]];
  const [, T, V] = o.dims;
  return { logProbs: logSoftmaxIfNeeded(o.data, T, V), T, V };
}

self.onmessage = async (ev) => {
  const { type, id } = ev.data;
  try {
    if (type === 'load') {
      const t = performance.now();
      ort.env.wasm.wasmPaths = ev.data.wasmBase;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      session = await ort.InferenceSession.create(new Uint8Array(ev.data.bytes), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ id, ok: true, loadMs: Math.round(performance.now() - t), inputs: session.inputNames, outputs: session.outputNames });
    } else if (type === 'transcribe') {
      if (!session) throw Object.assign(new Error('model not loaded'), { code: 'load-failed' });
      const seq = await transcribe(ev.data.samples, { runModel, originSec: ev.data.originSec || 0, external: ev.data.external });
      self.postMessage({ id, ok: true, seq });
    } else if (type === 'compare') {
      const c = compare(ev.data.speaker, ev.data.learner);
      self.postMessage({ id, ok: true, comparison: c, suggested: suggest(c) });
    }
  } catch (e) {
    self.postMessage({ id, ok: false, code: e.code || codeOf(e), message: String((e && e.message) || e) });
  }
};
