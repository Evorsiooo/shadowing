/* ---------- prosody comparison: where your pitch, timing and stress differ from the speaker's ----------
   Works on the stored lines only ({st, db, hop, offset}, already on the clip's time axis), so it is
   free, runs in the browser and needs no audio. It describes differences, not errors, and cannot hear vowels. */
const PROSODY_STEP = 0.05; // s, grid the two voices are aligned on
const PROSODY_BAND = 2; // s, how far apart two aligned moments may be

const Prosody = {
  /* resample a stored line to the 50 ms grid on clip time: {env 0..1 loudness, st (null = no pitch), speech} */
  grid(line, dur) {
    const n = Math.ceil(dur / PROSODY_STEP);
    const db = line.db || [];
    const valid = db.filter((v) => v != null);
    const floor = percentile(valid, 0.15), peak = percentile(valid, 0.97);
    const span = Math.max(6, peak - floor);
    const env = new Array(n).fill(0), st = new Array(n).fill(null), loud = new Array(n).fill(-80);
    for (let k = 0; k < n; k++) {
      const i0 = Math.round((k * PROSODY_STEP - (line.offset || 0)) / line.hop);
      const i1 = Math.max(i0 + 1, Math.round(((k + 1) * PROSODY_STEP - (line.offset || 0)) / line.hop));
      let m = -Infinity;
      const ss = [];
      for (let i = i0; i < i1; i++) {
        if (i < 0 || i >= db.length) continue;
        if (db[i] != null && db[i] > m) m = db[i];
        if (line.st && line.st[i] != null) ss.push(line.st[i]);
      }
      if (isFinite(m)) { loud[k] = m; env[k] = clamp((m - floor) / span, 0, 1); }
      if (ss.length >= Math.ceil((i1 - i0) / 2)) st[k] = median(ss);
    }
    return { env, st, loud, peak, floor, n, speech: env.map((v) => v > 0.25) };
  },

  /* dynamic time warping with slopes limited to 1/2..2, inside a band; returns path[i] = user frame for model frame i */
  warp(M, U) {
    const n = M.n, m = U.n, band = Math.round(PROSODY_BAND / PROSODY_STEP);
    const cost = (i, j) => {
      let c = Math.abs(M.env[i] - U.env[j]);
      // pitch values stay out of the cost, so a different pitch can't be hidden by bending time
      if ((M.st[i] != null) !== (U.st[j] != null)) c += 0.15;
      return c;
    };
    const D = Array.from({ length: n }, () => new Float32Array(m).fill(Infinity));
    const from = Array.from({ length: n }, () => new Int8Array(m));
    for (let i = 0; i < n; i++) {
      for (let j = Math.max(0, i - band); j < Math.min(m, i + band + 1); j++) {
        const c = cost(i, j);
        if (i === 0 && j === 0) { D[0][0] = c; continue; }
        let best = Infinity, step = 0;
        const tryStep = (pi, pj, s, w) => {
          if (pi < 0 || pj < 0 || D[pi][pj] === Infinity) return;
          const v = D[pi][pj] + w * c;
          if (v < best) { best = v; step = s; }
        };
        tryStep(i - 1, j - 1, 1, 1); // diagonal
        tryStep(i - 1, j - 2, 2, 1.1); // user took twice as long
        tryStep(i - 2, j - 1, 3, 1.1); // user took half the time
        D[i][j] = best; from[i][j] = step;
      }
    }
    if (!n || !m) return null;
    // the end is free: you may stop a little before or after the speaker
    let j = -1;
    for (let q = Math.max(0, n - 1 - band); q < Math.min(m, n + band); q++) if (D[n - 1][q] < Infinity && (j < 0 || D[n - 1][q] < D[n - 1][j])) j = q;
    if (j < 0) return null;
    const path = new Array(n).fill(0);
    let i = n - 1;
    for (;;) {
      path[i] = j;
      const s = from[i][j];
      if (i === 0 || !s) break;
      if (s === 1) { i--; j--; } else if (s === 2) { i--; j -= 2; } else { path[i - 1] = j - 1; i -= 2; j--; }
      if (i < 0) break;
    }
    for (let k = 1; k < n; k++) if (path[k] < path[k - 1]) path[k] = path[k - 1];
    return path;
  },

  /* the words of the clip's sentence that fall around clip-time a..b, spread over the speech by letter count: a guess, say "around" */
  wordsAround(clip, M, a, b) {
    const words = String(clip.sentence || '').split(/\s+/).filter(Boolean);
    if (words.length < 3) return '';
    const first = M.speech.indexOf(true), last = M.speech.lastIndexOf(true);
    if (first < 0 || last <= first) return '';
    const t0 = first * PROSODY_STEP, t1 = (last + 1) * PROSODY_STEP;
    const total = words.reduce((s, w) => s + w.length + 1, 0);
    let at = 0;
    const hit = [];
    for (const w of words) {
      const x0 = t0 + ((t1 - t0) * at) / total;
      at += w.length + 1;
      const x1 = t0 + ((t1 - t0) * at) / total;
      if (x1 > a && x0 < b) hit.push(w);
    }
    return hit.slice(0, 5).join(' ');
  },

  /* compare one recording with the clip's model line. Returns null when there isn't enough to go on.
     findings: [{kind: 'rushed'|'dragged'|'pitch'|'stress', a, b, dir?, words}] sorted by time */
  compare(clip, analysis) {
    const model = clip && clip.model;
    if (!model || !analysis || !model.db || !analysis.db) return null;
    // the review card, the AI lines and the history tally all ask for the same comparison: work it out once per recording
    const key = `${clip.id}:${clip.start}:${clip.end}`;
    let hit = this._cache.get(analysis);
    if (hit && hit.key === key) return hit.res;
    const res = this.compareNow(clip, analysis, model);
    this._cache.set(analysis, { key, res });
    return res;
  },
  _cache: new WeakMap(),
  compareNow(clip, analysis, model) {
    const dur = clip.end - clip.start;
    const M = this.grid({ ...model, offset: 0 }, dur), U = this.grid(analysis, dur + 2);
    const mSpeech = M.speech.filter(Boolean).length, uSpeech = U.speech.filter(Boolean).length;
    if (mSpeech < 20 || uSpeech < 20) return null;
    const path = this.warp(M, U);
    if (!path) return null;
    const findings = [];
    const win = 8, hopW = 4; // 0.4 s windows
    // speed: how long you took over each stretch of the speaker's speech
    const flagged = [];
    for (let i = 0; i + win < M.n; i += hopW) {
      let sp = 0;
      for (let k = i; k < i + win; k++) if (M.speech[k]) sp++;
      if (sp < win * 0.7) continue;
      const ratio = (path[i + win] - path[i]) / win;
      if (ratio < 0.7) flagged.push({ i, kind: 'rushed' });
      else if (ratio > 1.45) flagged.push({ i, kind: 'dragged' });
    }
    for (const kind of ['rushed', 'dragged']) {
      let cur = null;
      for (const f of flagged.filter((x) => x.kind === kind)) {
        if (cur && f.i <= cur.end + hopW) cur.end = f.i + win;
        else { if (cur) findings.push(cur); cur = { kind, start: f.i, end: f.i + win }; }
      }
      if (cur) findings.push(cur);
    }
    // pitch direction: over each voiced run of the speaker, did you move the same way?
    const voicedRuns = [];
    for (let i = 0; i < M.n;) {
      if (M.st[i] == null) { i++; continue; }
      let j = i;
      while (j < M.n && (M.st[j] != null || (j + 1 < M.n && M.st[j + 1] != null))) j++;
      if (j - i >= 3) voicedRuns.push([i, j]);
      i = j;
    }
    const third = (arr, lo, hi) => { const v = arr.slice(lo, hi).filter((x) => x != null); return v.length ? mean(v) : null; };
    for (const [i, j] of voicedRuns) {
      const len = j - i, w3 = Math.max(1, Math.floor(len / 3));
      const m0 = third(M.st, i, i + w3), m1 = third(M.st, j - w3, j);
      const u0i = path[i], u1i = path[j - 1];
      if (m0 == null || m1 == null || u1i - u0i < 2) continue;
      const uw = Math.max(1, Math.floor((u1i - u0i) / 3));
      const u0 = third(U.st, u0i, u0i + uw), u1 = third(U.st, u1i - uw, u1i + 1);
      const uVoiced = U.st.slice(u0i, u1i + 1).filter((x) => x != null).length / (u1i - u0i + 1);
      if (u0 == null || u1 == null || uVoiced < 0.5) continue;
      const dm = m1 - m0, du = u1 - u0;
      if (Math.abs(dm) >= 1.5 && (du * dm < 0 || Math.abs(du) < Math.abs(dm) * 0.25) && Math.abs(du - dm) >= 1.5) {
        findings.push({ kind: 'pitch', start: i, end: j, dir: dm > 0 ? 'up' : 'down', ours: du > 0.8 ? 'up' : du < -0.8 ? 'down' : 'flat' });
      }
    }
    // stress: the speaker's loudest syllables against yours, each relative to its own voice
    const peaks = DSP.nuclei(model.db, model.st).map((p) => ({ ...p, i: Math.round((p.i * model.hop) / PROSODY_STEP) })).filter((p) => p.i < M.n);
    if (peaks.length >= 3) {
      const rel = (S, k) => S.loud[k] - S.peak;
      const cut = percentile(peaks.map((p) => p.v), 0.7), low = percentile(peaks.map((p) => p.v), 0.4);
      for (const p of peaks) {
        const k = p.i, uk = path[k];
        let um = -Infinity;
        for (let q = uk - 2; q <= uk + 2; q++) if (q >= 0 && q < U.n) um = Math.max(um, rel(U, q));
        const mrel = rel(M, k);
        if (p.v >= cut && um < mrel - 7) findings.push({ kind: 'stress', start: k - 2, end: k + 3, dir: 'softer' });
        else if (p.v <= low && um > mrel + 7) findings.push({ kind: 'stress', start: k - 2, end: k + 3, dir: 'stronger' });
      }
    }
    const out = findings.map((f) => ({
      kind: f.kind, dir: f.dir, ours: f.ours,
      a: round(f.start * PROSODY_STEP, 1), b: round(f.end * PROSODY_STEP, 1),
      words: this.wordsAround(clip, M, f.start * PROSODY_STEP, f.end * PROSODY_STEP),
    })).sort((x, y) => x.a - y.a);
    // overall: how closely the loudness shape and pitch line follow after alignment
    let se = 0, sp = 0, np = 0;
    for (let i = 0; i < M.n; i++) {
      se += Math.abs(M.env[i] - U.env[path[i]]);
      if (M.st[i] != null && U.st[path[i]] != null) { sp += Math.abs(M.st[i] - U.st[path[i]]); np++; }
    }
    const speed = (path[M.n - 1] - path[0]) / Math.max(1, M.n - 1);
    return { findings: out, speed: round(speed, 2), pitchGap: np > 20 ? round(sp / np, 1) : null, loudGap: round(se / M.n, 2), pitchFrames: np };
  },
};

