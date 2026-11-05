// AI feedback on "what sounded off" notes, with each user's own API key (Anthropic, OpenAI or
// OpenRouter) and the model they pick. One prompt, one adapter per provider.
// Keys are encrypted with AES-GCM under the KEY_ENCRYPTION_KEY secret, with the user id as
// additional data, and stored in `private` (key 'ai'). They never go back to the browser.
import Anthropic from '@anthropic-ai/sdk';
import { getPrivate, setPrivate } from './reminders.js';
import { limit } from './limits.js';

export const PROVIDERS = {
  anthropic: { name: 'Anthropic', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…' },
  openai: { name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…' },
  openrouter: { name: 'OpenRouter', keyUrl: 'https://openrouter.ai/settings/keys', keyHint: 'sk-or-…' },
};
// The default is the first model in the provider's list that matches, in this order: cheap and fast.
const CHEAP = {
  anthropic: [/^claude-haiku-\d/],
  openai: [/^gpt-\d+(\.\d+)?-mini$/, /^gpt-\d+(\.\d+)?-nano$/, /^gpt-4o-mini$/],
  openrouter: [/^anthropic\/claude-haiku-\d/, /^openai\/gpt-\d+(\.\d+)?-mini$/, /^google\/gemini-[\d.]+-flash$/],
};
const MODEL_RE = /^[A-Za-z0-9_.:/@-]{1,120}$/;
const OPENROUTER_HEADERS = { 'HTTP-Referer': 'https://shadowing.euno.cc', 'X-Title': 'Euno Shadowing' };
const RATE_PER_HOUR = 60;
const HOUR = 3600_000;

export function aiAvailable(env) { return !!env.KEY_ENCRYPTION_KEY; }

/* ---------- stored config: {provider, model, hint, iv, ct} ---------- */
async function loadConfig(env, userId) {
  const raw = await getPrivate(env.DB, userId, 'ai');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
// What the browser may see: never the key, only its last four characters.
export async function aiStatus(env, userId) {
  const c = await loadConfig(env, userId);
  return c ? { configured: true, provider: c.provider, providerName: PROVIDERS[c.provider]?.name || c.provider, model: c.model, hint: c.hint } : { configured: false };
}
async function keyFor(env, userId) {
  const c = await loadConfig(env, userId);
  if (!c) throw httpError(400, 'Add your AI key in Settings → Connections first.');
  try { return { ...c, key: await decrypt(env, userId, c) }; } catch {
    throw httpError(409, 'Your saved AI key can’t be read any more. Remove it in Settings → Connections and add it again.');
  }
}

export async function saveKey(env, userId, provider, key) {
  if (!PROVIDERS[provider]) throw httpError(400, 'Pick Anthropic, OpenAI or OpenRouter.');
  key = String(key || '').trim();
  // each save checks the key with the provider, so this can't be used to try out lots of keys
  await limit(env.DB, userId, 'aiKeyRate', 10, HOUR, 'That’s a lot of keys tried in an hour. Try again a bit later.');
  if (key.length < 20 || key.length > 300 || /\s/.test(key)) throw httpError(400, `That doesn’t look like a ${PROVIDERS[provider].name} API key.`);
  const models = await listModels(provider, key); // also proves the key works
  const model = pickDefault(provider, models);
  const enc = await encrypt(env, userId, key);
  await setPrivate(env.DB, userId, 'ai', JSON.stringify({ provider, model, hint: `…${key.slice(-4)}`, ...enc, at: Date.now() }));
  return { ...(await aiStatus(env, userId)), models };
}
export async function setModel(env, userId, model) {
  const c = await loadConfig(env, userId);
  if (!c) throw httpError(400, 'Add your AI key first.');
  if (typeof model !== 'string' || !MODEL_RE.test(model)) throw httpError(400, 'That isn’t a model id.');
  await setPrivate(env.DB, userId, 'ai', JSON.stringify({ ...c, model }));
  return aiStatus(env, userId);
}
export async function removeKey(env, userId) { await setPrivate(env.DB, userId, 'ai', null); }
export async function userModels(env, userId) {
  const c = await keyFor(env, userId);
  await limit(env.DB, userId, 'aiModelsRate', 30, HOUR, 'The model list was loaded a lot in the last hour. Try again a bit later.');
  const models = await listModels(c.provider, c.key);
  return { provider: c.provider, model: c.model, models, cheap: defaultModelFrom(c.provider, models) };
}

/* ---------- AES-GCM with the user id as additional data ---------- */
async function kek(env) {
  if (!env.KEY_ENCRYPTION_KEY) throw httpError(503, 'AI keys aren’t set up on this server yet (KEY_ENCRYPTION_KEY is missing).');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.KEY_ENCRYPTION_KEY));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function encrypt(env, userId, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) }, await kek(env), new TextEncoder().encode(text));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}
