// Practice reminders, per user. Used by the reminders Worker (every 15 minutes) and by
// /api/reminders (setup and "send a test"). Each user's channel settings (a Discord webhook,
// their devices' push subscriptions) live in the `private` table, which the docs API never returns.
// Sending goes through CHANNELS: a reminder goes out on every channel the user has set up.
import { pushAvailable, sendPush } from './webpush.js';

const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,120}$/;
export function validWebhook(url) { return typeof url === 'string' && WEBHOOK_RE.test(url.trim()); }

export async function getPrivate(db, userId, key) {
  const row = await db.prepare('SELECT value FROM private WHERE user_id = ? AND key = ?').bind(userId, key).first();
  return row ? row.value : null;
}
export async function setPrivate(db, userId, key, value) {
  if (value == null) { await db.prepare('DELETE FROM private WHERE user_id = ? AND key = ?').bind(userId, key).run(); return; }
  await db.prepare('INSERT INTO private (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .bind(userId, key, String(value), Date.now()).run();
}
export async function getSettings(db, userId) {
  const row = await db.prepare("SELECT data FROM docs WHERE user_id = ? AND col = 'meta' AND id = 'settings'").bind(userId).first();
  try { return row ? JSON.parse(row.data) : {}; } catch { return {}; }
}

export const REMINDER_DEFAULTS = {
  enabled: false,
  time: '18:00', // local time, HH:MM
  lateTime: '', // optional second nudge if still not practised
  days: [1, 2, 3, 4, 5, 6, 0], // 0 = Sunday
  skipIfDone: true,
  checkins: true, // mention a due check-in
  tz: 'UTC',
  appUrl: '',
  discordUserId: '', // optional: mention this Discord user so the reminder pings them
};

const USER_ID_RE = /^\d{17,20}$/;
export function validUserId(id) { return typeof id === 'string' && USER_ID_RE.test(id.trim()); }

/* ---------- dates in the user's time zone ---------- */
export function localNow(tz, now = new Date()) {
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]));
  } catch { return localNow('UTC', now); }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export function addDays(k, n) { const d = new Date(parseDay(k) + n * 86400000); return d.toISOString().slice(0, 10); }
const toMinutes = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/* ---------- habit numbers (same rules as the app) ---------- */
export function habit(data, today) {
  const days = new Set();
  for (const s of Object.values(data.sessions || {})) if (!s.empty && s.passes && s.passes.length && s.date) days.add(s.date);
  let streak = 0;
  const first = [...days].sort()[0];
  if (first) {
    let d = days.has(today) ? today : addDays(today, -1), gap = 0;
    while (d >= first) {
      if (days.has(d)) { streak++; gap = 0; } else if (++gap >= 2) break;
      d = addDays(d, -1);
    }
  }
  const wd = (new Date(parseDay(today)).getUTCDay() + 6) % 7; // Monday-based week
  const ws = addDays(today, -wd);
  let weekCount = 0;
  for (const k of days) if (k >= ws && k <= today) weekCount++;
  return { streak, weekCount, practisedToday: days.has(today) };
}
const TASK_KEYS = ['read', 'retell', 'answer'];
export function dueCheckin(data, settings, today) {
  const checkins = Object.values(data.checkins || {});
  const complete = (w) => { const c = checkins.find((x) => x.week === w); return c && TASK_KEYS.every((t) => c.recs && c.recs[t] && c.recs[t].length); };
  const base = checkins.find((x) => x.week === 0);
  const start = settings.programmeStart || (base && base.date) || today;
  for (const w of [0, 4, 8, 12]) if (!complete(w) && (w === 0 || addDays(start, w * 7) <= today)) return w;
  return null;
}

