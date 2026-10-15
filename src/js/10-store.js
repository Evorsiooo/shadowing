/* ---------- storage: artifact database + file storage, or this browser (IndexedDB) ---------- */
const COLS = ['videos', 'clips', 'sessions', 'recordings', 'notes', 'issues', 'checkins', 'meta', 'media'];

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

/* The startup requests the page already sent while this script downloaded (window.EARLY, in
   index.html), keyed by path. Each is used once; null when there's none or it failed to send. */
function takeEarly(path) {
  const e = window.EARLY, p = e && e[path];
  if (!p) return null;
  e[path] = null;
  return p;
}

/* Google sign-in, coming back to this page afterwards */
function signIn() { location.href = `/auth/google?next=${encodeURIComponent(location.pathname + location.search)}`; }

/* ---------- cloud backend (Cloudflare Pages Functions: D1 + the user's own AI key; files stay on the device or in Drive) ---------- */
const Api = {
  on: false,
  email: null,
  role: null,
  ai: null, // {provider, providerName, model} when the user has saved an AI key
  signedOut: false,
  problem: null,
  async req(method, path, body, { raw = false, headers = {} } = {}) {
    let resp;
    try {
      const early = method === 'GET' && body == null ? takeEarly(path) : null;
      resp = (early && (await early)) || await fetch(path, {
        method, credentials: 'same-origin', redirect: 'manual',
        // x-euno-lang: the server answers its messages in the interface language
        headers: body != null && !raw ? { 'content-type': 'application/json', 'x-euno-lang': LANG, ...headers } : { 'x-euno-lang': LANG, ...headers },
        body: body == null ? undefined : raw ? body : JSON.stringify(body),
      });
    } catch (e) {
      throw Object.assign(new Error(t('The server couldn’t be reached. Check your connection.')), { code: 'network' });
    }
    if (resp.type === 'opaqueredirect' || resp.status === 401) {
      this.signedOut = true;
      Bus.emit('signedout');
      throw Object.assign(new Error(t('You’re signed out. Sign in again to keep saving.')), { code: 'signedout' });
    }
    const ct = resp.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await resp.json().catch(() => ({})) : null;
    if (!resp.ok) throw Object.assign(new Error((data && data.error) || t('Server error {status}', { status: resp.status })), { code: `http_${resp.status}`, status: resp.status });
    return data;
  },
  async probe() {
    if (location.protocol === 'file:') return false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const early = takeEarly('/api/health');
      const r = (early && (await Promise.race([early, new Promise((res) => { ctl.signal.addEventListener('abort', () => res(null)); })])))
        || await fetch('/api/health', { credentials: 'same-origin', redirect: 'manual', signal: ctl.signal });
      if (r.type === 'opaqueredirect' || r.status === 401) { this.signedOut = true; return false; }
      if (!(r.headers.get('content-type') || '').includes('application/json')) return false;
      const d = await r.json();
      if (!r.ok) { this.problem = d.error || t('Server error {status}', { status: r.status }); return false; }
      this.on = true; this.email = d.email; this.name = d.name || null; this.role = d.role || null; this.ai = d.ai || null;
      this.drive = d.drive || { connected: false }; this.driveAvailable = !!d.driveAvailable;
      return true;
    } catch { return false; } finally { clearTimeout(timer); }
  },
};

