/* ---------- habit tracking ---------- */
function practisedDays(excludeId) {
  const map = new Map(); // day -> 'full' | 'bad'
  for (const s of Store.all('sessions')) {
    if (s.empty || s.id === excludeId || !s.passes || !s.passes.length) continue;
    const kind = s.mode === 'badday' ? 'bad' : 'full';
    if (map.get(s.date) !== 'full') map.set(s.date, kind);
  }
  return map;
}
function streakInfo(excludeId) {
  const days = practisedDays(excludeId);
  const today = dayKey();
  const first = [...days.keys()].sort()[0];
  let streak = 0;
  if (first) {
    let d = days.has(today) ? today : addDays(today, -1);
    let gap = 0;
    while (d >= first) {
      if (days.has(d)) { streak++; gap = 0; } else if (++gap >= 2) break;
      d = addDays(d, -1);
    }
  }
  const ws = weekStart(today);
  let weekCount = 0;
  for (const k of days.keys()) if (k >= ws && k <= today) weekCount++;
  const minutes = Store.all('sessions').reduce((s, x) => s + (x.minutes || 0), 0);
  const yesterday = addDays(today, -1);
  return { streak, weekCount, minutes: minutes < 10 ? round(minutes, 1) : Math.round(minutes), days, practisedToday: days.has(today), missedYesterday: days.size > 0 && !days.has(yesterday) && !days.has(today) };
}

/* ---------- top bar ---------- */
function renderChips() {
  const s = streakInfo();
  const target = settings().weeklyTarget;
  mount($('#chips'),
    h('span', { class: `chip streak ${s.practisedToday ? '' : 'cold'}`, title: 'Day streak (one rest day in a row is allowed)' }, icon('flame'), `${s.streak} day${s.streak === 1 ? '' : 's'}`),
    h('span', { class: 'chip', title: 'Days practised this week' }, icon('calendar'), `${s.weekCount}/${target} this week`),
    h('button', { type: 'button', class: 'chip mode', title: storageTitle(), onclick: () => toast(storageTitle(), '', 6000) }, icon(Store.mode === 'cloud' || Store.mode === 'artifact' ? 'check' : 'folder'), Store.mode === 'cloud' || Store.mode === 'artifact' ? 'Synced' : Store.mode === 'local' ? 'This browser' : 'Not saved'));
  mount($('#topnav'),
    btn('Library', () => openDrawer(), { icon: 'menu', size: 'sm', kind: 'ghost', aria: 'Library', title: 'Video library' }),
    btn('Progress', () => openProgress('habit'), { icon: 'chart', size: 'sm', aria: 'Progress', title: 'Progress' }),
    btn('Check-ins', () => openCheckins(), { icon: 'mic', size: 'sm', aria: 'Check-ins', title: 'Check-ins' }),
    isAdmin() ? btn(Admin.open ? `Admin (${Admin.open})` : 'Admin', () => openAdmin(), { icon: 'shield', size: 'sm', kind: 'ghost', aria: 'Admin', title: Admin.open ? `Admin: ${Admin.open} message${Admin.open === 1 ? '' : 's'} to handle` : 'Admin' }) : null,
    btn('Settings', () => openSettings(), { icon: 'settings', size: 'sm', kind: 'ghost', aria: 'Settings', title: 'Settings' }));
  const lib = $('#topnav').firstChild;
  lib.classList.add('only-phone');
}
function storageTitle() {
  return Store.mode === 'cloud' ? `Saved to your account${Api.email ? ` (signed in as ${Api.email})` : ''}; available on every device.`
    : Store.mode === 'artifact' ? 'Saved in the artifact’s database; available on every device.'
    : Store.mode === 'local' ? 'Saved in this browser only. Back up from Settings → Data.'
      : 'Storage is blocked here; nothing will be kept after you close the page.';
}

