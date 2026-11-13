// Visual checks that look at what is actually drawn, not only at scrollbars: text drawn over other text or over the mascot, text cut off,
// empty holes inside a column, the page scrolling when the screen is meant to fit, buttons below the bottom of the window,
// and the labels drawn on the pitch chart. They run on every session screen. See docs/LAYOUT.md.

/* installed before the page loads: remembers where the chart's labels are drawn */
export const CANVAS_SPY = () => {
  const ctx = CanvasRenderingContext2D.prototype, orig = ctx.fillText;
  window.__labels = [];
  ctx.fillText = function (text, x, y, ...r) {
    try {
      const w = this.measureText(String(text)).width, m = /(\d+(?:\.\d+)?)px/.exec(this.font), size = m ? +m[1] : 11;
      const left = this.textAlign === 'right' ? x - w : this.textAlign === 'center' ? x - w / 2 : x;
      const cv = this.canvas, cr = cv.getBoundingClientRect(), k = cr.width / cv.width || 1;
      if (cr.width < 50 || cr.height < 20) return orig.call(this, text, x, y, ...r); // a hidden canvas draws nothing anyone sees
      window.__labels.push({ text: String(text), l: left * k, r: (left + w) * k, t: (y - size) * k, b: (y + size * 0.25) * k, w: cv.width * k, h: cv.height * k, id: cv.className });
    } catch { /* ignore */ }
    return orig.call(this, text, x, y, ...r);
  };
  const clear = ctx.clearRect;
  ctx.clearRect = function (...a) { window.__labels = []; return clear.apply(this, a); };
};

