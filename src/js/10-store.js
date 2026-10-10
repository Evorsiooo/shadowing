/* ---------- storage: artifact database + file storage, or this browser (IndexedDB) ---------- */
const COLS = ['videos', 'clips', 'sessions', 'recordings', 'notes', 'issues', 'checkins', 'meta'];

const Caps = { db: null, assets: null, sample: null, downloads: null, inArtifact: false };

async function resolveCaps() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return;
  Caps.inArtifact = true;
  const get = (n) => c.use(n).catch(() => null);
  const [db, assets, sample, downloads] = await Promise.all([get('db'), get('assets'), get('sample'), get('downloads')]);
  Object.assign(Caps, { db, assets, sample, downloads });
}

/* IndexedDB: one store for documents, one for recording blobs */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open('shadowing-practice', 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs');
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
      };
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => rej(req.error);
    });
  },
  async tx(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error);
    });
  },
  async all(store) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readonly');
      const s = t.objectStore(store);
      const keys = s.getAllKeys();
      const vals = s.getAll();
      t.oncomplete = () => res(keys.result.map((k, i) => [k, vals.result[i]]));
      t.onerror = () => rej(t.error);
    });
  },
  put(store, key, val) { return this.tx(store, 'readwrite', (s) => s.put(val, key)); },
  del(store, key) { return this.tx(store, 'readwrite', (s) => s.delete(key)); },
  get(store, key) { return this.tx(store, 'readonly', (s) => s.get(key)); },
};

