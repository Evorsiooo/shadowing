// /mcp/<MCP_TOKEN> — a Model Context Protocol server (Streamable HTTP, stateless JSON)
// that gives Claude full read/write access to the practice data and recordings.
// Cloudflare Access must bypass /mcp/*; the secret token in the path is the lock.
import { json, safeEqual, validCol, validId, validKey, COLLECTIONS, uuid } from '../../server/util.js';
import { allDocs, listDocs, getDoc, putDoc, deleteDoc, serveFile } from '../../server/store.js';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'shadowing-practice', version: '1.0.0' };

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const [token, ...rest] = Array.isArray(params.path) ? params.path : [];
  if (!env.MCP_TOKEN || env.MCP_TOKEN.length < 24 || !token || !safeEqual(token, env.MCP_TOKEN)) return new Response('Not found', { status: 404 });
  const base = `${new URL(request.url).origin}/mcp/${token}`;

  if (rest[0] === 'files') {
    const key = rest.slice(1).join('/');
    if (!validKey(key)) return new Response('Bad key', { status: 400 });
    return serveFile(env.FILES, key, request);
  }
  if (request.method === 'GET') return new Response('Shadowing Practice MCP server. POST JSON-RPC here.', { status: 405, headers: { allow: 'POST' } });
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let msg;
  try { msg = await request.json(); } catch { return json(rpcError(null, -32700, 'Parse error')); }
  const batch = Array.isArray(msg);
  const results = [];
  for (const m of batch ? msg : [msg]) {
    const r = await handle(m, env, base);
    if (r) results.push(r);
  }
  if (!results.length) return new Response(null, { status: 202 });
  return json(batch ? results : results[0]);
}

function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }

async function handle(m, env, base) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m && m.id != null ? m.id : null, -32600, 'Invalid request');
  const isNotification = m.id === undefined || m.id === null;
  try {
    switch (m.method) {
      case 'initialize': {
        const want = m.params && m.params.protocolVersion;
        return rpcResult(m.id, {
          protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return rpcResult(m.id, {});
      case 'tools/list': return rpcResult(m.id, { tools: TOOLS.map(({ run, ...t }) => t) });
      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === (m.params && m.params.name));
        if (!tool) return rpcError(m.id, -32602, `Unknown tool: ${m.params && m.params.name}`);
        try {
          const out = await tool.run(m.params.arguments || {}, env, base);
          return rpcResult(m.id, out && out.content ? out : { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 1) }] });
        } catch (e) {
          return rpcResult(m.id, { isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] });
        }
      }
      default:
        if (isNotification) return null; // notifications/initialized etc.
        return rpcError(m.id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    return isNotification ? null : rpcError(m.id, -32603, e.message);
  }
}

const INSTRUCTIONS = `Adrien's shadowing practice app (General Australian English accent training).
Data is stored as JSON records in collections: ${COLLECTIONS.join(', ')}.
- videos {title, url, r2Key?, speaker, archived, added}
- clips {videoId, start, end, label, sentence?, done, doneAt, archived, noisy, model{hop, st[], db[], refHz, onset, reliability, measures}}
- sessions {date, clipId, videoId, mode: full|badday|review, stepsCompleted[], passes[{step, n, lag, recorded, recId}], minutes, complete, recs{step3, final}}
- recordings {kind: pass|checkin, sessionId?, clipId?, step?, slot?, week?, task?, ref "r2:<key>", lag, score, analysis, measures}
- notes {clipId, sessionId, sentence, off, aim, reply, issueId, date}
- issues {name, noteIds[], status: open|fixed, lastSeen, mergedInto?}
- checkins {week: 0|4|8|12, date, recs{read[], retell[], answer[]}, questions[], measures}
- meta: settings (all routine settings), app, voice, listener packs
Lag is in seconds (positive = behind the speaker). Pitch lines ("st") are semitones relative to the speaker's own median, at 10 ms hops.
Start with get_overview. Use get_file to fetch a recording's audio. Writes are live in the app on its next load.`;

const colProp = { type: 'string', enum: COLLECTIONS, description: 'Collection name' };

