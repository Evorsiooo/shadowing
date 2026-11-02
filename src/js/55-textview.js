/* ---------- PROTOTYPE (design mockup, demo data, not for merge) ----------
   "Text" view in the analysis panel. Every word sits at its real start time and is exactly as wide as it was
   said, so the strip is a time axis like the scrub bar. Fixed rows, named in a gutter on the left:
     Words (or Speaker's phones, with the toggle) / Speaker's phones (or words) / You.
   {braces} in a phone string mark the symbols that differ. All of the words, phones, times and differences
   below are hard-coded demo data for the screenshots. */
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
const TEXT_PPS = 320; // pixels per second of clip, the same for every word
const TEXT_HEAD = 0.3; // the playhead sits 30% in from the left edge of the strip

/* text inside a cell: shrink to fit the word's own width, never wider than its time slot */
function tvFit(text, widthPx, maxRem, minRem) {
  const chars = String(text).replace(/[{}]/g, '').length || 1;
  return Math.max(minRem, Math.min(maxRem, widthPx / (chars * 0.62 * 16))) + 'rem';
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
  const m = clip.model;

  // pitch lines behind (speaker green, your demo take blue), drawn like the Pitch view
  const pts = (shift) => {
    let d = '', pen = false;
    for (let i = 0; i < m.st.length; i++) {
      const v = m.st[i], ct = i * m.hop;
      if (v == null || Math.abs(v) > 12) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + (ct * TEXT_PPS).toFixed(1) + ' ' + (23 - (v / 12) * 18 + shift(i)).toFixed(1);
      pen = true;
    }
    return d;
  };
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tv-pitch'); svg.setAttribute('width', trackW); svg.setAttribute('height', 46);
  for (const [d, cls] of [[pts(() => 0), 'sp'], [pts((i) => Math.sin(i / 7) * 2 + 4), 'you']]) {
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); svg.appendChild(p);
  }

  const hear = (who, d) => btn(who === 'spk' ? 'Speaker' : 'You',
    (e) => { e.stopPropagation(); if (who === 'spk') { Player.seek(clip.start + d.a); Player.play(); } },
    { icon: 'play', size: 'sm', kind: who === 'spk' ? 'primary' : 'blue', title: who === 'spk' ? 'Hear the speaker say “' + d.w + '”' : 'Hear your take of “' + d.w + '”' });

  const tile = (d) => {
    const wpx = Math.max(30, (d.b - d.a) * TEXT_PPS - 6);
    return h('div', { class: 'tv-tile' + (d.you ? ' diff' : ''), style: { left: d.a * TEXT_PPS + 'px', width: (d.b - d.a) * TEXT_PPS - 4 + 'px' }, onclick: () => Player.seek(clip.start + d.a) },
      h('div', { class: 'tv-big ' + (wordsTop ? 'wd' : 'ph'), style: { fontSize: tvFit(wordsTop ? d.w : tvPlain(d.p), wpx, 1.4, 0.8) } }, wordsTop ? d.w : tvPhones(d.p)),
      h('div', { class: 'tv-small ' + (wordsTop ? 'ph' : 'wd'), style: { fontSize: tvFit(wordsTop ? tvPlain(d.p) : d.w, wpx, 0.9, 0.66) } }, wordsTop ? tvPhones(d.p) : d.w));
  };
  const fixCard = (d) => {
    const mid = ((d.a + d.b) / 2) * TEXT_PPS;
    return h('div', { class: 'tv-fix', style: { left: mid + 'px' } },
      h('div', { class: 'tv-line spk' }, hear('spk', d), h('span', { class: 'tv-ph' }, tvPhones(d.p))),
      h('div', { class: 'tv-line you' }, hear('you', d), h('span', { class: 'tv-ph' }, tvPhones(d.you))));
  };

  const track = h('div', { class: 'tv-track', style: { width: trackW + 'px', backgroundSize: TEXT_PPS + 'px 100%' } }, svg,
    DEMO_TEXT.map(tile), DEMO_TEXT.filter((d) => d.you).map(fixCard));
  const view = h('div', { class: 'tv-view' }, track, h('div', { class: 'tv-head', style: { left: TEXT_HEAD * 100 + '%' } }));
  const box = h('div', { class: 'tv-box' }, view);
  Panel.canvas = box;
  Panel.refs.track = track; Panel.refs.box = view; Panel.refs.dur = dur;

  // drag the text to scrub, like the scrub bar
  let down = null;
  view.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; down = { x: e.clientX, t: Player.time() }; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', (e) => { if (down) Player.seek(clamp(down.t - (e.clientX - down.x) / TEXT_PPS, clip.start, clip.end - 0.05)); });
  view.addEventListener('pointerup', () => { down = null; });

  const diffs = DEMO_TEXT.filter((d) => d.you).length;
  return [box,
    h('div', { class: 'row tv-legend small muted' },
      h('span', { class: 'tv-key' }), diffs + ' differences from the speaker in take 3',
      h('span', { class: 'spacer' }),
      'Each word is as wide as it was said · Drag to scrub')];
}

Panel.drawText = function (now) {
  const { track, box, dur } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!track || !clip) return;
  const x = clamp(now - clip.start, 0, dur) * TEXT_PPS;
  track.style.transform = `translateX(${box.clientWidth * TEXT_HEAD - x}px)`;
};
