// D1 document store + R2 file helpers.
import { COLLECTIONS } from './util.js';

export async function allDocs(db, userId) {
  const { results } = await db.prepare('SELECT col, id, data FROM docs WHERE user_id = ?').bind(userId).all();
  const out = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  for (const r of results) {
    if (!out[r.col]) continue;
    try { out[r.col][r.id] = { ...JSON.parse(r.data), id: r.id }; } catch { /* skip corrupt row */ }
  }
  return out;
}
export async function getDoc(db, userId, col, id) {
  const row = await db.prepare('SELECT data FROM docs WHERE user_id = ? AND col = ? AND id = ?').bind(userId, col, id).first();
  return row ? { ...JSON.parse(row.data), id } : null;
}
export async function putDoc(db, userId, col, id, data) {
  const body = { ...data };
  delete body.id;
  const text = JSON.stringify(body);
  if (text.length > 1_000_000) throw new Error('Document too large (over 1 MB).');
  await db.prepare('INSERT INTO docs (user_id, col, id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(userId, col, id, text, Date.now()).run();
  return { ...body, id };
}
export async function deleteDoc(db, userId, col, id) {
  await db.prepare('DELETE FROM docs WHERE user_id = ? AND col = ? AND id = ?').bind(userId, col, id).run();
}

/* ---------- R2 ownership (read-only leftovers; files now live on the device or in Google Drive) ----------
   Objects live under u/<userId>/, or have a row in `files`. */
export async function ownsFile(db, userId, key) {
  if (key.startsWith('u/')) return key.startsWith(`u/${userId}/`);
  const row = await db.prepare('SELECT 1 AS ok FROM files WHERE key = ? AND user_id = ?').bind(key, userId).first();
  return !!row;
}
export async function forgetFile(db, userId, key) {
  await db.prepare('DELETE FROM files WHERE key = ? AND user_id = ?').bind(key, userId).run();
}

/* Serve an R2 object with HTTP range support (needed for video seeking). */
export async function serveFile(bucket, key, request) {
  const range = request.headers.get('range');
  let obj;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const head = await bucket.head(key);
      if (!head) return new Response('Not found', { status: 404 });
      const size = head.size;
      let start, end;
      if (m[1] === '') { const n = Number(m[2]); start = Math.max(0, size - n); end = size - 1; }
      else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
      obj = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!obj) return new Response('Not found', { status: 404 });
      const h = fileHeaders(obj);
      h.set('content-range', `bytes ${start}-${end}/${size}`);
      h.set('content-length', String(end - start + 1));
      return new Response(obj.body, { status: 206, headers: h });
    }
  }
  obj = await bucket.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const h = fileHeaders(obj);
  h.set('content-length', String(obj.size));
  return new Response(obj.body, { status: 200, headers: h });
}
function fileHeaders(obj) {
  const h = new Headers();
  obj.writeHttpMetadata(h);
  if (!h.get('content-type')) h.set('content-type', 'application/octet-stream');
  h.set('etag', obj.httpEtag);
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'private, max-age=31536000, immutable');
  return h;
}
