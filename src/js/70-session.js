/* ---------- guided shadowing session ---------- */
/* how many passes fit in a step's minutes, for a clip of this length (pass = the clip plus the gap after it) */
function fitPasses(minutes, perPass, lo, hi, extraSec = 0) {
  return clamp(Math.round((minutes * 60 - extraSec) / perPass), lo, hi);
}
function buildPlan(mode, clip) {
  const s = settings();
  const len = clip ? clip.end - clip.start : 0;
  // when fitted, pass counts follow the clip length so the session lasts about as long as its minutes say
  const perPass = s.fitPassesToClip && len > 0 ? len / ((Player.v && Player.v.playbackRate) || 1) + s.loopGap : 0;
  const fit = (passes, minutes, lo, hi, extraSec) => (perPass ? fitPasses(minutes, perPass, lo, hi, extraSec) : passes);
  if (mode === 'badday') {
    const listenMin = Math.max(1, Math.round(s.badMinutes * 0.3));
    const shadowMin = Math.max(1, Math.round(s.badMinutes * 0.7));
    return [
      { key: 'listen', name: N_('Listen'), passes: fit(s.badListenPasses, listenMin, 1, 10), minutes: listenMin, speak: false },
      { key: 'shadow', name: N_('Shadow'), passes: fit(s.badShadowPasses, shadowMin, 3, 20), minutes: shadowMin, speak: true },
    ];
  }
  if (mode === 'review') {
    return [
      { key: 'listen', name: N_('Listen'), passes: 1, minutes: 1, speak: false },
      { key: 'shadow', name: N_('Shadow'), passes: s.reviewShadowPasses, minutes: 3, speak: true },
      { key: 'record', name: N_('Record & compare'), passes: 1, minutes: 1, speak: true, recordLast: 'step3' },
    ];
  }
  return [
    { key: 'listen', name: N_('Listen'), passes: fit(s.listenPasses, s.listenMinutes, 2, 10), minutes: s.listenMinutes, speak: false },
    { key: 'shadow', name: N_('Shadow'), passes: fit(s.shadowPasses, s.shadowMinutes, 3, 40), minutes: s.shadowMinutes, speak: true },
    { key: 'record', name: N_('Record & compare'), passes: 1, minutes: s.recordMinutes, speak: true, recordLast: 'step3' },
    // the last pass records and is followed by a comparison, so leave it some time
    { key: 'again', name: N_('Shadow again'), passes: fit(s.againPasses + 1, s.againMinutes, 2, 40, 45), minutes: s.againMinutes, speak: true, recordLast: 'final' },
  ];
}
const EXTEND_MINUTES = 2;
const STEP_HELP = {
  listen: N_('Just listen. Don’t speak yet; take in the rhythm and melody.'),
  shadow: N_('Speak along at the same time as the speaker. Copy everything: rhythm, melody and sounds.'),
  record: N_('Headphones on. Shadow one pass while it records, then compare it with the original.'),
  again: N_('Shadow again, copying as closely as you can. The last pass records so you can compare it with step 3.'),
};
/* label of the button that starts each step */
const STEP_START = {
  listen: N_('Start listening'),
  shadow: N_('Start shadowing'),
  record: N_('Start recording'),
  again: N_('Start shadowing again'),
};

