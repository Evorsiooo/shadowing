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
      h('h3', { class: 'grow' }, 'Videos'),
      btn(UI.addOpen ? 'Close' : 'Add video', () => { UI.addOpen = !UI.addOpen; renderSidebar(); if (UI.addOpen) setTimeout(() => $('#addUrl') && $('#addUrl').focus(), 30); }, { icon: UI.addOpen ? 'close' : 'plus', size: 'sm', kind: UI.addOpen ? '' : 'primary' }),
      btn('', () => closeDrawer(), { icon: 'close', kind: 'ghost', title: 'Close library', txtClass: 'txt' })),
    UI.addOpen ? addVideoForm() : null,
    active.length ? h('div', { class: 'vlist' }, active.map(videoItem)) : (!UI.addOpen ? h('p', { class: 'muted small' }, 'No videos yet. Add a direct link to an .mp4 file to get started.') : null),
    archived.length ? h('details', { class: 'archived' }, h('summary', null, `Archived (${archived.length})`), h('div', { class: 'vlist' }, archived.map(videoItem))) : null);
  // the close button only makes sense in the phone drawer
  const closeBtn = sb.querySelector('.row .btn.ghost');
  if (closeBtn) closeBtn.classList.add('only-phone');
}

function addVideoForm() {
  const F = UI.addForm;
  const cloud = Store.mode === 'cloud';
  if (!F.source) F.source = cloud ? 'upload' : 'link';
  if (F.copy == null) F.copy = true;
  const status = h('div', { role: 'status' });
  const fileIn = h('input', { type: 'file', id: 'addFile', accept: 'video/*,audio/*', onchange: (e) => { F.file = e.target.files[0] || null; if (F.file && !F.title) { F.title = F.file.name.replace(/\.\w+$/, ''); const t = $('#addTitle'); if (t) t.value = F.title; } } });
  const source = cloud ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Where the video comes from' },
    h('button', { type: 'button', class: F.source === 'upload' ? 'on' : '', onclick: () => { F.source = 'upload'; renderSidebar(); } }, 'Upload a file'),
    h('button', { type: 'button', class: F.source === 'link' ? 'on' : '', onclick: () => { F.source = 'link'; renderSidebar(); } }, 'From a link')) : null;
  const form = h('form', { class: 'addform', onsubmit: (e) => { e.preventDefault(); submitAdd(status); } },
    source,
    F.source === 'upload' && cloud
      ? h('label', { class: 'field', for: 'addFile' }, 'Video file (any length)', fileIn)
      : [
        h('label', { class: 'field', for: 'addUrl' }, 'Direct link to the .mp4 file',
          h('input', { type: 'url', id: 'addUrl', required: true, placeholder: 'https://pomf2.lain.la/f/….mp4', value: F.url, oninput: (e) => { F.url = e.target.value.trim(); } })),
        cloud ? h('label', { class: 'check', for: 'addCopy' }, h('input', { type: 'checkbox', id: 'addCopy', checked: F.copy, onchange: (e) => { F.copy = e.target.checked; } }), 'Keep a copy in my storage (recommended)') : null,
      ],
    h('label', { class: 'field', for: 'addTitle' }, 'Title',
      h('input', { type: 'text', id: 'addTitle', placeholder: 'Piastri, post-race, Monza', value: F.title, oninput: (e) => { F.title = e.target.value; } })),
    h('label', { class: 'field', for: 'addSpeaker' }, 'Speaker (optional)',
      h('input', { type: 'text', id: 'addSpeaker', placeholder: 'Oscar Piastri', value: F.speaker, list: 'speakerList', oninput: (e) => { F.speaker = e.target.value; } })),
    h('datalist', { id: 'speakerList' }, [...new Set(Store.all('videos').map((v) => v.speaker).filter(Boolean).concat(['Oscar Piastri']))].map((s) => h('option', { value: s }))),
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary', id: 'addSubmit' }, h('span', null, F.source === 'upload' && cloud ? 'Upload and add' : cloud && F.copy ? 'Copy and add' : 'Check and add'))),
    status);
  return form;
}

