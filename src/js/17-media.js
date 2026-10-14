/* ---------- media files: videos and recordings, on this device with optional Google Drive sync ----------
   Every file the app keeps is a "media" document ({ name, type, size, kind, providers }) and is
   referred to as "media:<id>". The bytes live:
   - on this device, in the browser's own storage (OPFS, or IndexedDB where OPFS can't write);
   - optionally in a cloud provider, recorded in providers: { gdrive: '<Drive file id>' }.
   A device that lacks a file downloads it once from the provider and plays the local copy.
   Dropbox or OneDrive can be added later as another provider with the same four calls
   (upload, download, remove, connected). The server never sees the files. */

/* the browser's own storage on this device */
const DeviceFiles = {
  dirP: null,
  async dir() {
    if (!this.dirP) {
      this.dirP = (async () => {
        if (!navigator.storage || !navigator.storage.getDirectory) return null;
        try {
          const root = await navigator.storage.getDirectory();
          const d = await root.getDirectoryHandle('media', { create: true });
          // some browsers can read OPFS but only write it from a worker; then use IndexedDB instead
          const probe = await d.getFileHandle('.probe', { create: true });
          if (typeof probe.createWritable !== 'function') return null;
          return d;
        } catch { return null; }
      })();
    }
    return this.dirP;
  },
  /* save a Blob or a ReadableStream of bytes under id; onProgress(bytesWritten) */
  async put(id, src, onProgress) {
    const d = await this.dir();
    if (d) {
      const fh = await d.getFileHandle(id, { create: true });
      const w = await fh.createWritable();
      let n = 0;
      const stream = src instanceof Blob ? src.stream() : src;
      try {
        await stream.pipeThrough(new TransformStream({ transform(chunk, ctl) { n += chunk.byteLength; onProgress && onProgress(n); ctl.enqueue(chunk); } })).pipeTo(w);
      } catch (e) {
        await d.removeEntry(id).catch(() => {});
        throw e;
      }
      return;
    }
    const blob = src instanceof Blob ? src : await new Response(src).blob();
    await IDB.put('blobs', `media/${id}`, blob);
    onProgress && onProgress(blob.size);
  },
  async get(id) {
    const d = await this.dir();
    if (d) {
      // a file still being written reads as empty until it's closed
      try { const f = await (await d.getFileHandle(id)).getFile(); if (f.size) return f; } catch { /* not here; try IndexedDB */ }
    }
    try { return (await IDB.get('blobs', `media/${id}`)) || null; } catch { return null; }
  },
  async has(id) {
    const d = await this.dir();
    if (d) { try { if ((await (await d.getFileHandle(id)).getFile()).size) return true; } catch { /* fall through */ } }
    try { return !!(await IDB.get('blobs', `media/${id}`)); } catch { return false; }
  },
  async del(id) {
    const d = await this.dir();
    if (d) await d.removeEntry(id).catch(() => {});
    await IDB.del('blobs', `media/${id}`).catch(() => {});
  },
  /* ask the browser not to clear these files when the device runs low on space */
  async persist() {
    try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
  },
  async persisted() {
    try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch { return false; }
  },
  async estimate() {
    try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
  },
};

/* Google Drive, straight from the browser with a short-lived token from the server.
   Scope drive.file: the app only sees files it created itself. */
