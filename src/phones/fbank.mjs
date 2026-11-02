/* Kaldi-style log-mel filterbank, matching lhotse's Fbank as ZIPA's reference script uses it:
   80 bins, 25 ms frames / 10 ms shift, snip_edges=False (reflect padding), dither 0, DC removal,
   pre-emphasis 0.97, Povey window, 512-point FFT, power spectrum, mel 20 Hz..7600 Hz, floor at float eps.
   Waveform is float in [-1, 1] (no 16-bit scaling), same as soundfile gives the reference script. */
const SR = 16000, N = 400, SHIFT = 160, NFFT = 512, NBINS = 80, LOW = 20, HIGH = 8000 - 400;
const EPS = 1.1920929e-7;
const lin2mel = (x) => 1127 * Math.log(1 + x / 700);

let tables = null;
function init() {
  if (tables) return tables;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)), 0.85); // hann(periodic=False)^0.85
  const nfb = NFFT / 2; // 256 bins; the Nyquist column is zero
  const binW = SR / NFFT, mLow = lin2mel(LOW), mHigh = lin2mel(HIGH), delta = (mHigh - mLow) / (NBINS + 1);
  const fb = new Float64Array(NBINS * nfb);
  for (let b = 0; b < NBINS; b++) {
    const l = mLow + b * delta, c = mLow + (b + 1) * delta, r = mLow + (b + 2) * delta;
    for (let k = 0; k < nfb; k++) {
      const m = lin2mel(binW * k);
      fb[b * nfb + k] = Math.max(0, Math.min((m - l) / (c - l), (r - m) / (r - c)));
    }
  }
  const cos = new Float64Array(NFFT / 2), sin = new Float64Array(NFFT / 2);
  for (let i = 0; i < NFFT / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / NFFT); sin[i] = -Math.sin((2 * Math.PI * i) / NFFT); }
  const rev = new Uint16Array(NFFT);
  for (let i = 0, bits = Math.log2(NFFT); i < NFFT; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  return (tables = { win, fb, cos, sin, rev, nfb });
}

function fft(re, im, t) {
  const n = NFFT;
  for (let i = 0; i < n; i++) { const j = t.rev[i]; if (j > i) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; } }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
      const a = i + j, b = a + half;
      const tr = re[b] * t.cos[k] - im[b] * t.sin[k], ti = re[b] * t.sin[k] + im[b] * t.cos[k];
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}

/** samples: Float32Array 16 kHz. Returns { data: Float32Array(frames*80), frames, energy: Float32Array(frames) } where
    energy is the mean log-mel value per frame (a loudness proxy used for silence gating). */
export function fbank(samples) {
  const t = init();
  const n = samples.length;
  const frames = Math.floor((n + SHIFT / 2) / SHIFT);
  if (frames < 1) return { data: new Float32Array(0), frames: 0, energy: new Float32Array(0) };
  const padLeft = (N - SHIFT) >> 1, newN = (frames - 1) * SHIFT + N, padRight = newN - n - padLeft;
  const ext = new Float64Array(newN + 0);
  // reflect: torch.flip(waveform[:padLeft]) on the left, flip(waveform[-padRight:]) on the right
  for (let i = 0; i < padLeft; i++) ext[i] = samples[Math.min(n - 1, padLeft - 1 - i)] || 0;
  for (let i = 0; i < n && padLeft + i < newN; i++) ext[padLeft + i] = samples[i];
  for (let i = 0; i < padRight; i++) { const si = n - 1 - i; ext[padLeft + n + i] = si >= 0 ? samples[si] : 0; }
  const data = new Float32Array(frames * NBINS), energy = new Float32Array(frames);
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT), frame = new Float64Array(N), pow = new Float64Array(t.nfb);
  for (let f = 0; f < frames; f++) {
    const o = f * SHIFT;
    let mean = 0;
    for (let i = 0; i < N; i++) { frame[i] = ext[o + i]; mean += frame[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) frame[i] -= mean;
    for (let i = 0; i < NFFT; i++) { re[i] = 0; im[i] = 0; }
    for (let i = 0; i < N; i++) { const prev = i === 0 ? frame[0] : frame[i - 1]; re[i] = (frame[i] - 0.97 * prev) * t.win[i]; }
    fft(re, im, t);
    for (let k = 0; k < t.nfb; k++) pow[k] = re[k] * re[k] + im[k] * im[k];
    let e = 0;
    for (let b = 0; b < NBINS; b++) {
      let s = 0; const base = b * t.nfb;
      for (let k = 0; k < t.nfb; k++) s += pow[k] * t.fb[base + k];
      const v = Math.log(Math.max(s, EPS));
      data[f * NBINS + b] = v; e += v;
    }
    energy[f] = e / NBINS;
  }
  return { data, frames, energy };
}
export const FBANK = { SR, NBINS, SHIFT_SEC: SHIFT / SR };