const TOOLS = [
  {
    name: 'get_overview',
    description: 'Summary of the practice: streak, sessions this week, minutes, clips done, open issues, check-in status, average lag trend, recent sessions and current settings. Start here.',
    inputSchema: { type: 'object', properties: {} },
    run: async (_a, env) => overview(await allDocs(env.DB)),
  },
  {
    name: 'list_records',
    description: 'List records in a collection, newest first. Optional exact-match filter on top-level fields (e.g. {"clipId": "..."}). Large arrays (pitch lines, waveforms) are trimmed unless full=true.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: colProp,
        where: { type: 'object', description: 'Exact-match filters on fields, e.g. {"done": true}', additionalProperties: true },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
        full: { type: 'boolean', default: false },
      },
      required: ['collection'],
    },
    run: async (a, env) => {
      if (!validCol(a.collection)) throw new Error('Unknown collection');
      const rows = await listDocs(env.DB, a.collection, { limit: a.limit || 50, offset: a.offset || 0, where: a.where });
      return a.full ? rows : rows.map(trim);
    },
  },
  {
    name: 'get_record',
    description: 'Get one record in full by collection and id.',
    inputSchema: { type: 'object', properties: { collection: colProp, id: { type: 'string' } }, required: ['collection', 'id'] },
    run: async (a, env) => {
      if (!validCol(a.collection) || !validId(a.id)) throw new Error('Bad collection or id');
      return (await getDoc(env.DB, a.collection, a.id)) || 'Not found';
    },
  },
  {
    name: 'put_record',
    description: 'Create or update a record. With merge=true (default) the given fields are merged into the existing record; with merge=false the record is replaced. Omit id to create a new record. Returns the saved record.',
    inputSchema: {
      type: 'object',
      properties: { collection: colProp, id: { type: 'string' }, data: { type: 'object', additionalProperties: true }, merge: { type: 'boolean', default: true } },
      required: ['collection', 'data'],
    },
    run: async (a, env) => {
      if (!validCol(a.collection)) throw new Error('Unknown collection');
      const id = a.id || uuid().slice(0, 14);
      if (!validId(id)) throw new Error('Bad id');
      const cur = a.merge === false ? null : await getDoc(env.DB, a.collection, id);
      return trim(await putDoc(env.DB, a.collection, id, { ...(cur || {}), ...a.data }));
    },
  },
  {
    name: 'delete_record',
    description: 'Delete one record. Prefer archiving (archived: true) for videos and clips; the app never deletes them itself.',
    inputSchema: { type: 'object', properties: { collection: colProp, id: { type: 'string' } }, required: ['collection', 'id'] },
    run: async (a, env) => {
      if (!validCol(a.collection) || !validId(a.id)) throw new Error('Bad collection or id');
      await deleteDoc(env.DB, a.collection, a.id);
      return 'Deleted.';
    },
  },
  {
    name: 'query_sql',
    description: "Run a read-only SQL query on the D1 database. Table: docs(col TEXT, id TEXT, data TEXT JSON, updated_at INTEGER ms). Use json_extract(data, '$.field'). Example: SELECT id, json_extract(data,'$.date') d, json_extract(data,'$.minutes') m FROM docs WHERE col='sessions' ORDER BY d DESC LIMIT 20",
    inputSchema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
    run: async (a, env) => {
      const sql = String(a.sql || '').trim().replace(/;\s*$/, '');
      if (!/^(select|with)\b/i.test(sql) || sql.includes(';') || /\b(insert|update|delete|drop|alter|create|replace|pragma|attach|vacuum)\b/i.test(sql)) throw new Error('Only a single SELECT query is allowed.');
      if (/\b(private|sqlite_\w+|_cf_\w+|d1_\w+)\b/i.test(sql)) throw new Error('Only the docs table can be queried.');
      const { results } = await env.DB.prepare(sql).all();
      return results.slice(0, 1000);
    },
  },
  {
    name: 'list_files',
    description: 'List stored files (recordings and videos) in R2. Prefixes: rec/ (session passes), checkin/, video/.',
    inputSchema: { type: 'object', properties: { prefix: { type: 'string', default: '' }, cursor: { type: 'string' } } },
    run: async (a, env) => {
      const r = await env.FILES.list({ prefix: a.prefix || '', cursor: a.cursor || undefined, limit: 500, include: ['httpMetadata'] });
      return { files: r.objects.map((o) => ({ key: o.key, ref: `r2:${o.key}`, size: o.size, uploaded: o.uploaded, type: o.httpMetadata && o.httpMetadata.contentType })), cursor: r.truncated ? r.cursor : null };
    },
  },
  {
    name: 'get_file',
    description: 'Get a stored file by ref ("r2:<key>") or key. Returns a download URL (valid while the MCP token is) and, for audio up to 8 MB when inline=true, the audio itself.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string' }, inline: { type: 'boolean', default: false } }, required: ['ref'] },
    run: async (a, env, base) => {
      const key = String(a.ref || '').replace(/^r2:/, '');
      if (!validKey(key)) throw new Error('Bad ref');
      const head = await env.FILES.head(key);
      if (!head) throw new Error('File not found');
      const type = (head.httpMetadata && head.httpMetadata.contentType) || 'application/octet-stream';
      const content = [{ type: 'text', text: JSON.stringify({ key, size: head.size, type, url: `${base}/files/${key}` }) }];
      if (a.inline && head.size <= 8 * 1024 * 1024 && /^(audio|video)\//.test(type)) {
        const obj = await env.FILES.get(key);
        const bytes = new Uint8Array(await obj.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        content.push({ type: 'audio', mimeType: type.replace(/^video\//, 'audio/'), data: btoa(bin) });
      }
      return { content };
    },
  },
];

/* strip long numeric arrays so listings stay readable */
function trim(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (Array.isArray(v) && v.length > 40 && v.every((x) => x === null || typeof x === 'number')) out[k] = `[${v.length} values]`;
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = trim(v);
    else out[k] = v;
  }
  return out;
}

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function addDays(k, n) { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); }

