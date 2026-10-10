/* ---------- boot, global rendering, keyboard ---------- */
function renderAll() {
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
  else if (k === 'Escape') { if (UI.drawer) closeDrawer(); else if (UI.sel && !Session.active) { UI.sel = null; renderAll(); } }
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
