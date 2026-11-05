/* ---------- analysis panel: pitch / waveform lanes, or the zoomed clip editor ---------- */
const Panel = {
  key: null,
  canvas: null,
  refs: {},
  live: null, // {points:[{t, st, db}]} during a recorded/live pass, clip time
  lastPass: null, // {st:[], db:[], hop, offset, lag, score}
  editor: null, // {w0, w1, db:Float32Array, pauses, thr}
  drag: null,

  onTime(t) {
    if (!this.canvas) return;
    if (this.key && this.key.startsWith('editor')) this.drawEditor(t);
    else if (this.key && this.key.startsWith('clip')) (UI.view === 'pron' ? this.drawPron(t) : this.drawAnalysis(t));
  },
};

function renderPanel() {
  applyLayout();
  const el = $('#panel');
  const vid = Player.current();
  const clip = Store.get('clips', UI.clipId);
  let key;
  if ((UI.sel || (UI.cutMode && !Session.active)) && vid) key = `editor:${(UI.sel && UI.sel.clipId) || 'new'}:${VideoAudio.state(vid.id).status === 'error' ? 'error' : ''}`;
  else if (UI.cutMode && !Session.active) key = 'empty-cut';
  else if (clip) key = `clip:${clip.id}:${Session.active}:${UI.view}:${UI.view === 'pron' ? PronTab.top + ':' + PronTab.noWords + ':' + PronTab.takeKey(clip) : ''}:${UI.overlay}:${!!clip.model}:${Pron.enabled() ? 'p' : ''}:${VideoAudio.state(clip.videoId).status}`;
  else key = UI.cutMode ? 'empty-cut' : 'empty';

  // fade the panel in when it shows another clip or mode (not for a view toggle or an audio status change)
  enterOnChange(el, key.startsWith('clip') ? `clip:${clip.id}:${Session.active}` : key.startsWith('editor') ? `editor:${(UI.sel && UI.sel.clipId) || 'new'}` : key);
  if (key !== Panel.key) {
    Panel.key = key;
    Panel.canvas = null;
    Panel.refs = {};
    if (key.startsWith('empty')) mount(el, panelEmpty());
    else if (key.startsWith('editor')) mount(el, buildEditor(vid));
    else mount(el, buildAnalysis(clip));
  }
  if (key.startsWith('editor')) updateEditor();
  if (key.startsWith('clip')) updateAnalysisHead(clip);
  Panel.onTime(Player.time());
}

function panelEmpty() {
  if (UI.cutMode) return [
    h('div', { class: 'panel-head' }, h('h3', null, t('New clip')), h('span', { class: 'spacer' }), btn(t('Done'), () => setCutMode(false), { size: 'sm', kind: 'ghost', title: t('Leave clip mode (Esc)') })),
    h('div', { class: 'newclip-box' },
      h('p', null, t('Select a part of the video on the scrub bar by dragging along it.')),
      h('p', { class: 'muted' }, t('Or play the video and press Start (I) under the video where the sentence begins, then End (O) where it finishes.')))];
  return h('div', { class: 'panel-msg' },
    h('h3', null, t('Analysis panel')),
    h('p', null, t('Select a clip to see the speaker’s pitch line, or press Cut clips under the video to make a new one.')));
}

