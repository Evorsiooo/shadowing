// The per-user MCP server's tools (Streamable HTTP, stateless JSON responses). Every tool is read-only except
// save_about_learner / forget_about_learner, which only add or remove short facts about the learner (server/about.js).
// Every query is scoped to the signed-in user's id. It never sees the `private` table (Discord
// webhook, AI keys, Drive tokens), and recordings stay on the user's device and Drive.
import { COLLECTIONS, validCol, validId } from './util.js';
import { allDocs, getDoc } from './store.js';
import { progressBrief } from './progress.js';
import { readFacts, addFacts, removeFact, cleanFact, MAX_FACTS, MAX_FACT_LENGTH } from './about.js';

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
This server shows only the signed-in user's own data and is read-only, with one exception: save_about_learner and forget_about_learner add or remove short facts about the learner (level, goals, background, how they like to practise). The data is stored as JSON records in collections: ${COLLECTIONS.join(', ')}.
- videos {title, url, speaker, archived, added}
- clips {videoId, start, end, label, sentence?, done, doneAt, archived, noisy, model{...pitch and timing measures}, words? [{w, s, e}] (the speaker's words, seconds from the clip start), speakerPhones? (the speaker's sounds)}
- sessions {date, clipId, videoId, mode: full|badday|review, stepsCompleted[], passes[{step, n, lag, recorded, recId}], minutes, complete}
- recordings {kind: pass|checkin, sessionId?, clipId?, step?, slot?, week?, task?, lag, score, analysis, measures, phones? (sound differences found right after the pass), takeAnalysis? (the learner's sounds and every difference from the speaker)} (the audio itself stays on the user's device and Google Drive)
- notes {clipId, sessionId, sentence, off (what sounded off), aim, reply (AI feedback), issueId, date}
- issues {name, noteIds[], status: open|fixed, lastSeen, mergedInto?}
- checkins {week: 0|4|8|12, date, recs, questions[], measures}
- meta: settings (routine settings and target accent profile), about (short facts about the learner, best read through get_about_learner), app, voice; pron (sound-level history) and prosody (timing/pitch/stress history), best read through get_pronunciation_progress
Lag is in seconds (positive = behind the speaker). Pitch lines ("st") are semitones relative to the speaker's own median, at 10 ms hops.
Start with get_overview, get_progress for whether they have improved (first against recent takes), and get_about_learner to learn who they are. When the learner tells you something lasting about themselves that would help coaching, call save_about_learner (only what they said, never guesses; the learner sees and can delete every fact in the app). Use get_clip_pronunciation for the speaker's and the learner's sounds and words per clip and per take. Use get_pronunciation_progress for how the learner's pronunciation differences are changing over time. Use search to find notes, issues, clips and videos by text.`;

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
    name: 'get_progress',
    title: 'Progress since the start',
    description: 'Has the learner improved? Their first against their most recent takes: timing (lag) behind the speaker, the differences from the speaker per clip they practised more than once, each tracked sound flagged in the first two weeks against the last two weeks, timing/pitch/stress tallies the same way, check-ins, and practice totals. Measurements saved with each take, not audio; use "may". Ask Euno inside the app is given the same figures.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Progress since the start', ...READ_ONLY },
    run: async (_a, { env, user }) => progressBrief(await allDocs(env.DB, user.userId)),
  },
  {
    name: 'get_about_learner',
    title: 'What is known about the learner',
    description: 'The short facts saved about who the learner is (level, goals, background, preferences), plus the profile they filled in: native languages, target language and accent, and their own free-text notes. Facts come from the learner’s chats with Euno and with AI apps; they can edit or delete any of them in the app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'What is known about the learner', ...READ_ONLY },
    run: async (_a, { env, user }) => {
      const [facts, settings] = await Promise.all([readFacts(env.DB, user.userId), getDoc(env.DB, user.userId, 'meta', 'settings')]);
      const p = (settings && settings.profile) || {};
      return {
        profile: { name: p.name || null, nativeLanguages: p.nativeLanguages || null, targetLanguage: p.targetLanguage || 'en', accent: p.accent === 'other' ? p.accentOther || null : p.accent || null, ownNotes: p.notes || null },
        facts: facts.map((f) => ({ id: f.id, fact: f.text, saved: f.at, by: f.by })),
      };
    },
  },
  {
    name: 'save_about_learner',
    title: 'Remember something about the learner',
    description: `Save one short fact the learner just told you about themselves, so Euno and their other AI apps know it next time: their level, goals, background, how they like to practise, what is hard for them. Write it in the third person, one sentence (up to ${MAX_FACT_LENGTH} characters), for example "Is C2 in English except for speaking." Only save what the learner actually said, never your guesses, and nothing sensitive such as health, finances or passwords. The learner sees every saved fact in the app and can delete it. At most ${MAX_FACTS} are kept.`,
    inputSchema: { type: 'object', properties: { fact: { type: 'string', maxLength: MAX_FACT_LENGTH, description: 'One short sentence about the learner' } }, required: ['fact'], additionalProperties: false },
    annotations: { title: 'Remember something about the learner', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (a, { env, user }) => {
      const text = cleanFact(a.fact);
      if (text.length < 3) throw new Error('Send one short sentence about the learner.');
      const { facts, added } = await addFacts(env.DB, user.userId, [text], 'ai');
      return { saved: added.length ? added[0].id : null, alreadyKnown: !added.length, count: facts.length };
    },
  },
  {
    name: 'forget_about_learner',
    title: 'Forget a saved fact about the learner',
    description: 'Remove one saved fact, by the id from get_about_learner, for example when the learner says it is no longer true.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    annotations: { title: 'Forget a saved fact', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: async (a, { env, user }) => {
      if (!validId(a.id)) throw new Error('Use an id from get_about_learner.');
      const { removed } = await removeFact(env.DB, user.userId, a.id);
      return { removed };
    },
  },
  {
    name: 'get_pronunciation_progress',
    title: 'Pronunciation progress',
    description: 'How the learner’s sound-level pronunciation differences from the speaker (English, beta) and timing/pitch/stress differences are changing: per sound pair the state (active, easing, archived), chances vs times flagged in the last 2 weeks and the 2 weeks before, trend, first/last dates and recent example words. Evidence from a speech recogniser that is about 90% right per sound, not fact.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Pronunciation progress', ...READ_ONLY },
    run: async (_a, { env, user }) => pronunciationProgress(await allDocs(env.DB, user.userId)),
  },
  {
    name: 'get_clip_pronunciation',
    title: 'Clip pronunciation (speaker and takes)',
    description: 'Everything saved about how one clip sounds: the speaker’s sounds (IPA, with times) and words, and for each of the learner’s recorded takes the sounds a speech recogniser heard, the differences from the speaker and the old summary. English only; always compared with the speaker’s audio, never a transcript. Without clipId it lists the clips and what is saved for each. Pass detail=true for every sound with its time and confidence.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'A clip id from get_overview, list_records or this tool’s own listing. Leave out to list clips.' },
        detail: { type: 'boolean', default: false, description: 'Include each sound with start/end seconds and confidence (long).' },
      },
    },
    annotations: { title: 'Clip pronunciation', ...READ_ONLY },
    run: async (a, { env, user }) => clipPronunciation(await allDocs(env.DB, user.userId), a.clipId, !!a.detail),
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
    pronunciation: pronunciationSummary(data),
  };
}

