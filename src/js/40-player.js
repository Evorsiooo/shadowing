/* ---------- UI state ---------- */
const UI = {
  videoId: lsGet('videoId', null),
  clipId: null,
  sel: null, // {start, end, clipId?, label}
  view: 'pitch',
  loop: true,
  rate: 1,
  volume: lsGet('volume', 1),
  queue: [],
  drawer: false,
  addOpen: false,
  addForm: { title: '', url: '', speaker: '' },
  editVideoId: null,
  editVideo: null,
  showArchivedClips: false,
  cutMode: false,
  showAllClips: {},
  overlay: lsGet('overlay', false),
};

/* ---------- video player with custom controls ---------- */
const Player = {
  v: null,
  loopTimer: null,
  waitingLoop: false,
  rafOn: false,
  durationKnown: 0,
  tickHooks: new Set(),

  init() {
    this.v = $('#video');
    const v = this.v;
    v.preservesPitch = true; v.mozPreservesPitch = true; v.webkitPreservesPitch = true;
    v.volume = UI.volume;
    v.addEventListener('loadedmetadata', () => { this.durationKnown = v.duration; this.hideError(); renderScrubber(); renderControls(); renderPanel(); });
    v.addEventListener('play', () => { this.startRaf(); renderControls(); syncPlaySelButton(); });
    v.addEventListener('pause', () => { renderControls(); setTimeout(syncPlaySelButton, 0); });
    v.addEventListener('ratechange', () => renderControls());
    v.addEventListener('error', () => this.showError());
    v.addEventListener('timeupdate', () => { if (!this.rafOn) this.paintHead(); });
    this.bindScrubber();
  },

  current() { return Store.get('videos', UI.videoId); },
  load(videoId, { keepClip = false } = {}) {
    if (Session.active && videoId !== UI.videoId) { toast('Finish or end the current session before opening another video.'); return; }
    const vid = Store.get('videos', videoId);
    UI.videoId = vid ? vid.id : null;
    lsSet('videoId', UI.videoId);
    if (!keepClip) { UI.clipId = null; UI.sel = null; }
    this.durationKnown = 0;
    // a stored file is fetched from this device (or downloaded from Drive) before it can play
    const pendingFile = !!(vid && vid.fileRef && !LocalFiles.get(vid.id));
    const src = pendingFile ? '' : videoSrc(vid);
    this.hideError();
    if (!vid || pendingFile) { this.v.removeAttribute('src'); this.v.load(); }
    else if (this.v.getAttribute('src') !== src) { this.v.src = src; this.v.load(); }
    this.v.playbackRate = UI.rate;
    $('#playerEmpty').hidden = !!vid;
    if (!vid) renderPlayerEmpty();
    renderAll();
    if (vid && pendingFile) attachVideoFile(vid);
    else if (vid) ensureModels(vid);
  },
  reloadSrc() {
    const vid = this.current();
    if (!vid) return;
    const t = this.v.currentTime;
    this.v.src = videoSrc(vid);
    this.v.load();
    this.v.addEventListener('loadedmetadata', () => { this.v.currentTime = t; }, { once: true });
  },
  duration() { return isFinite(this.v.duration) && this.v.duration > 0 ? this.v.duration : this.durationKnown || 0; },
  time() { return this.v.currentTime || 0; },

  async play() {
    AudioEng.getCtx();
    try { await this.v.play(); return true; } catch (e) { if (e.name !== 'AbortError') this.showError(e); return false; }
  },
  pause() { this.v.pause(); clearTimeout(this.loopTimer); this.waitingLoop = false; syncPlaySelButton(); },
  toggle() {
    if (Session.active) { Session.togglePause(); return; }
    if (this.v.paused) {
      const r = activeRange();
      if (r && UI.loop && (this.time() < r.start - 0.05 || this.time() >= r.end - 0.05)) this.seek(r.start);
      this.play();
    } else this.pause();
  },
  seek(t) { const d = this.duration(); this.v.currentTime = clamp(t, 0, d || t); this.paintHead(); },
  /* seek and wait until the video has actually landed there (or 1.5 s pass) */
  seekAndWait(t) {
    return new Promise((res) => {
      const v = this.v;
      const done = () => { clearTimeout(timer); v.removeEventListener('seeked', done); res(); };
      const timer = setTimeout(done, 1500);
      v.addEventListener('seeked', done);
      this.seek(t);
      if (Math.abs(v.currentTime - t) < 0.01 && !v.seeking) done();
    });
  },
  replayLoop() {
    const r = activeRange();
    if (!r) { this.seek(Math.max(0, this.time() - 3)); this.play(); return; }
    if (Session.active) { Session.repeatPass(); return; }
    this.seek(r.start); this.play();
  },
  setRate(r) { UI.rate = r; this.v.playbackRate = r; this.v.preservesPitch = true; renderControls(); },
  stepRate(dir) { const rates = [0.5, 0.75, 1]; const i = rates.indexOf(UI.rate); this.setRate(rates[clamp((i < 0 ? 2 : i) + dir, 0, 2)]); },
  setVolume(x) { UI.volume = x; this.v.volume = x; this.v.muted = x === 0; lsSet('volume', x); },

  startRaf() {
    if (this.rafOn) return;
    this.rafOn = true;
    const step = () => {
      this.paintHead();
      this.checkLoop();
      for (const fn of this.tickHooks) fn(this.time());
      if (!this.v.paused || this.waitingLoop || Session.needsTick()) requestAnimationFrame(step);
      else this.rafOn = false;
    };
    requestAnimationFrame(step);
  },
  checkLoop() {
    if (Session.active) return; // the session runs its own passes
    const r = activeRange();
    if (!r || !UI.loop || this.v.paused || this.waitingLoop) return;
    if (this.time() >= r.end - 0.02) {
      this.v.pause();
      this.waitingLoop = true;
      this.loopTimer = setTimeout(() => {
        this.waitingLoop = false;
        const r2 = activeRange();
        if (!r2 || !UI.loop) return;
        this.seek(r2.start); this.play();
      }, settings().loopGap * 1000);
    }
  },
  paintHead() {
    const d = this.duration();
    const t = this.time();
    const pct = d ? (t / d) * 100 : 0;
    $('#scrubProgress').style.width = pct + '%';
    $('#scrubHead').style.left = pct + '%';
    const tl = $('#timeLabel');
    if (tl) tl.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    Panel.onTime(t);
  },

  showError(e) {
    const vid = this.current();
    if (!vid) return;
    const el = $('#playerError');
    const url = vid.url || '';
    const share = /drive\.google|docs\.google|mega\.nz|mega\.io|dropbox\.com\/s\/|youtube\.com|youtu\.be|onedrive|1drv/i.test(url);
    const reason = share
      ? 'This looks like a share page, not a direct video file. Share pages from Google Drive, MEGA, YouTube and similar sites don\'t play here. Use a direct link that ends in .mp4.'
      : vid.fileRef ? 'The saved file didn’t play. This browser may not play its format; an .mp4 file works everywhere.'
      : Caps.inArtifact && !LocalFiles.get(vid.id) && !vid.assetId
        ? 'Inside a Claude artifact, videos from other websites are blocked by the page\'s security rules. Pick the same video file from this device, or store a short copy here (20 MB maximum).'
        : 'The link didn\'t load as a video. Check it opens directly as an .mp4 file in a new tab.';
    mount(el,
      h('h3', null, "This video won't play"),
      h('p', null, reason),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        Store.blobMode === 'device' ? filePickButton('Use a file from this device', 'video/*', (f) => storeVideoCopy(vid, f), { kind: 'primary', icon: 'folder' })
          : filePickButton('Use a file from this device', 'video/*', (f) => useLocalFile(vid, f), { kind: 'primary', icon: 'folder' }),
        Store.blobMode === 'device' ? null
          : Caps.assets && Store.blobMode === 'assets' ? filePickButton('Store a copy (under 20 MB)', 'video/mp4,video/webm', (f) => storeVideoCopy(vid, f), { icon: 'upload' }) : null,
        url ? h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, icon('link'), h('span', { class: 'txt' }, 'Open original link')) : null));
    el.hidden = false;
  },
  hideError() { $('#playerError').hidden = true; },

  /* ---------- scrubber: seek, drag to select, brackets ---------- */
  bindScrubber() {
    const sc = $('#scrubber');
    let down = null;
    const tAt = (x) => { const r = sc.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * this.duration(); };
    // normal mode: press and drag to scrub through the video
    // clip mode: press and drag to select a new clip (a plain click still seeks)
    sc.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.bracket-hit') || !this.duration() || Session.active) return;
      down = { x: e.clientX, t: tAt(e.clientX), drag: false, cut: UI.cutMode };
      sc.setPointerCapture(e.pointerId);
      if (!down.cut) this.seek(down.t);
    });
    sc.addEventListener('pointermove', (e) => {
      const ht = $('#hoverTime');
      const r = sc.getBoundingClientRect();
      if (this.duration()) { ht.hidden = false; ht.style.left = clamp(e.clientX - r.left, 0, r.width) + 'px'; ht.textContent = fmtTime(tAt(e.clientX)); }
      if (!down) return;
      if (!down.drag && Math.abs(e.clientX - down.x) > 6) down.drag = true;
      if (!down.drag) return;
      const t = tAt(e.clientX);
      if (!down.cut) { this.seek(t); return; }
      UI.sel = { start: Math.min(down.t, t), end: Math.max(down.t, t), label: '' };
      UI.clipId = null;
      renderScrubber();
    });
    sc.addEventListener('pointerleave', () => { $('#hoverTime').hidden = true; });
    const end = (e) => {
      if (!down) return;
      const d = down;
      down = null;
      if (!d.cut) return;
      if (d.drag && UI.sel) {
        if (UI.sel.end - UI.sel.start < 1) UI.sel.end = UI.sel.start + Math.max(settings().clipMin, 1);
        this.seek(UI.sel.start);
        renderAll();
        loadSelAudio();
      } else if (e.type === 'pointerup') this.seek(tAt(e.clientX));
    };
    sc.addEventListener('pointerup', end);
    sc.addEventListener('pointercancel', end);
  },
};

