/* ---------- Today: the one thing to do now ----------
   One card for today's clip, with Euno perched on it looking down at it, and beside it the week, what to listen for,
   the next check-in and Ask Euno. When there's nothing to do (no videos yet, done for today, a rest day) the card
   says so and Euno shows it: searching, pleased, asleep. */
function todayClip() {
  const live = (c) => c && !c.archived && Store.get('videos', c.videoId) && !Store.get('videos', c.videoId).archived;
  const q = UI.queue.map((id) => Store.get('clips', id)).find(live);
  if (q) return q;
  const sug = Store.get('clips', rotationSuggestion().clipId);
  if (live(sug)) return sug;
  const all = Store.all('clips').filter(live);
  const vids = Store.all('videos').filter((v) => !v.archived).sort((a, b) => (a.added < b.added ? 1 : -1)).map((v) => v.id);
  const order = (c) => (c.videoId === UI.videoId ? -1 : vids.indexOf(c.videoId));
  const fresh = all.filter((c) => !c.done).sort((a, b) => order(a) - order(b) || a.start - b.start)[0];
  if (fresh) return fresh;
  // everything is done: the clip practised longest ago
  return all.sort((a, b) => ((a.lastPractised || '') < (b.lastPractised || '') ? -1 : 1))[0] || null;
}

function todayState(info) {
  if (!Store.all('videos').some((v) => !v.archived)) return 'novideo';
  if (!Store.all('clips').some((c) => !c.archived)) return 'noclips';
  if (UI.todayAgain) return 'plan';
  if (info.practisedToday) return 'done';
  if (new Date().getDay() === 0) return 'rest';
  return 'plan';
}

function renderToday() {
  const el = $('#todayView');
  if (UI.tab !== 'today' || Session.active) return;
  const info = streakInfo();
  const state = todayState(info);
  const clip = state === 'plan' ? todayClip() : null;
  // the player gets today's clip ready, so Start is instant and the card can show a frame of it
  if (clip && !Session.active && (UI.clipId !== clip.id)) {
    if (clip.videoId !== UI.videoId) Player.load(clip.videoId, { keepClip: true });
    UI.clipId = clip.id; UI.sel = null; UI.unzoomed = false;
    Player.seek(clip.start);
    if (!clip.model) ensureModels(Store.get('videos', clip.videoId));
  }
  mount(el, h('div', { class: 'peek stage' }, todayEuno(state), todayCard(state, clip, info)), todaySide(info, state));
  if (clip) drawThumb(clip);
}

function todayEuno(state) {
  const mood = { novideo: 'searching', noclips: 'curious', done: 'pleased', rest: 'sleeping', plan: 'watching' }[state];
  return Euno.el('today', mood);
}