/* ---------- analysis view ---------- */
function buildAnalysis(clip) {
  const vid = Store.get('videos', clip.videoId);
  const audio = VideoAudio.state(clip.videoId);
  const pronOk = targetLang() === 'en' && Pron.enabled(); // the pronunciation check is English only for now
  if (UI.view === 'pron' && !pronOk) UI.view = 'pitch';
  const canvas = h('canvas', { class: 'analysis', 'aria-label': UI.overlay ? t('Pitch or loudness of the speaker and you on one chart') : t('Pitch or loudness lanes: speaker on top, you below') });
  Panel.canvas = canvas;
  const head = h('div', { class: 'panel-head' },
    h('div', { class: 'seg', role: 'group', 'aria-label': t('View') },
      h('button', { type: 'button', class: UI.view === 'pitch' ? 'on' : '', onclick: () => { UI.view = 'pitch'; renderPanel(); } }, t('Pitch')),
      h('button', { type: 'button', class: UI.view === 'wave' ? 'on' : '', onclick: () => { UI.view = 'wave'; renderPanel(); } }, t('Waveform')),
      pronOk ? h('button', { type: 'button', class: UI.view === 'pron' ? 'on' : '', onclick: () => { UI.view = 'pron'; renderPanel(); } }, t('Pronunciation')) : null),
    UI.view === 'pron' ? (PronTab.noWords ? null : btn(t('All sounds'), () => setPronTop(PronTab.top === 'phones' ? 'words' : 'phones'), { size: 'sm', on: PronTab.top === 'phones', title: t('Show the sounds under every word, not only where yours differ') })) :
    h('div', { class: 'seg', role: 'group', 'aria-label': t('Layout') },
      h('button', { type: 'button', class: UI.overlay ? '' : 'on', title: t('Speaker on top, you below'), onclick: () => setOverlay(false) }, t('Separate')),
      h('button', { type: 'button', class: UI.overlay ? 'on' : '', title: t('Both lines on one chart'), onclick: () => setOverlay(true) }, t('Overlaid'))),
    h('span', { class: 'lag', id: 'lagLabel' }),
    h('span', { class: 'spacer' }),
    h('span', { class: 'small muted', id: 'relLabel' }),
    !Session.active ? btn(t('Edit clip'), () => editClip(clip.id), { icon: 'scissors', title: t('Change the clip’s start, end, length or label') }) : null,
    btn(clip.noisy ? t('Flagged noisy') : t('Too noisy?'), () => { Store.patch('clips', clip.id, { noisy: !clip.noisy }); toast(clip.noisy ? t('Clip flagged as too noisy. Its pitch line is shown faded.') : t('Noisy flag removed.')); renderPanel(); renderSidebar(); },
      { icon: 'flag', on: clip.noisy, title: t('Flag this clip as too noisy for a reliable pitch line') }));
  if (!clip.model) {
    let msg;
    if (audio.status === 'loading' || audio.status === 'decoding') msg = h('p', null, t('Reading the video’s sound… {pct}', { pct: audio.progress ? Math.round(audio.progress * 100) + '%' : '' }));
    else if (audio.status === 'error') msg = [h('p', null, audio.error), filePickButton(t('Load the video file from this device'), 'video/*,audio/*', (f) => useLocalFile(vid, f), { kind: 'primary', icon: 'folder' })];
    else msg = [h('p', null, t('The model line for this clip hasn’t been worked out yet.')), btn(t('Work it out now'), () => ensureModels(vid).then(renderPanel), { kind: 'primary' })];
    return [head, h('div', { class: 'panel-msg' }, msg), canvas];
  }
  if (UI.view === 'pron') return [head, buildPronView(clip)];
  bindAnalysisCanvas(canvas, clip);
  return [head, canvas];
}

/* not while a pass is running: moving the video would spoil its timing */
function analysisCanScrub() { return !Session.active || !['playing', 'recording', 'gap', 'armed-go'].includes(Session.phase); }
function setPronTop(v) { PronTab.top = v; lsSet('pronTop', v); renderPanel(); }

function setOverlay(on) {
  UI.overlay = on;
  lsSet('overlay', on);
  renderPanel();
}