/* ---------- the message (channel-neutral) ---------- */
export function buildReminder(data, settings, { today, late = false, test = false } = {}) {
  const r = { ...REMINDER_DEFAULTS, ...(settings.reminders || {}) };
  const h = habit(data, today);
  const target = settings.weeklyTarget || 6;
  const lines = [];
  if (h.streak > 0) lines.push(`🔥 ${h.streak}-day streak${h.practisedToday ? '' : ': keep it going'}`);
  lines.push(`📅 ${h.weekCount}/${target} days this week`);
  const due = r.checkins ? dueCheckin(data, settings, today) : null;
  if (due != null) lines.push(`🎙️ Week ${due} check-in is due`);
  lines.push('', 'Short on time? A 5-minute bad-day session still counts.');
  const title = test ? 'Test reminder: it works ✅'
    : late ? 'Still time for today’s shadowing' : 'Time for today’s shadowing 🎧';
  return { title, lines, url: r.appUrl || null, settings: r };
}

/* ---------- channels: each knows whether a user set it up, and how to send ---------- */
export const CHANNELS = {
  discord: {
    key: 'discordWebhook', // where the user's target (the webhook URL) is stored in `private`
    async target(env, userId) { return getPrivate(env.DB, userId, this.key); },
    format(rem) {
      const embed = { title: rem.title, description: rem.lines.join('\n'), color: 0x58cc02 };
      if (rem.url) embed.url = rem.url; // the title links to the app
      // Mentions only ping from `content`, and only the user listed in allowed_mentions (nothing else can ping)
      const id = rem.settings.discordUserId;
      const userId = validUserId(id) ? id.trim() : null;
      const content = [userId ? `<@${userId}>` : '', rem.url ? `<${rem.url}>` : ''].filter(Boolean).join(' ');
      return { username: 'Euno Shadowing', content, embeds: [embed], allowed_mentions: userId ? { parse: [], users: [userId] } : { parse: [] } };
    },
    async send(env, userId, target, rem) { await postDiscord(target, this.format(rem)); },
  },
  push: {
    key: 'pushSubs', // JSON list of the user's devices: [{ endpoint, keys: { p256dh, auth }, label, added }]
    async target(env, userId) {
      if (!pushAvailable(env)) return null;
      const subs = await getPushSubs(env.DB, userId);
      return subs.length ? subs : null;
    },
    format(rem) {
      return { title: rem.title, body: rem.lines.filter(Boolean).join('\n'), url: rem.url ? `${rem.url.replace(/\/$/, '')}/app/` : '/app/', tag: 'euno-reminder' };
    },
    async send(env, userId, subs, rem) {
      const msg = this.format(rem);
      let ok = 0, firstError = null;
      const gone = [];
      for (const sub of subs) {
        try {
          const r = await sendPush(env, sub, msg, { topic: 'reminder' });
          if (r.ok) ok++; else if (r.gone) gone.push(sub.endpoint);
        } catch (e) { firstError = firstError || e; }
      }
      if (gone.length) await removePushSubs(env.DB, userId, gone);
      if (!ok) throw firstError || new Error('None of your devices accept notifications any more. Turn them on again in Settings → Reminders.');
    },
  },
};

/* ---------- push subscriptions: one per device, kept in `private` under pushSubs ---------- */
export const MAX_PUSH_DEVICES = 10;
export async function getPushSubs(db, userId) {
  try { const v = JSON.parse(await getPrivate(db, userId, 'pushSubs')); return Array.isArray(v) ? v : []; } catch { return []; }
}
export async function addPushSub(db, userId, sub, label) {
  const subs = (await getPushSubs(db, userId)).filter((s) => s.endpoint !== sub.endpoint);
  subs.push({ ...sub, label: String(label || '').slice(0, 60), added: Date.now() });
  await setPrivate(db, userId, 'pushSubs', JSON.stringify(subs.slice(-MAX_PUSH_DEVICES))); // the oldest device drops off
  return subs.length;
}
export async function removePushSubs(db, userId, endpoints) {
  const subs = (await getPushSubs(db, userId)).filter((s) => !endpoints.includes(s.endpoint));
  await setPrivate(db, userId, 'pushSubs', subs.length ? JSON.stringify(subs) : null);
  return subs.length;
}

