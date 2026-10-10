// D1 document store + R2 file helpers.
import { COLLECTIONS } from './util.js';

export async function allDocs(db) {
  const { results } = await db.prepare('SELECT col, id, data FROM docs').all();
  const out = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  for (const r of results) {
    if (!out[r.col]) continue;
    try { out[r.col][r.id] = { ...JSON.parse(r.data), id: r.id }; } catch { /* skip corrupt row */ }
  }
  return out;
}
export async function listDocs(db, col, { limit = 100, offset = 0, where = null, order = 'updated_at DESC' } = {}) {
  const binds = [col];
  let sql = 'SELECT id, data, updated_at FROM docs WHERE col = ?';
  if (where && typeof where === 'object') {
    for (const [field, value] of Object.entries(where)) {
      if (!/^[A-Za-z0-9_.]{1,60}$/.test(field)) throw new Error(`Bad field name: ${field}`);
      sql += ` AND json_extract(data, '$.${field}') IS ?`;
      binds.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
  }
  sql += ` ORDER BY ${order === 'updated_at ASC' ? 'updated_at ASC' : 'updated_at DESC'} LIMIT ? OFFSET ?`;
  binds.push(Math.min(Math.max(1, limit | 0), 500), Math.max(0, offset | 0));
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map((r) => ({ ...JSON.parse(r.data), id: r.id, _updatedAt: r.updated_at }));
}
export async function getDoc(db, col, id) {
  const row = await db.prepare('SELECT data FROM docs WHERE col = ? AND id = ?').bind(col, id).first();
  return row ? { ...JSON.parse(row.data), id } : null;
}
export async function putDoc(db, col, id, data) {
  const body = { ...data };
  delete body.id;
  const text = JSON.stringify(body);
  if (text.length > 1_000_000) throw new Error('Document too large (over 1 MB).');
  await db.prepare('INSERT INTO docs (col, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(col, id, text, Date.now()).run();
  return { ...body, id };
}
export async function deleteDoc(db, col, id) {
  await db.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(col, id).run();
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