function renderBanners() {
  const out = [];
  const info = streakInfo();
  const dismissed = lsGet('dismissed', {});
  const dismiss = (k) => () => { dismissed[k] = true; lsSet('dismissed', dismissed); renderBanners(); };
  const base = checkinFor(0);
  const anySession = Store.all('sessions').some((s) => !s.empty);
  if (!checkinHasAll(base) && !dismissed.baseline) {
    out.push(h('div', { class: 'banner info' },
      h('p', null, anySession ? 'Your week 0 baseline isn’t finished yet. Record it soon so later check-ins have something to compare with.' : 'Before your first practice, record your week 0 baseline (about 3 minutes). Every later check-in is compared with it.'),
      btn('Record baseline', () => openCheckins(0), { kind: 'primary', size: 'sm', icon: 'mic' }),
      btn('Later', dismiss('baseline'), { kind: 'ghost', size: 'sm' })));
  }
  if (info.missedYesterday && !info.practisedToday) {
    out.push(h('div', { class: 'banner' },
      h('p', null, 'You missed yesterday. Don’t skip two days in a row: even a 5-minute bad-day session keeps the streak alive.'),
      btn('Bad-day session', () => Session.start(UI.queue.length ? UI.queue : [UI.clipId || lastClipId()].filter(Boolean), 'badday'), { kind: 'wattle', size: 'sm', icon: 'bad' })));
  }
  const due = dueCheckin();
  if (due != null && due !== 0) {
    out.push(h('div', { class: 'banner info' }, h('p', null, `Week ${due} check-in is due. It takes about 3 minutes.`), btn('Start check-in', () => openCheckins(due), { kind: 'primary', size: 'sm' })));
  }
  if (Api.signedOut && Store.mode === 'cloud') {
    out.unshift(h('div', { class: 'banner' }, h('p', null, 'You’re signed out, so changes can’t be saved right now. Sign in again to keep saving.'), btn('Sign in', () => signIn(), { kind: 'primary', size: 'sm' })));
  }
  if (Store.mode === 'cloud') { /* nothing to explain */ } else if (Caps.inArtifact && !dismissed.artifactNote) {
    out.push(h('div', { class: 'banner info' },
      h('p', null, 'You’re using the Claude artifact version: your data syncs and Claude feedback works, but the microphone and outside video links may be blocked here. Run the checks to see what works on this device.'),
      btn('Run checks', () => openSettings('checks'), { size: 'sm', icon: 'flask' }),
      btn('Got it', dismiss('artifactNote'), { kind: 'ghost', size: 'sm' })));
  } else if (!Caps.inArtifact && Store.mode === 'local' && !dismissed.localNote) {
    out.push(h('div', { class: 'banner info' },
      h('p', null, 'Standalone version: the microphone and video links work, and your data stays in this browser. Back it up from Settings → Data now and then.'),
      btn('Got it', dismiss('localNote'), { kind: 'ghost', size: 'sm' })));
  }
  if (Store.mode === 'memory') out.push(h('div', { class: 'banner' }, h('p', null, 'Storage is blocked in this view, so nothing will be kept. Open the app in a normal browser window.')));
  mount($('#banners'), out);
  $('#banners').hidden = !out.length;
}
function lastClipId() {
  const s = Store.all('sessions').filter((x) => !x.empty).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  return s && s.clipId;
}

/* ---------- progress modal ---------- */
function openProgress(tab = 'habit') {
  const tabs = [['habit', 'Habit'], ['issues', 'Issues'], ['measures', 'Measures'], ['clips', 'Clips']];
  const body = tab === 'habit' ? habitView() : tab === 'issues' ? issuesView() : tab === 'measures' ? measuresView() : clipsOverview();
  openModal([
    modalHead('Progress'),
    h('div', { class: 'tabs' }, tabs.map(([k, l]) => btn(l, () => openProgress(k), { size: 'sm', on: k === tab }))),
    body,
  ]);
}

