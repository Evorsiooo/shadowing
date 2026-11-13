/* ---------- where you are: Today, Library and Progress in the top bar; Settings, Admin and Ask Euno as pages ----------
   The address keeps the place (#today, #library, #progress/issues, #settings/data, #ask), so reloading or going back
   lands where you were. A session takes the whole screen (focus mode) and has no navigation at all. */
const TABS = ['today', 'library', 'progress'];
const PAGES = ['progress', 'settings', 'admin', 'done'];
UI.tab = 'today';
UI.libPage = true; // the Library tab opens on the list of videos and clips; a clip opens in the player

function parseHash() {
  const [tab, sub] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  return { tab: TABS.includes(tab) || PAGES.includes(tab) ? tab : null, sub: sub || null };
}
function setHash(tab, sub) {
  const want = `#${tab}${sub ? '/' + sub : ''}`;
  if (location.hash !== want) history.pushState(null, '', want);
}
/* go somewhere; pages draw themselves through openView() */
function go(tab, sub = null) {
  if (tab === 'ask') { openAsk(); return; } // a panel over the page, never a page of its own
  if (Session.active) { if (tab !== 'library' && tab !== 'today') toast(t('Finish or end the current session first.')); return; }
  closeMenu();
  if (tab === 'progress') { openProgress(sub || 'habit'); return; }
  if (tab === 'settings') { openSettings(sub || undefined); return; }
  if (tab === 'admin') { if (isAdmin()) openAdmin(); else go('today'); return; }
  if (tab === 'done') { if (UI.lastSummary) showSessionSummary(...UI.lastSummary); else go('today'); return; }
  if (tab === 'library') UI.libPage = sub !== 'clip' || !Player.current();
  showView(TABS.includes(tab) ? tab : 'today');
  setHash(UI.tab, UI.tab === 'library' && !UI.libPage ? 'clip' : null);
}
function showView(tab) {
  const changed = UI.tab !== tab;
  UI.tab = tab;
  if (changed) { window.scrollTo(0, 0); if (tab !== 'library' && !Player.v.paused) Player.pause(); }
  if (tab === 'library' && UI.libPage && !Player.v.paused && !Session.active) Player.pause();
  renderAll();
  const el = tab === 'today' ? $('#todayView') : PAGES.includes(tab) ? $('#pageView') : tab === 'library' && libPageShown() ? $('#libView') : null;
  if (changed && el) enterOnChange(el, Math.random(), 'view-in');
}
function onHashChange() {
  if (location.hash === '#ask') { openAsk(); return; }
  if (UI.askOpen) closeAsk();
  const { tab, sub } = parseHash();
  if (Session.active) { setHash('library'); return; }
  go(tab || 'today', sub);
}

/* a page under the top bar; during a session (or for a page that isn't one) it opens as a window instead */
function openView(content, { page = null, sub = null, narrow = false, onClose = null } = {}) {
  if (!page || Session.active) { openModal(content, { narrow, onClose }); return; }
  closeModal(true);
  closeMenu();
  const was = UI.tab;
  UI.tab = page;
  setHash(page, sub);
  const el = $('#pageView');
  el.dataset.page = page;
  mount(el, content);
  const title = el.querySelector('h2');
  if (title) title.id = 'pageTitle';
  if (was !== page) { window.scrollTo(0, 0); renderAll(); enterOnChange(el, Math.random(), 'view-in'); }
  else applyView();
}
/* only one of Today, the working screen and the page is shown */
function applyView() {
  const focus = Session.active;
  document.body.classList.toggle('focus', focus);
  const tab = focus ? 'library' : UI.tab;
  $('#todayView').hidden = tab !== 'today';
  $('#pageView').hidden = !PAGES.includes(tab);
  const lib = !focus && libPageShown();
  $('#libView').hidden = !lib;
  $('#work').hidden = tab !== 'library' || lib;
  $('#topbar').hidden = focus;
  $('#focusbar').hidden = !focus;
}

