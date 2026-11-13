// Shared pieces of the layout check: a static server for dist/, a fake backend (so the app opens signed in with sample data),
// and a browser that shows classic scrollbars the way Windows does. See docs/LAYOUT.md.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };

export let ORIGIN = '';
const FX = join(root, 'scripts', 'layout', 'fixtures');
export function serveDist() {
  const dist = join(root, 'dist');
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/__fx/')) { // test videos, with Range support so the player can seek
      const f = join(FX, p.slice(6));
      if (!f.startsWith(FX) || !existsSync(f)) { res.writeHead(404).end(); return; }
      const buf = readFileSync(f), m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      const type = { 'content-type': 'video/webm', 'accept-ranges': 'bytes' };
      if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1; res.writeHead(206, { ...type, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': b - a + 1 }).end(buf.subarray(a, b + 1)); }
      else res.writeHead(200, { ...type, 'content-length': buf.length }).end(buf);
      return;
    }
    let f = join(dist, p);
    if (!f.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => { ORIGIN = `http://127.0.0.1:${server.address().port}`; ok({ server, url: ORIGIN }); }));
}

/* Playwright hides scrollbars in headless Chromium by default (--hide-scrollbars), which is exactly why scrollbar bugs
   slipped through: a Mac (overlay scrollbars) or a headless test never shows them, Windows always does. */
export function launch() {
  return chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar,OverlayScrollbars', '--disable-smooth-scrolling'] });
}

export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 780, mobile: true },
  { name: 'narrow window', width: 390, height: 780 }, // a desktop browser squeezed narrow: unlike a phone, it shows classic scrollbars
  { name: 'small phone', width: 320, height: 640, mobile: true },
  { name: 'tablet', width: 820, height: 1100, mobile: true },
  { name: 'laptop', width: 1366, height: 680 },
  { name: 'laptop at 150%', width: 911, height: 512 }, // a 1366x768 Windows laptop set to 150% scaling
  { name: 'laptop at 200%', width: 683, height: 340 },
  { name: 'desktop', width: 1920, height: 960 },
  { name: '1080p browser window', width: 1903, height: 950 },
  { name: '1080p at 125%', width: 1523, height: 760 },
  { name: 'wide and short', width: 1916, height: 634 }, // Adrien's window
  // session screens only: the sizes that matter most for a session
  { name: 'Adrien 1895x935', width: 1895, height: 935, sessionOnly: true },
  { name: '1080p full', width: 1920, height: 1080, sessionOnly: true },
  { name: 'laptop 1536x730', width: 1536, height: 730, sessionOnly: true },
  { name: 'laptop 1366x768', width: 1366, height: 768, sessionOnly: true },
  { name: 'small laptop 1280x720', width: 1280, height: 720, sessionOnly: true },
];

