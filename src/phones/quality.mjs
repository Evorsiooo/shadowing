/* Clip quality and chunk planning. All thresholds are untuned placeholders: tune them on real clips with the dev page. */
export const THRESHOLDS = {
  minDurationSec: 0.4,
  minSpeechSec: 1.0,
  minMeanConf: 0.55,
  phonesPerSpeechSec: [3, 22], // normal speech is roughly 8 to 16
  maxUncertainFraction: 0.35,
  clipFraction: 0.02,
  chunkMaxSec: 20,
  chunkSearchSec: 4,
};

export function assessQuality({ phones, durationSec, speechSec, droppedOnSilence, uncertainFrames, speechFrames, samples }) {
  const T = THRESHOLDS, reasons = [];
  const meanConf = phones.length ? phones.reduce((a, p) => a + p.conf, 0) / phones.length : 0;
  const rate = speechSec > 0 ? phones.length / speechSec : 0;
  if (durationSec < T.minDurationSec) reasons.push('too-short');
  else if (speechSec < T.minSpeechSec) reasons.push('little-speech');
  if (phones.length && meanConf < T.minMeanConf) reasons.push('low-confidence');
  if (speechSec >= T.minSpeechSec && (rate < T.phonesPerSpeechSec[0] || rate > T.phonesPerSpeechSec[1])) reasons.push('implausible-rate');
  if (speechFrames && uncertainFrames / speechFrames > T.maxUncertainFraction) reasons.push('noisy');
  if (samples) { let c = 0; for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) > 0.99) c++; if (c / Math.max(1, samples.length) > T.clipFraction) reasons.push('clipping'); }
  const level = !phones.length ? 'unusable' : reasons.length ? 'low' : 'good';
  return { level, reasons, durationSec, speechSec, meanConf, phonesPerSpeechSec: rate, droppedOnSilence };
}

/** Split [0, n) samples into chunks of at most chunkMaxSec, cutting at the quietest 50 ms near the end of each chunk. */
export function planChunks(samples, sr = 16000) {
  const max = Math.round(THRESHOLDS.chunkMaxSec * sr), search = Math.round(THRESHOLDS.chunkSearchSec * sr), win = Math.round(0.05 * sr);
  const out = [];
  let start = 0;
  while (samples.length - start > max) {
    let bestAt = start + max, bestE = Infinity;
    for (let a = start + max - search; a + win <= start + max; a += win) {
      let e = 0;
      for (let i = a; i < a + win; i++) e += samples[i] * samples[i];
      if (e < bestE) { bestE = e; bestAt = a + (win >> 1); }
    }
    out.push([start, bestAt]);
    start = bestAt;
  }
  out.push([start, samples.length]);
  return out;
}