function finishAdd(fields) {
  const F = UI.addForm;
  const v = Store.put('videos', { title: F.title.trim() || fields.fallbackTitle || 'Untitled video', url: fields.url || null, r2Key: fields.r2Key || null, size: fields.size || null, speaker: F.speaker.trim() || null, archived: false, added: new Date().toISOString() });
  UI.addForm = { title: '', url: '', speaker: '' };
  UI.addOpen = false;
  Player.load(v.id);
  renderSidebar();
  toast('Video added. Press Cut clips, then drag along the timeline to make your first clip.', 'good');
}

function progressBar(label) {
  const bar = h('div', { class: 'bar' }, h('i', { style: { width: '0%' } }));
  const txt = h('p', { class: 'small muted' }, label);
  return { el: h('div', { class: 'stack' }, txt, bar), set: (f, t) => { bar.firstChild.style.width = Math.round(f * 100) + '%'; if (t) txt.textContent = t; } };
}

async function submitAdd(status) {
  const F = UI.addForm;
  const cloud = Store.mode === 'cloud';
  const submitBtn = $('#addSubmit');
  if (cloud && F.source === 'upload') {
    if (!F.file) { mount(status, h('p', { class: 'formerr' }, 'Choose a video file first.')); return; }
    const p = progressBar(`Uploading ${(F.file.size / 1048576).toFixed(0)} MB…`);
    mount(status, p.el);
    if (submitBtn) submitBtn.disabled = true;
    try {
      const r = await Api.uploadVideo(F.file, (f) => p.set(f, `Uploading… ${Math.round(f * 100)}%`));
      finishAdd({ r2Key: r.key, size: r.size, fallbackTitle: F.file.name.replace(/\.\w+$/, '') });
    } catch (e) {
      mount(status, h('p', { class: 'formerr' }, e.message));
    } finally { if (submitBtn) submitBtn.disabled = false; }
    return;
  }
  const url = F.url;
  if (!/^https?:\/\//i.test(url)) { mount(status, h('p', { class: 'formerr' }, 'Paste a full link starting with https://')); return; }
  const share = /drive\.google|docs\.google|mega\.nz|mega\.io|youtube\.com|youtu\.be|dropbox\.com\/s\/|onedrive|1drv/i.test(url);
  if (share) {
    mount(status, h('p', { class: 'formerr' }, 'That’s a share page, not a video file. Links from Google Drive, MEGA, YouTube or Dropbox share pages won’t play. Download the file and use “Upload a file” instead.'));
    return;
  }
  if (cloud && F.copy) {
    mount(status, h('p', { class: 'small muted' }, 'Copying the video into your storage… this can take a minute for long videos.'));
    if (submitBtn) submitBtn.disabled = true;
    try {
      const r = await Api.req('POST', '/api/import', { url });
      finishAdd({ url, r2Key: r.key, size: r.size, fallbackTitle: guessTitle(url) });
    } catch (e) {
      mount(status, h('p', { class: 'formerr' }, e.message), h('div', { class: 'row' }, btn('Add the link without a copy', () => finishAdd({ url, fallbackTitle: guessTitle(url) }), { size: 'sm' })));
    } finally { if (submitBtn) submitBtn.disabled = false; }
    return;
  }
  mount(status, h('p', { class: 'small muted' }, 'Checking the link plays…'));
  const result = await checkPlayable(url);
  const add = () => finishAdd({ url, fallbackTitle: guessTitle(url) });
  if (result.ok) { add(); return; }
  mount(status,
    h('p', { class: 'formerr' }, result.reason),
    h('div', { class: 'row' }, btn('Add it anyway', add, { size: 'sm' })));
}

function guessTitle(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.\w+$/, '') || 'Untitled video'; } catch { return 'Untitled video'; }
}

