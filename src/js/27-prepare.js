/* ---------- the speaker's side of a clip, worked out once and kept with the clip (global `Prep`) ----------
   What the Pronunciation check needs from the speaker never changes for a clip: its sounds (24-phones.js) and, if word labels are on, its
   words (26-words.js). Both are worked out once, ahead of time, and saved ON THE CLIP like the model line and the words already are:
     clip.words / clip.wordsFor    the speaker's words (26-words.js)
     clip.speakerPhones            { v, model, start, end, fp, seq, at }   the speaker's sounds; fp = fingerprint of the audio they came from
   Clips are synced documents (D1, every device), so a second device or a reinstall reads them instead of redoing the work. The engine's own
   browser store (IndexedDB) is only a speed layer on top. Both are dropped when the clip's start or end changes (50-panel.js).
   When it runs:
     - in the background soon after a clip is saved or its range changed (schedule): yields to recording, to playback anywhere in the app and to a
       low battery (Heavy background jobs), and does nothing unless the learner turned the features on;
     - when a clip is opened for practice or its take is compared (ensure / around): the same work, with everything else waiting behind it.
   Each feature is separate: no sounds unless Pronunciation analysis is on and its model downloaded, no words unless Word labels are on. */
const Prep = (() => {
  const running = new Map(); // `${clipId}:${start}:${end}` -> { promise, subs, last }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const iso = () => new Date().toISOString();

  /* the engine's sequence without the extra digits (it goes into a synced document) */
  function compact(seq) {
    return { ...seq, frameSec: r3(seq.frameSec), durationSec: r3(seq.durationSec), phones: seq.phones.map((p) => ({ ...p, t0: r3(p.t0), t1: r3(p.t1), ...(p.conf != null ? { conf: Math.round(p.conf * 100) / 100 } : {}) })), words: seq.words.map((w) => ({ ...w, t0: r3(w.t0), t1: r3(w.t1) })) };
  }
  /* the learner's side of one take, kept on its recording (a synced document) so nothing has to be read twice and an AI app can read it (server/mcp.js):
     recording.takeAnalysis = { v, model, clipStart, clipEnd, speakerFp, status, learner: PhoneSequence, diffs: PhoneDiff[], stats, suggested, at }
     speakerFp = fingerprint of the speaker's audio it was compared with; the take is only reused while the clip's range, the model and that fingerprint are unchanged. */
  function takeSeq(seq) { const { timingsMs, external, ...rest } = seq; return compact(rest); }
  function saveTake(recId, clip, r, speakerFp) {
    if (!recId || !r || !r.learner || !r.comparison) return;
    const d2 = (x) => Math.round(x * 100) / 100, side = (x) => (x ? { ...x, t0: r3(x.t0), t1: r3(x.t1), conf: d2(x.conf) } : x);
    const diffs = r.comparison.diffs.map((d) => ({ ...d, speaker: side(d.speaker), learner: side(d.learner), t0: r3(d.t0), t1: r3(d.t1), learnerT0: r3(d.learnerT0), learnerT1: r3(d.learnerT1), distance: d2(d.distance), confidence: d2(d.confidence) }));
    Store.patch('recordings', recId, { takeAnalysis: { v: 1, model: r.learner.model, clipStart: clip.start, clipEnd: clip.end, speakerFp: speakerFp || null, status: r.status, learner: takeSeq(r.learner), diffs, stats: r.comparison.stats, suggested: r.suggested || [], at: iso() } });
  }
  /* a saved comparison for this take, as the engine's ClipResult (without the alignment steps), or null when it no longer fits */
  function savedTake(recId, clip, speakerSeqNow) {
    const rec = recId && Store.get('recordings', recId), a = rec && rec.takeAnalysis;
    if (!a || !speakerSeqNow || a.model !== Phones.MODEL_ID || a.clipStart !== clip.start || a.clipEnd !== clip.end || !a.speakerFp || a.speakerFp !== speakerSeqNow.fp) return null;
    return { v: 1, key: 'saved', createdAt: Date.parse(a.at) || 0, speaker: speakerSeqNow.seq, learner: a.learner, comparison: { v: 1, ops: [], diffs: a.diffs, stats: a.stats }, status: a.status, suggested: a.suggested };
  }
  const phonesOn = () => typeof Phones !== 'undefined' && Pron.on() && PhonesAdapter.ready();
  const wordsOn = (c) => typeof Words !== 'undefined' && Heavy.isOn('words') && Words.supported().ok && !c.wordsFor;
  const fresh = (c) => Store.get('clips', c.id) || c;
  const same = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;

  /* the speaker's sounds saved on the clip, if they fit this clip and this model: { fp, seq } */
  function speakerSeq(c) {
    const sp = c && c.speakerPhones;
    return sp && sp.model === Phones.MODEL_ID && sp.start === c.start && sp.end === c.end && sp.seq && sp.fp ? { fp: sp.fp, seq: sp.seq } : null;
  }
  async function audio(c) {
    let spk = VideoAudio.slice(c.videoId, c.start, c.end);
    if (!spk) { const v = Store.get('videos', c.videoId); if (v) { await VideoAudio.ensure(v, c.start, c.end); spk = VideoAudio.slice(c.videoId, c.start, c.end); } }
    return spk;
  }
  const markWordsFailed = (id) => { if (typeof PronTab !== 'undefined') PronTab.wordsFailed.add(id); };

  async function work(clip, ctx, report) {
    const background = () => ctx.background; // read when a job starts waiting: an urgent request can arrive later and clears it
    const needSpeaker = phonesOn() && !speakerSeq(clip), needWords = wordsOn(clip);
    const P = (needSpeaker ? 1 : 0) + (needWords ? 1 : 0);
    let i = 0;
    const say = (stage, inner) => report({ stage, step: i, steps: P, inner: Math.max(0, Math.min(1, inner || 0)) });
    if (!P) { if ((ctx.warm || !ctx.background) && phonesOn()) await Heavy.run('pronunciation', () => Phones.load(), { timeoutMs: 120000, background }); return; } // nothing to read: just have the model ready
    if (needSpeaker) {
      i++; say('speaker', 0);
      const spk = await audio(clip);
      if (spk) {
        const seq = await Heavy.run('pronunciation', async () => { await Phones.load(); return Phones.transcribe(spk, { originSec: 0, cache: true, onProgress: (d, tot) => say('speaker', d / tot) }); }, { timeoutMs: 120000, background });
        if (same(fresh(clip), clip)) Store.patch('clips', clip.id, { speakerPhones: { v: 1, model: Phones.MODEL_ID, start: clip.start, end: clip.end, fp: Phones.fingerprint(spk), seq: compact(seq), at: iso() } });
      }
    }
    if (needWords) {
      i++; say('words', 0);
      const off = Words.onStatus((m) => say('words', m.state === 'downloading' ? m.progress : 0));
      try { await Words.ensure(fresh(clip), { background }); } catch (e) { markWordsFailed(clip.id); console.info('words skipped:', Pron.reason(e)); } finally { off(); }
      if (!fresh(clip).wordsFor) markWordsFailed(clip.id);
    }
  }

  /* do whatever is still missing for the clip. opts.onProgress({ stage, step, steps, inner }); opts.background: nobody is waiting (see above).
     The same clip asked twice shares one run. Rejects only when the speaker's sounds can't be read. */
  function ensure(clip, opts = {}) {
    clip = fresh(clip);
    const key = `${clip.id}:${clip.start}:${clip.end}`;
    let r = running.get(key);
    if (!r) {
      r = { subs: new Set(), last: null, ctx: { background: !!opts.background, warm: !!opts.warm } };
      r.promise = work(clip, r.ctx, (p) => { r.last = p; r.subs.forEach((f) => { try { f(p); } catch { /* a listener must not break the work */ } }); }).finally(() => running.delete(key));
      running.set(key, r);
    }
    if (!opts.background) r.ctx.background = false;
    if (opts.onProgress) { r.subs.add(opts.onProgress); if (r.last) opts.onProgress(r.last); }
    return r.promise;
  }

  /* prepare, then run fn(onProgress) (the take's analysis), under ONE progress: the prepare steps first, then fn's own steps.
     extraSteps = how many steps fn reports. onProgress({ stage, step, steps, fraction }) */
  async function around(clip, extraSteps, onProgress, fn) {
    let P = 0;
    await ensure(clip, { onProgress: onProgress && ((p) => { P = p.steps; onProgress({ stage: p.stage, step: p.step, steps: p.steps + extraSteps, fraction: (p.step - 1 + p.inner) / (p.steps + 1) }); }) });
    return fn(onProgress && ((q) => onProgress({ ...q, step: P + q.step, steps: P + q.steps, fraction: (P + q.fraction) / (P + 1) })));
  }

  /* in the background, soon after a clip is saved or its range changed */
  function schedule(clip) {
    try { if (targetLang() !== 'en' || Heavy.device().saveData || !(Pron.on() || Heavy.isOn('words'))) return; } catch { return; }
    setTimeout(() => { ensure(clip, { background: true }).catch((e) => console.info('preparing the clip skipped:', Pron.reason(e))); }, 2500);
  }

  return { ensure, around, schedule, speakerSeq, compact, saveTake, savedTake };
})();