function habitView() {
  const s = streakInfo();
  const target = settings().weeklyTarget;
  const today = dayKey();
  const start = addDays(weekStart(today), -7 * 11);
  const weeks = [];
  for (let w = 0; w < 12; w++) weeks.push(addDays(start, w * 7));
  const lags = weeklyLag();
  return h('div', { class: 'stack' },
    h('div', { class: 'cards' },
      h('div', { class: 'card' }, h('span', { class: 'label' }, 'Day streak'), h('div', { class: 'stat' }, s.streak), h('p', { class: 'small muted' }, 'One rest day in a row is allowed; two breaks it.')),
      h('div', { class: 'card' }, h('span', { class: 'label' }, 'This week'), h('div', { class: 'stat' }, `${s.weekCount}/${target}`), h('div', { class: 'bar big' }, h('i', { style: { width: Math.min(100, (s.weekCount / target) * 100) + '%' } }))),
      h('div', { class: 'card' }, h('span', { class: 'label' }, 'Total practice'), h('div', { class: 'stat' }, `${s.minutes} min`), h('p', { class: 'small muted' }, ((n) => `${n} session${n === 1 ? '' : 's'}`)(Store.all('sessions').filter((x) => !x.empty).length)))),
    h('div', { class: 'card' },
      h('h3', null, 'Last 12 weeks'),
      h('div', { class: 'cal' },
        h('span', null, ''), ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('span', { style: { textAlign: 'center' } }, d)),
        weeks.map((w) => [h('span', null, fmtDay(w)), [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(w, i);
          const k = s.days.get(d);
          return h('span', { class: `d ${k || ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`, title: `${fmtDayLong(d)}${k ? (k === 'bad' ? ' · bad-day session' : ' · full session') : ''}` }, k === 'full' ? '✓' : k === 'bad' ? '·' : '');
        })])),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--green)' } }), 'Full session'), h('span', null, h('i', { style: { background: 'var(--wattle)' } }), 'Bad-day session'), h('span', null, h('i', { style: { background: 'var(--surface-2)' } }), 'Not practised'))),
    lags.length > 1 ? h('div', { class: 'card trend' }, h('h3', null, 'Average lag behind the speaker, by week'), h('p', { class: 'small muted' }, 'Shrinking lag over the weeks counts as progress. Rough measure.'), trendChart(lags.map((l) => ({ x: fmtDay(l.week), y: l.lag })), { unit: ' s', dec: 2 })) : null);
}

function weeklyLag() {
  const by = new Map();
  for (const s of Store.all('sessions')) {
    for (const p of s.passes || []) {
      if (p.lag == null) continue;
      const w = weekStart(s.date);
      if (!by.has(w)) by.set(w, []);
      by.get(w).push(p.lag);
    }
  }
  return [...by.entries()].sort().map(([week, arr]) => ({ week, lag: round(mean(arr), 2) }));
}

function clipsOverview() {
  const clips = Store.all('clips').filter((c) => !c.archived).sort((a, b) => (a.created < b.created ? 1 : -1));
  return h('div', { class: 'table-wrap' }, clips.length ? h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Clip'), h('th', null, 'Video'), h('th', null, 'Length'), h('th', null, 'Sessions'), h('th', null, 'Done'), h('th', null, ''))),
    h('tbody', null, clips.map((c) => {
      const v = Store.get('videos', c.videoId);
      const n = Store.all('sessions').filter((s) => s.clipId === c.id && !s.empty).length;
      return h('tr', null, h('td', null, clipName(c)), h('td', null, v ? v.title : '—'), h('td', { class: 'num' }, fmtSec(c.end - c.start)), h('td', { class: 'num' }, n),
        h('td', null, c.done ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : ''), h('td', null, btn('History', () => openHistory(c.id), { size: 'sm', kind: 'ghost' })));
    }))) : h('p', { class: 'muted' }, 'No clips yet.'));
}

/* small SVG line chart, drawn to one scale */
function trendChart(points, { unit = '', dec = 1, ref = null, refLabel = 'speaker' } = {}) {
  const W = 560, H = 170, L = 46, R = 14, T = 14, B = 28;
  const ys = points.map((p) => p.y).concat(ref != null ? [ref] : []).filter((v) => v != null && isFinite(v));
  if (!ys.length) return h('p', { class: 'muted small' }, 'Not enough data yet.');
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const X = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; svg.appendChild(e); return e; };
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  for (const t of ticks) {
    el('line', { x1: L, x2: W - R, y1: Y(t), y2: Y(t), stroke: 'var(--line)', 'stroke-width': 1 });
    el('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end' }, t.toFixed(dec) + unit);
  }
  if (ref != null) {
    el('line', { x1: L, x2: W - R, y1: Y(ref), y2: Y(ref), stroke: 'var(--green)', 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    el('text', { x: W - R, y: Y(ref) - 5, 'text-anchor': 'end', fill: 'var(--green)' }, refLabel);
  }
  const valid = points.map((p, i) => [i, p.y]).filter(([, y]) => y != null && isFinite(y));
  if (valid.length > 1) el('polyline', { points: valid.map(([i, y]) => `${X(i)},${Y(y)}`).join(' '), fill: 'none', stroke: 'var(--sky)', 'stroke-width': 3, 'stroke-linejoin': 'round' });
  valid.forEach(([i, y], k) => el('circle', { cx: X(i), cy: Y(y), r: k === valid.length - 1 ? 6 : 4, fill: 'var(--sky)', stroke: 'var(--surface)', 'stroke-width': 2 }));
  points.forEach((p, i) => el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, p.x));
  return h('div', { class: 'trend' }, svg);
}

