/* ---------- PROTOTYPE (design mockup, demo data, not for merge) ----------
   "Text" view in the analysis panel: the clip's transcript as plain text on a time axis.
   - The clip runs across the full width on the same time axis as the Pitch and Waveform charts: one-second
     lines, an orange playhead that moves, click or drag to seek. Each word starts where it was said, and the
     bar under it is as long as the word was said, green when it matches the speaker and orange when it differs.
   - The speaker's phones sit under each word (or above it, with the toggle).
   - Only where your take differs: the bar under the word is orange (green when it matches), and a "you" line appears under the speaker's
     phones. Each of the two lines has its own small listen icon.
   {braces} in a phone string mark the symbols that differ. Words, phones, times and differences are
   hard-coded demo data for the screenshots. */
const DEMO_TEXT = [
  { w: 'It', a: 0.25, b: 0.38, p: 'ɪt' },
  { w: 'was', a: 0.38, b: 0.62, p: 'wəz' },
  { w: 'an', a: 0.62, b: 0.78, p: 'ən' },
  { w: 'unbelievably', a: 0.85, b: 1.78, p: 'ʌnbɪˈl{i}vəbli', you: 'ʌnbɪˈl{ɪ}vəbli' },
  { w: 'important', a: 1.84, b: 2.42, p: 'ɪmˈpɔ{ɹ}tənt', you: 'ɪmˈpɔ{∅}tənt' },
  { w: 'opportunity', a: 2.58, b: 3.5, p: 'ˌɑpɚˈ{t}unəti', you: 'ˌɑpɚˈ{tʃ}unəti' },
  { w: 'for', a: 3.56, b: 3.74, p: 'fɔɹ' },
  { w: 'us', a: 3.74, b: 4.08, p: 'ʌs' },
];

/* shrink a word only if it wouldn't fit before the next word starts */
function tvFit(text, widthPx, maxRem, minRem, em = 0.6) {
  const chars = String(text).replace(/[{}]/g, '').length || 1;
  return Math.max(minRem, Math.min(maxRem, widthPx / (chars * em * 16))) + 'rem';
}
/* "ɪmˈpɔ{ɹ}tənt" -> text with the differing symbols marked */
function tvPhones(s) {
  return String(s).split(/([{}])/).reduce((acc, part) => {
    if (part === '{') acc.on = true;
    else if (part === '}') acc.on = false;
    else if (part) acc.out.push(acc.on ? h('b', { class: 'x' }, part) : part);
    return acc;
  }, { on: false, out: [] }).out;
}
const tvPlain = (s) => String(s).replace(/[{}]/g, '');

function buildTextView(clip) {
  const dur = clip.end - clip.start;
  const wordsTop = UI.textTop !== 'phones';
  const pct = (t) => (t / dur) * 100 + '%';

  const listen = (who, d) => h('button', {
    type: 'button', class: 'tv-listen ' + who,
    title: who === 'spk' ? 'Hear the speaker say “' + d.w + '”' : 'Hear how you said “' + d.w + '”',
    'aria-label': who === 'spk' ? 'Hear the speaker say “' + d.w + '”' : 'Hear how you said “' + d.w + '”',
    onclick: (e) => { e.stopPropagation(); if (who === 'spk') { Player.seek(clip.start + d.a); Player.play(); } },
  }, icon('volume'));

  const words = DEMO_TEXT.map((d) => {
    const big = h('div', { class: 'tv-big ' + (wordsTop ? 'wd' : 'ph') }, h('span', { class: 'tv-mark' }, wordsTop ? d.w : tvPhones(d.p)));
    const sub = h('div', { class: 'tv-sub ' + (wordsTop ? 'ph' : 'wd') }, h('span', null, wordsTop ? tvPhones(d.p) : d.w), d.you ? listen('spk', d) : null);
    const bar = h('div', { class: 'tv-bar' });
    const el = h('div', { class: 'tv-w' + (d.you ? ' diff' : ''), style: { left: pct(d.a), width: pct(d.b - d.a) } }, big, bar, sub,
      d.you ? h('div', { class: 'tv-you' }, h('span', { class: 'tv-tag' }, 'you'), h('span', { class: 'tv-yph' }, tvPhones(d.you)), listen('you', d)) : null);
    return { d, el, big, sub };
  });

  // one-second lines, as in the Pitch and Waveform views
  const ticks = [];
  for (let s = 1; s < dur; s++) ticks.push(h('div', { class: 'tv-tick', style: { left: pct(s) } }));
  const head = h('div', { class: 'tv-head' });
  const view = h('div', { class: 'tv-view' }, ticks, words.map((x) => x.el), head);
  Panel.canvas = view;
  Panel.refs = { view, head, dur, words, w: 0 };

  // click or drag to move through the clip: the same as on the Pitch and Waveform charts
  let down = false;
  const seekTo = (e) => {
    const r = view.getBoundingClientRect();
    Player.seek(Math.min(clip.start + clamp((e.clientX - r.left) / r.width, 0, 1) * dur, clip.end - 0.05));
  };
  view.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; down = true; view.setPointerCapture(e.pointerId); seekTo(e); });
  view.addEventListener('pointermove', (e) => { if (down) seekTo(e); });
  view.addEventListener('pointerup', () => { down = false; });
  view.addEventListener('pointercancel', () => { down = false; });

  const diffs = DEMO_TEXT.filter((d) => d.you).length;
  return [view,
    h('p', { class: 'tv-foot small muted' },
      h('span', { class: 'tv-dot' }), `${diffs} words sound different from the speaker in your last take. `,
      'Green bar: same as the speaker. Orange bar: different. Each bar is as long as the word.')];
}

Panel.drawText = function (now) {
  const { view, head, dur, words } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!view || !clip) return;
  const W = view.clientWidth;
  if (W && W !== this.refs.w) { // size each word to the room it has before the next one starts
    this.refs.w = W;
    words.forEach(({ d, big, sub }, i) => {
      const next = DEMO_TEXT[i + 1];
      const room = ((next ? next.a : dur) - d.a) / dur * W - 8;
      const wordsTop = UI.textTop !== 'phones';
      big.style.fontSize = tvFit(wordsTop ? d.w : tvPlain(d.p), room, 1.6, 0.85, wordsTop ? 0.56 : 0.62);
      sub.style.fontSize = tvFit(wordsTop ? d.p : d.w, room - (d.you ? 26 : 0), 0.95, 0.72, wordsTop ? 0.62 : 0.56);
    });
  }
  head.style.left = clamp((now - clip.start) / dur, 0, 1) * W + 'px';

};
