// What Euno knows about the learner: short facts in meta/about, { facts: [{ id, text, at, by }] }.
// Euno adds them during a chat (the app saves them), the learner's own AI can add or remove them over MCP,
// and the learner sees, edits and deletes them in Settings → You. Kept as its own document so a write from MCP
// never races with the app saving settings.
import { getDoc, putDoc } from './store.js';

export const MAX_FACTS = 30;
export const MAX_FACT_LENGTH = 200;
const WHO = ['euno', 'ai', 'you'];

export const cleanFact = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_LENGTH);
const same = (a, b) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export async function readFacts(db, userId) {
  const doc = await getDoc(db, userId, 'meta', 'about');
  return Array.isArray(doc && doc.facts) ? doc.facts.filter((f) => f && typeof f.text === 'string' && f.id) : [];
}

/** Add facts the learner hasn't already got. Returns the saved list and what was new. */
export async function addFacts(db, userId, texts, by = 'ai') {
  const facts = await readFacts(db, userId);
  const added = [];
  for (const raw of texts) {
    const text = cleanFact(raw);
    if (text.length < 3 || facts.some((f) => same(f.text, text))) continue;
    const fact = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 12), text, at: new Date().toISOString().slice(0, 10), by: WHO.includes(by) ? by : 'ai' };
    facts.push(fact);
    added.push(fact);
  }
  if (!added.length) return { facts, added };
  const kept = facts.slice(-MAX_FACTS); // the oldest go first
  await putDoc(db, userId, 'meta', 'about', { facts: kept });
  return { facts: kept, added };
}

export async function removeFact(db, userId, id) {
  const facts = await readFacts(db, userId);
  const left = facts.filter((f) => f.id !== id);
  if (left.length === facts.length) return { facts, removed: false };
  await putDoc(db, userId, 'meta', 'about', { facts: left });
  return { facts: left, removed: true };
}