/* ---------- check-ins ---------- */
const CHECKIN_WEEKS = [0, 4, 8, 12];
const TASKS = [
  { key: 'read', name: 'Read aloud', secs: null, help: 'Read these sentences aloud at a natural pace. They are the same at every check-in.' },
  { key: 'retell', name: 'Retelling (about 60 s)', secs: 60, help: null },
  { key: 'answer', name: 'Unseen question (about 60 s)', secs: 60, help: 'Reveal a question you haven’t seen and answer it for about 60 seconds. No preparing.' },
];

function programmeStart() {
  const s = settings();
  if (s.programmeStart) return s.programmeStart;
  const base = checkinFor(0);
  return (base && base.date) || dayKey();
}
function checkinFor(week) { return Store.all('checkins').find((c) => c.week === week); }
function checkinHasAll(c) { return !!(c && TASKS.every((t) => c.recs && c.recs[t.key] && c.recs[t.key].length)); }
function dueCheckin() {
  const start = programmeStart();
  const today = dayKey();
  for (const w of CHECKIN_WEEKS) {
    if (!checkinHasAll(checkinFor(w)) && (w === 0 || addDays(start, w * 7) <= today)) return w;
  }
  return null;
}

function openCheckins(focusWeek) {
  const start = programmeStart();
  const items = CHECKIN_WEEKS.map((w) => {
    const c = checkinFor(w);
    const due = addDays(start, w * 7);
    const done = checkinHasAll(c);
    const count = c ? TASKS.filter((t) => c.recs && c.recs[t.key] && c.recs[t.key].length).length : 0;
    return h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('h3', { class: 'grow' }, w === 0 ? 'Week 0 · baseline' : `Week ${w}`),
        done ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : h('span', { class: 'small muted' }, `${count}/3`)),
      h('p', { class: 'small muted' }, c && c.date ? `Recorded ${fmtDay(c.date)}` : w === 0 ? 'Record before your first practice' : `Due ${fmtDay(due)}`),
      h('div', { class: 'row' },
        btn(done ? 'Open' : count ? 'Continue' : 'Start', () => openCheckinRecorder(w), { size: 'sm', kind: done ? '' : 'primary' }),
        done && w !== 0 && checkinHasAll(checkinFor(0)) ? btn('Compare with baseline', () => openCheckinCompare(w), { size: 'sm', kind: 'blue' }) : null));
  });
  openModal([
    modalHead('Check-ins', 'Weeks 0, 4, 8 and 12. Recordings are never overwritten.'),
    h('div', { class: 'cards' }, items),
    h('div', { class: 'card' },
      h('h3', null, 'Blind listener pack'),
      h('p', { class: 'small muted' }, `Export shuffled, unlabelled check-in samples plus clips of real ${targetAccent().short} speakers from your library, with a rating sheet (1 = no foreign accent, 9 = very strong accent). Enter the ratings back here to see the average per check-in.`),
      h('div', { class: 'row' }, btn('Build and export pack', () => exportListenerPack(), { kind: 'primary', size: 'sm', icon: 'download' }), btn('Enter ratings', () => openRatings(), { size: 'sm' }))),
  ]);
  if (focusWeek != null) openCheckinRecorder(focusWeek);
}

function ensureCheckin(week) {
  let c = checkinFor(week);
  if (!c) c = Store.put('checkins', { week, date: dayKey(), recs: { read: [], retell: [], answer: [] }, questions: [], measures: {}, lang: profile().targetLanguage, readSet: readSentences().id });
  return c;
}

