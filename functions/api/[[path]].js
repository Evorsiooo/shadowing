// /api/* — the app's backend. Everything here except /api/support needs a signed-in user,
// and every query is scoped to that user's id.
import { requireUser, sameOrigin, deleteUser, sha256Hex } from '../../server/auth.js';
import { json, error, validCol, validId, validKey, uuid, extFor, cleanType } from '../../server/util.js';
import { allDocs, putDoc, deleteDoc, serveFile, userKey, ownsFile, recordFile, forgetFile } from '../../server/store.js';
import { noteFeedback, claudeConfigured, claudeModel } from '../../server/claude.js';
import { adminRoute } from '../../server/admin.js';
import { validWebhook, getPrivate, setPrivate, getSettings, buildReminder, sendReminder, sessionsAndCheckins, localNow, REMINDER_DEFAULTS } from '../../server/reminders.js';

const PART_MAX = 95 * 1024 * 1024; // Workers request bodies are capped at 100 MB
const SINGLE_MAX = 95 * 1024 * 1024;

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (!sameOrigin(request)) return error(403, 'Cross-site request refused.');
  const path = Array.isArray(params.path) ? params.path : [];
  const method = request.method;
  // the contact form works without an account
  if (path[0] === 'support' && path.length === 1 && method === 'POST') {
    try { return await supportRoute(env, request); } catch (e) { console.error(e); return error(500, 'Server error'); }
  }
  const auth = await requireUser(request, env);
  if (!auth.ok) return error(auth.status, auth.reason, { signin: auth.status === 401 });
  const user = { id: auth.userId, email: auth.email, name: auth.name, picture: auth.picture, role: auth.role };
  try {
    const [head, ...rest] = path;
    if (head === 'health' && method === 'GET') {
      ctx.waitUntil(armReminders(env)); // keeps the reminder schedule running (cheap; no-op when already armed)
      const claude = user.role === 'admin' && claudeConfigured(env);
      return json({ ok: true, email: user.email, name: user.name, role: user.role, claude, claudeModel: claude ? claudeModel(env) : null, files: !!env.FILES, db: !!env.DB });
    }
    if (head === 'me' && !rest.length && method === 'GET') return json({ email: user.email, name: user.name, picture: user.picture, role: user.role });
    if (head === 'account' && !rest.length && method === 'DELETE') return await deleteAccountRoute(env, user, request);
    if (head === 'docs') return await docsRoute(env, user, method, rest, request);
    if (head === 'files') return await filesRoute(env, user, method, rest, request);
    if (head === 'uploads') return await uploadsRoute(env, user, method, rest, request);
    if (head === 'import' && method === 'POST') return await importRoute(env, user, request);
    if (head === 'claude' && method === 'POST') return await claudeRoute(env, user, request);
    if (head === 'reminders') return await remindersRoute(env, user, method, rest, request);
    if (head === 'admin') {
      // the role is read from the database on every request (requireUser), never from the browser
      if (user.role !== 'admin') return error(403, 'Admins only.');
      return await adminRoute(env, user, method, rest, request);
    }
    return error(404, 'No such endpoint.');
  } catch (e) {
    console.error(e);
    return error(e.status || 500, e.message || 'Server error');
  }
}

