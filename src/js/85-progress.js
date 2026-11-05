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

/* streak lengths worth a word of congratulation */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
function streakMilestone(streakBefore, streak) {
  return STREAK_MILESTONES.filter((m) => streakBefore < m && streak >= m).pop() || 0;
}
/* the day a new user is on in their first week: 1 on the day of the first session, up to 7; 0 after that */
function firstWeekDay(info) {
  const first = [...info.days.keys()].sort()[0];
  if (!first) return 0;
  const n = daysBetween(first, dayKey()) + 1;
  return n <= 7 ? n : 0;
}

/* a session started between midnight and 10am can count for yesterday when yesterday has none */
const LATE_SESSION_HOUR = 10;
function canCountForYesterday(sessionId) {
  const s = Store.get('sessions', sessionId);
  if (!s || s.empty || s.movedFrom || s.date !== dayKey() || !s.passes || !s.passes.length) return false;
  if (new Date(s.startedAt).getHours() >= LATE_SESSION_HOUR) return false;
  return true;
}
/* yesterday already shows a session (maybe a test, or one marked by mistake): the card says so */
function yesterdayHasSession(sessionId) {
  const s = Store.get('sessions', sessionId);
  return !!s && practisedDays(sessionId).has(addDays(s.date, -1));
}
/* move a session (and the notes taken in it) to another day; movedFrom remembers the original day for undo */
function moveSessionDay(sessionId, date, movedFrom = null) {
  Store.patch('sessions', sessionId, { date, movedFrom });
  for (const n of Store.all('notes')) if (n.sessionId === sessionId) Store.patch('notes', n.id, { date });
}

function storageTitle() {
  return Store.mode === 'cloud' ? `${Api.email ? t('Your practice history is saved to your account ({email}).', { email: Api.email }) : t('Your practice history is saved to your account.')} ${Drive.connected() ? t('Videos and recordings are in your Google Drive.') : t('Videos and recordings are only in this browser until you connect Google Drive (Settings → Data).')}`
    : Store.mode === 'artifact' ? t('Saved in the artifact’s database; available on every device.')
    : Store.mode === 'local' ? t('Saved in this browser only. Back up from Settings → Data.')
      : t('Storage is blocked here; nothing will be kept after you close the page.');
}

/* notices that apply on every screen; the ones about today's practice (baseline, check-ins, a missed day, headphones)
   are boxes on Today (84-today.js) */
function renderBanners() {
  const out = [];
  const dismissed = lsGet('dismissed', {});
  const dismiss = (k) => () => { dismissed[k] = true; lsSet('dismissed', dismissed); renderBanners(); };
  if (Api.signedOut && Store.mode === 'cloud') {
    out.push(h('div', { class: 'banner' }, h('p', null, t('You’re signed out, so changes can’t be saved right now. Sign in again to keep saving.')), btn(t('Sign in'), () => signIn(), { kind: 'primary', size: 'sm' })));
  }
  if (Store.mode === 'cloud') { /* nothing to explain */ } else if (Caps.inArtifact && !dismissed.artifactNote) {
    out.push(h('div', { class: 'banner info' },
      h('p', null, t('You’re using the Claude artifact version: your data syncs and Claude feedback works, but the microphone and outside video links may be blocked here. Run the checks to see what works on this device.')),
      btn(t('Run checks'), () => openSettings('checks'), { size: 'sm', icon: 'flask' }),
      btn(t('Got it'), dismiss('artifactNote'), { kind: 'ghost', size: 'sm' })));
  } else if (!Caps.inArtifact && Store.mode === 'local' && !dismissed.localNote) {
    out.push(h('div', { class: 'banner info' },
      h('p', null, t('Standalone version: the microphone and video links work, and your data stays in this browser. Back it up from Settings → Data now and then.')),
      btn(t('Got it'), dismiss('localNote'), { kind: 'ghost', size: 'sm' })));
  }
  if (Store.mode === 'memory') out.push(h('div', { class: 'banner' }, h('p', null, t('Storage is blocked in this view, so nothing will be kept. Open the app in a normal browser window.'))));
  if (Session.active) out.length = Api.signedOut ? 1 : 0; // focus mode: only what stops your work being saved
  // a notice that wasn't there on the last draw slides in
  const seen = renderBanners.seen;
  renderBanners.seen = new Set(out.map((b) => b.textContent));
  if (seen) out.forEach((b) => { if (!seen.has(b.textContent)) b.classList.add('enter'); });
  mount($('#banners'), out);
  $('#banners').hidden = !out.length;
}
function lastClipId() {
  const s = Store.all('sessions').filter((x) => !x.empty).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  return s && s.clipId;
}

