/* CTC greedy decoding to timed phones, with silence gating and word boundaries. */
const MODIFIERS = new Set(['ː', '˞', 'ʰ', 'ʲ', 'ʷ', 'ʼ', 'ˠ', 'ˤ', '̃', '̚', '̥', '̩', '̪', '̴', '̺']);
const BOUNDARY = '▁';

/** logProbs: Float32Array [T*V] (log-softmax, or raw logits: normalised here). energyDb: per output frame loudness (or null).
    Returns { phones, droppedOnSilence, uncertainFrames, speechFrames } on a time axis starting at 0. */
export function decodeCtc(logProbs, T, V, tokens, frameSec, speechMask) {
  const phones = [];
  let prev = -1, droppedOnSilence = 0, uncertain = 0, speech = 0;
  let cur = null; // run being built: {id, first, last, peak}
  let pendingBoundary = true;
  const flush = () => {
    if (!cur) return;
    const sym = tokens[cur.id];
    const silent = speechMask && !speechRun(speechMask, cur.first, cur.last);
    if (sym === BOUNDARY) pendingBoundary = true;
    else if (silent) droppedOnSilence++;
    else if (MODIFIERS.has(sym) || /^[̀-ͯ]$/.test(sym)) {
      const last = phones[phones.length - 1];
      if (last && !pendingBoundary && cur.first * frameSec - last.t1 < 0.12) { last.sym += sym; last.t1 = (cur.last + 1) * frameSec; last.conf = Math.min(last.conf, cur.peak); }
      // a stray modifier with nothing to attach to is dropped, not turned into a phone
    } else {
      phones.push({ sym, t0: cur.first * frameSec, t1: (cur.last + 1) * frameSec, conf: cur.peak, word: -1, boundary: pendingBoundary });
      pendingBoundary = false;
    }
    cur = null;
  };
  for (let t = 0; t < T; t++) {
    let best = 0, bv = -Infinity;
    const o = t * V;
    for (let v = 0; v < V; v++) { const x = logProbs[o + v]; if (x > bv) { bv = x; best = v; } }
    const p = Math.exp(bv);
    if (!speechMask || speechMask[t]) { speech++; if (p < 0.5 && best !== 0) uncertain++; }
    if (best === 0) { flush(); prev = 0; continue; }
    if (best === prev && cur) { cur.last = t; if (p > cur.peak) cur.peak = p; }
    else { flush(); cur = { id: best, first: t, last: t, peak: p }; }
    prev = best;
  }
  flush();
  return { phones, droppedOnSilence, uncertainFrames: uncertain, speechFrames: speech };
}
const speechRun = (mask, a, b) => { for (let t = a; t <= b; t++) if (mask[t]) return true; return false; };

/** Group phones into words by the model's boundary marks, and by pauses over `pauseSec`. Fills phone.word; removes .boundary. */
export function groupWords(phones, pauseSec = 0.35) {
  const words = [];
  let w = null;
  phones.forEach((p, i) => {
    const gap = w ? p.t0 - phones[i - 1].t1 : 0;
    if (!w || p.boundary || gap > pauseSec) { w = { first: i, last: i, t0: p.t0, t1: p.t1 }; words.push(w); }
    else { w.last = i; w.t1 = p.t1; }
    p.word = words.length - 1;
    delete p.boundary;
  });
  return words;
}

/** Speech mask per output frame from per-feature-frame energy (mean log-mel): speech = clearly above the floor. */
export function speechMaskFromEnergy(energy, outFrames, framesPerOut) {
  const n = energy.length;
  if (!n) return { mask: new Uint8Array(outFrames), speechSec: 0 };
  const sorted = Float32Array.from(energy).sort();
  const floor = sorted[Math.floor(n * 0.1)], peak = sorted[Math.floor(n * 0.95)];
  const thr = Math.max(floor + 0.15 * (peak - floor), floor + 1.0);
  const mask = new Uint8Array(outFrames);
  for (let t = 0; t < outFrames; t++) {
    let m = -Infinity;
    for (let k = Math.round(t * framesPerOut); k < Math.min(n, Math.round((t + 1) * framesPerOut)); k++) m = Math.max(m, energy[k]);
    mask[t] = m > thr ? 1 : 0;
  }
  // a speech frame stays speech for 3 frames around it, so word edges aren't cut
  const out = new Uint8Array(outFrames);
  for (let t = 0; t < outFrames; t++) if (mask[t]) for (let k = Math.max(0, t - 2); k <= Math.min(outFrames - 1, t + 2); k++) out[k] = 1;
  return { mask: out, floor, peak };
}