function openCheckinRecorder(week) {
  const c = checkinFor(week);
  const body = h('div', { class: 'stack' });
  const draw = async () => {
    const cur = checkinFor(week);
    const cards = await Promise.all(TASKS.map(async (t) => {
      const ids = (cur && cur.recs && cur.recs[t.key]) || [];
      const takes = await Promise.all(ids.map(async (id, i) => {
        const r = Store.get('recordings', id);
        const row = h('div', { class: 'audio-row' });
        const normal = async () => mount(row,
          h('span', { class: 'small', style: { fontWeight: 800 } }, `Take ${i + 1}`),
          await recAudio(r),
          r && r.durationSec ? h('span', { class: 'small muted num' }, fmtTime(r.durationSec)) : null,
          btn('Delete', () => confirmRow(), { size: 'sm', kind: 'ghost', title: `Delete take ${i + 1}` }));
        const confirmRow = () => mount(row,
          h('span', { class: 'small', style: { fontWeight: 800 } }, `Delete take ${i + 1}? This can’t be undone.`),
          btn('Delete', async () => { await deleteCheckinTake(week, t.key, id); draw(); }, { size: 'sm', kind: 'danger' }),
          btn('Keep it', () => normal(), { size: 'sm', kind: 'ghost' }));
        await normal();
        return row;
      }));
      const q = t.key === 'answer' ? cur && cur.questions && cur.questions[cur.questions.length - 1] : null;
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, h('h3', { class: 'grow' }, t.name), ids.length ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : null),
        h('p', { class: 'small muted' }, t.help || langContent().retellHelp),
        t.key === 'read' ? h('ol', { style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' } }, readSentences(cur).sentences.map((s) => h('li', null, s))) : null,
        t.key === 'answer' ? h('p', { id: `ciQ-${week}`, hidden: !q }, h('strong', null, 'Question: '), h('span', null, q || '')) : null,
        takes,
        checkinRecordControls(week, t, draw));
    }));
    mount(body, cards);
  };
  draw();
  openModal([
    modalHead(week === 0 ? 'Week 0 baseline' : `Week ${week} check-in`, 'Use the same microphone and room each time. Headphones aren’t needed here.'),
    micControl(),
    body,
    h('div', { class: 'row' }, btn('Back to check-ins', () => openCheckins(), { kind: 'ghost' })),
  ], { onClose: () => { renderBanners(); } });
}

function checkinRecordControls(week, task, redraw) {
  const wrap = h('div', { class: 'row' });
  const status = h('span', { class: 'small muted' });
  let rec = null, timer = null, t0 = 0;
  const cur = checkinFor(week);
  const has = cur && cur.recs && cur.recs[task.key] && cur.recs[task.key].length;
  const stop = async () => {
    clearInterval(timer);
    if (!rec) return;
    const res = await rec.stop();
    rec = null;
    Mic.close();
    await saveCheckinTake(week, task.key, res.blob, res.samples);
    toast('Saved.', 'good');
    redraw();
  };
  const start = async () => {
    if (task.key === 'answer') {
      const c = ensureCheckin(week);
      if (!c.questions || c.questions.length <= (c.recs.answer || []).length) {
        const q = pickQuestion();
        Store.patch('checkins', c.id, { questions: [...(c.questions || []), q] });
        const qEl = $(`#ciQ-${week}`);
        if (qEl) { qEl.hidden = false; qEl.lastChild.textContent = q; }
        toast('Question revealed. Start answering now.');
      }
    }
    AudioEng.getCtx();
    if (!(await Mic.open())) { mount(status, h('span', { class: 'formerr' }, Mic.error)); return; }
    rec = new Recording();
    rec.start();
    t0 = performance.now();
    mount(wrap, btn('Stop and save', stop, { kind: 'danger', icon: 'stop' }), status);
    timer = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      // the target is soft: going over is fine, so finish the sentence; a hard stop only at 3x the target
      if (!task.secs) status.textContent = `${fmtTime(s)} recording`;
      else if (s < task.secs) status.textContent = `${Math.ceil(task.secs - s)} s left`;
      else { status.textContent = `Time’s up: finish your sentence, then stop (+${fmtTime(s - task.secs)})`; status.style.color = 'var(--ochre)'; status.style.fontWeight = '800'; }
      if (task.secs && s >= task.secs * 3) stop();
    }, 250);
  };
  wrap.append(
    btn(has ? 'Record another take' : task.key === 'answer' ? 'Reveal question and record' : 'Record', start, { kind: has ? '' : 'primary', icon: 'mic', size: 'sm' }),
    filePickButton('Upload a file', 'audio/*,video/*', async (f) => { try { const samples = await AudioEng.decodeBlob(f); await saveCheckinTake(week, task.key, f, samples); toast('Saved.', 'good'); redraw(); } catch (e) { toast(`That file couldn’t be read (${e.message || 'error'}).`, 'bad'); } }, { size: 'sm', kind: 'ghost', icon: 'upload' }),
    status);
  return wrap;
}