/* runs inside the page. opts: { fits: the screen is meant to fit the window without scrolling, vp } */
export function visual(opts) {
  const out = [];
  const de = document.documentElement;
  const sel = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 3; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
      if (e.id) break;
    }
    return parts.join(' > ');
  };
  const shown = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || e.hidden || e.getAttribute('aria-hidden') === 'true') return false; } return true; };
  const drawn = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || e.hidden) return false; } return true; };
  const clipRect = (el) => { // the box that clips this element's drawing (an ancestor with overflow other than visible), or the window
    let r = { left: 0, top: 0, right: de.clientWidth, bottom: innerHeight };
    for (let p = el; p; p = p.parentElement) { // (the element itself clips its own text too)
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed' && p !== el) break;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const b = p.getBoundingClientRect(); r = { left: Math.max(r.left, b.left), top: Math.max(r.top, b.top), right: Math.min(r.right, b.right), bottom: Math.min(r.bottom, b.bottom) }; }
    }
    return r;
  };
  // 1. text over text, and text over the mascot
  const boxes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, canvas, .toasts, .askp-wrap, .sr-only, [data-visual-skip]') || !shown(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const c = clipRect(el);
    for (const r of range.getClientRects()) {
      if (r.width < 3 || r.height < 6) continue;
      const v = { l: Math.max(r.left, c.left), t: Math.max(r.top, c.top), r: Math.min(r.right, c.right), b: Math.min(r.bottom, c.bottom) };
      if (v.r - v.l < 3 || v.b - v.t < 6) continue; // not drawn (clipped away)
      boxes.push({ ...v, el, text: n.nodeValue.trim().slice(0, 24), node: n, full: r });
    }
  }
  const inset = (b) => ({ l: b.l + 1, r: b.r - 1, t: b.t + 3, b: b.b - 3 });
  const hit = (a, b) => { a = inset(a); b = inset(b); return Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2; };
  let reported = 0;
  for (let i = 0; i < boxes.length && reported < 4; i++) for (let j = i + 1; j < boxes.length && reported < 4; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.node === b.node || !hit(a, b)) continue;
    if (!!a.el.closest('.rev-go') !== !!b.el.closest('.rev-go') && getComputedStyle(a.el.closest('.rev-go') || b.el.closest('.rev-go')).position === 'sticky') continue; // a pinned bar with its own background sits over the page it scrolls on purpose
    out.push({ kind: 'text-overlaps-text', detail: `“${a.text}” (${sel(a.el)}) and “${b.text}” (${sel(b.el)})` }); reported++;
  }
  // 1b. something that is cut off by the box around it: a control or a line of text that runs past the edge of a card (or is hidden under its bottom edge)
  const clipper = (el) => {
    let x = { l: -1e9, r: 1e9 }, y = { t: -1e9, b: 1e9 }, who = null, scrolls = false; // (inside a list that scrolls, what is below the fold is reached by scrolling: not cut off)
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') break;
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') scrolls = true;
      const b = p.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { if (b.left > x.l) { x.l = b.left; who = who || p; } if (b.right < x.r) { x.r = b.right; who = who || p; } }
      if (!scrolls && (cs.overflowY === 'hidden' || cs.overflowY === 'clip')) { if (b.top > y.t) y.t = b.top; if (b.bottom < y.b) y.b = b.bottom; who = who || p; }
    }
    return { x, y, who };
  };
  const ellipsis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).textOverflow === 'ellipsis') return true; return false; };
  let cutCount = 0;
  const seen = new Set();
  const consider = (el, r, label, isText) => {
    if (cutCount >= 4 || seen.has(el) || r.width < 3 || el.closest('[data-visual-skip], .toasts, .askp-wrap, .sr-only')) return;
    if (isText && ellipsis(el)) r = el.getBoundingClientRect(); // a line that ends in "…" is cut on purpose inside its own box; the box itself must still fit its card
    const c = clipper(el);
    const over = Math.max(r.right - c.x.r, c.x.l - r.left, r.bottom - c.y.b, c.y.t - r.top);
    if (over > 2) { seen.add(el); cutCount++; out.push({ kind: 'cut-off-by-its-box', el: sel(el), detail: `${label} sticks out ${Math.round(over)}px past ${c.who ? sel(c.who) : 'its box'}` }); }
  };
  for (const b of boxes) consider(b.el, b.full, `“${b.text}”`, true);
  for (const el of document.body.querySelectorAll('button, input, select, textarea, a, .seg, .btn, .playbig')) if (drawn(el) && !el.hidden) consider(el, el.getBoundingClientRect(), (el.textContent || el.className || el.tagName).toString().trim().slice(0, 20));
  // 3b. empty stretches inside a card, measured on what is drawn in it (text, controls, pictures, boxes with a fill), not on box edges: a stretched
  // box can hide a hole. Anything more than GAP px tall between two drawn things is a hole.
  const GAP = 50;
  for (const col of document.querySelectorAll('.rev-card, .focus-card, .side .session, .listen-for, .preflight, #below, .done-page')) {
    if (!drawn(col) || col.hidden) continue;
    const cr = col.getBoundingClientRect();
    if (cr.height < 120) continue;
    const view = { t: Math.max(cr.top, 0), b: Math.min(cr.bottom, innerHeight) };
    const ink = [];
    const add = (t, b) => { t = Math.max(t, view.t); b = Math.min(b, view.b); if (b - t > 1) ink.push([t, b]); };
    for (const bx of boxes) if (col.contains(bx.el)) add(bx.t, bx.b);
    for (const el of col.querySelectorAll('*')) {
      if (!drawn(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.height > cr.height * 0.98) continue;
      const cs = getComputedStyle(el);
      const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      const bordered = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
      if (el.matches('button, input, select, textarea, img, svg, canvas, video, hr') || filled || bordered) { const c = clipper(el); add(Math.max(r.top, c.y.t), Math.min(r.bottom, c.y.b)); }
    }
    ink.sort((a, b) => a[0] - b[0]);
    if (ink.length && col.matches('.rev-card, .side .session')) { // a card that fills its column: its content starts at the top and ends at the bottom
      const cs = getComputedStyle(col), top = cr.top + (parseFloat(cs.paddingTop) || 0), bot = cr.bottom - (parseFloat(cs.paddingBottom) || 0);
      if (ink[0][0] - top > GAP) out.push({ kind: 'empty-stretch-in-card', el: sel(col), detail: `${Math.round(ink[0][0] - top)}px of nothing at the top` });
      if (bot - Math.max(...ink.map((x) => x[1])) > GAP && cr.bottom <= innerHeight) out.push({ kind: 'empty-stretch-in-card', el: sel(col), detail: `${Math.round(bot - Math.max(...ink.map((x) => x[1])))}px of nothing at the bottom` });
    }
    let bottom = ink.length ? ink[0][1] : 0;
    for (let i = 1; i < ink.length; i++) {
      if (ink[i][0] - bottom > GAP) { out.push({ kind: 'empty-stretch-in-card', el: sel(col), detail: `${Math.round(ink[i][0] - bottom)}px with nothing in it, at ${Math.round(bottom)}–${Math.round(ink[i][0])}px` }); break; }
      bottom = Math.max(bottom, ink[i][1]);
    }
  }
  for (const m of document.querySelectorAll('.euno')) {
    if (!drawn(m)) continue; // (the mascot is aria-hidden, but people still see it)
    const r = m.getBoundingClientRect(); if (r.width < 8) continue;
    const mb = { l: r.left + r.width * 0.1, r: r.right - r.width * 0.1, t: r.top + r.height * 0.1, b: r.bottom - r.height * 0.1 };
    for (const b of boxes) if (!m.contains(b.el) && hit(mb, b)) { out.push({ kind: 'text-under-mascot', detail: `“${b.text}” (${sel(b.el)})` }); break; }
    if (r.left < -1 || r.right > de.clientWidth + 1 || r.top < -1) out.push({ kind: 'mascot-off-screen', el: sel(m) });
  }
  // 2. text cut off without an ellipsis (a box that hides its overflow and does not say so)
  for (const el of document.body.querySelectorAll('*')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) || !shown(el)) continue;
    const cs = getComputedStyle(el);
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.closest('[data-visual-skip]'))
      out.push({ kind: 'text-cut-off', el: sel(el), detail: `${el.scrollWidth}px of text in ${el.clientWidth}px` });
  }
  // 3. empty holes: inside a column, one block should not sit far below the one above it
  const HOLE = 90;
  const stacks = [...document.querySelectorAll('.rev-card, .focus-card, .side .session, #below, .layout > .player + .below')];
  for (const col of stacks) {
    if (!shown(col)) continue;
    const kids = [...col.children].filter((k) => shown(k) && getComputedStyle(k).position !== 'absolute' && k.getBoundingClientRect().height > 4);
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
      if (b.top - a.bottom > HOLE) { out.push({ kind: 'empty-gap', el: sel(col), detail: `${Math.round(b.top - a.bottom)}px of nothing between “${(kids[i - 1].className || kids[i - 1].tagName)}” and “${(kids[i].className || kids[i].tagName)}”` }); break; }
    }
  }
  const pl = document.querySelector('#player'), pn = document.querySelector('#panel');
  if (pl && pn && shown(pl) && shown(pn) && !pn.hidden && opts.vp.width >= 901) { // (on a phone the card sits between them)
    const a = pl.getBoundingClientRect(), b = pn.getBoundingClientRect();
    if (b.top >= a.bottom - 1 && b.left < a.right && b.right > a.left && b.top - a.bottom > 40) out.push({ kind: 'gap-video-to-chart', detail: `${Math.round(b.top - a.bottom)}px between the video and the chart` });
  }
  // 4. a screen that is meant to fit must fit: no page scroll, the actions inside the window
  if (opts.fits) {
    const over = de.scrollHeight - innerHeight;
    if (over > 1) out.push({ kind: 'page-scrolls', detail: `the page is ${over}px taller than the ${innerHeight}px window; this screen is meant to fit` });
    for (const el of document.querySelectorAll('.rev-go button, .focus-ctl .btn, .focus-ctl .playbig')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight + 1 || r.top < 0) out.push({ kind: 'action-outside-window', el: sel(el), detail: `${(el.textContent || '').trim().slice(0, 18) || 'button'} is at ${Math.round(r.top)}–${Math.round(r.bottom)}px in a ${innerHeight}px window` });
    }
    const sc = document.querySelector('.rev-scroll');
    if (sc && sc.scrollHeight > sc.clientHeight + 1 && opts.vp.height >= 800) out.push({ kind: 'review-list-scrolls', detail: `${sc.scrollHeight}px of list in ${sc.clientHeight}px of card at a ${innerHeight}px tall window` });
  }
  // 5. the labels drawn on the chart: inside it, and not on top of each other
  const L = window.__labels || [];
  for (const a of L) if (a.l < -1 || a.r > a.w + 1 || a.t < -1 || a.b > a.h + 1) out.push({ kind: 'chart-label-cut-off', detail: `“${a.text}” at ${Math.round(a.l)}–${Math.round(a.r)} of ${Math.round(a.w)}px` });
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    if (a.id === b.id && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) out.push({ kind: 'chart-labels-overlap', detail: `“${a.text}” and “${b.text}”` });
  }
  return out;
}
