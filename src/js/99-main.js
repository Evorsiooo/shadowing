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
  layout.classList.toggle('reviewing', mode === 'session' && Session.phase === 'review');
  const focus = mode === 'session' && Session.phase !== 'review';
  layout.classList.toggle('focus', focus);
  if (mode === 'session' && !focus && wideLayout.matches) { if (sess.parentElement !== $('#sideSlot')) $('#sideSlot').appendChild(sess); }
  else if (sess.parentElement !== $('#below')) $('#below').insertBefore(sess, panel);
  sess.hidden = mode === 'cut';
  panel.hidden = mode === 'idle' || (focus && !Session.liveThisPass); // while you listen and shadow there is nothing to read
  if (UI.layoutMode !== mode) { UI.layoutMode = mode; requestAnimationFrame(() => Panel.onTime(Player.time())); }
  scheduleFit();
}

/* Sizes depend only on the window and the video's shape, never on what you're doing, so the
   page doesn't reshuffle when you press a button:
   - the video gets the window height minus a fixed allowance for the panel underneath;
   - the right column takes the width the video doesn't need (within limits);
   - the library or session card beside the player matches its height;
   - the full-width panel underneath fills down to the bottom of the window. */
const BELOW_ALLOWANCE = 250;
const fitFocus = { key: null, below: 0 };
const FOCUS_BELOW = 250; // the instruction, the controls and the passes under the video in a session
const MAX_WIDTH_LIMITED_H = 540;
let fitQueued = false;
function scheduleFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitLayout(); });
}
function fitLayout() {
  const L = $('.layout');
  if (!wideLayout.matches) {
    L.classList.remove('fit');
    ['--side-w', '--video-h', '--below-h', '--top-h'].forEach((v) => L.style.removeProperty(v));
    return;
  }
  L.classList.add('fit');
  const v = Player.v;
  const ar = v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
  L.style.setProperty('--video-ar', String(ar));
  const css = getComputedStyle(L);
  const padT = parseFloat(css.paddingTop), padB = parseFloat(css.paddingBottom), padX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
  const gapY = parseFloat(css.rowGap) || 14, gapX = parseFloat(css.columnGap) || 16;
  const top = L.getBoundingClientRect().top + window.scrollY;
  const avail = Math.max(360, window.innerHeight - top - padT - padB);
  const sh = $('#studioHead');
  const headH = sh && !sh.hidden ? sh.offsetHeight + gapY : 0;
  const availW = avail - headH;
  const totalW = L.clientWidth - padX - gapX;
  /* On short windows the panel allowance would squash the video, so there width is the limit instead:
     the video may be as tall as its width allows (right column at its widest), up to MAX_WIDTH_LIMITED_H,
     and the page scrolls to reach the panel. Tall windows keep the window-derived height. */
  if (L.classList.contains('focus')) {
    // focus mode: one centred column, the video as large as leaves room for the instruction under it
    // what sits under the video is measured (the list of things to listen for makes it taller), and only ever grows within a step, so the video doesn't resize from pass to pass and the page never needs a scrollbar
    const fc = $('.focus-card');
    const stepKey = `${Session.doc && Session.doc.id}:${Session.stepIdx}`;
    if (fitFocus.key !== stepKey) { fitFocus.key = stepKey; fitFocus.below = FOCUS_BELOW; }
    if (fc) fitFocus.below = Math.max(fitFocus.below, Math.ceil(fc.offsetHeight) + 12);
    const fvh = Math.max(240, Math.min((L.clientWidth - padX) / ar, avail - fitFocus.below - gapY));
    L.style.setProperty('--video-h', `${Math.floor(fvh)}px`);
    L.style.setProperty('--focus-w', `${Math.floor(fvh * ar)}px`);
    L.style.setProperty('--below-h', 'auto');
    return;
  }
  const sideMax = Math.max(360, Math.min(600, totalW * 0.36));
  const widthVh = (totalW - sideMax - 6) / ar;
  let vh = Math.max(availW * 0.5, availW - BELOW_ALLOWANCE - gapY - 6, Math.min(widthVh, MAX_WIDTH_LIMITED_H));
  if (L.classList.contains('reviewing')) vh = Math.min(vh, availW * 0.4); // the review is about the chart: the video steps back
  const sideW = clamp(Math.round(totalW - vh * ar - 6), 360, Math.max(360, Math.min(600, totalW * 0.36)));
  L.style.setProperty('--side-w', `${sideW}px`);
  L.style.setProperty('--video-h', `${Math.floor(vh)}px`);
  const playerH = $('#player').offsetHeight;
  L.style.setProperty('--below-h', `${Math.max(BELOW_ALLOWANCE, Math.floor(availW - playerH - gapY))}px`);
  L.style.setProperty('--top-h', `${playerH}px`); // library / session card: same height as the player
  Panel.onTime(Player.time()); // the chart may have changed size
}

