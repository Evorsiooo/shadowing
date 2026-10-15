/* ---------- video library sidebar ---------- */
function openDrawer() { UI.drawer = true; $('#sidebar').classList.add('open'); $('#drawerBack').hidden = false; }
function closeDrawer() { UI.drawer = false; $('#sidebar').classList.remove('open'); $('#drawerBack').hidden = true; }

function videoProgress(v) {
  const clips = videoClips(v.id).filter((c) => !c.archived);
  const done = clips.filter((c) => c.done).length;
  const last = Store.all('sessions').filter((s) => s.videoId === v.id && !s.empty).map((s) => s.date).sort().pop();
  return { total: clips.length, done, last };
}

function renderSidebar() {
  const sb = $('#sidebar');
  const vids = Store.all('videos').sort((a, b) => (a.added < b.added ? 1 : -1));
  const active = vids.filter((v) => !v.archived);
  const archived = vids.filter((v) => v.archived);
  mount(sb,
    h('div', { class: 'row' },
      h('h3', { class: 'grow' }, t('Videos')),
      btn(UI.addOpen ? t('Close') : t('Add video'), () => { UI.addOpen = !UI.addOpen; renderSidebar(); if (UI.addOpen) setTimeout(() => $('#addUrl') && $('#addUrl').focus(), 30); }, { icon: UI.addOpen ? 'close' : 'plus', size: 'sm', kind: UI.addOpen ? '' : 'primary' }),
      btn('', () => closeDrawer(), { icon: 'close', kind: 'ghost', title: t('Close library'), txtClass: 'txt' })),
    UI.addOpen ? addVideoForm() : null,
    active.length ? h('div', { class: 'vlist' }, active.map(videoItem)) : (!UI.addOpen ? h('p', { class: 'muted small' }, t('No videos yet. Add a video file or a direct link to an .mp4 file to get started.')) : null),
    archived.length ? h('details', { class: 'archived' }, h('summary', null, t('Archived ({n})', { n: archived.length })), h('div', { class: 'vlist' }, archived.map(videoItem))) : null);
  // the close button only makes sense in the phone drawer
  const closeBtn = sb.querySelector('.row .btn.ghost');
  if (closeBtn) closeBtn.classList.add('only-phone');
}