/* click or drag on the chart to move through the clip (not while a pass is running: that would spoil its timing) */
function bindAnalysisCanvas(canvas, clip) {
  let down = false;
  const canScrub = analysisCanScrub;
  const seekTo = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = clip.start + clamp((e.clientX - r.left) / r.width, 0, 1) * (clip.end - clip.start);
    Player.seek(Math.min(t, clip.end - 0.05));
    // your recording playing alongside follows the video
    if (Session.previewRec && Session.previewRec.clip.id === clip.id) syncRecTo(Player.time());
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!canScrub()) return;
    down = true;
    canvas.setPointerCapture(e.pointerId);
    seekTo(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (down) seekTo(e); });
  const end = () => { down = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function updateAnalysisHead(clip) {
  const lag = $('#lagLabel');
  if (lag) lag.textContent = Panel.lastPass && Panel.lastPass.clipId === clip.id ? (Panel.lastPass.manual ? t('Last pass: {lag} (manual offset)', { lag: fmtLag(Panel.lastPass.lag) }) : t('Last pass: {lag}', { lag: fmtLag(Panel.lastPass.lag) })) : '';
  const rel = $('#relLabel');
  if (rel && clip.model) rel.textContent = clip.model.reliability < 0.55 || clip.noisy ? t('Pitch line unreliable in places') : '';
}

/* tiny "higher / lower" marks so it's clear which way is up on a pitch chart */
function pitchHints(g, W, dpr, lanes, color) {
  g.save();
  g.fillStyle = color;
  g.globalAlpha = 0.75;
  g.font = `500 ${9.5 * dpr}px Rubik, system-ui, sans-serif`;
  g.textAlign = 'right';
  for (const L of lanes) {
    g.fillText(t('▲ higher'), W - 8 * dpr, L.top + 13 * dpr);
    g.fillText(t('▼ lower'), W - 8 * dpr, L.top + L.h - 6 * dpr);
  }
  g.restore();
}

function sizeCanvas(c) {
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  return { W, H, dpr };
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

/* draws the speaker and you either in two lanes, or overlaid on one chart */
Panel.drawAnalysis = function (now) {
  const c = this.canvas;
  const clip = Store.get('clips', UI.clipId);
  if (!c || !clip || !clip.model) return;
  const { W, H, dpr } = sizeCanvas(c);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const dur = clip.end - clip.start;
  const x = (ct) => (ct / dur) * W;
  const ov = !!UI.overlay;
  const spk = cssVar('--speaker'), you = cssVar('--you');
  const lanes = ov
    ? [{ top: 0, h: H, name: t('Speaker'), color: spk }, { top: 0, h: H, name: t('You'), color: you }]
    : [{ top: 0, h: H / 2 - 2 * dpr, name: t('Speaker'), color: spk }, { top: H / 2 + 2 * dpr, h: H / 2 - 2 * dpr, name: t('You'), color: you }];
  const muted = cssVar('--muted'), line = cssVar('--sunk-2');
  g.font = `500 ${11 * dpr}px Rubik, system-ui, sans-serif`;
  for (const L of ov ? lanes.slice(0, 1) : lanes) {
    g.fillStyle = line;
    g.globalAlpha = 0.6;
    g.fillRect(0, L.top + L.h / 2, W, 1 * dpr);
    g.globalAlpha = 1;
  }
  if (ov) {
    // legend: coloured names
    let lx = 8 * dpr;
    for (const L of lanes) {
      g.fillStyle = L.color; g.fillRect(lx, 7 * dpr, 10 * dpr, 4 * dpr);
      g.fillStyle = muted; g.fillText(L.name, lx + 14 * dpr, 14 * dpr);
      lx += g.measureText(L.name).width + 30 * dpr;
    }
  } else for (const L of lanes) { g.fillStyle = muted; g.fillText(L.name, 8 * dpr, L.top + 14 * dpr); }
  if (UI.view === 'pitch') {
    g.fillStyle = muted;
    g.textAlign = 'right';
    if (ov) g.fillText(t('each voice’s own average'), W - 8 * dpr, H / 2 - 5 * dpr);
    else {
      g.fillText(t('speaker’s average'), W - 8 * dpr, lanes[0].top + lanes[0].h / 2 - 5 * dpr);
      g.fillText(t('your average'), W - 8 * dpr, lanes[1].top + lanes[1].h / 2 - 5 * dpr);
    }
    g.textAlign = 'left';
  }
  if (UI.view === 'pitch') pitchHints(g, W, dpr, ov ? [{ top: 0, h: H }] : lanes, muted);
  // time ticks
  g.globalAlpha = 0.5;
  for (let s = 1; s < dur; s++) { g.fillStyle = line; g.fillRect(x(s), 0, 1 * dpr, H); }
  g.globalAlpha = 1;

  const m = clip.model;
  const faded = clip.noisy || m.reliability < 0.4;
  const drawSeries = (L, series, hop, offset, color, alpha = 1, width = 3) => {
    if (UI.view === 'pitch') {
      const range = 12; // ± semitones
      g.strokeStyle = color; g.lineWidth = width * dpr; g.lineJoin = 'round'; g.lineCap = 'round'; g.globalAlpha = alpha;
      g.beginPath();
      let pen = false, prev = null;
      for (let i = 0; i < series.st.length; i++) {
        const v = series.st[i];
        const ct = offset + i * hop;
        // gaps, out-of-range readings and sudden jumps break the line instead of drawing a straight connector
        if (v == null || ct < 0 || ct > dur || Math.abs(v) > range) { pen = false; prev = null; continue; }
        if (prev != null && Math.abs(v - prev) > 4) pen = false;
        prev = v;
        const y = L.top + L.h / 2 - (v / range) * (L.h / 2 - 6 * dpr);
        if (!pen) { g.moveTo(x(ct), y); pen = true; } else g.lineTo(x(ct), y);
      }
      g.stroke();
      g.globalAlpha = 1;
    } else {
      const db = series.db;
      const peak = percentile(db.filter((v) => v != null), 0.98);
      g.fillStyle = color; g.globalAlpha = alpha * (ov ? 0.5 : 0.85);
      const bw = Math.max(1, x(hop) - 0.5);
      for (let i = 0; i < db.length; i++) {
        const ct = offset + i * hop;
        if (db[i] == null || ct < 0 || ct > dur) continue;
        const a = clamp((db[i] - (peak - 45)) / 45, 0, 1);
        const hh = a * (L.h / 2 - 4 * dpr);
        g.fillRect(x(ct), L.top + L.h / 2 - hh, bw, hh * 2);
      }
      g.globalAlpha = 1;
    }
  };
  drawSeries(lanes[0], m, m.hop, 0, lanes[0].color, faded ? 0.45 : 1, 3);

  // you: live trace during a pass, otherwise the last analysed pass for this clip
  if (this.live && this.live.clipId === clip.id && this.live.points.length) {
    const sh = this.live.shift || 0;
    const pts = this.live.points.map((p) => ({ t: p.t - sh, st: p.st, db: p.db }));
    const series = { st: pts.map((p) => p.st), db: pts.map((p) => p.db) };
    // live points are irregular in time; draw as polyline
    if (UI.view === 'pitch') {
      g.strokeStyle = lanes[1].color; g.lineWidth = (ov ? 5.5 : 4) * dpr; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      let pen = false, prevT = -1, prevV = null;
      for (const p of pts) {
        if (p.st == null || p.t < 0 || p.t > dur || p.t - prevT > 0.08 || (prevV != null && Math.abs(p.st - prevV) > 4)) pen = false;
        prevT = p.t;
        prevV = p.st;
        if (p.st == null || p.t < 0 || p.t > dur) continue;
        const L = lanes[1];
        const y = L.top + L.h / 2 - (p.st / 12) * (L.h / 2 - 6 * dpr);
        if (!pen) { g.moveTo(x(p.t), y); pen = true; } else g.lineTo(x(p.t), y);
      }
      g.stroke();
    } else {
      const peak = percentile(series.db, 0.98);
      g.fillStyle = lanes[1].color;
      if (ov) g.globalAlpha = 0.5;
      for (const p of pts) {
        if (p.t < 0 || p.t > dur) continue;
        const a = clamp((p.db - (peak - 45)) / 45, 0, 1);
        const L = lanes[1], hh = a * (L.h / 2 - 4 * dpr);
        g.fillRect(x(p.t), L.top + L.h / 2 - hh, Math.max(1, x(0.012)), hh * 2);
      }
      g.globalAlpha = 1;
    }
  } else if (this.lastPass && this.lastPass.clipId === clip.id) {
    const p = this.lastPass;
    drawSeries(lanes[1], p, p.hop, p.offset, lanes[1].color, ov ? 0.9 : 1, ov ? 5.5 : 4);
  } else {
    g.fillStyle = muted;
    g.textAlign = 'center';
    g.fillText(Mic.error && Session.active ? t('Microphone unavailable') : t('Your line appears here when you record a pass'), W / 2, ov ? H - 12 * dpr : lanes[1].top + lanes[1].h * 0.25);
    g.textAlign = 'left';
  }

  // playhead
  if (now >= clip.start - 0.5 && now <= clip.end + 0.5) {
    g.fillStyle = cssVar('--playhead');
    g.fillRect(x(clamp(now - clip.start, 0, dur)) - dpr, 0, 2 * dpr, H);
  }
};

/* ---------- clip studio: the zoomed waveform under the video ----------
   The waveform shows a fixed stretch of about 30 seconds around the clip (or around the playhead before
   there is a clip), so it keeps its scale while you move the edges. Drag across a sentence to choose it,
   drag a green edge to move it, click to hear from there, and ‹ › move the stretch along the video.
   Whether an edge sits on a word is only checked once you let go, in a line of its own. */
const CUT_SPAN = 30;
function cutWindow() {
  const d = Player.duration() || 0;
  const sel = UI.sel;
  const span = Math.min(d || CUT_SPAN, Math.max(CUT_SPAN, sel ? sel.end - sel.start + 8 : 0));
  let W = UI.cutWin;
  const ok = W && W.vid === UI.videoId && W.v1 - W.v0 >= span - 0.01 && (!sel || (sel.start >= W.v0 && sel.end <= W.v1));
  if (!ok && !Panel.drag) {
    const c = sel ? (sel.start + sel.end) / 2 : Player.time();
    let v0 = Math.max(0, c - span / 2);
    const v1 = Math.min(d || v0 + span, v0 + span);
    v0 = Math.max(0, v1 - span);
    W = UI.cutWin = { vid: UI.videoId, v0, v1 };
  }
  return W;
}
function panCut(dir) {
  const W = cutWindow();
  const d = Player.duration() || W.v1;
  const span = W.v1 - W.v0;
  const v0 = clamp(W.v0 + dir * span * 0.5, 0, Math.max(0, d - span));
  UI.cutWin = { vid: W.vid, v0, v1: v0 + span };
  // a selection the stretch no longer shows would pull it back, so it stays put until you choose again
  UI.cutWin.free = true;
  if (!UI.sel || UI.sel.end < v0 || UI.sel.start > v0 + span) Player.seek(v0 + span * 0.1);
  loadCutAudio(); updateEditor();
}

function buildEditor(vid) {
  const audio = VideoAudio.state(vid.id);
  const canvas = h('canvas', { class: 'editor', 'aria-label': t('Waveform around the clip: drag across a sentence to choose it, or drag the green edges') });
  Panel.canvas = canvas;
  bindEditorCanvas(canvas);
  const R = Panel.refs;
  const nudge = (which, d) => () => {
    if (!UI.sel) return;
    UI.sel[which] = clamp(round(UI.sel[which] + d, 2), 0, Player.duration() || 1e9);
    if (UI.sel.end - UI.sel.start < 0.5) UI.sel[which] -= d;
    updateEditor(); renderScrubber();
  };
  // typed times: m:ss.s or plain seconds
  const applyTyped = (which, raw) => {
    if (!UI.sel) return;
    const v = parseTime(raw);
    if (v == null) { toast(t('Type a time like 3:35.2 or a number of seconds.')); updateEditor(); return; }
    const d = Player.duration() || 1e9;
    if (which === 'start') UI.sel.start = clamp(round(v, 2), 0, UI.sel.end - 0.5);
    else UI.sel.end = clamp(round(v, 2), UI.sel.start + 0.5, d);
    updateEditor(); renderScrubber(); loadCutAudio();
  };
  const timeInput = (which, id, aria) => h('input', { type: 'text', id, class: 'num time-in', inputmode: 'decimal', 'aria-label': aria,
    onchange: (e) => applyTyped(which, e.target.value), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } });
  R.startT = timeInput('start', 'selStart', t('Start@@clip edge'));
  R.endT = timeInput('end', 'selEnd', t('End'));
  R.hint = h('h3', { class: 'cut-hint', role: 'status' });
  R.w0 = h('span', { class: 'small muted num' });
  R.w1 = h('span', { class: 'small muted num' });
  let msg = null;
  if (audio.status === 'error') msg = h('div', { class: 'row small' }, h('p', { class: 'grow muted' }, t('{error} You can still cut the clip with the nudge buttons and by ear.', { error: audio.error })), filePickButton(t('Load the file'), 'video/*,audio/*', (f) => useLocalFile(vid, f), { size: 'sm', icon: 'folder' }));
  const edge = (label, which, input) => h('div', { class: 'cut-edge' }, h('label', { class: 'small muted', for: input.id }, label),
    btn('', nudge(which, -0.1), { size: 'sm', kind: 'ghost', icon: 'chev-left', title: which === 'start' ? t('Start 0.1 s earlier') : t('End 0.1 s earlier') }),
    input,
    btn('', nudge(which, 0.1), { size: 'sm', kind: 'ghost', icon: 'chev-right', title: which === 'start' ? t('Start 0.1 s later') : t('End 0.1 s later') }));
  R.edges = h('div', { class: 'cut-edges' }, edge(t('Start@@clip edge'), 'start', R.startT), edge(t('End'), 'end', R.endT));
  return [
    h('div', { class: 'panel-head' },
      R.hint,
      h('span', { class: 'spacer' }),
      (R.playSel = btn(t('Play clip'), () => togglePlaySelection(), { icon: 'play', size: 'sm', id: 'playSelBtn' })),
      (R.snap = btn(t('Snap to gaps'), () => snapBoth(), { size: 'sm', title: t('Move both edges into the nearest pauses') }))),
    msg,
    canvas,
    h('div', { class: 'cut-foot' },
      btn('', () => panCut(-1), { size: 'sm', kind: 'ghost', icon: 'chev-left', title: t('Show earlier in the video') }), R.w0,
      R.edges,
      R.w1, btn('', () => panCut(1), { size: 'sm', kind: 'ghost', icon: 'chev-right', title: t('Show later in the video') })),
  ];
}

function togglePlaySelection() {
  if (!UI.sel) return;
  if (!Player.v.paused || Player.waitingLoop) { Player.pause(); return; }
  if (Player.time() < UI.sel.start - 0.05 || Player.time() >= UI.sel.end - 0.05) Player.seek(UI.sel.start);
  Player.play();
}
/* keep the editor's play button in step with the player */
function syncPlaySelButton() {
  const b = $('#playSelBtn');
  if (!b) return;
  const playing = !Player.v.paused || Player.waitingLoop;
  const next = btn(playing ? t('Stop') : t('Play clip'), () => togglePlaySelection(), { icon: playing ? 'stop' : 'play', size: 'sm', id: 'playSelBtn', disabled: !UI.sel });
  b.replaceWith(next);
  Panel.refs.playSel = next;
}

/* the sound of the stretch the waveform shows, fetched when it is first needed */
function loadCutAudio() {
  const vid = Player.current();
  if (!vid) return Promise.resolve();
  const W = cutWindow();
  return VideoAudio.ensure(vid, W.v0 - 1, W.v1 + 1).then(() => { Panel.editor = null; updateEditor(); });
}
function editorData(vid) {
  const W = cutWindow();
  const E = Panel.editor;
  if (E && E.vid === vid.id && E.w0 <= W.v0 + 0.01 && E.w1 >= W.v1 - 0.01 && E.ready) return E;
  const W0 = Math.max(0, W.v0 - 1), W1 = Math.min(Player.duration() || W.v1 + 1, W.v1 + 1);
  const x = VideoAudio.slice(vid.id, W0, W1);
  if (!x || x.length < WIN * 2) {
    // not decoded yet: fetch just this stretch, then the editor redraws
    if (VideoAudio.state(vid.id).status !== 'loading' && VideoAudio.state(vid.id).status !== 'error') VideoAudio.ensure(vid, W0, W1).then(() => { Panel.editor = null; updateEditor(); });
    Panel.editor = { vid: vid.id, w0: W0, w1: W1, ready: false };
    return Panel.editor;
  }
  const n = Math.floor((x.length - WIN) / HOP);
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) db[i] = DSP.rmsDb(x, i * HOP, WIN);
  const { pauses, thr } = DSP.pauses(db, 12);
  Panel.editor = { vid: vid.id, w0: W0, w1: W1, db, pauses, thr, ready: true, peak: percentile(Array.from(db), 0.99) };
  return Panel.editor;
}

