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
    else if (this.key && this.key.startsWith('clip')) this.drawAnalysis(t);
  },
};

function renderPanel() {
  const el = $('#panel');
  const vid = Player.current();
  const clip = Store.get('clips', UI.clipId);
  let key;
  if (UI.sel && vid) key = `editor:${UI.sel.clipId || 'new'}:${VideoAudio.state(vid.id).status}`;
  else if (clip) key = `clip:${clip.id}:${UI.view}:${UI.overlay}:${!!clip.model}:${VideoAudio.state(clip.videoId).status}`;
  else key = 'empty';

  if (key !== Panel.key) {
    Panel.key = key;
    Panel.canvas = null;
    Panel.refs = {};
    if (key === 'empty') mount(el, panelEmpty());
    else if (key.startsWith('editor')) mount(el, buildEditor(vid));
    else mount(el, buildAnalysis(clip));
  }
  if (key.startsWith('editor')) updateEditor();
  if (key.startsWith('clip')) updateAnalysisHead(clip);
  Panel.onTime(Player.time());
}

function panelEmpty() {
  return h('div', { class: 'panel-msg' },
    h('h3', null, 'Analysis panel'),
    h('p', null, 'Select a clip to see the speaker’s pitch line, or press Cut clips under the video to make a new one.'));
}

/* ---------- analysis view ---------- */
function buildAnalysis(clip) {
  const vid = Store.get('videos', clip.videoId);
  const audio = VideoAudio.state(clip.videoId);
  const canvas = h('canvas', { 'aria-label': UI.overlay ? 'Pitch or loudness of the speaker and you on one chart' : 'Pitch or loudness lanes: speaker on top, you below' });
  Panel.canvas = canvas;
  const head = h('div', { class: 'panel-head' },
    h('div', { class: 'seg', role: 'group', 'aria-label': 'View' },
      h('button', { type: 'button', class: UI.view === 'pitch' ? 'on' : '', onclick: () => { UI.view = 'pitch'; renderPanel(); } }, 'Pitch'),
      h('button', { type: 'button', class: UI.view === 'wave' ? 'on' : '', onclick: () => { UI.view = 'wave'; renderPanel(); } }, 'Waveform')),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Layout' },
      h('button', { type: 'button', class: UI.overlay ? '' : 'on', title: 'Speaker on top, you below', onclick: () => setOverlay(false) }, 'Separate'),
      h('button', { type: 'button', class: UI.overlay ? 'on' : '', title: 'Both lines on one chart', onclick: () => setOverlay(true) }, 'Overlaid')),
    h('span', { class: 'lag', id: 'lagLabel' }),
    h('span', { class: 'spacer' }),
    h('span', { class: 'small muted', id: 'relLabel' }),
    btn(clip.noisy ? 'Flagged noisy' : 'Too noisy?', () => { Store.patch('clips', clip.id, { noisy: !clip.noisy }); toast(clip.noisy ? 'Clip flagged as too noisy. Its pitch line is shown faded.' : 'Noisy flag removed.'); renderPanel(); renderSidebar(); },
      { icon: 'flag', on: clip.noisy, title: 'Flag this clip as too noisy for a reliable pitch line' }));
  if (!clip.model) {
    let msg;
    if (audio.status === 'loading' || audio.status === 'decoding') msg = h('p', null, `Reading the video’s sound… ${audio.progress ? Math.round(audio.progress * 100) + '%' : ''}`);
    else if (audio.status === 'error') msg = [h('p', null, audio.error), filePickButton('Load the video file from this device', 'video/*,audio/*', (f) => useLocalFile(vid, f), { kind: 'primary', icon: 'folder' })];
    else msg = [h('p', null, 'The model line for this clip hasn’t been worked out yet.'), btn('Work it out now', () => ensureModels(vid).then(renderPanel), { kind: 'primary' })];
    return [head, h('div', { class: 'panel-msg' }, msg), canvas];
  }
  bindAnalysisCanvas(canvas, clip);
  return [head, canvas];
}

function setOverlay(on) {
  UI.overlay = on;
  lsSet('overlay', on);
  renderPanel();
}

function bindAnalysisCanvas(canvas, clip) {
  canvas.addEventListener('pointerdown', (e) => {
    if (Session.active) return;
    const r = canvas.getBoundingClientRect();
    const t = clip.start + ((e.clientX - r.left) / r.width) * (clip.end - clip.start);
    Player.seek(t);
  });
}

