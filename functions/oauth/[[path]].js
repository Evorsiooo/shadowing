// /oauth/* — the sign-in that lets AI apps use the MCP server on a user's behalf (server/oauth.js).
import { register, authorizeGet, authorizePost, token, revoke, CORS } from '../../server/oauth.js';
import { requestLang, localise } from '../../server/i18n.js';

// messages and pages go out in the user's language (server/i18n.js)
export async function onRequest(ctx) { return localise(await handle(ctx), requestLang(ctx.request)); }

async function handle(ctx) {
  const { request, env, params } = ctx;
  const path = (Array.isArray(params.path) ? params.path : []).join('/');
  const url = new URL(request.url);
  const m = request.method;
  try {
    if (m === 'OPTIONS' && path !== 'authorize') return new Response(null, { status: 204, headers: CORS });
    if (path === 'authorize' && m === 'GET') return await authorizeGet(request, env, url);
    if (path === 'authorize' && m === 'POST') return await authorizePost(request, env, url);
    if (path === 'register' && m === 'POST') return await register(request, env);
    if (path === 'token' && m === 'POST') return await token(request, env, url);
    if (path === 'revoke' && m === 'POST') return await revoke(request, env);
    return new Response('Not found', { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server_error', error_description: 'Something went wrong.' }), { status: 500, headers: { 'content-type': 'application/json', ...CORS } });
  }
}
