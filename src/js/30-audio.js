/* ---------- audio plumbing: context, reading video audio, microphone, recording ---------- */
const AudioEng = {
  ctx: null,
  getCtx() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C({ latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  /* decode any audio/video bytes to mono 16 kHz */
  async decode(arrayBuffer) {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new C(1, SR, SR);
    const ab = await new Promise((res, rej) => {
      const p = off.decodeAudioData(arrayBuffer, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    if (ab.sampleRate === SR && ab.numberOfChannels === 1) return ab.getChannelData(0).slice();
    const ch0 = ab.getChannelData(0);
    let mono = ch0;
    if (ab.numberOfChannels > 1) {
      mono = new Float32Array(ch0.length);
      for (let c = 0; c < ab.numberOfChannels; c++) {
        const d = ab.getChannelData(c);
        for (let i = 0; i < d.length; i++) mono[i] += d[i] / ab.numberOfChannels;
      }
    }
    return DSP.resample(mono, ab.sampleRate, SR);
  },
  async decodeBlob(blob) { return this.decode(await blob.arrayBuffer()); },
};

/* reading a video's soundtrack (needs CORS from the host, a stored copy, or a local file) */
const VideoAudio = {
  cache: new Map(), // videoId -> {status, samples, error, progress}
  state(videoId) { return this.cache.get(videoId) || { status: 'idle' }; },
  async load(video, onProgress) {
    const cur = this.cache.get(video.id);
    if (cur && (cur.status === 'ready' || cur.status === 'loading')) return cur.promise || cur;
    const entry = { status: 'loading', progress: 0 };
    this.cache.set(video.id, entry);
    entry.promise = (async () => {
      try {
        let buf;
        const local = LocalFiles.get(video.id);
        if (local) buf = await local.arrayBuffer();
        else {
          const src = videoSrc(video);
          let resp;
          try {
            resp = await fetch(src, src.startsWith('/') ? { credentials: 'same-origin' } : { mode: 'cors', credentials: 'omit' });
          } catch (e) {
            throw Object.assign(new Error('blocked'), { code: 'blocked' });
          }
          if (!resp.ok) throw Object.assign(new Error(`HTTP ${resp.status}`), { code: 'http' });
          const total = +resp.headers.get('content-length') || 0;
          if (resp.body && total) {
            const reader = resp.body.getReader();
            const parts = [];
            let got = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              parts.push(value); got += value.length;
              entry.progress = got / total;
              onProgress && onProgress(entry.progress);
            }
            const all = new Uint8Array(got);
            let o = 0;
            for (const p of parts) { all.set(p, o); o += p.length; }
            buf = all.buffer;
          } else buf = await resp.arrayBuffer();
        }
        entry.status = 'decoding';
        onProgress && onProgress(1);
        entry.samples = await AudioEng.decode(buf);
        entry.status = 'ready';
      } catch (e) {
        entry.status = 'error';
        entry.error = e.code === 'blocked'
          ? "This video's host doesn't let the app read its sound (no CORS permission, or the page's security rules block it). Playback still works if the video plays. For the waveform and pitch line, load a copy of the video file from this device."
          : e.code === 'http' ? `The video link answered with an error (${e.message}).` : `The sound couldn't be decoded (${e.message || 'unknown error'}).`;
      }
      Bus.emit('videoaudio', video.id);
      return entry;
    })();
    return entry.promise;
  },
  slice(videoId, t0, t1) {
    const e = this.cache.get(videoId);
    if (!e || e.status !== 'ready') return null;
    const a = clamp(Math.floor(t0 * SR), 0, e.samples.length);
    const b = clamp(Math.floor(t1 * SR), 0, e.samples.length);
    return e.samples.subarray(a, b);
  },
};

/* local copies of video files picked on this device (kept for this visit only) */
const LocalFiles = {
  map: new Map(),
  urls: new Map(),
  set(videoId, file) {
    this.map.set(videoId, file);
    const old = this.urls.get(videoId);
    if (old) URL.revokeObjectURL(old);
    this.urls.set(videoId, URL.createObjectURL(file));
    VideoAudio.cache.delete(videoId);
  },
  get(videoId) { return this.map.get(videoId); },
  url(videoId) { return this.urls.get(videoId); },
};

function videoSrc(v) {
  if (!v) return '';
  return LocalFiles.url(v.id) || (v.r2Key ? '/api/files/' + v.r2Key : v.assetId ? '/_blob/' + v.assetId : v.url);
}

/* ---------- microphone ---------- */
const Mic = {
  stream: null, source: null, proc: null, sink: null,
  listeners: new Set(),
  error: null,
  async open() {
    if (this.stream && this.stream.active) return true;
    const s = settings();
    const ctx = AudioEng.getCtx();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error = 'This browser view has no microphone access.';
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: !!s.echoCancellation, noiseSuppression: !!s.noiseSuppression, autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      this.error = e && e.name === 'NotAllowedError'
        ? (Caps.inArtifact
          ? 'Microphone access was refused. Inside a Claude artifact the microphone is blocked; use the website version to record, or upload recordings from your phone.'
          : 'Microphone access was refused. Allow the microphone for this site in your browser’s address bar, then try again.')
        : e && e.name === 'NotFoundError' ? 'No microphone was found.' : `The microphone couldn't start (${(e && e.name) || 'error'}).`;
      return false;
    }
    this.error = null;
    this.source = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.source.connect(this.proc);
    this.proc.connect(this.sink);
    this.sink.connect(ctx.destination);
    let carry = new Float32Array(0);
    this.proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const t = ctx.currentTime - input.length / ctx.sampleRate; // approx. capture time of first sample
      // resample with carry-over so chunks join cleanly
      const joined = new Float32Array(carry.length + input.length);
      joined.set(carry); joined.set(input, carry.length);
      const ratio = ctx.sampleRate / SR;
      const n = Math.floor(joined.length / ratio);
      const out = DSP.resample(joined.subarray(0, Math.floor(n * ratio)), ctx.sampleRate, SR);
      carry = joined.slice(Math.floor(n * ratio));
      for (const fn of this.listeners) fn(out, t);
    };
    return true;
  },
  close() {
    try { this.proc && this.proc.disconnect(); this.source && this.source.disconnect(); this.sink && this.sink.disconnect(); } catch { /* already closed */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = this.source = this.proc = this.sink = null;
  },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

/* a recording: compressed file (for keeping) + 16 kHz samples (for analysis) */
function pickMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const m of opts) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
class Recording {
  constructor() { this.chunks = []; this.pcm = []; this.startCtx = null; this.len = 0; }
  start() {
    const mime = pickMime();
    this.rec = new MediaRecorder(Mic.stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.off = Mic.on((samples, t) => {
      if (this.startCtx == null) this.startCtx = t;
      this.pcm.push(samples); this.len += samples.length;
    });
    this.rec.start(250);
    this.startedAt = performance.now();
  }
  stop() {
    return new Promise((res) => {
      this.off && this.off();
      const finish = () => {
        const all = new Float32Array(this.len);
        let o = 0;
        for (const p of this.pcm) { all.set(p, o); o += p.length; }
        res({ blob: new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' }), samples: all, startCtx: this.startCtx });
      };
      if (this.rec.state === 'inactive') finish();
      else { this.rec.onstop = finish; this.rec.stop(); }
    });
  }
  /* live: samples captured since an index */
  liveSamples() {
    const all = new Float32Array(this.len);
    let o = 0;
    for (const p of this.pcm) { all.set(p, o); o += p.length; }
    return all;
  }
}

/* play a recording / blob URL, returns the element */
const Player2 = {
  el: null,
  async play(ref, { onend } = {}) {
    this.stop();
    const url = typeof ref === 'string' && !ref.includes(':') ? ref : await Store.blobUrl(ref);
    if (!url) { toast("That recording couldn't be found.", 'bad'); return null; }
    const a = new window.Audio(url);
    this.el = a;
    a.onended = () => { onend && onend(); };
    a.play().catch(() => toast("The recording couldn't play in this browser.", 'bad'));
    return a;
  },
  stop() { if (this.el) { this.el.pause(); this.el = null; } },
};

/* tiny event bus */
const Bus = {
  map: new Map(),
  on(ev, fn) { if (!this.map.has(ev)) this.map.set(ev, new Set()); this.map.get(ev).add(fn); },
  emit(ev, ...args) { (this.map.get(ev) || []).forEach((fn) => fn(...args)); },
};
