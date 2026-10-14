// /api/* — the app's backend. Everything here requires a valid Cloudflare Access sign-in.
import { verifyAccess } from '../../server/auth.js';
import { json, error, validCol, validId, validKey, uuid, extFor, cleanType } from '../../server/util.js';
import { allDocs, putDoc, deleteDoc, serveFile } from '../../server/store.js';
import { noteFeedback, claudeConfigured, claudeModel } from '../../server/claude.js';
import { validWebhook, getPrivate, setPrivate, buildMessage, postDiscord, sessionsAndCheckins, localNow, REMINDER_DEFAULTS } from '../../server/reminders.js';

const PART_MAX = 95 * 1024 * 1024; // Workers request bodies are capped at 100 MB
const SINGLE_MAX = 95 * 1024 * 1024;

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const auth = await verifyAccess(request, env);
  if (!auth.ok) return error(auth.status, auth.reason, { signin: auth.status === 401 });
  const path = Array.isArray(params.path) ? params.path : [];
  const method = request.method;
  try {
    const [head, ...rest] = path;
    if (head === 'health' && method === 'GET') {
      ctx.waitUntil(armReminders(env)); // keeps the reminder schedule running (cheap; no-op when already armed)
      return json({ ok: true, email: auth.email, claude: claudeConfigured(env), claudeModel: claudeModel(env), files: !!env.FILES, db: !!env.DB });
    }
    if (head === 'docs') return await docsRoute(env, method, rest, request);
    if (head === 'files') return await filesRoute(env, method, rest, request);
    if (head === 'uploads') return await uploadsRoute(env, method, rest, request);
    if (head === 'import' && method === 'POST') return await importRoute(env, request);
    if (head === 'claude' && method === 'POST') return await claudeRoute(env, request);
    if (head === 'reminders') return await remindersRoute(env, method, rest, request);
    return error(404, 'No such endpoint.');
  } catch (e) {
    console.error(e);
    return error(e.status || 500, e.message || 'Server error');
  }
}

async function docsRoute(env, method, rest, request) {
  if (!rest.length && method === 'GET') return json({ data: await allDocs(env.DB) });
  const [col, id] = rest;
  if (!validCol(col) || !validId(id)) return error(400, 'Bad collection or id.');
  if (method === 'PUT') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return error(400, 'Body must be a JSON object.');
    await putDoc(env.DB, col, id, body);
    return json({ ok: true });
  }
  if (method === 'DELETE') { await deleteDoc(env.DB, col, id); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

async function filesRoute(env, method, rest, request) {
  const url = new URL(request.url);
  if (method === 'POST' && !rest.length) {
    // small files in one request: recordings, check-ins
    const kind = ['rec', 'checkin', 'misc', 'video'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'rec';
    const type = cleanType(request.headers.get('content-type'));
    const len = Number(request.headers.get('content-length') || 0);
    if (len > SINGLE_MAX) return error(413, 'File too large for a single upload; use /api/uploads.');
    const key = `${kind}/${uuid()}.${extFor(type, url.searchParams.get('name') || '')}`;
    const obj = await env.FILES.put(key, request.body, { httpMetadata: { contentType: type } });
    return json({ ref: `r2:${key}`, key, size: obj.size, type });
  }
  const key = rest.join('/');
  if (!validKey(key)) return error(400, 'Bad file key.');
  if (method === 'GET' || method === 'HEAD') return serveFile(env.FILES, key, request);
  if (method === 'DELETE') { await env.FILES.delete(key); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

/* multipart uploads for big videos: create → parts → complete (or abort) */
async function uploadsRoute(env, method, rest, request) {
  const url = new URL(request.url);
  if (method === 'POST' && !rest.length) {
    const body = await request.json().catch(() => ({}));
    const type = cleanType(body.type);
    const key = `video/${uuid()}.${extFor(type, body.filename || '')}`;
    const up = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: type } });
    return json({ key: up.key, uploadId: up.uploadId, partSize: 50 * 1024 * 1024 });
  }
  const [uploadId, action] = rest;
  const key = url.searchParams.get('key');
  if (!uploadId || !validKey(key)) return error(400, 'Bad upload.');
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
    return json({ ref: `r2:${key}`, key, size: obj.size });
  }
  if (method === 'DELETE') { await up.abort(); return json({ ok: true }); }
  return error(405, 'Method not allowed.');
}

/* copy a video from a direct link into R2 (so it keeps working if the host goes away) */
async function importRoute(env, request) {
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
  const key = `video/${uuid()}.${extFor(type, u.pathname)}`;
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
  return json({ ref: `r2:${key}`, key, size: obj.size, type });
}

async function claudeRoute(env, request) {
  if (!claudeConfigured(env)) return error(503, 'Claude isn’t set up yet: add the ANTHROPIC_API_KEY secret to the Cloudflare project.');
  const body = await request.json().catch(() => ({}));
  if (!body.off || typeof body.off !== 'string') return error(400, 'Describe what sounded off first.');
  const reply = await noteFeedback(env, body);
  return json({ reply });
}

/* Discord reminders: the webhook URL is stored server-side only; the app just sees whether one is set */
async function remindersRoute(env, method, rest, request) {
  const [action] = rest;
  if (!action && method === 'GET') {
    const url = await getPrivate(env.DB, 'discordWebhook');
    const last = await getPrivate(env.DB, 'reminderLast');
    return json({ configured: !!url, hint: url ? `…${url.slice(-4)}` : null, last: last ? JSON.parse(last) : null });
  }
  if (action === 'arm' && method === 'POST') return json(await armReminders(env));
  if (!action && method === 'PUT') {
    const { webhook } = await request.json().catch(() => ({}));
    if (webhook === null || webhook === '') { await setPrivate(env.DB, 'discordWebhook', null); return json({ ok: true, configured: false }); }
    if (!validWebhook(webhook)) return error(400, 'That isn’t a Discord webhook link. In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.');
    await setPrivate(env.DB, 'discordWebhook', webhook.trim());
    return json({ ok: true, configured: true, hint: `…${webhook.trim().slice(-4)}` });
  }
  if (action === 'test' && method === 'POST') {
    const url = await getPrivate(env.DB, 'discordWebhook');
    if (!url) return error(400, 'Save a webhook link first.');
    const body = await request.json().catch(() => ({}));
    const row = await env.DB.prepare("SELECT data FROM docs WHERE col = 'meta' AND id = 'settings'").first();
    const settings = row ? JSON.parse(row.data) : {};
    const r = { ...REMINDER_DEFAULTS, ...(settings.reminders || {}), ...(typeof body.appUrl === 'string' && /^https:\/\//.test(body.appUrl) ? { appUrl: body.appUrl } : {}) };
    if (typeof body.tz === 'string') r.tz = body.tz;
    const today = localNow(r.tz).day;
    try {
      await postDiscord(url, buildMessage(await sessionsAndCheckins(env.DB), { ...settings, reminders: r }, { today, test: true }));
    } catch (e) { return error(502, e.message); }
    return json({ ok: true });
  }
  return error(405, 'Method not allowed.');
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
