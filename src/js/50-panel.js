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
  if (UI.sel && vid) key = `editor:${UI.sel.clipId || 'new'}:${VideoAudio.state(vid.id).status}`;
  else if (UI.cutMode && !Session.active) key = 'empty-cut';
  else if (clip) key = `clip:${clip.id}:${Session.active}:${UI.view}:${UI.view === 'pron' ? PronTab.top + ':' + PronTab.noWords + ':' + PronTab.takeKey(clip) : ''}:${UI.overlay}:${!!clip.model}:${Pron.enabled() ? 'p' : ''}:${VideoAudio.state(clip.videoId).status}`;
  else key = UI.cutMode ? 'empty-cut' : 'empty';

  // fade the panel in when it shows another clip or mode (not for a view toggle or an audio status change)
  enterOnChange(el, key.startsWith('clip') ? `clip:${clip.id}:${Session.active}` : key.startsWith('editor') ? `editor:${UI.sel.clipId || 'new'}` : key);
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
    UI.view === 'pron' ? h('div', { class: 'seg', role: 'group', 'aria-label': t('Which row is big') },
      h('button', { type: 'button', class: PronTab.top !== 'phones' && !PronTab.noWords ? 'on' : '', disabled: PronTab.noWords || null, title: PronTab.noWords ? t('No words for this clip, only sounds') : t('Words big, sounds small'), onclick: () => setPronTop('words') }, t('Words')),
      h('button', { type: 'button', class: PronTab.top === 'phones' || PronTab.noWords ? 'on' : '', title: t('Sounds big, words small'), onclick: () => setPronTop('phones') }, t('Phones'))) :
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