/* one timing, pitch or stress difference in words */
const prosodyWhen = (f) => `${fmtNum(f.a, 1)}–${fmtNum(f.b, 1)} s`;
function prosodyLine(f) {
  const where = f.words ? t('around “{words}” ({when})', { words: f.words, when: prosodyWhen(f) }) : t('at {when}', { when: prosodyWhen(f) });
  if (f.kind === 'rushed') return t('You went faster than the speaker {where}.', { where });
  if (f.kind === 'dragged') return t('You went slower than the speaker {where}.', { where });
  if (f.kind === 'pitch') {
    if (f.dir === 'up') return f.ours === 'down' ? t('The speaker’s voice goes up {where}; yours went down.', { where }) : t('The speaker’s voice goes up {where}; yours stayed flat.', { where });
    return f.ours === 'up' ? t('The speaker’s voice goes down {where}; yours went up.', { where }) : t('The speaker’s voice goes down {where}; yours stayed flat.', { where });
  }
  return f.dir === 'softer' ? t('The speaker leans on a syllable {where} that you said more softly.', { where }) : t('You leaned on a syllable {where} that the speaker keeps light.', { where });
}

/* "Differences from the speaker" card for one recording */
function prosodyCard(clip, analysis, heard, withPhones) {
  let res = null;
  try { res = Prosody.compare(clip, analysis); } catch (e) { res = null; }
  const spoken = heard ? Speech.unclear(clip.sentence, heard) : null;
  if (!res && !spoken) return null;
  const line = prosodyLine;
  const found = res ? res.findings : [];
  const shown = found.slice(0, 6);
  return h('details', { class: 'card', open: true },
    h('summary', null, h('strong', null, t('Differences from the speaker'))),
    res ? (shown.length
      ? h('ul', { class: 'small' }, shown.map((f) => h('li', null, line(f))))
      : h('p', { class: 'small' }, t('No big differences in timing, pitch direction or stress. Nice.'))) : null,
    found.length > shown.length ? h('p', { class: 'small muted' }, t('{n} more not shown.', { n: found.length - shown.length })) : null,
    spoken ? h('p', { class: 'small' }, spoken.missing.length
      ? t('Words that may have been unclear: {words}. (The browser didn’t pick them up; it can also miss clear words.)', { words: spoken.missing.slice(0, 8).join(', ') })
      : t('The browser’s speech recognition picked up every word. Nice.')) : null,
    h('p', { class: 'small muted' }, withPhones
      ? t('Timing and pitch are worked out on your device from pitch and loudness only, so they can’t hear sounds; the sounds are in the box below. The words are a rough guess from timing.')
      : t('Timing and pitch are worked out on your device from pitch and loudness only, so they can’t hear vowels or consonants, and the words are a rough guess from timing.')));
}