function edgeOnSpeech(E, tt) {
  if (!E || !E.ready) return false;
  const i = Math.round((tt - E.w0) / HOP_S);
  let loud = 0;
  for (let k = i - 3; k <= i + 3; k++) if (E.db[k] != null && E.db[k] > E.thr + 3) loud++;
  return loud >= 4;
}

/* the nearest pause to an edge, within 2 seconds */
function gapNear(E, which, at) {
  let best = null;
  for (const p of E.pauses) {
    const a = E.w0 + p.a * HOP_S, b = E.w0 + p.b * HOP_S;
    const mid = which === 'start' ? Math.max(a, b - 0.15) : Math.min(b, a + 0.15);
    const d = Math.abs(mid - at);
    if (d < 2 && (!best || d < best.d)) best = { d, t: mid };
  }
  return best;
}
function snapBoth() {
  const vid = Player.current();
  if (!UI.sel || !vid) return;
  const E = editorData(vid);
  if (!E.ready) { toast(t('The waveform isn’t available, so there are no gaps to snap to. Nudge by ear instead.')); return; }
  const s = gapNear(E, 'start', UI.sel.start), e = gapNear(E, 'end', UI.sel.end);
  if (!s && !e) { toast(t('No pause found within 2 seconds of the edges.')); return; }
  const ns = s ? round(s.t, 2) : UI.sel.start, ne = e ? round(e.t, 2) : UI.sel.end;
  if (ne - ns < 1) { toast(t('Snapping there would make the clip too short.')); return; }
  UI.sel.start = ns; UI.sel.end = ne;
  updateEditor(); renderScrubber();
}

