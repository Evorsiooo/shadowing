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
  sess.hidden = mode === 'cut';
  panel.hidden = mode === 'idle';
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
  const vh = Math.max(avail * 0.5, avail - BELOW_ALLOWANCE - gapY - 6);
  const totalW = L.clientWidth - padX - gapX;
  const sideW = clamp(Math.round(totalW - vh * ar - 6), 360, Math.max(360, Math.min(600, totalW * 0.36)));
  L.style.setProperty('--side-w', `${sideW}px`);
  L.style.setProperty('--video-h', `${Math.floor(vh)}px`);
  const playerH = $('#player').offsetHeight;
  L.style.setProperty('--below-h', `${Math.max(BELOW_ALLOWANCE, Math.floor(avail - playerH - gapY))}px`);
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
  else if (k === 'l' || k === 'L') { UI.loop = !UI.loop; renderControls(); toast(UI.loop ? t('Loop on') : t('Loop off')); }
  else if (k === 'ArrowLeft') { e.preventDefault(); Player.seek(Player.time() - 2); }
  else if (k === 'ArrowRight') { e.preventDefault(); Player.seek(Player.time() + 2); }
  else if (k === 'Enter' && Session.active && (Session.phase === 'intro' || Session.phase === 'armed')) Session.go();
  else if (k === 'c' || k === 'C') { if (Player.current() && !Session.active) setCutMode(!UI.cutMode); }
  else if ((k === 'n' || k === 'N' || k === 'p' || k === 'P') && Player.current() && !Session.active) stepClip(k === 'n' || k === 'N' ? 1 : -1);
  else if (k === 'Escape') { if (UI.drawer) closeDrawer(); else if ((UI.sel || UI.cutMode) && !Session.active) cancelCut(); else zoomOut(); }
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
  if (window.ResizeObserver) { const ro = new window.ResizeObserver(scheduleFit); ro.observe($('#banners')); }
  window.addEventListener('beforeunload', () => { Store.flushAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushAll(); });
  refreshAdminBadge();
  // first launch: the setup wizard (profile, files, first video, AI, baseline); see 90-onboarding.js
  if (needsOnboarding()) openOnboarding();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
