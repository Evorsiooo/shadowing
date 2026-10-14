// /.well-known/* — OAuth discovery for the MCP server (server/oauth.js).
import { protectedResourceMetadata, authServerMetadata, CORS } from '../../server/oauth.js';

export async function onRequest(ctx) {
  const { request, params } = ctx;
  const path = (Array.isArray(params.path) ? params.path : []).join('/');
  const origin = new URL(request.url).origin;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  let body = null;
  if (path === 'oauth-protected-resource' || path === 'oauth-protected-resource/mcp') body = protectedResourceMetadata(origin);
  // RFC 8414 and the OpenID-style path some clients try first
  else if (path === 'oauth-authorization-server' || path === 'oauth-authorization-server/mcp' || path === 'openid-configuration') body = authServerMetadata(origin);
  if (!body || request.method !== 'GET') return ctx.next();
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600', ...CORS } });
}
