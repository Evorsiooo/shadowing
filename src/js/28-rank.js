/* ---------- ranking clips: how hard they are, what they test, what to practise next (global `Rank`) ----------
   Everything here reads what the app already stores and runs nothing new:
     - difficulty: from the clip's model line (clip.model.measures: syllables per second, pitch range) and its length. A ROUGH GUIDE: the
       syllable count is a loudness-peak heuristic and the thresholds below are guesses, not validated against what learners find hard.
     - what a clip tests: the speaker's sounds saved on the clip (clip.speakerPhones, 27-prepare.js) against the sound pairs the learner keeps
       getting flagged on (meta/pron tally, 24-pron.js). Only clips that have their sounds can match; the rest simply don't show a badge.
     - the library job: computes the missing speaker sounds for older clips, one at a time, in the background (Prep.ensure, background: true),
       so the two lines above cover the whole library. Opt-in, from Settings → Analysis; needs Pronunciation analysis on and downloaded.
   The pure parts (difficulty, matchSounds, pick, order) take plain objects so scripts/test-rank.mjs can run them in Node. */
const Rank = (() => {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  /* guesses: 3 to 7 syllables per speech second, 6 to 16 semitones of pitch range, 4 to 14 s long */
  const D = { rateLo: 3, rateHi: 7, rangeLo: 6, rangeHi: 16, lenLo: 4, lenHi: 14, wRate: 0.5, wRange: 0.2, wLen: 0.3, easy: 0.34, hard: 0.67 };
  const MIN_PHONE_CONF = 0.5; // a speaker sound the model is unsure of is not counted
  const PER_SOUND_CAP = 3; // one sound that appears ten times shouldn't outweigh three different ones

  /* { score: 0..1, level: 'easy'|'medium'|'hard' } or null when the clip has no measures yet. Missing parts are left out and the rest re-weighted. */
  function difficulty(clip) {
    const m = clip && clip.model && clip.model.measures, len = clip && clip.end - clip.start;
    if (!m && !(len > 0)) return null;
    const parts = [];
    if (m && typeof m.rate === 'number') parts.push([D.wRate, clamp01((m.rate - D.rateLo) / (D.rateHi - D.rateLo))]);
    if (m && typeof m.range === 'number') parts.push([D.wRange, clamp01((m.range - D.rangeLo) / (D.rangeHi - D.rangeLo))]);
    if (len > 0) parts.push([D.wLen, clamp01((len - D.lenLo) / (D.lenHi - D.lenLo))]);
    if (!m || !parts.some((p) => p[0] === D.wRate || p[0] === D.wRange)) return null; // length alone says too little
    const w = parts.reduce((a, p) => a + p[0], 0), score = parts.reduce((a, p) => a + p[0] * p[1], 0) / w;
    return { score, level: score < D.easy ? 'easy' : score >= D.hard ? 'hard' : 'medium' };
  }

  /* the sounds the learner keeps getting flagged on: Map of the speaker's sound -> how many days it was flagged.
     tally is meta/pron.tally ({ 'θ→s': { days: [...], state } }); blocked is meta/pron.blocked. 'archived' (gone quiet) pairs are left out,
     and so are pairs where the learner added a sound the speaker doesn't have ('∅→…'), since they match nothing in the speaker's audio. */
  function focusSounds(tally, blocked = []) {
    const out = new Map();
    for (const [pair, e] of Object.entries(tally || {})) {
      if (blocked.includes(pair) || (e.state || 'active') === 'archived' || !e.days || e.days.length < 2) continue;
      const from = pair.split('→')[0];
      if (!from || from === '∅') continue;
      out.set(from, Math.max(out.get(from) || 0, e.days.length));
    }
    return out;
  }

  /* { n, sounds: [sym…] } for a clip's saved speaker phones against focusSounds(); null when the clip has no usable sounds */
  function matchSounds(seq, focus) {
    if (!seq || !seq.phones || (seq.quality && seq.quality.level !== 'good')) return null;
    const count = new Map();
    for (const p of seq.phones) if (focus.has(p.sym) && (p.conf == null || p.conf >= MIN_PHONE_CONF)) count.set(p.sym, (count.get(p.sym) || 0) + 1);
    let n = 0;
    const sounds = [...count.entries()].sort((a, b) => (focus.get(b[0]) - focus.get(a[0])) || (b[1] - a[1])).map(([s, c]) => { n += Math.min(c, PER_SOUND_CAP); return s; });
    return { n, sounds };
  }

  /* one ordering used by the library and the Today suggestion. mode: 'time' (as cut), 'easy' (easier first), 'issues' (best fit to the learner's
     open sounds first, then easier). info(c) -> { diff, match }. Stable: ties keep the order given. */
  function order(clips, mode, info) {
    const idx = new Map(clips.map((c, i) => [c.id, i]));
    const d = (c) => { const x = info(c).diff; return x ? x.score : 2; }; // no measures: last
    const m = (c) => { const x = info(c).match; return x ? x.n : 0; };
    const by = mode === 'easy' ? (a, b) => d(a) - d(b) : mode === 'issues' ? (a, b) => m(b) - m(a) || d(a) - d(b) : null;
    return by ? clips.slice().sort((a, b) => by(a, b) || idx.get(a.id) - idx.get(b.id)) : clips.slice();
  }

  /* the clips to suggest next: clips that fit the open sounds, not done and not practised today, best fit first, easier first within a fit.
     Falls back to nothing (never pads with clips that fit nothing): the caller shows no box. */
  function pick(clips, info, { today = '', max = 3 } = {}) {
    const fits = clips.filter((c) => !c.archived && !c.done && c.lastPractised !== today && info(c).match && info(c).match.n > 0);
    return order(fits, 'issues', info).slice(0, max);
  }

  /* ---- the live app ---- */
  const live = (c) => c && !c.archived && Store.get('videos', c.videoId) && !Store.get('videos', c.videoId).archived;
  const liveClips = () => Store.all('clips').filter(live);
  const mode = () => { const m = lsGet('clipSort', 'time'); return m === 'easy' || m === 'issues' ? m : 'time'; };
  const setMode = (m) => lsSet('clipSort', m);
  const focus = () => { const d = Pron.doc(); return focusSounds(d.tally, d.blocked); };
  /* info(c) with the focus computed once per call site */
  function infoFn() {
    const f = focus(), cache = new Map();
    return (c) => {
      let x = cache.get(c.id);
      if (!x) { const sp = typeof Prep !== 'undefined' && Prep.speakerSeq(c); x = { diff: difficulty(c), match: f.size && sp ? matchSounds(sp.seq, f) : null }; cache.set(c.id, x); }
      return x;
    };
  }
  const levelText = (lv) => (lv === 'easy' ? t('easier') : lv === 'hard' ? t('harder') : t('medium'));
  const soundsText = (m) => m.sounds.slice(0, 3).map((s) => soundName(s)).join(', ');

  /* ---- the library job ---- */
  const subs = new Set();
  const job = { running: false, stop: false, done: 0, total: 0, failed: new Set(), error: null };
  const notify = () => subs.forEach((f) => { try { f(); } catch { /* a listener must not break the job */ } });
  const needs = (c) => !Prep.speakerSeq(c) && !job.failed.has(`${c.id}:${c.start}:${c.end}`);
  /* clips (live ones only) whose speaker sounds are not saved yet */
  const pending = () => liveClips().filter(needs);
  const counts = () => { const all = liveClips(); return { total: all.length, ready: all.filter((c) => Prep.speakerSeq(c)).length, failed: all.filter((c) => job.failed.has(`${c.id}:${c.start}:${c.end}`)).length }; };

  async function prepareLibrary() {
    if (job.running) return;
    if (typeof Pron === 'undefined' || !Pron.on()) { job.error = t('Pronunciation analysis is off on this device.'); notify(); return; }
    job.running = true; job.stop = false; job.done = 0; job.error = null; job.total = pending().length; notify();
    try {
      for (let c = pending()[0]; c && !job.stop; c = pending()[0]) {
        const key = `${c.id}:${c.start}:${c.end}`;
        try {
          await Prep.ensure(c, { background: true });
          if (!Prep.speakerSeq(Store.get('clips', c.id) || c)) job.failed.add(key); // the audio couldn't be read (video not on this device, link down…)
        } catch (e) {
          if (e && (e.code === 'off' || e.code === 'out-of-memory' || e.code === 'cancelled')) { job.error = Pron.reason(e); break; } // the feature stopped itself: don't keep hammering it
          job.failed.add(key);
        }
        job.done++; notify();
      }
    } finally { job.running = false; notify(); }
  }
  const stopLibrary = () => { job.stop = true; notify(); };

  return { difficulty, focusSounds, matchSounds, order, pick, D, mode, setMode, infoFn, levelText, soundsText, liveClips, job, pending, counts, prepareLibrary, stopLibrary, onChange: (f) => { subs.add(f); return () => subs.delete(f); } };
})();
