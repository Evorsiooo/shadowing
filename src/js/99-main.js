/* ---------- boot, global rendering, keyboard ---------- */
/* what shows where depends on what you're doing:
   browsing -> today's card under the player; cutting -> the clip editor there;
   in a session -> session card in the right column, pitch/waveform under the player */
const wideLayout = window.matchMedia ? matchMedia('(min-width: 901px)') : { matches: true };
function applyLayout() {
  const mode = Session.active ? 'session' : UI.cutMode || UI.sel ? 'cut' : 'idle';
  const layout = $('.layout'), sess = $('#session'), panel = $('#panel');
  layout.classList.toggle('in-session', mode === 'session');
  layout.classList.toggle('cutting', mode === 'cut');
  if (mode === 'session' && wideLayout.matches) { if (sess.parentElement !== $('#sideSlot')) $('#sideSlot').appendChild(sess); }
  else if (sess.parentElement !== $('#below')) $('#below').insertBefore(sess, panel);
  if (mode !== 'cut' && panel.parentElement !== $('#below')) { $('#below').appendChild(panel); layout.classList.remove('panel-side'); }
  sess.hidden = mode === 'cut';
  panel.hidden = mode === 'idle';
  if (UI.layoutMode !== mode) { UI.layoutMode = mode; requestAnimationFrame(() => Panel.onTime(Player.time())); }
  scheduleFit();
}

/* Size the player from the video's own shape: as tall as the screen allows once the row
   underneath has its space, and exactly as wide as that height needs (no black side bars).
   The right column gets the remaining width; in a session the session card matches the player's height. */
let fitQueued = false;
function scheduleFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitLayout(); fitLayout(); });
}
function fitLayout() {
  const L = $('.layout');
  const sess = $('#session'), below = $('#below');
  if (!wideLayout.matches) {
    L.classList.remove('fit', 'panel-side', 'no-below');
    if ($('#panel').parentElement !== below) below.appendChild($('#panel'));
    ['--stage-w', '--video-h', '--side-h', '--below-h'].forEach((v) => L.style.removeProperty(v));
    below.classList.remove('capped');
    sess.style.height = '';
    return;
  }
  L.classList.add('fit');
  const v = Player.v;
  const ar = v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
  L.style.setProperty('--video-ar', String(ar));
  const css = getComputedStyle(L);
  const padT = parseFloat(css.paddingTop), padB = parseFloat(css.paddingBottom), padX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
  const gapY = parseFloat(css.rowGap) || 14, gapX = parseFloat(css.columnGap) || 16;
  const top = L.getBoundingClientRect().top;
  const avail = Math.max(320, window.innerHeight - top - padT - padB);
  // natural height of the row underneath (chart at its usual size)
  L.style.setProperty('--below-h', 'auto');
  // the clip editor needs room: on a short screen it moves into the right column instead (the library hides)
  const panel = $('#panel'), inSide = panel.parentElement === $('#sideSlot');
  if ((UI.sel || UI.cutMode) && !Session.active && !fitLayout.moving) {
    const arMin = ar >= 1 ? Math.min(L.clientWidth - padX - gapX - 340, 700) / ar : 200;
    const need = arMin + $('#controls').offsetHeight + 6 + gapY + panel.scrollHeight;
    const wantSide = need > avail + (inSide ? 60 : 0);
    if (wantSide !== inSide) {
      if (wantSide) $('#sideSlot').appendChild(panel); else below.appendChild(panel);
      L.classList.toggle('panel-side', wantSide);
      fitLayout.moving = true;
      try { fitLayout(); } finally { fitLayout.moving = false; }
      return;
    }
  }
  const belowVisible = [...below.children].some((c) => !c.hidden);
  L.classList.toggle('no-below', !belowVisible); // an empty row would still take space
  const belowH = belowVisible ? below.scrollHeight + gapY : 0;
  const ctrlH = $('#controls').offsetHeight + 6; // player border
  const sideMin = 340;
  const totalW = L.clientWidth - padX - gapX;
  let vh = Math.max(200, avail - belowH - ctrlH);
  let w = vh * ar;
  if (w > totalW - sideMin) { w = totalW - sideMin; vh = w / ar; }
  // never squeeze the player into a sliver: narrow, the controls wrap and the row underneath
  // grows, which would shrink the video further. The chart gives up some height instead.
  const minW = Math.min(totalW - sideMin, Session.active ? 560 : 700); // in a session the controls are shorter
  if (w < minW && ar >= 1) { w = minW; vh = w / ar; }
  L.style.setProperty('--stage-w', `${Math.floor(w)}px`);
  L.style.setProperty('--video-h', `${Math.floor(vh)}px`);
  // library: full height of the right column; the row underneath fills what's left to the bottom
  L.style.setProperty('--side-h', `${Math.floor(avail)}px`);
  const room = Math.max(60, Math.floor(avail - $('#player').offsetHeight - gapY));
  L.style.setProperty('--below-h', belowVisible ? `${room}px` : 'auto');
  below.classList.toggle('capped', belowVisible && below.scrollHeight > below.clientHeight + 1);
  // session card: same height as the player
  sess.style.height = Session.active && sess.parentElement === $('#sideSlot') ? `${$('#player').offsetHeight}px` : '';
  Panel.onTime(Player.time()); // the chart may have changed size
}