function overview(data) {
  const sessions = Object.values(data.sessions).filter((s) => !s.empty && s.passes && s.passes.length);
  const days = new Map();
  for (const s of sessions) if (days.get(s.date) !== 'full') days.set(s.date, s.mode === 'badday' ? 'bad' : 'full');
  const today = dayKey();
  let streak = 0, d = days.has(today) ? today : addDays(today, -1), gap = 0;
  const first = [...days.keys()].sort()[0];
  while (first && d >= first) { if (days.has(d)) { streak++; gap = 0; } else if (++gap >= 2) break; d = addDays(d, -1); }
  const wd = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const ws = addDays(today, -wd);
  const lagByWeek = {};
  for (const s of sessions) for (const p of s.passes) if (p.lag != null) {
    const w = addDays(s.date, -((new Date(s.date + 'T00:00:00Z').getUTCDay() + 6) % 7));
    (lagByWeek[w] ||= []).push(p.lag);
  }
  const clips = Object.values(data.clips).filter((c) => !c.archived);
  const issues = Object.values(data.issues).filter((i) => !i.mergedInto);
  const clipName = (id) => { const c = data.clips[id]; return c ? c.label || `clip at ${Math.round(c.start)}s` : id; };
  return {
    today,
    streakDays: streak,
    daysPractisedThisWeek: [...days.keys()].filter((k) => k >= ws && k <= today).length,
    totalMinutes: Math.round(sessions.reduce((a, s) => a + (s.minutes || 0), 0)),
    sessions: sessions.length,
    clips: { total: clips.length, done: clips.filter((c) => c.done).length, noisy: clips.filter((c) => c.noisy).length },
    videos: Object.values(data.videos).filter((v) => !v.archived).map((v) => ({ id: v.id, title: v.title, speaker: v.speaker })),
    averageLagByWeek: Object.fromEntries(Object.entries(lagByWeek).sort().map(([w, a]) => [w, Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100])),
    openIssues: issues.filter((i) => i.status !== 'fixed').map((i) => ({ id: i.id, name: i.name, notes: (i.noteIds || []).length, lastSeen: i.lastSeen })),
    checkins: Object.values(data.checkins).map((c) => ({ week: c.week, date: c.date, takes: Object.fromEntries(Object.entries(c.recs || {}).map(([k, v]) => [k, v.length])), measures: c.measures })),
    recentSessions: sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 10).map((s) => ({
      id: s.id, date: s.date, mode: s.mode, clip: clipName(s.clipId), minutes: s.minutes, complete: s.complete, passes: s.passes.length,
      lags: s.passes.map((p) => p.lag).filter((x) => x != null), recordings: s.recs,
    })),
    settings: data.meta.settings || '(defaults)',
  };
}