/* the measured differences as plain English lines for the AI (never translated: the prompt is English) */
function measuredLines(clip, analysis, heard, phoneItems) {
  const out = phoneItems && phoneItems.length ? Pron.aiLines(phoneItems) : [];
  // what has been happening over time with the same sounds (at most two lines, only for pairs in this take)
  for (const pair of [...new Set((phoneItems || []).map((d) => Pron.pairOf(d)))].slice(0, 2)) { const l = Pron.historyLine(pair); if (l) out.push(l); }
  let res = null;
  try { res = Prosody.compare(clip, analysis); } catch (e) { res = null; }
  if (res) {
    const at = (f) => `${f.a}-${f.b} s${f.words ? ` (around "${f.words}")` : ''}`;
    for (const f of res.findings.slice(0, 6)) {
      if (f.kind === 'rushed') out.push(`Faster than the speaker at ${at(f)}.`);
      else if (f.kind === 'dragged') out.push(`Slower than the speaker at ${at(f)}.`);
      else if (f.kind === 'pitch') out.push(`Speaker's pitch goes ${f.dir} at ${at(f)}; the learner's ${f.ours === 'flat' ? 'stayed flat' : `went ${f.ours}`}.`);
      else out.push(f.dir === 'softer' ? `Speaker stresses a syllable at ${at(f)} that the learner said more softly.` : `Learner stressed a syllable at ${at(f)} that the speaker keeps light.`);
    }
    if (!res.findings.length) out.push('No notable differences in timing, pitch direction or stress.');
    const hist = ProsodyLog.historyLine(res.findings.map((f) => ProsodyLog.kindOf(f)));
    if (hist) out.push(hist);
  }
  const spoken = heard ? Speech.unclear(clip.sentence, heard) : null;
  if (spoken) out.push(spoken.missing.length ? `Speech recognition did not pick up these words: ${spoken.missing.slice(0, 8).join(', ')} (it also misses clear words).` : 'Speech recognition picked up every word.');
  return out;
}
/* for a note on a saved recording */
function measuredForNote(ctx) {
  const rec = ctx.recId && Store.get('recordings', ctx.recId);
  const clip = Store.get('clips', ctx.clipId);
  if (!clip) return [];
  let items = [];
  if (Pron.on()) {
    const ph = Pron.phonesFor(ctx.recId, ctx.sessionId);
    items = ctx.pair ? (ph ? ph.diffs.filter((d) => Pron.pairOf(d) === ctx.pair).slice(0, PRON_SHOWN) : []) : Pron.itemsFor(ctx.recId, ctx.sessionId);
  }
  if ((!rec || !rec.analysis) && !items.length) return [];
  return measuredLines(clip, rec && rec.analysis, rec && rec.heard, items);
}

