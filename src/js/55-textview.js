/* ---------- PROTOTYPE (design mockup, demo data, not for merge) ----------
   "Text" view in the analysis panel: the clip's words scroll past a fixed playhead, the speaker's phones sit under
   (or over) each word, and a word where your take differs shows what you said right there with a hear button.
   The words, phones and differences below are hard-coded demo data for the screenshots. */
const DEMO_TEXT = [
  { w: 'I', p: 'aɪ' },
  { w: 'thought', p: 'θɔt' },
  { w: 'about', p: 'əbaʊt' },
  { w: 'three', p: 'θɹiː', you: 'sɹiː', swap: 'θ → s' },
  { w: 'things', p: 'θɪŋz' },
  { w: 'that', p: 'ðæt' },
  { w: 'would', p: 'wʊd', you: 'wəd', swap: 'ʊ → ə' },
  { w: 'have', p: 'həv' },
  { w: 'been', p: 'bɪn' },
];
const TEXT_PPS = 240; // pixels per second of clip
const TEXT_HEAD = 0.3; // playhead sits 30% from the left of the strip

function textWordTimes(dur) {
  const total = DEMO_TEXT.reduce((n, d) => n + d.w.length + 1, 0);
  let acc = 0;
  return DEMO_TEXT.map((d) => {
    const a = dur * 0.04 + (acc / total) * dur * 0.9;
    acc += d.w.length + 1;
    return { ...d, a, b: dur * 0.04 + (acc / total) * dur * 0.9 };
  });
}

function buildTextView(clip) {
  const dur = clip.end - clip.start;
  const words = textWordTimes(dur);
  const wordsTop = UI.textTop !== 'phones';
  const trackW = Math.ceil(dur * TEXT_PPS);
  const m = clip.model;

  // pitch lines behind the words (speaker green; your demo take in blue)
  const pts = (shift) => {
    let d = '', pen = false;
    for (let i = 0; i < m.st.length; i++) {
      const v = m.st[i], ct = i * m.hop;
      if (v == null || Math.abs(v) > 12) { pen = false; continue; }
      const y = 40 - (v / 12) * 33 + shift(i);
      d += (pen ? 'L' : 'M') + (ct * TEXT_PPS).toFixed(1) + ' ' + y.toFixed(1);
      pen = true;
    }
    return d;
  };
  const svg = (d1, d2) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', 'tv-pitch'); s.setAttribute('width', trackW); s.setAttribute('height', 80);
    for (const [d, cls] of [[d1, 'sp'], [d2, 'you']]) {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); s.appendChild(p);
    }
    return s;
  };

  const col = (d) => {
    const hear = d.you ? h('div', { class: 'tv-fix' },
      h('div', { class: 'row tv-hear' },
        h('span', { class: 'tv-you', title: 'You said ' + d.you + ' (' + d.swap + ')' }, d.you),
        btn('', (e) => { e.stopPropagation(); Player.seek(clip.start + d.a); Player.play(); }, { icon: 'play', size: 'sm', title: 'Hear the speaker say “' + d.w + '”' }),
        btn('', (e) => e.stopPropagation(), { icon: 'play', size: 'sm', kind: 'blue', title: 'Hear your take of “' + d.w + '”' }))) : null;
    return h('div', { class: 'tv-word' + (d.you ? ' diff' : ''), style: { left: ((d.a + d.b) / 2) * TEXT_PPS + 'px' }, onclick: () => Player.seek(clip.start + d.a) },
      h('div', { class: 'tv-top' + (wordsTop ? '' : ' phones') }, wordsTop ? d.w : d.p),
      h('div', { class: 'tv-sub' + (wordsTop ? ' phones' : '') }, wordsTop ? d.p : d.w),
      hear);
  };

  const track = h('div', { class: 'tv-track', style: { width: trackW + 'px' } },
    svg(pts(() => 0), pts((i) => Math.sin(i / 7) * 3 + 6)),
    words.map(col));
  const box = h('div', { class: 'tv-box' }, track, h('div', { class: 'tv-head', style: { left: TEXT_HEAD * 100 + '%' } }));
  Panel.canvas = box;
  Panel.refs.track = track; Panel.refs.box = box; Panel.refs.dur = dur;

  // drag the text to scrub, like the scrub bar
  let down = null;
  box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; down = { x: e.clientX, t: Player.time() }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (down) Player.seek(clamp(down.t - (e.clientX - down.x) / TEXT_PPS, clip.start, clip.end - 0.05)); });
  box.addEventListener('pointerup', () => { down = null; });

  const diffs = words.filter((d) => d.you).length;
  return [box,
    h('div', { class: 'row tv-legend small muted' },
      h('span', { class: 'tv-key sp' }), 'Speaker', h('span', { class: 'tv-key you' }), 'You (take 3)',
      h('span', { class: 'tv-key diff' }), diffs + ' differences from the speaker',
      h('span', { class: 'spacer' }),
      'Drag the text to move through the clip')];
}

Panel.drawText = function (now) {
  const { track, box, dur } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!track || !clip) return;
  const x = clamp(now - clip.start, 0, dur) * TEXT_PPS;
  track.style.transform = `translateX(${box.clientWidth * TEXT_HEAD - x}px)`;
};