async function decrypt(env, userId, { iv, ct }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: new TextEncoder().encode(userId) }, await kek(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

/* ---------- model lists ---------- */
// Each entry: {id, name, note?}. Lists are the provider's own, filtered to chat models.
async function listModels(provider, key) {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key, maxRetries: 1 });
    const out = [];
    try {
      for await (const m of client.models.list({ limit: 100 })) out.push({ id: m.id, name: m.display_name || m.id });
    } catch (e) { throw anthropicError(e); }
    return out;
  }
  if (provider === 'openai') {
    const d = await callJSON('OpenAI', 'https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${key}` } });
    return (d.data || []).map((m) => m.id)
      .filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|dall-e|whisper|moderation|codex|computer)/.test(id))
      .sort().map((id) => ({ id, name: id }));
  }
  // OpenRouter's model list is public, so check the key separately
  await callJSON('OpenRouter', 'https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${key}`, ...OPENROUTER_HEADERS } });
  const d = await callJSON('OpenRouter', 'https://openrouter.ai/api/v1/models', { headers: OPENROUTER_HEADERS });
  const price = (p) => { const n = Number(p) * 1e6; return isFinite(n) ? (n < 0.01 ? 'free' : `$${n < 1 ? n.toFixed(2) : n.toFixed(1)}`) : '?'; };
  return (d.data || [])
    .filter((m) => (m.supported_parameters || []).some((p) => p === 'structured_outputs' || p === 'response_format'))
    .map((m) => ({ id: m.id, name: m.name || m.id, note: m.pricing ? `${price(m.pricing.prompt)} in / ${price(m.pricing.completion)} out per 1M tokens` : '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function pickDefault(provider, models) {
  for (const re of CHEAP[provider] || []) {
    const hit = models.filter((m) => re.test(m.id));
    // Anthropic lists newest first; for the others take the highest version
    if (hit.length) return provider === 'anthropic' ? hit[0].id : hit.map((m) => m.id).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  }
  if (!models.length) throw httpError(400, 'Your key works, but it can’t use any chat models.');
  return models[0].id;
}
export function defaultModelFrom(provider, models) { try { return pickDefault(provider, models); } catch { return null; } }

/* ---------- the prompt ---------- */
// The learner's profile comes from the app (meta/settings → profile); every field is optional.
function systemPrompt(profile = {}) {
  const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const lang = clean(profile.targetLanguage, 40) || 'English';
  const accent = clean(profile.accent, 80) || `a native ${lang} accent`;
  const native = clean(profile.nativeLanguages, 120);
  const notes = clean(profile.notes, 500);
  const spelling = clean(profile.spelling, 40);
  const reply = ['English', 'French', 'Spanish'].includes(profile.replyLanguage) ? profile.replyLanguage : 'English';
  return `You help a learner with shadowing practice: they repeat a model speaker's clip to pick up the accent, rhythm and melody. The learner is moving their ${lang} accent towards ${accent}.${native ? ` Their native language: ${native}.` : ''}${notes ? ` About them: ${notes}` : ''}

After a recorded pass they describe what sounded off. Tell them:
- feature: the likely ${accent} feature behind it (1-2 sentences)
- change: what to change in their speech (1-3 sentences)
- listenFor: what to listen for in the model clip (1-2 sentences)
- issue: a short name (max 5 words, in ${reply}) for this as a recurring problem; reuse one of their existing issue names when it fits

Write ${reply !== 'English' ? `your explanation in ${reply}, ` : spelling ? `in ${spelling} spelling, ` : ''}plainly, with no linguistics jargon: if you need to name a sound, describe it with everyday ${lang} example words. If their description is too ambiguous to work out, don't guess: set unsure to true, put "I don't know what you meant by ..." and a short question in question, and leave the other fields empty.`;
}
// Said whenever the measured lines include sound-level ("Phones") lines
const PHONES_CAVEAT = 'Lines starting "Phones" come from a phone recogniser that is only about 90% right per sound, so it can be wrong: say "may", never state a difference as fact. Compare the speaker\'s sounds with the learner\'s and describe what may differ in everyday example words.';
// Said whenever the measured lines include "History" lines (how often the same difference came up in recent weeks)
const HISTORY_NOTE = 'Lines starting "History" say how often the same difference came up over the last weeks (chances are places where the speaker has that sound). Use them to say whether it seems to be improving or recurring, gently and with "may"; if one says it went quiet, acknowledge the progress rather than re-diagnosing it.';
// Used when a model can't do schema-constrained output
const JSON_INSTRUCTION = '\n\nReply with only a JSON object with the string fields feature, change, listenFor, issue, question and the boolean field unsure. No other text.';

const NOTE_SCHEMA = {
  type: 'object',
  properties: {
    feature: { type: 'string' },
    change: { type: 'string' },
    listenFor: { type: 'string' },
    issue: { type: 'string' },
    unsure: { type: 'boolean' },
    question: { type: 'string' },
  },
  required: ['feature', 'change', 'listenFor', 'issue', 'unsure', 'question'],
  additionalProperties: false,
};

/* ---------- feedback ---------- */
export async function noteFeedback(env, userId, { sentence = '', off = '', aim = '', issues = [], measured = [], profile = {} }) {
  const c = await keyFor(env, userId);
  await rateLimit(env, userId);
  const system = systemPrompt(profile && typeof profile === 'object' ? profile : {});
  const lines = Array.isArray(measured) ? measured.slice(0, 14).map((l) => String(l).replace(/\s+/g, ' ').slice(0, 200)) : [];
  const phones = lines.some((l) => l.startsWith('Phones'));
  const user = `Sentence being practised: ${String(sentence).slice(0, 500) || '(not given)'}
What sounded off: ${String(off).slice(0, 2000)}
What they were aiming for: ${String(aim).slice(0, 500) || '(not given)'}
Issue names they already track: ${Array.isArray(issues) && issues.length ? issues.slice(0, 60).map(String).join('; ') : '(none yet)'}${lines.length ? `
Measured on their recording by software (${phones ? "the pitch, loudness and timing lines can't hear vowels or consonants" : "pitch, loudness and timing only, so it can't hear vowels or consonants"}; speech recognition can also miss clear words). Treat it as evidence about the recording, not as the learner's opinion, and don't invent problems beyond it and their description:
${lines.map((l) => `- ${l}`).join('\n')}${phones ? `
${PHONES_CAVEAT}` : ''}${lines.some((l) => l.startsWith('History')) ? `
${HISTORY_NOTE}` : ''}` : ''}`;
  const ask = c.provider === 'anthropic' ? askAnthropic : askOpenAICompatible;
  let text;
  try {
    text = await ask(c, system, user, true);
  } catch (e) {
    // some models can't do schema-constrained output: ask for JSON in the prompt instead
    if (e.status !== 400 || !e.formatProblem) throw e;
    text = await ask(c, system + JSON_INSTRUCTION, user, false);
  }
  return { reply: parseReply(text), model: c.model, provider: c.provider };
}

const asMessages = (user) => (typeof user === 'string' ? [{ role: 'user', content: user }] : user);
/* ---------- Ask Euno: a short conversation about the learner's own practice ----------
   The app sends the conversation so far (the history itself is kept in the learner's own data) and a few lines of
   context it worked out on the device: streak, open issues, sounds flagged lately, the clip they're on. */
export function chatSystemPrompt(profile = {}, context = [], knowledge = []) {
  const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const lang = clean(profile.targetLanguage, 40) || 'English';
  const accent = clean(profile.accent, 80) || `a native ${lang} accent`;
  const native = clean(profile.nativeLanguages, 120);
  const notes = clean(profile.notes, 500);
  const reply = ['English', 'French', 'Spanish'].includes(profile.replyLanguage) ? profile.replyLanguage : 'English';
  const lines = (Array.isArray(context) ? context : []).slice(0, 30).map((l) => `- ${clean(l, 240)}`).filter((l) => l.length > 2);
  const research = (Array.isArray(knowledge) ? knowledge : []).slice(0, 3).map((k) => String(k || '').replace(/[ \t]+/g, ' ').trim().slice(0, 4000)).filter(Boolean);
  return `You are Euno, the small green character in Euno Shadowing, a free app where people improve their accent by shadowing: speaking along with a clip of a speaker they want to sound like. The learner is moving their ${lang} accent towards ${accent}.${native ? ` Their native language: ${native}.` : ''}${notes ? ` About them: ${notes}` : ''}

Answer their question about pronunciation, accent, shadowing or their own practice. Reply in ${reply}, plainly and warmly, in at most about 120 words unless they ask for more, with no linguistics jargon: describe sounds with everyday ${lang} example words. Plain text only, no Markdown headings or tables; a short list is fine.

You have not heard their voice. All you know is the context below, measured by software on their device, which can be wrong, so say "may" about any difference and never state one as fact. Don't invent recordings, scores or history that aren't in the context. If they ask about something unrelated to speaking or learning languages, say briefly that you can only help with their practice.${lines.length ? `

Background from the app (private to you; the learner can't see this list):
${lines.join('\n')}

How to use that background: treat it as reference material, not something to bring up. Don't mention their notes, open issues, flagged sounds, timing or pitch data, streak, or the clip they're on unless their message is actually about them (for example asking what to work on, how they're doing, or about a particular sound, word or the current clip). For a greeting, a test message, small talk or a general question (such as how often to practise), answer briefly and naturally in a sentence or two, as if you didn't have the background, and don't suggest a specific sound to work on. Never open with a summary of their practice. Don't say which clip they're on unless it matters to the answer.` : ''}${research.length ? `

${RESEARCH_RULES}

${research.join('\n\n')}` : ''}`;
}
const RESEARCH_RULES = `Research notes that match this question follow, from Euno's own written knowledgebase. They are the only research you may refer to. Rules:
- For any claim about what research shows, use only what the notes say. Do not add studies, authors, numbers or journals from your own memory, and do not make a claim sound stronger than the note does.
- Say the note's evidence label in plain words: "direct" means studies of shadowing itself, "adjacent" means related research that is not about shadowing, "thin" means there is no good evidence. When the label is thin, say plainly that there is no good evidence.
- When you mention a study, name it by author and year as the note does. If its note says it was read as an abstract only, was known secondhand, or is unverified, say so in a few words. If the entry status says its sources are still being completed, say that too.
- Each note also says what it does not show. Don't claim that.
- If the notes don't answer the question, say you don't have good research on it, and give common-sense practice advice only if it is clearly labelled as such.
- The notes are in English. Answer in the reply language above.
- A research answer may run to about 150 words.`;
export async function chatReply(env, userId, { messages = [], context = [], knowledge = [], profile = {} }) {
  const c = await keyFor(env, userId);
  await rateLimit(env, userId);
  const turns = (Array.isArray(messages) ? messages : []).slice(-12)
    .map((m) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.text) || '').slice(0, 2000) }))
    .filter((m) => m.content.trim());
  while (turns.length && turns[0].role !== 'user') turns.shift(); // a conversation starts with the learner
  if (!turns.length || turns[turns.length - 1].role !== 'user') throw httpError(400, 'Ask a question first.');
  const system = chatSystemPrompt(profile && typeof profile === 'object' ? profile : {}, context, knowledge);
  const ask = c.provider === 'anthropic' ? askAnthropic : askOpenAICompatible;
  const text = (await ask(c, system, turns, false, 1500)).trim();
  if (!text) throw httpError(502, 'The model sent back an empty answer.');
  return { text, model: c.model, provider: c.provider };
}

async function askAnthropic(c, system, user, structured, maxTokens = 4000) {
  const client = new Anthropic({ apiKey: c.key, maxRetries: 1 });
  let res;
  try {
    res = await client.messages.create({
      model: c.model,
      max_tokens: maxTokens,
      ...(structured ? { output_config: { format: { type: 'json_schema', schema: NOTE_SCHEMA } } } : {}),
      system,
      messages: asMessages(user),
    });
  } catch (e) {
    const err = anthropicError(e);
    if (structured && e instanceof Anthropic.BadRequestError && /output_config|format|schema|structured/i.test(e.message)) err.formatProblem = true;
    throw err;
  }
  if (res.stop_reason === 'refusal') throw httpError(422, 'The model declined to answer this one.');
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function askOpenAICompatible(c, system, user, structured, maxTokens = 4000) {
  const openrouter = c.provider === 'openrouter';
  const label = PROVIDERS[c.provider].name;
  const url = openrouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: c.model,
    messages: [{ role: 'system', content: system }, ...asMessages(user)],
    // OpenAI's reasoning models count thinking against this limit, so leave room
    ...(openrouter ? { max_tokens: maxTokens } : { max_completion_tokens: maxTokens }),
    ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: 'note_feedback', strict: true, schema: NOTE_SCHEMA } } } : {}),
  };
  let d;
  try {
    d = await callJSON(label, url, { method: 'POST', headers: { authorization: `Bearer ${c.key}`, 'content-type': 'application/json', ...(openrouter ? OPENROUTER_HEADERS : {}) }, body: JSON.stringify(body) });
  } catch (e) {
    if (structured && e.status === 400 && /response_format|json_schema|structured/i.test(e.message)) e.formatProblem = true;
    throw e;
  }
  const choice = (d.choices || [])[0];
  if (!choice) throw httpError(502, `${label} sent back an empty answer.`);
  if (choice.message && choice.message.refusal) throw httpError(422, 'The model declined to answer this one.');
  return String((choice.message && choice.message.content) || '');
}

