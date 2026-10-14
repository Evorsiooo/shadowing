// /app/* — the app itself. Signed-out visitors are sent to Google sign-in and come back here.
import { requireUser } from '../../server/auth.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const auth = await requireUser(request, env);
  if (!auth.ok && auth.status === 401) {
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