const Session = {
  active: false,
  doc: null,
  clipId: null,
  queue: [],
  mode: 'full',
  plan: [],
  stepIdx: 0,
  pass: 0,
  phase: 'idle', // intro | playing | gap | armed | recording | review | paused | done
  pausedFrom: null,
  elapsed: 0,
  lastWall: 0,
  timer: null,
  gapTimer: null,
  rec: null,
  recordingThisPass: false,
  liveThisPass: false,
  clipZero: [],
  review: null, // {recId, analysis, kind}
  preview: null, // {stopAt, then}
  cantKeepUp: 0,
  slowed: false, // the session slowed the video for the first shadow passes
  slowOff: false, // you asked for normal speed for the rest of the session
  previewRec: null, // your recording playing in step with the video after a pass

  needsTick() { return this.active && (this.phase === 'playing' || this.phase === 'recording' || !!this.preview); },
  clip() { return Store.get('clips', this.clipId); },
  step() { return this.plan[this.stepIdx]; },
  totalMinutes() { return this.plan.reduce((s, p) => s + p.minutes, 0); },
  isRecordedPass() { const st = this.step(); return !!(st && st.recordLast && this.pass === st.passes - 1); },

  start(clipIds, mode = 'full') {
    if (this.active) { toast(t('A session is already running.')); return; }
    const ids = clipIds.filter((id) => Store.get('clips', id));
    if (!ids.length) { toast(t('Pick a clip first.')); return; }
    this.queue = ids.slice(1);
    this.begin(ids[0], mode);
  },
  begin(clipId, mode) {
    const clip = Store.get('clips', clipId);
    if (!clip) return;
    UI.sel = null;
    UI.cutMode = false;
    UI.unzoomed = false;
    $('#player').classList.remove('cutting');
    if (clip.videoId !== UI.videoId) Player.load(clip.videoId, { keepClip: true });
    UI.clipId = clip.id;
    this.active = true;
    this.clipId = clip.id;
    this.mode = mode;
    this.plan = buildPlan(mode, clip);
    this.stepIdx = 0; this.pass = 0; this.elapsed = 0; this.cantKeepUp = 0;
    this.slowed = false; this.slowOff = false;
    this.review = null;
    this.doc = Store.put('sessions', {
      date: dayKey(), startedAt: new Date().toISOString(), clipId: clip.id, videoId: clip.videoId, mode,
      stepsCompleted: [], stepsSkipped: [], passes: [], minutes: 0, complete: false, recs: {},
    });
    this.phase = 'intro';
    this.startClock();
    Player.pause();
    Player.seek(clip.start);
    Player.tickHooks.add(this.onTick);
    if (!clip.model) ensureModels(Store.get('videos', clip.videoId));
    renderAll();
  },
  startClock() {
    clearInterval(this.timer);
    this.lastWall = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      if (this.phase !== 'paused' && this.phase !== 'intro' && this.phase !== 'review') this.elapsed += (now - this.lastWall) / 1000;
      this.lastWall = now;
      const el = $('#sessTimer');
      if (el) el.textContent = this.timerText();
    }, 500);
  },
  timerText() {
    const total = this.totalMinutes() * 60;
    const left = total - this.elapsed;
    return left >= 0 ? t('{time} left', { time: fmtTime(left) }) : t('{time} over · that’s fine', { time: fmtTime(-left) });
  },

  /* ---------- passes ---------- */
  async beginPass() {
    clearTimeout(this.gapTimer);
    const clip = this.clip();
    const st = this.step();
    if (!clip || !st) return;
    this.recordingThisPass = this.isRecordedPass();
    this.liveThisPass = false;
    if (this.recordingThisPass && this.phase !== 'armed-go') { this.phase = 'armed'; renderSession(); return; }
    // live pitch on ordinary speaking passes (optional, off by default to keep the screen calm)
    if (!this.recordingThisPass && st.speak && settings().livePitchAllPasses && !Mic.error) this.liveThisPass = await Mic.open();
    if (this.recordingThisPass || this.liveThisPass) {
      if (!(await Mic.open())) {
        if (this.recordingThisPass) { this.phase = 'armed'; renderSession(); return; }
        this.liveThisPass = false;
      }
    }
    this.clipZero = [];
    this.zero = null;
    this.lastTickT = null;
    Panel.live = null;
    // land on the clip start before anything is timed against it
    await Player.seekAndWait(clip.start);
    if (this.recordingThisPass || this.liveThisPass) {
      this.rec = new Recording();
      this.rec.start();
      this.speech = this.recordingThisPass && settings().speechCheck ? Speech.start(targetLang()) : null;
      Panel.live = { clipId: clip.id, points: [], frames: 0, ref: (Store.get('meta', 'voice') || {}).refHz || null, f0s: [], userOnset: null, shift: 0 };
      this.liveOff = Mic.on(() => this.liveAnalyse());
    }
    this.applyPassRate();
    this.phase = this.recordingThisPass ? 'recording' : 'playing';
    document.body.classList.toggle('calm', st.speak);
    renderSession();
    const ok = await Player.play();
    if (!ok) { this.phase = 'paused'; this.pausedFrom = 'playing'; renderSession(); }
  },
  /* the first few shadow passes play slower (Settings → Practice), then back to 1x */
  slowRate() { const r = +settings().slowStartRate; return r > 0 && r < 1 ? r : 1; },
  slowPass() {
    const st = this.step();
    return !!st && st.key === 'shadow' && this.mode !== 'review' && !this.slowOff && this.slowRate() < 1 && this.pass < settings().slowStartPasses;
  },
  applyPassRate() {
    if (this.slowPass()) {
      if (UI.rate !== this.slowRate()) Player.setRate(this.slowRate());
      this.slowed = true;
    } else if (this.slowed) {
      this.slowed = false;
      Player.setRate(1);
      toast(t('Back to normal speed (1x).'));
    }
  },
  fullSpeed() {
    this.slowOff = true;
    if (this.slowed) { this.slowed = false; Player.setRate(1); }
    renderSession();
  },
  onTick: (t) => {
    const S = Session;
    if (S.preview) {
      if (t >= S.preview.stopAt - 0.02) { Player.v.pause(); const then = S.preview.then; S.preview = null; then && then(); }
      return;
    }
    if (!S.active || (S.phase !== 'playing' && S.phase !== 'recording')) return;
    const clip = S.clip();
    if (!clip) return;
    // when did the clip start, on the audio clock? Sample only while the video is really advancing,
    // then freeze the estimate so every point of your line is timed against the same zero.
    if (S.rec && S.zero == null && !Player.v.paused && S.lastTickT != null && t > S.lastTickT && t > clip.start + 0.02) {
      S.clipZero.push(AudioEng.getCtx().currentTime - (t - clip.start) / (Player.v.playbackRate || 1));
      if (S.clipZero.length >= 12) S.zero = median(S.clipZero);
    }
    S.lastTickT = t;
    if (t >= clip.end - 0.02) S.endPass();
  },
  async endPass() {
    const st = this.step();
    const clip = this.clip();
    Player.v.pause();
    const phase = this.phase;
    this.phase = 'gap';
    let entry = { step: st.key, n: this.pass + 1, recorded: false, lag: null, at: new Date().toISOString() };
    if (this.rec) {
      await sleep(700); // catch the tail of a trailing voice
      if (this.liveOff) { this.liveOff(); this.liveOff = null; }
      const res = await this.rec.stop();
      this.rec = null;
      const heard = this.speech ? await this.speech.stop() : null;
      this.speech = null;
      const an = analysePass(res, clip, this.zero != null ? this.zero : median(this.clipZero), Player.v.playbackRate || 1, Panel.live);
      if (an) {
        entry.lag = an.lag;
        Panel.lastPass = { ...an, clipId: clip.id };
      }
      Panel.live = null;
      if (phase === 'recording') {
        const keep = st.recordLast || settings().keepAllPassRecordings;
        let recId = null;
        if (keep && res.blob.size) {
          try {
            const ref = await Store.putBlob(res.blob);
            const r = Store.put('recordings', {
              kind: 'pass', sessionId: this.doc.id, clipId: clip.id, step: st.key, pass: this.pass + 1, slot: st.recordLast,
              ref, mime: res.blob.type, created: new Date().toISOString(), lag: an ? an.lag : null, score: an ? an.score : null,
              analysis: an ? { st: an.st, db: an.db, hop: an.hop, offset: an.offset } : null, durationSec: round(res.samples.length / SR, 1), heard,
            });
            recId = r.id;
            this.doc.recs[st.recordLast] = recId;
          } catch (e) {
            toast(t('The recording couldn’t be saved ({error}). You can still listen to it now.', { error: e.code || e.message || 'error' }), 'bad', 6000);
          }
        }
        entry.recorded = true; entry.recId = recId;
        this.review = { recId, blob: res.blob, url: URL.createObjectURL(res.blob), analysis: an, heard, slot: st.recordLast, clipId: clip.id, phones: undefined };
        startPhones(this.review, { clip, samples: res.samples, blob: res.blob, analysis: an, recId, slot: st.recordLast, sessionId: this.doc.id, pass: this.pass + 1, step: st.key });
        try { ProsodyLog.record(clip, an, recId || `${this.doc.id}:${this.pass + 1}`); } catch (e) { console.warn('prosody history failed', e); }
        this.doc.passes.push(entry);
        this.pass++;
        this.saveDoc();
        this.phase = 'review';
        document.body.classList.remove('calm');
        renderSession(); renderPanel();
        return;
      }
    }
    this.doc.passes.push(entry);
    this.pass++;
    this.saveDoc();
    renderPanel();
    if (this.pass >= st.passes) { this.completeStep(); return; }
    renderSession();
    this.gapTimer = setTimeout(() => { if (this.phase === 'gap') this.beginPass(); }, settings().loopGap * 1000);
  },
  liveAnalyse() {
    const L = Panel.live;
    if (!L || !this.rec || this.zero == null || this.rec.startCtx == null) return; // samples wait in the buffer until timing is known
    const clip = this.clip();
    // feed only the chunks recorded since last time; the tracker keeps its own filter and noise floor
    if (!L.tracker) { L.tracker = DSP.liveTracker(); L.chunks = 0; }
    while (L.chunks < this.rec.pcm.length) L.tracker.push(this.rec.pcm[L.chunks++]);
    const rate = Player.v.playbackRate || 1;
    for (const { db, f, floor } of L.tracker.drain()) {
      const i = L.frames++;
      let st = null;
      if (isFinite(f)) {
        L.f0s.push(f);
        if (!L.ref && L.f0s.length > 40) L.ref = median(L.f0s);
        const ref = L.ref || median(L.f0s);
        let v = 12 * Math.log2(f / ref);
        // octave slips show up as jumps of about 12 semitones: fold them back
        if (v > 9 && v - 12 > -6) v -= 12;
        else if (v < -9 && v + 12 < 6) v += 12;
        if (Math.abs(v) <= 12) {
          L.recent = (L.recent || []).concat(v).slice(-3);
          st = median(L.recent);
        } else L.recent = [];
      } else L.recent = [];
      // raw clip time; the live sync shift is applied when drawing, so it moves the whole line at once
      const ct = (this.rec.startCtx + i * HOP_S - this.zero) * rate;
      if (L.userOnset == null && db > Math.max(floor + 15, -65)) {
        L.loudRun = (L.loudRun || 0) + 1;
        if (L.loudRun >= 5) {
          L.userOnset = ct - 4 * HOP_S;
          const m = clip.model ? clip.model.onset : 0;
          L.shift = clamp(L.userOnset - m, -0.5, 1.5);
        }
      } else if (L.userOnset == null) L.loudRun = 0;
      L.points.push({ t: ct, st, db });
    }
  },
  completeStep() {
    const st = this.step();
    if (!this.doc.stepsCompleted.includes(st.key)) this.doc.stepsCompleted.push(st.key);
    this.stepIdx++;
    this.pass = 0;
    this.saveDoc();
    document.body.classList.remove('calm');
    if (this.stepIdx >= this.plan.length) { this.finish(false); return; }
    this.phase = 'intro';
    renderSession();
  },

  /* ---------- controls ---------- */
  go() { // start the current step / armed recording
    if (this.phase === 'intro') { this.beginPass(); return; }
    if (this.phase === 'armed') { this.phase = 'armed-go'; this.beginPass(); }
  },
  async cancelPassCapture() {
    if (this.liveOff) { this.liveOff(); this.liveOff = null; }
    if (this.rec) { try { await this.rec.stop(); } catch { /* ignore */ } this.rec = null; }
    Panel.live = null;
  },
  togglePause() {
    if (!this.active) return;
    if (this.phase === 'paused') {
      const from = this.pausedFrom;
      this.phase = from === 'recording' ? 'armed' : 'gap';
      this.pausedFrom = null;
      if (from === 'recording') { this.phase = 'armed-go'; this.beginPass(); } else this.beginPass();
      return;
    }
    if (this.phase === 'playing' || this.phase === 'recording' || this.phase === 'gap') {
      this.pausedFrom = this.phase;
      this.phase = 'paused';
      clearTimeout(this.gapTimer);
      Player.v.pause();
      this.cancelPassCapture();
      document.body.classList.remove('calm');
      renderSession();
    } else if (this.phase === 'intro' || this.phase === 'armed') this.go();
  },
  async repeatPass() {
    if (!this.active) return;
    clearTimeout(this.gapTimer);
    Player.v.pause();
    await this.cancelPassCapture();
    if (this.phase === 'review') {
      // redo the recorded pass straight away (the mic is already set up from the pass just done)
      stopReviewPlayback();
      this.review = null;
      this.pass = Math.max(0, this.pass - 1);
      this.doc.passes.pop();
      this.phase = 'armed-go';
      this.beginPass();
      return;
    }
    if (this.recordingThisPass) { this.phase = 'armed-go'; }
    this.beginPass();
  },
  async skipStep() {
    if (!this.active) return;
    clearTimeout(this.gapTimer);
    stopReviewPlayback();
    await this.cancelPassCapture();
    const st = this.step();
    if (st && !this.doc.stepsSkipped.includes(st.key)) this.doc.stepsSkipped.push(st.key);
    this.stepIdx++;
    this.pass = 0;
    this.review = null;
    this.saveDoc();
    if (this.stepIdx >= this.plan.length) { this.finish(false); return; }
    this.phase = 'intro';
    renderSession();
  },
  continueAfterReview() {
    const st = this.step();
    this.review = null;
    stopReviewPlayback();
    if (this.pass >= st.passes) { this.completeStep(); return; }
    this.phase = 'gap';
    this.beginPass();
  },
  /* "Keep going": add about two more minutes of passes to the step that's running */
  canExtend() {
    const st = this.step();
    if (!this.active || !st || !['playing', 'gap', 'paused'].includes(this.phase)) return false;
    return !st.recordLast || this.pass < st.passes - 1; // the recorded pass stays last
  },
  extend() {
    if (!this.canExtend()) return;
    const st = this.step();
    const clip = this.clip();
    const perPass = (clip.end - clip.start) / ((Player.v && Player.v.playbackRate) || 1) + settings().loopGap;
    const n = Math.max(2, Math.round(EXTEND_MINUTES * 60 / perPass));
    st.passes += n;
    st.minutes += EXTEND_MINUTES;
    this.doc.extended = (this.doc.extended || 0) + n;
    this.saveDoc();
    toast(tp(n, 'Added {n} more pass.', 'Added {n} more passes.'));
    renderSession();
  },
  switchToBadDay() {
    if (!this.active) return;
    if (this.stepIdx > 1) { toast(t('You’re past the shadowing step already. Finish or end the session instead.')); return; }
    const done = this.pass;
    const key = this.step().key;
    this.mode = 'badday';
    this.plan = buildPlan('badday', this.clip());
    this.doc.mode = 'badday';
    this.stepIdx = this.plan.findIndex((p) => p.key === key);
    this.pass = Math.min(done, this.step().passes - 1);
    this.saveDoc();
    toast(t('Switched to the 5-minute version. Every bit counts.'));
    renderSession();
  },
  flagCantKeepUp() {
    this.cantKeepUp++;
    this.doc.cantKeepUp = this.cantKeepUp;
    this.saveDoc();
    const clip = this.clip();
    const len = clip.end - clip.start;
    openModal([
      modalHead(t('Can’t keep up?')),
      h('p', null, len > 12
        ? t('This clip is {len} long. Shadowing gets much easier with a shorter clip: try cutting it to one sentence of about {sec} seconds. Slowing to 0.75x also helps for a few passes.', { len: fmtSec(len), sec: Math.max(6, Math.round(len * 0.6)) })
        : t('This clip is {len} long. Shadowing gets much easier with a shorter clip: try cutting it to one sentence. Slowing to 0.75x also helps for a few passes.', { len: fmtSec(len) })),
      h('div', { class: 'row' },
        btn(t('Slow to 0.75x'), () => { Player.setRate(0.75); closeModal(); }, { kind: 'primary' }),
        btn(t('End and shorten the clip'), async () => { closeModal(); await this.finish(true); editClip(clip.id); }, { icon: 'scissors' }),
        btn(t('Keep going'), () => closeModal(), { kind: 'ghost' })),
    ], { narrow: true });
  },
  saveDoc() {
    if (!this.doc) return;
    this.doc.minutes = round(this.elapsed / 60, 1);
    Store.put('sessions', this.doc);
  },

  async finish(early) {
    clearTimeout(this.gapTimer);
    clearInterval(this.timer);
    stopReviewPlayback();
    await this.cancelPassCapture();
    Mic.close();
    if (this.slowed) { this.slowed = false; Player.setRate(1); }
    Player.tickHooks.delete(this.onTick);
    document.body.classList.remove('calm');
    const clip = this.clip();
    const fullDone = !early && this.mode === 'full' && this.plan.every((p) => this.doc.stepsCompleted.includes(p.key));
    const anyPass = this.doc.passes.length > 0;
    this.doc.complete = !early && this.plan.every((p) => this.doc.stepsCompleted.includes(p.key));
    this.doc.endedAt = new Date().toISOString();
    this.saveDoc();
    if (!anyPass) Store.patch('sessions', this.doc.id, { empty: true });
    const before = streakInfo(this.doc.id).streak;
    let tickNew = false;
    if (fullDone && clip && !clip.done) { Store.patch('clips', clip.id, { done: true, doneAt: dayKey() }); tickNew = true; }
    if (this.mode === 'review' && this.doc.complete && clip) Store.patch('clips', clip.id, { reviewedAt: dayKey() });
    if (clip) Store.patch('clips', clip.id, { lastPractised: dayKey() });
    const summary = { minutes: this.doc.minutes, passes: this.doc.passes.length, mode: this.mode, complete: this.doc.complete, tickNew, recs: { ...this.doc.recs }, clipId: this.clipId, sessionId: this.doc.id };
    this.active = false;
    this.phase = 'idle';
    UI.unzoomed = true; // back to the whole video once the session is over
    this.review = null;
    const next = this.queue.shift();
    await Store.flushAll().catch(() => {});
    renderAll();
    if (anyPass) showSessionSummary(summary, before, next);
  },
};