/* ---- pronunciation history (written by the browser into meta/pron and meta/prosody as daily buckets {d, f: flagged, o: chances}) ---- */
const WINDOW = 14, MIN_CHANCES = 6, TREND_GAP = 0.2; // same rule as Pron.trend in src/js/24-pron.js
function sumBk(bk, from, to) { let f = 0, o = 0; for (const b of bk || []) if (b.d >= from && b.d <= to) { f += b.f; o += b.o; } return { f, o }; }
function trendOf(bk, today) {
  const recent = sumBk(bk, addDays(today, -(WINDOW - 1)), today);
  const before = sumBk(bk, addDays(today, -(2 * WINDOW - 1)), addDays(today, -WINDOW));
  let trend = 'not enough practice yet to tell';
  if (recent.o >= MIN_CHANCES && before.o >= MIN_CHANCES) {
    const gap = recent.f / recent.o - before.f / before.o;
    trend = gap <= -TREND_GAP ? 'less often' : gap >= TREND_GAP ? 'more often' : 'about the same';
  }
  return { recent, before, trend };
}
function pronunciationSummary(data, today = dayKey()) {
  const pron = data.meta.pron;
  if (!pron || !pron.tally) return { enabled: false };
  const states = { active: 0, easing: 0, archived: 0 };
  for (const [pair, e] of Object.entries(pron.tally)) if (!(pron.blocked || []).includes(pair)) states[e.state || 'active']++;
  const clips = Object.values(data.clips).filter((c) => !c.archived), recs = Object.values(data.recordings);
  return {
    enabled: true, trackedSounds: states.active + states.easing + states.archived, ...states, details: 'get_pronunciation_progress',
    clipsWithSpeakerSounds: clips.filter((c) => c.speakerPhones && c.speakerPhones.seq).length, takesCompared: recs.filter((r) => r.takeAnalysis || (r.phones && r.phones.diffs)).length, perClip: 'get_clip_pronunciation',
  };
}
/* "Drill this" tries (one short snippet each, judged by the same recogniser): not counted in chances or trends */
function drillsOf(pron, pair) {
  const L = ((pron && pron.drills) || []).filter((x) => x.pair === pair);
  return L.length ? { tries: L.length, notFlagged: L.filter((x) => x.r === 'clear').length, flaggedAgain: L.filter((x) => x.r === 'still').length, couldNotCheck: L.filter((x) => x.r === 'unclear').length, last: L[L.length - 1].d } : null;
}
export function pronunciationProgress(data, today = dayKey()) {
  const pron = data.meta.pron, prosody = data.meta.prosody;
  if (!pron && !prosody) return { enabled: false, note: 'No pronunciation history yet (the learner has not turned on pronunciation in Settings → Analysis or recorded a pass).' };
  const blocked = (pron && pron.blocked) || [];
  const pairs = Object.entries((pron && pron.tally) || {}).filter(([pair]) => !blocked.includes(pair)).map(([pair, e]) => {
    const T = trendOf(e.bk, today);
    const note = e.noteId && data.notes[e.noteId];
    const [from, to] = pair.split('→');
    return {
      pair, speakerSound: from, heardAsLearnerSound: to, state: e.state || 'active', stateSince: e.stateAt || null,
      chances: { last14d: T.recent.o, prior14d: T.before.o }, flagged: { last14d: T.recent.f, prior14d: T.before.f },
      trend: e.state === 'archived' ? 'gone quiet' : T.trend, firstSeen: e.first || null, lastFlagged: e.last || null,
      daysFlaggedTotal: (e.days || []).length,
      examples: (e.ex || []).slice(-5).map((x) => ({ date: x.d, word: x.w || null, clipId: x.c || null })),
      noteId: e.noteId || null, confirmedByLearner: !!(note && note.confirmed),
      drills: drillsOf(pron, pair),
    };
  }).sort((a, b) => (a.state === 'archived') - (b.state === 'archived') || b.flagged.last14d - a.flagged.last14d);
  const timing = {};
  for (const [kind, e] of Object.entries((prosody && prosody.kinds) || {})) {
    const T = trendOf(e.bk, today);
    timing[kind] = { passesWithDifference: { last14d: T.recent.f, prior14d: T.before.f }, recordedPasses: { last14d: T.recent.o, prior14d: T.before.o }, trend: T.trend };
  }
  return {
    enabled: !!pron,
    note: 'Sound differences come from a speech recogniser that is about 90% right per sound: treat them as evidence, not fact, and say "may". English only. A "chance" is a place where the speaker has that sound. Timing/pitch/stress are rough measures from loudness and pitch only. Archived means it stopped coming back over several chances; it returns on its own if it relapses.',
    pairs,
    timingPitchStress: timing,
    dismissedByLearner: blocked,
  };
}

