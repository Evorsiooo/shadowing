/* ---------- pronunciation differences at the sound level: the shared data layer ----------
   One data object per recorded pass, saved on the recording as `phones`:
     { v: 1, diffs: [{ a, b, words, speaker: ['θ','r','iː'], you: ['s','r','iː'], from: 'θ', to: 's', conf: 0..1 }],
       sounds: { 'θ': 4, 'r': 9, ... } }
   a, b: seconds from the clip's start. words: the words around it ('' when unknown). from/to: the speaker's sound and
   the one the recogniser heard from the learner. sounds: how many times each of the speaker's sounds occurs in the
   clip (the denominator for "flagged vs occurred"). The recogniser is about 90% right per phone, so it can be wrong.
   The engine (global Phones, contract in docs/PRONUNCIATION.md) fills it in through PhonesAdapter below; PronMock stands in
   until it is in the build and is only used when asked for (?pronmock=1 or localStorage euno_pronmock=1), never for real learners.
   Everything else lives on this device in one small `meta` document ('pron'): per-sound-pair tallies, the sounds the
   learner said "sound the same" to, and which automatic notes were made. It is written once per recorded pass. */

const PRON_SHOWN = 3; // at most this many differences in the review card
const PRON_AUTO = { minDays: 2, minShare: 0.2, minPlaces: 8 }; // guesses until the native-ear check has been done
/* when a sound has "gone quiet" (all guesses until the native-ear check): chances are places where the speaker has that
   sound, so a week without practice, or clips without the sound, never count towards it */
const PRON_QUIET = { chances: 10, days: 14, maxRecent: 1, recentDays: 30, easeWindow: 14, easeMin: 6, relapseDays: 14, relapseShare: 0.3, keepDays: 120, trendGap: 0.2 };

/* spelling and an everyday example word for the sounds the recogniser may report (English) */
const PHONE_INFO = {
  'θ': ['th', 'think'], 'ð': ['th', 'this'], 's': ['s', 'sit'], 'z': ['z', 'zoo'], 'ʃ': ['sh', 'she'], 'ʒ': ['zh', 'vision'],
  'tʃ': ['ch', 'chair'], 'dʒ': ['j', 'judge'], 'f': ['f', 'fan'], 'v': ['v', 'very'], 'w': ['w', 'we'], 'j': ['y', 'yes'],
  'r': ['r', 'red'], 'l': ['l', 'let'], 'h': ['h', 'hat'], 'm': ['m', 'man'], 'n': ['n', 'net'], 'ŋ': ['ng', 'sing'],
  'p': ['p', 'pen'], 'b': ['b', 'bat'], 't': ['t', 'top'], 'd': ['d', 'dog'], 'k': ['k', 'kit'], 'g': ['g', 'go'],
  'iː': ['ee', 'see'], 'ɪ': ['i', 'sit'], 'ʊ': ['oo', 'put'], 'uː': ['oo', 'too'], 'ə': ['uh', 'about'], 'æ': ['a', 'cat'],
  'ɛ': ['e', 'bed'], 'e': ['e', 'bed'], 'ʌ': ['u', 'cup'], 'ɑː': ['ah', 'father'], 'ɒ': ['o', 'lot'], 'ɔː': ['aw', 'thought'],
  'ɜː': ['er', 'bird'], 'eɪ': ['ay', 'say'], 'aɪ': ['eye', 'my'], 'ɔɪ': ['oy', 'boy'], 'əʊ': ['oh', 'go'], 'oʊ': ['oh', 'go'], 'aʊ': ['ow', 'now'],
};
const soundName = (ph) => (PHONE_INFO[ph] ? PHONE_INFO[ph][0] : ph);
const soundWord = (ph) => (PHONE_INFO[ph] ? PHONE_INFO[ph][1] : '');

