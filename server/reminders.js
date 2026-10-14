// Practice reminders posted to a Discord webhook. Used by the reminders Worker (cron, every
// 15 minutes) and by /api/reminders (setup and "send a test").
// The webhook URL lives in the `private` table, which the docs API and MCP tools never return.

const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,120}$/;
export function validWebhook(url) { return typeof url === 'string' && WEBHOOK_RE.test(url.trim()); }

export async function getPrivate(db, key) {
  const row = await db.prepare('SELECT value FROM private WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
export async function setPrivate(db, key, value) {
  if (value == null) { await db.prepare('DELETE FROM private WHERE key = ?').bind(key).run(); return; }
  await db.prepare('INSERT INTO private (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .bind(key, String(value), Date.now()).run();
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

/* ---------- the message ---------- */
export function buildMessage(data, settings, { today, late = false, test = false } = {}) {
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
  const embed = { title, description: lines.join('\n'), color: 0x58cc02 };
  if (r.appUrl) embed.url = r.appUrl; // the title links to the app
  // Mentions only ping from `content`, and only the user listed in allowed_mentions (nothing else can ping)
  const userId = validUserId(r.discordUserId) ? r.discordUserId.trim() : null;
  const content = [userId ? `<@${userId}>` : '', r.appUrl ? `<${r.appUrl}>` : ''].filter(Boolean).join(' ');
  return { username: 'Shadowing practice', content, embeds: [embed], allowed_mentions: userId ? { parse: [], users: [userId] } : { parse: [] } };
}

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

/* ---------- the cron job: send what's due, at most once per slot per day ---------- */
export async function runReminders(env, now = new Date()) {
  const settingsRow = await env.DB.prepare("SELECT data FROM docs WHERE col = 'meta' AND id = 'settings'").first();
  const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
  const r = { ...REMINDER_DEFAULTS, ...(settings.reminders || {}) };
  if (!r.enabled) return 'disabled';
  const webhook = await getPrivate(env.DB, 'discordWebhook');
  if (!webhook) return 'no webhook';
  const t = localNow(r.tz, now);
  if (!r.days.includes(t.weekday)) return 'not a reminder day';
  const slots = [['main', toMinutes(r.time)], ['late', toMinutes(r.lateTime)]].filter(([, m]) => m != null);
  const out = [];
  for (const [slot, at] of slots) {
    // due from the set time for an hour (covers a late or skipped cron run)
    if (t.minutes < at || t.minutes >= at + 60) continue;
    const sentKey = `reminderSent:${slot}`;
    if ((await getPrivate(env.DB, sentKey)) === t.day) continue;
    await setPrivate(env.DB, sentKey, t.day);
    const data = await sessionsAndCheckins(env.DB);
    if ((r.skipIfDone || slot === 'late') && habit(data, t.day).practisedToday) { out.push(`${slot}: already practised`); continue; }
    try {
      await postDiscord(webhook, buildMessage(data, settings, { today: t.day, late: slot === 'late' }));
      await setPrivate(env.DB, 'reminderLast', JSON.stringify({ at: now.toISOString(), ok: true }));
      out.push(`${slot}: sent`);
    } catch (e) {
      await setPrivate(env.DB, 'reminderLast', JSON.stringify({ at: now.toISOString(), ok: false, error: e.message }));
      out.push(`${slot}: ${e.message}`);
    }
  }
  return out.join('; ') || 'nothing due';
}

export async function sessionsAndCheckins(db) {
  const { results } = await db.prepare("SELECT col, id, data FROM docs WHERE col IN ('sessions', 'checkins')").all();
  const data = { sessions: {}, checkins: {} };
  for (const row of results) { try { data[row.col][row.id] = JSON.parse(row.data); } catch { /* skip */ } }
  return data;
}