function todayCard(state, clip, info) {
  if (state === 'novideo') {
    return h('section', { class: 'tcard solo' }, h('div', { class: 'state' },
      h('h1', null, t('No videos yet')),
      h('p', null, t('Add a video of someone whose accent you want: an interview or a talk where one person speaks clearly works best.')),
      btn(t('Add a video'), () => { UI.addOpen = true; go('library'); setTimeout(() => { const f = $('#addUrl') || $('#addFile'); if (f) f.focus(); }, 80); }, { kind: 'primary', size: 'big', icon: 'plus' })));
  }
  if (state === 'noclips') {
    const v = Store.all('videos').filter((x) => !x.archived).sort((a, b) => (a.added < b.added ? 1 : -1))[0];
    return h('section', { class: 'tcard solo' }, h('div', { class: 'state' },
      h('h1', null, t('Cut your first clip')),
      h('p', null, t('Pick one sentence of about 5 to 12 seconds from “{video}”. That is what you’ll shadow.', { video: v.title })),
      btn(t('Cut a clip'), () => { if (v.id !== UI.videoId) Player.load(v.id); go('library'); setCutMode(true); }, { kind: 'primary', size: 'big', icon: 'scissors' })));
  }
  if (state === 'done') {
    const today = Store.all('sessions').filter((s) => s.date === dayKey() && !s.empty);
    const mins = Math.max(1, Math.round(today.reduce((a, s) => a + (s.minutes || 0), 0)));
    const recorded = today.reduce((a, s) => a + (s.passes || []).filter((p) => p.recorded).length, 0);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const next = tomorrow.getDay() === 0 ? t('Tomorrow is a rest day.') : [2, 4, 6].includes(tomorrow.getDay()) ? t('Tomorrow is a repeat day: the same clip again.') : t('Tomorrow is a new-clip day.');
    return h('section', { class: 'tcard solo' }, h('div', { class: 'state' },
      h('p', { class: 'when' }, tp(info.streak, '{n} day in a row', '{n} days in a row')),
      h('h1', null, t('Done for today')),
      h('p', null, `${recorded ? tp(recorded, '{min} min, {n} recorded pass.', '{min} min, {n} recorded passes.', { min: mins }) : t('{min} min.', { min: mins })} ${next}`),
      h('div', { class: 'acts' },
        btn(t('Practise again'), () => { UI.todayAgain = true; renderToday(); }, { size: 'sm' }),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => go('progress') }, t('See your progress')))));
  }
  if (state === 'rest') {
    return h('section', { class: 'tcard solo' }, h('div', { class: 'state' },
      h('h1', null, t('Rest day')),
      h('p', null, t('Nothing planned for Sunday. You can still practise if you like; it counts.')),
      btn(t('Practise anyway'), () => { UI.todayAgain = true; renderToday(); }, { size: 'sm' })));
  }
  const s = settings();
  const vid = Store.get('videos', clip.videoId) || {};
  const sugg = rotationSuggestion();
  const firstTime = !Store.all('sessions').some((x) => !x.empty);
  const queued = UI.queue.filter((id) => Store.get('clips', id));
  const reviewDue = s.review ? reviewDueClips() : [];
  const fw = firstWeekDay(info);
  const when = firstTime ? t('Your first session')
    : info.missedYesterday ? t('You missed yesterday. Even 5 minutes keeps the streak going.')
      : fw > 1 ? t('Day {n} of your first week', { n: fw })
        : clip.done ? t('Practise again') : sugg.clipId === clip.id ? t('Repeat day: yesterday’s clip') : !clip.lastPractised ? t('New clip today') : sugg.title;
  const plan = buildPlan(firstTime ? 'badday' : 'full', clip);
  const short = firstTime || info.missedYesterday;
  const ids = queued.length ? queued : [clip.id];
  return h('section', { class: 'tcard' },
    h('div', { class: 'thumb', id: 'todayThumb', role: 'img', 'aria-label': t('A frame from {clip}', { clip: clipName(clip) }) }, h('canvas')),
    h('div', { class: 'tclip' },
      h('p', { class: 'when' }, when),
      h('h1', null, clipName(clip)),
      h('p', { class: 'src' }, [vid.title, vid.speaker, fmtSec(clip.end - clip.start)].filter(Boolean).join(' · ')),
      h('ol', { class: 'plan', 'aria-label': t('Today’s steps') }, plan.map((p) => [h('li', { class: 'pill', 'aria-hidden': 'true' }), h('li', null, t(p.name))])),
      h('div', { class: 'acts' },
        short
          ? btn(t('Start, {n} min', { n: s.badMinutes }), () => Session.start(ids, 'badday'), { kind: 'primary', size: 'big', icon: 'play' })
          : btn(queued.length > 1 ? t('Start {n} clips', { n: queued.length }) : t('Start, {n} min', { n: Math.round(buildPlan('full', clip).reduce((a, p) => a + p.minutes, 0)) }), () => Session.start(ids, 'full'), { kind: 'primary', size: 'big', icon: 'play' }),
        short
          ? h('button', { type: 'button', class: 'linkbtn', onclick: () => Session.start(ids, 'full') }, t('Full session'))
          : h('button', { type: 'button', class: 'linkbtn', onclick: () => Session.start(ids, 'badday') }, t('{n}-minute version', { n: s.badMinutes })),
        reviewDue.length ? h('button', { type: 'button', class: 'linkbtn', onclick: () => Session.start(reviewDue.map((c) => c.id), 'review') }, t('Review run ({n} due)', { n: reviewDue.length })) : null),
      h('button', { type: 'button', class: 'linkbtn small', style: { alignSelf: 'flex-start', fontWeight: 500 }, onclick: () => go('library') }, t('Choose another clip'))));
}

