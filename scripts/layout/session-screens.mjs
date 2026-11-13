// The session steps with realistic, populated data: a real (generated) video, a speaker line, a finished recording with its pitch line,
// sound differences and a "listen for these" list. Used by scripts/test-layout.mjs. See docs/LAYOUT.md.
import { speechLine } from './harness.mjs';

const go = (hash) => async (p) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(300); };

/* starts a full session of the first clip and puts it in a step. step: 0 listen, 1 shadow, 2 record, 3 again. phase: intro | playing | armed | review */
export async function openStep(p, step, phase, { lag = 0.5, listenFor = false, many = false, unmatched = false, clip = 'c1' } = {}) {
  await go('#today')(p);
  await p.evaluate((id) => Session.start([id], 'full'), clip); // always the same clip (the Today card picks one by the day of the week)
  await p.waitForFunction(() => typeof Session !== 'undefined' && Session.active, null, { timeout: 6000 });
  await p.waitForSelector('#player video', { timeout: 6000 });
  await p.waitForFunction(() => { const v = document.querySelector('#player video'); return v && v.videoWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(({ step, phase, lag, listenFor, many, unmatched, line }) => {
    const S = Session, clip = S.clip();
    S.stepIdx = step; S.pass = 0; S.phase = phase;
    const words = clip.words;
    if (phase === 'review' || step === 3 || listenFor) {
      const an = { st: line.st, db: line.db, hop: line.hop, offset: 0, lag, score: 0.8, manual: false, refHz: 112 };
      Panel.lastPass = { ...an, clipId: clip.id };
      // the places and sounds are fixed, but the WORD of each is worked out by the app's own matching (wordsAt), not written in here:
      // a made-up word in the test data once hid a wrong word ("r" on "beginning") that the real code had already fixed
      const raw = [
        { a: 0.32, b: 0.6, speaker: ['θ', 'ɪ', 'ŋ', 'k'], you: ['s', 'ɪ', 'ŋ', 'k'], from: 'θ', to: 's', conf: 0.9 }, // “think”
        { a: 1.25, b: 1.5, speaker: ['p', 'r', 'ɒ'], you: ['p', 'l', 'ɒ'], from: 'r', to: 'l', conf: 0.8 }, // “probably”
        { a: 3.35, b: 3.6, speaker: ['s', 't', 'ɑː', 't'], you: ['s', 't', 'æ', 't'], from: 'ɑː', to: 'æ', conf: 0.7 }, // “start”
        { a: 2.45, b: 2.7, speaker: ['ð', 'ə'], you: ['d', 'ə'], from: 'ð', to: 'd', conf: 0.6 }, // “the”
        { a: 0.04, b: 0.12, speaker: ['ð'], you: ['d'], from: 'ð', to: 'd', conf: unmatched ? 0.95 : 0.5 }, // next to “I”, which has no “th”: the card must not name it
      ];
      const diffs = raw.map((d) => ({ ...d, words: wordsAt(clip, d.a, d.b, d.from) }));
      for (const d of diffs) if (d.words && !spellsSound(d.words, d.from)) throw new Error(`the matching put “${d.from}” on “${d.words}”`);
      if (many) for (let i = 0; i < 21; i++) diffs.push({ a: 0.2 + i * 0.2, b: 0.5 + i * 0.2, words: wordsAt(clip, 0.2 + i * 0.2, 0.5 + i * 0.2, 'ð'), speaker: ['ð'], you: ['d'], from: 'ð', to: 'd', conf: 0.3 });
      S.review = { url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', recId: 'rev-fx', slot: step === 3 ? 'final' : 'step3', analysis: an, phones: { v: 1, diffs, sounds: { 'θ': 4, 'ð': 6, 'r': 8 } }, heard: null, clipId: clip.id };
      S.doc.recs = {};
      // the list for step 4 is made by the app itself from this review, exactly as when you press Continue
      S.listenFor = tryItems(clip, S.review).shown.map((it) => tryText(it, clip));
      S.listenTake = { url: S.review.url, analysis: an };
      if (phase !== 'review') S.review = null;
    }
    renderAll(); window.dispatchEvent(new Event('resize'));
  }, { step, phase, lag, listenFor, many, unmatched, line: speechLine(await p.evaluate(() => Session.clip().words), 6.5, { shift: lag, wobble: 3.2, seed: 7 }) });
  await p.waitForTimeout(700);
  if (phase === 'review') await p.waitForSelector('.rev-bar', { timeout: 4000 });
  await p.waitForTimeout(400);
}

export const SESSION_SCREENS = [
  { name: 'Step 1 Listen, intro', step: 0, phase: 'intro' },
  { name: 'Step 2 Shadow, intro', step: 1, phase: 'intro' },
  { name: 'Step 3 Record, before recording', step: 2, phase: 'armed' },
  { name: 'Step 3 Record, review of the take', step: 2, phase: 'review', fits: true },
  { name: 'Step 3 Record, review with many differences', step: 2, phase: 'review', many: true, fits: true },
  { name: 'Step 3 Record, review where a sound has no word to name', step: 2, phase: 'review', unmatched: true, fits: true },
  { name: 'Step 4 Shadow again, intro with Listen for these', step: 3, phase: 'intro' },
  { name: 'Step 4 Shadow again, last pass review', step: 3, phase: 'review', fits: true },
  // a portrait (phone-shaped) video: narrow picture, the text under and beside it must stay readable
  { name: 'Tall video, Step 1 Listen', step: 0, phase: 'intro', clip: 'c3' },
  { name: 'Tall video, Step 3 Record, before recording', step: 2, phase: 'armed', clip: 'c3' },
  { name: 'Tall video, Step 3 Record, review of the take', step: 2, phase: 'review', clip: 'c3', fits: true },
  { name: 'Tall video, Step 4 Shadow again, intro with Listen for these', step: 3, phase: 'intro', clip: 'c3' },
].map((s) => ({ ...s, path: '/app/?pronmock=1', session: true, run: (p) => openStep(p, s.step, s.phase, s) }));
