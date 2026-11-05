// Progress over time, worked out from the learner's saved practice data (the same data the MCP tools read).
// Ask Euno (server/ai.js chatReply) and the MCP tool get_progress both use this, so they answer from the same facts.
// Nothing here hears audio: every number is a measurement the app saved when the take was recorded.
import { overview } from './mcp.js';
import { readFacts } from './about.js';

const dayOf = (iso) => String(iso || '').slice(0, 10);
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (f, o) => (o ? Math.round((f / o) * 100) : null);
function addDays(k, n) { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/* the learner's first two weeks of data against the latest two weeks, for a daily-bucket history [{d, f, o}] */
function startVsNow(bk, today) {
  const b = (bk || []).filter((x) => x && x.d && x.o);
  if (!b.length) return null;
  const first = b.map((x) => x.d).sort()[0];
  const sum = (from, to) => b.filter((x) => x.d >= from && x.d <= to).reduce((a, x) => ({ f: a.f + x.f, o: a.o + x.o }), { f: 0, o: 0 });
  const start = sum(first, addDays(first, 13));
  const now = sum(addDays(today, -13), today);
  const overlap = addDays(first, 13) >= addDays(today, -13); // the two windows share days: no real comparison yet
  return { since: first, start, now, comparable: !overlap && start.o >= 6 && now.o >= 6 };
}

function takeNumbers(r) {
  const a = r.takeAnalysis;
  if (a && a.status === 'ok' && a.stats) return { differences: (a.diffs || []).filter((d) => !d.weak).length, agreement: r2(a.stats.agreement) };
  if (r.phones && Array.isArray(r.phones.diffs)) return { differences: r.phones.diffs.length, agreement: null };
  return null;
}

export function progressBrief(data, today = new Date().toISOString().slice(0, 10)) {
  const ov = overview(data, today);
  const takes = Object.values(data.recordings).filter((r) => r.kind === 'pass' && r.created).sort((a, b) => (a.created < b.created ? -1 : 1));
  const byClip = new Map();
  for (const r of takes) if (r.clipId && data.clips[r.clipId]) (byClip.get(r.clipId) || byClip.set(r.clipId, []).get(r.clipId)).push(r);
  const clips = [...byClip.entries()].filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([id, l]) => {
    const c = data.clips[id], first = l[0], last = l[l.length - 1], v = data.videos[c.videoId];
    return {
      clipId: id, clip: c.label || c.sentence || `clip at ${Math.round(c.start)}s`, speaker: (v && v.speaker) || null, takes: l.length,
      first: { date: dayOf(first.created), lagSeconds: first.lag != null ? r2(first.lag) : null, ...(takeNumbers(first) || {}) },
      latest: { date: dayOf(last.created), lagSeconds: last.lag != null ? r2(last.lag) : null, ...(takeNumbers(last) || {}) },
    };
  });
  const lags = takes.filter((r) => r.lag != null);
  const lagWindow = (list) => (list.length ? { takes: list.length, averageLagSeconds: r2(mean(list.map((r) => r.lag))), averageAbsoluteLagSeconds: r2(mean(list.map((r) => Math.abs(r.lag)))) } : null);
  const n = Math.min(10, Math.floor(lags.length / 2));
  const pron = data.meta.pron, prosody = data.meta.prosody;
  const blocked = (pron && pron.blocked) || [];
  const sounds = Object.entries((pron && pron.tally) || {}).filter(([p]) => !blocked.includes(p)).map(([pair, e]) => ({ pair, state: e.state || 'active', ...(startVsNow(e.bk, today) || {}) }))
    .filter((s) => s.since).sort((a, b) => b.start.o + b.now.o - (a.start.o + a.now.o)).slice(0, 8)
    .map((s) => { const [from, to] = s.pair.split('→'); return { speakerSound: from, heardAs: to, state: s.state, trackedSince: s.since, firstTwoWeeks: { flagged: s.start.f, chances: s.start.o }, lastTwoWeeks: { flagged: s.now.f, chances: s.now.o }, comparable: s.comparable }; });
  const timing = Object.entries((prosody && prosody.kinds) || {}).map(([kind, e]) => ({ kind, ...(startVsNow(e.bk, today) || {}) })).filter((s) => s.since)
    .map((s) => ({ kind: s.kind, trackedSince: s.since, firstTwoWeeks: { passesWithDifference: s.start.f, recordedPasses: s.start.o }, lastTwoWeeks: { passesWithDifference: s.now.f, recordedPasses: s.now.o }, comparable: s.comparable }));
  const checkins = Object.values(data.checkins).sort((a, b) => a.week - b.week).map((c) => ({ week: c.week, date: c.date, measures: c.measures || null }));
  return {
    today,
    practice: { streakDays: ov.streakDays, daysThisWeek: ov.daysPractisedThisWeek, totalMinutes: ov.totalMinutes, sessions: ov.sessions, firstSession: Object.values(data.sessions).map((s) => s.date).filter(Boolean).sort()[0] || null, clipsDone: ov.clips.done, clipsTotal: ov.clips.total, openIssues: ov.openIssues.length },
    recordedTakes: { total: takes.length, first: takes.length ? dayOf(takes[0].created) : null, latest: takes.length ? dayOf(takes[takes.length - 1].created) : null,
      comparedWithSpeaker: takes.filter((r) => takeNumbers(r)).length,
      lagFirstTakes: n >= 3 ? lagWindow(lags.slice(0, n)) : null, lagLatestTakes: n >= 3 ? lagWindow(lags.slice(-n)) : null },
    clipsPractisedAgain: clips,
    soundDifferences: sounds,
    timingPitchStress: timing,
    checkins,
    how: 'Every figure was measured by software on the learner’s device when each take was recorded and saved with it. The audio is not available here, so nobody can listen to the takes: say "may" about any difference. Lag is seconds behind the speaker. A sound "flagged" means the sound recogniser heard something different from the speaker at a place where the speaker has that sound (about 90% right per sound). comparable=false means the first and last two weeks overlap or there are too few chances to say anything about progress.',
  };
}