async function deleteCheckinTake(week, key, recId) {
  const c = checkinFor(week);
  if (!c) return;
  const list = c.recs[key] || [];
  const idx = list.indexOf(recId);
  if (idx < 0) return;
  const rec = Store.get('recordings', recId);
  const recs = { ...c.recs, [key]: list.filter((x) => x !== recId) };
  const fields = { recs };
  // each answer take has its own question; drop it too (it stays marked as seen)
  if (key === 'answer' && c.questions) fields.questions = c.questions.filter((_, i) => i !== idx);
  // measures follow the latest remaining take
  const measures = { ...(c.measures || {}) };
  const last = Store.get('recordings', recs[key].slice(-1)[0]);
  if (last && last.measures) measures[key] = last.measures; else delete measures[key];
  fields.measures = measures;
  Store.patch('checkins', c.id, fields);
  if (rec) {
    await Store.deleteBlob(rec.ref);
    delete Store.data.recordings[recId];
    Store.schedule('recordings', recId, 0);
  }
  toast('Take deleted.');
}

function pickQuestion() {
  const meta = appMeta();
  const used = new Set(meta.usedQuestions || []);
  const all = langContent().questions;
  const fresh = all.filter((q) => !used.has(q));
  const q = (fresh.length ? fresh : all)[Math.floor(Math.random() * (fresh.length || all.length))];
  Store.patch('meta', 'app', { usedQuestions: [...used, q] });
  return q;
}

async function saveCheckinTake(week, key, blob, samples) {
  const c = ensureCheckin(week);
  let ref;
  try { ref = await Store.putBlob(blob, 'checkin'); } catch (e) { toast(`The recording couldn’t be stored (${e.message || e.code || 'error'}).`, 'bad', 6000); return; }
  let measures = null, analysis = null;
  if (samples && samples.length > SR) {
    const m = DSP.modelFromSamples(samples, settings().pitchSmoothing);
    measures = m.measures;
    analysis = { onset: m.onset };
  }
  const r = Store.put('recordings', { kind: 'checkin', week, task: key, ref, mime: blob.type, created: new Date().toISOString(), measures, analysis, durationSec: samples ? round(samples.length / SR, 1) : null });
  const recs = { ...c.recs, [key]: [...(c.recs[key] || []), r.id] };
  const lagWin = sessionsLagBefore(c.date || dayKey());
  const allMeasures = { ...(c.measures || {}) };
  if (measures) allMeasures[key] = measures;
  allMeasures.lag = lagWin;
  Store.patch('checkins', c.id, { recs, measures: allMeasures, date: c.date || dayKey() });
  if (week === 0 && !settings().programmeStart) saveSettings({ programmeStart: c.date || dayKey() });
  if (checkinHasAll(checkinFor(week))) { celebrate(1); toast(`Week ${week} check-in complete!`, 'good'); }
}
function sessionsLagBefore(date) {
  const from = addDays(date, -28);
  const lags = [];
  for (const s of Store.all('sessions')) if (s.date >= from && s.date <= date) for (const p of s.passes || []) if (p.lag != null) lags.push(p.lag);
  return lags.length ? round(mean(lags), 2) : null;
}

async function openCheckinCompare(week) {
  const A = checkinFor(0), B = checkinFor(week);
  const rows = await Promise.all(TASKS.map(async (t) => {
    const ra = Store.get('recordings', (A.recs[t.key] || []).slice(-1)[0]);
    const rb = Store.get('recordings', (B.recs[t.key] || []).slice(-1)[0]);
    return h('div', { class: 'card' }, h('h3', null, t.name),
      h('div', { class: 'cards' },
        h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Baseline'), await recAudio(ra)),
        h('div', { class: 'stack' }, h('span', { class: 'label' }, `Week ${week}`), await recAudio(rb))));
  }));
  openModal([modalHead(`Week ${week} vs baseline`), rows, measuresTable([A, B]), btn('Back', () => openCheckins(), { kind: 'ghost' })]);
}

function modelReference() {
  const ms = Store.all('clips').filter((c) => c.model && c.model.measures && !c.noisy).map((c) => c.model.measures);
  return { rate: round(mean(ms.map((m) => m.rate)), 2), stressRatio: round(mean(ms.map((m) => m.stressRatio)), 2), range: round(mean(ms.map((m) => m.range)), 1), n: ms.length };
}