const Store = {
  mode: 'memory', // 'cloud' | 'artifact' | 'local' | 'memory'
  blobMode: 'memory', // 'device' (17-media.js) | 'assets' | 'memory'
  data: Object.fromEntries(COLS.map((c) => [c, {}])),
  timers: new Map(),
  chains: new Map(),
  memBlobs: new Map(),
  urlCache: new Map(),
  lastError: null,

  async init() {
    await resolveCaps();
    if (!Caps.inArtifact && (await Api.probe())) {
      try {
        const { data } = await Api.req('GET', '/api/docs');
        for (const col of COLS) Object.assign(this.data[col], data[col] || {});
        this.mode = 'cloud';
        this.blobMode = 'device';
        return;
      } catch (e) { this.lastError = e; Api.problem = e.message; }
    }
    if (Api.signedOut || Api.problem) { this.mode = 'offline'; this.blobMode = 'memory'; return; }
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
    this.blobMode = Caps.assets && this.mode === 'artifact' ? 'assets' : this.mode === 'local' ? 'device' : 'memory';
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
    const next = prev.then(() => this.write(col, id)).then(() => { this.failed = 0; }).catch((e) => this.onWriteError(e, key));
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
    if (this.mode === 'cloud') {
      const path = `/api/docs/${col}/${encodeURIComponent(id)}`;
      if (body) { delete body.id; await Api.req('PUT', path, body); } else await Api.req('DELETE', path);
    } else if (this.mode === 'artifact') {
      const ref = Caps.db.collection(col).doc(id);
      if (body) { delete body.id; await ref.set(body); } else await ref.delete();
    } else if (this.mode === 'local') {
      if (body) await IDB.put('docs', `${col}/${id}`, body); else await IDB.del('docs', `${col}/${id}`);
    }
  },
  onWriteError(e, key) {
    console.error('save failed', e);
    const code = e && e.code;
    if (code === 'signedout') return; // the sign-in banner explains it; nothing is lost on screen
    if (this.mode === 'cloud' && key && (code === 'network' || (e.status && e.status >= 500))) {
      // keep retrying quietly; the change is still on screen
      this.failed = (this.failed || 0) + 1;
      if (this.failed <= 3 || this.failed % 10 === 0) toast(t('Couldn’t save to the server. Retrying…'), 'bad');
      setTimeout(() => this.schedule(...key.split('/'), 0), Math.min(60000, 3000 * this.failed));
      return;
    }
    if (code === 'quota_exceeded') toast(t('Storage is full. Archive or remove old recordings in Settings → Data.'), 'bad', 7000);
    else if (e && (e.status === 413 || e.status === 429)) toast(e.message, 'bad', 7000); // the server's own words: account full, or slow down
    else toast(t('Couldn’t save a change ({code}). It is kept on screen; try again shortly.', { code: code || 'error' }), 'bad');
  },

  /* ---------- recordings & files ----------
     refs: media:<id> (this device + Drive, 17-media.js), asset:<id> (artifact), mem:<id> (this visit),
     and, read-only, idb:<id> (older local recordings) */
  async putBlob(blob, kind = 'rec') {
    if (this.blobMode === 'device') {
      try { return await Media.add(blob, { kind }); } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw Object.assign(new Error(t('This device’s storage is full.')), { code: 'quota_exceeded' });
        throw e;
      }
    }
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
    if (kind === 'media') return Media.file(id);
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
    else if (kind === 'media') await Media.remove(id);
    else if (kind === 'idb') await IDB.del('blobs', id).catch(() => {});
    else if (kind === 'asset' && Caps.assets) await Caps.assets.delete(id).catch(() => {});
  },

  /* ---------- backup ---------- */
  exportJSON() {
    return JSON.stringify({ app: 'shadowing-practice', version: 1, exportedAt: new Date().toISOString(), data: this.data }, null, 1);
  },
  async importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.app !== 'shadowing-practice' || !parsed.data) throw new Error(t('This file is not a Euno Shadowing backup.'));
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
  slowStartRate: 0.75, slowStartPasses: 3, // the first shadow passes of a session play slower
  alignMode: 'auto', // 'auto' | 'manual'
  manualOffsetMs: 250,
  latencyMs: 0,
  livePitchAllPasses: false,
  review: false, reviewAfterDays: 2, reviewShadowPasses: 5,
  keepAllPassRecordings: false,
  echoCancellation: false, noiseSuppression: false,
  micAuto: true, micGain: 2, micDeviceId: null,
  pitchSmoothing: 5,
  programmeStart: null, // English; other languages keep theirs in programmeStarts
  programmeStarts: {},
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