/* a frame of the clip when its video is loaded, otherwise the speaker's melody */
function drawThumb(clip) {
  const box = $('#todayThumb');
  if (!box) return;
  const c = box.querySelector('canvas');
  const v = Player.v;
  const sameVideo = Player.current() && Player.current().id === clip.videoId;
  const paint = () => {
    if (!c.isConnected || !v.videoWidth) return false;
    const r = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext('2d');
    const s = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
    const w = v.videoWidth * s, hh = v.videoHeight * s;
    try { g.drawImage(v, (c.width - w) / 2, (c.height - hh) / 2, w, hh); return true; } catch { return false; }
  };
  if (sameVideo && v.readyState >= 2 && Math.abs(v.currentTime - clip.start) < 1.5 && paint()) return;
  if (sameVideo) {
    if (Math.abs(v.currentTime - clip.start) >= 1.5 && v.paused) Player.seek(clip.start);
    const once = () => { v.removeEventListener('seeked', once); v.removeEventListener('loadeddata', once); if (!paint()) melodyThumb(box, clip); };
    v.addEventListener('seeked', once); v.addEventListener('loadeddata', once);
  }
  melodyThumb(box, clip);
}
function melodyThumb(box, clip) {
  if (box.querySelector('.melody') || !clip.model || !clip.model.st) return;
  const st = clip.model.st, n = st.length;
  let d = '', pen = false;
  for (let i = 0; i < n; i += 3) {
    const v = median(st.slice(Math.max(0, i - 4), i + 5).filter((x) => x != null && Math.abs(x) <= 12));
    if (!isFinite(v) || st[i] == null) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${((i / n) * 300).toFixed(1)} ${(50 - v * 3.6).toFixed(1)} `;
    pen = true;
  }
  if (!d) return;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('class', 'melody'); el.setAttribute('viewBox', '0 0 300 100'); el.setAttribute('preserveAspectRatio', 'none'); el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<path d="${d}" fill="none" stroke="var(--speaker)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  box.appendChild(el);
}

function todaySide(info, state) {
  const target = settings().weeklyTarget;
  const today = dayKey();
  const ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const week = h('div', { class: 'box' },
    h('div', { class: 'box-head' }, h('h3', null, t('This week')), h('span', { class: 'num small muted' }, t('{done} of {target}', { done: info.weekCount, target }))),
    h('div', { class: 'week', role: 'img', 'aria-label': t('{done} of {target} practice days this week', { done: info.weekCount, target }) }, days.map((d) => {
      const done = info.days.has(d);
      const cls = done ? 'done' : d === today ? 'now' : 'short';
      return h('div', null, h('span', { class: `pill ${cls}` }), dayName(parseDay(d).getDay()).slice(0, 2));
    })),
    h('p', { class: 'small muted' }, info.streak ? tp(info.streak, '{n} day in a row', '{n} days in a row') : t('A short session today starts a streak.')));
  const out = [week];
  const focus = topFocus();
  if (focus) {
    out.push(h('div', { class: 'box' }, h('h3', null, t('Listen for')), h('p', null, focus),
      h('button', { type: 'button', class: 'linkbtn small', style: { alignSelf: 'flex-start' }, onclick: () => go('progress', 'issues') }, t('Your notes on it'))));
  }
  out.push(checkinBox());
  const dismissed = lsGet('dismissed', {});
  if (!dismissed.headphones && state === 'plan') {
    out.push(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h3', null, t('Headphones on')), icon('headphones')),
      h('p', { class: 'small' }, t('Wired is best. Without them, the microphone picks up the video and your recordings are off.')),
      btn(t('Got it'), () => { dismissed.headphones = true; lsSet('dismissed', dismissed); renderToday(); }, { size: 'sm', cls: 'self-start' })));
  }
  out.push(h('div', { class: 'box' }, h('h3', null, t('Ask Euno')), h('p', { class: 'small' }, t('About a sound, your notes, or what to practise next.')),
    h('button', { type: 'button', class: 'linkbtn', style: { alignSelf: 'flex-start' }, onclick: () => go('ask') }, t('Ask a question'))));
  return h('aside', { class: 'tside' }, out);
}

function checkinBox() {
  const base = checkinFor(0);
  const due = dueCheckin();
  const start = programmeStart();
  if (!checkinHasAll(base)) {
    return h('div', { class: 'box' }, h('h3', null, t('Week 0 baseline')),
      h('p', { class: 'small' }, t('About 3 minutes. Every later check-in is compared with it, so record it before you practise much.')),
      btn(t('Record it'), () => openCheckins(0), { size: 'sm', icon: 'mic', cls: 'self-start' }));
  }
  if (due != null) {
    return h('div', { class: 'box' }, h('h3', null, t('Week {n} check-in', { n: due })), h('p', { class: 'small' }, t('Due now, about 3 minutes.')),
      btn(t('Start check-in'), () => openCheckins(due), { size: 'sm', icon: 'mic', cls: 'self-start' }));
  }
  const next = CHECKIN_WEEKS.find((w) => !checkinHasAll(checkinFor(w)));
  if (next == null) return h('div', { class: 'box' }, h('h3', null, t('Check-ins')), h('p', { class: 'small muted' }, t('All four done. Compare them in Progress.')));
  return h('div', { class: 'box' }, h('h3', null, t('Week {n} check-in', { n: next })),
    h('p', { class: 'small muted' }, t('{date}, about 3 minutes', { date: fmtDate(parseDay(addDays(start, next * 7)), { weekday: 'long', day: 'numeric', month: 'long' }) })));
}
