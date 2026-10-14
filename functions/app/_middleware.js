// /app/* — the app itself. Signed-out visitors are sent to Google sign-in and come back here.
import { requireUser } from '../../server/auth.js';
import { requestLang, localise } from '../../server/i18n.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  let auth;
  try { auth = await requireUser(request, env); } catch (e) {
    console.error(e);
    return localise(new Response(DOWN, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '30' } }), requestLang(request));
  }
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

// shown when the database can't be reached to check the sign-in
const DOWN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Back in a moment · Euno Shadowing</title>
<style>:root{color-scheme:light dark}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}main{max-width:420px}h1{font-size:1.4rem;margin:0 0 .5rem}a{color:inherit}</style>
</head><body><main><h1>Back in a moment</h1><p>Euno Shadowing can’t reach its database right now. Your practice data is safe. Reload this page in a minute.</p><p><a href="/">Back to the home page</a></p></main></body></html>`;