/* align a recorded pass against the model and measure the lag */
function analysePass(res, clip, clipZero, rate, live) {
  if (!res || !res.samples || res.samples.length < SR || !clip) return null;
  const s = settings();
  const a = DSP.analyse(res.samples);
  const clean = DSP.cleanPitch(a.f0, a.conf, s.pitchSmoothing);
  const { st, refHz } = DSP.toSemitones(clean);
  if (refHz) {
    // remember the speaker's own average so live lines sit at the right height next time
    const cur = Store.get('meta', 'voice') || { id: 'voice' };
    const prev = cur.refHz || refHz;
    Store.put('meta', { ...cur, refHz: Math.round(prev * 0.7 + refHz * 0.3) });
  }
  const userHop = HOP_S * rate; // clip-time seconds per user frame
  const zeroOK = isFinite(clipZero) && res.startCtx != null;
  const offsetUser = zeroOK ? (res.startCtx - clipZero) * rate : 0;
  let lagClip = null, score = null, manual = false;
  const m = clip.model;
  if (m && s.alignMode === 'auto') {
    const modelEnv = DSP.envForAlign(m.db);
    const userEnv = DSP.envForAlign(a.db);
    // resample the user envelope on the model's clip-time grid
    const grid = new Array(modelEnv.length + 200).fill(0).map((_, k) => {
      const i = Math.round((k * m.hop - offsetUser) / userHop);
      return i >= 0 && i < userEnv.length ? userEnv[i] : 0;
    });
    const r = DSP.xcorr(modelEnv, grid, -50, 150);
    score = round(r.score, 2);
    if (r.score > 0.3 && r.margin > 0.03) lagClip = r.lag * m.hop;
  }
  // auto-alignment unsure: fall back to the live start detection, then to the manual offset
  if (lagClip == null && s.alignMode === 'auto' && live && live.userOnset != null && zeroOK) lagClip = live.shift;
  if (lagClip == null) { lagClip = (s.manualOffsetMs / 1000) * rate; manual = true; }
  const lag = round(lagClip / rate - s.latencyMs / 1000, 2);
  return {
    st: st.map((v) => (v == null ? null : Math.round(v * 10) / 10)),
    db: Array.from(a.db, (v) => Math.round(v)),
    hop: userHop,
    offset: round(offsetUser - lagClip, 3),
    lag, score, manual, refHz: refHz && Math.round(refHz),
  };
}