function activeRange() {
  if (UI.sel) return { start: UI.sel.start, end: UI.sel.end };
  const c = Store.get('clips', UI.clipId);
  return c ? { start: c.start, end: c.end } : null;
}

function filePickButton(label, accept, onFile, opts = {}) {
  const input = h('input', { type: 'file', accept, hidden: true, onchange: () => { const f = input.files[0]; if (f) onFile(f); input.value = ''; } });
  const b = btn(label, () => input.click(), opts);
  return h('span', { style: { display: 'contents' } }, b, input);
}

function useLocalFile(vid, file) {
  LocalFiles.set(vid.id, file);
  Player.reloadSrc();
  Player.hideError();
  toast(`Playing “${file.name}” from this device. Pick it again next visit.`, 'good');
  ensureModels(vid).then(() => renderPanel());
  loadSelAudio();
}

async function storeVideoCopy(vid, file) {
  if (Store.blobMode === 'device') {
    toast('Saving the file on this device…');
    try {
      const old = Media.idOf(vid.fileRef);
      const ref = await Media.add(file, { kind: 'video', name: file.name });
      Store.patch('videos', vid.id, { fileRef: ref, size: file.size });
      if (old) Media.remove(old);
      LocalFiles.set(vid.id, file);
      Player.reloadSrc();
      Player.hideError();
      ensureModels(vid);
      toast(Drive.connected() ? 'Saved. It’s uploading to your Google Drive for your other devices.' : 'Saved on this device.', 'good');
    } catch (e) { toast(`The file couldn’t be saved (${e.message || e.name}).`, 'bad', 7000); }
    return;
  }
  if (file.size > 20 * 1024 * 1024) { toast(`That file is ${(file.size / 1048576).toFixed(1)} MB. Stored copies must be under 20 MB; cut a shorter section first, or use "Use a file from this device".`, 'bad', 8000); return; }
  toast('Uploading a copy…');
  try {
    const r = await Caps.assets.upload(file, { type: /webm/.test(file.type) ? 'video/webm' : 'video/mp4' });
    Store.patch('videos', vid.id, { assetId: r.id });
    VideoAudio.cache.delete(vid.id);
    Player.reloadSrc();
    toast('Copy stored. It will play on every device.', 'good');
  } catch (e) {
    toast(`Upload failed (${e.code || 'error'}). ${e.code === 'quota_or_state' ? 'Storage is full.' : ''}`, 'bad');
  }
}

