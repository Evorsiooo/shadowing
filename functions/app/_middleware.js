// /app/* — the app itself. Visitors without a session cookie are sent to Google sign-in and come back here.
// Only the cookie's presence is checked, so the page needs no database round trip: the app's own
// first requests (/api/health, /api/docs) check the session properly, and the app goes back to
// sign-in from there if it has expired (boot() in 99-main.js). The page itself holds no user data.
import { readCookie, SESSION_COOKIE } from '../../server/auth.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const local = ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  if (!readCookie(request, SESSION_COOKIE) && !(env.DEV_NO_AUTH === '1' && local)) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    return new Response(null, { status: 302, headers: { location: `/auth/google?next=${next}`, 'cache-control': 'no-store' } });
  }
  const resp = await ctx.next();
  // the app is private: never cached by shared caches, never indexed
  const out = new Response(resp.body, resp);
  out.headers.set('cache-control', 'private, no-cache');
  out.headers.set('x-robots-tag', 'noindex');
  return out;
}
