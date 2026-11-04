// /auth/* — Sign in with Google and sign out.
//   GET  /auth/google?next=/app&invite=CODE  start sign-in (shows an invite-code page in invite-only mode)
//   GET  /auth/google/callback               Google sends the user back here (sign-in or Drive)
//   GET  /auth/drive?next=/app               connect Google Drive for the signed-in user
//   GET  /auth/drive/done                    end of connecting Drive in the app's small window
//   POST /auth/logout                        sign out (also accepts GET from a plain link)
import {
  startGoogle, readOAuthCookie, exchangeCode, verifyIdToken, upsertGoogleUser, createSession, endSession,
  getConfig, cleanInvite, inviteUsable, cookie, OAUTH_COOKIE, requireUser,
} from '../../server/auth.js';
import { startDrive, finishDrive } from '../../server/drive.js';
import { requestLang, localise } from '../../server/i18n.js';
import { EUNO_MARK } from '../../server/euno-mark.js';

const APP = '/app';

// messages and pages go out in the user's language (server/i18n.js)
export async function onRequest(ctx) { return localise(await handle(ctx), requestLang(ctx.request)); }

async function handle(ctx) {
  const { request, env, params } = ctx;
  const path = (Array.isArray(params.path) ? params.path : []).join('/');
  const url = new URL(request.url);
  try {
    if (path === 'google' && request.method === 'GET') return await start(request, env, url);
    if (path === 'google/callback' && request.method === 'GET') return await callback(request, env, url);
    if (path === 'drive' && request.method === 'GET') return await connectDrive(request, env, url);
    if (path === 'drive/done' && request.method === 'GET') return driveDone(url);
    if (path === 'logout' && (request.method === 'POST' || request.method === 'GET')) {
      const headers = new Headers({ location: '/', 'cache-control': 'no-store' });
      headers.append('set-cookie', await endSession(request, env));
      return new Response(null, { status: 303, headers });
    }
    return page('Not found', '<p>There’s nothing here.</p>', 404);
  } catch (e) {
    console.error(e);
    return page('Sign-in failed', `<p>${esc(e.message || 'Something went wrong.')}</p>${tryAgain()}`, 500);
  }
}

/** Only same-site paths, so the redirect after sign-in can't send people elsewhere. */
function safeNext(v) {
  return typeof v === 'string' && /^\/(?![/\\])[\x21-\x7e]{0,300}$/.test(v) ? v : APP;
}

async function start(request, env, url) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return page('Sign-in isn’t set up yet', '<p>The server has no Google sign-in credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).</p>', 503);
  }
  const next = safeNext(url.searchParams.get('next'));
  const invite = cleanInvite(url.searchParams.get('invite'));
  // Invite-only: ask for a code up front. Existing members can still sign in without one.
  if ((await getConfig(env.DB, 'signup', 'open')) === 'invite' && !url.searchParams.has('member')) {
    if (!invite) return invitePage(next);
    if (!(await inviteUsable(env.DB, invite))) return invitePage(next, 'That invite code isn’t valid or has been used up.');
  }
  const s = await startGoogle(request, env, { next, invite });
  return new Response(null, { status: 302, headers: { location: s.url, 'set-cookie': s.cookie, 'cache-control': 'no-store' } });
}

async function callback(request, env, url) {
  const saved = readOAuthCookie(request);
  const clear = cookie(OAUTH_COOKIE, '', 0);
  if (url.searchParams.get('error') && saved && saved.purpose === 'drive') {
    const back = safeNext(saved.next);
    return redirect(`${back}${back.includes('?') ? '&' : '?'}drive=cancelled`, clear);
  }
  if (url.searchParams.get('error')) return page('Sign-in cancelled', `<p>Google didn’t sign you in (${esc(url.searchParams.get('error'))}).</p>${tryAgain()}`, 400, clear);
  if (!saved || !saved.state || saved.state !== url.searchParams.get('state')) {
    return page('Sign-in expired', '<p>The sign-in took too long or was started in another tab.</p>' + tryAgain(), 400, clear);
  }
  if (saved.purpose === 'drive') return await driveCallback(request, env, url, saved, clear);
  const idToken = await exchangeCode(request, env, url.searchParams.get('code') || '', saved.verifier);
  const claims = await verifyIdToken(idToken, { clientId: env.GOOGLE_CLIENT_ID, nonce: saved.nonce });
  const res = await upsertGoogleUser(env, claims, saved.invite);
  if (res.error) {
    if (res.code === 'invite') return invitePage(saved.next || APP, res.error, clear);
    return page('Can’t sign in', `<p>${esc(res.error)}</p>`, 403, clear);
  }
  const headers = new Headers({ location: safeNext(saved.next), 'cache-control': 'no-store' });
  headers.append('set-cookie', clear);
  headers.append('set-cookie', await createSession(env, res.user.id));
  return new Response(null, { status: 302, headers });
}