const Drive = {
  id: 'gdrive',
  name: 'Google Drive',
  FOLDER: 'Euno Shadowing',
  status: { connected: false },
  available: false,
  tok: null,
  exp: 0,
  connected() { return Store.mode === 'cloud' && !!this.status.connected; },
  async refreshStatus() {
    if (Store.mode !== 'cloud') return this.status;
    try { this.status = await Api.req('GET', '/api/drive'); } catch { /* keep the last known status */ }
    Bus.emit('sync');
    return this.status;
  },
  async token(force) {
    if (!force && this.tok && Date.now() < this.exp - 120_000) return this.tok;
    try {
      const r = await Api.req('POST', '/api/drive/token');
      this.tok = r.accessToken; this.exp = r.expiresAt;
      return this.tok;
    } catch (e) {
      if (e.status === 409) { this.status = { connected: false }; Bus.emit('sync'); }
      throw e;
    }
  },
  async call(method, url, { body, headers = {}, json = true } = {}) {
    for (let attempt = 0; ; attempt++) {
      const tok = await this.token(attempt > 0);
      let r;
      try { r = await fetch(url, { method, body, headers: { authorization: `Bearer ${tok}`, ...headers } }); } catch {
        throw Object.assign(new Error('Google Drive couldn’t be reached. Check your connection.'), { code: 'network' });
      }
      if (r.status === 401 && attempt === 0) continue;
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw Object.assign(new Error(`Google Drive: ${(d.error && d.error.message) || `error ${r.status}`}`), { status: r.status });
      }
      return json ? r.json() : r;
    }
  },
  /* the app's folder; its id is kept in the synced meta/storage doc so every device uses the same one */
  async folder() {
    const meta = Store.get('meta', 'storage') || {};
    if (meta.driveFolder) {
      try {
        const f = await this.call('GET', `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.driveFolder)}?fields=id,trashed`);
        if (!f.trashed) return f.id;
      } catch (e) { if (e.status !== 404) throw e; }
    }
    const q = encodeURIComponent(`name = '${this.FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const found = await this.call('GET', `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`);
    const id = found.files && found.files[0] ? found.files[0].id
      : (await this.call('POST', 'https://www.googleapis.com/drive/v3/files?fields=id', {
        body: JSON.stringify({ name: this.FOLDER, mimeType: 'application/vnd.google-apps.folder', description: 'Videos and recordings from Euno Shadowing (shadowing.euno.cc).' }),
        headers: { 'content-type': 'application/json' },
      })).id;
    Store.put('meta', { ...(Store.get('meta', 'storage') || {}), id: 'storage', driveFolder: id });
    return id;
  },
  /* resumable upload in 8 MB pieces, so a dropped connection only repeats one piece */
  async upload(blob, doc, onProgress) {
    const folder = await this.folder();
    const meta = { name: doc.name || `${doc.kind || 'file'}-${doc.id}`, parents: [folder], appProperties: { euno: '1', mediaId: doc.id, kind: doc.kind || '' } };
    const type = blob.type || doc.type || 'application/octet-stream';
    const start = await this.call('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      body: JSON.stringify(meta), json: false,
      headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': type, 'x-upload-content-length': String(blob.size) },
    });
    const session = start.headers.get('location');
    if (!session) throw new Error('Google Drive didn’t start the upload.');
    const PIECE = 8 * 1024 * 1024;
    let off = 0;
    if (!blob.size) {
      const r = await fetch(session, { method: 'PUT', body: blob });
      if (!r.ok) throw new Error(`Google Drive: upload failed (${r.status}).`);
      return (await r.json()).id;
    }
    for (let tries = 0; ;) {
      const end = Math.min(blob.size, off + PIECE);
      let r;
      try {
        r = await fetch(session, { method: 'PUT', body: blob.slice(off, end), headers: { 'content-range': `bytes ${off}-${end - 1}/${blob.size}` } });
      } catch { r = null; }
      if (r && (r.status === 200 || r.status === 201)) { onProgress && onProgress(1); return (await r.json()).id; }
      if (r && r.status === 308) {
        const range = r.headers.get('range');
        off = range ? Number(range.split('-')[1]) + 1 : 0;
        tries = 0;
        onProgress && onProgress(off / blob.size);
        continue;
      }
      if (r && r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) throw new Error(`Google Drive: upload failed (${r.status}).`);
      if (++tries > 4) throw new Error('The upload to Google Drive kept failing. It will try again later.');
      await sleep(1000 * 2 ** tries);
      // ask where the upload got to
      try {
        const q = await fetch(session, { method: 'PUT', headers: { 'content-range': `bytes */${blob.size}` } });
        if (q.status === 200 || q.status === 201) return (await q.json()).id;
        if (q.status === 308) { const range = q.headers.get('range'); off = range ? Number(range.split('-')[1]) + 1 : 0; }
      } catch { /* try the piece again */ }
    }
  },
  /* a Response whose body streams the file */
  async download(fileId) {
    return this.call('GET', `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { json: false });
  },
  async remove(fileId) {
    try { await this.call('DELETE', `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { json: false }); } catch (e) { if (e.status !== 404) throw e; }
  },
  /* connect: a Google consent screen in a small window, so whatever you were doing stays open */
  connect() {
    if (Store.mode !== 'cloud') { toast('Sign in first to connect Google Drive.', 'bad'); return Promise.resolve(false); }
    if (!this.available) { toast('Google Drive sync isn’t switched on for this site yet.', 'bad', 6000); return Promise.resolve(false); }
    const w = window.open('/auth/drive?next=/auth/drive/done', 'euno-drive', 'popup,width=520,height=680');
    if (!w) { Store.flushAll().then(() => { location.href = `/auth/drive?next=${encodeURIComponent(location.pathname)}`; }); return Promise.resolve(false); }
    // Some browsers report the window as closed while it's on Google's pages, so coming back
    // to this window also checks (for a while), not just the window closing.
    return new Promise((res) => {
      let settled = false;
      const stop = () => { clearInterval(t); window.removeEventListener('focus', check); };
      const check = async () => {
        if (settled === 'connected') return;
        await this.refreshStatus();
        if (!this.connected()) return;
        stop();
        if (settled !== true) res(true);
        settled = 'connected';
        toast(`Google Drive connected${this.status.email ? ` (${this.status.email})` : ''}. Your files will sync to it.`, 'good', 5000);
        Sync.kick(500);
      };
      window.addEventListener('focus', check);
      const t = setInterval(async () => {
        if (!w.closed) return;
        clearInterval(t);
        await check();
        if (!settled) { settled = true; res(false); }
      }, 700);
      setTimeout(stop, 10 * 60_000);
    });
  },
  async disconnect() {
    await Api.req('DELETE', '/api/drive');
    this.tok = null; this.exp = 0;
    this.status = { connected: false };
    Bus.emit('sync');
  },
};

/* the providers files can sync to; Dropbox and OneDrive slot in here later */
const PROVIDERS = [Drive];

const Media = {
  doc(id) { return Store.get('media', id); },
  idOf(ref) { return typeof ref === 'string' && ref.startsWith('media:') ? ref.slice(6) : null; },
  /* keep a new file (a Blob, or a ReadableStream with meta.size/meta.type): on this device now,
     and in Drive when sync is on */
  async add(src, { kind = 'rec', name = '', type = '', size = 0 } = {}, onProgress) {
    const id = uid();
    const isBlob = src instanceof Blob;
    const total = isBlob ? src.size : size;
    await DeviceFiles.put(id, src, onProgress && ((n) => onProgress(total ? Math.min(1, n / total) : 0)));
    const saved = isBlob ? src : await DeviceFiles.get(id);
    Store.put('media', { id, name: name || (isBlob && src.name) || `${kind}-${id}`, type: ((isBlob ? src.type : type) || '').split(';')[0], size: saved ? saved.size : total, kind, created: new Date().toISOString(), providers: {} });
    if (!lsGet('persistAsked', false)) { lsSet('persistAsked', true); DeviceFiles.persist(); }
    Sync.kick();
    return `media:${id}`;
  },
  /* put a file back on this device under its existing id (it was missing here) */
  async restore(id, blob, onProgress) {
    await DeviceFiles.put(id, blob, onProgress && ((n) => onProgress(blob.size ? n / blob.size : 1)));
    const d = this.doc(id);
    if (d) Store.patch('media', id, { size: blob.size, type: d.type || (blob.type || '').split(';')[0] });
    this.missing.delete(id);
    Sync.kick();
  },
  pending: new Map(), // id -> promise of a download in progress
  missing: new Set(),
  /* the file as a Blob/File on this device, downloading it once from a provider if needed */
  async file(id, onProgress) {
    const local = await DeviceFiles.get(id);
    if (local) return local;
    const d = this.doc(id);
    if (!d) return null;
    const p = PROVIDERS.find((x) => d.providers && d.providers[x.id] && x.connected());
    if (!p) { this.missing.add(id); return null; }
    if (!this.pending.has(id)) {
      const job = (async () => {
        const r = await p.download(d.providers[p.id]);
        const total = Number(r.headers.get('content-length')) || d.size || 0;
        await DeviceFiles.put(id, r.body, (n) => onProgress && total && onProgress(n / total));
        return DeviceFiles.get(id);
      })();
      this.pending.set(id, job);
      job.finally(() => this.pending.delete(id));
    }
    try { return await this.pending.get(id); } catch (e) {
      console.warn('download failed', e);
      if (e.status === 404) { Store.patch('media', id, { providers: { ...d.providers, [p.id]: undefined } }); this.missing.add(id); return null; }
      throw e;
    }
  },
  /* delete everywhere: this device, the providers, and the document */
  async remove(id) {
    const d = this.doc(id);
    await DeviceFiles.del(id);
    if (d && d.providers) {
      for (const p of PROVIDERS) if (d.providers[p.id] && p.connected()) await p.remove(d.providers[p.id]).catch((e) => console.warn('remote delete failed', e));
    }
    if (d) { delete Store.data.media[id]; Store.schedule('media', id, 50); }
  },
  /* free space here: drop device copies of files that are safely in a provider */
  async evictSynced() {
    let n = 0, bytes = 0;
    for (const d of Store.all('media')) {
      if (!PROVIDERS.some((p) => d.providers && d.providers[p.id])) continue;
      if (!(await DeviceFiles.has(d.id))) continue;
      await DeviceFiles.del(d.id); n++; bytes += d.size || 0;
    }
    for (const u of LocalFiles.urls.values()) URL.revokeObjectURL(u);
    LocalFiles.map.clear(); LocalFiles.urls.clear();
    return { n, bytes };
  },
};

/* uploads files that aren't in Drive yet, one at a time, in the background */
const Sync = {
  running: false,
  state: { total: 0, done: 0, current: null, progress: 0, error: null },
  timer: null,
  kick(delay = 1500) {
    if (!Drive.connected()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), delay);
  },
  todo() { return Store.all('media').filter((d) => !(d.providers && d.providers.gdrive)); },
  async run() {
    if (this.running || !Drive.connected()) return;
    this.running = true;
    const list = this.todo();
    this.state = { total: list.length, done: 0, current: null, progress: 0, error: null };
    Bus.emit('sync');
    try {
      for (const d of list) {
        const blob = await DeviceFiles.get(d.id);
        if (!blob) { this.state.done++; continue; } // not on this device; the device that has it uploads it
        this.state.current = d.name; this.state.currentId = d.id; this.state.progress = 0;
        Bus.emit('sync');
        const fileId = await Drive.upload(blob, d, (f) => { this.state.progress = f; Bus.emit('sync'); });
        const cur = Store.get('media', d.id);
        if (cur) Store.patch('media', d.id, { providers: { ...(cur.providers || {}), gdrive: fileId } });
        else await Drive.remove(fileId).catch(() => {}); // deleted while uploading
        this.state.done++;
        Bus.emit('sync');
      }
    } catch (e) {
      console.warn('sync stopped', e);
      this.state.error = e.message;
      if (!this.warned) { this.warned = true; toast(`Google Drive sync paused: ${e.message}`, 'bad', 7000); }
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), 60_000);
    } finally {
      this.running = false;
      this.state.current = null;
      Bus.emit('sync');
    }
  },
};

/* a video's stored file, found on this device or fetched from Drive, handed to the player */
async function attachVideoFile(vid) {
  const id = Media.idOf(vid.fileRef);
  if (!id || LocalFiles.get(vid.id)) return true;
  const el = $('#playerError');
  const d = Media.doc(id);
  let shown = false;
  const show = (f) => {
    shown = true;
    mount(el, h('h3', null, 'Getting your video ready'), h('p', null, `Downloading “${vid.title}” from your Google Drive to this device${d && d.size ? ` (${(d.size / 1048576).toFixed(0)} MB)` : ''}. It only happens once on each device.`),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(f * 100)}%` } })));
    el.hidden = false;
  };
  try {
    const file = await Media.file(id, (f) => { if (Player.current() && Player.current().id === vid.id) show(f); });
    if (!file) { if (Player.current() && Player.current().id === vid.id) showMissingVideo(vid); return false; }
    LocalFiles.set(vid.id, file);
    if (Player.current() && Player.current().id === vid.id) {
      if (shown) Player.hideError();
      Player.reloadSrc();
      ensureModels(vid);
      loadSelAudio();
    }
    return true;
  } catch (e) {
    if (Player.current() && Player.current().id === vid.id) {
      mount(el, h('h3', null, 'This video didn’t download'), h('p', null, e.message), h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Try again', () => attachVideoFile(vid), { kind: 'primary' })));
      el.hidden = false;
    }
    return false;
  }
}

