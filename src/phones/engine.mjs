/* Engine core: audio -> PhoneSequence, sequences -> ClipResult. Independent of where the model runs
   (browser worker, Node bench, test fake): the caller supplies runModel(feats, frames) -> {logProbs, T, V}. */
import { fbank, FBANK } from './fbank.mjs';
import { decodeCtc, groupWords, speechMaskFromEnergy } from './ctc.mjs';
import { assessQuality, planChunks } from './quality.mjs';
import { compare, suggest } from './align.mjs';
import { TOKENS } from './tokens.mjs';

export const MODEL_ID = 'zipa-small-crctc-300k-int8';
const now = () => (globalThis.performance ? performance.now() : Date.now());

/* onProgress(doneSec, totalSec) is called after each chunk (a chunk is at most 20 s of audio, the model's unit of work) */
export async function transcribe(samples, { runModel, originSec = 0, model = MODEL_ID, external, onProgress } = {}) {
  const t00 = now();
  let tFeat = 0, tModel = 0, tDec = 0, droppedOnSilence = 0, uncertainFrames = 0, speechFrames = 0, speechOutFrames = 0, frameSec = 0.04;
  const phones = [];
  for (const [a, b] of planChunks(samples)) {
    const chunk = samples.subarray(a, b);
    if (chunk.length < 0.3 * FBANK.SR) continue;
    let t = now();
    const f = fbank(chunk);
    tFeat += now() - t;
    t = now();
    const out = await runModel(f.data, f.frames);
    tModel += now() - t;
    t = now();
    frameSec = (f.frames * FBANK.SHIFT_SEC) / out.T;
    const { mask } = speechMaskFromEnergy(f.energy, out.T, f.frames / out.T);
    const dec = decodeCtc(out.logProbs, out.T, out.V, TOKENS, frameSec, mask);
    const off = a / FBANK.SR;
    for (const p of dec.phones) { p.t0 += off; p.t1 += off; phones.push(p); }
    droppedOnSilence += dec.droppedOnSilence; uncertainFrames += dec.uncertainFrames; speechFrames += dec.speechFrames;
    speechOutFrames += mask.reduce((x, y) => x + y, 0);
    tDec += now() - t;
    if (onProgress) onProgress(b / FBANK.SR, samples.length / FBANK.SR);
  }
  const words = groupWords(phones);
  const durationSec = samples.length / FBANK.SR;
  const quality = assessQuality({ phones, durationSec, speechSec: speechOutFrames * frameSec, droppedOnSilence, uncertainFrames, speechFrames, samples });
  const seq = { v: 1, model, phones, words, frameSec, durationSec, originSec, quality, timingsMs: { features: Math.round(tFeat), model: Math.round(tModel), decode: Math.round(tDec), total: Math.round(now() - t00) } };
  return external ? attachExternalWords(seq, external) : seq;
}

/** Fill Phone.extWord from time overlap with externally supplied words. Does not change anything else. */
export function attachExternalWords(seq, ext) {
  const out = { ...seq, phones: seq.phones.map((p) => ({ ...p })), external: ext };
  const ws = ext.words;
  let k = 0;
  for (const p of out.phones) {
    delete p.extWord;
    const mid = (p.t0 + p.t1) / 2 + (seq.originSec || 0) * 0; // external times are on the same axis as the sequence
    while (k > 0 && ws[k - 1] && ws[k - 1].t1 > mid) k--;
    while (k < ws.length && ws[k].t1 < mid) k++;
    if (k < ws.length && ws[k].t0 - 0.05 <= mid) p.extWord = k;
  }
  return out;
}

export function analyseSequences(speaker, learner, key = '') {
  const comparison = compare(speaker, learner);
  let status = 'ok', suggested = [];
  if (speaker.quality.level !== 'good') status = 'speaker-low-quality';
  else if (learner.quality.level !== 'good') status = 'learner-low-quality';
  else { suggested = suggest(comparison); if (!suggested.length) status = 'nothing-found'; }
  return { v: 1, key, createdAt: Date.now(), speaker, learner, comparison, status, suggested };
}

/** Cheap fingerprint of audio for cache keys (FNV-1a over ~2000 samples + length). */
export function fingerprint(samples) {
  let h = 2166136261 >>> 0;
  const step = Math.max(1, Math.floor(samples.length / 2000));
  for (let i = 0; i < samples.length; i += step) h = Math.imul(h ^ (Math.round(samples[i] * 32767) & 0xffff), 16777619) >>> 0;
  return `${samples.length}.${h.toString(36)}`;
}
export const resultKey = (speaker, learner, model = MODEL_ID) => `${model}|${fingerprint(speaker)}|${fingerprint(learner)}`;
