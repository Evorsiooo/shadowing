// The session steps with realistic, populated data: a real (generated) video, a speaker line, a finished recording with its pitch line,
// sound differences and a "listen for these" list. Used by scripts/test-layout.mjs. See docs/LAYOUT.md.
import { speechLine } from './harness.mjs';

const go = (hash) => async (p) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(300); };

/* starts a full session of the first clip and puts it in a step. step: 0 listen, 1 shadow, 2 record, 3 again. phase: intro | playing | armed | review */
export async function openStep(p, step, phase, { lag = 0.5, listenFor = false, many = false, clip = 'c1' } = {}) {
  await go('#today')(p);
  await p.evaluate((id) => Session.start([id], 'full'), clip); // always the same clip (the Today card picks one by the day of the week)
  await p.waitForFunction(() => typeof Session !== 'undefined' && Session.active, null, { timeout: 6000 });
  await p.waitForSelector('#player video', { timeout: 6000 });
  await p.waitForFunction(() => { const v = document.querySelector('#player video'); return v && v.videoWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(({ step, phase, lag, listenFor, many, line }) => {
    const S = Session, clip = S.clip();
    S.stepIdx = step; S.pass = 0; S.phase = phase === 'review' ? 'review' : phase;
    const words = clip.words;
    if (listenFor || step === 3) {
      S.listenFor = [
        { word: 'think', text: 'th as in “think”; you may have said s (“sit”).', a: 0.3, b: 1.2 },
        { word: 'beginning', text: 'r as in “red”; you may have said l (“let”).', a: 2.4, b: 3.4 },
        { word: 'again', text: 'The vowel is shorter than the speaker’s.', a: 3.9, b: 4.7 },
      ];
    }
    if (phase === 'review') {
      const an = { st: line.st, db: line.db, hop: line.hop, offset: 0, lag, score: 0.8, manual: false, refHz: 112 };
      Panel.lastPass = { ...an, clipId: clip.id };
      const diffs = [
        { a: 0.3, b: 1.0, words: 'think', speaker: ['θ', 'ɪ', 'ŋ', 'k'], you: ['s', 'ɪ', 'ŋ', 'k'], from: 'θ', to: 's', conf: 0.9 },
        { a: 2.5, b: 3.2, words: 'beginning', speaker: ['b', 'ɪ', 'g'], you: ['b', 'ɪ', 'g'], from: 'r', to: 'l', conf: 0.8 },
        { a: 3.9, b: 4.6, words: 'start', speaker: ['s', 't', 'ɑː', 't'], you: ['s', 't', 'æ', 't'], from: 'ɑː', to: 'æ', conf: 0.7 },
      ];
      if (many) for (let i = 0; i < 21; i++) diffs.push({ a: 0.2 + i * 0.2, b: 0.5 + i * 0.2, words: '', speaker: ['ð'], you: ['d'], from: 'ð', to: 'd', conf: 0.3 });
      S.review = { url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', recId: 'rev-fx', slot: step === 3 ? 'final' : 'step3', analysis: an, phones: { v: 1, diffs, sounds: { 'θ': 4, 'ð': 6, 'r': 8 } }, heard: null, clipId: clip.id };
      S.doc.recs = {};
    }
    renderAll(); window.dispatchEvent(new Event('resize'));
  }, { step, phase, lag, listenFor, many, line: speechLine(await p.evaluate(() => Session.clip().words), 6.5, { shift: lag, wobble: 3.2, seed: 7 }) });
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
  { name: 'Step 4 Shadow again, intro with Listen for these', step: 3, phase: 'intro' },
  { name: 'Step 4 Shadow again, last pass review', step: 3, phase: 'review', fits: true },
  // a portrait (phone-shaped) video: narrow picture, the text under and beside it must stay readable
  { name: 'Tall video, Step 1 Listen', step: 0, phase: 'intro', clip: 'c3' },
  { name: 'Tall video, Step 3 Record, before recording', step: 2, phase: 'armed', clip: 'c3' },
  { name: 'Tall video, Step 3 Record, review of the take', step: 2, phase: 'review', clip: 'c3', fits: true },
  { name: 'Tall video, Step 4 Shadow again, intro with Listen for these', step: 3, phase: 'intro', clip: 'c3' },
].map((s) => ({ ...s, path: '/app/?pronmock=1', session: true, run: (p) => openStep(p, s.step, s.phase, s) }));
