// The admin page's backend: users, sign-up mode and invite codes, and the support inbox.
// Every route here is reached only after the caller has been checked as an admin (functions/api).
// Nothing here reads anyone's practice data; the user list only counts their sessions.
import { json, error } from './util.js';
import { deleteUser, getConfig } from './auth.js';

const SIGNUP_MODES = ['open', 'invite'];
// No 0/O/1/I so codes survive being read aloud or retyped.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function adminRoute(env, admin, method, rest, request) {
  const [section, id] = rest;
  if (section === 'users') return usersRoute(env, admin, method, id, request);
  if (section === 'signup') return signupRoute(env, method, request);
  if (section === 'invites') return invitesRoute(env, admin, method, id, request);
  if (section === 'support') return supportRoute(env, method, id, request);
  return error(404, 'No such endpoint.');
}

/* ---------- users ---------- */
async function usersRoute(env, admin, method, id, request) {
  const db = env.DB;
  if (!id && method === 'GET') {
    const { results } = await db.prepare(`
      SELECT u.id, u.email, u.name, u.picture, u.role, u.disabled, u.invite_code, u.created, u.last_seen,
        (SELECT COUNT(*) FROM docs d WHERE d.user_id = u.id AND d.col = 'sessions') AS sessions,
        (SELECT MAX(s.last_seen) FROM sessions s WHERE s.user_id = u.id) AS active
      FROM users u ORDER BY u.created DESC`).all();
    return json({ users: results.map((u) => ({ ...u, disabled: !!u.disabled, last_seen: Math.max(u.last_seen || 0, u.active || 0) || null, active: undefined, self: u.id === admin.id })) });
  }
  const user = id ? await db.prepare('SELECT id, email, role FROM users WHERE id = ?').bind(id).first() : null;
  if (!user) return error(404, 'No such user.');
  if (user.id === admin.id) return error(400, 'You can’t do that to your own account here. Use Settings → Data instead.');
  if (user.role === 'admin') return error(400, 'Admin accounts can’t be disabled or deleted from the admin page.');
  if (method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    if (typeof body.disabled !== 'boolean') return error(400, 'Say whether the account should be disabled.');
    const stmts = [db.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(body.disabled ? 1 : 0, user.id)];
    // disabling signs them out everywhere straight away
    if (body.disabled) stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id));
    await db.batch(stmts);
    return json({ ok: true, disabled: body.disabled });
  }
  if (method === 'DELETE') {
    const { confirm } = await request.json().catch(() => ({}));
    if (String(confirm || '').trim().toLowerCase() !== user.email.toLowerCase()) return error(400, 'Type the account’s email address to confirm.');
    await deleteUser(env, user.id);
    return json({ ok: true });
  }
  return error(405, 'Method not allowed.');
}

/* ---------- sign-up mode ---------- */
async function signupRoute(env, method, request) {
  if (method === 'GET') return json({ mode: await getConfig(env.DB, 'signup', 'open') });
  if (method === 'PUT') {
    const { mode } = await request.json().catch(() => ({}));
    if (!SIGNUP_MODES.includes(mode)) return error(400, 'Sign-up mode must be open or invite.');
    await env.DB.prepare('INSERT INTO config (key, value, updated_at) VALUES (\'signup\', ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .bind(mode, Date.now()).run();
    return json({ ok: true, mode });
  }
  return error(405, 'Method not allowed.');
}

/* ---------- invite codes ---------- */
export function newInviteCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
  return `EUNO-${s.slice(0, 4)}-${s.slice(4)}`;
}

async function invitesRoute(env, admin, method, code, request) {
  const db = env.DB;
  if (!code && method === 'GET') {
    const [{ results: invites }, { results: used }] = await Promise.all([
      db.prepare('SELECT code, note, max_uses, uses, expires, created FROM invites ORDER BY created DESC').all(),
      db.prepare('SELECT invite_code, email, created FROM users WHERE invite_code IS NOT NULL ORDER BY created').all(),
    ]);
    const now = Date.now();
    return json({
      invites: invites.map((i) => ({
        ...i,
        status: i.expires && i.expires <= now ? 'ended' : i.uses >= i.max_uses ? 'used' : 'active',
        usedBy: used.filter((u) => u.invite_code === i.code).map((u) => ({ email: u.email, at: u.created })),
      })),
    });
  }
  if (!code && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const maxUses = Math.round(Number(body.maxUses ?? 1));
    if (!(maxUses >= 1 && maxUses <= 1000)) return error(400, 'Uses must be between 1 and 1000.');
    const days = body.expiresDays == null || body.expiresDays === '' ? null : Number(body.expiresDays);
    if (days != null && !(days > 0 && days <= 365)) return error(400, 'Expiry must be between 1 and 365 days, or left empty.');
    const note = String(body.note || '').trim().slice(0, 200) || null;
    const now = Date.now();
    const invite = { code: newInviteCode(), note, max_uses: maxUses, uses: 0, expires: days ? now + Math.round(days * 86400_000) : null, created: now };
    await db.prepare('INSERT INTO invites (code, note, max_uses, uses, expires, created_by, created) VALUES (?, ?, ?, 0, ?, ?, ?)')
      .bind(invite.code, note, maxUses, invite.expires, admin.id, now).run();
    return json({ invite: { ...invite, status: 'active', usedBy: [] } });
  }
  // revoking ends the code now; it stays listed so you can still see who used it
  if (code && method === 'DELETE') {
    const r = await db.prepare('UPDATE invites SET expires = ? WHERE code = ? AND (expires IS NULL OR expires > ?)').bind(Date.now(), code, Date.now()).run();
    if (!r.meta.changes) return error(404, 'No active invite with that code.');
    return json({ ok: true });
  }
  return error(405, 'Method not allowed.');
}

/* ---------- support inbox ---------- */
async function supportRoute(env, method, id, request) {
  const db = env.DB;
  if (!id && method === 'GET') {
    const { results } = await db.prepare(`
      SELECT m.id, m.email, m.message, m.status, m.created, m.user_id, u.name AS user_name
      FROM support_messages m LEFT JOIN users u ON u.id = m.user_id
      ORDER BY m.status = 'done', m.created DESC LIMIT 500`).all();
    return json({ messages: results });
  }
  if (id && method === 'PATCH') {
    const { status } = await request.json().catch(() => ({}));
    if (!['open', 'done'].includes(status)) return error(400, 'Status must be open or done.');
    const r = await db.prepare('UPDATE support_messages SET status = ? WHERE id = ?').bind(status, id).run();
    if (!r.meta.changes) return error(404, 'No such message.');
    return json({ ok: true, status });
  }
  if (id && method === 'DELETE') {
    const r = await db.prepare('DELETE FROM support_messages WHERE id = ?').bind(id).run();
    if (!r.meta.changes) return error(404, 'No such message.');
    return json({ ok: true });
  }
  return error(405, 'Method not allowed.');
}