/* ---------- zoomed clip editor ---------- */
const MARGIN = 1.5;
function buildEditor(vid) {
  const s = settings();
  const audio = VideoAudio.state(vid.id);
  const canvas = h('canvas', { class: 'editor', 'aria-label': t('Zoomed waveform of the selection; drag the yellow edges onto quiet gaps') });
  Panel.canvas = canvas;
  bindEditorCanvas(canvas);
  const R = Panel.refs;
  const nudge = (which, d) => () => {
    UI.sel[which] = clamp(round(UI.sel[which] + d, 2), 0, Player.duration() || 1e9);
    if (UI.sel.end - UI.sel.start < 0.5) UI.sel[which === 'start' ? 'start' : 'end'] -= d;
    Panel.editor = null; updateEditor(); renderScrubber();
  };
  R.len = h('span', { class: 'len' });
  R.warn = h('div', { class: 'warnline', role: 'status' });
  // typed times: m:ss.s or plain seconds; length moves the end
  const applyTyped = (which, raw) => {
    const v = parseTime(raw);
    if (v == null) { toast(t('Type a time like 3:35.2 or a number of seconds.')); updateEditor(); return; }
    const d = Player.duration() || 1e9;
    if (which === 'start') UI.sel.start = clamp(round(v, 2), 0, UI.sel.end - 0.5);
    else if (which === 'end') UI.sel.end = clamp(round(v, 2), UI.sel.start + 0.5, d);
    else UI.sel.end = clamp(round(UI.sel.start + Math.max(0.5, v), 2), UI.sel.start + 0.5, d);
    Panel.editor = null; updateEditor(); renderScrubber(); loadSelAudio();
  };
  const timeInput = (which, id, aria) => h('input', { type: 'text', id, class: 'num time-in', inputmode: 'decimal', 'aria-label': aria,
    onchange: (e) => applyTyped(which, e.target.value), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } });
  R.startT = timeInput('start', 'selStart', t('Start@@clip edge'));
  R.endT = timeInput('end', 'selEnd', t('End'));
  R.lenT = timeInput('length', 'selLen', t('Length (s)'));
  R.label = h('input', { type: 'text', id: 'clipLabel', placeholder: t('A few words of what’s said (optional)'), value: UI.sel.label || '', oninput: (e) => { UI.sel.label = e.target.value; } });
  let msg = null;
  if (audio.status === 'loading' || audio.status === 'decoding') msg = h('p', { class: 'small muted', id: 'audioMsg' }, t('Reading the video’s sound for the zoomed waveform…'));
  else if (audio.status === 'error') msg = h('div', { class: 'row small' }, h('p', { class: 'grow muted' }, t('{error} You can still cut the clip with the nudge buttons and by ear.', { error: audio.error })), filePickButton(t('Load the file'), 'video/*,audio/*', (f) => useLocalFile(vid, f), { size: 'sm', icon: 'folder' }));
  const editing = UI.sel.clipId;
  const field = (label, forId, ...kids) => h('div', { class: 'efield' }, h('label', { class: 'label', for: forId }, label), h('div', { class: 'nudge' }, ...kids));
  return [
    h('div', { class: 'panel-head' },
      h('h3', null, editing ? t('Edit clip') : t('New clip')),
      R.len,
      h('span', { class: 'small muted' }, t('aim for {min}–{max} s', { min: s.clipMin, max: s.clipMax })),
      h('span', { class: 'spacer' }),
      (R.playSel = btn(t('Play selection'), () => togglePlaySelection(), { icon: 'play', size: 'sm', id: 'playSelBtn' })),
      btn(t('Cancel'), () => cancelCut(), { kind: 'ghost', size: 'sm', title: t('Discard the selection and leave clip mode (Esc)') }),
      btn(t('Save and shadow'), () => saveSelection(true), { kind: 'blue', icon: 'mic', size: 'sm', title: t('Save the clip and start a session with it') }),
      btn(editing ? t('Save changes') : t('Save clip'), () => saveSelection(false), { kind: 'primary', icon: 'check', size: 'sm' })),
    msg,
    canvas,
    R.warn,
    h('div', { class: 'editor-row' },
      field(t('Start@@clip edge'), 'selStart', R.startT, btn('−0.1', nudge('start', -0.1), { size: 'sm', title: t('Start 0.1 s earlier') }), btn('+0.1', nudge('start', 0.1), { size: 'sm', title: t('Start 0.1 s later') }), btn(t('Snap'), () => snapEdge('start'), { size: 'sm', title: t('Move the start into the nearest pause') })),
      field(t('End'), 'selEnd', R.endT, btn('−0.1', nudge('end', -0.1), { size: 'sm', title: t('End 0.1 s earlier') }), btn('+0.1', nudge('end', 0.1), { size: 'sm', title: t('End 0.1 s later') }), btn(t('Snap'), () => snapEdge('end'), { size: 'sm', title: t('Move the end into the nearest pause') })),
      field(t('Length (s)'), 'selLen', R.lenT),
      h('div', { class: 'efield grow' }, h('label', { class: 'label', for: 'clipLabel' }, t('Label')), R.label)),
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
  const next = btn(playing ? t('Stop') : t('Play selection'), () => togglePlaySelection(), { icon: playing ? 'stop' : 'play', size: 'sm', id: 'playSelBtn' });
  b.replaceWith(next);
  Panel.refs.playSel = next;
}

function editorData(vid) {
  const sel = UI.sel;
  const w0 = Math.max(0, sel.start - MARGIN), w1 = Math.min(Player.duration() || sel.end + MARGIN, sel.end + MARGIN);
  const E = Panel.editor;
  if (E && E.vid === vid.id && E.w0 <= w0 + 0.01 && E.w1 >= w1 - 0.01 && E.ready) return E;
  // keep a wider window so small nudges don't recompute
  const W0 = Math.max(0, w0 - 2), W1 = Math.min(Player.duration() || w1 + 2, w1 + 2);
  const x = VideoAudio.slice(vid.id, W0, W1);
  if (!x || x.length < WIN * 2) {
    // not decoded yet: fetch just this window, then the editor redraws
    if (VideoAudio.state(vid.id).status !== 'loading' && VideoAudio.state(vid.id).status !== 'error') VideoAudio.ensure(vid, W0, W1);
    Panel.editor = { vid: vid.id, w0: W0, w1: W1, ready: false };
    return Panel.editor;
  }
  const n = Math.floor((x.length - WIN) / HOP);
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) db[i] = DSP.rmsDb(x, i * HOP, WIN);
  // pause detection uses the loudness spread of the wider window
  const { pauses, thr } = DSP.pauses(db, 12);
  Panel.editor = { vid: vid.id, w0: W0, w1: W1, db, pauses, thr, ready: true };
  return Panel.editor;
}