/* ---- per clip: the speaker's sounds and words, and every take's sounds and differences (saved by src/js/27-prepare.js and 24-pron.js) ---- */
const r2 = (x) => Math.round(x * 100) / 100;
const ipa = (phones) => phones.map((p) => p.sym).join(' ');
function phoneRows(phones, detail) { return detail ? phones.map((p) => ({ sound: p.sym, from: r2(p.t0), to: r2(p.t1), confidence: r2(p.conf) })) : undefined; }
function wordOfTime(clip, t) { const w = (clip.words || []).find((x) => t >= x.s && t < x.e); return w ? w.w : null; }
function takeInfo(rec, clip, data, detail) {
  const a = rec.takeAnalysis, session = data.sessions[rec.sessionId];
  const out = { recordingId: rec.id, sessionId: rec.sessionId || null, date: (session && session.date) || (rec.created || '').slice(0, 10) || null, step: rec.step || null, slot: rec.slot || null, pass: rec.pass || null, lagSeconds: rec.lag != null ? rec.lag : null };
  if (a) {
    const shown = new Set(a.suggested || []);
    const learner = a.learner || { phones: [] };
    out.comparison = {
      status: a.status, // ok | learner-low-quality | speaker-low-quality | nothing-found
      stillMatchesClip: a.clipStart === clip.start && a.clipEnd === clip.end,
      comparedAt: a.at, model: a.model,
      learnerSounds: ipa(learner.phones), learnerSoundsDetail: phoneRows(learner.phones, detail),
      overlap: a.stats ? { speakerSounds: a.stats.speakerPhones, learnerSounds: a.stats.learnerPhones, agreement: r2(a.stats.agreement), substituted: a.stats.subs, leftOut: a.stats.dels, added: a.stats.inss } : undefined,
      differences: (a.diffs || []).map((d) => ({
        kind: d.kind === 'sub' ? 'replaced' : d.kind === 'del' ? 'left out' : 'added', speakerSound: d.speaker ? d.speaker.sym : null, learnerSound: d.learner ? d.learner.sym : null,
        atSeconds: r2(d.t0), word: wordOfTime(clip, d.t0), confidence: r2(d.confidence), likelyNoise: !!d.weak, shownToLearner: shown.has(d.id),
      })),
    };
  } else if (rec.phones && Array.isArray(rec.phones.diffs)) {
    out.comparison = { note: 'Older take: only the short summary of replaced sounds was saved, not the full sequences.', differences: rec.phones.diffs.map((d) => ({ kind: 'replaced', speakerSound: d.from, learnerSound: d.to, atSeconds: d.a, word: d.words || null, confidence: d.conf, speakerSoundsInWord: d.speaker, learnerSoundsInWord: d.you })) };
  }
  return out;
}
export function clipPronunciation(data, clipId, detail = false) {
  const recs = Object.values(data.recordings).filter((r) => r.kind === 'pass' && r.clipId);
  const byClip = new Map();
  for (const r of recs) (byClip.get(r.clipId) || byClip.set(r.clipId, []).get(r.clipId)).push(r);
  if (!clipId) {
    return {
      note: 'Pass clipId to get the sounds and differences. English only; compared with the speaker’s audio, never a transcript.',
      clips: Object.values(data.clips).filter((c) => !c.archived).map((c) => {
        const takes = byClip.get(c.id) || [];
        return { id: c.id, label: c.label || c.sentence || null, speakerSoundsSaved: !!(c.speakerPhones && c.speakerPhones.seq), speakerWordsSaved: !!(c.words && c.words.length), takes: takes.length, takesCompared: takes.filter((r) => r.takeAnalysis || (r.phones && r.phones.diffs)).length };
      }),
    };
  }
  if (!validId(clipId) || !data.clips[clipId]) throw new Error('Unknown clip id.');
  const clip = data.clips[clipId], sp = clip.speakerPhones, video = data.videos[clip.videoId];
  const seq = sp && sp.seq;
  const timing = clip.wordsFor && clip.wordsFor.timing;
  const words = (clip.words || []).map((w) => {
    const mine = seq && timing !== 'phrase' ? seq.phones.filter((p) => (p.t0 + p.t1) / 2 >= w.s && (p.t0 + p.t1) / 2 < w.e) : null;
    return { text: w.w, from: r2(w.s), to: r2(w.e), speakerSounds: mine ? ipa(mine) : undefined };
  });
  const takes = (byClip.get(clipId) || []).sort((x, y) => (String(x.created || '') < String(y.created || '') ? -1 : 1)).map((r) => takeInfo(r, clip, data, detail));
  return {
    note: 'Sounds are IPA from a speech recogniser that is about 90% right per sound, so treat differences as evidence, not fact, and say "may". English only. Every take is compared with the speaker’s audio, never a transcript; there is no written text for the learner, only sounds. Word labels come from a separate speech recogniser (Whisper) and can be wrong or have been fixed by the learner. Times are seconds from the clip start.',
    clip: { id: clip.id, label: clip.label || null, sentence: clip.sentence || null, videoTitle: video ? video.title : null, speaker: video ? video.speaker || null : null, startInVideo: clip.start, endInVideo: clip.end },
    speaker: {
      sounds: seq ? { saved: true, model: sp.model, preparedAt: sp.at, ipa: ipa(seq.phones), detail: phoneRows(seq.phones, detail), stillMatchesClip: sp.start === clip.start && sp.end === clip.end, quality: seq.quality ? seq.quality.level : undefined } : { saved: false },
      words: words.length ? { saved: true, model: clip.wordsFor ? clip.wordsFor.model || null : null, timing: timing || null, items: words, text: words.map((w) => w.text).join(' ') } : { saved: false },
    },
    takes,
  };
}
