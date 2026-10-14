// D1 document store.
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