/* stands in for the engine while it is being built: the same shape, made up from the clip and the take */
const PronMock = {
  catalog: [
    { from: 'θ', to: 's', speaker: ['θ', 'r', 'iː'], you: ['s', 'r', 'iː'], word: 'three' },
    { from: 'ð', to: 'd', speaker: ['ð', 'æ', 't'], you: ['d', 'æ', 't'], word: 'that' },
    { from: 'w', to: 'v', speaker: ['w', 'ʊ', 'd'], you: ['v', 'ʊ', 'd'], word: 'would' },
    { from: 'ɪ', to: 'iː', speaker: ['ɪ', 'z'], you: ['iː', 'z'], word: 'is' },
    { from: 'r', to: 'l', speaker: ['r', 'ɪ', 'l', 'i'], you: ['l', 'ɪ', 'l', 'i'], word: 'really' },
  ],
  async diff({ clip, slot }) {
    const dur = Math.max(4, (clip.end || 0) - (clip.start || 0));
    const k = [...String(clip.id || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % this.catalog.length;
    const pick = [0, 1, 2].map((i) => this.catalog[(k + i) % this.catalog.length]);
    // the final take keeps two of step 3's differences, drops one and adds a new one
    const list = slot === 'final' ? [pick[1], pick[2], this.catalog[(k + 3) % this.catalog.length]] : pick;
    const diffs = list.map((c, i) => {
      const a = round(dur * (0.12 + 0.27 * i), 1);
      return { a, b: round(a + 0.7, 1), words: c.word, speaker: c.speaker, you: c.you, from: c.from, to: c.to, conf: round(0.85 - i * 0.1, 2) };
    });
    return { v: 1, diffs, sounds: { 'θ': 4, 'ð': 6, 'w': 5, 'ɪ': 7, 'r': 8, 'æ': 5 } };
  },
};

/* the clip's word (src/js/26-words.js) a sound belongs to, for "in “word”" labels; '' when the clip has none.
   One word: the one the sound's MIDDLE falls in, or else the nearest one within 0.15 s. Whisper's word times are rough
   (often 50-150 ms off, and short words get 50 ms), so a stretch of 0.3 s or more named up to four neighbouring words. */
function wordsAt(clip, a, b) {
  const c = Store.get('clips', clip.id) || clip, ws = (c && c.words) || [];
  if (!ws.length) return '';
  const mid = (a + b) / 2;
  let best = null, bd = 0.15;
  for (const x of ws) {
    const d = mid < x.s ? x.s - mid : mid > x.e ? mid - x.e : 0;
    if (d < bd || (d === 0 && best && best.d > 0)) { best = { w: x.w, d }; bd = d; if (d === 0) break; }
  }
  return best ? best.w : '';
}
/* turns the engine's ClipResult (global Phones.analyse, src/phones/contract.d.ts) into the shape above:
   substitutions only (not extra or missing sounds yet), model noise (`weak`) left out, the engine's own pick first */
const PhonesAdapter = {
  ready() { return !!(typeof Phones !== 'undefined' && typeof Phones.analyse === 'function' && Phones.supported().ok); },
  async diff({ clip, samples, recId, onProgress, background }) {
    if (!samples) return null;
    return Prep.around(clip, 2, onProgress, (onP) => this.compare(clip, samples, onP, recId, background));
  },
  async compare(clip, samples, onProgress, recId, background) {
    clip = Store.get('clips', clip.id) || clip; // its words and sounds may have just been worked out
    const given = Prep.speakerSeq(clip);
    const speaker = given ? null : VideoAudio.slice(clip.videoId, clip.start, clip.end);
    if (!given && !speaker) return null;
    const r = await Heavy.run('pronunciation', () => Phones.analyse(speaker, samples, { speakerOriginSec: 0, speakerSeq: given, onProgress }), { timeoutMs: 90000, ...(background ? { background: () => true } : {}) });
    if (r) Prep.saveTake(recId, clip, r, given && given.fp); // every result is kept with the take, also a low-quality one
    if (!r || r.status !== 'ok') return null;
    const syms = (seq, w) => (w == null || !seq.words[w] ? [] : seq.phones.slice(seq.words[w].first, seq.words[w].last + 1).map((p) => p.sym));
    const diffs = r.comparison.diffs.filter((d) => d.kind === 'sub' && !d.weak).map((d) => {
      const [from, to] = d.pair.split('→');
      return { a: d.t0, b: Math.max(d.t1, d.t0 + 0.3), words: wordsAt(clip, d.t0, d.t1), speaker: syms(r.speaker, d.speakerWord), you: syms(r.learner, d.learnerWord), from, to, conf: d.confidence + (r.suggested.includes(d.id) ? 1 : 0) };
    });
    const sounds = {};
    for (const p of r.speaker.phones) sounds[p.sym] = (sounds[p.sym] || 0) + 1;
    return { v: 1, diffs, sounds };
  },
};

const Pron = {
  engine() {
    if (PhonesAdapter.ready()) return PhonesAdapter;
    return this.mockAsked() ? PronMock : null;
  },
  mockAsked() {
    try { return /[?&]pronmock=1/.test(location.search) || localStorage.getItem('euno_pronmock') === '1'; } catch { return false; }
  },
  /* the feature exists in this build/browser, for an English target */
  available() { return !!this.engine() && targetLang() === 'en'; },
  /* the one switch is Settings → Analysis (Heavy, off by default, remembered per device). With the real engine the model must also be
     on this device, so nothing shows up or runs before it has been downloaded. The demo mock (?pronmock=1) skips both. */
  modelReady() { return this.engine() !== PhonesAdapter || ['downloaded', 'loading', 'ready'].includes(Phones.status().state); },
  enabled() { return this.available() && (this.mockAsked() || Heavy.isOn('pronunciation')); }, // the Pronunciation tab (and its download button) may show
  on() { return this.enabled() && (this.mockAsked() || this.modelReady()); }, // differences are computed and shown around the app

  /* ---- the small device-side document ---- */
  doc() { return Store.get('meta', 'pron') || { id: 'pron', tally: {}, occ: {}, blocked: [], seen: [], autoMade: [] }; },
  save(d) { Store.put('meta', d); },
  pairOf(d) { return `${d.from}→${d.to}`; },
  pairName(pair) { const [f, to] = pair.split('→'); return `${soundName(f)} → ${soundName(to)}`; },
  blocked(pair) { return this.doc().blocked.includes(pair); },

  /* a plain sentence for why the engine stopped (Heavy and Phones errors carry a code; the message is the real reason) */
  reason(e) {
    const code = e && e.code, msg = String((e && e.message) || '').slice(0, 200);
    const by = { timeout: t('It took too long on this device and was stopped.'), 'too-slow': t('It took too long on this device and was stopped.'), cancelled: t('It was stopped before it finished.'), 'low-memory': t('The page is using nearly all the memory the browser allows.'), 'out-of-memory': t('The device ran out of memory.'), off: t('Pronunciation analysis is off on this device.') };
    return by[code] || msg || t('Something went wrong.');
  },

  /* get ready after a listen-only pass, while the video is paused (never during playback: it yields to the video): the model, and the speaker's sounds and words if the clip doesn't have them yet (27-prepare.js).
     Only started on a pass that is not recorded. */
  warm(clip) {
    if (!clip || !this.on()) return;
    Prep.ensure(clip, { background: true, warm: true }).catch((e) => console.info('pronunciation warm-up skipped:', this.reason(e)));
  },

  /* tidy what the engine returned: bounded, only the fields we use */
  clean(res) {
    const arr = (x) => (Array.isArray(x) ? x.slice(0, 12).map(String) : []);
    const diffs = (res.diffs || []).filter((d) => d && d.from && d.to && d.from !== d.to && isFinite(d.a)).slice(0, 30).map((d) => ({
      a: round(+d.a, 2), b: round(isFinite(d.b) ? +d.b : +d.a + 0.6, 2), words: String(d.words || '').slice(0, 60),
      speaker: arr(d.speaker), you: arr(d.you), from: String(d.from), to: String(d.to), conf: round(isFinite(d.conf) ? +d.conf : 0.5, 2),
    }));
    const sounds = {};
    for (const [k, v] of Object.entries(res.sounds || {})) if (isFinite(v) && v > 0) sounds[k] = Math.min(999, Math.round(v));
    return { v: 1, diffs, sounds };
  },

  /* run the engine on a finished pass, keep the result on the recording and add it to the tally. Resolves with the phones or null */
  /* day: the day an older take was recorded (a take analysed afterwards, Rank.prepareTakes); background: nobody is waiting, so it steps aside for playback */
  async process({ clip, samples, blob, analysis, recId, slot, sessionId, pass, step, onProgress, onError, day, background }) {
    if (!this.on() || !clip) return null;
    let res = null;
    try { res = await this.engine().diff({ clip, samples, blob, analysis, slot, recId, onProgress, background }); } catch (e) { const why = this.reason(e); console.warn('pronunciation engine failed:', why, e && e.code, e); if (onError) onError(why); return null; }
    if (!res || !Array.isArray(res.diffs)) return null;
    const phones = this.clean(res);
    if (recId) Store.patch('recordings', recId, { phones });
    this.record(phones, { clip, token: recId || `${sessionId}:${pass}`, recId, sessionId, pass, step, day });
    return phones;
  },

  /* add one recorded pass to the per-sound tally (once per pass), and make an automatic note when a pair has come back enough.
     Every tracked pair also gets this pass's "chances" (how often the speaker's sound occurred), flagged or not: that is
     what lets a pair be seen to have stopped, and what the trend is worked out from. */
  record(phones, { clip, token, recId, sessionId, pass, step, day }) {
    const d = this.doc();
    if (d.seen.includes(token)) return;
    d.seen = [...d.seen, token].slice(-300);
    const now = dayKey(), today = day || now, late = today < now; // `late`: an older take analysed afterwards, filed under the day it was recorded
    const pairsNow = new Map();
    for (const x of phones.diffs) pairsNow.set(this.pairOf(x), (pairsNow.get(this.pairOf(x)) || 0) + 1);
    for (const [s, n] of Object.entries(phones.sounds)) d.occ[s] = (d.occ[s] || 0) + n;
    for (const [pair, n] of pairsNow) {
      if (d.blocked.includes(pair)) continue;
      const e = d.tally[pair] || { f: 0, days: [], clips: [], last: today };
      e.f += n; e.last = e.last && e.last > today ? e.last : today; e.first = e.first && e.first < today ? e.first : today;
      if (!e.days.includes(today)) e.days = [...e.days, today].sort().slice(-60);
      if (clip && !e.clips.includes(clip.id)) e.clips = [...e.clips, clip.id].slice(-30);
      e.ex = [...(e.ex || []), ...phones.diffs.filter((x) => this.pairOf(x) === pair).slice(0, 2).map((x) => ({ d: today, w: x.words || '', c: clip ? clip.id : '' }))].slice(-8);
      if (!late || !e.recId) { e.recId = recId || e.recId || null; e.sessionId = sessionId || e.sessionId || null; e.clipId = clip ? clip.id : e.clipId; e.pass = pass; e.step = step; }
      d.tally[pair] = e;
    }
    for (const [pair, e] of Object.entries(d.tally)) {
      if (d.blocked.includes(pair)) continue;
      const flagged = pairsNow.get(pair) || 0;
      const chances = Math.max(phones.sounds[pair.split('→')[0]] || 0, flagged);
      if (chances) this.addChances(e, today, flagged, chances);
      e.bk = (e.bk || []).filter((x) => x.d >= addDays(now, -PRON_QUIET.keepDays));
      this.settle(pair, e, now);
    }
    if (settings().pronAutoNotes) {
      for (const pair of pairsNow.keys()) {
        if (d.blocked.includes(pair) || d.autoMade.includes(pair) || !this.recurring(d, pair)) continue;
        this.makeAutoNote(d, pair);
      }
    }
    this.save(d);
  },

  /* ---- history: daily buckets {d, f: flagged, o: chances}, newest last, kept for PRON_QUIET.keepDays ---- */
  addChances(e, day, f, o) {
    e.bk = e.bk || [];
    let b = e.bk.find((x) => x.d === day);
    if (!b) { b = { d: day, f: 0, o: 0 }; e.bk.push(b); e.bk.sort((p, q) => (p.d < q.d ? -1 : 1)); } // newest last, also when an older take is added afterwards
    b.f += f; b.o += o;
  },
  sumBuckets(e, from, to) {
    let f = 0, o = 0;
    for (const b of e.bk || []) if (b.d >= from && b.d <= to) { f += b.f; o += b.o; }
    return { f, o };
  },
  /* more / less often: the last 14 days against the 14 before, only with enough chances in both (wide bands: the recogniser is noisy) */
  trend(e, today = dayKey()) {
    const Q = PRON_QUIET;
    const recent = this.sumBuckets(e, addDays(today, -(Q.easeWindow - 1)), today);
    const before = this.sumBuckets(e, addDays(today, -(2 * Q.easeWindow - 1)), addDays(today, -Q.easeWindow));
    let label = null;
    if (recent.o >= Q.easeMin && before.o >= Q.easeMin) {
      const gap = recent.f / recent.o - before.f / before.o;
      label = gap <= -Q.trendGap ? 'less' : gap >= Q.trendGap ? 'more' : 'same';
    }
    return { recent, before, label };
  },
  /* 'active' | 'easing' | 'archived' for one tally entry; `was` is its previous state (relapse needs it) */
  status(e, today = dayKey()) {
    const Q = PRON_QUIET, bk = e.bk || [];
    const was = e.state || 'active';
    if (!bk.length) return was;
    if (was === 'archived') {
      const flagDays = bk.filter((b) => b.f > 0 && b.d >= addDays(today, -(Q.relapseDays - 1))).length;
      let o = 0, f = 0;
      for (let i = bk.length - 1; i >= 0 && o < 10; i--) { o += bk[i].o; f += bk[i].f; }
      return flagDays >= 2 || (o >= 5 && f / o >= Q.relapseShare) ? 'active' : 'archived';
    }
    const since = bk.filter((b) => b.d > e.last).reduce((n, b) => n + b.o, 0);
    const r30 = this.sumBuckets(e, addDays(today, -(Q.recentDays - 1)), today);
    if (since >= Q.chances && daysBetween(e.last, today) >= Q.days && r30.f <= Q.maxRecent) return 'archived';
    const T = this.trend(e, today);
    if (T.recent.o >= Q.easeMin && T.before.o >= Q.easeMin && T.before.f > 0 && T.recent.f / T.recent.o <= (T.before.f / T.before.o) / 2) return 'easing';
    return 'active';
  },
  /* move a pair to its new state; an unconfirmed automatic note is hidden while archived (when the setting is on) and comes back on relapse */
  settle(pair, e, today = dayKey()) {
    const next = this.status(e, today);
    if (next === (e.state || 'active')) return;
    e.state = next; e.stateAt = today;
    this.flagNote(e, next === 'archived');
  },
  flagNote(e, archived) {
    const n = e.noteId && Store.get('notes', e.noteId);
    if (!n || !n.auto || n.confirmed) return;
    if (archived && settings().pronAutoArchive === false) return;
    Store.patch('notes', n.id, archived ? { archived: true, archivedAt: dayKey() } : { archived: false, archivedAt: null });
  },
  /* an archived pair is out of the main list only while "hide quiet sounds" is on */
  hidden(e) { return e.state === 'archived' && settings().pronAutoArchive !== false; },
  /* "Still happening to me" */
  reopen(pair) {
    const d = this.doc();
    const e = d.tally[pair];
    if (!e) return;
    e.state = 'active'; e.stateAt = dayKey(); e.last = dayKey();
    this.flagNote(e, false);
    this.save(d);
  },
  /* the Issues row of a confirmed pair, if its sound has gone quiet: offers "Mark as fixed?" (the learner's own record is never changed by software) */
  quietIssue(issueId) {
    const d = this.doc();
    return Object.entries(d.tally).some(([pair, e]) => e.state === 'archived' && !d.blocked.includes(pair) && e.noteId && (Store.get('notes', e.noteId) || {}).issueId === issueId);
  },
  /* one English line for the AI about a pair's history; '' when there is nothing useful to say */
  historyLine(pair) {
    const d = this.doc();
    const e = d.tally[pair];
    if (!e || d.blocked.includes(pair) || !(e.bk || []).length) return '';
    const T = this.trend(e);
    const name = `"${pair}"`;
    if (e.state === 'archived') return `History: the learner's ${name} was flagged earlier (last on ${e.last}) and has been quiet since${e.stateAt ? ` (archived ${e.stateAt})` : ''}.`;
    const first = e.first ? `, first seen ${e.first}` : '';
    if (!T.recent.o) return '';
    const before = T.before.o ? ` (${T.before.f} of ${T.before.o} before)` : '';
    return `History: the learner's ${name} was flagged in ${T.recent.f} of ${T.recent.o} chances in the last 2 weeks${before}${first}${T.label ? `, trend: ${{ less: 'less often', more: 'more often', same: 'about the same' }[T.label]}` : ''}.`;
  },

  /* flagged on 2+ different days and in about half or more of the places that sound occurred */
  recurring(d, pair) {
    const e = d.tally[pair];
    if (!e) return false;
    const occ = d.occ[pair.split('→')[0]] || 0;
    return e.days.length >= PRON_AUTO.minDays && occ >= PRON_AUTO.minPlaces && e.f / occ >= PRON_AUTO.minShare;
  },
  share(d, pair) { const e = d.tally[pair]; const occ = d.occ[pair.split('→')[0]] || 0; return { flagged: e ? Math.min(e.f, occ) : 0, occurred: occ }; },

  /* an automatic note: "possible", never sent to the AI until the learner taps Ask Euno on it */
  makeAutoNote(d, pair) {
    const e = d.tally[pair];
    const [from, to] = pair.split('→');
    const clip = Store.get('clips', e.clipId);
    const note = Store.put('notes', {
      auto: true, pair, clipId: e.clipId, sessionId: e.sessionId, recId: e.recId, pass: e.pass, step: e.step,
      sentence: (clip && clip.sentence) || '',
      off: t('Possibly {to} where the speaker says {from}. Flagged on {days} days.', { to: soundName(to), from: soundName(from), days: e.days.length }),
      aim: soundWord(from) ? t('{sound} as in “{word}”', { sound: soundName(from), word: soundWord(from) }) : '',
      reply: null, date: dayKey(), created: new Date().toISOString(),
    });
    d.autoMade = [...d.autoMade, pair];
    e.noteId = note.id;
  },
  autoNote(pair) { const e = this.doc().tally[pair]; return e && e.noteId ? Store.get('notes', e.noteId) : null; },

  /* "Sounds the same to me": forget the tally for this pair, drop its unconfirmed note and never raise it again */
  dismiss(pair) {
    const d = this.doc();
    const e = d.tally[pair];
    if (e && e.noteId) {
      const n = Store.get('notes', e.noteId);
      if (n && n.auto && !n.confirmed) { delete Store.data.notes[n.id]; Store.schedule('notes', n.id, 0); }
    }
    delete d.tally[pair];
    if (!d.blocked.includes(pair)) d.blocked = [...d.blocked, pair];
    this.save(d);
  },
  allow(pair) { const d = this.doc(); d.blocked = d.blocked.filter((p) => p !== pair); this.save(d); },
  confirm(pair) {
    const n = this.autoNote(pair);
    if (!n) return;
    Store.patch('notes', n.id, { confirmed: true });
    linkIssue(Store.get('notes', n.id), this.pairName(pair));
  },

  /* ---- choosing what to show ---- */
  same(a, b) {
    if (a.from !== b.from || a.to !== b.to) return false;
    return a.words && b.words ? a.words.toLowerCase() === b.words.toLowerCase() : Math.abs(a.a - b.a) < 0.6;
  },
  /* the differences worth showing for one take: not dismissed, repeats first, then confidence; at most three */
  shown(phones, other) {
    if (!phones) return { items: [], total: 0 };
    const d = this.doc();
    const ok = phones.diffs.filter((x) => !d.blocked.includes(this.pairOf(x)));
    const score = (x) => (other && other.diffs.some((y) => this.same(x, y)) ? 10 : 0) + x.conf;
    const items = [...ok].sort((p, q) => score(q) - score(p)).slice(0, PRON_SHOWN).sort((p, q) => p.a - q.a);
    return { items, total: ok.length, repeated: (x) => !!(other && other.diffs.some((y) => this.same(x, y))) };
  },
  /* the saved phones for a recording, or the ones from the pass that was just recorded */
  phonesFor(recId, sessionId) {
    const rec = recId && Store.get('recordings', recId);
    if (rec && rec.phones) return rec.phones;
    const R = typeof Session !== 'undefined' && Session.review;
    if (R && R.phones && ((recId && R.recId === recId) || (sessionId && Session.doc && Session.doc.id === sessionId))) return R.phones;
    return null;
  },
  /* what an AI or a note should hear about a take */
  itemsFor(recId, sessionId) {
    if (!this.on()) return [];
    return this.shown(this.phonesFor(recId, sessionId)).items;
  },

  /* ---- "Drill this": the learner's recorded snippet against the SPEAKER's audio for the same stretch (never a transcript).
     result: 'clear' = that sound was not flagged this time, 'still' = flagged again, 'unclear' = could not be checked.
     'clear' is one short try judged by a recogniser that can be wrong, so it never counts as "fixed" or goes into the tally. ---- */
  async drillCheck(clip, d, a, b, samples, onProgress) {
    if (!this.on() || !samples || !samples.length || !PhonesAdapter.ready()) return { result: 'unclear', why: t('Pronunciation analysis isn’t ready on this device.') };
    let spk = VideoAudio.slice(clip.videoId, clip.start + a, clip.start + b);
    if (!spk) { const v = Store.get('videos', clip.videoId); if (v) { await VideoAudio.ensure(v, clip.start + a, clip.start + b); spk = VideoAudio.slice(clip.videoId, clip.start + a, clip.start + b); } }
    if (!spk || !spk.length) return { result: 'unclear', why: t('The speaker’s audio for this stretch isn’t loaded.') };
    let r = null;
    try { r = await Heavy.run('pronunciation', () => Phones.analyse(spk, samples, { speakerOriginSec: 0, onProgress }), { timeoutMs: 90000 }); } catch (e) { return { result: 'unclear', why: this.reason(e) }; }
    if (!r || r.status !== 'ok' || !r.comparison) return { result: 'unclear', why: t('Too little clear speech in the recording to compare.') };
    const syms = (seq, w) => (w == null || !seq.words[w] ? [] : seq.phones.slice(seq.words[w].first, seq.words[w].last + 1).map((p) => p.sym));
    const diffs = r.comparison.diffs.filter((x) => x.kind === 'sub' && !x.weak).slice(0, 12).map((x) => {
      const [from, to] = x.pair.split('→');
      return { a: round(x.t0, 2), b: round(Math.max(x.t1, x.t0 + 0.3), 2), words: '', speaker: syms(r.speaker, x.speakerWord), you: syms(r.learner, x.learnerWord), from, to, conf: round(x.confidence, 2) };
    });
    const sounds = {};
    for (const p of r.speaker.phones) sounds[p.sym] = (sounds[p.sym] || 0) + 1;
    if (!sounds[d.from]) return { result: 'unclear', why: t('The snippet didn’t include that sound clearly enough to check it.') };
    const pair = this.pairOf(d);
    const still = diffs.some((x) => this.pairOf(x) === pair);
    return { result: still ? 'still' : 'clear', others: diffs.filter((x) => this.pairOf(x) !== pair && !this.doc().blocked.includes(this.pairOf(x))).slice(0, 2), phones: { v: 1, diffs, sounds } };
  },
  /* keep the drill (and the take, when there is one) on the account so it syncs; the 'pron' document holds a short list */
  async recordDrill(clip, d, res, blob) {
    let recId = null;
    if (blob && blob.size) {
      try {
        const ref = await Store.putBlob(blob);
        recId = Store.put('recordings', { kind: 'drill', clipId: clip.id, pair: this.pairOf(d), result: res.result, ref, mime: blob.type, created: new Date().toISOString(), phones: res.phones || null }).id;
      } catch (e) { console.warn('drill take not saved', e); }
    }
    const doc = this.doc();
    doc.drills = [...(doc.drills || []), { d: dayKey(), pair: this.pairOf(d), clipId: clip.id, r: res.result, rec: recId }].slice(-200);
    this.save(doc);
    return recId;
  },
  drillsFor(pair) { return (this.doc().drills || []).filter((x) => x.pair === pair); },
  drillLine(pair) {
    const L = this.drillsFor(pair), ok = L.filter((x) => x.r === 'clear').length, bad = L.filter((x) => x.r === 'still').length;
    return L.length ? t('Drills so far: {ok} not flagged, {bad} flagged again.', { ok, bad }) : '';
  },

  /* a 2-4 s stretch of the clip around a difference, as seconds from the clip's start */
  snippet(clip, d) {
    const dur = clip.end - clip.start;
    const a = Math.max(0, d.a - 0.5);
    const b = Math.min(dur, Math.min(a + 4, Math.max(d.b + 0.5, a + 2)));
    return [round(a, 2), round(Math.max(b, a + 1), 2)];
  },

  /* the lines the AI gets, English only (the prompt is English) */
  aiLines(items) {
    return items.map((d) => {
      const where = `${d.words ? `around "${d.words}" ` : ''}(${d.a}-${d.b} s)`;
      return `Phones ${where}: speaker "${d.speaker.join(' ')}", learner "${d.you.join(' ')}".`.slice(0, 200);
    });
  },

  /* ---- step 3 against the final pass ---- */
  compareTakes(A, B) {
    if (!A || !B) return null;
    const d = this.doc();
    const keep = (p) => p.diffs.filter((x) => !d.blocked.includes(this.pairOf(x)));
    const a = keep(A), b = keep(B);
    return {
      gone: a.filter((x) => !b.some((y) => this.same(x, y))),
      still: b.filter((x) => a.some((y) => this.same(x, y))),
      fresh: b.filter((x) => !a.some((y) => this.same(x, y))),
    };
  },

  /* tallies worth listing in Progress → Issues: flagged on 2+ days, not dismissed, not already confirmed as an issue.
     `quiet` ones (gone quiet, hidden while the setting is on) are listed separately by quietAcross(). */
  rows() {
    const d = this.doc();
    return Object.entries(d.tally)
      .filter(([pair, e]) => !d.blocked.includes(pair) && e.days.length >= 2)
      .map(([pair, e]) => ({ pair, e, note: e.noteId ? Store.get('notes', e.noteId) : null, recurring: this.recurring(d, pair), state: e.state || 'active', trend: this.trend(e), ...this.share(d, pair) }))
      .filter((r) => !(r.note && r.note.confirmed));
  },
  seenAcross() {
    return this.rows().filter((r) => !this.hidden(r.e)).sort((x, y) => (y.recurring - x.recurring) || (y.e.days.length - x.e.days.length));
  },
  quietAcross() {
    return this.rows().filter((r) => this.hidden(r.e)).sort((x, y) => (x.e.stateAt < y.e.stateAt ? 1 : -1));
  },
};

/* the two switches in Settings → Analysis (src/js/21-heavy.js). Both are off until the learner turns them on, on this device. */
Heavy.register('pronunciation', {
  name: N_('Pronunciation analysis'),
  about: N_('The main feature: compares the sounds in your recording with the speaker’s, on this device, and shows where they differ (for example “th” said as “s”). English only. It can be wrong.'),
  sizeMB: 71, minMemGB: 4, minCores: 4,
  cacheNames: ['euno-phones-model-v1'],
  prefetch: ({ signal }) => Phones.download({ signal }),
  status: () => Phones.status(),
  onStatus: (fn) => Phones.onStatus(fn),
  remove: () => Phones.remove(),
});
Heavy.register('prosody', {
  name: N_('Timing, pitch and stress history'),
  about: N_('Counts how often your timing, pitch or stress differed from the speaker, so Progress can show a trend. No download. The counts are saved with your account like your sessions and notes, so they follow you to your other devices; this switch only decides whether this device adds to them.'),
  sizeMB: 0, minMemGB: 0.25, minCores: 1,
});