function edgeOnSpeech(E, t) {
  if (!E || !E.ready) return false;
  const i = Math.round((t - E.w0) / HOP_S);
  let loud = 0;
  for (let k = i - 3; k <= i + 3; k++) if (E.db[k] != null && E.db[k] > E.thr + 3) loud++;
  return loud >= 4;
}

function snapEdge(which) {
  const vid = Player.current();
  const E = editorData(vid);
  if (!E.ready) { toast(t('The waveform isn’t available, so there are no gaps to snap to. Nudge by ear instead.')); return; }
  const at = UI.sel[which];
  let best = null;
  for (const p of E.pauses) {
    const a = E.w0 + p.a * HOP_S, b = E.w0 + p.b * HOP_S;
    const mid = which === 'start' ? Math.max(a, b - 0.15) : Math.min(b, a + 0.15);
    const d = Math.abs(mid - at);
    if (d < 2 && (!best || d < best.d)) best = { d, t: mid };
  }
  if (!best) { toast(t('No pause found within 2 seconds of that edge.')); return; }
  UI.sel[which] = round(best.t, 2);
  if (UI.sel.end - UI.sel.start < 1) { toast(t('Snapping there would make the clip too short.')); return; }
  updateEditor(); renderScrubber();
}

function updateEditor() {
  const s = settings();
  const R = Panel.refs;
  const sel = UI.sel;
  if (!sel || !R.len) return;
  const len = sel.end - sel.start;
  const lo = s.clipMin, hi = s.clipMax, slack = Math.max(2, (hi - lo) * 0.25);
  const cls = len >= lo && len <= hi ? 'good' : len >= lo - slack && len <= hi + slack ? 'warn' : 'bad';
  R.len.className = `len ${cls}`;
  R.len.textContent = fmtSec(len);
  // don't overwrite a field while it's being typed in
  if (document.activeElement !== R.startT) R.startT.value = fmtTime(sel.start, 1);
  if (document.activeElement !== R.endT) R.endT.value = fmtTime(sel.end, 1);
  if (document.activeElement !== R.lenT) R.lenT.value = len.toFixed(1);
  const E = editorData(Player.current());
  const warns = [];
  if (E.ready) {
    if (edgeOnSpeech(E, sel.start)) warns.push(t('The start lands mid-word. Move it into a gap.'));
    if (edgeOnSpeech(E, sel.end)) warns.push(t('The end lands mid-word. Move it into a gap so the sentence isn’t cut in half.'));
  }
  R.warn.textContent = warns.join(' ');
  Panel.drawEditor(Player.time());
}