const MEASURE_DEFS = [
  { key: 'rate', name: 'Speaking rate', unit: ' syll/s', dec: 2, from: 'read' },
  { key: 'stressRatio', name: 'Stressed ÷ unstressed syllable length', unit: '×', dec: 2, from: 'read' },
  { key: 'range', name: 'Pitch range', unit: ' st', dec: 1, from: 'read' },
  { key: 'lag', name: 'Average lag behind the speaker', unit: ' s', dec: 2, from: null },
];
function measuresTable(cis) {
  const ref = modelReference();
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Measure'), cis.map((c) => h('th', null, c.week === 0 ? 'Baseline' : `Week ${c.week}`)), h('th', null, ref.n ? `Speaker (${ref.n} clips)` : 'Speaker'))),
    h('tbody', null, MEASURE_DEFS.map((d) => h('tr', null, h('td', null, d.name),
      cis.map((c) => { const v = d.from ? c.measures && c.measures[d.from] && c.measures[d.from][d.key] : c.measures && c.measures.lag; return h('td', { class: 'num' }, v != null && isFinite(v) ? v.toFixed(d.dec) + d.unit : '—'); }),
      h('td', { class: 'num' }, d.key !== 'lag' && ref[d.key] != null && isFinite(ref[d.key]) ? ref[d.key].toFixed(d.dec) + d.unit : '—'))))));
}

function measuresView() {
  const cis = CHECKIN_WEEKS.map(checkinFor).filter((c) => c && c.measures && Object.keys(c.measures).length);
  const ref = modelReference();
  const ratings = ratingAverages();
  return h('div', { class: 'stack' },
    h('div', { class: 'banner info' }, h('p', null, 'These are rough measures worked out from your read-aloud recordings, compared with the speaker’s clips. They are not an accent score; use them to spot trends over the weeks.')),
    cis.length ? measuresTable(cis) : h('p', { class: 'muted' }, 'Measures appear after your first check-in.'),
    cis.length > 1 ? h('div', { class: 'cards' }, MEASURE_DEFS.map((d) => h('div', { class: 'card' }, h('h4', null, d.name),
      trendChart(cis.map((c) => ({ x: c.week === 0 ? 'Base' : `Wk ${c.week}`, y: d.from ? c.measures[d.from] && c.measures[d.from][d.key] : c.measures.lag })), { unit: d.unit.trim() === '×' ? '' : '', dec: d.dec, ref: d.key !== 'lag' && isFinite(ref[d.key]) ? ref[d.key] : null })))) : null,
    ratings.length ? h('div', { class: 'card' }, h('h3', null, 'Blind listener ratings'), h('p', { class: 'small muted' }, '1 = no foreign accent, 9 = very strong accent.'),
      h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Sample'), h('th', null, 'Average'), h('th', null, 'Ratings'))),
        h('tbody', null, ratings.map((r) => h('tr', null, h('td', null, r.label), h('td', { class: 'num' }, r.avg.toFixed(1)), h('td', { class: 'num' }, r.n))))))) : null);
}