function renderAll() {
  applyLayout();
  renderChips();
  renderBanners();
  renderControls();
  renderScrubber();
  renderSession();
  renderPanel();
  renderSidebar();
  $('#playerEmpty').hidden = !!Player.current();
  if (!Player.current()) renderPlayerEmpty();
}

function onKey(e) {
  const tag = (e.target && e.target.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isModalOpen()) { if (e.key === 'Escape') closeModal(); return; }
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') {
    if (tag === 'BUTTON') return; // let the focused button act
    e.preventDefault(); Player.toggle();
  } else if (k === 'r' || k === 'R') Player.replayLoop();
  else if (k === 'i' || k === 'I' || k === '[') markEdge('start');
  else if (k === 'o' || k === 'O' || k === ']') markEdge('end');
  else if (k === ',' || k === '<') Player.stepRate(-1);
  else if (k === '.' || k === '>') Player.stepRate(1);
  else if (k === 'l' || k === 'L') { UI.loop = !UI.loop; renderControls(); toast(UI.loop ? 'Loop on' : 'Loop off'); }
  else if (k === 'ArrowLeft') { e.preventDefault(); Player.seek(Player.time() - 2); }
  else if (k === 'ArrowRight') { e.preventDefault(); Player.seek(Player.time() + 2); }
  else if (k === 'Enter' && Session.active && (Session.phase === 'intro' || Session.phase === 'armed')) Session.go();
  else if (k === 'c' || k === 'C') { if (Player.current() && !Session.active) setCutMode(!UI.cutMode); }
  else if (k === 'Escape') { if (UI.drawer) closeDrawer(); else if (UI.sel && !Session.active) { UI.sel = null; renderAll(); } else if (UI.cutMode) setCutMode(false); }
  else if (k === '?') openShortcuts();
}

async function boot() {
  Player.init();
  renderControls();
  mount($('#panel'), h('div', { class: 'panel-msg' }, 'Loading your practice data…'));
  await Store.init();
  if (Store.mode === 'offline') {
    mount($('#panel'), h('div', { class: 'panel-msg' }, 'Not connected.'));
    openModal([
      modalHead(Api.signedOut ? 'Please sign in again' : 'The server isn’t ready'),
      h('p', null, Api.signedOut ? 'Your sign-in has expired. Reload the page to sign in with your email code.' : `The app’s server answered with a problem: ${Api.problem}`),
      btn('Reload', () => location.reload(), { kind: 'primary', size: 'big' }),
    ], { narrow: true });
    return;
  }
  appMeta();
  applyTheme();
  UI.view = settings().defaultView || 'pitch';
  if (UI.videoId && !Store.get('videos', UI.videoId)) UI.videoId = null;
  if (!UI.videoId) {
    const first = Store.all('videos').filter((v) => !v.archived).sort((a, b) => (a.added < b.added ? 1 : -1))[0];
    UI.videoId = first ? first.id : null;
  }
  Player.load(UI.videoId);
  const last = lastClipId();
  if (last && Store.get('clips', last) && Store.get('clips', last).videoId === UI.videoId) { UI.clipId = last; renderAll(); }
  document.addEventListener('keydown', onKey);
  $('#drawerBack').addEventListener('click', closeDrawer);
  Bus.on('videoaudio', () => { Panel.editor = null; renderPanel(); });
  Bus.on('signedout', () => renderBanners());
  window.addEventListener('resize', () => Panel.onTime(Player.time()));
  if (wideLayout.addEventListener) wideLayout.addEventListener('change', () => applyLayout());
  window.addEventListener('resize', scheduleFit);
  Player.v.addEventListener('loadedmetadata', scheduleFit);
  // the row under the player and the banners change height as you work: refit when they do
  if (window.ResizeObserver) { const ro = new window.ResizeObserver(scheduleFit); ro.observe($('#below')); ro.observe($('#banners')); ro.observe($('#controls')); }
  window.addEventListener('beforeunload', () => { Store.flushAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushAll(); });
  // first launch: the baseline must come before the first practice
  const base = checkinFor(0);
  if (!checkinHasAll(base) && !Store.all('sessions').some((s) => !s.empty) && !lsGet('dismissed', {}).baseline && !lsGet('welcomed', false)) {
    lsSet('welcomed', true);
    openModal([
      modalHead('G’day, Adrien'),
      h('p', null, 'Before your first shadowing session, record your week 0 baseline: six sentences read aloud, a 60-second retelling and a 60-second answer to a question you haven’t seen. It takes about 3 minutes, and every later check-in is compared with it.'),
      h('div', { class: 'row' }, btn('Record my baseline', () => openCheckins(0), { kind: 'primary', size: 'big', icon: 'mic' }), btn('Later', () => closeModal(), { kind: 'ghost' })),
    ], { narrow: true });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
