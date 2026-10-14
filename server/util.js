// Small helpers shared by the API endpoints.
export const COLLECTIONS = ['videos', 'clips', 'sessions', 'recordings', 'notes', 'issues', 'checkins', 'meta', 'media'];
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
