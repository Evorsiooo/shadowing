/* ---------- video library sidebar ---------- */
/* the library sits beside the player (under it on phones): "open the library" goes there and brings it into view */
function openDrawer() { UI.libPage = true; if (UI.tab !== 'library') go('library'); else renderLib(); requestAnimationFrame(() => { const sb = $('#sidebar'); if (sb && !wideLayout.matches) sb.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
function closeDrawer() { /* nothing to close any more */ }

function videoProgress(v) {
  const clips = videoClips(v.id).filter((c) => !c.archived);
  const done = clips.filter((c) => c.done).length;
  const last = Store.all('sessions').filter((s) => s.videoId === v.id && !s.empty).map((s) => s.date).sort().pop();
  return { total: clips.length, done, last };
}

/* beside the player when a clip is open: the way back to the library, and this video's clips */
function renderSidebar() {
  const sb = $('#sidebar');
  const v = Player.current();
  enterOnChange(sb, UI.videoId, 'open-in');
  mount(sb,
    h('button', { type: 'button', class: 'linkbtn back', onclick: () => openLibPage() }, icon('chev-left'), t('All videos')),
    v ? [h('h3', null, v.title || t('Untitled video')), clipList(v)] : h('p', { class: 'muted small' }, t('No video open.')));
}
function renderLib() { renderSidebar(); renderLibPage(); }
function openLibPage() {
  UI.libPage = true;
  if (!Player.v.paused) Player.pause();
  showView('library');
  setHash('library');
}
/* a clip in the player, with its pitch line and pronunciation under it */
function openClipView(id) {
  UI.libPage = false;
  selectClip(id);
  showView('library');
  setHash('library', 'clip');
}
function libPageShown() { return UI.tab === 'library' && !Session.active && UI.libPage && !UI.cutMode && !UI.sel; }

/* ---------- the library page: videos on the left, the open video's clips on the right ---------- */
function renderLibPage() {
  const el = $('#libView');
  if (!el || !libPageShown()) return;
  const vids = Store.all('videos').sort((a, b) => (a.added < b.added ? 1 : -1));
  const active = vids.filter((v) => !v.archived);
  const archived = vids.filter((v) => v.archived);
  const v = Store.get('videos', UI.videoId);
  const side = h('aside', { class: 'lib-vids', 'aria-label': t('Video library') },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Videos')),
      btn(UI.addOpen ? t('Close') : t('Add video'), () => { UI.addOpen = !UI.addOpen; renderLibPage(); if (UI.addOpen) setTimeout(() => { const f = $('#addUrl') || $('#addFile'); if (f) f.focus(); }, 30); }, { icon: UI.addOpen ? 'close' : 'plus', size: 'sm' })),
    UI.addOpen ? h('div', { class: 'lib-add' }, addVideoForm()) : null,
    active.map((x) => libVideoCard(x)),
    archived.length ? h('details', { class: 'archived', open: !!UI.showArchivedVids, ontoggle: (e) => { UI.showArchivedVids = e.target.open; } }, h('summary', null, t('Archived ({n})', { n: archived.length })), archived.map((x) => libVideoCard(x))) : null);
  const main = v ? libVideoMain(v) : h('section', { class: 'lib-main lib-none' },
    Euno.el('lib', active.length ? 'watching' : 'searching'),
    h('h2', null, active.length ? t('Pick a video from your library') : t('Add your first video')),
    h('p', { class: 'muted' }, active.length ? t('Its clips show here, ready to practise.') : t('Pick a video of someone with the accent you want: an interview or a talk where one person speaks clearly works best.')),
    !active.length && !UI.addOpen ? btn(t('Add a video'), () => { UI.addOpen = true; renderLibPage(); }, { kind: 'primary', size: 'big', icon: 'plus', cls: 'self-start' }) : null);
  mount(el, h('div', { class: 'lib' }, side, main));
}

function libVideoCard(v) {
  const p = videoProgress(v);
  const open = v.id === UI.videoId;
  const pick = () => { if (!open) { Player.load(v.id); UI.clipId = null; } UI.editVideoId = null; renderLibPage(); };
  return h('button', { type: 'button', class: `lib-vid${open ? ' on' : ''}`, 'aria-pressed': String(open), onclick: pick },
    h('b', null, v.title || t('Untitled video')),
    h('span', { class: 'small muted' }, [v.speaker, p.total ? t('{done} of {total} clips done', { done: p.done, total: p.total }) : t('no clips yet')].filter(Boolean).join(' · ')),
    h('span', { class: 'bar vprog' }, h('i', { style: { width: (p.total ? (p.done / p.total) * 100 : 0) + '%' } })));
}

function libVideoMain(v) {
  const all = videoClips(v.id);
  const live = all.filter((c) => !c.archived);
  const arch = all.filter((c) => c.archived);
  const info = Rank.infoFn(), mode = Rank.mode();
  const shown = Rank.order(live, mode, info);
  const rec = recommendedClipId();
  const lastBy = new Map();
  for (const s of Store.all('sessions')) if (!s.empty && s.videoId === v.id && s.clipId && (!lastBy.has(s.clipId) || lastBy.get(s.clipId) < s.date)) lastBy.set(s.clipId, s.date);
  const ago = (d) => { if (!d) return t('not yet'); const n = Math.round((parseDay(dayKey()) - parseDay(d)) / 864e5); return n <= 0 ? t('today') : n === 1 ? t('yesterday') : tp(n, '{n} day ago', '{n} days ago'); };
  const dur = Player.current() && Player.current().id === v.id ? Player.duration() : 0;
  const where = v.fileRef ? mediaStatus(v.fileRef) || (Drive.connected() ? t('in your Google Drive') : t('on this device')) : v.url ? t('from a link') : null;
  const row = (c) => {
    const i = live.indexOf(c);
    const rk = c.archived ? {} : info(c);
    const fit = rk.match && rk.match.n > 0 ? t('has {sounds}', { sounds: Rank.soundsText(rk.match) }) : '';
    const lvl = mode === 'easy' && rk.diff ? Rank.levelText(rk.diff.level) : '';
    const queued = UI.queue.includes(c.id);
    const now = c.id === rec;
    const sub = [lvl, fit, c.noisy ? t('noisy') : '', queued ? t('#{n} in queue', { n: UI.queue.indexOf(c.id) + 1 }) : ''].filter(Boolean).join(' · ');
    return h('div', { class: `lib-row${now ? ' now' : ''}`, role: 'row' },
      h('span', { class: `tick${c.done ? ' done' : ''}`, role: 'cell', 'aria-label': c.done ? t('Done {day}', { day: fmtDay(c.doneAt) }) : t('Not done yet') }, c.done ? icon('check', 'stroke-width="3.4"') : null),
      h('div', { class: 'lib-name', role: 'cell' },
        h('button', { type: 'button', class: 'linkbtn plain', onclick: () => openClipView(c.id), title: t('Open in the player: its pitch line and sounds') }, c.archived ? c.label || clipName(c) : clipName(c, i)),
        now ? h('span', { class: 'lib-today' }, t('today')) : null,
        sub ? h('span', { class: 'small muted lib-sub' }, sub) : null),
      h('span', { class: 'num lib-len', role: 'cell' }, fmtSec(c.end - c.start)),
      h('span', { class: 'small muted lib-last', role: 'cell' }, ago(lastBy.get(c.id))),
      h('span', { class: 'lib-acts', role: 'cell' },
        c.archived ? null : btn(t('Practise'), () => Session.start([c.id]), { size: 'sm', icon: 'play', kind: now ? 'primary' : '' }),
        btn('', () => openClipMenu(c), { size: 'sm', kind: 'ghost', icon: 'more', title: t('Clip options') })));
  };
  const head = UI.editVideoId === v.id ? h('div', { class: 'lib-edit' }, editVideoForm(v)) : h('div', { class: 'lib-head' },
    h('div', { class: 'grow' },
      h('p', { class: 'small muted' }, [v.speaker, dur ? fmtTime(dur) : null, where].filter(Boolean).join(' · ')),
      h('h2', null, v.title || t('Untitled video'))),
    v.archived ? null : btn(t('Cut a new clip'), () => { if (UI.videoId !== v.id) Player.load(v.id); setCutMode(true); }, { icon: 'scissors' }),
    btn('', () => openVideoMenu(v), { kind: 'ghost', icon: 'more', title: t('Video options') }));
  return h('section', { class: 'lib-main' },
    head,
    live.length > 2 ? sortRow(mode) : null,
    live.length ? h('div', { class: 'lib-table', role: 'table', 'aria-label': t('Clips') },
      h('div', { class: 'lib-row lib-th', role: 'row' }, h('span', { role: 'columnheader' }), h('span', { role: 'columnheader' }, t('Clip')), h('span', { role: 'columnheader' }, t('Length')), h('span', { role: 'columnheader' }, t('Last practised')), h('span', { role: 'columnheader' })),
      shown.map(row))
      : h('div', { class: 'tintcard' }, h('h3', null, t('No clips yet')), h('p', null, t('Cut one sentence of 10 to 20 seconds to start.')),
        v.archived ? null : btn(t('Cut a new clip'), () => { if (UI.videoId !== v.id) Player.load(v.id); setCutMode(true); }, { kind: 'primary', icon: 'scissors', cls: 'self-start' })),
    UI.queue.length ? h('div', { class: 'row small' }, h('span', { class: 'muted grow' }, tp(UI.queue.length, '{n} queued', '{n} queued')), btn(t('Clear queue'), () => { UI.queue = []; renderLib(); renderSession(); }, { size: 'sm', kind: 'ghost' })) : null,
    arch.length ? h('details', { class: 'archived', open: UI.showArchivedClips, ontoggle: (e) => { UI.showArchivedClips = e.target.open; } }, h('summary', null, t('Archived clips ({n})', { n: arch.length })), h('div', { class: 'lib-table' }, arch.map(row))) : null);
}

function openVideoMenu(v) {
  openModal([
    modalHead(v.title || t('Untitled video'), v.speaker || ''),
    h('div', { class: 'stack' },
      v.url ? h('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener' }, icon('link'), h('span', { class: 'txt' }, t('Open the original link'))) : null,
      btn(t('Edit title or link'), () => { closeModal(); UI.editVideoId = v.id; UI.editVideo = { title: v.title, url: v.url, speaker: v.speaker || '' }; renderLib(); }, { icon: 'edit' }),
      v.archived ? btn(t('Restore'), () => { Store.patch('videos', v.id, { archived: false }); closeModal(); renderLib(); toast(t('Video restored.')); }, { icon: 'restore' })
        : btn(t('Archive (clips and history are kept)'), () => { Store.patch('videos', v.id, { archived: true }); closeModal(); if (UI.videoId === v.id) Player.load(null); renderAll(); toast(t('Video archived. Its clips and history are kept.')); }, { icon: 'archive' })),
  ], { narrow: true });
}

function addVideoForm() {
  const F = UI.addForm;
  const device = Store.blobMode === 'device'; // files can be kept on this device (and synced to Drive)
  if (!F.source) F.source = device ? 'file' : 'link';
  if (F.copy == null) F.copy = true;
  const status = h('div', { role: 'status' });
  const fileIn = h('input', { type: 'file', id: 'addFile', accept: 'video/*,audio/*', onchange: (e) => { F.file = e.target.files[0] || null; if (F.file && !F.title) { F.title = F.file.name.replace(/\.\w+$/, ''); const t = $('#addTitle'); if (t) t.value = F.title; } } });
  const source = device ? h('div', { class: 'seg', role: 'group', 'aria-label': t('Where the video comes from') },
    h('button', { type: 'button', class: F.source === 'file' ? 'on' : '', onclick: () => { F.source = 'file'; renderLib(); } }, t('A file on this device')),
    h('button', { type: 'button', class: F.source === 'link' ? 'on' : '', onclick: () => { F.source = 'link'; renderLib(); } }, t('From a link'))) : null;
  const where = Drive.connected() ? t('It goes into your Google Drive, so it’s on all your devices.')
    : deviceOnly() || Store.mode !== 'cloud' ? t('It’s kept in this browser only.')
      : h('span', null, t('It stays in this browser only until you connect Google Drive.'), ' ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); Drive.connect(); } }, t('Connect Google Drive')));
  const form = h('form', { class: 'addform', onsubmit: (e) => { e.preventDefault(); submitAdd(status); } },
    source,
    F.source === 'file' && device
      ? [h('label', { class: 'field', for: 'addFile' }, t('Video file (any length)'), fileIn), h('p', { class: 'small muted' }, where)]
      : [
        h('label', { class: 'field', for: 'addUrl' }, t('Direct link to the .mp4 file'),
          h('input', { type: 'url', id: 'addUrl', required: true, placeholder: 'https://example.com/interview.mp4', value: F.url, oninput: (e) => { F.url = e.target.value.trim(); } })),
        device ? h('label', { class: 'check', for: 'addCopy' }, h('input', { type: 'checkbox', id: 'addCopy', checked: F.copy, onchange: (e) => { F.copy = e.target.checked; } }), t('Keep a copy, so it still plays if the link stops working (recommended)')) : null,
      ],
    h('label', { class: 'field', for: 'addTitle' }, t('Title'),
      h('input', { type: 'text', id: 'addTitle', placeholder: t('e.g. Interview, part 1'), value: F.title, oninput: (e) => { F.title = e.target.value; } })),
    h('label', { class: 'field', for: 'addSpeaker' }, t('Speaker (optional)'),
      h('input', { type: 'text', id: 'addSpeaker', placeholder: t('Who’s speaking'), value: F.speaker, list: 'speakerList', oninput: (e) => { F.speaker = e.target.value; } })),
    h('datalist', { id: 'speakerList' }, [...new Set(Store.all('videos').map((v) => v.speaker).filter(Boolean))].map((s) => h('option', { value: s }))),
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary', id: 'addSubmit' }, h('span', null, F.source === 'file' && device ? t('Add video') : device && F.copy ? t('Copy and add') : t('Check and add')))),
    status);
  return form;
}

function finishAdd(fields) {
  const F = UI.addForm;
  const v = Store.put('videos', { title: F.title.trim() || fields.fallbackTitle || t('Untitled video'), url: fields.url || null, fileRef: fields.fileRef || null, size: fields.size || null, speaker: F.speaker.trim() || null, archived: false, added: new Date().toISOString() });
  if (fields.file) LocalFiles.set(v.id, fields.file);
  UI.addForm = { title: '', url: '', speaker: '' };
  UI.addOpen = false;
  Player.load(v.id);
  renderLib();
  toast(t('Video added. Press Cut clips, then drag along the timeline to make your first clip.'), 'good');
}

function progressBar(label) {
  const bar = h('div', { class: 'bar' }, h('i', { style: { width: '0%' } }));
  const txt = h('p', { class: 'small muted' }, label);
  return { el: h('div', { class: 'stack' }, txt, bar), set: (f, t) => { bar.firstChild.style.width = Math.round(f * 100) + '%'; if (t) txt.textContent = t; } };
}

async function submitAdd(status) {
  const F = UI.addForm;
  const device = Store.blobMode === 'device';
  const submitBtn = $('#addSubmit');
  if (device && F.source === 'file') {
    if (!F.file) { mount(status, h('p', { class: 'formerr' }, t('Choose a video file first.'))); return; }
    const p = progressBar(t('Saving {mb} MB on this device…', { mb: (F.file.size / 1048576).toFixed(0) }));
    mount(status, p.el);
    if (submitBtn) submitBtn.disabled = true;
    try {
      const ref = await Media.add(F.file, { kind: 'video', name: F.file.name }, (f) => p.set(f, t('Saving on this device… {pct}%', { pct: Math.round(f * 100) })));
      finishAdd({ fileRef: ref, size: F.file.size, file: F.file, fallbackTitle: F.file.name.replace(/\.\w+$/, '') });
    } catch (e) {
      mount(status, h('p', { class: 'formerr' }, e.name === 'QuotaExceededError' ? t('There isn’t enough free space on this device for that file.') : t('The file couldn’t be saved ({error}).', { error: e.message || e.name })));
    } finally { if (submitBtn) submitBtn.disabled = false; }
    return;
  }
  const url = F.url;
  if (!/^https?:\/\//i.test(url)) { mount(status, h('p', { class: 'formerr' }, t('Paste a full link starting with https://'))); return; }
  const share = /drive\.google|docs\.google|mega\.nz|mega\.io|youtube\.com|youtu\.be|dropbox\.com\/s\/|onedrive|1drv/i.test(url);
  if (share) {
    mount(status, h('p', { class: 'formerr' }, t('That’s a share page, not a video file. Links from Google Drive, MEGA, YouTube or Dropbox share pages won’t play. Download the file, then add it with “A file on this device”.')));
    return;
  }
  if (device && F.copy) {
    // the browser downloads the file itself; this only works when the site allows it (CORS)
    const p = progressBar(t('Downloading a copy…'));
    mount(status, p.el);
    if (submitBtn) submitBtn.disabled = true;
    try {
      let r;
      try { r = await fetch(url, { mode: 'cors', credentials: 'omit' }); } catch { throw Object.assign(new Error(t('That site doesn’t let the app download its videos.')), { code: 'blocked' }); }
      if (!r.ok || !r.body) throw new Error(t('The link answered with an error (HTTP {status}).', { status: r.status }));
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (/text\/html/.test(type)) throw new Error(t('That link is a web page, not a video file. Use a direct link to an .mp4 file.'));
      const size = Number(r.headers.get('content-length')) || 0;
      const ref = await Media.add(r.body, { kind: 'video', name: guessTitle(url) + (/\.\w{2,4}$/.test(new URL(url).pathname) ? new URL(url).pathname.match(/\.\w{2,4}$/)[0] : '.mp4'), type, size },
        (f) => p.set(f, size ? t('Downloading a copy… {pct}%', { pct: Math.round(f * 100) }) : t('Downloading a copy…')));
      finishAdd({ url, fileRef: ref, size: (Media.doc(Media.idOf(ref)) || {}).size || size, fallbackTitle: guessTitle(url) });
    } catch (e) {
      mount(status,
        h('p', { class: 'formerr' }, t('{error} You can download the file yourself and add it with “A file on this device”, or add the link without a copy.', { error: e.message })),
        h('div', { class: 'row' }, btn(t('Add the link without a copy'), () => { F.copy = false; submitAdd(status); }, { size: 'sm' })));
    } finally { if (submitBtn) submitBtn.disabled = false; }
    return;
  }
  mount(status, h('p', { class: 'small muted' }, t('Checking the link plays…')));
  const result = await checkPlayable(url);
  const add = () => finishAdd({ url, fallbackTitle: guessTitle(url) });
  if (result.ok) { add(); return; }
  mount(status,
    h('p', { class: 'formerr' }, result.reason),
    h('div', { class: 'row' }, btn(t('Add it anyway'), add, { size: 'sm' })));
}

function guessTitle(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.\w+$/, '') || t('Untitled video'); } catch { return t('Untitled video'); }
}

function checkPlayable(url) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata';
    let done = false;
    const finish = (r) => { if (done) return; done = true; v.removeAttribute('src'); v.load(); res(r); };
    v.onloadedmetadata = () => finish(v.duration > 0 ? { ok: true, duration: v.duration } : { ok: false, reason: t('The link loaded but has no playable video.') });
    v.onerror = () => {
      const code = v.error && v.error.code;
      finish({ ok: false, reason: Caps.inArtifact
        ? t('The link didn’t load. Inside a Claude artifact, videos from other websites are blocked, so this check always fails here. Add it anyway and play it from a file on this device, or use the standalone version of the app.')
        : code === 4 ? t('That link isn’t a playable video file. Check it opens directly as an .mp4 in a new tab.') : t('The link didn’t load. Check the address and that the file is still online.') });
    };
    setTimeout(() => finish({ ok: false, reason: t('The link took too long to answer (15 s). Check it opens in a new tab.') }), 15000);
    v.src = url;
  });
}