function showMissingVideo(vid) {
  const el = $('#playerError');
  const id = Media.idOf(vid.fileRef);
  const d = Media.doc(id);
  const inDrive = d && d.providers && d.providers.gdrive;
  mount(el,
    h('h3', null, 'This video isn’t on this device'),
    h('p', null, inDrive
      ? `“${(d && d.name) || vid.title}” is in your Google Drive, but Drive isn’t connected here. Connect it to download the video, or pick the same file from this device.`
      : `“${(d && d.name) || vid.title}” was added on another device and isn’t synced. Pick the same file from this device to keep practising here${Store.mode === 'cloud' ? ', and turn on Google Drive sync in Settings → Storage so your devices share files' : ''}.`),
    h('div', { class: 'row', style: { justifyContent: 'center' } },
      inDrive && Store.mode === 'cloud' ? btn('Connect Google Drive', async () => { if (await Drive.connect()) attachVideoFile(vid); }, { kind: 'primary' }) : null,
      filePickButton('Re-add the file', 'video/*,audio/*', async (f) => {
        toast('Saving the file on this device…');
        try { await Media.restore(id, f); Player.hideError(); attachVideoFile(vid); } catch (e) { toast(`The file couldn’t be saved (${e.message || e.name}).`, 'bad', 7000); }
      }, { kind: inDrive ? '' : 'primary', icon: 'folder' })));
  el.hidden = false;
}

