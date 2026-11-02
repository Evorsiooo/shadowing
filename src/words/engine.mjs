/* Word labels for the Pronunciation tab: Whisper base.en turns the speaker's clip audio into words with times.
   This file is the part that does not need a browser or the model, so it can be tested in Node: turning Whisper's raw
   chunks into clean word spans, and the load/transcribe flow with the model loader injected (worker.mjs injects the real one).
   Words are a LABEL layer. The phone comparison never reads them. Output: [{ w, s, e }], seconds from the clip start. */

export const MODEL = { repo: 'Xenova/whisper-base.en', dtype: 'q8', id: 'whisper-base.en-q8' };
export const SR = 16000;
export const MAX_WORDS = 400;

const NON_SPEECH = /^[[(*♪].*[\])*♪]$|^[♪\s]+$/u; // "[BLANK_AUDIO]", "(music)", "*laughs*", "♪"
const EDGE = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu; // punctuation around a word; apostrophes inside it stay
const r2 = (x) => Math.round(x * 100) / 100;

/* Whisper's word chunks ({ text, timestamp: [start, end|null] }) -> clean spans, in order, inside [0, durationSec].
   Guesses (untuned, not measured on real clips): a word is capped at max(0.5 s, 0.13 s per letter), because the known
   failure is a pause being swallowed into one very long word; a missing end becomes start + 0.3 s. */
export function normaliseWords(chunks, durationSec, { cap = true } = {}) {
  const out = [];
  let prevS = 0;
  for (const c of chunks || []) {
    const raw = String(c && c.text != null ? c.text : '').trim();
    if (!raw || NON_SPEECH.test(raw)) continue;
    const w = raw.replace(EDGE, '');
    if (!w) continue;
    const ts = Array.isArray(c.timestamp) ? c.timestamp : [];
    let s = Number.isFinite(ts[0]) ? ts[0] : out.length ? out[out.length - 1].e : 0;
    s = Math.min(Math.max(s, prevS, 0), durationSec);
    let e = Number.isFinite(ts[1]) ? ts[1] : s + 0.3;
    e = Math.max(e, s + 0.05);
    if (cap) e = Math.min(e, s + Math.max(0.5, 0.13 * w.length));
    e = Math.min(e, durationSec);
    if (e <= s) continue; // starts at or after the end of the clip
    prevS = s;
    out.push({ w, s: r2(s), e: r2(e) });
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

/* when the model has no word-level timing (no `alignment_heads`), Whisper still returns timed phrases: spread each
   phrase's words over it by letter count. Rougher than real word times, so the caller marks the result `timing: 'phrase'`. */
export function spreadPhrases(chunks, durationSec) {
  const words = [];
  for (const c of chunks || []) {
    const ts = Array.isArray(c.timestamp) ? c.timestamp : [];
    const a = Number.isFinite(ts[0]) ? ts[0] : words.length ? words[words.length - 1].timestamp[1] : 0;
    const b = Number.isFinite(ts[1]) ? ts[1] : Math.min(durationSec, a + 3);
    const parts = String(c.text || '').trim().split(/\s+/).filter(Boolean);
    const total = parts.reduce((n, p) => n + p.length, 0) || 1;
    let at = a;
    for (const p of parts) { const len = ((b - a) * p.length) / total; words.push({ text: p, timestamp: [at, at + len] }); at += len; }
  }
  return normaliseWords(words, durationSec, { cap: false });
}

/* loadPipeline(onProgress) -> async (samples: Float32Array, opts) => { text, chunks } (transformers.js ASR pipeline shape) */
export function createWordsEngine({ loadPipeline }) {
  let pipe = null, loading = null;
  const load = (onProgress) => {
    if (pipe) return Promise.resolve();
    if (!loading) loading = loadPipeline(onProgress).then((p) => { pipe = p; }, (e) => { loading = null; throw e; });
    return loading;
  };
  async function transcribe(samples) {
    if (!pipe) throw new Error('The word model is not loaded.');
    const dur = samples.length / SR;
    if (dur < 0.3) return { words: [], timing: 'word', model: MODEL.id };
    const opts = { chunk_length_s: 30, stride_length_s: 5 };
    let res, timing = 'word';
    try {
      res = await pipe(samples, { ...opts, return_timestamps: 'word' });
    } catch (e) {
      if (!/alignment_heads|token-level timestamps/i.test(String(e && e.message))) throw e;
      res = await pipe(samples, { ...opts, return_timestamps: true });
      timing = 'phrase';
    }
    const chunks = res && Array.isArray(res.chunks) ? res.chunks : [];
    return { words: timing === 'word' ? normaliseWords(chunks, dur) : spreadPhrases(chunks, dur), timing, model: MODEL.id };
  }
  return { load, transcribe, get loaded() { return !!pipe; } };
}
