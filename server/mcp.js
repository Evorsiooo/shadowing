// The per-user MCP server's tools (Streamable HTTP, stateless JSON responses). Every tool is read-only
// and every query is scoped to the signed-in user's id. It never sees the `private` table (Discord
// webhook, AI keys, Drive tokens), and recordings stay on the user's device and Drive.
import { COLLECTIONS, validCol, validId } from './util.js';
import { allDocs, getDoc } from './store.js';

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'euno-shadowing', title: 'Euno Shadowing', version: '1.0.0' };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** Handle one JSON-RPC message (or a batch). Returns the response body, or null for notifications only. */
export async function handleRpc(msg, ctx) {
  const batch = Array.isArray(msg);
  const out = [];
  for (const m of batch ? msg : [msg]) {
    const r = await handle(m, ctx);
    if (r) out.push(r);
  }
  if (!out.length) return null;
  return batch ? out : out[0];
}

function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }

async function handle(m, ctx) {
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
          const out = await tool.run((m.params && m.params.arguments) || {}, ctx);
          const text = typeof out === 'string' ? out : JSON.stringify(out, null, 1);
          return rpcResult(m.id, { content: [{ type: 'text', text }], ...(out && typeof out === 'object' && !Array.isArray(out) ? { structuredContent: out } : {}) });
        } catch (e) {
          return rpcResult(m.id, { isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] });
        }
      }
      case 'resources/list': return rpcResult(m.id, { resources: [] });
      case 'prompts/list': return rpcResult(m.id, { prompts: [] });
      default:
        if (isNotification) return null; // notifications/initialized etc.
        return rpcError(m.id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    console.error(e);
    return isNotification ? null : rpcError(m.id, -32603, 'Server error');
  }
}

const INSTRUCTIONS = `Euno Shadowing: the user's accent practice by shadowing (repeating a speaker a fraction of a second behind).
This server is read-only and shows only the signed-in user's own data, stored as JSON records in collections: ${COLLECTIONS.join(', ')}.
- videos {title, url, speaker, archived, added}
- clips {videoId, start, end, label, sentence?, done, doneAt, archived, noisy, model{...pitch and timing measures}}
- sessions {date, clipId, videoId, mode: full|badday|review, stepsCompleted[], passes[{step, n, lag, recorded, recId}], minutes, complete}
- recordings {kind: pass|checkin, sessionId?, clipId?, step?, slot?, week?, task?, lag, score, analysis, measures} (the audio itself stays on the user's device and Google Drive)
- notes {clipId, sessionId, sentence, off (what sounded off), aim, reply (AI feedback), issueId, date}
- issues {name, noteIds[], status: open|fixed, lastSeen, mergedInto?}
- checkins {week: 0|4|8|12, date, recs, questions[], measures}
- meta: settings (routine settings and target accent profile), app, voice
Lag is in seconds (positive = behind the speaker). Pitch lines ("st") are semitones relative to the speaker's own median, at 10 ms hops.
Start with get_overview. Use search to find notes, issues, clips and videos by text.`;

const colProp = { type: 'string', enum: COLLECTIONS, description: 'Collection name' };