function editVideoForm(v) {
  const E = UI.editVideo;
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    const urlChanged = E.url.trim() !== v.url;
    Store.patch('videos', v.id, { title: E.title.trim() || v.title, url: E.url.trim(), speaker: E.speaker.trim() || null });
    UI.editVideoId = null;
    if (urlChanged) { VideoAudio.cache.delete(v.id); if (UI.videoId === v.id) Player.reloadSrc(); }
    renderLib();
    toast(t('Video updated.'));
  } },
  h('label', { class: 'field', for: 'evTitle' }, t('Title'), h('input', { type: 'text', id: 'evTitle', value: E.title, oninput: (e) => { E.title = e.target.value; } })),
  h('label', { class: 'field', for: 'evUrl' }, t('Link'), h('input', { type: 'url', id: 'evUrl', value: E.url, oninput: (e) => { E.url = e.target.value; } })),
  h('label', { class: 'field', for: 'evSpeaker' }, t('Speaker'), h('input', { type: 'text', id: 'evSpeaker', value: E.speaker, oninput: (e) => { E.speaker = e.target.value; } })),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary sm' }, h('span', null, t('Save'))), btn(t('Cancel'), () => { UI.editVideoId = null; renderLib(); }, { size: 'sm', kind: 'ghost' })));
}