function checkPlayable(url) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata';
    let done = false;
    const finish = (r) => { if (done) return; done = true; v.removeAttribute('src'); v.load(); res(r); };
    v.onloadedmetadata = () => finish(v.duration > 0 ? { ok: true, duration: v.duration } : { ok: false, reason: 'The link loaded but has no playable video.' });
    v.onerror = () => {
      const code = v.error && v.error.code;
      finish({ ok: false, reason: Caps.inArtifact
        ? 'The link didn’t load. Inside a Claude artifact, videos from other websites are blocked, so this check always fails here. Add it anyway and play it from a file on this device, or use the standalone version of the app.'
        : code === 4 ? 'That link isn’t a playable video file. Check it opens directly as an .mp4 in a new tab.' : 'The link didn’t load. Check the address and that the file is still online.' });
    };
    setTimeout(() => finish({ ok: false, reason: 'The link took too long to answer (15 s). Check it opens in a new tab.' }), 15000);
    v.src = url;
  });
}

function videoItem(v) {
  const open = v.id === UI.videoId;
  const p = videoProgress(v);
  const editing = UI.editVideoId === v.id;
  return h('div', { class: `vitem ${open ? 'open' : ''}` },
    editing ? editVideoForm(v) : [
      h('div', { class: 'vitem-title', role: 'button', tabindex: 0, onclick: () => { Player.load(v.id); closeDrawer(); }, onkeydown: (e) => { if (e.key === 'Enter') { Player.load(v.id); closeDrawer(); } } }, v.title || 'Untitled video'),
      h('div', { class: 'meta' }, `${p.done}/${p.total} clips done · ${p.last ? `last practised ${fmtDay(p.last)}` : 'not practised yet'}${v.speaker ? ` · ${v.speaker}` : ''}${v.r2Key ? ' · stored' : ''}`),
      h('div', { class: 'bar vprog' }, h('i', { style: { width: (p.total ? (p.done / p.total) * 100 : 0) + '%' } })),
      h('div', { class: 'row' },
        !open ? btn('Open', () => { Player.load(v.id); closeDrawer(); }, { size: 'sm', kind: 'primary' }) : null,
        v.url || v.r2Key ? h('a', { class: 'btn sm ghost', href: v.url || '/api/files/' + v.r2Key, target: '_blank', rel: 'noopener', title: 'Open the original link' }, icon('link'), h('span', { class: 'txt' }, 'Link')) : null,
        btn('', () => { UI.editVideoId = v.id; UI.editVideo = { title: v.title, url: v.url, speaker: v.speaker || '' }; renderSidebar(); }, { size: 'sm', kind: 'ghost', icon: 'edit', title: 'Edit title or link' }),
        v.archived ? btn('Restore', () => { Store.patch('videos', v.id, { archived: false }); renderSidebar(); toast('Video restored.'); }, { size: 'sm', icon: 'restore' })
          : btn('', () => { Store.patch('videos', v.id, { archived: true }); if (open) Player.load(null); renderSidebar(); toast('Video archived. Its clips and history are kept.'); }, { size: 'sm', kind: 'ghost', icon: 'archive', title: 'Archive (clips and history are kept)' })),
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
    toast('Video updated.');
  } },
  h('label', { class: 'field', for: 'evTitle' }, 'Title', h('input', { type: 'text', id: 'evTitle', value: E.title, oninput: (e) => { E.title = e.target.value; } })),
  h('label', { class: 'field', for: 'evUrl' }, 'Link', h('input', { type: 'url', id: 'evUrl', value: E.url, oninput: (e) => { E.url = e.target.value; } })),
  h('label', { class: 'field', for: 'evSpeaker' }, 'Speaker', h('input', { type: 'text', id: 'evSpeaker', value: E.speaker, oninput: (e) => { E.speaker = e.target.value; } })),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary sm' }, h('span', null, 'Save')), btn('Cancel', () => { UI.editVideoId = null; renderSidebar(); }, { size: 'sm', kind: 'ghost' })));
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
      c.archived ? h('span', { class: 'tick' }, icon('archive')) : h('input', { type: 'checkbox', checked: queued, 'aria-label': `Queue ${clipName(c, i)}`, title: 'Add to the session queue', onchange: (e) => {
        UI.queue = e.target.checked ? [...UI.queue, c.id] : UI.queue.filter((x) => x !== c.id);
        renderSession();
      } }),
      h('div', { style: { minWidth: 0 } },
        h('div', { class: 'clabel', role: 'button', tabindex: 0, onclick: () => { selectClip(c.id); closeDrawer(); }, onkeydown: (e) => { if (e.key === 'Enter') selectClip(c.id); } }, clipName(c, i)),
        h('div', { class: 'cmeta' }, `${fmtTime(c.start)}–${fmtTime(c.end)} · ${fmtSec(c.end - c.start)}${c.noisy ? ' · noisy' : ''}${queued ? ` · #${UI.queue.indexOf(c.id) + 1} in queue` : ''}`)),
      h('div', { class: 'row', style: { gap: '2px', flexWrap: 'nowrap' } },
        h('span', { class: `tick ${c.done ? 'done' : ''}`, title: c.done ? `Done ${fmtDay(c.doneAt)}` : 'Not done yet' }, c.done ? icon('check', 'stroke-width="3.4"') : null),
        !c.archived ? btn('', () => { editClip(c.id); closeDrawer(); }, { size: 'sm', kind: 'ghost', icon: 'edit', title: 'Edit clip (start, end, length, label)', disabled: Session.active }) : null,
        btn('', () => openClipMenu(c), { size: 'sm', kind: 'ghost', icon: 'menu', title: 'Clip options' })));
  };
  return h('div', { class: 'clist' },
    live.length ? visibleClips(v, live).map((c) => item(c, live.indexOf(c))) : h('p', { class: 'small muted' }, 'No clips yet. Press Cut clips under the video, then drag along the timeline.'),
    live.length > CLIP_LIMIT ? btn(UI.showAllClips[v.id] ? 'Show fewer' : `Show all ${live.length} clips`, () => { UI.showAllClips[v.id] = !UI.showAllClips[v.id]; renderSidebar(); }, { size: 'sm', kind: 'ghost' }) : null,
    UI.queue.length ? h('div', { class: 'row small' }, h('span', { class: 'muted grow' }, `${UI.queue.length} queued`), btn('Clear queue', () => { UI.queue = []; renderSidebar(); renderSession(); }, { size: 'sm', kind: 'ghost' })) : null,
    arch.length ? h('details', { class: 'archived', open: UI.showArchivedClips, ontoggle: (e) => { UI.showArchivedClips = e.target.open; } }, h('summary', null, `Archived clips (${arch.length})`), h('div', { class: 'clist' }, arch.map(item))) : null);
}