/* labels written in index.html are set here, so they follow the interface language */
function renderStaticLabels() {
  $('#scrubber').setAttribute('aria-label', t('Video timeline'));
  $('#sidebar').setAttribute('aria-label', t('Video library'));
}

function renderAll() {
  renderStaticLabels();
  applyView();
  applyLayout();
  renderTopbar();
  renderFocusbar();
  renderBanners();
  renderToday();
  renderControls();
  renderScrubber();
  renderSession();
  renderPanel();
  renderSidebar();
  renderLibPage();
  renderCutCard();
  renderStudioHead();
  $('#playerEmpty').hidden = !!Player.current();
  if (!Player.current()) renderPlayerEmpty();
}

function onKey(e) {
  if (UI.askOpen) { if (e.key === 'Escape') closeAsk(); return; } // the panel takes the keys while it is open
  const tag = (e.target && e.target.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isModalOpen()) { if (e.key === 'Escape') closeModal(); return; }
  if (UI.menuOpen && e.key === 'Escape') { closeMenu(); return; }
  if (!Session.active && UI.tab !== 'library') return; // the player's keys only work where the player is
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') {
    if (tag === 'BUTTON') return; // let the focused button act
    e.preventDefault(); Player.toggle();
  } else if (k === 'r' || k === 'R') Player.replayLoop();
  else if (k === 'i' || k === 'I' || k === '[') markEdge('start');
  else if (k === 'o' || k === 'O' || k === ']') markEdge('end');
  else if (k === ',' || k === '<') Player.stepRate(-1);
  else if (k === '.' || k === '>') Player.stepRate(1);
  else if (k === 'l' || k === 'L') { UI.loop = !UI.loop; renderControls(); toast(UI.loop ? t('Loop on') : t('Loop off')); }
  else if (k === 'ArrowLeft') { e.preventDefault(); Player.seek(Player.time() - 2); }
  else if (k === 'ArrowRight') { e.preventDefault(); Player.seek(Player.time() + 2); }
  else if (k === 'Enter' && Session.active && (Session.phase === 'intro' || Session.phase === 'armed')) Session.go();
  else if (k === 'c' || k === 'C') { if (Player.current() && !Session.active) setCutMode(!UI.cutMode); }
  else if ((k === 'n' || k === 'N' || k === 'p' || k === 'P') && Player.current() && !Session.active) stepClip(k === 'n' || k === 'N' ? 1 : -1);
  else if (k === 'Escape') { if ((UI.sel || UI.cutMode) && !Session.active) cancelCut(); else zoomOut(); }
  else if (k === '?') openShortcuts();
}

function stepClip(dir) {
  const list = videoClips(UI.videoId);
  if (!list.length) return;
  const i = list.findIndex((c) => c.id === UI.clipId);
  const next = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : i + dir];
  if (next) selectClip(next.id); else toast(dir > 0 ? t('That is the last clip.') : t('That is the first clip.'));
}