/* ---------- Progress page ---------- */
const PROGRESS_TABS = ['habit', 'issues', 'measures', 'checkins', 'clips'];
function openProgress(tab = 'habit') {
  if (!PROGRESS_TABS.includes(tab)) tab = 'habit';
  const tabs = [['habit', t('Habit')], ['issues', t('Issues')], ['measures', t('Measures')], ['checkins', t('Check-ins')], ['clips', t('Clips')]];
  const body = tab === 'habit' ? habitView() : tab === 'issues' ? issuesView() : tab === 'measures' ? measuresView() : tab === 'checkins' ? checkinsView() : clipsOverview();
  openView([
    modalHead(t('Progress')),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => btn(l, () => openProgress(k), { size: 'sm', on: k === tab }))),
    body,
  ], { page: 'progress', sub: tab === 'habit' ? null : tab });
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
      h('div', { class: 'card' }, h('span', { class: 'label' }, t('Day streak')), h('div', { class: 'stat' }, s.streak), h('p', { class: 'small muted' }, t('One rest day in a row is allowed; two breaks it.'))),
      h('div', { class: 'card' }, h('span', { class: 'label' }, t('This week')), h('div', { class: 'stat' }, `${s.weekCount}/${target}`), h('div', { class: 'bar big' }, h('i', { style: { width: Math.min(100, (s.weekCount / target) * 100) + '%' } }))),
      h('div', { class: 'card' }, h('span', { class: 'label' }, t('Total practice')), h('div', { class: 'stat' }, t('{n} min', { n: s.minutes })), h('p', { class: 'small muted' }, tp(Store.all('sessions').filter((x) => !x.empty).length, '{n} session', '{n} sessions')))),
    h('div', { class: 'card' },
      h('h3', null, t('Last 12 weeks')),
      h('div', { class: 'cal' },
        h('span', null, ''), [1, 2, 3, 4, 5, 6, 0].map((i) => h('span', { style: { textAlign: 'center' }, title: dayName(i) }, dayName(i).charAt(0).toUpperCase())),
        weeks.map((w) => [h('span', null, fmtDay(w)), [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(w, i);
          const k = s.days.get(d);
          return h('span', { class: `d ${k || ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`, title: fmtDayLong(d) + (k ? ' · ' + (k === 'bad' ? t('bad-day session') : t('full session')) : '') }, k === 'full' ? '✓' : k === 'bad' ? '·' : '');
        })])),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--ink)' } }), t('Full session')), h('span', null, h('i', { style: { background: 'var(--green)' } }), t('Bad-day session')), h('span', null, h('i', { style: { background: 'var(--surface-2)' } }), t('Not practised')))),
    weeklyMinutes(weeks).some((m) => m > 0) ? h('div', { class: 'card' }, h('h3', null, t('Minutes per week')), minutesChart(weeks, weeklyMinutes(weeks))) : null,
    lags.length > 1 ? h('div', { class: 'card trend' }, h('h3', null, t('Average lag behind the speaker, by week')), h('p', { class: 'small muted' }, t('How far behind the speaker your voice is, on average, across your passes. Beginners echo the speaker; with practice you start to anticipate, so the lag shrinks towards zero. Clips and speeds differ, so read the trend over several weeks, not the single values.')), trendChart(lags.map((l) => ({ x: fmtDay(l.week), y: l.lag })), { unit: ' s', dec: 2 })) : null);
}