/* ---------- timing, pitch and stress over time ----------
   One small `meta` document, 'prosody': per kind of difference, daily buckets {d, f, o} (f: passes that had it, o: recorded
   passes) kept for PRON_QUIET.keepDays. Same shape and trend rule as the sound pairs in 24-pron.js, works in every language,
   and adds no new analysis: it reads the comparison the review card already worked out (Prosody.compare is cached). */
const PROSODY_KINDS = ['rushed', 'dragged', 'pitch', 'stress'];
const PROSODY_PLAIN = { rushed: 'running faster than the speaker', dragged: 'running slower than the speaker', pitch: 'pitch moving a different way from the speaker', stress: 'stress in a different place from the speaker' };
/* respects the Analysis (Heavy) switch from the safety work once it is in the build */
function heavyOk(name) { return typeof Heavy === 'undefined' || !Heavy.isOn || Heavy.isOn(name); }

const ProsodyLog = {
  kindOf(f) { return f.kind === 'rushed' || f.kind === 'dragged' || f.kind === 'pitch' ? f.kind : 'stress'; },
  doc() { return Store.get('meta', 'prosody') || { id: 'prosody', seen: [], kinds: {} }; },
  /* add one recorded pass (once per token) */
  record(clip, analysis, token) {
    if (!token || !clip || !analysis || !heavyOk('prosody')) return;
    let res = null;
    try { res = Prosody.compare(clip, analysis); } catch { res = null; }
    if (!res) return;
    const d = this.doc();
    if (d.seen.includes(token)) return;
    d.seen = [...d.seen, token].slice(-300);
    const today = dayKey();
    const found = new Set(res.findings.map((f) => this.kindOf(f)));
    for (const kind of PROSODY_KINDS) {
      const e = d.kinds[kind] || { bk: [] };
      Pron.addChances(e, today, found.has(kind) ? 1 : 0, 1);
      e.bk = e.bk.filter((x) => x.d >= addDays(today, -PRON_QUIET.keepDays));
      d.kinds[kind] = e;
    }
    Store.put('meta', d);
  },
  summary() {
    const d = this.doc();
    return PROSODY_KINDS.filter((k) => d.kinds[k]).map((kind) => ({ kind, T: Pron.trend(d.kinds[kind]) }));
  },
  /* one English line for the AI about the most frequent difference in this take, when there is enough history */
  historyLine(kinds) {
    const d = this.doc();
    let best = null;
    for (const kind of new Set(kinds)) {
      const e = d.kinds[kind];
      if (!e) continue;
      const T = Pron.trend(e);
      if (T.recent.o >= PRON_QUIET.easeMin && (!best || T.recent.f / T.recent.o > best.T.recent.f / best.T.recent.o)) best = { kind, T };
    }
    if (!best) return '';
    const { T } = best;
    const before = T.before.o ? ` (${T.before.f} of ${T.before.o} before)` : '';
    return `History: ${PROSODY_PLAIN[best.kind]} in ${T.recent.f} of ${T.recent.o} recorded passes in the last 2 weeks${before}${T.label ? `, trend: ${{ less: 'less often', more: 'more often', same: 'about the same' }[T.label]}` : ''}.`;
  },
};
