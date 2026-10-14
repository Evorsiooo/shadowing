// Checks server/webpush.js offline: the encryption against the RFC 8291 test vector, a round trip
// through a fake browser's keys, the VAPID signature, and how push service answers are handled.
//   node scripts/test-webpush.mjs
import { b64u, encryptPayload, sendPush, cleanSubscription } from '../server/webpush.js';

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };
const P256 = { name: 'ECDH', namedCurve: 'P-256' };
const jwkFor = (pub, d) => { const p = b64u.decode(pub); return { kty: 'EC', crv: 'P-256', x: b64u.encode(p.slice(1, 33)), y: b64u.encode(p.slice(33)), ...(d ? { d } : {}) }; };

// 1. RFC 8291 Appendix A
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  result: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const localKeys = {
  privateKey: await crypto.subtle.importKey('jwk', jwkFor(V.asPublic, V.asPrivate), P256, false, ['deriveBits']),
  publicKey: await crypto.subtle.importKey('jwk', jwkFor(V.asPublic), P256, true, []),
};
const out = await encryptPayload({ keys: { p256dh: V.uaPublic, auth: V.auth } }, V.plaintext, { salt: b64u.decode(V.salt), localKeys });
check(b64u.encode(out) === V.result, 'encryption matches the RFC 8291 test vector');

// 2. round trip: a fake browser decrypts what we send
const ua = await crypto.subtle.generateKey(P256, true, ['deriveBits']);
const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u.encode(uaPub), auth: b64u.encode(auth) } };
const bad = new Uint8Array(65); bad[0] = 4; bad.fill(7, 1);
check(!!(await cleanSubscription({ ...sub, expirationTime: null, extra: 1 })), 'a real subscription is accepted');
check(!!(await cleanSubscription({ ...sub, endpoint: 'https://web.push.apple.com/QGx' })) && !!(await cleanSubscription({ ...sub, endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x' })) && !!(await cleanSubscription({ ...sub, endpoint: 'https://wns2-par02p.notify.windows.com/w/?token=x' })), 'Apple, Mozilla and Windows push services are accepted');
check(!(await cleanSubscription({ ...sub, endpoint: 'http://fcm.googleapis.com/x' })) && !(await cleanSubscription({ ...sub, endpoint: 'https://example.com/x' })) && !(await cleanSubscription({ ...sub, endpoint: 'https://fcm.googleapis.com.evil.com/x' })), 'other endpoints are refused');
check(!(await cleanSubscription({ ...sub, keys: { p256dh: b64u.encode(bad), auth: sub.keys.auth } })), 'a key that isn’t a P-256 point is refused');

async function decrypt(body) {
  const hmac = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
  const cat = (...a) => Uint8Array.from(a.flatMap((x) => [...x]));
  const te = new TextEncoder();
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, P256, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hmac(await hmac(auth, shared), cat(te.encode('WebPush: info\0'), uaPub, asPub, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  return new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2)));
}

// 3. sendPush against a fake push service
const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = {
  VAPID_PUBLIC_KEY: b64u.encode(await crypto.subtle.exportKey('raw', vapid.publicKey)),
  VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d,
};
let seen = null, answer = 201;
globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(answer === 400 ? 'bad' : '', { status: answer }); };
const msg = { title: 'Time for today’s shadowing 🎧', body: '🔥 3-day streak', url: 'https://shadowing.euno.cc/app/' };
const r = await sendPush(env, sub, msg, { topic: 'reminder' });
check(r.ok && !r.gone, 'a 201 counts as sent');
check(seen.url === sub.endpoint && seen.init.headers['content-encoding'] === 'aes128gcm' && seen.init.headers.ttl && seen.init.headers.topic === 'reminder', 'request goes to the endpoint with the push headers');
check(JSON.stringify(JSON.parse(await decrypt(seen.init.body))) === JSON.stringify(msg), 'the browser can decrypt the message');
const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(seen.init.headers.authorization);
check(m && m[4] === env.VAPID_PUBLIC_KEY, 'VAPID header carries the public key');
const claims = JSON.parse(new TextDecoder().decode(b64u.decode(m[2])));
check(claims.aud === 'https://fcm.googleapis.com' && claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 86400 && /^(https:|mailto:)/.test(claims.sub), 'VAPID claims: audience, expiry under 24 h, subject');
check(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapid.publicKey, b64u.decode(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`)), 'VAPID signature verifies');
answer = 410; check((await sendPush(env, sub, msg)).gone, 'a 410 marks the subscription gone');
answer = 404; check((await sendPush(env, sub, msg)).gone, 'a 404 marks the subscription gone');
answer = 400; let threw = false; try { await sendPush(env, sub, msg); } catch (e) { threw = /400/.test(e.message); } check(threw, 'other errors are reported');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
