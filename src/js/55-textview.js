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
const TEXT_ROWS = [34, 30, 38]; // row heights: big row, small row, "You" row

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
  const rowTop = [0, TEXT_ROWS[0], TEXT_ROWS[0] + TEXT_ROWS[1]];

  // pitch lines behind (speaker green, your demo take blue)
  const pts = (shift) => {
    let d = '', pen = false;
    for (let i = 0; i < m.st.length; i++) {
      const v = m.st[i], ct = i * m.hop;
      if (v == null || Math.abs(v) > 12) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + (ct * TEXT_PPS).toFixed(1) + ' ' + (40 - (v / 12) * 33 + shift(i)).toFixed(1);
      pen = true;
    }
    return d;
  };
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tv-pitch'); svg.setAttribute('width', trackW); svg.setAttribute('height', 80);
  for (const [d, cls] of [[pts(() => 0), 'sp'], [pts((i) => Math.sin(i / 7) * 3 + 6), 'you']]) {
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); svg.appendChild(p);
  }

  const playDot = (who, label, onclick) => h('button', { type: 'button', class: 'tv-play ' + who, title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); onclick(); } }, icon('play'));

  const col = (d) => {
    const wpx = Math.max(26, (d.b - d.a) * TEXT_PPS - 4);
    const big = wordsTop ? d.w : tvPlain(d.p);
    const small = wordsTop ? d.p : d.w;
    const bigNode = wordsTop ? d.w : tvPhones(d.p);
    const smallNode = wordsTop ? tvPhones(d.p) : d.w;
    const spkPlay = d.you ? playDot('spk', 'Hear the speaker say “' + d.w + '”', () => { Player.seek(clip.start + d.a); Player.play(); }) : null;
    const youRow = d.you
      ? h('div', { class: 'tv-r you diff', style: { height: TEXT_ROWS[2] + 'px' } },
        h('span', { class: 'tv-chip ph', style: { fontSize: tvFit(d.you, wpx - 36, 1.0, 0.72) } }, tvPhones(d.you)),
        playDot('you', 'Hear your take of “' + d.w + '”', () => {}))
      : h('div', { class: 'tv-r you same', style: { height: TEXT_ROWS[2] + 'px' } }, h('span', { class: 'tv-ok', title: 'Same as the speaker' }, '·'));
    return h('div', { class: 'tv-word' + (d.you ? ' diff' : ''), style: { left: d.a * TEXT_PPS + 'px', width: (d.b - d.a) * TEXT_PPS - 3 + 'px' }, onclick: () => Player.seek(clip.start + d.a), title: d.w },
      h('div', { class: 'tv-r big ' + (wordsTop ? 'wd' : 'ph'), style: { height: TEXT_ROWS[0] + 'px', fontSize: tvFit(big, wpx - (!wordsTop && spkPlay ? 26 : 0), 1.5, 0.78) } }, h('span', { class: 'tv-t' }, bigNode), wordsTop ? null : spkPlay),
      h('div', { class: 'tv-r small ' + (wordsTop ? 'ph' : 'wd'), style: { height: TEXT_ROWS[1] + 'px', fontSize: tvFit(small, wpx - (spkPlay ? 26 : 0), 0.95, 0.7) } },
        h('span', { class: 'tv-t' }, smallNode), wordsTop ? spkPlay : null),
      youRow);
  };

  const cols = h('div', { class: 'tv-cols' }, DEMO_TEXT.map(col));
  const track = h('div', { class: 'tv-track', style: { width: trackW + 'px' } }, svg, cols);
  const view = h('div', { class: 'tv-view' }, track, h('div', { class: 'tv-head', style: { left: TEXT_HEAD * 100 + '%' } }));
  const lab = (txt, cls, i) => h('div', { class: 'tv-lab ' + cls, style: { top: 92 + rowTop[i] + 'px', height: TEXT_ROWS[i] + 'px' } }, txt);
  const gutter = h('div', { class: 'tv-gutter' },
    lab(wordsTop ? 'Words' : 'Speaker', wordsTop ? 'wd' : 'spk', 0),
    lab(wordsTop ? 'Speaker' : 'Words', wordsTop ? 'spk' : 'wd', 1),
    lab('You', 'you', 2),
    h('div', { class: 'tv-lab pitch', style: { top: '8px', height: '20px' } }, 'Pitch'));
  const box = h('div', { class: 'tv-box' }, gutter, view);
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
      h('span', { class: 'tv-key diff' }), diffs + ' differences from the speaker in take 3',
      h('span', null, 'Underlined symbols are where you differ'),
      h('span', { class: 'spacer' }),
      'Word width = how long it was said · Drag to scrub')];
}

Panel.drawText = function (now) {
  const { track, box, dur } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!track || !clip) return;
  const x = clamp(now - clip.start, 0, dur) * TEXT_PPS;
  track.style.transform = `translateX(${box.clientWidth * TEXT_HEAD - x}px)`;
};