function updateAnalysisHead(clip) {
  const lag = $('#lagLabel');
  if (lag) lag.textContent = Panel.lastPass && Panel.lastPass.clipId === clip.id ? `Last pass: ${fmtLag(Panel.lastPass.lag)}${Panel.lastPass.manual ? ' (manual offset)' : ''}` : '';
  const rel = $('#relLabel');
  if (rel && clip.model) rel.textContent = clip.model.reliability < 0.55 || clip.noisy ? 'Pitch line unreliable in places' : '';
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
Panel.drawAnalysis = function (t) {
  const c = this.canvas;
  const clip = Store.get('clips', UI.clipId);
  if (!c || !clip || !clip.model) return;
  const { W, H, dpr } = sizeCanvas(c);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const dur = clip.end - clip.start;
  const x = (ct) => (ct / dur) * W;
  const ov = !!UI.overlay;
  const green = cssVar('--green'), sky = cssVar('--sky');
  const lanes = ov
    ? [{ top: 0, h: H, name: 'Speaker', color: green }, { top: 0, h: H, name: 'You', color: sky }]
    : [{ top: 0, h: H / 2 - 2 * dpr, name: 'Speaker', color: green }, { top: H / 2 + 2 * dpr, h: H / 2 - 2 * dpr, name: 'You', color: sky }];
  const muted = cssVar('--muted'), line = cssVar('--line');
  g.font = `800 ${11 * dpr}px Nunito, system-ui, sans-serif`;
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
    if (ov) g.fillText('each voice’s own average', W - 8 * dpr, H / 2 - 5 * dpr);
    else {
      g.fillText('speaker’s average', W - 8 * dpr, lanes[0].top + lanes[0].h / 2 - 5 * dpr);
      g.fillText('your average', W - 8 * dpr, lanes[1].top + lanes[1].h / 2 - 5 * dpr);
    }
    g.textAlign = 'left';
  }
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
  drawSeries(lanes[0], m, m.hop, 0, lanes[0].color, (faded ? 0.45 : 1) * (ov ? 0.6 : 1), ov ? 5 : 3);

  // you: live trace during a pass, otherwise the last analysed pass for this clip
  if (this.live && this.live.clipId === clip.id && this.live.points.length) {
    const sh = this.live.shift || 0;
    const pts = this.live.points.map((p) => ({ t: p.t - sh, st: p.st, db: p.db }));
    const series = { st: pts.map((p) => p.st), db: pts.map((p) => p.db) };
    // live points are irregular in time; draw as polyline
    if (UI.view === 'pitch') {
      g.strokeStyle = lanes[1].color; g.lineWidth = 3 * dpr; g.lineJoin = 'round'; g.beginPath();
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
    drawSeries(lanes[1], p, p.hop, p.offset, lanes[1].color);
  } else {
    g.fillStyle = muted;
    g.textAlign = 'center';
    g.fillText(Mic.error && Session.active ? 'Microphone unavailable' : 'Your line appears here when you record a pass', W / 2, ov ? H - 12 * dpr : lanes[1].top + lanes[1].h * 0.25);
    g.textAlign = 'left';
  }

  // playhead
  if (t >= clip.start - 0.5 && t <= clip.end + 0.5) {
    g.fillStyle = cssVar('--ochre');
    g.fillRect(x(clamp(t - clip.start, 0, dur)) - dpr, 0, 2 * dpr, H);
  }
};

/* ---------- zoomed clip editor ---------- */
const MARGIN = 1.5;
function buildEditor(vid) {
  const s = settings();
  const audio = VideoAudio.state(vid.id);
  const canvas = h('canvas', { class: 'editor', 'aria-label': 'Zoomed waveform of the selection; drag the yellow edges onto quiet gaps' });
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
  R.startT = h('span', { class: 'num small' });
  R.endT = h('span', { class: 'num small' });
  R.label = h('input', { type: 'text', id: 'clipLabel', placeholder: 'A few words of what’s said (optional)', value: UI.sel.label || '', oninput: (e) => { UI.sel.label = e.target.value; } });
  let msg = null;
  if (audio.status === 'loading' || audio.status === 'decoding') msg = h('p', { class: 'small muted', id: 'audioMsg' }, 'Reading the video’s sound for the zoomed waveform…');
  else if (audio.status === 'error') msg = h('div', { class: 'row small' }, h('p', { class: 'grow muted' }, audio.error + ' You can still cut the clip with the nudge buttons and by ear.'), filePickButton('Load the file', 'video/*,audio/*', (f) => useLocalFile(vid, f), { size: 'sm', icon: 'folder' }));
  const editing = UI.sel.clipId;
  return [
    h('div', { class: 'panel-head' },
      h('h3', null, editing ? 'Edit clip' : 'New clip'),
      R.len,
      h('span', { class: 'small muted' }, `target ${s.clipMin}–${s.clipMax} s`),
      h('span', { class: 'spacer' }),
      (R.playSel = btn('Play selection', () => togglePlaySelection(), { icon: 'play', size: 'sm', id: 'playSelBtn' }))),
    msg,
    canvas,
    R.warn,
    h('div', { class: 'editor-grid' },
      h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Start ', R.startT),
        h('div', { class: 'nudge' }, btn('−0.1 s', nudge('start', -0.1), { size: 'sm' }), btn('+0.1 s', nudge('start', 0.1), { size: 'sm' }), btn('Snap to gap', () => snapEdge('start'), { size: 'sm', title: 'Move the start into the nearest pause' }))),
      h('div', { class: 'stack' }, h('span', { class: 'label' }, 'End ', R.endT),
        h('div', { class: 'nudge' }, btn('−0.1 s', nudge('end', -0.1), { size: 'sm' }), btn('+0.1 s', nudge('end', 0.1), { size: 'sm' }), btn('Snap to gap', () => snapEdge('end'), { size: 'sm' }))),
      h('label', { class: 'field', for: 'clipLabel' }, 'Label', R.label)),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      btn(editing ? 'Save changes' : 'Save clip', () => saveSelection(false), { kind: 'primary', icon: 'check' }),
      btn('Save and shadow now', () => saveSelection(true), { kind: 'blue', icon: 'mic' }),
      btn('Cancel', () => { UI.sel = null; renderAll(); }, { kind: 'ghost' })),
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
  const next = btn(playing ? 'Stop' : 'Play selection', () => togglePlaySelection(), { icon: playing ? 'stop' : 'play', size: 'sm', id: 'playSelBtn' });
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
  if (!x || x.length < WIN * 2) { Panel.editor = { vid: vid.id, w0: W0, w1: W1, ready: false }; return Panel.editor; }
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
  if (!E.ready) { toast('The waveform isn’t available, so there are no gaps to snap to. Nudge by ear instead.'); return; }
  const t = UI.sel[which];
  let best = null;
  for (const p of E.pauses) {
    const a = E.w0 + p.a * HOP_S, b = E.w0 + p.b * HOP_S;
    const mid = which === 'start' ? Math.max(a, b - 0.15) : Math.min(b, a + 0.15);
    const d = Math.abs(mid - t);
    if (d < 2 && (!best || d < best.d)) best = { d, t: mid };
  }
  if (!best) { toast('No pause found within 2 seconds of that edge.'); return; }
  UI.sel[which] = round(best.t, 2);
  if (UI.sel.end - UI.sel.start < 1) { toast('Snapping there would make the clip too short.'); return; }
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
  R.startT.textContent = fmtTime(sel.start, 1);
  R.endT.textContent = fmtTime(sel.end, 1);
  const E = editorData(Player.current());
  const warns = [];
  if (E.ready) {
    if (edgeOnSpeech(E, sel.start)) warns.push('The start lands mid-word. Move it into a gap.');
    if (edgeOnSpeech(E, sel.end)) warns.push('The end lands mid-word. Move it into a gap so the sentence isn’t cut in half.');
  }
  R.warn.textContent = warns.join(' ');
  Panel.drawEditor(Player.time());
}

