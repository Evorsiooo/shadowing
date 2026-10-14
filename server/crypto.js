// Secrets kept for a user (a Google Drive refresh token, AI keys) are sealed with AES-GCM under the
// KEY_ENCRYPTION_KEY Pages secret: 32 random bytes, base64 (`openssl rand -base64 32`).
// The user id and purpose are bound in as additional data, so a sealed value copied to another
// user's row, or used for another purpose, fails to open.
import { b64urlToBytes, bytesToB64url } from './auth.js';

const keyCache = new Map();
async function masterKey(env) {
  const raw = env.KEY_ENCRYPTION_KEY;
  if (!raw) throw Object.assign(new Error('The server has no KEY_ENCRYPTION_KEY secret, so it can’t store this safely yet.'), { status: 503 });
  if (keyCache.has(raw)) return keyCache.get(raw);
  const bytes = Uint8Array.from(atob(raw.trim()), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw Object.assign(new Error('KEY_ENCRYPTION_KEY must be 32 bytes, base64-encoded.'), { status: 503 });
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  keyCache.set(raw, key);
  return key;
}
const aad = (userId, purpose) => new TextEncoder().encode(`${userId}:${purpose}`);

/** Seal a secret for one user and purpose. Returns "v1.<iv>.<ciphertext>" (base64url). */
export async function sealSecret(env, userId, purpose, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(userId, purpose) }, await masterKey(env), new TextEncoder().encode(String(plaintext)));
  return `v1.${bytesToB64url(iv)}.${bytesToB64url(ct)}`;
}

/** Open a value made by sealSecret with the same user and purpose. */
export async function openSecret(env, userId, purpose, sealed) {
  const [v, iv, ct] = String(sealed || '').split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Stored secret is in an unknown format.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlToBytes(iv), additionalData: aad(userId, purpose) }, await masterKey(env), b64urlToBytes(ct));
  return new TextDecoder().decode(pt);
}
