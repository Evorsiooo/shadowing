// /api/* — the app's backend. Everything here except /api/support needs a signed-in user,
// and every query is scoped to that user's id.
import { requireUser, sameOrigin, deleteUser, sha256Hex } from '../../server/auth.js';
import { json, error, validCol, validId, uuid } from '../../server/util.js';
import { allDocs, putDoc, deleteDoc } from '../../server/store.js';
import { driveStatus, driveAccessToken, disconnectDrive } from '../../server/drive.js';
import { noteFeedback, aiAvailable, aiStatus, saveKey, setModel, removeKey, userModels, PROVIDERS } from '../../server/ai.js';
import { adminRoute } from '../../server/admin.js';
import { listGrants, removeGrant } from '../../server/oauth.js';
import { limit } from '../../server/limits.js';
import { validWebhook, getPrivate, setPrivate, getSettings, buildReminder, sendReminder, sessionsAndCheckins, localNow, REMINDER_DEFAULTS, CHANNELS, getPushSubs, addPushSub, removePushSubs } from '../../server/reminders.js';
import { pushAvailable, cleanSubscription } from '../../server/webpush.js';
import { requestLang, localise, translateMessage } from '../../server/i18n.js';

// error messages go out in the user's language (server/i18n.js)
export async function onRequest(ctx) { return localise(await handle(ctx), requestLang(ctx.request)); }

async function handle(ctx) {
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
      const ai = aiAvailable(env) ? await aiStatus(env, user.id) : { configured: false };
      const drive = await driveStatus(env, user.id);
      return json({ ok: true, email: user.email, name: user.name, role: user.role, ai: ai.configured ? { provider: ai.provider, providerName: ai.providerName, model: ai.model } : null, drive, driveAvailable: !!env.KEY_ENCRYPTION_KEY, db: !!env.DB });
    }
    if (head === 'me' && !rest.length && method === 'GET') return json({ email: user.email, name: user.name, picture: user.picture, role: user.role });
    if (head === 'account' && !rest.length && method === 'DELETE') return await deleteAccountRoute(env, user, request);
    if (head === 'docs') return await docsRoute(env, user, method, rest, request);
    if (head === 'drive') return await driveRoute(env, user, method, rest);
    if (head === 'ai') return await aiRoute(env, user, method, rest, request);
    if (head === 'claude' && method === 'POST') return await feedbackRoute(env, user, request); // old name for /api/ai/feedback
    if (head === 'connections') return await connectionsRoute(env, user, method, rest);
    if (head === 'reminders') return await remindersRoute(env, user, method, rest, request);
    if (head === 'admin') {
      // the role is read from the database on every request (requireUser), never from the browser
      if (user.role !== 'admin') return error(403, 'Admins only.');
      return await adminRoute(env, user, method, rest, request);
    }
    return error(404, 'No such endpoint.');
  } catch (e) {
    console.error(e);
    // only errors raised on purpose (with a status) carry a message meant for people
    return e.status ? error(e.status, e.message) : error(500, 'Something went wrong on the server. Try again in a moment.');
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

/* Google Drive sync: status, a short-lived access token for the browser, disconnect.
   Connecting happens at /auth/drive (a Google consent screen). */
async function driveRoute(env, user, method, rest) {
  const [action] = rest;
  if (!action && method === 'GET') return json(await driveStatus(env, user.id));
  if (action === 'token' && method === 'POST') {
    // a token lasts an hour, so even several devices need only a handful
    await limit(env.DB, user.id, 'driveTokenRate', 120, 3600_000, 'Too many Google Drive requests in the last hour. Try again a bit later.');
    try { return json(await driveAccessToken(env, user.id)); } catch (e) { return error(e.status || 502, e.message, { reconnect: !!e.reconnect }); }
  }
  if (!action && method === 'DELETE') { await disconnectDrive(env, user.id); return json({ ok: true, connected: false }); }
  return error(405, 'Method not allowed.');
}

/* Bring-your-own-key AI: the key is write-only; the app sees the provider, model and last 4 characters */
async function aiRoute(env, user, method, rest, request) {
  const [action] = rest;
  if (!action && method === 'GET') {
    const providers = Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p }));
    return json({ available: aiAvailable(env), providers, ...(aiAvailable(env) ? await aiStatus(env, user.id) : { configured: false }) });
  }
  if (!aiAvailable(env)) return error(503, 'AI keys aren’t set up on this server yet.');
  if (!action && method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    if (body.key != null) return json(await saveKey(env, user.id, body.provider, body.key));
    if (body.model != null) return json(await setModel(env, user.id, body.model));
    return error(400, 'Send a key or a model.');
  }
  if (!action && method === 'DELETE') { await removeKey(env, user.id); return json({ ok: true, configured: false }); }
  if (action === 'models' && method === 'GET') return json(await userModels(env, user.id));
  if (action === 'feedback' && method === 'POST') return feedbackRoute(env, user, request);
  if (action === 'test' && method === 'POST') {
    const t0 = Date.now();
    const r = await noteFeedback(env, user.id, { sentence: 'Go and grab the car.', off: 'the vowel in “go” sounds too flat', profile: (await request.json().catch(() => ({}))).profile });
    const ok = !!(r.reply && (r.reply.feature || r.reply.unsure || r.reply.text));
    return json({ ok, structured: !r.reply.text, model: r.model, provider: r.provider, ms: Date.now() - t0 });
  }
  return error(405, 'Method not allowed.');
}