function weeklyMinutes(weeks) {
  const by = new Map(weeks.map((w) => [w, 0]));
  for (const s of Store.all('sessions')) {
    if (s.empty) continue;
    const w = weekStart(s.date);
    if (by.has(w)) by.set(w, by.get(w) + (s.minutes || 0));
  }
  return weeks.map((w) => Math.round(by.get(w)));
}
/* quiet bars, one per week, newest on the right */
function minutesChart(weeks, mins) {
  const top = Math.max(...mins, 1);
  return h('div', { class: 'mins' }, weeks.map((w, i) => h('div', { class: 'col', title: t('{n} min', { n: mins[i] }) + ' · ' + fmtDay(w) },
    h('i', { style: { height: Math.max(mins[i] ? 4 : 0, (mins[i] / top) * 100) + '%' } }), h('span', null, i % 2 === 0 ? fmtDay(w) : ''))));
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
    h('thead', null, h('tr', null, h('th', null, t('Clip')), h('th', null, t('Video')), h('th', null, t('Length')), h('th', null, t('Sessions')), h('th', null, t('Done@@column')), h('th', null, ''))),
    h('tbody', null, clips.map((c) => {
      const v = Store.get('videos', c.videoId);
      const n = Store.all('sessions').filter((s) => s.clipId === c.id && !s.empty).length;
      return h('tr', null, h('td', null, clipName(c)), h('td', null, v ? v.title : '—'), h('td', { class: 'num' }, fmtSec(c.end - c.start)), h('td', { class: 'num' }, n),
        h('td', null, c.done ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : ''), h('td', null, btn(t('History'), () => openHistory(c.id), { size: 'sm', kind: 'ghost' })));
    }))) : h('p', { class: 'muted' }, t('No clips yet.')));
}

/* small SVG line chart, drawn to one scale */
function trendChart(points, { unit = '', dec = 1, ref = null, refLabel = t('speaker') } = {}) {
  const W = 560, H = 170, L = 46, R = 14, T = 14, B = 28;
  const ys = points.map((p) => p.y).concat(ref != null ? [ref] : []).filter((v) => v != null && isFinite(v));
  if (!ys.length) return h('p', { class: 'muted small' }, t('Not enough data yet.'));
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
    el('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end' }, fmtNum(t, dec) + unit);
  }
  if (ref != null) {
    el('line', { x1: L, x2: W - R, y1: Y(ref), y2: Y(ref), stroke: 'var(--speaker)', 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    el('text', { x: W - R, y: Y(ref) - 5, 'text-anchor': 'end', fill: 'var(--ink)' }, refLabel);
  }
  const valid = points.map((p, i) => [i, p.y]).filter(([, y]) => y != null && isFinite(y));
  if (valid.length > 1) el('polyline', { points: valid.map(([i, y]) => `${X(i)},${Y(y)}`).join(' '), fill: 'none', stroke: 'var(--you)', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  valid.forEach(([i, y], k) => el('circle', { cx: X(i), cy: Y(y), r: k === valid.length - 1 ? 6 : 4, fill: 'var(--you)', stroke: 'var(--card)', 'stroke-width': 2 }));
  points.forEach((p, i) => el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, p.x));
  return h('div', { class: 'trend' }, svg);
}

/* ---------- check-ins ---------- */
const CHECKIN_WEEKS = [0, 4, 8, 12];
const TASKS = [
  { key: 'read', name: N_('Read aloud'), secs: null, help: N_('Read these sentences aloud at a natural pace. They are the same at every check-in.') },
  { key: 'retell', name: N_('Retelling (about 60 s)'), secs: 60, help: null },
  { key: 'answer', name: N_('Unseen question (about 60 s)'), secs: 60, help: N_('Reveal a question you haven’t seen and answer it for about 60 seconds. No preparing.') },
];

/* each target language is its own programme: its own check-ins and start date. English keeps
   the original `programmeStart` setting; other languages live in `programmeStarts[lang]`. */
function savedProgrammeStart(lang = targetLang()) {
  const s = settings();
  return lang === 'en' ? s.programmeStart : (s.programmeStarts || {})[lang] || null;
}
function programmeStartPatch(date, lang = targetLang()) {
  return lang === 'en' ? { programmeStart: date } : { programmeStarts: { ...(settings().programmeStarts || {}), [lang]: date } };
}
function programmeStart() {
  const saved = savedProgrammeStart();
  if (saved) return saved;
  const base = checkinFor(0);
  return (base && base.date) || dayKey();
}
function checkinFor(week) { const lang = targetLang(); return Store.all('checkins').find((c) => c.week === week && checkinLang(c) === lang); }
function checkinHasAll(c) { return !!(c && TASKS.every((t) => c.recs && c.recs[t.key] && c.recs[t.key].length)); }
function dueCheckin() {
  const start = programmeStart();
  const today = dayKey();
  for (const w of CHECKIN_WEEKS) {
    if (!checkinHasAll(checkinFor(w)) && (w === 0 || addDays(start, w * 7) <= today)) return w;
  }
  return null;
}

/* the check-ins are a tab of Progress; a week passed in opens its recorder straight away */
function openCheckins(focusWeek) {
  if (focusWeek != null) { openCheckinRecorder(focusWeek); return; }
  openProgress('checkins');
}
function checkinsView() {
  const start = programmeStart();
  const items = CHECKIN_WEEKS.map((w) => {
    const c = checkinFor(w);
    const due = addDays(start, w * 7);
    const done = checkinHasAll(c);
    const count = c ? TASKS.filter((t) => c.recs && c.recs[t.key] && c.recs[t.key].length).length : 0;
    return h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('h3', { class: 'grow' }, w === 0 ? t('Week 0 · baseline') : t('Week {n}', { n: w })),
        done ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : h('span', { class: 'small muted' }, `${count}/3`)),
      h('p', { class: 'small muted' }, c && c.date ? t('Recorded {date}', { date: fmtDay(c.date) }) : w === 0 ? t('Record before your first practice') : t('Due {date}', { date: fmtDay(due) })),
      h('div', { class: 'row' },
        btn(done ? t('Open') : count ? t('Continue') : t('Start'), () => openCheckinRecorder(w), { size: 'sm', kind: done ? '' : 'primary' }),
        done && w !== 0 && checkinHasAll(checkinFor(0)) ? btn(t('Compare with baseline'), () => openCheckinCompare(w), { size: 'sm', kind: 'blue' }) : null));
  });
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, t('Weeks 0, 4, 8 and 12. Recordings are never overwritten.')),
    h('div', { class: 'cards' }, items),
    h('div', { class: 'card' },
      h('h3', null, t('Blind listener pack')),
      h('p', { class: 'small muted' }, t('Export shuffled, unlabelled check-in samples plus clips of real {accent} speakers from your library, with a rating sheet (1 = no foreign accent, 9 = very strong accent). Enter the ratings back here to see the average per check-in.', { accent: t(targetAccent().short) })),
      h('div', { class: 'row' }, btn(t('Build and export pack'), () => exportListenerPack(), { kind: 'primary', size: 'sm', icon: 'download' }), btn(t('Enter ratings'), () => openRatings(), { size: 'sm' }))));
}

