// Tests clip ranking and the library job (src/js/28-rank.js) with stand-ins: node scripts/test-rank.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // objects made inside the vm have another prototype

const clips = {};
const videos = { v1: { id: 'v1' }, v2: { id: 'v2', archived: true } };
const seqs = {}; // clipId -> speaker seq
const prepCalls = [];
const recs = {}, processed = [];
let pronOn = true;
const ctx = {
  console, Promise, Map, Set,
  t: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]),
  soundName: (s) => s,
  lsGet: (k, d) => d, lsSet() {},
  Store: { all: (c) => (c === 'clips' ? Object.values(clips) : c === 'recordings' ? Object.values(recs) : []), get: (c, id) => (c === 'videos' ? videos[id] : c === 'recordings' ? recs[id] : clips[id]), blobUrl: async () => 'blob:x' },
  fetch: async () => ({ blob: async () => ({}) }), AudioEng: { decodeBlob: async () => new Float32Array(4) }, dayKey: (d) => d.toISOString().slice(0, 10),
  Pron: { on: () => pronOn, process: async (o) => { processed.push(o); if (o.recId === 'bad') { o.onError('nope'); return null; } recs[o.recId].takeAnalysis = { v: 1 }; return { diffs: [] }; }, doc: () => ({ tally: {}, blocked: [] }), reason: (e) => String(e && e.message) },
  Prep: {
    speakerSeq: (c) => (seqs[c.id] ? { fp: 'x', seq: seqs[c.id] } : null),
    ensure: async (c) => { prepCalls.push(c.id); if (c.bad) return; if (c.boom) throw Object.assign(new Error('off'), { code: 'off' }); seqs[c.id] = { phones: [], quality: { level: 'good' } }; },
  },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../src/js/28-rank.js', import.meta.url), 'utf8') + '\nthis.Rank = Rank;', ctx);
const { Rank } = ctx;
let n = 0;
const test = (name, fn) => Promise.resolve(fn()).then(() => { n++; console.log('ok  ' + name); });
const clip = (id, o = {}) => ({ id, videoId: 'v1', start: 0, end: 8, model: { measures: { rate: 5, range: 11 } }, ...o });

await test('difficulty rises with speech rate, pitch range and length, and is null without a model line', () => {
  const slow = Rank.difficulty(clip('a', { model: { measures: { rate: 3, range: 6 } }, end: 4 }));
  const fast = Rank.difficulty(clip('b', { model: { measures: { rate: 7, range: 16 } }, end: 14 }));
  assert.equal(slow.level, 'easy'); assert.equal(fast.level, 'hard'); assert.ok(fast.score > slow.score);
  assert.equal(Rank.difficulty({ id: 'c', start: 0, end: 5 }), null);
  assert.equal(Rank.difficulty(clip('d', { model: { measures: { rate: null, range: null } } })), null); // length alone says too little
  const rateOnly = Rank.difficulty(clip('e', { model: { measures: { rate: 7, range: null } } }));
  assert.ok(rateOnly.score > 0.5 && rateOnly.score <= 1);
});

await test('focus sounds: two flagged days, not blocked, not gone quiet, not added sounds', () => {
  const f = Rank.focusSounds({ 'θ→s': { days: ['1', '2', '3'] }, 'r→w': { days: ['1'] }, 'ð→d': { days: ['1', '2'], state: 'archived' }, 'ʃ→s': { days: ['1', '2'], state: 'easing' }, '∅→ə': { days: ['1', '2'] }, 'v→w': { days: ['1', '2'] } }, ['v→w']);
  same([...f.entries()], [['θ', 3], ['ʃ', 2]]);
});

await test('matchSounds counts focus sounds with a per-sound cap, ignores unsure sounds, and needs good quality', () => {
  const f = new Map([['θ', 3], ['ʃ', 2]]);
  const ph = (sym, conf = 0.9) => ({ sym, conf });
  const seq = { quality: { level: 'good' }, phones: [ph('θ'), ph('θ'), ph('θ'), ph('θ'), ph('ʃ', 0.2), ph('a')] };
  same(Rank.matchSounds(seq, f), { n: 3, sounds: ['θ'] });
  assert.equal(Rank.matchSounds({ ...seq, quality: { level: 'low' } }, f), null);
  assert.equal(Rank.matchSounds(null, f), null);
  same(Rank.matchSounds({ phones: [ph('a')] }, f), { n: 0, sounds: [] });
});

await test('order: as cut, easier first (no measures last), fits first then easier; stable', () => {
  const list = [clip('a', { model: { measures: { rate: 7, range: 16 } } }), clip('b', { model: { measures: { rate: 3, range: 6 } } }), { id: 'c', videoId: 'v1', start: 0, end: 5 }, clip('d', { model: { measures: { rate: 3, range: 6 } } })];
  const info = (c) => ({ diff: Rank.difficulty(c), match: c.id === 'a' ? { n: 2, sounds: ['θ'] } : c.id === 'd' ? { n: 2, sounds: ['θ'] } : null });
  same(Rank.order(list, 'time', info).map((c) => c.id), ['a', 'b', 'c', 'd']);
  same(Rank.order(list, 'easy', info).map((c) => c.id), ['b', 'd', 'a', 'c']);
  same(Rank.order(list, 'issues', info).map((c) => c.id), ['d', 'a', 'b', 'c']);
});

