// Tests clip ranking and the library job (src/js/28-rank.js) with stand-ins: node scripts/test-rank.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // objects made inside the vm have another prototype

const clips = {};
const videos = { v1: { id: 'v1' }, v2: { id: 'v2', archived: true } };
const seqs = {}; // clipId -> speaker seq
const prepCalls = [];
let pronOn = true;
const ctx = {
  console, Promise, Map, Set,
  t: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]),
  soundName: (s) => s,
  lsGet: (k, d) => d, lsSet() {},
  Store: { all: (c) => (c === 'clips' ? Object.values(clips) : []), get: (c, id) => (c === 'videos' ? videos[id] : clips[id]) },
  Pron: { on: () => pronOn, doc: () => ({ tally: {}, blocked: [] }), reason: (e) => String(e && e.message) },
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
console.log(`${n} passed`);