/* the same facts as a few plain lines for Ask Euno's prompt */
export function briefLines(b) {
  const L = [];
  const p = b.practice, t = b.recordedTakes;
  L.push(`Practice: ${p.sessions} session(s) since ${p.firstSession || 'the start'}, ${p.totalMinutes} minutes, streak ${p.streakDays} day(s), ${p.clipsDone} of ${p.clipsTotal} clips done.`);
  if (t.total) L.push(`Recorded takes saved: ${t.total}, from ${t.first} to ${t.latest}; ${t.comparedWithSpeaker} compared sound by sound with the speaker. You cannot play them, but every take's measurements are saved and listed here.`);
  if (t.lagFirstTakes && t.lagLatestTakes) L.push(`Timing behind the speaker: first ${t.lagFirstTakes.takes} takes averaged ${t.lagFirstTakes.averageLagSeconds} s, latest ${t.lagLatestTakes.takes} takes ${t.lagLatestTakes.averageLagSeconds} s.`);
  for (const c of b.clipsPractisedAgain.slice(0, 4)) {
    const f = c.first, l = c.latest;
    L.push(`Clip "${String(c.clip).slice(0, 50)}"${c.speaker ? ` (${c.speaker})` : ''}, ${c.takes} takes: first ${f.date}${f.differences != null ? `, ${f.differences} differences from the speaker` : ''}${f.lagSeconds != null ? `, ${f.lagSeconds} s behind` : ''}; latest ${l.date}${l.differences != null ? `, ${l.differences} differences` : ''}${l.lagSeconds != null ? `, ${l.lagSeconds} s behind` : ''}.`);
  }
  for (const s of b.soundDifferences.slice(0, 5)) L.push(`Sound "${s.speakerSound}" heard as "${s.heardAs}" (${s.state}): flagged ${s.firstTwoWeeks.flagged} of ${s.firstTwoWeeks.chances} places in the first two weeks (since ${s.trackedSince}), ${s.lastTwoWeeks.flagged} of ${s.lastTwoWeeks.chances} in the last two weeks${s.comparable ? '' : ' (too little or overlapping data to call it progress)'}.`);
  const kinds = { rushed: 'running faster than the speaker', dragged: 'running slower than the speaker', pitch: 'pitch moving a different way', stress: 'stress in a different place' };
  for (const s of b.timingPitchStress) L.push(`${kinds[s.kind] || s.kind}: ${s.firstTwoWeeks.passesWithDifference} of ${s.firstTwoWeeks.recordedPasses} passes in the first two weeks, ${s.lastTwoWeeks.passesWithDifference} of ${s.lastTwoWeeks.recordedPasses} in the last two weeks${s.comparable ? '' : ' (not enough to compare)'}.`);
  if (b.checkins.length) L.push(`Check-ins done: weeks ${b.checkins.map((c) => c.week).join(', ')}.`);
  return L;
}

export { readFacts };
