/* ---------- signal analysis: pitch (YIN), loudness, alignment, rough measures ---------- */
const SR = 16000; // analysis sample rate
const HOP = 160; // 10 ms
const HOP_S = HOP / SR;
const WIN = 400; // 25 ms analysis window
const F0_MIN = 65;
const F0_MAX = 450;

const DSP = {
  /* simple anti-aliased decimation (box filter + linear interpolation) */
  resample(input, fromRate, toRate = SR) {
    if (fromRate === toRate) return Float32Array.from(input);
    const ratio = fromRate / toRate;
    const n = Math.floor(input.length / ratio);
    const out = new Float32Array(n);
    const half = Math.max(0, Math.floor(ratio / 2));
    for (let i = 0; i < n; i++) {
      const c = i * ratio;
      const j = Math.floor(c);
      if (half > 0) {
        let s = 0, cnt = 0;
        for (let k = j - half; k <= j + half; k++) if (k >= 0 && k < input.length) { s += input[k]; cnt++; }
        out[i] = cnt ? s / cnt : 0;
      } else {
        const f = c - j;
        out[i] = (input[j] || 0) * (1 - f) + (input[j + 1] || 0) * f;
      }
    }
    return out;
  },

  /* YIN pitch estimate on x[start .. start+WIN+tauMax) */
  yin(x, start, diff) {
    const tauMin = Math.floor(SR / F0_MAX);
    const tauMax = Math.floor(SR / F0_MIN);
    if (start + WIN + tauMax > x.length) return [0, 0];
    diff[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < WIN; j++) {
        const d = x[start + j] - x[start + j + tau];
        s += d * d;
      }
      running += s;
      diff[tau] = running > 0 ? (s * tau) / running : 1;
    }
    const thr = 0.15;
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (diff[t] < thr) {
        while (t + 1 <= tauMax && diff[t + 1] < diff[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // no dip under threshold: take the global minimum but report low confidence
      let best = tauMin;
      for (let t = tauMin; t <= tauMax; t++) if (diff[t] < diff[best]) best = t;
      tau = best;
    }
    const a = diff[tau - 1] ?? diff[tau], b = diff[tau], c = diff[tau + 1] ?? diff[tau];
    const denom = a - 2 * b + c;
    const shift = denom ? (0.5 * (a - c)) / denom : 0;
    const t = tau + clamp(shift, -1, 1);
    return [SR / t, clamp(1 - b, 0, 1)];
  },

  rmsDb(x, start, len) {
    let s = 0;
    const end = Math.min(x.length, start + len);
    for (let i = start; i < end; i++) s += x[i] * x[i];
    const r = Math.sqrt(s / Math.max(1, end - start));
    return 20 * Math.log10(r + 1e-6);
  },

  /* analyse a mono 16 kHz signal: per 10 ms frame, f0 (Hz, 0 = none), confidence, loudness (dB) */
  analyse(x) {
    const n = Math.max(0, Math.floor((x.length - WIN) / HOP));
    const f0 = new Float32Array(n), conf = new Float32Array(n), db = new Float32Array(n);
    const diff = new Float32Array(Math.floor(SR / F0_MIN) + 2);
    for (let i = 0; i < n; i++) db[i] = this.rmsDb(x, i * HOP, WIN);
    const loud = percentile(Array.from(db), 0.95);
    const gate = loud - 30;
    for (let i = 0; i < n; i++) {
      if (db[i] < gate) continue;
      const [f, c] = this.yin(x, i * HOP, diff);
      f0[i] = f; conf[i] = c;
    }
    return { f0, conf, db, hop: HOP_S };
  },

  /* smooth, remove unreliable stretches and octave jumps; returns Float32 Hz with NaN for gaps */
  cleanPitch(f0, conf, smoothing = 5) {
    const n = f0.length;
    const out = new Float32Array(n).fill(NaN);
    for (let i = 0; i < n; i++) if (f0[i] > 0 && conf[i] > 0.75) out[i] = f0[i];
    // octave-jump fix against a running median
    const med = median(Array.from(out));
    if (isFinite(med)) {
      for (let i = 0; i < n; i++) {
        const v = out[i];
        if (!isFinite(v)) continue;
        const r = v / med;
        if (r > 1.8 && r < 2.3) out[i] = v / 2;
        else if (r < 0.56 && r > 0.43) out[i] = v * 2;
        else if (r > 2.6 || r < 0.38) out[i] = NaN;
      }
    }
    // median filter
    const k = Math.max(1, Math.floor(smoothing / 2));
    const sm = new Float32Array(n).fill(NaN);
    for (let i = 0; i < n; i++) {
      if (!isFinite(out[i])) continue;
      const win = [];
      for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < n && isFinite(out[j])) win.push(out[j]);
      sm[i] = median(win);
    }
    // drop islands shorter than 40 ms
    let i = 0;
    while (i < n) {
      if (!isFinite(sm[i])) { i++; continue; }
      let j = i;
      while (j < n && isFinite(sm[j])) j++;
      if (j - i < 4) for (let q = i; q < j; q++) sm[q] = NaN;
      i = j;
    }
    return sm;
  },

  /* semitones relative to the speaker's own median pitch */
  toSemitones(hz) {
    const ref = median(Array.from(hz));
    const st = Array.from(hz, (v) => (isFinite(v) && isFinite(ref) ? 12 * Math.log2(v / ref) : null));
    return { st, refHz: isFinite(ref) ? ref : null };
  },

  /* the compact "model line" stored with each clip */
  modelFromSamples(x, smoothing) {
    const a = this.analyse(x);
    const clean = this.cleanPitch(a.f0, a.conf, smoothing);
    const { st, refHz } = this.toSemitones(clean);
    const voiced = Array.from(a.f0).filter((v) => v > 0).length;
    const reliable = st.filter((v) => v != null).length;
    return {
      hop: HOP_S,
      st: st.map((v) => (v == null ? null : Math.round(v * 10) / 10)),
      db: Array.from(a.db, (v) => Math.round(v)),
      refHz: refHz && Math.round(refHz),
      onset: this.onset(a.db) * HOP_S,
      reliability: voiced ? round(reliable / voiced, 2) : 0,
      measures: this.measures(a.db, st),
    };
  },

  /* first frame where loudness rises well above the noise floor for 50 ms */
  onset(db, startAt = 0) {
    const arr = Array.from(db);
    const floor = percentile(arr, 0.1);
    const peak = percentile(arr, 0.97);
    const thr = Math.max(floor + 12, peak - 28);
    for (let i = startAt; i < arr.length - 5; i++) {
      let ok = true;
      for (let k = 0; k < 5; k++) if (arr[i + k] < thr) { ok = false; break; }
      if (ok) return i;
    }
    return 0;
  },

  /* normalised envelope for alignment */
  envForAlign(db) {
    const arr = Array.from(db, (v) => (v == null ? -80 : v));
    const floor = percentile(arr, 0.15);
    const peak = percentile(arr, 0.98);
    const span = Math.max(6, peak - floor);
    const e = arr.map((v) => clamp((v - floor) / span, 0, 1));
    const m = mean(e);
    return e.map((v) => v - m);
  },

  /* best shift d (frames) such that user[t + d] ~ model[t]; positive d = user behind */
  xcorr(model, user, minLag, maxLag) {
    let best = 0, bestScore = -Infinity;
    const scores = [];
    for (let d = minLag; d <= maxLag; d++) {
      let s = 0, na = 0, nb = 0;
      for (let t = 0; t < model.length; t++) {
        const u = t + d;
        if (u < 0 || u >= user.length) continue;
        s += model[t] * user[u]; na += model[t] * model[t]; nb += user[u] * user[u];
      }
      const score = na && nb ? s / Math.sqrt(na * nb) : -1;
      scores.push(score);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    // confidence: how much the peak stands out from the rest
    const sorted = scores.slice().sort((a, b) => b - a);
    const second = sorted[Math.min(sorted.length - 1, 25)] ?? -1;
    return { lag: best, score: bestScore, margin: bestScore - second };
  },

  /* syllable-ish nuclei: loudness peaks in voiced stretches */
  nuclei(db, st) {
    const n = db.length;
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < n) { s += db[i + k]; c++; }
      sm[i] = s / c;
    }
    const peak = percentile(Array.from(sm), 0.97);
    const peaks = [];
    for (let i = 4; i < n - 4; i++) {
      if (sm[i] < peak - 22) continue;
      if (!(sm[i] >= sm[i - 1] && sm[i] > sm[i + 1])) continue;
      const voiced = st ? [i - 2, i, i + 2].some((j) => st[j] != null) : true;
      if (!voiced) continue;
      // prominence: dip of at least 2 dB to each side before the next peak
      let l = i, r = i;
      while (l > 0 && sm[l - 1] <= sm[l] + 0.2 && i - l < 25) l--;
      while (r < n - 1 && sm[r + 1] <= sm[r] + 0.2 && r - i < 25) r++;
      if (sm[i] - Math.max(sm[l], sm[r]) < 2) continue;
      if (peaks.length && i - peaks[peaks.length - 1].i < 8) {
        if (sm[i] > peaks[peaks.length - 1].v) peaks[peaks.length - 1] = { i, v: sm[i], l, r };
        continue;
      }
      peaks.push({ i, v: sm[i], l, r });
    }
    // width at -6 dB as a rough syllable length
    for (const p of peaks) {
      let a = p.i, b = p.i;
      while (a > 0 && sm[a] > p.v - 6) a--;
      while (b < n - 1 && sm[b] > p.v - 6) b++;
      p.dur = (b - a) * HOP_S;
    }
    return peaks;
  },

  /* rough, clearly-labelled measures (not an accent score) */
  measures(db, st) {
    const arr = Array.from(db);
    const floor = percentile(arr, 0.1), peak = percentile(arr, 0.97);
    const speech = arr.filter((v) => v > Math.max(floor + 10, peak - 30)).length * HOP_S;
    const peaks = this.nuclei(arr, st);
    const vols = peaks.map((p) => p.v);
    const cut = percentile(vols, 0.7);
    const stressed = peaks.filter((p) => p.v >= cut).map((p) => p.dur);
    const unstressed = peaks.filter((p) => p.v < cut).map((p) => p.dur);
    const stv = (st || []).filter((v) => v != null);
    return {
      rate: speech > 0.5 ? round(peaks.length / speech, 2) : null,
      stressRatio: stressed.length && unstressed.length ? round(mean(stressed) / mean(unstressed), 2) : null,
      range: stv.length > 20 ? round(percentile(stv, 0.9) - percentile(stv, 0.1), 1) : null,
      syllables: peaks.length,
      speechSec: round(speech, 1),
    };
  },

  /* quiet stretches (pauses) in a dB envelope: [{a, b}] in frames */
  pauses(db, minFrames = 15) {
    const arr = Array.from(db);
    const floor = percentile(arr, 0.1), peak = percentile(arr, 0.97);
    const thr = Math.max(floor + 8, peak - 26);
    const out = [];
    let i = 0;
    while (i < arr.length) {
      if (arr[i] >= thr) { i++; continue; }
      let j = i;
      while (j < arr.length && arr[j] < thr) j++;
      if (j - i >= minFrames) out.push({ a: i, b: j });
      i = j;
    }
    return { pauses: out, thr };
  },

  /* 16-bit mono WAV encoder (used for the blind listener pack) */
  wav(samples, rate = SR) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const g = peak > 0 ? 0.89 / peak : 1;
    for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, clamp(samples[i] * g, -1, 1) * 32767, true);
    return new Uint8Array(buf);
  },
};