/* ---------- render: controls row ---------- */
function renderControls() {
  const v = Player.v;
  const playing = v && !v.paused;
  const vid = Player.current();
  const dis = !vid;
  const volIcon = UI.volume === 0 ? 'mute' : 'volume';
  mount($('#ctrlRow'),
    btn('', () => Player.toggle(), { icon: playing ? 'pause' : 'play', title: playing ? 'Pause (Space)' : 'Play (Space)', disabled: dis }),
    btn('', () => Player.replayLoop(), { icon: 'replay', title: 'Replay the loop (R)', disabled: dis }),
    h('span', { class: 'time', id: 'timeLabel' }, `${fmtTime(Player.time())} / ${fmtTime(Player.duration())}`),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' },
      [0.5, 0.75, 1].map((r) => h('button', { type: 'button', class: UI.rate === r ? 'on' : '', onclick: () => Player.setRate(r), title: 'Speed (, and .)' }, `${r}x`))),
    btn('Loop', () => { UI.loop = !UI.loop; renderControls(); }, { icon: 'loop', on: UI.loop, pressed: UI.loop, title: 'Loop the clip (L)', aria: 'Loop', id: 'loopBtn' }),
    btn('', () => Player.setVolume(UI.volume === 0 ? 1 : 0), { icon: volIcon, title: 'Mute' }),
    h('input', { type: 'range', class: 'vol', min: 0, max: 1, step: 0.05, value: UI.volume, 'aria-label': 'Volume', oninput: (e) => Player.setVolume(+e.target.value) }),
    h('span', { class: 'spacer' }),
    Session.active ? null : btn('Cut clips', () => setCutMode(!UI.cutMode), { icon: 'scissors', on: UI.cutMode, pressed: UI.cutMode, title: 'Clip mode: drag on the timeline to select a new clip (C)', aria: 'Cut clips', id: 'cutBtn', disabled: dis }),
    UI.cutMode ? btn('Start', () => markEdge('start'), { title: 'Mark clip start at the playhead (I or [)', disabled: dis || Session.active }) : null,
    UI.cutMode ? btn('End', () => markEdge('end'), { title: 'Mark clip end at the playhead (O or ])', disabled: dis || Session.active }) : null,
    btn('', () => openShortcuts(), { icon: 'keyboard', title: 'Keyboard shortcuts (?)', id: 'kbBtn' }));
}

