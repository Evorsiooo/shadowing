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
  cache: new Map(), // videoId -> {status, segments: [{t0, t1, samples}], full, error, progress, mp4Failed, chain}
  state(videoId) { return this.cache.get(videoId) || { status: 'idle' }; },
  entry(videoId) {
    if (!this.cache.has(videoId)) this.cache.set(videoId, { status: 'idle', segments: [], full: null, chain: Promise.resolve() });
    return this.cache.get(videoId);
  },
  /* samples for [t0, t1] if already decoded, else null */
  slice(videoId, t0, t1) {
    const e = this.cache.get(videoId);
    if (!e) return null;
    if (e.full) {
      const a = clamp(Math.floor(t0 * SR), 0, e.full.length), b = clamp(Math.floor(t1 * SR), 0, e.full.length);
      return e.full.subarray(a, b);
    }
    const seg = e.segments.find((g) => g.t0 <= t0 + 0.02 && g.t1 >= t1 - 0.02);
    if (!seg) return null;
    const a = clamp(Math.round((t0 - seg.t0) * SR), 0, seg.samples.length), b = clamp(Math.round((t1 - seg.t0) * SR), 0, seg.samples.length);
    return seg.samples.subarray(a, b);
  },
  /* make sure [t0, t1] is decoded: reads only that stretch of an MP4; falls back to the whole file */
  ensure(video, t0, t1, onProgress) {
    const e = this.entry(video.id);
    t0 = Math.max(0, t0);
    const job = e.chain.then(async () => {
      if (this.slice(video.id, t0, t1)) return e;
      e.status = 'loading'; e.progress = 0;
      Bus.emit('videoaudio', video.id);
      const local = LocalFiles.get(video.id);
      const src = local || videoSrc(video);
      if (!e.mp4Failed) {
        // a little extra either side, so small edge nudges don't need another fetch
        const want0 = Math.max(0, t0 - 1), want1 = t1 + 1;
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const r = await Mp4Audio.extract(`${video.id}|${local ? local.name : src}`, src, want0, want1, (f) => { e.progress = f; onProgress && onProgress(f); });
            // pad with silence where the file has no audio (before the track starts, past the end), so the span is fully covered
            const pre = Math.max(0, Math.round((r.t0 - want0) * SR)), post = Math.max(0, Math.round((want1 - r.t1) * SR));
            const samples = new Float32Array(pre + r.samples.length + post);
            samples.set(r.samples, pre);
            e.segments.push({ t0: Math.min(want0, r.t0), t1: Math.max(want1, r.t1), samples });
            if (e.segments.length > 24) e.segments.shift();
            e.status = 'ready'; e.error = null; e.method = 'partial'; e.via = r.via;
            Bus.emit('videoaudio', video.id);
            return e;
          } catch (err) {
            lastErr = err;
            if (err.permanent) break;
            await sleep(600 * (attempt + 1)); // a network blip: try again rather than falling back to the whole file
          }
        }
        if (!lastErr.permanent) {
          e.status = 'error';
          e.error = t('Couldn’t read the video’s sound ({msg}). Try again in a moment.', { msg: lastErr.message || t('network error') });
          Bus.emit('videoaudio', video.id);
          return e;
        }
        e.mp4Failed = lastErr.message || String(lastErr);
        console.info('partial audio read unavailable, decoding the whole file:', e.mp4Failed);
      }
      // reading the whole file is only sensible for small files; a long video would mean downloading hundreds of MB
      const size = local ? 0 : video.size || 0;
      if (size > 150 * 1024 * 1024) {
        e.status = 'error';
        e.error = t('This video’s sound can’t be read in pieces in this browser ({reason}), and the file is too big ({mb} MB) to read whole. Chrome or Edge can read it.', { reason: e.mp4Failed, mb: Math.round(size / 1048576) });
        Bus.emit('videoaudio', video.id);
        return e;
      }
      await this.decodeWhole(video, e, onProgress);
      Bus.emit('videoaudio', video.id);
      return e;
    });
    e.chain = job.catch(() => {});
    return job;
  },
  async decodeWhole(video, entry, onProgress) {
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
      entry.full = await AudioEng.decode(buf);
      entry.status = 'ready'; entry.error = null; entry.method = 'whole';
    } catch (e) {
      entry.status = 'error';
      entry.error = e.code === 'blocked'
        ? t('This video’s host doesn’t let the app read its sound (no CORS permission, or the page’s security rules block it). Playback still works if the video plays. For the waveform and pitch line, load a copy of the video file from this device.')
        : e.code === 'http' ? t('The video link answered with an error ({msg}).', { msg: e.message }) : t('The sound couldn’t be decoded ({msg}).', { msg: e.message || t('unknown error') });
    }
  },
};

/* video files open in this visit: picked on this device, or read from device storage (17-media.js) */
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
  // a stored file (fileRef) plays once attachVideoFile() has put it in LocalFiles
  return LocalFiles.url(v.id) || (v.fileRef ? '' : v.assetId ? '/_blob/' + v.assetId : v.url);
}