/* ---------- top bar ---------- */
function renderTopbar() {
  if (!$('#logo').firstChild) $('#logo').appendChild(eunoLogo('logo'));
  $('#brand').setAttribute('aria-label', t('Euno, Today'));
  const tabs = [['today', t('Today'), 'sun'], ['library', t('Library'), 'folder'], ['progress', t('Progress'), 'chart']];
  // on a phone the same three links sit in a bar along the bottom, with an icon each
  mount($('#tabnav'), tabs.map(([k, l, ic]) => h('a', { href: `#${k}`, class: UI.tab === k ? 'on' : null, 'aria-current': UI.tab === k ? 'page' : null }, icon(ic), h('span', null, l))));
  $('#tabnav').setAttribute('aria-label', t('Main'));
  const acct = $('#acct');
  const name = (profile().name || Api.email || '').trim();
  const open = UI.menuOpen;
  const pending = isAdmin() && Admin.open > 0;
  mount(acct,
    h('button', { type: 'button', class: 'me', 'aria-haspopup': 'menu', 'aria-expanded': String(!!open), title: t('Account and settings'), 'aria-label': t('Account and settings'), onclick: (e) => { e.stopPropagation(); UI.menuOpen = !UI.menuOpen; renderTopbar(); } },
      name ? name[0].toUpperCase() : icon('user'), pending ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null),
    open ? h('div', { class: 'menu', role: 'menu', onclick: (e) => e.stopPropagation() },
      h('div', { class: 'menu-who' }, h('strong', null, name || t('Your practice')), Api.email && Api.email !== name ? h('span', { class: 'small muted' }, Api.email) : null),
      h('hr'),
      menuItem('settings', t('Settings'), () => go('settings')),
      menuItem('chat', t('Ask Euno'), () => openAsk()),
      isAdmin() ? menuItem('shield', t('Admin'), () => go('admin'), Admin.open || null) : null,
      h('a', { href: '/guides/', role: 'menuitem' }, icon('note'), t('Guides')),
      h('a', { href: 'https://github.com/Evorsiooo/shadowing', target: '_blank', rel: 'noopener', role: 'menuitem' }, icon('note'), t('Source code')),
      menuItem('keyboard', t('Keyboard shortcuts'), () => { closeMenu(); openShortcuts(); }),
      Store.mode === 'cloud' ? [h('hr'), menuItem('back', t('Sign out'), () => signOutNow())] : null) : null);
}
function menuItem(ic, label, onclick, count = null) {
  return h('button', { type: 'button', class: 'mi', role: 'menuitem', onclick }, icon(ic), label, count ? h('span', { class: 'count' }, String(count)) : null);
}
function closeMenu() { if (UI.menuOpen) { UI.menuOpen = false; renderTopbar(); } }
async function signOutNow() {
  await Store.flushAll();
  await Promise.race([Push.disable(), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  location.href = '/auth/logout';
}
/* older name, still called after the streak or the admin count changes */
function renderChips() { renderTopbar(); }

/* ---------- focus bar: the way out, the steps as eye pills, and the time ---------- */
function renderFocusbar() {
  const S = Session;
  const el = $('#focusbar');
  if (!S.active) { el.replaceChildren(); return; }
  enterOnChange(el, S.stepIdx, 'moved');
  const list = h('ol', { class: `fsteps${el.classList.contains('moved') ? ' moved' : ''}`, 'aria-label': t('Steps') }, S.plan.map((p, i) => {
    const cur = i === S.stepIdx;
    return h('li', { class: cur ? 'cur' : null, 'aria-current': cur ? 'step' : null },
      h('span', { class: `pill ${i < S.stepIdx ? 'done' : cur ? 'now' : ''}`, 'aria-hidden': 'true' }), h('span', { class: 'txt' }, t(p.name)));
  }));
  mount(el,
    btn(t('End'), () => S.finish(true), { icon: 'close', kind: 'ghost', size: 'sm', title: t('End now; progress so far is saved') }),
    list,
    h('div', { class: 'fright' },
      h('span', { class: 'ftime', id: 'sessTimer', title: t('Time left in this session') }, S.clockText()),
      h('div', { class: 'acct' },
        btn('', (e) => { e.stopPropagation(); UI.sessMenu = !UI.sessMenu; renderFocusbar(); }, { icon: 'more', kind: 'ghost', size: 'sm', title: t('More'), pressed: !!UI.sessMenu }),
        UI.sessMenu ? h('div', { class: 'menu', role: 'menu', onclick: (e) => e.stopPropagation() }, sessionMenu()) : null)));
}