/* Files kept in the old server storage (R2) before storage moved to Drive. The server copies each
   one straight into the user's Drive (a big video never passes through the browser), then the app
   points its videos and recordings at the Drive copy. The server copy is deleted only when asked. */
const LegacyFiles = {
  /* every place a server file is referenced: [{ key, col, id, path }] */
  refs() {
    const out = [];
    const walk = (col, id, v, path) => {
      if (typeof v === 'string') { if (v.startsWith('r2:')) out.push({ key: v.slice(3), col, id, path }); return; }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(col, id, x, [...path, k]);
    };
    for (const col of COLS) {
      if (col === 'media') continue;
      for (const doc of Store.all(col)) {
        if (col === 'videos' && doc.r2Key) out.push({ key: doc.r2Key, col, id: doc.id, path: null });
        walk(col, doc.id, doc, []);
      }
    }
    return out;
  },
  count() { return new Set(this.refs().map((r) => r.key)).size; },
  /* onProgress(done, total) */
  async move(onProgress) {
    if (!Drive.connected()) throw new Error('Connect Google Drive first.');
    const refs = this.refs();
    const keys = [...new Set(refs.map((r) => r.key))];
    const folderId = await Drive.folder();
    let done = 0;
    for (const key of keys) {
      onProgress && onProgress(done, keys.length);
      // a file already copied on an earlier, interrupted run is reused
      let d = Store.all('media').find((m) => m.legacyKey === key && m.providers && m.providers.gdrive);
      if (!d) {
        const kind = key.split('/').slice(-2, -1)[0] || 'misc';
        const video = refs.find((x) => x.key === key && x.col === 'videos');
        const name = video ? `${(Store.get('videos', video.id) || {}).title || 'video'}.${key.split('.').pop()}` : key.split('/').pop();
        const id = uid();
        const r = await Api.req('POST', '/api/drive/copy-old', { key, name, folderId, mediaId: id, kind });
        d = Store.put('media', { id, name, type: r.type, size: r.size, kind, created: new Date().toISOString(), providers: { gdrive: r.fileId }, legacyKey: key });
        await Store.flushAll();
      }
      const ref = `media:${d.id}`;
      for (const x of refs.filter((y) => y.key === key)) {
        const doc = Store.get(x.col, x.id);
        if (!doc) continue;
        if (!x.path) { Store.patch(x.col, x.id, { fileRef: ref, r2Key: null, legacyR2Key: key }); continue; }
        let o = doc;
        for (const p of x.path.slice(0, -1)) o = o[p];
        o[x.path[x.path.length - 1]] = ref;
        Store.schedule(x.col, x.id);
      }
      done++;
    }
    onProgress && onProgress(done, keys.length);
    await Store.flushAll();
    return keys.length;
  },
  /* server copies whose replacement is in Drive: safe to delete */
  deletable() { return Store.all('media').filter((d) => d.legacyKey && d.providers && d.providers.gdrive); },
  async deleteServerCopies() {
    let n = 0;
    for (const d of this.deletable()) {
      await Api.req('DELETE', '/api/files/' + d.legacyKey).catch((e) => { if (e.status !== 404) throw e; });
      Store.patch('media', d.id, { legacyKey: null });
      n++;
    }
    return n;
  },
};