/* ---------- microphone ---------- */
const Mic = {
  stream: null, source: null, gain: null, proc: null, sink: null, dest: null,
  listeners: new Set(),
  error: null,
  level: -100, // last chunk's loudness (dBFS, after gain)
  speech: null, // running estimate of speech loudness, for automatic gain
  async open() {
    if (this.stream && this.stream.active) return true;
    const s = settings();
    const ctx = AudioEng.getCtx();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error = t('This browser view has no microphone access.');
      return false;
    }
    try {
      // echo cancellation stays off: shadowing means talking over the clip the whole time, and the
      // browser's canceller then turns your voice down too, so headphones are the only good option
      const audio = { echoCancellation: false, noiseSuppression: !!s.noiseSuppression, autoGainControl: !!s.micAuto, channelCount: 1 };
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: s.micDeviceId ? { ...audio, deviceId: { exact: s.micDeviceId } } : audio });
      } catch (e) {
        // the chosen mic is unplugged: fall back to the default one
        if (!s.micDeviceId || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) throw e;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio });
        toast(t('Your chosen microphone isn’t connected, so the default one is being used.'));
      }
    } catch (e) {
      this.error = e && e.name === 'NotAllowedError'
        ? (Caps.inArtifact
          ? t('Microphone access was refused. Inside a Claude artifact the microphone is blocked; use the website version to record, or upload recordings from your phone.')
          : t('Microphone access was refused. Allow the microphone for this site in your browser’s address bar, then try again.'))
        : e && e.name === 'NotFoundError' ? t('No microphone was found.') : t('The microphone couldn’t start ({name}).', { name: (e && e.name) || 'error' });
      return false;
    }
    this.error = null;
    // mic → gain (sensitivity) → analysis + recording
    this.source = ctx.createMediaStreamSource(this.stream);
    this.gain = ctx.createGain();
    this.gain.gain.value = s.micAuto ? (this.autoGain || 1) : s.micGain;
    this.dest = ctx.createMediaStreamDestination();
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.source.connect(this.gain);
    this.gain.connect(this.proc);
    this.gain.connect(this.dest);
    this.proc.connect(this.sink);
    this.sink.connect(ctx.destination);
    let carry = new Float32Array(0);
    this.proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const t = ctx.currentTime - input.length / ctx.sampleRate; // approx. capture time of first sample
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      this.level = 20 * Math.log10(Math.sqrt(sum / input.length) + 1e-6);
      this.adapt();
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
  /* automatic sensitivity: nudge the gain so speech sits around -20 dBFS */
  adapt() {
    if (!this.gain || !settings().micAuto) return;
    const lvl = this.level;
    const g = this.gain.gain.value;
    const raw = lvl - 20 * Math.log10(g); // level before our gain
    // background noise: follows quiet chunks fast, loud ones very slowly
    this.noise = this.noise == null ? raw : raw < this.noise ? this.noise * 0.7 + raw * 0.3 : this.noise * 0.998 + raw * 0.002;
    if (lvl < -65 || raw < this.noise + 12) return; // only speech, well above the room's noise, sets the volume
    // follow loud stretches quickly, quiet ones slowly, so only speech sets the level
    this.speech = this.speech == null ? raw : raw > this.speech ? this.speech * 0.7 + raw * 0.3 : this.speech * 0.995 + raw * 0.005;
    const want = clamp(10 ** ((-20 - this.speech) / 20), 1, 30);
    const next = g + (want - g) * 0.08;
    this.gain.gain.value = next;
    this.autoGain = next;
  },
  async reopen() {
    const listeners = this.listeners;
    const wasOpen = !!this.stream;
    this.close();
    this.listeners = listeners;
    if (wasOpen) await this.open();
  },
  async devices() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch { return []; }
  },
  setGain(x) {
    if (this.gain) this.gain.gain.value = x;
  },
  /* stream for MediaRecorder: the boosted signal when available */
  recordStream() { return this.dest ? this.dest.stream : this.stream; },
  close() {
    try { [this.proc, this.source, this.gain, this.sink].forEach((n) => n && n.disconnect()); } catch { /* already closed */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = this.source = this.gain = this.proc = this.sink = this.dest = null;
    this.level = -100;
    this.noise = null;
  },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

/* a small mic control: live level meter, automatic volume on/off, manual boost */
function micControl() {
  const s = settings();
  const fill = h('i', { style: { width: '0%' } });
  const meter = h('div', { class: 'bar mic-meter', title: t('Microphone level') }, fill);
  const val = h('span', { class: 'small muted num' });
  const slider = h('input', { type: 'range', id: 'micGain', min: 0.5, max: 12, step: 0.5, value: s.micGain, 'aria-label': t('Microphone boost'), disabled: s.micAuto,
    oninput: (e) => { const x = +e.target.value; saveSettings({ micGain: x }); Mic.setGain(x); val.textContent = `${x}x`; } });
  val.textContent = s.micAuto ? t('auto') : `${s.micGain}x`;
  const auto = h('label', { class: 'check', for: 'micAuto' }, h('input', { type: 'checkbox', id: 'micAuto', checked: s.micAuto, onchange: (e) => {
    saveSettings({ micAuto: e.target.checked });
    slider.disabled = e.target.checked;
    val.textContent = e.target.checked ? t('auto') : `${settings().micGain}x`;
    if (!e.target.checked) Mic.setGain(settings().micGain);
    if (Mic.stream) toast(t('Re-open the microphone (next pass) for the browser part of automatic volume to change.'));
  } }), t('Automatic volume'));
  const pick = h('select', { id: 'micDevice', 'aria-label': t('Microphone'), class: 'mic-select', onchange: async (e) => {
    saveSettings({ micDeviceId: e.target.value || null });
    if (Mic.stream) {
      if (Session.rec) { toast(t('The new microphone is used from the next pass.')); return; }
      await Mic.reopen();
    }
  } }, h('option', { value: '' }, t('Default microphone')));
  const fillDevices = async () => {
    const list = await Mic.devices();
    const cur = settings().micDeviceId || '';
    mount(pick, h('option', { value: '' }, t('Default microphone')),
      list.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || t('Microphone {n}', { n: i + 1 }))));
  };
  fillDevices();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { if (pick.isConnected) fillDevices(); });
  pick.addEventListener('focus', fillDevices); // names appear once the browser has mic permission
  const el = h('div', { class: 'mic-control' }, icon('mic'), pick, meter, auto, slider, val);
  const tick = () => {
    if (!el.isConnected) return;
    const pct = clamp((Mic.level + 60) / 60, 0, 1) * 100;
    fill.style.width = pct + '%';
    fill.style.background = Mic.level > -3 ? 'var(--red)' : Mic.level > -35 ? 'var(--green)' : 'var(--wattle)';
    if (settings().micAuto && Mic.gain) val.textContent = `auto ${fmtNum(Mic.gain.gain.value, 1)}x`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return el;
}

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
    this.rec = new MediaRecorder(Mic.recordStream(), mime ? { mimeType: mime } : undefined);
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
}