/* Cancel / Esc while cutting: drop the selection and leave clip mode in one go */
function cancelCut() {
  UI.sel = null;
  if (UI.cutMode) setCutMode(false); else renderAll();
}

function setCutMode(on) {
  if (Session.active && on) return;
  UI.cutMode = on;
  if (!on && UI.sel && !UI.sel.clipId) UI.sel = null;
  $('#player').classList.toggle('cutting', on);
  if (on) toast('Clip mode: drag on the timeline to select a clip, or press I and O while it plays.');
  renderAll();
}

function markEdge(which) {
  if (!Player.current() || Session.active) return;
  if (!UI.cutMode) { UI.cutMode = true; $('#player').classList.add('cutting'); }
  const t = Player.time();
  const s = settings();
  if (!UI.sel) {
    const c = Store.get('clips', UI.clipId);
    UI.sel = which === 'start' ? { start: t, end: Math.min(Player.duration() || t + s.clipMax, t + (s.clipMin + s.clipMax) / 2), label: '' }
      : { start: Math.max(0, t - (s.clipMin + s.clipMax) / 2), end: t, label: '' };
    if (c) UI.clipId = null;
  } else if (which === 'start') {
    UI.sel.start = t;
    if (UI.sel.end <= t) UI.sel.end = t + s.clipMin;
  } else {
    UI.sel.end = t;
    if (UI.sel.start >= t) UI.sel.start = Math.max(0, t - s.clipMin);
  }
  toast(which === 'start' ? `Clip start marked at ${fmtTime(t, 1)}` : `Clip end marked at ${fmtTime(t, 1)}`);
  renderScrubber(); renderPanel();
  loadSelAudio();
}

