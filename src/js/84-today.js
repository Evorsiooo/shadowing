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
  mount(el, h('div', { class: 'stage' }, todayGreeting(state), todayCard(state, clip, info), todayBelow(state)), todaySide(info, state));
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

/* a frame from the start of the clip, once its video can be drawn (until then the box stays plain) */
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
    try { g.drawImage(v, (c.width - w) / 2, (c.height - hh) / 2, w, hh); box.classList.add('drawn'); return true; } catch { return false; }
  };
  if (!sameVideo) return;
  if (v.readyState >= 2 && Math.abs(v.currentTime - clip.start) < 1.5 && paint()) return;
  if (Math.abs(v.currentTime - clip.start) >= 1.5 && v.paused) Player.seek(clip.start);
  const once = () => { v.removeEventListener('seeked', once); v.removeEventListener('loadeddata', once); paint(); };
  v.addEventListener('seeked', once); v.addEventListener('loadeddata', once);
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
  const out = [week, recentClipsBox()];
  const dismissed = lsGet('dismissed', {});
  if (!dismissed.headphones && state === 'plan') {
    out.push(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h3', null, t('Headphones on')), icon('headphones')),
      h('p', { class: 'small' }, t('Wired is best. Without them, the microphone picks up the video and your recordings are off.')),
      btn(t('Got it'), () => { dismissed.headphones = true; lsSet('dismissed', dismissed); renderToday(); }, { size: 'sm', cls: 'self-start' })));
  }
  // Euno sits behind the This week card, looking over at the main card's Start button
  return h('aside', { class: 'tside peek' }, todayEuno(state), out);
}

/* clips that have the sounds the learner keeps getting flagged on (28-rank.js). Only clips whose sounds are saved can be suggested; nothing is shown otherwise.
   A rough guide: the sound labels come from the pronunciation model and can be wrong. "Queue them" puts them in the queue Today starts from. */
function fitBox(state) {
  if (state !== 'plan' || typeof Rank === 'undefined') return null;
  let picks;
  try { picks = Rank.pick(Rank.liveClips(), Rank.infoFn(), { today: dayKey(), max: 3 }); } catch { return null; }
  if (!picks.length) return null;
  const info = Rank.infoFn();
  const ids = picks.map((c) => c.id), queued = ids.every((id, i) => UI.queue[i] === id) && UI.queue.length === ids.length;
  return h('div', { class: 'box' }, h('h3', null, t('Clips for your sounds')),
    h('p', { class: 'small muted' }, t('These have sounds you’ve been getting flagged on. A rough guide: the labels can be wrong.')),
    h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, picks.map((c) => h('li', null, `${clipName(c)} · ${Rank.soundsText(info(c).match)}`))),
    queued ? h('p', { class: 'small muted' }, t('Queued. Press Start above.'))
      : btn(t('Queue them'), () => { UI.queue = ids; renderToday(); }, { size: 'sm', cls: 'self-start' }));
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

/* over the main card: the day, what kind of day it is in the routine, and a hello */
function todayGreeting(state) {
  const d = new Date();
  const wd = d.getDay();
  const kind = wd === 0 ? t('a rest day') : [2, 4, 6].includes(wd) ? t('a repeat day') : t('a new-clip day');
  const hr = d.getHours();
  const name = (profile().name || '').trim();
  const hello = hr < 12 ? (name ? t('Good morning, {name}', { name }) : t('Good morning'))
    : hr < 18 ? (name ? t('Good afternoon, {name}', { name }) : t('Good afternoon'))
      : (name ? t('Good evening, {name}', { name }) : t('Good evening'));
  if (state === 'novideo' || state === 'noclips') return h('div', { class: 'tgreet' }, h('h2', null, hello));
  return h('div', { class: 'tgreet' }, h('p', { class: 'small muted' }, `${fmtDate(d, { weekday: 'long' })} · ${kind}`), h('h2', null, hello));
}

