// Web Push with no libraries: VAPID (RFC 8292) to identify the server to the push service, and
// aes128gcm payload encryption (RFC 8291) so only the subscribed browser can read the message.
// Keys: VAPID_PUBLIC_KEY (65-byte uncompressed P-256 point) and VAPID_PRIVATE_KEY (32-byte scalar),
// both base64url, set as secrets on the Pages project and the reminders Worker
// (`node scripts/push-keys.mjs` makes a pair and sets them). Works in Workers and in Node 20+.

const SUBJECT = 'https://shadowing.euno.cc'; // contact for push services, required by VAPID

const enc = new TextEncoder();
export const b64u = {
  encode(bytes) {
    let s = '';
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

export function pushAvailable(env) { return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY); }

// Push services the big browsers use. Anything else is refused, so the server only ever posts to these.
const PUSH_HOSTS = /^(?:fcm\.googleapis\.com|android\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|(?:[a-z0-9-]+\.)*notify\.windows\.com)$/;

/** A subscription as the browser gives it (PushSubscription.toJSON()), checked and trimmed to what we keep. */
export async function cleanSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const { endpoint, keys } = sub;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || !PUSH_HOSTS.test(url.hostname)) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  try {
    if (b64u.decode(keys.auth).length !== 16) return null;
    await crypto.subtle.importKey('raw', b64u.decode(keys.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []); // a real P-256 point
  } catch { return null; }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/* ---------- VAPID: a short-lived ES256 JWT for the push service's origin ---------- */
async function vapidHeader(env, endpoint) {
  const pub = b64u.decode(env.VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: b64u.encode(pub.slice(1, 33)), y: b64u.encode(pub.slice(33, 65)), ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o) => b64u.encode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)); // r||s, as JWS wants
  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/* ---------- aes128gcm encryption for one subscription ---------- */
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
export async function encryptPayload(sub, plaintext, { salt = crypto.getRandomValues(new Uint8Array(16)), localKeys } = {}) {
  const uaPublic = b64u.decode(sub.keys.p256dh);
  const authSecret = b64u.decode(sub.keys.auth);
  const local = localKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  // HKDF steps from RFC 8291 section 3.4 (each output is a single HMAC block, so expand is one HMAC)
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext, [2]); // 2 = last record, no padding
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, [asPublic.length], asPublic, cipher);
}

/**
 * Send one message to one subscription. Resolves to { ok, gone } where gone means the push
 * service says the subscription no longer exists (unsubscribed, app removed), so forget it.
 */
export async function sendPush(env, sub, message, { ttl = 4 * 3600, urgency = 'normal', topic } = {}) {
  const body = await encryptPayload(sub, JSON.stringify(message));
  const headers = {
    authorization: await vapidHeader(env, sub.endpoint),
    'content-encoding': 'aes128gcm',
    'content-type': 'application/octet-stream',
    ttl: String(ttl),
    urgency,
  };
  if (topic) headers.topic = topic; // a newer message with the same topic replaces an undelivered one
  let resp;
  try { resp = await fetch(sub.endpoint, { method: 'POST', headers, body }); } catch (e) { throw new Error(`Couldn’t reach the push service (${e.message})`); }
  if (resp.ok) return { ok: true, gone: false };
  if (resp.status === 404 || resp.status === 410) return { ok: false, gone: true };
  const text = await resp.text().catch(() => '');
  throw Object.assign(new Error(`The push service answered ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`), { status: resp.status });
}