function addVideoForm() {
  const F = UI.addForm;
  const device = Store.blobMode === 'device'; // files can be kept on this device (and synced to Drive)
  if (!F.source) F.source = device ? 'file' : 'link';
  if (F.copy == null) F.copy = true;
  const status = h('div', { role: 'status' });
  const fileIn = h('input', { type: 'file', id: 'addFile', accept: 'video/*,audio/*', onchange: (e) => { F.file = e.target.files[0] || null; if (F.file && !F.title) { F.title = F.file.name.replace(/\.\w+$/, ''); const t = $('#addTitle'); if (t) t.value = F.title; } } });
  const source = device ? h('div', { class: 'seg', role: 'group', 'aria-label': t('Where the video comes from') },
    h('button', { type: 'button', class: F.source === 'file' ? 'on' : '', onclick: () => { F.source = 'file'; renderSidebar(); } }, t('A file on this device')),
    h('button', { type: 'button', class: F.source === 'link' ? 'on' : '', onclick: () => { F.source = 'link'; renderSidebar(); } }, t('From a link'))) : null;
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
  renderSidebar();
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

function videoItem(v) {
  const open = v.id === UI.videoId;
  const p = videoProgress(v);
  const editing = UI.editVideoId === v.id;
  return h('div', { class: `vitem ${open ? 'open' : ''}` },
    editing ? editVideoForm(v) : [
      h('div', { class: 'vitem-title', role: 'button', tabindex: 0, onclick: () => { Player.load(v.id); closeDrawer(); }, onkeydown: (e) => { if (e.key === 'Enter') { Player.load(v.id); closeDrawer(); } } }, v.title || t('Untitled video')),
      h('div', { class: 'meta' }, `${t('{done}/{total} clips done', { done: p.done, total: p.total })} · ${p.last ? t('last practised {day}', { day: fmtDay(p.last) }) : t('not practised yet')}${v.speaker ? ` · ${v.speaker}` : ''}${v.fileRef ? ` · ${mediaStatus(v.fileRef) || t('saved')}` : ''}`),
      h('div', { class: 'bar vprog' }, h('i', { style: { width: (p.total ? (p.done / p.total) * 100 : 0) + '%' } })),
      h('div', { class: 'row' },
        !open ? btn(t('Open'), () => { Player.load(v.id); closeDrawer(); }, { size: 'sm', kind: 'primary' }) : null,
        v.url ? h('a', { class: 'btn sm ghost', href: v.url, target: '_blank', rel: 'noopener', title: t('Open the original link') }, icon('link'), h('span', { class: 'txt' }, t('Link'))) : null,
        btn('', () => { UI.editVideoId = v.id; UI.editVideo = { title: v.title, url: v.url, speaker: v.speaker || '' }; renderSidebar(); }, { size: 'sm', kind: 'ghost', icon: 'edit', title: t('Edit title or link') }),
        v.archived ? btn(t('Restore'), () => { Store.patch('videos', v.id, { archived: false }); renderSidebar(); toast(t('Video restored.')); }, { size: 'sm', icon: 'restore' })
          : btn('', () => { Store.patch('videos', v.id, { archived: true }); if (open) Player.load(null); renderSidebar(); toast(t('Video archived. Its clips and history are kept.')); }, { size: 'sm', kind: 'ghost', icon: 'archive', title: t('Archive (clips and history are kept)') })),
      open ? clipList(v) : null,
    ]);
}

function editVideoForm(v) {
  const E = UI.editVideo;
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    const urlChanged = E.url.trim() !== v.url;
    Store.patch('videos', v.id, { title: E.title.trim() || v.title, url: E.url.trim(), speaker: E.speaker.trim() || null });
    UI.editVideoId = null;
    if (urlChanged) { VideoAudio.cache.delete(v.id); if (UI.videoId === v.id) Player.reloadSrc(); }
    renderSidebar();
    toast(t('Video updated.'));
  } },
  h('label', { class: 'field', for: 'evTitle' }, t('Title'), h('input', { type: 'text', id: 'evTitle', value: E.title, oninput: (e) => { E.title = e.target.value; } })),
  h('label', { class: 'field', for: 'evUrl' }, t('Link'), h('input', { type: 'url', id: 'evUrl', value: E.url, oninput: (e) => { E.url = e.target.value; } })),
  h('label', { class: 'field', for: 'evSpeaker' }, t('Speaker'), h('input', { type: 'text', id: 'evSpeaker', value: E.speaker, oninput: (e) => { E.speaker = e.target.value; } })),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary sm' }, h('span', null, t('Save'))), btn(t('Cancel'), () => { UI.editVideoId = null; renderSidebar(); }, { size: 'sm', kind: 'ghost' })));
}

const CLIP_LIMIT = 5;
/* a long clip list is cut to the ones that matter now: selected, queued, then not-done, in timeline order */
function visibleClips(v, live) {
  if (live.length <= CLIP_LIMIT || UI.showAllClips[v.id]) return live;
  const score = (c) => (c.id === UI.clipId ? 0 : UI.queue.includes(c.id) ? 1 : !c.done ? 2 : 3);
  const keep = new Set(live.slice().sort((a, b) => score(a) - score(b) || a.start - b.start).slice(0, CLIP_LIMIT).map((c) => c.id));
  return live.filter((c) => keep.has(c.id));
}