/* ---------- blind listener pack ---------- */
async function exportListenerPack() {
  toast('Building the pack… this can take a little while.');
  const items = [];
  for (const w of CHECKIN_WEEKS) {
    const c = checkinFor(w);
    if (!c) continue;
    const id = (c.recs.answer || []).slice(-1)[0] || (c.recs.retell || []).slice(-1)[0];
    const r = Store.get('recordings', id);
    if (!r) continue;
    const blob = await Store.getBlob(r.ref);
    if (!blob) continue;
    try {
      const x = await AudioEng.decodeBlob(blob);
      items.push({ kind: 'checkin', week: w, samples: excerpt(x, 20) });
    } catch { /* skip undecodable */ }
  }
  // one or two clips of real speakers of the target accent, from your library
  const clips = shuffle(Store.all('clips').filter((c) => !c.archived && !c.noisy));
  for (const c of clips) {
    if (items.filter((i) => i.kind === 'model').length >= 2) break;
    const v = Store.get('videos', c.videoId);
    const st = await VideoAudio.ensure(v, c.start, Math.min(c.end, c.start + 20));
    if (!st || st.status !== 'ready') continue;
    items.push({ kind: 'model', clipId: c.id, samples: VideoAudio.slice(v.id, c.start, Math.min(c.end, c.start + 20)) });
  }
  if (items.filter((i) => i.kind === 'checkin').length < 1) { toast('Record at least one check-in first.', 'bad'); return; }
  const mixed = shuffle(items);
  const letters = 'ABCDEFGHIJ';
  const enc = new TextEncoder();
  const files = mixed.map((it, i) => ({ name: `Sample ${letters[i]}.wav`, data: DSP.wav(it.samples) }));
  const sheet = ['Listener name,Sample,Rating (1 = no foreign accent; 9 = very strong accent),What gave it away?']
    .concat(mixed.map((_, i) => `,${letters[i]},,`)).join('\n');
  files.push({ name: 'rating-sheet.csv', data: enc.encode(sheet) });
  files.push({ name: 'instructions.txt', data: enc.encode(`Thanks for helping!\n\nListen to each sample once or twice, in any order. For each one, rate how strong a foreign (non-${targetAccent().short}) accent you hear:\n1 = no foreign accent at all, 9 = very strong foreign accent.\nThen write a few words on what gave it away (a sound, the rhythm, the melody...).\nFill in rating-sheet.csv and send it back.\n`) });
  const zip = makeZip(files);
  const pack = Store.put('meta', { id: `pack-${uid()}`, kind: 'listenerPack', created: new Date().toISOString(), items: mixed.map((it, i) => ({ label: letters[i], kind: it.kind, week: it.week, clipId: it.clipId })), ratings: [] });
  const name = `listener-pack-${dayKey()}.zip`;
  if (Caps.downloads) {
    try { await Caps.downloads.save({ filename: name, data: zip }); toast('Pack saved.', 'good'); } catch (e) { if (e.code !== 'declined') toast(`Couldn’t save the file (${e.code}).`, 'bad'); }
  } else {
    const a = h('a', { href: URL.createObjectURL(zip), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }
  toast(`Pack ${fmtDay(dayKey())} keeps the answer key here, so the listeners can't see which is which.`);
  return pack;
}
function excerpt(x, secs) {
  const a = DSP.analyse(x.length > SR * 90 ? x.subarray(0, SR * 90) : x);
  const on = DSP.onset(a.db) * HOP;
  return x.subarray(on, Math.min(x.length, on + secs * SR));
}
function listenerPacks() { return Store.all('meta').filter((m) => m.kind === 'listenerPack').sort((a, b) => (a.created < b.created ? 1 : -1)); }

function openRatings() {
  const packs = listenerPacks();
  if (!packs.length) { toast('Export a listener pack first.'); return; }
  const pack = packs[0];
  const F = { listener: '', vals: {} };
  const form = h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    const rows = pack.items.map((it) => ({ label: it.label, rating: +F.vals[it.label]?.rating || null, comment: F.vals[it.label]?.comment || '' })).filter((r) => r.rating >= 1 && r.rating <= 9);
    if (!rows.length) { toast('Enter at least one rating from 1 to 9.'); return; }
    Store.patch('meta', pack.id, { ratings: [...(pack.ratings || []), { listener: F.listener.trim() || 'Listener', rows, at: dayKey() }] });
    toast('Ratings saved.', 'good');
    openProgress('measures');
  } },
  h('label', { class: 'field', for: 'rListener' }, 'Listener name', h('input', { type: 'text', id: 'rListener', oninput: (e) => { F.listener = e.target.value; } })),
  h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Sample'), h('th', null, 'Rating 1–9'), h('th', null, 'What gave it away?'))),
    h('tbody', null, pack.items.map((it) => h('tr', null, h('td', null, it.label),
      h('td', null, h('input', { type: 'number', min: 1, max: 9, id: `r-${it.label}`, style: { width: '80px' }, oninput: (e) => { (F.vals[it.label] ||= {}).rating = e.target.value; } })),
      h('td', null, h('input', { type: 'text', id: `c-${it.label}`, oninput: (e) => { (F.vals[it.label] ||= {}).comment = e.target.value; } }))))))),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary' }, h('span', null, 'Save ratings'))));
  openModal([modalHead('Enter listener ratings', `Pack from ${fmtDay(dayKey(new Date(pack.created)))} · ${(pack.ratings || []).length} listener(s) so far`), form]);
}
function ratingAverages() {
  const out = new Map();
  for (const p of listenerPacks()) {
    for (const r of p.ratings || []) for (const row of r.rows) {
      const it = p.items.find((i) => i.label === row.label);
      if (!it) continue;
      const label = it.kind === 'model' ? `${targetAccent().short} speaker (reference)` : it.week === 0 ? 'Baseline' : `Week ${it.week}`;
      if (!out.has(label)) out.set(label, []);
      out.get(label).push(row.rating);
    }
  }
  return [...out.entries()].map(([label, arr]) => ({ label, avg: mean(arr), n: arr.length }));
}