await test('pick suggests only unfinished, not-today clips that fit, never pads', () => {
  const list = [clip('a'), clip('b', { done: true }), clip('c', { lastPractised: '2026-11-05' }), clip('d'), clip('e', { archived: true }), clip('f')];
  const fit = { a: 1, b: 5, c: 5, d: 3, e: 5 };
  const info = (c) => ({ diff: Rank.difficulty(c), match: fit[c.id] ? { n: fit[c.id], sounds: ['θ'] } : null });
  same(Rank.pick(list, info, { today: '2026-11-05' }).map((c) => c.id), ['d', 'a']);
  same(Rank.pick(list, () => ({ diff: null, match: null }), { today: '' }), []);
});

await test('library job prepares only live clips without sounds, one by one, and counts the unreadable ones', async () => {
  Object.assign(clips, { c1: clip('c1'), c2: clip('c2'), c3: clip('c3', { bad: true }), c4: clip('c4', { videoId: 'v2' }), c5: clip('c5', { archived: true }) });
  seqs.c1 = { phones: [], quality: { level: 'good' } };
  same(Rank.pending().map((c) => c.id).sort(), ['c2', 'c3']);
  await Rank.prepareLibrary();
  same(prepCalls, ['c2', 'c3']);
  same(Rank.counts(), { total: 3, ready: 2, failed: 1 });
  assert.equal(Rank.job.running, false);
  prepCalls.length = 0; await Rank.prepareLibrary();
  same(prepCalls, [], 'an unreadable clip is not retried in the same visit');
});

await test('library job stops when the feature switches itself off, and does nothing when Pronunciation is off', async () => {
  clips.c6 = clip('c6', { boom: true }); clips.c7 = clip('c7');
  prepCalls.length = 0;
  await Rank.prepareLibrary();
  same(prepCalls, ['c6']); assert.ok(Rank.job.error);
  prepCalls.length = 0; pronOn = false; await Rank.prepareLibrary();
  same(prepCalls, []);
});

await test('stop ends the job after the current clip', async () => {
  pronOn = true; delete clips.c6; clips.c8 = clip('c8'); clips.c9 = clip('c9'); prepCalls.length = 0;
  ctx.Prep.ensure = async (c) => { prepCalls.push(c.id); seqs[c.id] = { phones: [], quality: { level: 'good' } }; Rank.stopLibrary(); };
  await Rank.prepareLibrary();
  assert.equal(prepCalls.length, 1);
});

const rec = (id, o = {}) => ({ id, kind: 'pass', ref: 'r:' + id, clipId: 'c1', sessionId: 's1', pass: 1, step: 'again', created: '2026-11-0' + id.slice(-1) + 'T10:00:00Z', ...o });
await test('past recordings: only passes with audio and no comparison yet, oldest first', () => {
  clips.c1 = clip('c1');
  const all = [rec('r3'), rec('r1'), rec('r2', { phones: { diffs: [] } }), rec('r4', { takeAnalysis: {} }), rec('r5', { ref: null }), rec('r6', { kind: 'checkin' }), rec('r7', { clipId: 'gone' })];
  same(Rank.pendingTakes(all, (id) => clips[id]).map((r) => r.id), ['r1', 'r3']);
});
await test('past recordings: each is compared in order, filed under its own day, and counted as failed when it cannot be', async () => {
  for (const k of Object.keys(recs)) delete recs[k];
  Object.assign(recs, { r1: rec('r1'), r3: rec('r3'), bad: rec('bad', { created: '2026-11-02T10:00:00Z' }) });
  await Rank.prepareTakes();
  same(processed.map((o) => o.recId), ['r1', 'bad', 'r3']);
  same(processed.map((o) => o.day), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.ok(processed.every((o) => o.background === true));
  assert.equal(Rank.tjob.done, 3); same(Rank.takeCounts(), { waiting: 0, failed: 1 });
});
await test('past recordings: stop, and off', async () => {
  for (const k of Object.keys(recs)) delete recs[k];
  Object.assign(recs, { r1: rec('r1'), r2: rec('r2') }); processed.length = 0;
  const orig = ctx.Pron.process; ctx.Pron.process = async (o) => { processed.push(o); recs[o.recId].takeAnalysis = {}; Rank.stopTakes(); };
  await Rank.prepareTakes(); assert.equal(processed.length, 1);
  ctx.Pron.process = orig; pronOn = false; processed.length = 0; await Rank.prepareTakes();
  same(processed, []); assert.ok(Rank.tjob.error);
});
console.log(`${n} passed`);