/* your recordings play back at the original clip's loudness (when "Match the original's loudness" is on),
   times your own volume slider, so a boosted microphone doesn't blast in your ears */
const MineLevel = {
  get auto() { return lsGet('mineAuto', true); },
  get volume() { return lsGet('mineVolume', 1); },
  set(fields) {
    if ('auto' in fields) lsSet('mineAuto', !!fields.auto);
    if ('volume' in fields) lsSet('mineVolume', fields.volume);
  },
  /* gain that brings a recording's speech up or down to the speaker's level in the clip */
  levelGain(analysis, clip) {
    const loud = (db) => { const v = (db || []).filter((x) => x != null && isFinite(x) && x > -90); return v.length > 20 ? percentile(v, 0.9) : null; };
    const mine = analysis && loud(analysis.db);
    const theirs = clip && clip.model && loud(clip.model.db);
    if (mine == null || theirs == null) return 1;
    // the video is heard at the player's volume, so match that too (unless it's muted)
    const player = UI.volume > 0 ? UI.volume : 1;
    return clamp(10 ** ((theirs - mine) / 20) * player, 0.05, 6);
  },
  gain(analysis, clip) { return (this.auto ? this.levelGain(analysis, clip) : 1) * this.volume; },
  /* route an <audio> element through a gain node (it can then go louder than its own volume allows) */
  attach(a, gain) {
    try {
      const ctx = AudioEng.getCtx();
      const g = ctx.createGain();
      g.gain.value = gain;
      ctx.createMediaElementSource(a).connect(g).connect(ctx.destination);
      a._gain = g;
    } catch { a.volume = clamp(gain, 0, 1); }
    return a;
  },
  setGain(a, gain) { if (!a) return; if (a._gain) a._gain.gain.value = gain; else a.volume = clamp(gain, 0, 1); },
};

/* play a recording / blob URL, returns the element */
const Player2 = {
  el: null,
  gainFn: null, // works out this recording's playback gain from the current volume settings
  async play(ref, { onend } = {}) {
    this.stop();
    const url = typeof ref === 'string' && !ref.includes(':') ? ref : await Store.blobUrl(ref);
    if (!url) { toast(t('That recording couldn’t be found.'), 'bad'); return null; }
    const a = new window.Audio(url);
    this.el = a;
    a.onended = () => { onend && onend(); };
    a.play().catch(() => toast(t('The recording couldn’t play in this browser.'), 'bad'));
    return a;
  },
  stop() { if (this.el) { this.el.pause(); this.el = null; } },
  /* volume settings changed: apply them to what's playing now */
  relevel() { if (this.el && this.gainFn) MineLevel.setGain(this.el, this.gainFn()); },
};

/* tiny event bus */
const Bus = {
  map: new Map(),
  on(ev, fn) { if (!this.map.has(ev)) this.map.set(ev, new Set()); this.map.get(ev).add(fn); },
  emit(ev, ...args) { (this.map.get(ev) || []).forEach((fn) => fn(...args)); },
};