async function boot() {
  renderStaticLabels();
  renderTopbar();
  applyView();
  Player.init();
  renderControls();
  mount($('#panel'), h('div', { class: 'panel-msg' }, t('Loading your practice data…')));
  await Store.init();
  syncUiLangSetting();
  if (Store.mode === 'offline') {
    // The page is served without checking the session (functions/app/_middleware.js), so an expired one
    // lands here: go straight back to sign-in, unless that just happened (then the message below explains).
    if (Api.signedOut) {
      let again = false;
      try {
        again = Date.now() - Number(sessionStorage.getItem('shadowing:signin-bounce') || 0) < 60000;
        sessionStorage.setItem('shadowing:signin-bounce', String(Date.now()));
      } catch { /* storage blocked */ }
      if (!again) { signIn(); return; }
    }
    mount($('#panel'), h('div', { class: 'panel-msg' }, t('Not connected.')));
    openModal([
      Euno.el('offline', Api.signedOut ? 'drowsy' : 'confused', { cls: 'modal-euno' }),
      modalHead(Api.signedOut ? t('Please sign in') : Api.unreachable ? t('You’re offline') : /disabled/i.test(Api.problem || '') ? t('Account disabled') : t('The server isn’t ready')),
      h('p', null, Api.signedOut ? t('Sign in with your Google account to open your practice.') : Api.unreachable ? t('Euno needs a connection to load your practice. Reconnect, then reload.') : t('The app’s server answered with a problem: {problem}', { problem: Api.problem })),
      Api.signedOut ? btn(t('Sign in with Google'), () => signIn(), { kind: 'primary', size: 'big' }) : btn(t('Reload'), () => location.reload(), { kind: 'primary', size: 'big' }),
    ], { narrow: true });
    return;
  }
  appMeta();
  applyTheme();
  initMedia(); // device storage and Google Drive sync (17-media.js)
  Push.register(); // service worker: reminder notifications, and lets the browser install the app (86-push.js)
  UI.view = settings().defaultView || 'pitch';
  if (UI.videoId && !Store.get('videos', UI.videoId)) UI.videoId = null;
  if (!UI.videoId) {
    const first = Store.all('videos').filter((v) => !v.archived).sort((a, b) => (a.added < b.added ? 1 : -1))[0];
    UI.videoId = first ? first.id : null;
  }
  Player.load(UI.videoId);
  const last = lastClipId();
  if (last && Store.get('clips', last) && Store.get('clips', last).videoId === UI.videoId) UI.clipId = last;
  const start = parseHash();
  if (location.hash === '#ask') { UI.tab = 'today'; history.replaceState(null, '', '#today'); renderAll(); openAsk(); }
  else if (start.tab && start.tab !== 'today') go(start.tab, start.sub); else { UI.tab = 'today'; history.replaceState(null, '', '#today'); renderAll(); }
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', () => { closeMenu(); if (UI.sessMenu) { UI.sessMenu = false; renderFocusbar(); } });
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('popstate', onHashChange);
  $('#drawerBack').addEventListener('click', closeDrawer);
  Bus.on('videoaudio', () => { Panel.editor = null; renderPanel(); });
  Bus.on('signedout', () => renderBanners());
  window.addEventListener('resize', () => Panel.onTime(Player.time()));
  if (wideLayout.addEventListener) wideLayout.addEventListener('change', () => applyLayout());
  window.addEventListener('resize', scheduleFit);
  Player.v.addEventListener('loadedmetadata', scheduleFit);
  // the row under the player and the banners change height as you work: refit when they do
  if (window.ResizeObserver) { const ro = new window.ResizeObserver(scheduleFit); ro.observe($('#banners')); }
  window.addEventListener('beforeunload', () => { Store.flushAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushAll(); });
  refreshAdminBadge();
  announceHeavyOff();
  // first launch: the setup wizard (profile, files, first video, AI, baseline); see 90-onboarding.js
  if (needsOnboarding()) openOnboarding();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