/* Google Drive: only for a signed-in user; the callback must come back to the same account. */
async function connectDrive(request, env, url) {
  const next = safeNext(url.searchParams.get('next'));
  const auth = await requireUser(request, env);
  if (!auth.ok) return new Response(null, { status: 302, headers: { location: `/auth/google?next=${encodeURIComponent(next)}`, 'cache-control': 'no-store' } });
  if (!env.KEY_ENCRYPTION_KEY) return page('Drive sync isn’t set up yet', '<p>The server has no KEY_ENCRYPTION_KEY secret, so it can’t keep a Drive connection safely yet.</p><p><a href="/app">Back to the app</a></p>', 503);
  const s = await startDrive(request, env, { id: auth.userId, email: auth.email }, next);
  return new Response(null, { status: 302, headers: { location: s.url, 'set-cookie': s.cookie, 'cache-control': 'no-store' } });
}

async function driveCallback(request, env, url, saved, clear) {
  const back = safeNext(saved.next);
  const sep = back.includes('?') ? '&' : '?';
  const auth = await requireUser(request, env);
  if (!auth.ok || auth.userId !== saved.userId) return page('Drive not connected', '<p>You were signed out while connecting Google Drive. Sign in and try again from Settings → Data.</p><p><a href="/app">Back to the app</a></p>', 400, clear);
  try {
    await finishDrive(request, env, auth.userId, url.searchParams.get('code') || '', saved.verifier);
  } catch (e) {
    return redirect(`${back}${sep}drive=error&reason=${encodeURIComponent(e.message).slice(0, 300)}`, clear);
  }
  return redirect(`${back}${sep}drive=connected`, clear);
}

/* the end of connecting Drive in the app's small window: the app notices the window close */
function driveDone(url) {
  const r = url.searchParams.get('drive');
  const [title, text] = r === 'connected' ? ['Google Drive connected', 'You can close this window and go back to Euno Shadowing.']
    : r === 'cancelled' ? ['Google Drive not connected', 'Nothing changed. You can connect it any time in Settings → Data. Close this window to go back.']
      : ['Google Drive not connected', url.searchParams.get('reason') || 'Something went wrong. Close this window and try again from Settings → Data.'];
  return page(title, `<p>${esc(text)}</p><p><button class="btn" type="button" onclick="window.close()">Close this window</button></p><script>setTimeout(function(){window.close()},${r === 'connected' ? 600 : 4000})</script>`);
}

function redirect(location, setCookie) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  if (setCookie) headers.append('set-cookie', setCookie);
  return new Response(null, { status: 302, headers });
}

/* ---------- tiny self-contained pages (errors and the invite-code form) ---------- */
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function tryAgain() { return '<p><a class="btn" href="/auth/google">Try again</a> <a href="/">Back to the home page</a></p>'; }

function invitePage(next, problem = '', setCookie = null) {
  const body = `
    <p>Euno Shadowing is invite-only right now. Paste your invite code, then sign in with Google.</p>
    ${problem ? `<p class="bad">${esc(problem)}</p>` : ''}
    <form method="get" action="/auth/google">
      <input type="hidden" name="next" value="${esc(next)}">
      <label for="invite">Invite code</label>
      <input id="invite" name="invite" required autocomplete="off" spellcheck="false" autofocus>
      <button class="btn" type="submit">Continue with Google</button>
    </form>
    <p class="small">Already have an account? <a href="/auth/google?member=1&amp;next=${encodeURIComponent(next)}">Sign in</a></p>`;
  return page('Enter your invite code', body, 200, setCookie);
}

function page(title, body, status = 200, setCookie = null) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Euno Shadowing</title>
<style>
:root{color-scheme:light;--bg:#f6f7f3;--card:#fff;--fg:#111316;--muted:#5f645b;--green:#45b52a;--sunk:#eceee9;--ctl:#8a9085;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#111316;--card:#1b1e1a;--fg:#eceee9;--muted:#9da296;--sunk:#252923;--ctl:#7d8378;--bad:#ff8a80}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Rubik,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box;-webkit-font-smoothing:antialiased}
main{max-width:440px;width:100%;position:relative;padding-top:64px}
.mark{position:absolute;top:0;left:28px;width:96px;height:96px}.mark svg{width:100%;height:100%;display:block}
.card{position:relative;background:var(--card);border-radius:36px;padding:32px 28px 28px}
h1{font-size:1.5rem;font-weight:600;letter-spacing:-.015em;line-height:1.2;margin:0 0 .6rem}a{color:inherit;text-decoration-color:var(--green);text-decoration-thickness:2px;text-underline-offset:3px}ul{padding-left:1.2rem}
.row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.25rem}
.btn{display:inline-flex;align-items:center;min-height:44px;background:var(--green);color:#111316;border:0;border-radius:999px;padding:0 1.3rem;font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.btn.ghost{background:var(--sunk);color:var(--fg)}
.small{font-size:.9rem;color:var(--muted)}.bad{color:var(--bad)}
label{display:block;font-weight:500;margin:.5rem 0 .3rem}input{width:100%;box-sizing:border-box;padding:.7rem 1rem;border:0;box-shadow:inset 0 -2px 0 var(--ctl);border-radius:14px 14px 6px 6px;background:var(--sunk);color:inherit;font:inherit;margin-bottom:.9rem;text-transform:uppercase}input:focus{outline:none;box-shadow:inset 0 -3px 0 var(--green)}
</style></head><body><main><span class="mark" aria-hidden="true">${EUNO_MARK}</span><div class="card"><h1>${esc(title)}</h1>${body}</div></main></body></html>`;
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  if (setCookie) headers.append('set-cookie', setCookie);
  return new Response(html, { status, headers });
}