/* ---------- where files live: Google Drive by default; "only this browser" is an opt-in ---------- */
function storagePrefs() { return Store.get('meta', 'storage') || {}; }
function deviceOnly() { return !!storagePrefs().deviceOnly; }
function setDeviceOnly(on) {
  Store.put('meta', { ...storagePrefs(), id: 'storage', deviceOnly: !!on });
  if (on) DeviceFiles.persist(); // the browser may say no; that's fine
  Bus.emit('sync');
}

/* where one file is, in a few words: for the library and Settings → Storage */
function mediaStatus(ref) {
  const id = Media.idOf(ref);
  const d = id && Media.doc(id);
  if (!d) return null;
  if (d.providers && d.providers.gdrive) return 'in Drive';
  if (Sync.running && Sync.state.currentId === id) return `uploading ${Math.round(Sync.state.progress * 100)}%`;
  if (Drive.connected()) return 'waiting to upload';
  return 'this browser only';
}

function storageCounts() {
  const all = Store.all('media');
  const inDrive = (k) => all.filter((d) => (k ? d.kind === k : true) && d.providers && d.providers.gdrive).length;
  const total = (k) => all.filter((d) => (k ? d.kind === k : true)).length;
  return { all: all.length, inDrive: inDrive(), videos: [inDrive('video'), total('video')], recs: [all.filter((d) => d.kind !== 'video' && d.providers && d.providers.gdrive).length, all.filter((d) => d.kind !== 'video').length] };
}