/* a speech-like pitch and loudness line (10 ms steps): a burst for every word, gaps between them, a rise and fall inside each */
export function speechLine(words, dur, { shift = 0, wobble = 0, seed = 1 } = {}) {
  const hop = 0.01, n = Math.round(dur / hop), st = [], db = [];
  let r = seed * 9301;
  const rnd = () => (r = (r * 49297 + 233280) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const t = i * hop - shift, w = words.find((x) => t >= x.s && t < x.e);
    if (!w) { st.push(null); db.push(-62 + Math.round(rnd() * 3)); continue; }
    const k = (t - w.s) / (w.e - w.s), wi = words.indexOf(w);
    st.push(Math.round((Math.sin(wi * 1.7) * 3.2 + Math.sin(k * Math.PI) * 2.2 - k * 1.2 + (rnd() - 0.5) * wobble) * 10) / 10);
    db.push(Math.round(-24 - 8 * Math.abs(Math.sin(k * Math.PI * 2 + wi)) + (rnd() - 0.5) * 2));
  }
  return { hop, st, db };
}
const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
const dayKey = (n) => day(n).slice(0, 10);
function modelFor(words, dur, id) {
  const l = speechLine(words.filter((w) => w.e <= dur), dur, { seed: id.length + id.charCodeAt(1) });
  return { hop: l.hop, st: l.st, db: l.db, refHz: 118, onset: 0.2, reliability: 0.92, measures: { pauses: 2, rate: 4.1, range: 6.5 } };
}
export function sampleData(empty = false) {
  const d = { videos: {}, clips: {}, sessions: {}, recordings: {}, notes: {}, issues: {}, checkins: {}, meta: {}, media: {} };
  if (empty) return d;
  d.videos.v1 = { id: 'v1', title: 'A very long video title that goes on and on to see how the layout copes with it', url: `${ORIGIN}/__fx/wide.webm`, speaker: 'Someone with a Long Name', archived: false, added: day(20) };
  d.videos.v2 = { id: 'v2', title: 'Short', url: `${ORIGIN}/__fx/tall.webm`, speaker: null, archived: false, added: day(5) };
  const words = 'I think we should probably go back to the beginning and start again from there'.split(' ').map((w, i) => ({ w, s: i * 0.3, e: i * 0.3 + 0.28 }));
  d.clips.c1 = { id: 'c1', videoId: 'v1', start: 3, end: 9.5, label: 'Opening line', sentence: words.map((w) => w.w).join(' '), done: true, doneAt: day(3), archived: false, noisy: false, created: day(19), words, model: modelFor(words, 6.5, 'c1') };
  d.clips.c2 = { id: 'c2', videoId: 'v1', start: 12, end: 17, label: 'A clip label that is long enough to need cutting off somewhere sensible', done: false, archived: false, noisy: false, created: day(10), words, model: modelFor(words, 5, 'c2') };
  d.clips.c3 = { id: 'c3', videoId: 'v2', start: 1, end: 4, label: '', done: false, archived: false, noisy: false, created: day(4), words: words.slice(0, 8), sentence: words.slice(0, 8).map((w) => w.w).join(' '), model: modelFor(words.slice(0, 8), 3, 'c3') };
  for (let i = 0; i < 9; i++) d.sessions['s' + i] = { id: 's' + i, date: dayKey(i * 2 + 1), startedAt: day(i * 2 + 1), clipId: 'c1', videoId: 'v1', mode: 'full', stepsCompleted: [1, 2, 3], stepsSkipped: [], passes: [{ step: 3, n: 1, lag: 0.4 - i * 0.03, recorded: false }], minutes: 14, complete: true, recs: {} };
  d.issues.i1 = { id: 'i1', name: 'Swallowing the final consonant in long sentences', noteIds: ['n1'], status: 'open', lastSeen: day(2) };
  d.notes.n1 = { id: 'n1', clipId: 'c1', sessionId: 's0', sentence: 'start again from there', off: 'The r in “there” disappears and the vowel is too short', aim: 'Keep the r', reply: 'That’s a common one. '.repeat(12), issueId: 'i1', date: day(2) };
  d.meta.settings = { id: 'settings', profile: { name: 'Test', nativeLanguages: 'French', targetLanguage: 'en', accent: '', onboarded: day(30) } };
  return d;
}

