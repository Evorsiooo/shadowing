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
const PRON_AUTO = { minDays: 2, minShare: 0.5, minPlaces: 3 }; // guesses until the native-ear check has been done

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

/* turns the engine's ClipResult (global Phones.analyse, src/phones/contract.d.ts) into the shape above:
   substitutions only (not extra or missing sounds yet), model noise (`weak`) left out, the engine's own pick first */
const PhonesAdapter = {
  ready() { return !!(window.Phones && typeof Phones.analyse === 'function' && Phones.supported().ok); },
  async diff({ clip, samples }) {
    const speaker = VideoAudio.slice(clip.videoId, clip.start, clip.end);
    if (!speaker || !samples) return null;
    const r = await Phones.analyse(speaker, samples, { speakerOriginSec: clip.start });
    if (!r || r.status !== 'ok') return null;
    const syms = (seq, w) => (w == null || !seq.words[w] ? [] : seq.phones.slice(seq.words[w].first, seq.words[w].last + 1).map((p) => p.sym));
    const diffs = r.comparison.diffs.filter((d) => d.kind === 'sub' && !d.weak).map((d) => {
      const [from, to] = d.pair.split('→');
      return { a: d.t0, b: Math.max(d.t1, d.t0 + 0.3), words: '', speaker: syms(r.speaker, d.speakerWord), you: syms(r.learner, d.learnerWord), from, to, conf: d.confidence + (r.suggested.includes(d.id) ? 1 : 0) };
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
  /* also respects the Analysis switch from the safety work (Heavy, PR #72) once it is in the build */
  on() { return this.available() && !!settings().pronunciation && (typeof Heavy === 'undefined' || !Heavy.isOn || Heavy.isOn('pronunciation')); },

  /* ---- the small device-side document ---- */
  doc() { return Store.get('meta', 'pron') || { id: 'pron', tally: {}, occ: {}, blocked: [], seen: [], autoMade: [] }; },
  save(d) { Store.put('meta', d); },
  pairOf(d) { return `${d.from}→${d.to}`; },
  pairName(pair) { const [f, to] = pair.split('→'); return `${soundName(f)} → ${soundName(to)}`; },
  blocked(pair) { return this.doc().blocked.includes(pair); },

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
  async process({ clip, samples, blob, analysis, recId, slot, sessionId, pass, step }) {
    if (!this.on() || !clip) return null;
    let res = null;
    try { res = await this.engine().diff({ clip, samples, blob, analysis, slot }); } catch (e) { console.warn('pronunciation engine failed', e); return null; }
    if (!res || !Array.isArray(res.diffs)) return null;
    const phones = this.clean(res);
    if (recId) Store.patch('recordings', recId, { phones });
    this.record(phones, { clip, token: recId || `${sessionId}:${pass}`, recId, sessionId, pass, step });
    return phones;
  },

  /* add one recorded pass to the per-sound tally (once per pass), and make an automatic note when a pair has come back enough */
  record(phones, { clip, token, recId, sessionId, pass, step }) {
    const d = this.doc();
    if (d.seen.includes(token)) return;
    d.seen = [...d.seen, token].slice(-300);
    const today = dayKey();
    const pairsNow = new Map();
    for (const x of phones.diffs) pairsNow.set(this.pairOf(x), (pairsNow.get(this.pairOf(x)) || 0) + 1);
    for (const [s, n] of Object.entries(phones.sounds)) d.occ[s] = (d.occ[s] || 0) + n;
    for (const [pair, n] of pairsNow) {
      if (d.blocked.includes(pair)) continue;
      const e = d.tally[pair] || { f: 0, days: [], clips: [], last: today };
      e.f += n; e.last = today;
      if (!e.days.includes(today)) e.days = [...e.days, today].slice(-60);
      if (clip && !e.clips.includes(clip.id)) e.clips = [...e.clips, clip.id].slice(-30);
      e.recId = recId || e.recId || null; e.sessionId = sessionId || e.sessionId || null; e.clipId = clip ? clip.id : e.clipId; e.pass = pass; e.step = step;
      d.tally[pair] = e;
    }
    if (settings().pronAutoNotes) {
      for (const pair of pairsNow.keys()) {
        if (d.blocked.includes(pair) || d.autoMade.includes(pair) || !this.recurring(d, pair)) continue;
        this.makeAutoNote(d, pair);
      }
    }
    this.save(d);
  },

  /* flagged on 2+ different days and in about half or more of the places that sound occurred */
  recurring(d, pair) {
    const e = d.tally[pair];
    if (!e) return false;
    const occ = d.occ[pair.split('→')[0]] || 0;
    return e.days.length >= PRON_AUTO.minDays && occ >= PRON_AUTO.minPlaces && e.f / occ >= PRON_AUTO.minShare;
  },
  share(d, pair) { const e = d.tally[pair]; const occ = d.occ[pair.split('→')[0]] || 0; return { flagged: e ? Math.min(e.f, occ) : 0, occurred: occ }; },

  /* an automatic note: "possible", never sent to the AI until the learner taps Ask AI on it */
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

  /* tallies worth listing in Progress → Issues: flagged on 2+ days, not dismissed, not already confirmed as an issue */
  seenAcross() {
    const d = this.doc();
    return Object.entries(d.tally)
      .filter(([pair, e]) => !d.blocked.includes(pair) && e.days.length >= 2)
      .map(([pair, e]) => ({ pair, e, note: e.noteId ? Store.get('notes', e.noteId) : null, recurring: this.recurring(d, pair), ...this.share(d, pair) }))
      .filter((r) => !(r.note && r.note.confirmed))
      .sort((x, y) => (y.recurring - x.recurring) || (y.e.days.length - x.e.days.length));
  },
};
