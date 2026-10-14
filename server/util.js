// Small helpers shared by the API endpoints.
export const COLLECTIONS = ['videos', 'clips', 'sessions', 'recordings', 'notes', 'issues', 'checkins', 'meta'];
const ID_RE = /^[A-Za-z0-9_.:-]{1,120}$/;

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export function error(status, message, extra = {}) {
  return json({ error: message, ...extra }, status);
}
export function validCol(col) { return COLLECTIONS.includes(col); }
export function validId(id) { return typeof id === 'string' && ID_RE.test(id); }
export function uuid() { return crypto.randomUUID().replace(/-/g, ''); }

// constant-time string comparison for secrets
export function safeEqual(a, b) {
  const ea = new TextEncoder().encode(String(a));
  const eb = new TextEncoder().encode(String(b));
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] || 0) ^ (eb[i] || 0);
  return diff === 0;
}

const EXT = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'video/quicktime': 'mov' };
export function extFor(type, filename = '') {
  const base = String(type || '').split(';')[0].trim().toLowerCase();
  if (EXT[base]) return EXT[base];
  const m = /\.([a-z0-9]{2,5})$/i.exec(filename);
  return m ? m[1].toLowerCase() : 'bin';
}
export function cleanType(type) {
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  return /^[a-z]+\/[a-z0-9.+-]+$/.test(t) ? t : 'application/octet-stream';
}
// R2 keys: u/<userId>/<kind>/<name> for new files, <kind>/<name> for files from before accounts
export function validKey(key) {
  return typeof key === 'string' && /^(u\/[A-Za-z0-9_-]{1,64}\/)?(rec|video|checkin|misc)\/[A-Za-z0-9_.-]{1,120}$/.test(key);
}