/* under the main card: what to listen for, what is coming up, and after a session what you recorded today */
function todayBelow(state) {
  if (state === 'novideo' || state === 'noclips') return null;
  const cards = [];
  if (state === 'done') { const rec = todayRecordingsBox(); if (rec) cards.push(rec); }
  const focus = topFocus();
  if (focus) {
    const issue = Store.all('issues').find((i) => i.name === focus);
    const n = issue ? (issue.noteIds || []).length : 0;
    cards.push(h('div', { class: 'box' },
      h('div', { class: 'box-head' }, h('h3', null, state === 'done' ? t('Listen for this next time') : t('Listen for this today')), n ? h('span', { class: 'small muted' }, tp(n, 'in {n} note', 'in {n} notes')) : null),
      h('p', null, focus),
      h('button', { type: 'button', class: 'linkbtn small', style: { alignSelf: 'flex-start' }, onclick: () => go('progress', 'issues') }, t('Your notes on it'))));
  }
  const fit = fitBox(state);
  if (fit) cards.push(fit);
  cards.push(h('div', { class: 'box' }, h('h3', { class: 'box-kicker small muted' }, t('Coming up')), Array.from(checkinBox().children)));
  return h('div', { class: 'tbelow' }, cards);
}

/* after today's session: hear your first and last recorded pass of the day */
function todayRecordingsBox() {
  const sess = Store.all('sessions').filter((s) => s.date === dayKey() && !s.empty).sort((a, b) => String(b.startedAt || b.id).localeCompare(String(a.startedAt || a.id)))[0];
  if (!sess || !sess.recs) return null;
  const recs = [['step3', t('Step 3')], ['final', t('Final pass')]].map(([k, l]) => [Store.get('recordings', sess.recs[k]), l]).filter(([r]) => r && r.ref);
  if (!recs.length) return null;
  const clip = Store.get('clips', sess.clipId);
  const play = async (r) => { try { Player2.stop(); const a = new window.Audio(await Store.blobUrl(r.ref)); Player2.el = a; a.play().catch(() => {}); } catch { toast(t('The recording couldn’t play.'), 'bad'); } };
  return h('div', { class: 'box wide' },
    h('div', { class: 'box-head' }, h('h3', null, t('Today’s recordings')), clip ? h('span', { class: 'small muted' }, clipName(clip)) : null),
    h('div', { class: 'trecs' }, recs.map(([r, l]) => h('div', { class: 'trec' }, h('b', null, l), h('span', { class: 'small muted' }, r.lag != null ? fmtLag(r.lag) : ''), btn(t('Play'), () => play(r), { size: 'sm', icon: 'play' })))),
    recs.length === 2 ? btn(t('Compare them on one chart'), () => openCompare(recs[0][0].id, recs[1][0].id), { size: 'sm', kind: 'ghost', cls: 'self-start' }) : null);
}

/* the clips practised most recently, one press from practising again */
function recentClipsBox() {
  const live = (c) => !c.archived && Store.get('videos', c.videoId) && !Store.get('videos', c.videoId).archived;
  const last = new Map();
  for (const s of Store.all('sessions')) if (!s.empty && s.clipId && (!last.has(s.clipId) || last.get(s.clipId) < s.date)) last.set(s.clipId, s.date);
  const clips = [...last.entries()].map(([id, d]) => [Store.get('clips', id), d]).filter(([c]) => c && live(c)).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 3);
  if (!clips.length) return null;
  const ago = (d) => { const n = Math.round((parseDay(dayKey()) - parseDay(d)) / 864e5); return n <= 0 ? t('today') : n === 1 ? t('yesterday') : tp(n, '{n} day ago', '{n} days ago'); };
  return h('div', { class: 'box' }, h('h3', null, t('Recent clips')),
    h('ul', { class: 'recent' }, clips.map(([c, d]) => h('li', null,
      h('div', { class: 'grow' }, h('b', null, clipName(c)), h('span', { class: 'small muted' }, ago(d))),
      btn('', () => Session.start([c.id], 'full'), { size: 'sm', icon: 'play', title: t('Practise this clip') })))),
    h('button', { type: 'button', class: 'linkbtn small', style: { alignSelf: 'flex-start' }, onclick: () => go('library') }, t('All videos and clips')));
}
