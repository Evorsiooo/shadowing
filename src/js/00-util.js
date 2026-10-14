'use strict';
/* ---------- DOM helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'open', 'hidden', 'indeterminate']);

function h(tag, props, ...kids) {
  const el = tag === 'svg' || tag === 'path' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (PROPS.has(k)) el[k] = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  addKids(el, kids);
  return el;
}
function addKids(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) addKids(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}
function mount(el, ...kids) {
  el.replaceChildren();
  addKids(el, kids);
  return el;
}

/* ---------- icons (inline SVG, stroke-based) ---------- */
const ICONS = {
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  loop: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10"/><path d="M10 12.5h4"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flame: '<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.2 2.2-5.2 3.6-7 .4 1.8 1.4 3 2.6 3.4C11 7.6 12.4 4.8 15 3c-.3 2.6.8 4.4 2.2 6.1C18.3 10.5 19 12 19 14.4 19 18.2 16 21 12 21z" fill="currentColor" stroke="none"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8l12 10M8 16L20 6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>',
  skip: '<path d="M5 5l9 7-9 7z" fill="currentColor"/><path d="M18 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" stroke="none"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7 15h10"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  bad: '<path d="M12 3c3 4 6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 9 7 12 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  folder: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
};
function icon(name, extra = '') {
  const span = document.createElement('span');
  span.style.display = 'contents';
  const size = /width=/.test(extra) ? '' : 'width="18" height="18"';
  span.innerHTML = `<svg ${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;
  return span.firstChild;
}
function btn(label, onclick, opts = {}) {
  const cls = ['btn', opts.kind || '', opts.size || '', opts.on ? 'on' : '', !label ? 'icon' : ''].filter(Boolean).join(' ');
  return h('button', { type: 'button', class: cls, onclick, disabled: opts.disabled, title: opts.title || null, 'aria-label': opts.aria || (!label ? opts.title : null), 'aria-pressed': opts.pressed != null ? String(!!opts.pressed) : null, id: opts.id },
    opts.icon ? icon(opts.icon) : null, label ? h('span', { class: opts.txtClass || 'txt' }, label) : null);
}

/* ---------- formatting ---------- */
function fmtTime(s, dec = 0) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const sec = dec ? r.toFixed(dec).padStart(3 + dec, '0') : String(Math.floor(r)).padStart(2, '0');
  return `${m}:${sec}`;
}
/* "3:35.2", "1:02:03" or "215.2" -> seconds; null if unreadable */
function parseTime(raw) {
  const t = String(raw || '').trim().replace(',', '.');
  if (!t) return null;
  const parts = t.split(':');
  if (parts.some((p) => p === '' || isNaN(+p))) return null;
  return parts.reduce((acc, p) => acc * 60 + +p, 0);
}
/* a number with a fixed number of decimals, in the interface language (0,14 in French) */
function fmtNum(v, dec = 0) { try { return new Intl.NumberFormat(uiLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v); } catch { return (+v).toFixed(dec); } }
function fmtSec(s, dec = 1) { return `${fmtNum(+s, dec)} s`; }
function fmtLag(lag) {
  if (lag == null || !isFinite(lag)) return '—';
  const a = fmtNum(Math.abs(lag), 2);
  if (Math.abs(lag) < 0.03) return t('in sync');
  return lag > 0 ? t('{a} s behind', { a }) : t('{a} s ahead', { a });
}
function dayKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }
/* dates in the interface language (uiLocale() is in 01-i18n.js) */
function fmtDate(d, opts) { try { return new Intl.DateTimeFormat(uiLocale(), opts).format(d); } catch { return d.toDateString(); } }
function fmtDay(k) { if (!k) return '—'; return fmtDate(parseDay(k), { day: 'numeric', month: 'short' }); }
function fmtDayLong(k) { return fmtDate(parseDay(k), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
/* short weekday name, 0 = Sunday */
function dayName(i) { const d = new Date(2024, 0, 7 + i); return fmtDate(d, { weekday: 'short' }); }
function weekStart(k) { const d = parseDay(k); const wd = (d.getDay() + 6) % 7; return addDays(k, -wd); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function round(v, d = 2) { const p = 10 ** d; return Math.round(v * p) / p; }
function median(arr) {
  const a = arr.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function percentile(arr, p) {
  const a = arr.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  return a[clamp(Math.round((a.length - 1) * p), 0, a.length - 1)];
}
function mean(arr) { const a = arr.filter((v) => v != null && isFinite(v)); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; }
function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lsGet = (k, d) => { try { const v = localStorage.getItem('shadowing:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('shadowing:' + k, JSON.stringify(v)); } catch { /* storage blocked */ } };

/* ---------- toasts ---------- */
function toast(msg, kind = '', ms = 3800) {
  const el = h('div', { class: `toast ${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, msg);
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------- modal ---------- */
let modalCloseHook = null;
function openModal(content, { narrow = false, onClose = null } = {}) {
  closeModal(true);
  modalCloseHook = onClose;
  const back = h('div', { class: 'modal-back', onmousedown: (e) => { if (e.target === back) closeModal(); } },
    h('div', { class: `modal ${narrow ? 'narrow' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content));
  mount($('#modalRoot'), back);
  const f = back.querySelector('[autofocus]') || back.querySelector('button, input, textarea, select');
  if (f) setTimeout(() => f.focus(), 30);
}
function closeModal(silent) {
  const had = $('#modalRoot').firstChild;
  $('#modalRoot').replaceChildren();
  const hook = modalCloseHook;
  modalCloseHook = null;
  if (had && hook && !silent) hook();
}
function modalHead(title, sub) {
  return h('div', { class: 'modal-head' },
    h('div', { class: 'grow' }, h('h2', null, title), sub ? h('p', { class: 'muted small' }, sub) : null),
    btn('', () => closeModal(), { icon: 'close', kind: 'ghost', title: t('Close'), aria: t('Close') }));
}
function isModalOpen() { return !!$('#modalRoot').firstChild; }

/* ---------- confetti (small, skipped for reduced motion) ---------- */
function celebrate(intensity = 1) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  const W = (c.width = innerWidth * devicePixelRatio);
  const H = (c.height = innerHeight * devicePixelRatio);
  const css = getComputedStyle(document.documentElement);
  const cols = ['--green', '--wattle', '--sky', '--ochre', '--red'].map((v) => css.getPropertyValue(v).trim());
  const parts = Array.from({ length: Math.round(110 * intensity) }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 18 * devicePixelRatio,
    vy: (-Math.random() * 16 - 6) * devicePixelRatio, r: (4 + Math.random() * 6) * devicePixelRatio,
    c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4,
  }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.55 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); ctx.restore();
    }
    if (++t < 140) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })();
}

/* ---------- tiny CSV + zip writer (stored, no compression) ---------- */
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function makeZip(files) {
  // files: [{name, data: Uint8Array}]
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