Panel.drawEditor = function (t) {
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
  g.fillStyle = cssVar('--wattle-soft');
  g.fillRect(X(sel.start), 0, X(sel.end) - X(sel.start), H);
  if (E.ready) {
    // pauses
    g.fillStyle = cssVar('--green-soft');
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
    g.font = `800 ${12 * dpr}px Nunito, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('Waveform unavailable', W / 2, H / 2);
    g.textAlign = 'left';
  }
  // edges as brackets
  const wat = cssVar('--wattle');
  g.fillStyle = wat;
  for (const [tt, dir] of [[sel.start, 1], [sel.end, -1]]) {
    const xx = X(tt);
    g.fillRect(xx - 2 * dpr, 0, 4 * dpr, H);
    g.fillRect(dir > 0 ? xx : xx - 12 * dpr, 0, 12 * dpr, 4 * dpr);
    g.fillRect(dir > 0 ? xx : xx - 12 * dpr, H - 4 * dpr, 12 * dpr, 4 * dpr);
  }
  // playhead
  if (t >= v0 && t <= v1) { g.fillStyle = cssVar('--ochre'); g.fillRect(X(t) - dpr, 0, 2 * dpr, H); }
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
    clip = Store.patch('clips', sel.clipId, { start: round(sel.start, 2), end: round(sel.end, 2), label: (sel.label || '').trim(), model: null });
    toast('Clip updated.', 'good');
  } else {
    clip = Store.put('clips', { videoId: vid.id, start: round(sel.start, 2), end: round(sel.end, 2), label: (sel.label || '').trim(), done: false, archived: false, noisy: false, created: new Date().toISOString() });
    toast('Clip saved. Cut another, or shadow it now.', 'good');
  }
  if (VideoAudio.state(vid.id).status === 'ready') computeModel(clip);
  else ensureModels(vid);
  UI.sel = null;
  UI.clipId = clip.id;
  renderAll();
  if (shadowNow) Session.start([clip.id]);
}