export async function newPage(browser, vp, { empty = false, theme = 'light' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1,
    colorScheme: theme, locale: 'en-AU', permissions: [],
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ json: {} })); // routes added later win, so the catch-all goes first
  await ctx.route('**/api/health', (r) => r.fulfill({ json: { ok: true, email: 'test@example.com', name: 'Test Person', role: 'user', ai: { provider: 'anthropic', providerName: 'Anthropic', model: 'x' }, drive: { connected: false }, driveAvailable: true, db: true } }));
  await ctx.route('**/api/docs', (r) => r.fulfill({ json: { data: sampleData(empty) } }));
  await ctx.route('**/api/docs/**', (r) => r.fulfill({ json: { ok: true } }));
  await ctx.route('https://example.invalid/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}

/* Runs inside the page. Returns what is wrong with the layout right now.
   - the page itself scrolls sideways
   - anything draws a scrollbar that isn't on the list of places meant to scroll (ALLOW)
   - a text field, button, link or label that is scrollable at all (never allowed, even if its bar is hidden)
   - an element sticks out past the right edge of the screen without a scroller or a clip around it */
export function measure(allow) {
  const out = [];
  const de = document.documentElement;
  const sel = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''));
      if (e.id) break;
    }
    return parts.join(' > ');
  };
  if (de.scrollWidth > de.clientWidth + 1) out.push({ kind: 'page-scrolls-sideways', detail: `content ${de.scrollWidth}px wide in a ${de.clientWidth}px window` });
  // the page scrolls by only a few pixels: nobody wants a scrollbar for that
  const over = de.scrollHeight - de.clientHeight;
  if (over > 0 && over <= 48 && de.clientHeight >= 500) out.push({ kind: 'page-scrolls-a-little', detail: `the page is only ${over}px taller than the window` });
  // cards in a grid: a short card next to a tall one must not leave a hole under it (the next row starts far below its bottom)
  for (const g of document.body.querySelectorAll('*')) {
    const gs = getComputedStyle(g);
    if (gs.display !== 'grid' || g.children.length < 2) continue;
    const gap = parseFloat(gs.rowGap) || 0;
    const kids = [...g.children].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(c).position !== 'absolute'; });
    const isCard = (c) => { const bg = getComputedStyle(c).backgroundColor; const r = c.getBoundingClientRect(); return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && r.height >= 80 && r.width >= 200; };
    for (const a of kids.filter(isCard)) { // only big filled cards: a label beside a field in a form grid is meant to sit at its row's edge
      const ra = a.getBoundingClientRect();
      const below = kids.map((b) => b.getBoundingClientRect()).filter((rb) => rb.top >= ra.bottom - 1 && rb.left < ra.right - 2 && rb.right > ra.left + 2);
      if (!below.length) continue;
      const hole = Math.min(...below.map((rb) => rb.top)) - ra.bottom;
      if (hole > gap + 24) { out.push({ kind: 'gap-in-grid', el: sel(a), detail: `${Math.round(hole)}px of empty space under it (the grid's own gap is ${Math.round(gap)}px)` }); break; }
    }
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const FIELDS = 'textarea, input, select, button, a, label, .btn, h1, h2, h3, h4, p, li, span';
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const bw = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    const bh = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    if (!el.clientWidth || !el.clientHeight) continue; // inline text has no box of its own to scroll
    const vBar = Math.round(el.offsetWidth - el.clientWidth - bw) > 2; // a classic scrollbar takes room from the box
    const hBar = Math.round(el.offsetHeight - el.clientHeight - bh) > 2;
    const scrollsY = ['auto', 'scroll'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const scrollsX = ['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (el.matches(FIELDS) && (vBar || hBar)) {
      // text fields, buttons and links may never show a scrollbar (a long text may still scroll inside a field whose bar is hidden)
      out.push({ kind: 'scrollable-control', el: sel(el), detail: `${vBar ? 'vertical bar ' : ''}${hBar ? 'horizontal bar ' : ''}${scrollsY ? 'scrolls vertically (' + el.scrollHeight + ' in ' + el.clientHeight + ')' : ''}${scrollsX ? ' scrolls sideways' : ''}`.trim() });
      continue;
    }
    if ((vBar || hBar) && el !== de && el !== document.body && !allow.some((a) => el.matches(a))) out.push({ kind: 'unexpected-scrollbar', el: sel(el), detail: `${vBar ? 'vertical ' : ''}${hBar ? 'horizontal' : ''} bar` });
  }
  // sticking out past the right edge, unless an ancestor scrolls or clips it
  const W = de.clientWidth;
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= W + 1 || r.width === 0) continue;
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') break;
      if (cs.overflowX !== 'visible') { clipped = true; break; }
    }
    if (clipped) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && el.matches('.askp-wrap, .toasts')) continue;
    out.push({ kind: 'sticks-out-right', el: sel(el), detail: `right edge at ${Math.round(r.right)}px in a ${W}px window` });
    break; // the first is enough; the rest are its children
  }
  return out;
}