/* ---------- render: scrubber brackets ---------- */
function renderScrubber() {
  const d = Player.duration();
  const box = $('#scrubClips');
  const clips = videoClips(UI.videoId).filter((c) => !c.archived);
  const pct = (t) => (d ? (t / d) * 100 : 0);
  mount(box, d ? clips.map((c, i) => {
    const left = pct(c.start), width = Math.max(pct(c.end) - pct(c.start), 0);
    const sel = c.id === UI.clipId;
    return [
      h('button', { type: 'button', class: 'bracket-hit', style: { left: `calc(${left}% - 4px)`, width: `calc(max(${width}%, 12px) + 8px)` }, title: `${clipName(c, i)} · ${fmtTime(c.start)}–${fmtTime(c.end)}${c.done ? ' · done' : ''}`, 'aria-label': `Select ${clipName(c, i)}`, onclick: () => selectClip(c.id) }),
      h('div', { class: `bracket ${sel ? 'sel' : ''}`, style: { left: left + '%', width: `max(${width}%, 12px)` } }),
      c.done ? h('div', { class: 'bracket-tick', style: { left: (left + width / 2) + '%' } }, icon('check', 'stroke-width="3.4"')) : null,
    ];
  }) : null);
  const sb = $('#scrubSel');
  if (UI.sel && d) { sb.hidden = false; sb.style.left = pct(UI.sel.start) + '%'; sb.style.width = Math.max(0.3, pct(UI.sel.end) - pct(UI.sel.start)) + '%'; }
  else sb.hidden = true;
  Player.paintHead();
}

function renderPlayerEmpty() {
  const any = Store.all('videos').some((v) => !v.archived);
  mount($('#playerEmpty'),
    h('h2', null, any ? 'Pick a video from your library' : 'Add your first video'),
    h('p', null, any ? 'Open a video on the right, then choose a clip, or press Cut clips to make a new one.' : 'Pick a video of someone with the accent you want: an interview or a talk where one person speaks clearly works best.'),
    btn(any ? 'Open the library' : 'Add a video', () => { UI.addOpen = !any; openDrawer(); renderSidebar(); setTimeout(() => { const f = $('#addUrl'); if (f) f.focus(); }, 60); }, { kind: 'primary', size: 'big', icon: any ? 'menu' : 'plus' }));
}

/* ---------- clip helpers ---------- */
function videoClips(videoId) {
  return Store.all('clips').filter((c) => c.videoId === videoId).sort((a, b) => a.start - b.start);
}
function clipName(c, idx) {
  if (c.label) return c.label;
  const list = videoClips(c.videoId);
  const i = idx != null ? idx : list.findIndex((x) => x.id === c.id);
  return `Clip ${i + 1} (${fmtTime(c.start)})`;
}
function selectClip(id, { seek = true, play = false } = {}) {
  if (Session.active && Session.clipId !== id) { toast('Finish or end the current session first.'); return; }
  const c = Store.get('clips', id);
  if (!c) return;
  if (c.videoId !== UI.videoId) Player.load(c.videoId, { keepClip: true });
  UI.clipId = id;
  UI.sel = null;
  if (seek) Player.seek(c.start);
  if (play) Player.play();
  renderAll();
  if (!c.model) ensureModels(Store.get('videos', c.videoId));
}
function editClip(id) {
  const c = Store.get('clips', id);
  if (!c || Session.active) return;
  if (c.videoId !== UI.videoId) Player.load(c.videoId, { keepClip: true });
  UI.clipId = null;
  UI.sel = { start: c.start, end: c.end, clipId: c.id, label: c.label || '' };
  Player.seek(c.start);
  renderAll();
  loadSelAudio();
}

/* work out (and store) the model line for clips that don't have one yet */
async function ensureModels(vid) {
  if (!vid) return;
  const missing = videoClips(vid.id).filter((c) => !c.model && !c.archived);
  for (const c of missing) {
    // only the clip's own stretch of audio is fetched and decoded
    const st = await VideoAudio.ensure(vid, c.start, c.end);
    if (!st || st.status === 'error') break;
    await sleep(10);
    computeModel(Store.get('clips', c.id) || c);
  }
  renderPanel();
}
/* audio around the selection being edited (the zoomed editor shows a margin either side) */
function loadSelAudio() {
  const vid = Player.current();
  if (!vid || !UI.sel) return Promise.resolve();
  return VideoAudio.ensure(vid, UI.sel.start - 4, UI.sel.end + 4).then(() => renderPanel());
}

function computeModel(c) {
  const x = VideoAudio.slice(c.videoId, c.start, c.end);
  if (!x || x.length < SR) return false;
  const m = DSP.modelFromSamples(x, settings().pitchSmoothing);
  m.start = c.start; m.end = c.end; m.at = new Date().toISOString();
  Store.patch('clips', c.id, { model: m });
  return true;
}