async function docsRoute(env, user, method, rest, request) {
  if (!rest.length && method === 'GET') return json({ data: await allDocs(env.DB, user.id) });
  const [col, id] = rest;
  if (!validCol(col) || !validId(id)) return error(400, 'Bad collection or id.');
  if (method === 'PUT') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return error(400, 'Body must be a JSON object.');
    await putDoc(env.DB, user.id, col, id, body);
    return json({ ok: true });
  }
  if (method === 'DELETE') { await deleteDoc(env.DB, user.id, col, id); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

async function filesRoute(env, user, method, rest, request) {
  const url = new URL(request.url);
  if (method === 'POST' && !rest.length) {
    // small files in one request: recordings, check-ins
    const kind = ['rec', 'checkin', 'misc', 'video'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'rec';
    const type = cleanType(request.headers.get('content-type'));
    const len = Number(request.headers.get('content-length') || 0);
    if (len > SINGLE_MAX) return error(413, 'File too large for a single upload; use /api/uploads.');
    const key = userKey(user.id, kind, `${uuid()}.${extFor(type, url.searchParams.get('name') || '')}`);
    const obj = await env.FILES.put(key, request.body, { httpMetadata: { contentType: type } });
    await recordFile(env.DB, user.id, key, obj.size, kind);
    return json({ ref: `r2:${key}`, key, size: obj.size, type });
  }
  const key = rest.join('/');
  if (!validKey(key)) return error(400, 'Bad file key.');
  if (!(await ownsFile(env.DB, user.id, key))) return error(404, 'Not found.');
  if (method === 'GET' || method === 'HEAD') return serveFile(env.FILES, key, request);
  if (method === 'DELETE') { await env.FILES.delete(key); await forgetFile(env.DB, user.id, key); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

/* multipart uploads for big videos: create → parts → complete (or abort) */
async function uploadsRoute(env, user, method, rest, request) {
  const url = new URL(request.url);
  if (method === 'POST' && !rest.length) {
    const body = await request.json().catch(() => ({}));
    const type = cleanType(body.type);
    const key = userKey(user.id, 'video', `${uuid()}.${extFor(type, body.filename || '')}`);
    const up = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: type } });
    return json({ key: up.key, uploadId: up.uploadId, partSize: 50 * 1024 * 1024 });
  }
  const [uploadId, action] = rest;
  const key = url.searchParams.get('key');
  if (!uploadId || !validKey(key) || !key.startsWith(`u/${user.id}/`)) return error(400, 'Bad upload.');
  const up = env.FILES.resumeMultipartUpload(key, uploadId);
  if (method === 'PUT' && /^\d+$/.test(action || '')) {
    const len = Number(request.headers.get('content-length') || 0);
    if (len > PART_MAX) return error(413, 'Part too large.');
    const part = await up.uploadPart(Number(action), request.body);
    return json({ partNumber: part.partNumber, etag: part.etag });
  }
  if (method === 'POST' && action === 'complete') {
    const body = await request.json().catch(() => ({}));
    const parts = (body.parts || []).map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })).sort((a, b) => a.partNumber - b.partNumber);
    const obj = await up.complete(parts);
    await recordFile(env.DB, user.id, key, obj.size, 'video');
    return json({ ref: `r2:${key}`, key, size: obj.size });
  }
  if (method === 'DELETE') { await up.abort(); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

/* copy a video from a direct link into R2 (so it keeps working if the host goes away) */
async function importRoute(env, user, request) {
  const { url } = await request.json().catch(() => ({}));
  let u;
  try { u = new URL(url); } catch { return error(400, 'That isn’t a valid link.'); }
  if (!/^https?:$/.test(u.protocol)) return error(400, 'Only http(s) links can be imported.');
  let resp;
  try { resp = await fetch(u.toString(), { redirect: 'follow' }); } catch (e) { return error(502, `Couldn’t download from that link (${e.message}).`); }
  if (!resp.ok || !resp.body) return error(502, `The link answered with HTTP ${resp.status}.`);
  const type = cleanType(resp.headers.get('content-type'));
  if (/text\/html/.test(type)) return error(415, 'That link is a web page, not a video file. Share pages (Google Drive, MEGA, YouTube) can’t be imported; use a direct .mp4 link.');
  const len = Number(resp.headers.get('content-length') || 0);
  const key = userKey(user.id, 'video', `${uuid()}.${extFor(type, u.pathname)}`);
  let body = resp.body;
  if (len > 0) {
    const fixed = new FixedLengthStream(len);
    resp.body.pipeTo(fixed.writable);
    body = fixed.readable;
  } else {
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 95 * 1024 * 1024) return error(413, 'The host didn’t say how big the file is and it’s over 95 MB. Download it and upload the file instead.');
    body = buf;
  }
  const obj = await env.FILES.put(key, body, { httpMetadata: { contentType: type.startsWith('video/') || type.startsWith('audio/') ? type : 'video/mp4' } });
  await recordFile(env.DB, user.id, key, obj.size, 'video');
  return json({ ref: `r2:${key}`, key, size: obj.size, type });
}

// The server key is the admin's own until bring-your-own-key AI lands; nobody else can spend it.
async function claudeRoute(env, user, request) {
  if (user.role !== 'admin') return error(403, 'AI feedback needs your own API key, which isn’t available yet. Use “copy prompt” instead.');
  if (!claudeConfigured(env)) return error(503, 'Claude isn’t set up yet: add the ANTHROPIC_API_KEY secret to the Cloudflare project.');
  const body = await request.json().catch(() => ({}));
  if (!body.off || typeof body.off !== 'string') return error(400, 'Describe what sounded off first.');
  const reply = await noteFeedback(env, body);
  return json({ reply });
}