/* ---------- session strip ---------- */
function renderSession() {
  applyLayout();
  const el = $('#session');
  el.classList.toggle('active', Session.active);
  enterOnChange(el, Session.active); // the card swaps between "start a session" and the session itself
  // the pitch view is blurred while you record yourself: eyes on the video
  const blur = Session.active && Session.phase === 'recording';
  const panel = $('#panel');
  if (panel) { panel.classList.toggle('rec-blur', blur); if (blur) panel.dataset.blurText = t('Eyes on the video!'); }
  if (!Session.active) { renderSession.bars = null; mount(el, idleSession()); return; }
  const S = Session;
  const clip = S.clip();
  const st = S.step();
  // a new step, a recorded pass or its review slides in; the pass counter bumps when it moves on
  enterOnChange(el, `${S.stepIdx}:${['intro', 'armed', 'review'].includes(S.phase) ? S.phase : 'run'}`, 'step-in');
  enterOnChange(el, `${S.stepIdx}:${S.pass}`, 'counted'); // not 'tick': that class styles the clip list's done marks
  // the progress bars start from where they were last drawn, so their fill slides along (styles.css .bar > i)
  const before = renderSession.bars || [];
  const pcts = S.plan.map((p, i) => (i < S.stepIdx ? 100 : i === S.stepIdx ? (S.pass / p.passes) * 100 : 0));
  renderSession.bars = pcts;
  const fills = [];
  const steps = h('div', { class: 'steps', style: { '--n': S.plan.length } }, S.plan.map((p, i) => {
    const done = i < S.stepIdx;
    const cur = i === S.stepIdx;
    const fill = h('i', { style: { width: (before[i] ?? pcts[i]) + '%' } });
    fills.push(fill);
    return h('div', { class: `step ${done ? 'done' : ''} ${cur ? 'cur' : ''}` },
      h('span', { class: 'step-name' }, `${i + 1}. ${t(p.name)}`),
      h('div', { class: 'bar' }, fill));
  }));
  if (before.length) requestAnimationFrame(() => fills.forEach((f, i) => { f.style.width = pcts[i] + '%'; }));
  const counter = st ? h('div', { class: 'counter' }, t('{step}: {n}', { step: t(st.name), n: Math.min(S.pass + (S.phase === 'playing' || S.phase === 'recording' || (S.phase === 'paused' && ['playing', 'recording'].includes(S.pausedFrom)) ? 1 : 0), st.passes) }), h('small', null, ` / ${st.passes}`)) : null;
  const left = st ? Math.max(0, st.passes - S.pass) : 0;
  let main;
  if (S.phase === 'intro') {
    main = [
      h('div', { class: 'grow' }, h('h3', null, t('Step {n}: {step}', { n: S.stepIdx + 1, step: t(st.name) })), h('p', { class: 'session-hint' }, `${t(STEP_HELP[st.key])} ${tp(st.passes, '{n} pass, about {min} min.', '{n} passes, about {min} min.', { min: st.minutes })}${slowHint(S)}`), st.key === 'again' ? focusLine() : null),
      btn(t(STEP_START[st.key]), () => S.go(), { kind: 'primary', size: 'big', icon: 'play' }),
    ];
  } else if (S.phase === 'armed') {
    if (!Mic.stream && !Mic.error) Mic.open().then((ok) => { if (!ok) renderSession(); });
    main = [
      h('div', { class: 'grow stack' },
        h('h3', null, st.recordLast === 'final' ? t('Final recorded pass') : t('Recorded pass')),
        h('p', { class: 'row session-hint' }, icon('headphones'), t('Headphones on (wired is best), or the microphone will pick up the clip.')),
        micControl(),
        Mic.error ? h('p', { class: 'warnline' }, Mic.error) : null),
      Mic.error ? h('div', { class: 'row' },
        filePickButton(t('Upload a recording'), 'audio/*,video/*', (f) => uploadPassRecording(f), { icon: 'upload' }),
        btn(t('Skip recording'), () => S.skipRecording(), { kind: 'ghost' })) : null,
      btn(t('Record this pass'), () => S.go(), { kind: 'blue', size: 'big', icon: 'mic' }),
    ];
  } else if (S.phase === 'review') {
    main = [h('div', { class: 'grow' }, passReviewCard())];
  } else {
    const paused = S.phase === 'paused';
    main = [
      counter,
      h('div', { class: 'grow' },
        h('p', { class: 'session-hint' }, paused ? t('Paused. Press play (or Space) to restart this pass.') : S.phase === 'recording' ? t('Recording… shadow along now.') : S.phase === 'gap' ? t('Next pass in a moment · {n} to go', { n: left }) : st.speak ? t('Speak along with the speaker.') : t('Listen only.')),
        S.liveThisPass || S.phase === 'recording' ? [h('p', { class: 'small muted' }, t('Your pitch line is drawing in the panel below.')), micControl()] : null),
      btn('', () => S.togglePause(), { icon: paused ? 'play' : 'pause', title: paused ? t('Resume (Space)') : t('Pause (Space)'), kind: paused ? 'primary' : '' }),
      btn('', () => S.repeatPass(), { icon: 'replay', title: t('Repeat this pass without counting it (R)') }),
      S.slowed ? btn(t('Go to 1x'), () => S.fullSpeed(), { size: 'sm', title: t('Play the rest of this session at normal speed') }) : null,
    ];
  }
  const showCant = st && st.key === 'shadow' && S.pass >= settings().shortenHintAfter && S.phase !== 'review';
  mount(el,
    h('div', { class: 'row', style: { marginBottom: '10px' } },
      h('span', { class: 'label' }, S.mode === 'badday' ? t('Bad-day session') : S.mode === 'review' ? t('Review run') : t('Today’s session')),
      h('strong', { class: 'grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, clip ? clipName(clip) : ''),
      S.queue.length ? h('span', { class: 'queue-pill' }, tp(S.queue.length, '{n} more queued', '{n} more queued')) : null,
      h('span', { class: 'timer row' }, icon('clock', 'width="18" height="18"'), h('span', { id: 'sessTimer' }, S.timerText()))),
    steps,
    h('div', { class: 'session-main' }, main),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      showCant ? btn(t('I can’t keep up'), () => S.flagCantKeepUp(), { size: 'sm', kind: 'wattle' }) : null,
      S.mode === 'full' && S.stepIdx <= 1 ? btn(t('Bad day? Switch to 5 min'), () => S.switchToBadDay(), { size: 'sm', icon: 'bad' }) : null,
      h('span', { class: 'spacer' }),
      S.canExtend() ? btn(t('Keep going (+{min} min)', { min: EXTEND_MINUTES }), () => S.extend(), { size: 'sm', icon: 'plus', title: t('Add more passes to this step') }) : null,
      btn(t('Skip step'), () => S.skipStep(), { size: 'sm', icon: 'skip' }),
      btn(t('End session'), () => S.finish(true), { size: 'sm', kind: 'danger', icon: 'stop', title: t('End now; progress so far is saved') })));
}

/* intro of the shadow step: say that the first passes are slowed */
function slowHint(S) {
  const st = S.step();
  if (!st || st.key !== 'shadow' || S.mode === 'review' || S.slowOff || S.slowRate() >= 1) return '';
  const n = Math.min(settings().slowStartPasses, st.passes);
  return n > 0 ? ' ' + tp(n, 'The first pass plays at {rate}x, then normal speed.', 'The first {n} passes play at {rate}x, then normal speed.', { rate: S.slowRate() }) : '';
}

Session.skipRecording = function () {
  const st = this.step();
  this.doc.passes.push({ step: st.key, n: this.pass + 1, recorded: false, lag: null, skippedRecording: true });
  this.pass++;
  this.saveDoc();
  if (this.pass >= st.passes) this.completeStep(); else { this.phase = 'gap'; this.beginPass(); }
};

async function uploadPassRecording(file) {
  const S = Session;
  const clip = S.clip();
  const st = S.step();
  try {
    const samples = await AudioEng.decodeBlob(file);
    const an = analysePass({ samples, startCtx: null }, clip, NaN, 1);
    const ref = await Store.putBlob(file);
    const r = Store.put('recordings', { kind: 'pass', sessionId: S.doc.id, clipId: clip.id, step: st.key, pass: S.pass + 1, slot: st.recordLast, ref, mime: file.type, created: new Date().toISOString(), lag: an && !an.manual ? an.lag : null, analysis: an ? { st: an.st, db: an.db, hop: an.hop, offset: an.offset } : null, uploaded: true, durationSec: round(samples.length / SR, 1) });
    S.doc.recs[st.recordLast] = r.id;
    S.doc.passes.push({ step: st.key, n: S.pass + 1, recorded: true, recId: r.id, lag: r.lag, uploaded: true });
    S.pass++;
    S.saveDoc();
    if (an) Panel.lastPass = { ...an, clipId: clip.id };
    S.review = { recId: r.id, url: URL.createObjectURL(file), analysis: an, slot: st.recordLast, clipId: clip.id, phones: undefined };
    startPhones(S.review, { clip, samples, blob: file, analysis: an, recId: r.id, slot: st.recordLast, sessionId: S.doc.id, pass: S.pass, step: st.key });
    S.phase = 'review';
    renderSession(); renderPanel();
  } catch (e) {
    toast(t('That file couldn’t be read as audio ({error}).', { error: e.message || 'error' }), 'bad');
  }
}

/* playback options after a recorded pass.
   Switching between the original and your recording carries on from where the playhead is,
   unless it has reached the end of the clip; clicking the chart moves it. */
function reviewFrom(clip) {
  const at = Player.time();
  return at > clip.start + 0.05 && at < clip.end - 0.15 ? at : clip.start;
}
function stopReviewPlayback() {
  Player2.stop();
  Player2.gainFn = null;
  Session.previewRec = null;
  Session.preview = null;
  Player.v.pause();
  Player.v.muted = UI.volume === 0;
}
function playOriginal(clip, then, from = reviewFrom(clip)) {
  Player2.stop();
  Session.previewRec = null;
  Player.v.muted = UI.volume === 0;
  Session.preview = { stopAt: clip.end, then };
  Player.seek(from);
  Player.play();
}
/* seconds into your recording that line up with clip time `at` (negative: before you started) */
function recTimeAt(clip, analysis, at, rate) {
  return ((at - clip.start) - (analysis ? analysis.offset : 0)) / rate;
}
/* play your recording lined up with the clip: the video runs alongside (muted for "Mine",
   audible for "Both together"), so the scrub bar and the chart's playhead follow along */
function playSynced(clip, url, analysis, { withOriginal = false, then, from = reviewFrom(clip), stopAt = clip.end } = {}) {
  Player2.stop();
  const a = new window.Audio(url);
  Player2.el = a;
  Player2.gainFn = () => MineLevel.gain(analysis, clip);
  MineLevel.attach(a, Player2.gainFn());
  const rate = Player.v.playbackRate || 1;
  const restoreMute = () => { Player.v.muted = UI.volume === 0; };
  const go = async () => {
    Player.v.muted = !withOriginal || UI.volume === 0;
    Session.preview = { stopAt, then: () => { a.pause(); restoreMute(); Session.previewRec = null; then && then(); } };
    Session.previewRec = { a, clip, analysis, rate };
    await Player.seekAndWait(from);
    Player.play();
    syncRecTo(from);
  };
  a.addEventListener('error', () => { restoreMute(); toast(t('The recording couldn’t play.'), 'bad'); }, { once: true });
  if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  a.load();
  return a;
}
/* move the playing recording to match clip time `at` (after a seek on the chart) */
function syncRecTo(at) {
  const P = Session.previewRec;
  if (!P) return;
  const { a } = P;
  clearTimeout(P.wait);
  const r = recTimeAt(P.clip, P.analysis, at, P.rate);
  if (r >= 0) { a.currentTime = r; a.play().catch(() => {}); } else { a.pause(); a.currentTime = 0; P.wait = setTimeout(() => a.play().catch(() => {}), -r * 1000); }
}
function playMine(clip, url, analysis, then, from) { return playSynced(clip, url, analysis, { then, from }); }
function playBoth(clip, url, analysis) { return playSynced(clip, url, analysis, { withOriginal: true }); }

/* volume of your own recording: matched to the original by default, plus a slider */
function mineVolumeControl() {
  const val = h('span', { class: 'small muted num' }, `${Math.round(MineLevel.volume * 100)}%`);
  return h('div', { class: 'row mine-volume' },
    icon('volume'),
    h('label', { class: 'small', for: 'mineVol' }, t('Your volume')),
    h('input', { type: 'range', id: 'mineVol', min: 0, max: 2, step: 0.05, value: MineLevel.volume,
      oninput: (e) => { MineLevel.set({ volume: +e.target.value }); val.textContent = `${Math.round(+e.target.value * 100)}%`; Player2.relevel(); } }),
    val,
    h('label', { class: 'check small', for: 'mineAuto', title: t('Plays your recording about as loud as the speaker in the clip') },
      h('input', { type: 'checkbox', id: 'mineAuto', checked: MineLevel.auto, onchange: (e) => { MineLevel.set({ auto: e.target.checked }); Player2.relevel(); } }),
      t('Match the original’s loudness')));
}

function passReviewCard() {
  const S = Session;
  const R = S.review;
  const clip = S.clip();
  const an = R.analysis;
  const step3 = R.slot === 'final' ? Store.get('recordings', S.doc.recs.step3) : null;
  return h('div', { class: 'stack' },
    h('div', { class: 'row' },
      h('h3', { class: 'grow' }, R.slot === 'final' ? t('Final pass recorded') : t('Pass recorded')),
      an ? h('span', { class: 'lag' }, fmtLag(an.lag)) : null,
      an && an.manual ? h('span', { class: 'small muted' }, settings().alignMode === 'manual' ? t('(manual offset)') : t('(auto-alignment unsure; manual offset used)')) : null),
    h('div', { class: 'row' },
      btn(t('Original'), () => playOriginal(clip), { size: 'sm', icon: 'play' }),
      btn(t('Mine'), () => playMine(clip, R.url, an), { size: 'sm', icon: 'mic' }),
      btn(t('Original then mine'), () => playOriginal(clip, () => setTimeout(() => playMine(clip, R.url, an, null, clip.start), 300), clip.start), { size: 'sm' }),
      btn(t('Both together'), () => playBoth(clip, R.url, an), { size: 'sm' }),
      btn('', () => stopReviewPlayback(), { size: 'sm', icon: 'stop', title: t('Stop playback') })),
    mineVolumeControl(),
    prosodyCard(clip, an, R.heard, Pron.on()),
    pronCard(clip, R),
    step3 ? h('div', { class: 'row' }, h('span', { class: 'small muted grow' }, t('Compare with your step 3 recording from this session:')),
      btn(t('Compare overlaid'), () => openCompare(step3.id, R.recId, R.url), { size: 'sm', kind: 'blue' })) : null,
    noteForms({ clipId: clip.id, sessionId: S.doc.id, recId: R.recId, pass: S.pass, step: S.step().key }),
    h('div', { class: 'row' },
      btn(t('Redo this pass'), () => S.repeatPass(), { kind: 'ghost', icon: 'replay', title: t('Record this pass again, starting now') }),
      h('span', { class: 'spacer' }),
      btn(t('Continue'), () => S.continueAfterReview(), { kind: 'primary', size: 'big', icon: 'play' })));
}

/* ---------- idle strip: what to practise today ---------- */
function idleSession() {
  const clip = Store.get('clips', UI.clipId);
  const sugg = rotationSuggestion();
  const s = settings();
  const queued = UI.queue.filter((id) => Store.get('clips', id));
  const reviewDue = s.review ? reviewDueClips() : [];
  const firstTime = !Store.all('sessions').some((x) => !x.empty);
  return h('div', { class: 'stack' },
    firstTime ? h('p', { class: 'small muted' }, t('New here? Start with the short session. It counts as a practice day, and you can do the full one tomorrow.')) : null,
    h('div', { class: 'idle-cta' },
      h('div', { class: 'grow' },
        h('span', { class: 'label' }, `${dayName(new Date().getDay())} · ${sugg.title}`),
        h('p', null, sugg.text)),
      sugg.clipId && sugg.clipId !== UI.clipId ? btn(t('Select it'), () => selectClip(sugg.clipId), { size: 'sm' }) : null),
    h('div', { class: 'row' },
      btn(queued.length > 1 ? t('Start queue ({n} clips)', { n: queued.length }) : t('Start 15-minute session'), () => Session.start(queued.length ? queued : [UI.clipId], 'full'),
        { kind: firstTime ? undefined : 'primary', size: 'big', icon: 'play', disabled: !clip && !queued.length }),
      btn(t('Bad-day session ({n} min)', { n: s.badMinutes }), () => Session.start(queued.length ? queued : [UI.clipId], 'badday'), { kind: firstTime ? 'primary' : undefined, size: firstTime ? 'big' : undefined, icon: 'bad', disabled: !clip && !queued.length }),
      reviewDue.length ? btn(t('Review run ({n} due)', { n: reviewDue.length }), () => Session.start(reviewDue.map((c) => c.id), 'review'), { kind: 'blue', icon: 'history' }) : null,
      clip ? h('span', { class: 'small muted' }, clip.done ? t('“{clip}” is done. Practise it again any time.', { clip: clipName(clip) }) : t('Clip: {clip} · {len}', { clip: clipName(clip), len: fmtSec(clip.end - clip.start) })) : h('span', { class: 'small muted' }, t('Select a clip on the timeline or in the library.'))));
}

function rotationSuggestion() {
  const today = new Date().getDay();
  const yesterday = addDays(dayKey(), -1);
  const lastSess = Store.all('sessions').filter((x) => x.date === yesterday && !x.empty).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  if (today === 0) return { title: t('Rest day'), text: t('Sunday is the suggested rest day. A short session still counts if you feel like it.') };
  if ([2, 4, 6].includes(today) && lastSess) {
    const c = Store.get('clips', lastSess.clipId);
    if (c) return { title: t('Repeat day'), text: t('Suggested: repeat yesterday’s clip, “{clip}”.', { clip: clipName(c) }), clipId: c.id };
  }
  if ([1, 3, 5].includes(today)) return { title: t('New clip day'), text: t('Suggested: start a new clip today (Mon, Wed and Fri are new-clip days).') };
  return { title: t('Practice day'), text: t('Pick any clip. The rotation is only a suggestion.') };
}
function reviewDueClips() {
  const s = settings();
  const today = dayKey();
  return Store.all('clips').filter((c) => c.done && !c.archived && c.doneAt && (!c.reviewedAt || c.reviewedAt < c.doneAt) && daysBetween(c.doneAt, today) >= Math.max(1, s.reviewAfterDays - 1) && daysBetween(c.doneAt, today) <= s.reviewAfterDays + 3);
}

function showSessionSummary(sum, streakBefore, nextClipId, redraw = false) {
  const info = streakInfo();
  const grew = info.streak > streakBefore;
  const clip = Store.get('clips', sum.clipId);
  const milestone = grew ? streakMilestone(streakBefore, info.streak) : 0;
  const target = settings().weeklyTarget;
  const weekGoal = grew && info.weekCount === target; // this session is the one that reached the week's target
  if (!redraw && (sum.tickNew || grew)) celebrate(milestone ? 1.6 : sum.tickNew ? 1.2 : 0.8);
  const sess = Store.get('sessions', sum.sessionId);
  const moveDay = async (date, from) => {
    moveSessionDay(sum.sessionId, date, from);
    await Store.flushAll().catch(() => {});
    renderAll();
    showSessionSummary(sum, streakBefore, nextClipId, true);
  };
  const lateCard = sess && sess.movedFrom
    ? h('div', { class: 'card row' },
      h('p', { class: 'grow' }, t('Counted for yesterday ({date}).', { date: fmtDay(sess.date) })),
      btn(t('Undo'), () => moveDay(sess.movedFrom, null), { size: 'sm', kind: 'ghost' }))
    : canCountForYesterday(sum.sessionId)
      ? h('div', { class: 'card row' },
        h('p', { class: 'grow' }, t('You didn’t practise yesterday. A session started before 10am can count for yesterday instead of today.')),
        btn(t('Count this for yesterday'), () => moveDay(addDays(sess.date, -1), sess.date), { size: 'sm', icon: 'history' }))
      : null;
  const recs = [sum.recs.step3, sum.recs.final].filter(Boolean);
  openModal([
    modalHead(sum.complete ? t('Session complete!') : t('Session saved')),
    h('div', { class: 'card celebrate' },
      h('div', { class: 'big-num' }, `${info.streak}`),
      h('p', null, h('strong', null, grew ? tp(info.streak, 'day streak · it grew!', 'day streak · it grew!') : tp(info.streak, 'day streak', 'day streak'))),
      h('p', { class: 'muted' }, tp(sum.passes, '{n} pass · {min} min · {week}/{target} sessions this week', '{n} passes · {min} min · {week}/{target} sessions this week', { min: sum.minutes, week: info.weekCount, target: settings().weeklyTarget })),
      milestone ? h('p', { class: 'formok' }, t('{n}-day streak. Well done for coming back every day.', { n: milestone })) : null,
      weekGoal ? h('p', { class: 'formok' }, t('Weekly goal reached: {n} days this week.', { n: target })) : null,
      sum.tickNew ? h('p', { class: 'formok' }, t('“{clip}” gets its tick.', { clip: clipName(clip) })) : null,
      !sum.complete && sum.mode === 'full' ? h('p', { class: 'small muted' }, t('Progress so far is saved. The clip gets its tick after one complete session.')) : null),
    lateCard,
    pronSummaryCard(sum),
    recs.length === 2 ? btn(t('Compare step 3 with your final pass'), () => openCompare(sum.recs.step3, sum.recs.final), { kind: 'blue' }) : null,
    h('div', { class: 'row' },
      nextClipId ? btn(t('Next clip in the queue'), () => { closeModal(); Session.begin(nextClipId, sum.mode === 'review' ? 'review' : 'full'); }, { kind: 'primary', size: 'big', icon: 'play' }) : btn(t('Done'), () => closeModal(), { kind: 'primary', size: 'big' }),
      btn(t('Clip history'), () => openHistory(sum.clipId), { icon: 'history' }),
      h('span', { class: 'spacer' }),
      deleteSessionButton(sum.sessionId, () => closeModal())),
  ], { narrow: true });
}