const CLIP_LIMIT = 5;
/* a long clip list is cut to the ones that matter now: selected, queued, then not-done, in timeline order */
function visibleClips(v, live) {
  if (live.length <= CLIP_LIMIT || UI.showAllClips[v.id]) return live;
  const score = (c) => (c.id === UI.clipId ? 0 : UI.queue.includes(c.id) ? 1 : !c.done ? 2 : 3);
  const keep = new Set(live.slice().sort((a, b) => score(a) - score(b) || live.indexOf(a) - live.indexOf(b)).slice(0, CLIP_LIMIT).map((c) => c.id));
  return live.filter((c) => keep.has(c.id));
}

function clipList(v) {
  const all = videoClips(v.id);
  const live = all.filter((c) => !c.archived);
  const arch = all.filter((c) => c.archived);
  const info = Rank.infoFn(), mode = Rank.mode();
  const shown = Rank.order(live, mode, info); // 'as cut', 'easier first' or 'fits my sounds'; clip names keep their place on the timeline
  const item = (c, i) => {
    const rk = c.archived ? {} : info(c);
    const fit = rk.match && rk.match.n > 0 ? ` · ${t('has {sounds}', { sounds: Rank.soundsText(rk.match) })}` : '';
    const lvl = mode === 'easy' && rk.diff ? ` · ${Rank.levelText(rk.diff.level)}` : '';
    const queued = UI.queue.includes(c.id);
    return h('div', { class: `citem ${c.id === UI.clipId ? 'sel' : ''}` },
      c.archived ? h('span', { class: 'tick' }, icon('archive'))
        : c.done ? h('span', { class: 'tick done', title: t('Done {day}', { day: fmtDay(c.doneAt) }), 'aria-label': t('Done {day}', { day: fmtDay(c.doneAt) }) }, icon('check', 'stroke-width="3.4"'))
        : h('span', { class: 'tick', title: t('Not done yet'), 'aria-label': t('Not done yet') }),
      h('div', { style: { minWidth: 0 } },
        h('div', { class: 'clabel', role: 'button', tabindex: 0, onclick: () => { selectClip(c.id); }, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectClip(c.id); } } }, clipName(c, i)),
        h('div', { class: 'cmeta' }, `${fmtTime(c.start)}–${fmtTime(c.end)} · ${fmtSec(c.end - c.start)}${c.noisy ? ` · ${t('noisy')}` : ''}${queued ? ` · ${t('#{n} in queue', { n: UI.queue.indexOf(c.id) + 1 })}` : ''}${lvl}${fit}`)),
      h('div', { class: 'row', style: { gap: '2px', flexWrap: 'nowrap' } },
        !c.archived ? btn('', () => { editClip(c.id); closeDrawer(); }, { size: 'sm', kind: 'ghost', icon: 'edit', title: t('Edit clip (start, end, length, label)'), disabled: Session.active }) : null,
        btn('', () => openClipMenu(c), { size: 'sm', kind: 'ghost', icon: 'more', title: t('Clip options') })));
  };
  return h('div', { class: 'clist' },
    live.length > 2 ? sortRow(mode) : null,
    live.length ? visibleClips(v, shown).map((c) => item(c, live.indexOf(c))) : h('p', { class: 'small muted' }, t('No clips yet. Press Cut clips under the video, then drag along the timeline.')),
    live.length > CLIP_LIMIT ? btn(UI.showAllClips[v.id] ? t('Show fewer') : t('Show all {n} clips', { n: live.length }), () => { UI.showAllClips[v.id] = !UI.showAllClips[v.id]; renderLib(); }, { size: 'sm', kind: 'ghost' }) : null,
    UI.queue.length ? h('div', { class: 'row small' }, h('span', { class: 'muted grow' }, tp(UI.queue.length, '{n} queued', '{n} queued')), btn(t('Clear queue'), () => { UI.queue = []; renderLib(); renderSession(); }, { size: 'sm', kind: 'ghost' })) : null,
    arch.length ? h('details', { class: 'archived', open: UI.showArchivedClips, ontoggle: (e) => { UI.showArchivedClips = e.target.open; } }, h('summary', null, t('Archived clips ({n})', { n: arch.length })), h('div', { class: 'clist' }, arch.map(item))) : null);
}