/** Send a reminder on every channel the user has set up. Returns how many were sent; throws the first error. */
export async function sendReminder(env, userId, rem) {
  let sent = 0, firstError = null;
  for (const ch of Object.values(CHANNELS)) {
    const target = await ch.target(env, userId);
    if (!target) continue;
    try { await ch.send(env, userId, target, rem); sent++; } catch (e) { firstError = firstError || e; }
  }
  if (!sent && firstError) throw firstError;
  return sent;
}

// kept for callers that want the Discord payload directly
export function buildMessage(data, settings, opts) { return CHANNELS.discord.format(buildReminder(data, settings, opts)); }

export async function postDiscord(url, payload) {
  let resp;
  try {
    resp = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) { throw new Error(`Couldn’t reach Discord (${e.message})`); }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw Object.assign(new Error(resp.status === 404 || resp.status === 401 ? 'Discord says this webhook doesn’t exist any more (it may have been deleted). Paste a new one.' : `Discord answered ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`), { status: resp.status });
  }
}

/* ---------- the scheduled run: every user with a channel set up, at most once per slot per day ---------- */
export async function runReminders(env, now = new Date()) {
  const keys = Object.values(CHANNELS).map((c) => c.key);
  const { results } = await env.DB.prepare(`SELECT DISTINCT p.user_id FROM private p JOIN users u ON u.id = p.user_id WHERE u.disabled = 0 AND p.key IN (${keys.map(() => '?').join(', ')})`)
    .bind(...keys).all();
  const out = [];
  for (const { user_id: userId } of results) {
    try { out.push(`${userId}: ${await runForUser(env, userId, now)}`); } catch (e) { out.push(`${userId}: ${e.message}`); }
  }
  return out.join('; ') || 'nobody to remind';
}

export async function runForUser(env, userId, now = new Date()) {
  const db = env.DB;
  const settings = await getSettings(db, userId);
  const r = { ...REMINDER_DEFAULTS, ...(settings.reminders || {}) };
  if (!r.enabled) return 'disabled';
  const t = localNow(r.tz, now);
  if (!r.days.includes(t.weekday)) return 'not a reminder day';
  const slots = [['main', toMinutes(r.time)], ['late', toMinutes(r.lateTime)]].filter(([, m]) => m != null);
  const out = [];
  for (const [slot, at] of slots) {
    // due from the set time for an hour (covers a late or skipped run)
    if (t.minutes < at || t.minutes >= at + 60) continue;
    const sentKey = `reminderSent:${slot}`;
    if ((await getPrivate(db, userId, sentKey)) === t.day) continue;
    await setPrivate(db, userId, sentKey, t.day);
    const data = await sessionsAndCheckins(db, userId);
    if ((r.skipIfDone || slot === 'late') && habit(data, t.day).practisedToday) { out.push(`${slot}: already practised`); continue; }
    try {
      await sendReminder(env, userId, buildReminder(data, settings, { today: t.day, late: slot === 'late' }));
      await setPrivate(db, userId, 'reminderLast', JSON.stringify({ at: now.toISOString(), ok: true }));
      out.push(`${slot}: sent`);
    } catch (e) {
      await setPrivate(db, userId, 'reminderLast', JSON.stringify({ at: now.toISOString(), ok: false, error: e.message }));
      out.push(`${slot}: ${e.message}`);
    }
  }
  return out.join(', ') || 'nothing due';
}

export async function sessionsAndCheckins(db, userId) {
  const { results } = await db.prepare("SELECT col, id, data FROM docs WHERE user_id = ? AND col IN ('sessions', 'checkins')").bind(userId).all();
  const data = { sessions: {}, checkins: {} };
  for (const row of results) { try { data[row.col][row.id] = JSON.parse(row.data); } catch { /* skip */ } }
  return data;
}
