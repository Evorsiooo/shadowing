// What Euno knows: the MCP tools that save/forget facts about the learner, the progress brief, and the [[remember:]] parser.
// Uses an in-memory stand-in for D1.  node scripts/test-about.mjs
import { handleRpc } from '../server/mcp.js';
import { progressBrief, briefLines } from '../server/progress.js';
import { splitRemember } from '../server/ai.js';
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) bad++; };
const docs = new Map();
const DB = { prepare(sql) { return { bind(...a) { return {
  async first() { if (sql.startsWith('SELECT data')) { const r = docs.get(a.join('|')); return r ? { data: r } : null; } if (sql.includes('COUNT')) return { n: docs.size, bytes: 0, current: -1 }; return null; },
  async all() { return { results: [...docs].map(([k, v]) => { const [, col, id] = k.split('|'); return { col, id, data: v }; }) }; },
  async run() { if (sql.startsWith('INSERT')) docs.set(`${a[0]}|${a[1]}|${a[2]}`, a[3]); return {}; } }; } }; } };
const ctx = { env: { DB }, user: { userId: 'u1' }, origin: 'x' };
const call = async (name, args) => JSON.parse((await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)).result.content[0].text);
const a = await call('save_about_learner', { fact: 'Is C2 in English except for speaking.' });
check(a.saved && !a.alreadyKnown, 'a fact is saved');
check((await call('save_about_learner', { fact: 'is c2 in english, except for speaking' })).alreadyKnown, 'the same fact twice is kept once');
const g = await call('get_about_learner', {});
check(g.facts.length === 1 && g.facts[0].by === 'ai', 'get_about_learner lists it');
check((await call('forget_about_learner', { id: g.facts[0].id })).removed, 'a fact can be forgotten');
check((await call('get_about_learner', {})).facts.length === 0, 'and it is gone');
const mk = (id, created, lag, diffs) => [id, { id, kind: 'pass', clipId: 'c1', created, lag, takeAnalysis: { status: 'ok', stats: { agreement: 0.8 }, diffs: Array(diffs).fill({}) } }];
const bk = (l) => l.map(([d, f, o]) => ({ d, f, o }));
const data = { videos: { v: { id: 'v', speaker: 'Ana' } }, clips: { c1: { id: 'c1', videoId: 'v', label: 'Intro', start: 1, end: 5 } }, sessions: { s: { id: 's', date: '2026-10-01', minutes: 20, passes: [{ lag: 0.3 }] } }, checkins: {}, issues: {}, notes: {},
  recordings: Object.fromEntries([mk('a', '2026-10-01T10:00:00Z', 0.4, 9), mk('b', '2026-11-04T10:00:00Z', 0.1, 4)]),
  meta: { pron: { tally: { 'θ→d': { state: 'easing', bk: bk([['2026-10-01', 5, 8], ['2026-11-04', 1, 8]]) } } } } };
const lines = briefLines(progressBrief(data, '2026-11-05')).join('\n');
check(/first 2026-10-01, 9 differences.*latest 2026-11-04, 4 differences/.test(lines), 'first and latest take of a clip are compared');
check(/flagged 5 of 8 places in the first two weeks.*1 of 8 in the last two weeks/.test(lines), 'a sound is compared first vs last two weeks');
const r = splitRemember('Nice work.\n[[remember: Is C2 in English except speaking.]]');
check(r.text === 'Nice work.' && r.remember.length === 1, 'the remember line is split from the answer');
process.exit(bad ? 1 : 0);