function ensureCheckin(week) {
  let c = checkinFor(week);
  if (!c) c = Store.put('checkins', { week, date: dayKey(), recs: { read: [], retell: [], answer: [] }, questions: [], measures: {}, lang: targetLang(), readSet: readSentences().id });
  return c;
}

function openCheckinRecorder(week) {
  const c = checkinFor(week);
  const body = h('div', { class: 'stack' });
  const draw = async () => {
    const cur = checkinFor(week);
    const cards = await Promise.all(TASKS.map(async (task) => {
      const ids = (cur && cur.recs && cur.recs[task.key]) || [];
      const takes = await Promise.all(ids.map(async (id, i) => {
        const r = Store.get('recordings', id);
        const row = h('div', { class: 'audio-row' });
        const normal = async () => mount(row,
          h('span', { class: 'small', style: { fontWeight: 600 } }, t('Take {n}', { n: i + 1 })),
          await recAudio(r),
          r && r.durationSec ? h('span', { class: 'small muted num' }, fmtTime(r.durationSec)) : null,
          btn(t('Delete'), () => confirmRow(), { size: 'sm', kind: 'ghost', title: t('Delete take {n}', { n: i + 1 }) }));
        const confirmRow = () => mount(row,
          h('span', { class: 'small', style: { fontWeight: 600 } }, t('Delete take {n}? This can’t be undone.', { n: i + 1 })),
          btn(t('Delete'), async () => { await deleteCheckinTake(week, task.key, id); draw(); }, { size: 'sm', kind: 'danger' }),
          btn(t('Keep it'), () => normal(), { size: 'sm', kind: 'ghost' }));
        await normal();
        return row;
      }));
      const q = task.key === 'answer' ? cur && cur.questions && cur.questions[cur.questions.length - 1] : null;
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, h('h3', { class: 'grow' }, t(task.name)), ids.length ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : null),
        h('p', { class: 'small muted' }, t(task.help || langContent().retellHelp)),
        task.key === 'read' ? h('ol', { style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' } }, readSentences(cur).sentences.map((s) => h('li', null, s))) : null,
        task.key === 'answer' ? h('p', { id: `ciQ-${week}`, hidden: !q }, h('strong', null, t('Question: ')), h('span', null, q || '')) : null,
        takes,
        checkinRecordControls(week, task, draw));
    }));
    mount(body, cards);
  };
  draw();
  openModal([
    modalHead(week === 0 ? t('Week 0 baseline') : t('Week {n} check-in', { n: week }), t('Use the same microphone and room each time. Headphones aren’t needed here.')),
    micControl(),
    body,
    h('div', { class: 'row' }, btn(t('Back to check-ins'), () => openCheckins(), { kind: 'ghost' })),
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
    toast(t('Saved.'), 'good');
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
        toast(t('Question revealed. Start answering now.'));
      }
    }
    AudioEng.getCtx();
    if (!(await Mic.open())) { mount(status, h('span', { class: 'formerr' }, Mic.error)); return; }
    rec = new Recording();
    rec.start();
    t0 = performance.now();
    mount(wrap, btn(t('Stop and save'), stop, { kind: 'danger', icon: 'stop' }), status);
    timer = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      // the target is soft: going over is fine, so finish the sentence; a hard stop only at 3x the target
      if (!task.secs) status.textContent = t('{time} recording', { time: fmtTime(s) });
      else if (s < task.secs) status.textContent = t('{n} s left', { n: Math.ceil(task.secs - s) });
      else { status.textContent = t('Time’s up: finish your sentence, then stop (+{time})', { time: fmtTime(s - task.secs) }); status.style.color = 'var(--diff-ink)'; status.style.fontWeight = '800'; }
      if (task.secs && s >= task.secs * 3) stop();
    }, 250);
  };
  wrap.append(
    btn(has ? t('Record another take') : task.key === 'answer' ? t('Reveal question and record') : t('Record'), start, { kind: has ? '' : 'primary', icon: 'mic', size: 'sm' }),
    filePickButton(t('Upload a file'), 'audio/*,video/*', async (f) => { try { const samples = await AudioEng.decodeBlob(f); await saveCheckinTake(week, task.key, f, samples); toast(t('Saved.'), 'good'); redraw(); } catch (e) { toast(t('That file couldn’t be read ({error}).', { error: e.message || 'error' }), 'bad'); } }, { size: 'sm', kind: 'ghost', icon: 'upload' }),
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
  toast(t('Take deleted.'));
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
  try { ref = await Store.putBlob(blob, 'checkin'); } catch (e) { toast(t('The recording couldn’t be stored ({error}).', { error: e.message || e.code || 'error' }), 'bad', 6000); return; }
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
  if (week === 0 && !savedProgrammeStart()) saveSettings(programmeStartPatch(c.date || dayKey()));
  if (checkinHasAll(checkinFor(week))) { celebrate(1); toast(t('Week {n} check-in complete!', { n: week }), 'good'); }
}
function sessionsLagBefore(date) {
  const from = addDays(date, -28);
  const lags = [];
  for (const s of Store.all('sessions')) if (s.date >= from && s.date <= date) for (const p of s.passes || []) if (p.lag != null) lags.push(p.lag);
  return lags.length ? round(mean(lags), 2) : null;
}