/* how the clip list is ordered. 'Fits my sounds' needs the speaker's sounds saved on the clips (Settings → Analysis → Prepare my library) */
function sortRow(mode) {
  const opt = (m, label) => h('button', { type: 'button', class: mode === m ? 'on' : '', 'aria-pressed': String(mode === m), onclick: () => { Rank.setMode(m); renderLib(); } }, label);
  return h('div', { class: 'seg sm', role: 'group', 'aria-label': t('Order of the clips') }, opt('time', t('As cut')), opt('easy', t('Easier first')), opt('issues', t('Fits my sounds')));
}

function openClipMenu(c) {
  openModal([
    modalHead(clipName(c), `${fmtTime(c.start, 1)}–${fmtTime(c.end, 1)} · ${fmtSec(c.end - c.start)}`),
    h('div', { class: 'stack' },
      btn(t('Practise'), () => { closeModal(); Session.start([c.id]); }, { kind: 'primary', icon: 'play', disabled: Session.active || c.archived }),
      libPageShown() ? btn(t('Open in the player'), () => { closeModal(); openClipView(c.id); }, { icon: 'play' }) : null,
      btn(t('Edit edges or label'), () => { closeModal(); closeDrawer(); editClip(c.id); }, { icon: 'scissors', disabled: Session.active }),
      !c.archived ? btn(UI.queue.includes(c.id) ? t('Remove from the queue') : t('Add to the queue, to shadow it right after the others'), () => {
        UI.queue = UI.queue.includes(c.id) ? UI.queue.filter((x) => x !== c.id) : [...UI.queue, c.id];
        closeModal(); renderLib(); renderSession();
      }, { icon: 'plus', disabled: Session.active }) : null,
      btn(t('History and recordings'), () => openHistory(c.id), { icon: 'history' }),
      btn(c.done ? t('Remove the tick') : t('Mark as done'), () => { Store.patch('clips', c.id, { done: !c.done, doneAt: c.done ? null : dayKey() }); closeModal(); renderAll(); }, { icon: 'check' }),
      btn(c.noisy ? t('Unflag noisy') : t('Flag as too noisy'), () => { Store.patch('clips', c.id, { noisy: !c.noisy }); closeModal(); renderAll(); }, { icon: 'flag' }),
      c.archived ? btn(t('Restore clip'), () => { Store.patch('clips', c.id, { archived: false }); closeModal(); renderAll(); }, { icon: 'restore' })
        : btn(t('Archive clip'), () => { Store.patch('clips', c.id, { archived: true }); if (UI.clipId === c.id) UI.clipId = null; UI.queue = UI.queue.filter((x) => x !== c.id); closeModal(); renderAll(); toast(t('Clip archived. Its history is kept.')); }, { icon: 'archive' })),
  ], { narrow: true });
}