function updateEditor() {
  const R = Panel.refs;
  const sel = UI.sel;
  const vid = Player.current();
  updateCutCard();
  if (!R.hint || !vid) return;
  const W = cutWindow();
  R.w0.textContent = fmtTime(W.v0, 1);
  R.w1.textContent = fmtTime(W.v1, 1);
  R.edges.classList.toggle('off', !sel);
  if (sel) {
    if (document.activeElement !== R.startT) R.startT.value = fmtTime(sel.start, 1);
    if (document.activeElement !== R.endT) R.endT.value = fmtTime(sel.end, 1);
  } else { R.startT.value = ''; R.endT.value = ''; }
  R.startT.disabled = R.endT.disabled = !sel;
  R.snap.disabled = !sel;
  if (R.playSel) R.playSel.disabled = !sel;
  const E = editorData(vid);
  // the hint line always has the same height; while an edge is being dragged it keeps its last text
  if (!Panel.drag) {
    let hint = sel ? t('Drag the green edges onto the quiet gaps') : t('Drag across a sentence to choose it');
    let warn = false;
    const audio = VideoAudio.state(vid.id);
    if (!E.ready && (audio.status === 'loading' || audio.status === 'decoding' || !audio.status)) hint = t('Reading the video’s sound…');
    else if (sel && E.ready) {
      const a = edgeOnSpeech(E, sel.start), b = edgeOnSpeech(E, sel.end);
      if (a || b) { warn = true; hint = a && b ? t('Both edges are in the middle of a word') : a ? t('The start is in the middle of a word') : t('The end is in the middle of a word'); }
    }
    R.hint.textContent = hint;
    R.hint.classList.toggle('warn', warn);
  }
  Panel.drawEditor(Player.time());
}