Panel.drawEditor = function (now) {
  const c = this.canvas;
  const vid = Player.current();
  if (!c || !UI.sel || !vid) return;
  const { W, H, dpr } = sizeCanvas(c);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const sel = UI.sel;
  const v0 = Math.max(0, sel.start - MARGIN), v1 = Math.min(Player.duration() || sel.end + MARGIN, sel.end + MARGIN);
  const X = (tt) => ((tt - v0) / (v1 - v0)) * W;
  const E = editorData(vid);
  // selection backdrop
  g.fillStyle = cssVar('--tint');
  g.fillRect(X(sel.start), 0, X(sel.end) - X(sel.start), H);
  if (E.ready) {
    // pauses
    g.fillStyle = cssVar('--tint-2');
    for (const p of E.pauses) {
      const a = E.w0 + p.a * HOP_S, b = E.w0 + p.b * HOP_S;
      if (b < v0 || a > v1) continue;
      g.fillRect(X(a), H - 8 * dpr, X(b) - X(a), 8 * dpr);
    }
    const peak = percentile(Array.from(E.db), 0.99);
    g.fillStyle = cssVar('--fg');
    g.globalAlpha = 0.75;
    const i0 = Math.max(0, Math.floor((v0 - E.w0) / HOP_S)), i1 = Math.min(E.db.length, Math.ceil((v1 - E.w0) / HOP_S));
    const bw = Math.max(1, (W / (i1 - i0)) * 0.8);
    for (let i = i0; i < i1; i++) {
      const a = clamp((E.db[i] - (peak - 48)) / 48, 0, 1);
      const hh = a * (H / 2 - 12 * dpr);
      g.fillRect(X(E.w0 + i * HOP_S), H / 2 - hh, bw, hh * 2);
    }
    g.globalAlpha = 1;
  } else {
    g.fillStyle = cssVar('--muted');
    g.font = `500 ${12 * dpr}px Rubik, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(t('Waveform unavailable'), W / 2, H / 2);
    g.textAlign = 'left';
  }
  // edges as brackets
  const wat = cssVar('--green');
  g.fillStyle = wat;
  for (const [tt, dir] of [[sel.start, 1], [sel.end, -1]]) {
    const xx = X(tt);
    g.fillRect(xx - 2 * dpr, 0, 4 * dpr, H);
    g.fillRect(dir > 0 ? xx : xx - 12 * dpr, 0, 12 * dpr, 4 * dpr);
    g.fillRect(dir > 0 ? xx : xx - 12 * dpr, H - 4 * dpr, 12 * dpr, 4 * dpr);
  }
  // playhead
  if (now >= v0 && now <= v1) { g.fillStyle = cssVar('--playhead'); g.fillRect(X(now) - dpr, 0, 2 * dpr, H); }
};

function bindEditorCanvas(c) {
  const tAt = (e) => {
    const r = c.getBoundingClientRect();
    const sel = UI.sel;
    const v0 = Math.max(0, sel.start - MARGIN), v1 = Math.min(Player.duration() || sel.end + MARGIN, sel.end + MARGIN);
    return { t: v0 + ((e.clientX - r.left) / r.width) * (v1 - v0), px: (v1 - v0) / r.width };
  };
  c.addEventListener('pointerdown', (e) => {
    if (!UI.sel) return;
    const { t, px } = tAt(e);
    const ds = Math.abs(t - UI.sel.start), de = Math.abs(t - UI.sel.end);
    const which = ds < de ? 'start' : 'end';
    if (Math.min(ds, de) < px * 14) {
      // freeze the view while dragging so the edge follows the pointer
      Panel.drag = { which, v0: Math.max(0, UI.sel.start - MARGIN), v1: Math.min(Player.duration() || UI.sel.end + MARGIN, UI.sel.end + MARGIN) };
      c.setPointerCapture(e.pointerId);
    } else Player.seek(t);
  });
  c.addEventListener('pointermove', (e) => {
    const D = Panel.drag;
    if (!D) return;
    const r = c.getBoundingClientRect();
    const t = D.v0 + ((e.clientX - r.left) / r.width) * (D.v1 - D.v0);
    if (D.which === 'start') UI.sel.start = clamp(round(t, 2), 0, UI.sel.end - 0.5);
    else UI.sel.end = clamp(round(t, 2), UI.sel.start + 0.5, Player.duration() || 1e9);
    updateEditor();
  });
  const end = () => { if (Panel.drag) { Panel.drag = null; renderScrubber(); updateEditor(); } };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
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
    toast(t('Clip saved. Cut another, or shadow it now.'), 'good');
  }
  if (!computeModel(clip)) ensureModels(vid);
  Prep.schedule(clip); // the speaker's sounds and words, in the background, if those features are on
  UI.sel = null;
  UI.clipId = clip.id;
  renderAll();
  if (shadowNow) Session.start([clip.id]);
}
