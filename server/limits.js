// Per-user rate limits, counted in the `private` table: at most `max` hits per `windowMs`.
// Throws a 429 error with a readable message when a user goes over.
import { getPrivate, setPrivate } from './reminders.js';

export async function limit(db, userId, name, max, windowMs, message) {
  const now = Date.now();
  let r = {};
  try { r = JSON.parse(await getPrivate(db, userId, name)) || {}; } catch { /* reset */ }
  if (!r.start || now - r.start > windowMs) r = { start: now, n: 0 };
  if (r.n >= max) throw Object.assign(new Error(message || 'Too many requests. Try again a bit later.'), { status: 429 });
  r.n++;
  await setPrivate(db, userId, name, JSON.stringify(r));
}