function driveSummary() {
  if (Store.mode !== 'cloud') return 'Sign in to keep your files in Google Drive.';
  if (!Drive.connected()) return 'Not connected.';
  const c = storageCounts();
  const s = Sync.state;
  return `Connected${Drive.status.email ? ` as ${Drive.status.email}` : ''}. Videos: ${c.videos[0]} of ${c.videos[1]} in Drive. Recordings: ${c.recs[0]} of ${c.recs[1]} in Drive.${Sync.running && s.current ? ` Uploading “${s.current}” (${Math.round(s.progress * 100)}%).` : ''}${s.error && !Sync.running ? ` Paused: ${s.error}` : ''}`;
}

/* onboarding: connect Drive (recommended), or carry on and decide later */
function storageStepBody() {
  const wrap = h('div', { class: 'stack' });
  const draw = () => {
    storageView.redraw = () => { if (wrap.isConnected) draw(); };
    const on = Drive.connected();
    mount(wrap,
      h('div', { class: 'card' }, h('h3', null, 'Google Drive (recommended)'),
        h('p', { class: 'small muted' }, 'Your videos and recordings go into a “Euno Shadowing” folder in your own Drive, so they’re safe and on every device you sign in on. The app can only see files it puts there, and our server never stores them.'),
        on ? h('p', { class: 'small' }, icon('check'), ` Connected${Drive.status.email ? ` as ${Drive.status.email}` : ''}.`)
          : Store.mode === 'cloud' ? h('div', { class: 'row' }, btn('Connect Google Drive', async () => { await Drive.connect(); draw(); }, { kind: 'primary' })) : null),
      h('p', { class: 'small muted' }, on ? 'You can disconnect it any time in Settings → Storage.' : 'Not now? Press Continue. You can connect Google Drive later in Settings → Storage. Until then, files stay in this browser only.'));
  };
  draw();
  return wrap;
}