function clipList(v) {
  const all = videoClips(v.id);
  const live = all.filter((c) => !c.archived);
  const arch = all.filter((c) => c.archived);
  const item = (c, i) => {
    const queued = UI.queue.includes(c.id);
    return h('div', { class: `citem ${c.id === UI.clipId ? 'sel' : ''}` },
      c.archived ? h('span', { class: 'tick' }, icon('archive'))
        : c.done ? h('span', { class: 'tick done', title: t('Done {day}', { day: fmtDay(c.doneAt) }), 'aria-label': t('Done {day}', { day: fmtDay(c.doneAt) }) }, icon('check', 'stroke-width="3.4"'))
        : h('span', { class: 'tick', title: t('Not done yet'), 'aria-label': t('Not done yet') }),
      h('div', { style: { minWidth: 0 } },
        h('div', { class: 'clabel', role: 'button', tabindex: 0, onclick: () => { selectClip(c.id); closeDrawer(); }, onkeydown: (e) => { if (e.key === 'Enter') selectClip(c.id); } }, clipName(c, i)),
        h('div', { class: 'cmeta' }, `${fmtTime(c.start)}–${fmtTime(c.end)} · ${fmtSec(c.end - c.start)}${c.noisy ? ` · ${t('noisy')}` : ''}${queued ? ` · ${t('#{n} in queue', { n: UI.queue.indexOf(c.id) + 1 })}` : ''}`)),
      h('div', { class: 'row', style: { gap: '2px', flexWrap: 'nowrap' } },
        !c.archived ? btn('', () => { editClip(c.id); closeDrawer(); }, { size: 'sm', kind: 'ghost', icon: 'edit', title: t('Edit clip (start, end, length, label)'), disabled: Session.active }) : null,
        btn('', () => openClipMenu(c), { size: 'sm', kind: 'ghost', icon: 'menu', title: t('Clip options') })));
  };
  return h('div', { class: 'clist' },
    live.length ? visibleClips(v, live).map((c) => item(c, live.indexOf(c))) : h('p', { class: 'small muted' }, t('No clips yet. Press Cut clips under the video, then drag along the timeline.')),
    live.length > CLIP_LIMIT ? btn(UI.showAllClips[v.id] ? t('Show fewer') : t('Show all {n} clips', { n: live.length }), () => { UI.showAllClips[v.id] = !UI.showAllClips[v.id]; renderSidebar(); }, { size: 'sm', kind: 'ghost' }) : null,
    UI.queue.length ? h('div', { class: 'row small' }, h('span', { class: 'muted grow' }, tp(UI.queue.length, '{n} queued', '{n} queued')), btn(t('Clear queue'), () => { UI.queue = []; renderSidebar(); renderSession(); }, { size: 'sm', kind: 'ghost' })) : null,
    arch.length ? h('details', { class: 'archived', open: UI.showArchivedClips, ontoggle: (e) => { UI.showArchivedClips = e.target.open; } }, h('summary', null, t('Archived clips ({n})', { n: arch.length })), h('div', { class: 'clist' }, arch.map(item))) : null);
}

function openClipMenu(c) {
  openModal([
    modalHead(clipName(c), `${fmtTime(c.start, 1)}–${fmtTime(c.end, 1)} · ${fmtSec(c.end - c.start)}`),
    h('div', { class: 'stack' },
      btn(t('Shadow this clip'), () => { closeModal(); closeDrawer(); Session.start([c.id]); }, { kind: 'primary', icon: 'mic', disabled: Session.active }),
      btn(t('Edit edges or label'), () => { closeModal(); closeDrawer(); editClip(c.id); }, { icon: 'scissors', disabled: Session.active }),
      !c.archived ? btn(UI.queue.includes(c.id) ? t('Remove from the queue') : t('Add to the queue, to shadow it right after the others'), () => {
        UI.queue = UI.queue.includes(c.id) ? UI.queue.filter((x) => x !== c.id) : [...UI.queue, c.id];
        closeModal(); renderSidebar(); renderSession();
      }, { icon: 'plus', disabled: Session.active }) : null,
      btn(t('History and recordings'), () => openHistory(c.id), { icon: 'history' }),
      btn(c.done ? t('Remove the tick') : t('Mark as done'), () => { Store.patch('clips', c.id, { done: !c.done, doneAt: c.done ? null : dayKey() }); closeModal(); renderAll(); }, { icon: 'check' }),
      btn(c.noisy ? t('Unflag noisy') : t('Flag as too noisy'), () => { Store.patch('clips', c.id, { noisy: !c.noisy }); closeModal(); renderAll(); }, { icon: 'flag' }),
      c.archived ? btn(t('Restore clip'), () => { Store.patch('clips', c.id, { archived: false }); closeModal(); renderAll(); }, { icon: 'restore' })
        : btn(t('Archive clip'), () => { Store.patch('clips', c.id, { archived: true }); if (UI.clipId === c.id) UI.clipId = null; UI.queue = UI.queue.filter((x) => x !== c.id); closeModal(); renderAll(); toast(t('Clip archived. Its history is kept.')); }, { icon: 'archive' })),
  ], { narrow: true });
}
