/* ---------- PROTOTYPE (design mockup, demo data, not for merge) ----------
   "Text" view in the analysis panel: the clip's transcript as plain text on a time axis.
   - Each word starts at its real start time. A thin bar under it is as long as the word was said, and fills
     green as the playhead passes (karaoke style), so the strip reads like the scrub bar.
   - The speaker's phones sit under each word (or above it, with the toggle).
   - Only where your take differs: the word gets a yellow marker, and a "you" line appears under the speaker's
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
const TEXT_PPS = 300; // pixels per second of clip, the same for every word
const TEXT_HEAD = 0.32; // the playhead sits a third of the way in

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
  const trackW = Math.ceil(dur * TEXT_PPS);

  const listen = (who, d) => h('button', {
    type: 'button', class: 'tv-listen ' + who,
    title: who === 'spk' ? 'Hear the speaker say “' + d.w + '”' : 'Hear how you said “' + d.w + '”',
    'aria-label': who === 'spk' ? 'Hear the speaker say “' + d.w + '”' : 'Hear how you said “' + d.w + '”',
    onclick: (e) => { e.stopPropagation(); if (who === 'spk') { Player.seek(clip.start + d.a); Player.play(); } },
  }, icon('volume'));

  const words = DEMO_TEXT.map((d, i) => {
    const next = DEMO_TEXT[i + 1];
    const room = ((next ? next.a : dur) - d.a) * TEXT_PPS - 10; // space before the next word
    const big = wordsTop ? d.w : tvPlain(d.p);
    const fill = h('i');
    const el = h('div', { class: 'tv-w' + (d.you ? ' diff' : ''), style: { left: d.a * TEXT_PPS + 'px' }, onclick: () => Player.seek(clip.start + d.a) },
      h('div', { class: 'tv-big ' + (wordsTop ? 'wd' : 'ph'), style: { fontSize: tvFit(big, room, 1.75, 0.95, wordsTop ? 0.56 : 0.62) } },
        h('span', { class: 'tv-mark' }, wordsTop ? d.w : tvPhones(d.p))),
      h('div', { class: 'tv-bar', style: { width: Math.max(8, (d.b - d.a) * TEXT_PPS - 6) + 'px' } }, fill),
      h('div', { class: 'tv-sub ' + (wordsTop ? 'ph' : 'wd') }, h('span', null, wordsTop ? tvPhones(d.p) : d.w), d.you ? listen('spk', d) : null),
      d.you ? h('div', { class: 'tv-you' }, h('span', { class: 'tv-tag' }, 'you'), h('span', { class: 'tv-yph' }, tvPhones(d.you)), listen('you', d)) : null);
    return { d, el, fill };
  });

  // a quiet ruler of seconds along the bottom, in the video's own time
  const ticks = [];
  for (let s = Math.ceil(clip.start * 2) / 2; s <= clip.end; s += 0.5) {
    const whole = Math.abs(s - Math.round(s)) < 1e-6;
    ticks.push(h('div', { class: 'tv-tick' + (whole ? ' whole' : ''), style: { left: (s - clip.start) * TEXT_PPS + 'px' } }, whole ? fmtTime(s) : null));
  }

  const track = h('div', { class: 'tv-track', style: { width: trackW + 'px' } }, words.map((x) => x.el), h('div', { class: 'tv-ruler' }, ticks));
  const view = h('div', { class: 'tv-view' }, track, h('div', { class: 'tv-head', style: { left: TEXT_HEAD * 100 + '%' } }, h('span')));
  Panel.canvas = view;
  Panel.refs = { track, view, dur, words };

  // drag the text to scrub, like the scrub bar
  let down = null;
  view.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; down = { x: e.clientX, t: Player.time() }; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', (e) => { if (down) Player.seek(clamp(down.t - (e.clientX - down.x) / TEXT_PPS, clip.start, clip.end - 0.05)); });
  view.addEventListener('pointerup', () => { down = null; });

  const diffs = DEMO_TEXT.filter((d) => d.you).length;
  return [view,
    h('p', { class: 'tv-foot small muted' },
      h('span', { class: 'tv-dot' }), `${diffs} words sound different from the speaker in your last take. `,
      'Tap a word to jump to it, or drag the text to scrub.')];
}

Panel.drawText = function (now) {
  const { track, view, dur, words } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!track || !clip) return;
  const ct = clamp(now - clip.start, 0, dur);
  track.style.transform = `translateX(${Math.round(view.clientWidth * TEXT_HEAD - ct * TEXT_PPS)}px)`;
  for (const { d, el, fill } of words) {
    const f = clamp((ct - d.a) / (d.b - d.a), 0, 1);
    fill.style.width = f * 100 + '%';
    el.classList.toggle('now', ct >= d.a && ct < d.b);
  }
};