async function openCheckinCompare(week) {
  const A = checkinFor(0), B = checkinFor(week);
  const rows = await Promise.all(TASKS.map(async (task) => {
    const ra = Store.get('recordings', (A.recs[task.key] || []).slice(-1)[0]);
    const rb = Store.get('recordings', (B.recs[task.key] || []).slice(-1)[0]);
    return h('div', { class: 'card' }, h('h3', null, t(task.name)),
      h('div', { class: 'cards' },
        h('div', { class: 'stack' }, h('span', { class: 'label' }, t('Baseline')), await recAudio(ra)),
        h('div', { class: 'stack' }, h('span', { class: 'label' }, t('Week {n}', { n: week })), await recAudio(rb))));
  }));
  openView([modalHead(t('Week {n} vs baseline', { n: week })), rows, measuresTable([A, B]), btn(t('Back to check-ins'), () => openCheckins(), { kind: 'ghost', icon: 'back', cls: 'self-start' })], { page: 'progress', sub: 'checkins' });
}

function modelReference() {
  const ms = Store.all('clips').filter((c) => c.model && c.model.measures && !c.noisy).map((c) => c.model.measures);
  return { rate: round(mean(ms.map((m) => m.rate)), 2), stressRatio: round(mean(ms.map((m) => m.stressRatio)), 2), range: round(mean(ms.map((m) => m.range)), 1), n: ms.length };
}