const TOOLS = [
  {
    name: 'get_overview',
    title: 'Practice overview',
    description: 'Summary of the user’s practice: streak, days practised this week, minutes, clips done, open pronunciation issues, check-ins, average lag by week, recent sessions and current settings. Start here.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Practice overview', ...READ_ONLY },
    run: async (_a, { env, user }) => overview(await allDocs(env.DB, user.userId)),
  },
  {
    name: 'list_records',
    title: 'List records',
    description: 'List the user’s records in one collection, most recently changed first. Optional exact-match filter on top-level fields (e.g. {"clipId": "..."}). Long number arrays (pitch lines) are shortened unless full=true.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: colProp,
        where: { type: 'object', description: 'Exact-match filters on top-level fields, e.g. {"done": true}', additionalProperties: true },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
        full: { type: 'boolean', default: false },
      },
      required: ['collection'],
    },
    annotations: { title: 'List records', ...READ_ONLY },
    run: async (a, { env, user }) => {
      if (!validCol(a.collection)) throw new Error('Unknown collection.');
      const limit = Math.min(Math.max(parseInt(a.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(a.offset, 10) || 0, 0);
      const where = a.where && typeof a.where === 'object' && !Array.isArray(a.where) ? Object.entries(a.where) : [];
      const { results } = await env.DB.prepare('SELECT id, data FROM docs WHERE user_id = ? AND col = ? ORDER BY updated_at DESC').bind(user.userId, a.collection).all();
      const rows = [];
      for (const r of results) {
        let d;
        try { d = { ...JSON.parse(r.data), id: r.id }; } catch { continue; }
        if (where.every(([k, v]) => JSON.stringify(d[k]) === JSON.stringify(v))) rows.push(d);
      }
      const page = rows.slice(offset, offset + limit);
      return { collection: a.collection, total: rows.length, offset, records: a.full ? page : page.map(trim) };
    },
  },
  {
    name: 'get_record',
    title: 'Get a record',
    description: 'Get one of the user’s records in full by collection and id.',
    inputSchema: { type: 'object', properties: { collection: colProp, id: { type: 'string' } }, required: ['collection', 'id'] },
    annotations: { title: 'Get a record', ...READ_ONLY },
    run: async (a, { env, user }) => {
      if (!validCol(a.collection) || !validId(a.id)) throw new Error('Bad collection or id.');
      const doc = await getDoc(env.DB, user.userId, a.collection, a.id);
      if (!doc) throw new Error('Not found.');
      return doc;
    },
  },
  {
    // `search` and `fetch` follow the shape ChatGPT expects of connectors, and work in any client.
    name: 'search',
    title: 'Search practice data',
    description: 'Search the user’s notes (what sounded off and the feedback), pronunciation issues, clips and videos by text. Returns ids to pass to fetch.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Words to look for' } }, required: ['query'] },
    annotations: { title: 'Search practice data', ...READ_ONLY },
    run: async (a, { env, user, origin }) => {
      const words = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
      const data = await allDocs(env.DB, user.userId);
      const results = [];
      for (const col of SEARCHABLE) {
        for (const d of Object.values(data[col])) {
          const text = searchText(col, d).toLowerCase();
          if (!words.length || words.every((w) => text.includes(w))) results.push({ id: `${col}:${d.id}`, title: titleOf(col, d, data), url: `${origin}/app`, at: d.date || d.lastSeen || d.added || '' });
        }
      }
      results.sort((x, y) => (x.at < y.at ? 1 : -1));
      return { results: results.slice(0, 25).map(({ at, ...r }) => r) };
    },
  },
  {
    name: 'fetch',
    title: 'Fetch a search result',
    description: 'Get one record by an id from search, written as "collection:id" (e.g. "notes:abc123").',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { title: 'Fetch a search result', ...READ_ONLY },
    run: async (a, { env, user, origin }) => {
      const [col, id] = String(a.id || '').split(/:(.*)/s);
      if (!validCol(col) || !validId(id)) throw new Error('Use an id from search, like "notes:abc123".');
      const doc = await getDoc(env.DB, user.userId, col, id);
      if (!doc) throw new Error('Not found.');
      return { id: `${col}:${id}`, title: titleOf(col, doc, null), text: JSON.stringify(trim(doc), null, 1), url: `${origin}/app`, metadata: { collection: col } };
    },
  },
];

const SEARCHABLE = ['notes', 'issues', 'clips', 'videos'];
function searchText(col, d) {
  if (col === 'notes') return [d.sentence, d.off, d.aim, typeof d.reply === 'string' ? d.reply : JSON.stringify(d.reply || '')].join(' ');
  if (col === 'issues') return [d.name, d.status].join(' ');
  if (col === 'clips') return [d.label, d.sentence].join(' ');
  return [d.title, d.speaker].join(' ');
}
function titleOf(col, d, data) {
  if (col === 'notes') return `Note${d.date ? ` (${d.date})` : ''}: ${d.off || d.sentence || d.id}`.slice(0, 140);
  if (col === 'issues') return `Issue: ${d.name || d.id}${d.status ? ` (${d.status})` : ''}`;
  if (col === 'clips') return `Clip: ${d.label || d.sentence || d.id}`.slice(0, 140);
  if (col === 'videos') return `Video: ${d.title || d.id}`;
  if (col === 'sessions') {
    const clip = data && data.clips[d.clipId];
    return `Session ${d.date || d.id}${clip ? `: ${clip.label || ''}` : ''}`;
  }
  return `${col}: ${d.id}`;
}

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

export function overview(data, today = dayKey()) {
  const sessions = Object.values(data.sessions).filter((s) => !s.empty && s.passes && s.passes.length);
  const days = new Map();
  for (const s of sessions) if (days.get(s.date) !== 'full') days.set(s.date, s.mode === 'badday' ? 'bad' : 'full');
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
    checkins: Object.values(data.checkins).map((c) => ({ week: c.week, date: c.date, takes: Object.fromEntries(Object.entries(c.recs || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])), measures: c.measures })),
    recentSessions: sessions.sort((a, b) => (String(a.startedAt || a.date) < String(b.startedAt || b.date) ? 1 : -1)).slice(0, 10).map((s) => ({
      id: s.id, date: s.date, mode: s.mode, clip: clipName(s.clipId), minutes: s.minutes, complete: s.complete, passes: s.passes.length,
      lags: s.passes.map((p) => p.lag).filter((x) => x != null),
    })),
    settings: data.meta.settings ? trim(data.meta.settings) : '(defaults)',
  };
}