/* Discord reminders: the webhook URL is stored server-side only; the app just sees whether one is set */
async function remindersRoute(env, user, method, rest, request) {
  const db = env.DB;
  const [action] = rest;
  if (!action && method === 'GET') {
    const url = await getPrivate(db, user.id, 'discordWebhook');
    const last = await getPrivate(db, user.id, 'reminderLast');
    return json({ configured: !!url, hint: url ? `…${url.slice(-4)}` : null, last: last ? JSON.parse(last) : null });
  }
  if (action === 'arm' && method === 'POST') return json(await armReminders(env));
  if (!action && method === 'PUT') {
    const { webhook } = await request.json().catch(() => ({}));
    if (webhook === null || webhook === '') { await setPrivate(db, user.id, 'discordWebhook', null); return json({ ok: true, configured: false }); }
    if (!validWebhook(webhook)) return error(400, 'That isn’t a Discord webhook link. In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.');
    await setPrivate(db, user.id, 'discordWebhook', webhook.trim());
    return json({ ok: true, configured: true, hint: `…${webhook.trim().slice(-4)}` });
  }
  if (action === 'test' && method === 'POST') {
    if (!(await getPrivate(db, user.id, 'discordWebhook'))) return error(400, 'Save a webhook link first.');
    // at most one test every 20 seconds per user
    const lastTest = Number(await getPrivate(db, user.id, 'reminderTestAt')) || 0;
    if (Date.now() - lastTest < 20_000) return error(429, 'Wait a few seconds before sending another test.');
    await setPrivate(db, user.id, 'reminderTestAt', Date.now());
    const body = await request.json().catch(() => ({}));
    const settings = await getSettings(db, user.id);
    const r = { ...REMINDER_DEFAULTS, ...(settings.reminders || {}), ...(typeof body.appUrl === 'string' && /^https:\/\//.test(body.appUrl) ? { appUrl: body.appUrl } : {}) };
    if (typeof body.tz === 'string') r.tz = body.tz;
    const today = localNow(r.tz).day;
    try {
      await sendReminder(db, user.id, buildReminder(await sessionsAndCheckins(db, user.id), { ...settings, reminders: r }, { today, test: true }));
    } catch (e) { return error(502, e.message); }
    return json({ ok: true });
  }
  return error(405, 'Method not allowed.');
}

/* Delete the signed-in account and everything the server keeps for it. The body must repeat the email. */
async function deleteAccountRoute(env, user, request) {
  const { confirm } = await request.json().catch(() => ({}));
  if (String(confirm || '').trim().toLowerCase() !== String(user.email).toLowerCase()) return error(400, 'Type your email address to confirm.');
  await deleteUser(env, user.id);
  return json({ ok: true }, 200, { 'set-cookie': '__Host-euno_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
}

/* Contact/support form: works signed in or not. Turnstile is checked when TURNSTILE_SECRET is set. */
async function supportRoute(env, request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  if (message.length < 5) return error(400, 'Write a message first.');
  if (message.length > 5000) return error(400, 'That message is too long (5000 characters at most).');
  const auth = await requireUser(request, env).catch(() => ({ ok: false }));
  const email = auth.ok ? auth.email : String(body.email || '').trim().toLowerCase();
  if (!auth.ok && !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) return error(400, 'Enter an email address so we can reply.');
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.TURNSTILE_SECRET) {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(body.turnstileToken || ''), remoteip: ip }),
    }).then((x) => x.json()).catch(() => ({ success: false }));
    if (!r.success) return error(400, 'The spam check failed. Reload the page and try again.');
  }
  const ipHash = ip ? (await sha256Hex(`support:${ip}`)).slice(0, 32) : null;
  const hourAgo = Date.now() - 3600_000;
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM support_messages WHERE created > ? AND (ip_hash = ? OR (user_id IS NOT NULL AND user_id = ?))')
    .bind(hourAgo, ipHash, auth.ok ? auth.userId : null).first();
  if (recent && recent.n >= 5) return error(429, 'You’ve sent several messages already. Try again later.');
  await env.DB.prepare('INSERT INTO support_messages (id, user_id, email, message, ip_hash, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(uuid(), auth.ok ? auth.userId : null, email, message, ipHash, Date.now()).run();
  return json({ ok: true });
}

async function armReminders(env) {
  if (!env.REMINDERS) return { ok: false, error: 'The reminders worker isn’t connected.' };
  try {
    const r = await env.REMINDERS.fetch('https://reminders/arm', { method: 'POST' });
    return await r.json();
  } catch (e) {
    console.error('arming reminders failed', e);
    return { ok: false, error: e.message };
  }
}