const MEASURE_DEFS = [
  { key: 'rate', name: N_('Speaking rate'), unit: ' syll/s', dec: 2, from: 'read' },
  { key: 'stressRatio', name: N_('Stressed ÷ unstressed syllable length'), unit: '×', dec: 2, from: 'read' },
  { key: 'range', name: N_('Pitch range'), unit: ' st', dec: 1, from: 'read' },
  { key: 'lag', name: N_('Average lag behind the speaker'), unit: ' s', dec: 2, from: null },
];
/* the stressed/unstressed ratio only means something in stress-timed languages like English */
function measureDefs() { return MEASURE_DEFS.filter((d) => d.key !== 'stressRatio' || langContent().timing === 'stress'); }
function measuresTable(cis) {
  const ref = modelReference();
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, t('Measure')), cis.map((c) => h('th', null, c.week === 0 ? t('Baseline') : t('Week {n}', { n: c.week }))), h('th', null, ref.n ? tp(ref.n, 'Speaker ({n} clip)', 'Speaker ({n} clips)') : t('Speaker')))),
    h('tbody', null, measureDefs().map((d) => h('tr', null, h('td', null, t(d.name)),
      cis.map((c) => { const v = d.from ? c.measures && c.measures[d.from] && c.measures[d.from][d.key] : c.measures && c.measures.lag; return h('td', { class: 'num' }, v != null && isFinite(v) ? fmtNum(v, d.dec) + d.unit : '—'); }),
      h('td', { class: 'num' }, d.key !== 'lag' && ref[d.key] != null && isFinite(ref[d.key]) ? fmtNum(ref[d.key], d.dec) + d.unit : '—'))))));
}

function measuresView() {
  const cis = CHECKIN_WEEKS.map(checkinFor).filter((c) => c && c.measures && Object.keys(c.measures).length);
  const ref = modelReference();
  const ratings = ratingAverages();
  return h('div', { class: 'stack' },
    h('div', { class: 'banner info' }, h('p', null, t('These are rough measures worked out from your read-aloud recordings, compared with the speaker’s clips. They are not an accent score; use them to spot trends over the weeks.'))),
    cis.length ? measuresTable(cis) : h('p', { class: 'muted' }, t('Measures appear after your first check-in.')),
    cis.length > 1 ? h('div', { class: 'cards' }, measureDefs().map((d) => h('div', { class: 'card' }, h('h4', null, t(d.name)),
      trendChart(cis.map((c) => ({ x: c.week === 0 ? t('Base') : t('Wk {n}', { n: c.week }), y: d.from ? c.measures[d.from] && c.measures[d.from][d.key] : c.measures.lag })), { unit: d.unit.trim() === '×' ? '' : '', dec: d.dec, ref: d.key !== 'lag' && isFinite(ref[d.key]) ? ref[d.key] : null })))) : null,
    ratings.length ? h('div', { class: 'card' }, h('h3', null, t('Blind listener ratings')), h('p', { class: 'small muted' }, t('1 = no foreign accent, 9 = very strong accent.')),
      h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, t('Sample')), h('th', null, t('Average')), h('th', null, t('Ratings')))),
        h('tbody', null, ratings.map((r) => h('tr', null, h('td', null, r.label), h('td', { class: 'num' }, fmtNum(r.avg, 1)), h('td', { class: 'num' }, r.n))))))) : null);
}