function parseReply(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = /\{[\s\S]*\}/.exec(text); // a JSON object wrapped in prose or a code fence
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return { text };
}

/* at most RATE_PER_HOUR AI calls per user per hour */
function rateLimit(env, userId) {
  return limit(env.DB, userId, 'aiRate', RATE_PER_HOUR, HOUR, 'That’s a lot of AI questions in an hour. Try again a bit later.');
}

/* ---------- errors ---------- */
async function callJSON(label, url, init) {
  let resp;
  try { resp = await fetch(url, init); } catch (e) { throw httpError(502, `Couldn’t reach ${label} (${e.message}).`); }
  const data = await resp.json().catch(() => ({}));
  if (resp.ok) return data;
  const msg = (data.error && (data.error.message || data.error)) || `HTTP ${resp.status}`;
  if (resp.status === 401 || resp.status === 403) throw httpError(400, `${label} rejected the key. Check you copied all of it.`);
  if (resp.status === 402) throw httpError(402, `Your ${label} account is out of credit.`);
  if (resp.status === 429) throw httpError(429, `${label} is rate limiting this key or it’s out of credit. Try again later.`);
  if (resp.status === 404) throw httpError(400, `${label} doesn’t know that model. Pick another one in Settings → Connections.`);
  throw httpError(resp.status === 400 ? 400 : 502, `${label} error ${resp.status}: ${String(msg).slice(0, 300)}`);
}
function anthropicError(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return httpError(400, 'Anthropic rejected the key. Check you copied all of it.');
  if (e instanceof Anthropic.NotFoundError) return httpError(400, 'Anthropic doesn’t know that model. Pick another one in Settings → Connections.');
  if (e instanceof Anthropic.RateLimitError) return httpError(429, 'Anthropic is rate limiting this key or it’s out of credit. Try again later.');
  if (e instanceof Anthropic.BadRequestError) return httpError(400, `Anthropic error: ${e.message}`);
  if (e instanceof Anthropic.APIError) return httpError(502, `Anthropic error ${e.status}: ${e.message}`);
  return httpError(502, `Couldn’t reach Anthropic (${e.message}).`);
}
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