function storageView() {
  const root = h('div', { class: 'stack' });
  const draw = async () => {
    const all = Store.all('media');
    const here = (await Promise.all(all.map((d) => DeviceFiles.has(d.id)))).filter(Boolean).length;
    const legacy = Store.mode === 'cloud' ? LegacyFiles.count() : 0;
    const deletable = Store.mode === 'cloud' ? LegacyFiles.deletable() : [];
    const pending = Drive.connected() ? all.filter((d) => !(d.providers && d.providers.gdrive)) : [];
    const mb = (b) => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0)} MB`;
    const cached = all.filter((d) => d.providers && d.providers.gdrive);
    const status = h('p', { class: 'small muted', role: 'status' });
    const cloud = Store.mode === 'cloud';
    mount(root,
      h('div', { class: 'card' }, h('h3', null, 'Google Drive'),
        h('p', null, driveSummary()),
        h('p', { class: 'small muted' }, 'Your videos and recordings live in a “Euno Shadowing” folder in your own Drive, so they’re on every device you sign in on. The app can only see files it puts there, and our server never stores them. Dropbox and OneDrive are coming later.'),
        pending.length ? h('details', null, h('summary', null, `${pending.length} file${pending.length === 1 ? '' : 's'} not in Drive yet`),
          h('ul', { class: 'small', style: { margin: '6px 0 0', paddingLeft: '20px' } }, pending.slice(0, 30).map((d) => h('li', null, `${d.name} (${mediaStatus(`media:${d.id}`)})`))),
          h('p', { class: 'small muted' }, 'A file added on another device uploads from that device.')) : null,
        !cloud ? null : Drive.connected()
          ? h('div', { class: 'row' },
            pending.length ? btn('Upload now', () => { Sync.warned = false; Sync.kick(0); }, { size: 'sm', icon: 'upload' }) : null,
            btn('Disconnect', async () => {
              if (!confirm('Disconnect Google Drive? Files already in your Drive stay there. New files will only be kept in this browser.')) return;
              try { await Drive.disconnect(); toast('Google Drive disconnected.'); } catch (e) { toast(e.message, 'bad'); }
              draw();
            }, { size: 'sm', kind: 'ghost' }))
          : h('div', { class: 'row' }, btn('Connect Google Drive', async () => { await Drive.connect(); draw(); }, { kind: 'primary', size: 'sm' }))),
      legacy || deletable.length ? h('div', { class: 'card' }, h('h3', null, 'Files in the old server storage'),
        legacy ? [
          h('p', null, `${legacy} file${legacy === 1 ? ' is' : 's are'} still in the server storage the app used before. Server storage is going away, so move ${legacy === 1 ? 'it' : 'them'} into your Google Drive. The server copies stay until you delete them.`),
          Drive.connected()
            ? h('div', { class: 'row' }, btn(`Move ${legacy} file${legacy === 1 ? '' : 's'} to Drive`, async (e) => {
              e.currentTarget.disabled = true;
              try {
                const n = await LegacyFiles.move((d, t) => { status.textContent = d < t ? `Copying file ${d + 1} of ${t} to your Drive… keep this page open.` : `Copied ${t} file${t === 1 ? '' : 's'}.`; });
                toast(`Moved ${n} file${n === 1 ? '' : 's'} to your Google Drive.`, 'good', 6000);
                if (!Session.active) Player.load(UI.videoId, { keepClip: true });
              } catch (err) { status.textContent = ''; toast(`${err.message} Press Move again to carry on where it stopped.`, 'bad', 9000); }
              draw();
            }, { kind: 'primary', size: 'sm' }))
            : h('p', { class: 'small muted' }, 'Connect Google Drive above first.'),
          status] : null,
        deletable.length ? [
          h('p', null, `${deletable.length} file${deletable.length === 1 ? ' is' : 's are'} safely in your Google Drive now, so the server copies can be deleted.`),
          h('div', { class: 'row' }, btn('Delete the server copies', async () => {
            if (!confirm(`Delete ${deletable.length} file${deletable.length === 1 ? '' : 's'} from the server? The copies in your Google Drive stay.`)) return;
            try { const n = await LegacyFiles.deleteServerCopies(); toast(`Deleted ${n} server cop${n === 1 ? 'y' : 'ies'}.`, 'good'); } catch (err) { toast(err.message, 'bad', 7000); }
            draw();
          }, { size: 'sm', kind: 'danger' }))] : null) : null,
      h('details', { class: 'card' }, h('summary', null, h('strong', null, 'This browser')),
        h('p', { class: 'small muted' }, `Files you open are kept in this browser so they play instantly and work offline: ${here} of ${all.length} right now.${Drive.connected() ? ' If the browser clears them, they download again from Drive.' : ''}`),
        Drive.connected() && cached.length && here ? h('div', { class: 'row' }, btn('Free up space', async () => { const r = await Media.evictSynced(); toast(`Removed ${r.n} file${r.n === 1 ? '' : 's'} (${mb(r.bytes)}) from this browser. They’re still in your Drive.`, 'good'); if (!Session.active) Player.load(UI.videoId, { keepClip: true }); draw(); }, { size: 'sm' })) : null,
        !Drive.connected() ? h('label', { class: 'check', for: 'stDeviceOnly' },
          h('input', { type: 'checkbox', id: 'stDeviceOnly', checked: deviceOnly(), onchange: (e) => { setDeviceOnly(e.target.checked); draw(); } }),
          'Keep files only in this browser, without Google Drive') : null,
        !Drive.connected() && deviceOnly() ? h('p', { class: 'small muted' }, 'Files are only on this device, and the browser can clear them if the device runs very low on space. Export a backup from Settings → Data now and then, and keep your original video files.') : null));
  };
  draw();
  storageView.redraw = () => { if (root.isConnected) draw(); };
  return root;
}

/* after Store.init(): Drive status, background sync, and redrawing Settings → Storage as uploads progress */
function initMedia() {
  Drive.status = Api.drive || { connected: false };
  Drive.available = !!Api.driveAvailable;
  let queued = false;
  Bus.on('sync', () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      if (storageView.redraw) storageView.redraw();
      if (!UI.addOpen && !UI.editVideoId) renderSidebar(); // "in Drive" / "uploading" on each video
    }, 400);
  });
  handleDriveReturn();
  Sync.kick(4000);
}

/* coming back from connecting Drive without the small window (pop-ups blocked) */
function handleDriveReturn() {
  const q = new URLSearchParams(location.search);
  const r = q.get('drive');
  if (!r) return;
  if (r === 'connected') { toast('Google Drive connected. Your files will sync to it.', 'good', 5000); Sync.kick(); }
  else if (r === 'cancelled') toast('Google Drive wasn’t connected. You can connect it any time in Settings → Storage.', '', 6000);
  else toast(q.get('reason') || 'Google Drive couldn’t be connected.', 'bad', 8000);
  q.delete('drive'); q.delete('reason');
  history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
}