/* ---------- blind listener pack ---------- */
async function exportListenerPack() {
  toast(t('Building the pack… this can take a little while.'));
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
  if (items.filter((i) => i.kind === 'checkin').length < 1) { toast(t('Record at least one check-in first.'), 'bad'); return; }
  const mixed = shuffle(items);
  const letters = 'ABCDEFGHIJ';
  const enc = new TextEncoder();
  const files = mixed.map((it, i) => ({ name: t('Sample {letter}.wav', { letter: letters[i] }), data: DSP.wav(it.samples) }));
  const csvCell = (x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const sheet = [[t('Listener name'), t('Sample'), t('Rating (1 = no foreign accent; 9 = very strong accent)'), t('What gave it away?')].map(csvCell).join(',')]
    .concat(mixed.map((_, i) => `,${letters[i]},,`)).join('\n');
  files.push({ name: 'rating-sheet.csv', data: enc.encode(sheet) });
  files.push({ name: 'instructions.txt', data: enc.encode(t('Thanks for helping!\n\nListen to each sample once or twice, in any order. For each one, rate how strong a foreign (non-{accent}) accent you hear:\n1 = no foreign accent at all, 9 = very strong foreign accent.\nThen write a few words on what gave it away (a sound, the rhythm, the melody...).\nFill in rating-sheet.csv and send it back.\n', { accent: t(targetAccent().short) })) });
  const zip = makeZip(files);
  const pack = Store.put('meta', { id: `pack-${uid()}`, kind: 'listenerPack', lang: targetLang(), created: new Date().toISOString(), items: mixed.map((it, i) => ({ label: letters[i], kind: it.kind, week: it.week, clipId: it.clipId })), ratings: [] });
  const name = `listener-pack-${dayKey()}.zip`;
  if (Caps.downloads) {
    try { await Caps.downloads.save({ filename: name, data: zip }); toast(t('Pack saved.'), 'good'); } catch (e) { if (e.code !== 'declined') toast(t('Couldn’t save the file ({error}).', { error: e.code }), 'bad'); }
  } else {
    const a = h('a', { href: URL.createObjectURL(zip), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }
  toast(t('Pack {date} keeps the answer key here, so the listeners can’t see which is which.', { date: fmtDay(dayKey()) }));
  return pack;
}
function excerpt(x, secs) {
  const a = DSP.analyse(x.length > SR * 90 ? x.subarray(0, SR * 90) : x);
  const on = DSP.onset(a.db) * HOP;
  return x.subarray(on, Math.min(x.length, on + secs * SR));
}
function listenerPacks() { const lang = targetLang(); return Store.all('meta').filter((m) => m.kind === 'listenerPack' && checkinLang(m) === lang).sort((a, b) => (a.created < b.created ? 1 : -1)); }

function openRatings() {
  const packs = listenerPacks();
  if (!packs.length) { toast(t('Export a listener pack first.')); return; }
  const pack = packs[0];
  const F = { listener: '', vals: {} };
  const form = h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    const rows = pack.items.map((it) => ({ label: it.label, rating: +F.vals[it.label]?.rating || null, comment: F.vals[it.label]?.comment || '' })).filter((r) => r.rating >= 1 && r.rating <= 9);
    if (!rows.length) { toast(t('Enter at least one rating from 1 to 9.')); return; }
    Store.patch('meta', pack.id, { ratings: [...(pack.ratings || []), { listener: F.listener.trim() || 'Listener', rows, at: dayKey() }] });
    toast(t('Ratings saved.'), 'good');
    openProgress('measures');
  } },
  h('label', { class: 'field', for: 'rListener' }, t('Listener name'), h('input', { type: 'text', id: 'rListener', oninput: (e) => { F.listener = e.target.value; } })),
  h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, t('Sample')), h('th', null, t('Rating 1–9')), h('th', null, t('What gave it away?')))),
    h('tbody', null, pack.items.map((it) => h('tr', null, h('td', null, it.label),
      h('td', null, h('input', { type: 'number', min: 1, max: 9, id: `r-${it.label}`, style: { width: '80px' }, oninput: (e) => { (F.vals[it.label] ||= {}).rating = e.target.value; } })),
      h('td', null, h('input', { type: 'text', id: `c-${it.label}`, oninput: (e) => { (F.vals[it.label] ||= {}).comment = e.target.value; } }))))))),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary' }, h('span', null, t('Save ratings'))),
    filePickButton(t('Import from CSV'), '.csv,text/csv,text/plain', (f) => importRatingsCsv(pack, f), { icon: 'upload' })));
  openModal([modalHead(t('Enter listener ratings'), tp((pack.ratings || []).length, 'Pack from {date} · {n} listener so far', 'Pack from {date} · {n} listeners so far', { date: fmtDay(dayKey(new Date(pack.created))) })), form]);
}
/* reads the filled-in rating-sheet.csv (one or several listeners) and shows a preview before saving */
async function importRatingsCsv(pack, f) {
  let rows;
  try { rows = parseCsv(await f.text()); } catch { toast(t('Couldn’t read that file.'), 'bad'); return; }
  const res = rows.length ? ratingsFromCsv(rows, pack) : { listeners: [] };
  if (!res.listeners.length) { toast(res.error || t('No valid ratings found in that file.'), 'bad'); return; }
  previewRatingsImport(pack, res);
}
function ratingsFromCsv(rows, pack) {
  const labels = new Set(pack.items.map((i) => i.label));
  const norm = (x) => String(x || '').trim().toLowerCase();
  // header detection: the first row counts as a header when no cell in its sample column is a pack label
  let head = rows[0].map(norm), hasHeader = true, cols;
  const find = (re) => head.findIndex((c) => re.test(c));
  cols = { name: find(/listener|name|nom|oyente|nombre/), sample: find(/sample|échantillon|echantillon|muestra/), rating: find(/rating|note|puntuaci|valoraci/), comment: find(/gave|away|comment|trahi|delató|delato|reveló|revelo/) };
  if (cols.sample < 0 || cols.rating < 0) {
    hasHeader = false;
    if (rows[0].length < 3) return { listeners: [], error: t('Expected columns: listener name, sample, rating, what gave it away.') };
    cols = { name: 0, sample: 1, rating: 2, comment: 3 };
  }
  const by = new Map(); let skipped = 0;
  for (const r of hasHeader ? rows.slice(1) : rows) {
    const label = String(r[cols.sample] || '').trim().toUpperCase();
    const rating = +String(r[cols.rating] || '').trim().replace(',', '.');
    if (!label && !String(r[cols.rating] || '').trim()) continue; // blank line
    if (!labels.has(label) || !(rating >= 1 && rating <= 9)) { skipped++; continue; }
    const name = (cols.name >= 0 && String(r[cols.name] || '').trim()) || 'Listener';
    if (!by.has(name)) by.set(name, new Map());
    by.get(name).set(label, { label, rating, comment: cols.comment >= 0 ? String(r[cols.comment] || '').trim() : '' });
  }
  return { listeners: [...by.entries()].map(([listener, m]) => ({ listener, rows: [...m.values()] })), skipped };
}
function previewRatingsImport(pack, res) {
  const total = res.listeners.reduce((n, l) => n + l.rows.length, 0);
  openModal([modalHead(t('Import ratings'), tp(res.listeners.length, '{n} listener found', '{n} listeners found', {})),
    h('div', { class: 'stack' },
      h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, t('Listener name')), h('th', null, t('Sample')), h('th', null, t('Rating 1–9')), h('th', null, t('What gave it away?')))),
        h('tbody', null, res.listeners.flatMap((l) => l.rows.map((r) => h('tr', null, h('td', null, l.listener), h('td', null, r.label), h('td', { class: 'num' }, String(r.rating)), h('td', null, r.comment))))))),
      res.skipped ? h('p', { class: 'small muted' }, tp(res.skipped, '{n} row was skipped (unknown sample or rating outside 1–9).', '{n} rows were skipped (unknown sample or rating outside 1–9).', {})) : null,
      h('div', { class: 'row' },
        btn(tp(total, 'Save {n} rating', 'Save {n} ratings', {}), () => {
          const at = dayKey();
          Store.patch('meta', pack.id, { ratings: [...(pack.ratings || []), ...res.listeners.map((l) => ({ listener: l.listener, rows: l.rows, at }))] });
          toast(t('Ratings saved.'), 'good');
          openProgress('measures');
        }, { kind: 'primary' }),
        btn(t('Cancel'), () => openRatings())))]);
}
function ratingAverages() {
  const out = new Map();
  for (const p of listenerPacks()) {
    for (const r of p.ratings || []) for (const row of r.rows) {
      const it = p.items.find((i) => i.label === row.label);
      if (!it) continue;
      const label = it.kind === 'model' ? t('{accent} speaker (reference)', { accent: t(targetAccent().short) }) : it.week === 0 ? t('Baseline') : t('Week {n}', { n: it.week });
      if (!out.has(label)) out.set(label, []);
      out.get(label).push(row.rating);
    }
  }
  return [...out.entries()].map(([label, arr]) => ({ label, avg: mean(arr), n: arr.length }));
}