function openClipMenu(c) {
  openModal([
    modalHead(clipName(c), `${fmtTime(c.start, 1)}–${fmtTime(c.end, 1)} · ${fmtSec(c.end - c.start)}`),
    h('div', { class: 'stack' },
      btn('Shadow this clip', () => { closeModal(); closeDrawer(); Session.start([c.id]); }, { kind: 'primary', icon: 'mic', disabled: Session.active }),
      btn('Edit edges or label', () => { closeModal(); closeDrawer(); editClip(c.id); }, { icon: 'scissors', disabled: Session.active }),
      btn('History and recordings', () => openHistory(c.id), { icon: 'history' }),
      btn(c.done ? 'Remove the tick' : 'Mark as done', () => { Store.patch('clips', c.id, { done: !c.done, doneAt: c.done ? null : dayKey() }); closeModal(); renderAll(); }, { icon: 'check' }),
      btn(c.noisy ? 'Unflag noisy' : 'Flag as too noisy', () => { Store.patch('clips', c.id, { noisy: !c.noisy }); closeModal(); renderAll(); }, { icon: 'flag' }),
      c.archived ? btn('Restore clip', () => { Store.patch('clips', c.id, { archived: false }); closeModal(); renderAll(); }, { icon: 'restore' })
        : btn('Archive clip', () => { Store.patch('clips', c.id, { archived: true }); if (UI.clipId === c.id) UI.clipId = null; UI.queue = UI.queue.filter((x) => x !== c.id); closeModal(); renderAll(); toast('Clip archived. Its history is kept.'); }, { icon: 'archive' })),
  ], { narrow: true });
}