Panel.drawEditor = function (now) {
  const c = this.canvas;
  const vid = Player.current();
  if (!c || !vid || !(UI.sel || UI.cutMode)) return;
  const { W: Wd, H, dpr } = sizeCanvas(c);
  const g = c.getContext('2d');
  g.clearRect(0, 0, Wd, H);
  const sel = UI.sel;
  // before there is a clip the stretch follows the playhead
  if (!sel && !Panel.drag && UI.cutWin && !UI.cutWin.free && (now < UI.cutWin.v0 || now > UI.cutWin.v1)) { UI.cutWin = null; Panel.editor = null; updateEditor(); return; }
  const Wn = cutWindow();
  const v0 = Wn.v0, v1 = Wn.v1;
  const X = (tt) => ((tt - v0) / (v1 - v0)) * Wd;
  const E = editorData(vid);
  g.fillStyle = cssVar('--page');
  g.fillRect(0, 0, Wd, H);
  if (sel) { g.fillStyle = cssVar('--tint'); g.fillRect(X(sel.start), 0, X(sel.end) - X(sel.start), H); }
  if (E.ready) {
    const peak = E.peak;
    const i0 = Math.max(0, Math.floor((v0 - E.w0) / HOP_S)), i1 = Math.min(E.db.length, Math.ceil((v1 - E.w0) / HOP_S));
    // one bar every few pixels, the loudest frame under it
    const step = Math.max(1, Math.round((3 * dpr) / (Wd / Math.max(1, i1 - i0))));
    const inC = cssVar('--green'), outC = cssVar('--muted');
    const bw = Math.max(dpr, (Wd / (i1 - i0)) * step * 0.6);
    for (let i = i0; i < i1; i += step) {
      let m = -200;
      for (let k = i; k < Math.min(i1, i + step); k++) m = Math.max(m, E.db[k]);
      const a = clamp((m - (peak - 48)) / 48, 0, 1);
      const hh = Math.max(dpr, a * (H / 2 - 10 * dpr));
      const tt = E.w0 + i * HOP_S;
      const inside = sel && tt >= sel.start && tt <= sel.end;
      g.fillStyle = inside ? inC : outC;
      g.globalAlpha = inside ? 1 : 0.45;
      g.fillRect(X(tt), H / 2 - hh, bw, hh * 2);
    }
    g.globalAlpha = 1;
  }
  if (sel) {
    // the edges: a line with a handle in the middle
    g.fillStyle = cssVar('--green');
    for (const tt of [sel.start, sel.end]) {
      const xx = X(tt);
      g.fillRect(xx - 1.5 * dpr, 0, 3 * dpr, H);
      const hw = 7 * dpr, hhh = 26 * dpr;
      g.beginPath();
      if (g.roundRect) g.roundRect(xx - hw, H / 2 - hhh / 2, hw * 2, hhh, hw); else g.rect(xx - hw, H / 2 - hhh / 2, hw * 2, hhh);
      g.fill();
    }
  }
  if (now >= v0 && now <= v1) { g.fillStyle = cssVar('--playhead'); g.fillRect(X(now) - dpr, 0, 2 * dpr, H); }
};

