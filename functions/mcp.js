// /mcp — the per-user MCP server (Streamable HTTP, stateless JSON). Claude, ChatGPT and Gemini
// connect with OAuth (server/oauth.js); each access token belongs to one user, and the tools only
// read that user's data (server/mcp.js).
import { verifyBearer, unauthorized, CORS } from '../server/oauth.js';
import { handleRpc } from '../server/mcp.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const origin = new URL(request.url).origin;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const user = await verifyBearer(request, env);
  if (!user) return unauthorized(origin, request.headers.get('authorization') ? 'invalid_token' : null);
  // stateless: no server-to-client stream and no session to end
  if (request.method === 'GET' || request.method === 'DELETE') return new Response(null, { status: 405, headers: { allow: 'POST', ...CORS } });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST', ...CORS } });
  let msg;
  try { msg = await request.json(); } catch { return reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const out = await handleRpc(msg, { env, user, origin });
  if (!out) return new Response(null, { status: 202, headers: CORS });
  return reply(out);
}

function reply(body) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
}