async function feedbackRoute(env, user, request) {
  if (!aiAvailable(env)) return error(503, 'AI keys aren’t set up on this server yet. Use “copy prompt” instead.');
  const body = await request.json().catch(() => ({}));
  if (!body.off || typeof body.off !== 'string') return error(400, 'Describe what sounded off first.');
  const { reply, model, provider } = await noteFeedback(env, user.id, body);
  return json({ reply, model, provider });
}

/* AI apps connected to the MCP server (/mcp): list them and disconnect one */
async function connectionsRoute(env, user, method, rest) {
  const [id] = rest;
  if (!id && method === 'GET') return json({ connections: await listGrants(env.DB, user.id) });
  if (id && method === 'DELETE') {
    if (!validId(id)) return error(400, 'Bad id.');
    return (await removeGrant(env.DB, id, user.id)) ? json({ ok: true }) : error(404, 'No such connection.');
  }
  return error(405, 'Method not allowed.');
}

/* Reminders. The Discord webhook URL and push subscriptions are stored server-side only;
   the app sees whether each channel is set up, and for push, whether this device is one of them. */
async function remindersRoute(env, user, method, rest, request) {
  const db = env.DB;
  const [action] = rest;
  if (!action && method === 'GET') {
    const url = await getPrivate(db, user.id, 'discordWebhook');
    const last = await getPrivate(db, user.id, 'reminderLast');
    const subs = pushAvailable(env) ? await getPushSubs(db, user.id) : [];
    const endpoint = new URL(request.url).searchParams.get('endpoint'); // this device's subscription, if it has one
    return json({
      configured: !!url || subs.length > 0, hint: url ? `…${url.slice(-4)}` : null, last: last ? lastReminder(JSON.parse(last), requestLang(request)) : null,
      discord: { configured: !!url, hint: url ? `…${url.slice(-4)}` : null },
      push: { available: pushAvailable(env), publicKey: env.VAPID_PUBLIC_KEY || null, devices: subs.length, thisDevice: !!endpoint && subs.some((s) => s.endpoint === endpoint) },
    });
  }
  if (action === 'arm' && method === 'POST') return json(await armReminders(env));
  if (!action && method === 'PUT') {
    const { webhook } = await request.json().catch(() => ({}));
    if (webhook === null || webhook === '') { await setPrivate(db, user.id, 'discordWebhook', null); return json({ ok: true, configured: false }); }
    if (!validWebhook(webhook)) return error(400, 'That isn’t a Discord webhook link. In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.');
    await setPrivate(db, user.id, 'discordWebhook', webhook.trim());
    return json({ ok: true, configured: true, hint: `…${webhook.trim().slice(-4)}` });
  }
  if (action === 'push' && method === 'POST') {
    if (!pushAvailable(env)) return error(503, 'Notifications aren’t set up on the server yet.');
    const body = await request.json().catch(() => ({}));
    const sub = await cleanSubscription(body.subscription);
    if (!sub) return error(400, 'The browser gave an unusable subscription. Try turning notifications off and on again.');
    const devices = await addPushSub(db, user.id, sub, body.label);
    return json({ ok: true, devices });
  }
  if (action === 'push' && method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    const subs = await getPushSubs(db, user.id);
    const devices = await removePushSubs(db, user.id, body.all ? subs.map((s) => s.endpoint) : [String(body.endpoint || '')]);
    return json({ ok: true, devices });
  }
  if (action === 'test' && method === 'POST') {
    const channels = await Promise.all(Object.values(CHANNELS).map((ch) => ch.target(env, user.id)));
    if (!channels.some(Boolean)) return error(400, 'Set up Discord or notifications first.');
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
      await sendReminder(env, user.id, buildReminder(await sessionsAndCheckins(db, user.id), { ...settings, reminders: r }, { today, test: true }));
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
  // and a ceiling for everyone together, so a flood from many addresses can't fill the inbox
  const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM support_messages WHERE created > ?').bind(Date.now() - 86400_000).first();
  if (today && today.n >= 300) return error(429, 'The contact form is busy right now. Try again tomorrow.');
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

// the last reminder's outcome, with its error (written by the scheduled run, in English) in the user's language
function lastReminder(last, lang) { return last && last.error ? { ...last, error: translateMessage(lang, last.error) } : last; }