function bindEditorCanvas(c) {
  const at = (e) => {
    const r = c.getBoundingClientRect();
    const Wn = cutWindow();
    return { t: clamp(Wn.v0 + ((e.clientX - r.left) / r.width) * (Wn.v1 - Wn.v0), 0, Player.duration() || 1e9), px: (Wn.v1 - Wn.v0) / r.width };
  };
  let down = null;
  c.addEventListener('pointerdown', (e) => {
    if (!Player.current()) return;
    const { t: tt, px } = at(e);
    c.setPointerCapture(e.pointerId);
    if (UI.sel) {
      const ds = Math.abs(tt - UI.sel.start), de = Math.abs(tt - UI.sel.end);
      if (Math.min(ds, de) < px * 14) { Panel.drag = { which: ds < de ? 'start' : 'end' }; return; }
    }
    down = { x: e.clientX, t: tt };
  });
  c.addEventListener('pointermove', (e) => {
    const { t: tt } = at(e);
    if (down && !Panel.drag && Math.abs(e.clientX - down.x) > 6) {
      // dragging across the waveform chooses a new stretch
      UI.sel = { start: Math.min(down.t, tt), end: Math.max(down.t, tt), label: UI.sel ? UI.sel.label : '', clipId: UI.sel ? UI.sel.clipId : undefined };
      UI.clipId = null;
      Panel.drag = { which: tt >= down.t ? 'end' : 'start', anchor: down.t };
      down = null;
      renderCutCard();
    }
    const D = Panel.drag;
    if (!D) { c.style.cursor = UI.sel && Math.min(Math.abs(tt - UI.sel.start), Math.abs(tt - UI.sel.end)) < at(e).px * 14 ? 'ew-resize' : 'crosshair'; return; }
    if (D.anchor != null) { UI.sel.start = round(Math.min(D.anchor, tt), 2); UI.sel.end = round(Math.max(D.anchor, tt), 2); }
    else if (D.which === 'start') UI.sel.start = clamp(round(tt, 2), 0, UI.sel.end - 0.5);
    else UI.sel.end = clamp(round(tt, 2), UI.sel.start + 0.5, Player.duration() || 1e9);
    updateEditor(); renderScrubber();
  });
  const end = () => {
    if (down) { Player.seek(down.t); down = null; }
    if (Panel.drag) {
      Panel.drag = null;
      if (UI.sel && UI.sel.end - UI.sel.start < 0.5) UI.sel.end = UI.sel.start + 0.5;
      if (UI.cutWin) UI.cutWin.free = false;
      renderScrubber(); updateEditor();
    }
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  // a sideways scroll (trackpad) moves the stretch along the video
  c.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const Wn = cutWindow();
    const span = Wn.v1 - Wn.v0, d = Player.duration() || Wn.v1;
    const v0 = clamp(Wn.v0 + (e.deltaX / c.getBoundingClientRect().width) * span, 0, Math.max(0, d - span));
    UI.cutWin = { vid: Wn.vid, v0, v1: v0 + span, free: true };
    clearTimeout(c._wheel);
    c._wheel = setTimeout(() => loadCutAudio(), 200);
    updateEditor();
  }, { passive: false });
}

