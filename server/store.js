// D1 document store.
import { COLLECTIONS } from './util.js';

// Each account's share of the database. Practice data is small (a heavy user's whole history is
// a few MB); videos and recordings never come here. These stop one account filling D1.
export const MAX_DOC_BYTES = 1_000_000;
export const MAX_USER_BYTES = 25_000_000;
export const MAX_USER_DOCS = 20_000;
const full = (message) => Object.assign(new Error(message), { status: 413 });

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
  if (text.length > MAX_DOC_BYTES) throw full('Document too large (over 1 MB).');
  const used = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes,
      COALESCE(SUM(CASE WHEN col = ? AND id = ? THEN LENGTH(data) END), -1) AS current
    FROM docs WHERE user_id = ?`).bind(col, id, userId).first();
  // a change that doesn't make the data bigger always goes through, so a full account can still be tidied
  const grows = used.current < 0 ? used.n >= MAX_USER_DOCS || used.bytes + text.length > MAX_USER_BYTES
    : text.length > used.current && used.bytes - used.current + text.length > MAX_USER_BYTES;
  if (grows) throw full('Your account’s practice data is full. Delete videos, clips or recordings you no longer need, or contact us.');
  await db.prepare('INSERT INTO docs (user_id, col, id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(userId, col, id, text, Date.now()).run();
  return { ...body, id };
}
export async function deleteDoc(db, userId, col, id) {
  await db.prepare('DELETE FROM docs WHERE user_id = ? AND col = ? AND id = ?').bind(userId, col, id).run();
}