const Store = {
  mode: 'memory', // 'artifact' | 'local' | 'memory'
  blobMode: 'memory', // 'assets' | 'local' | 'memory'
  data: Object.fromEntries(COLS.map((c) => [c, {}])),
  timers: new Map(),
  chains: new Map(),
  memBlobs: new Map(),
  urlCache: new Map(),
  lastError: null,

  async init() {
    await resolveCaps();
    if (Caps.db) {
      try {
        await Promise.all(COLS.map(async (col) => {
          const snap = await Caps.db.collection(col).get();
          for (const d of snap.docs) this.data[col][d.id] = { ...d.data(), id: d.id };
        }));
        this.mode = 'artifact';
      } catch (e) {
        this.lastError = e;
        console.warn('artifact db unavailable', e);
      }
    }
    if (this.mode !== 'artifact') {
      try {
        const rows = await IDB.all('docs');
        for (const [key, val] of rows) {
          const [col, id] = String(key).split('/');
          if (this.data[col]) this.data[col][id] = val;
        }
        this.mode = 'local';
      } catch (e) {
        this.lastError = e;
        this.mode = 'memory';
      }
    }
    this.blobMode = Caps.assets && this.mode === 'artifact' ? 'assets' : this.mode === 'memory' ? 'memory' : 'local';
  },

  all(col) { return Object.values(this.data[col]); },
  get(col, id) { return id ? this.data[col][id] : undefined; },
  put(col, obj) {
    if (!obj.id) obj.id = uid();
    this.data[col][obj.id] = obj;
    this.schedule(col, obj.id);
    return obj;
  },
  patch(col, id, fields) {
    const cur = this.data[col][id];
    if (!cur) return;
    Object.assign(cur, fields);
    this.schedule(col, id);
    return cur;
  },
  /* coalesce a burst of edits into one write per document, one write at a time */
  schedule(col, id, delay = 400) {
    const key = `${col}/${id}`;
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.flushKey(key), delay));
  },
  flushKey(key) {
    this.timers.delete(key);
    const [col, id] = key.split('/');
    const prev = this.chains.get(key) || Promise.resolve();
    const next = prev.then(() => this.write(col, id)).catch((e) => this.onWriteError(e));
    this.chains.set(key, next);
    return next;
  },
  async flushAll() {
    const keys = [...this.timers.keys()];
    for (const k of keys) clearTimeout(this.timers.get(k));
    await Promise.all(keys.map((k) => this.flushKey(k)));
  },
  async write(col, id) {
    const doc = this.data[col][id];
    const body = doc ? JSON.parse(JSON.stringify(doc)) : null;
    if (this.mode === 'artifact') {
      const ref = Caps.db.collection(col).doc(id);
      if (body) { delete body.id; await ref.set(body); } else await ref.delete();
    } else if (this.mode === 'local') {
      if (body) await IDB.put('docs', `${col}/${id}`, body); else await IDB.del('docs', `${col}/${id}`);
    }
  },
  onWriteError(e) {
    console.error('save failed', e);
    const code = e && e.code;
    if (code === 'quota_exceeded') toast('Storage is full. Archive or remove old recordings in Settings → Data.', 'bad', 7000);
    else toast(`Couldn't save a change (${code || 'error'}). It is kept on screen; try again shortly.`, 'bad');
  },

  /* ---------- recordings & small files ---------- */
  async putBlob(blob) {
    if (this.blobMode === 'assets') {
      const type = /mp4|m4a|aac/.test(blob.type) ? 'video/mp4' : 'video/webm';
      try {
        const r = await Caps.assets.upload(blob, { type });
        this.urlCache.set(`asset:${r.id}`, r.url);
        return `asset:${r.id}`;
      } catch (e) {
        if (e && e.code === 'store_unavailable') {
          await sleep(800 + Math.random() * 600);
          const r = await Caps.assets.upload(blob, { type });
          return `asset:${r.id}`;
        }
        throw e;
      }
    }
    const id = uid();
    if (this.blobMode === 'local') {
      try { await IDB.put('blobs', id, blob); return `idb:${id}`; } catch (e) { console.warn(e); }
    }
    this.memBlobs.set(id, blob);
    return `mem:${id}`;
  },
  async blobUrl(ref) {
    if (!ref) return null;
    if (this.urlCache.has(ref)) return this.urlCache.get(ref);
    const [kind, id] = ref.split(':');
    let url = null;
    if (kind === 'asset') url = '/_blob/' + id;
    else {
      const b = await this.getBlob(ref);
      if (b) url = URL.createObjectURL(b);
    }
    if (url) this.urlCache.set(ref, url);
    return url;
  },
  async getBlob(ref) {
    if (!ref) return null;
    const [kind, id] = ref.split(':');
    if (kind === 'mem') return this.memBlobs.get(id) || null;
    if (kind === 'idb') { try { return (await IDB.get('blobs', id)) || null; } catch { return null; } }
    if (kind === 'asset') {
      const url = this.urlCache.get(ref) || '/_blob/' + id;
      const r = await fetch(url);
      if (!r.ok) return null;
      return r.blob();
    }
    return null;
  },
  async deleteBlob(ref) {
    if (!ref) return;
    const [kind, id] = ref.split(':');
    this.urlCache.delete(ref);
    if (kind === 'mem') this.memBlobs.delete(id);
    else if (kind === 'idb') await IDB.del('blobs', id).catch(() => {});
    else if (kind === 'asset' && Caps.assets) await Caps.assets.delete(id).catch(() => {});
  },

  /* ---------- backup ---------- */
  exportJSON() {
    return JSON.stringify({ app: 'shadowing-practice', version: 1, exportedAt: new Date().toISOString(), data: this.data }, null, 1);
  },
  async importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.app !== 'shadowing-practice' || !parsed.data) throw new Error('This file is not a Shadowing Practice backup.');
    let n = 0;
    for (const col of COLS) {
      for (const [id, doc] of Object.entries(parsed.data[col] || {})) {
        if (!this.data[col][id]) { this.data[col][id] = { ...doc, id }; this.schedule(col, id, 50 + n * 5); n++; }
      }
    }
    return n;
  },
};

/* ---------- settings ---------- */
const DEFAULT_SETTINGS = {
  clipMin: 10, clipMax: 20,
  listenPasses: 3, listenMinutes: 2,
  shadowPasses: 15, shadowMinutes: 7,
  recordMinutes: 2,
  againPasses: 8, againMinutes: 4,
  badListenPasses: 3, badShadowPasses: 5, badMinutes: 5,
  loopGap: 1.0,
  weeklyTarget: 6,
  shortenHintAfter: 5,
  alignMode: 'auto', // 'auto' | 'manual'
  manualOffsetMs: 250,
  latencyMs: 0,
  livePitchAllPasses: false,
  review: false, reviewAfterDays: 2, reviewShadowPasses: 5,
  keepAllPassRecordings: false,
  echoCancellation: false, noiseSuppression: false,
  pitchSmoothing: 5,
  programmeStart: null,
  defaultView: 'pitch',
};
function settings() {
  const s = Store.get('meta', 'settings');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
function saveSettings(fields) {
  const cur = Store.get('meta', 'settings') || { id: 'settings' };
  Store.put('meta', { ...cur, ...fields, id: 'settings' });
}
function appMeta() { return Store.get('meta', 'app') || Store.put('meta', { id: 'app', created: dayKey(), usedQuestions: [] }); }