/* ---------- clip studio: the card beside the video ---------- */
function renderCutCard() {
  const el = $('#cutCard');
  if (!el) return;
  const on = !Session.active && (UI.cutMode || !!UI.sel) && UI.tab === 'library';
  el.hidden = !on;
  if (!on) { el.replaceChildren(); UI.cutCardKey = null; return; }
  const key = `${UI.sel ? 'sel' : 'none'}:${UI.sel && UI.sel.clipId || ''}`;
  if (UI.cutCardKey === key && el.firstChild) { updateCutCard(); return; }
  UI.cutCardKey = key;
  const s = settings();
  const R = (UI.cutRefs = {});
  if (!UI.sel) {
    mount(el, h('div', { class: 'cutcard-in' },
      h('h3', null, t('Choose a sentence')),
      h('p', null, t('Click the timeline under the video to get near it. The waveform below shows the 30 seconds around that point: drag across the sentence there.')),
      h('p', { class: 'small muted' }, t('Or play the video and press Start under it where the sentence begins, then End where it finishes (I and O on the keyboard).'))));
    return;
  }
  const editing = UI.sel.clipId;
  R.len = h('strong', { class: 'cut-len num' });
  R.state = h('span', { class: 'cut-state' });
  R.mark = h('i');
  R.label = h('input', { type: 'text', id: 'clipLabel', placeholder: t('A few words of what’s said'), value: UI.sel.label || '', oninput: (e) => { UI.sel.label = e.target.value; } });
  const top = Math.max(30, s.clipMax * 1.5);
  const pc = (x) => `${clamp(x / top, 0, 1) * 100}%`;
  mount(el, h('div', { class: 'cutcard-in' },
    h('h3', null, editing ? t('Edit clip') : t('Your clip')),
    h('div', { class: 'cut-lenrow' }, R.len, R.state),
    h('div', { class: 'cut-meter', 'aria-hidden': 'true' },
      h('b', { style: { left: pc(s.clipMin), width: `calc(${pc(s.clipMax)} - ${pc(s.clipMin)})` } }), R.mark),
    h('div', { class: 'cut-scale small muted' }, h('span', null, '0 s'), h('span', null, t('aim for {min}–{max} s', { min: s.clipMin, max: s.clipMax })), h('span', null, `${Math.round(top)} s`)),
    h('label', { class: 'field', for: 'clipLabel' }, t('Name (optional)'), R.label),
    btn(editing ? t('Save and practise') : t('Save and practise'), () => saveSelection(true), { kind: 'primary', size: 'big', icon: 'play' }),
    editing ? btn(t('Save changes'), () => saveSelection(false), { icon: 'check' }) : btn(t('Save, cut another'), () => saveSelection('another'), { icon: 'scissors' }),
    btn(t('Cancel'), () => cancelCut(), { kind: 'ghost', size: 'sm', cls: 'self-start', title: t('Discard the selection and leave clip mode (Esc)') })));
  updateCutCard();
}
function updateCutCard() {
  const R = UI.cutRefs;
  const sel = UI.sel;
  if (!R || !R.len || !sel || !R.len.isConnected) return;
  const s = settings();
  const len = sel.end - sel.start;
  const lo = s.clipMin, hi = s.clipMax, slack = Math.max(2, (hi - lo) * 0.25);
  const cls = len >= lo && len <= hi ? 'good' : len >= lo - slack && len <= hi + slack ? 'warn' : 'bad';
  R.len.textContent = fmtSec(len);
  R.state.className = `cut-state ${cls}`;
  R.state.textContent = cls === 'good' ? t('good length') : len < lo ? t('short') : t('long');
  const top = Math.max(30, s.clipMax * 1.5);
  R.mark.style.left = `${clamp(len / top, 0, 1) * 100}%`;
}

/* ---------- clip studio: the line above it ---------- */
function renderStudioHead() {
  const el = $('#studioHead');
  if (!el) return;
  const on = !Session.active && (UI.cutMode || !!UI.sel) && UI.tab === 'library';
  el.hidden = !on;
  if (!on) { el.replaceChildren(); return; }
  const vid = Player.current();
  mount(el,
    h('button', { type: 'button', class: 'linkbtn back', onclick: () => leaveStudio() }, icon('chev-left'), t('Library')),
    h('h2', null, `${UI.sel && UI.sel.clipId ? t('Edit clip') : t('New clip')}${vid ? ` · ${vid.title || t('Untitled video')}` : ''}`));
}
/* back to the library page, leaving the clip unsaved (asks first if there is one) */
function leaveStudio() {
  if (UI.sel && !UI.sel.clipId && !confirm(t('Leave without saving this clip?'))) return;
  UI.sel = null;
  UI.libPage = true;
  if (UI.cutMode) setCutMode(false); else renderAll();
}

function saveSelection(shadowNow) {
  const sel = UI.sel;
  const vid = Player.current();
  if (!sel || !vid) return;
  let clip;
  if (sel.clipId) {
    clip = Store.patch('clips', sel.clipId, { start: round(sel.start, 2), end: round(sel.end, 2), label: (sel.label || '').trim(), model: null, words: null, wordsFor: null, speakerPhones: null });
    toast(t('Clip updated.'), 'good');
  } else {
    clip = Store.put('clips', { videoId: vid.id, start: round(sel.start, 2), end: round(sel.end, 2), label: (sel.label || '').trim(), done: false, archived: false, noisy: false, created: new Date().toISOString() });
    toast(t('Clip saved.'), 'good');
  }
  if (!computeModel(clip)) ensureModels(vid);
  Prep.schedule(clip); // the speaker's sounds and words, in the background, if those features are on
  UI.sel = null;
  if (shadowNow === 'another') {
    // stay in the studio, with the stretch after the saved clip on the waveform
    UI.cutMode = true;
    UI.clipId = null;
    UI.cutWin = null;
    Player.seek(clip.end);
    renderAll(); loadCutAudio();
    return;
  }
  UI.clipId = clip.id;
  UI.cutMode = false;
  renderAll();
  if (shadowNow) Session.start([clip.id]);
}
