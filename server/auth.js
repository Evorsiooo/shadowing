// Cloudflare Access check. Access sits in front of the whole site; every API call
// also verifies the signed Access token itself, so a misconfigured Access policy
// (or a preview deployment left open) can never expose data. Fails closed.
let certCache = { url: null, at: 0, keys: [] };

function b64urlToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function decodePart(s) { return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))); }

async function getKeys(certsUrl) {
  if (certCache.url === certsUrl && Date.now() - certCache.at < 3600_000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(certsUrl);
  if (!r.ok) throw new Error(`certs ${r.status}`);
  const { keys = [] } = await r.json();
  certCache = { url: certsUrl, at: Date.now(), keys };
  return keys;
}

function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  for (const part of c.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

export async function verifyAccess(request, env) {
  if (env.DEV_NO_AUTH === '1') return { ok: true, email: 'dev@localhost' };
  const team = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!team || !env.ACCESS_AUD) return { ok: false, status: 503, reason: 'Cloudflare Access is not configured on the server (ACCESS_TEAM_DOMAIN / ACCESS_AUD).' };
  const token = request.headers.get('cf-access-jwt-assertion') || readCookie(request, 'CF_Authorization');
  if (!token) return { ok: false, status: 401, reason: 'Not signed in.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, reason: 'Bad token.' };
  let header, payload;
  try { header = decodePart(parts[0]); payload = decodePart(parts[1]); } catch { return { ok: false, status: 401, reason: 'Bad token.' }; }
  if (header.alg !== 'RS256') return { ok: false, status: 401, reason: 'Bad token algorithm.' };
  const certsUrl = env.ACCESS_CERTS_URL || `https://${team}/cdn-cgi/access/certs`;
  let keys;
  try { keys = await getKeys(certsUrl); } catch (e) { return { ok: false, status: 503, reason: `Couldn't fetch Access keys (${e.message}).` }; }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) { certCache.at = 0; return { ok: false, status: 401, reason: 'Unknown signing key.' }; }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return { ok: false, status: 401, reason: 'Bad signature.' };
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now - 30) return { ok: false, status: 401, reason: 'Session expired.' };
  if (payload.nbf && payload.nbf > now + 30) return { ok: false, status: 401, reason: 'Token not yet valid.' };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.ACCESS_AUD)) return { ok: false, status: 403, reason: 'Token is for another application.' };
  if (payload.iss && payload.iss !== `https://${team}`) return { ok: false, status: 403, reason: 'Token from another team.' };
  const allowed = (env.ALLOWED_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const email = String(payload.email || '').toLowerCase();
  if (allowed.length && !allowed.includes(email)) return { ok: false, status: 403, reason: 'This account is not allowed.' };
  return { ok: true, email };
}
