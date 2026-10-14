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
  if (!c) throw httpError(400, 'Add your AI key in Settings → AI first.');
  try { return { ...c, key: await decrypt(env, userId, c) }; } catch {
    throw httpError(409, 'Your saved AI key can’t be read any more. Remove it in Settings → AI and add it again.');
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
  return `You help a learner with shadowing practice: they repeat a model speaker's clip to pick up the accent, rhythm and melody. The learner is moving their ${lang} accent towards ${accent}.${native ? ` Their native language: ${native}.` : ''}${notes ? ` About them: ${notes}` : ''}

After a recorded pass they describe what sounded off. Tell them:
- feature: the likely ${accent} feature behind it (1-2 sentences)
- change: what to change in their speech (1-3 sentences)
- listenFor: what to listen for in the model clip (1-2 sentences)
- issue: a short name (max 5 words) for this as a recurring problem; reuse one of their existing issue names when it fits

Write ${spelling ? `in ${spelling} spelling, ` : ''}plainly, with no linguistics jargon: if you need to name a sound, describe it with everyday ${lang} example words. If their description is too ambiguous to work out, don't guess: set unsure to true, put "I don't know what you meant by ..." and a short question in question, and leave the other fields empty.`;
}
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
export async function noteFeedback(env, userId, { sentence = '', off = '', aim = '', issues = [], profile = {} }) {
  const c = await keyFor(env, userId);
  await rateLimit(env, userId);
  const system = systemPrompt(profile && typeof profile === 'object' ? profile : {});
  const user = `Sentence being practised: ${String(sentence).slice(0, 500) || '(not given)'}
What sounded off: ${String(off).slice(0, 2000)}
What they were aiming for: ${String(aim).slice(0, 500) || '(not given)'}
Issue names they already track: ${Array.isArray(issues) && issues.length ? issues.slice(0, 60).map(String).join('; ') : '(none yet)'}`;
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

async function askAnthropic(c, system, user, structured) {
  const client = new Anthropic({ apiKey: c.key, maxRetries: 1 });
  let res;
  try {
    res = await client.messages.create({
      model: c.model,
      max_tokens: 4000,
      ...(structured ? { output_config: { format: { type: 'json_schema', schema: NOTE_SCHEMA } } } : {}),
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch (e) {
    const err = anthropicError(e);
    if (structured && e instanceof Anthropic.BadRequestError && /output_config|format|schema|structured/i.test(e.message)) err.formatProblem = true;
    throw err;
  }
  if (res.stop_reason === 'refusal') throw httpError(422, 'The model declined to answer this one.');
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function askOpenAICompatible(c, system, user, structured) {
  const openrouter = c.provider === 'openrouter';
  const label = PROVIDERS[c.provider].name;
  const url = openrouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: c.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    // OpenAI's reasoning models count thinking against this limit, so leave room
    ...(openrouter ? { max_tokens: 4000 } : { max_completion_tokens: 4000 }),
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
  if (resp.status === 404) throw httpError(400, `${label} doesn’t know that model. Pick another one in Settings → AI.`);
  throw httpError(resp.status === 400 ? 400 : 502, `${label} error ${resp.status}: ${String(msg).slice(0, 300)}`);
}
function anthropicError(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return httpError(400, 'Anthropic rejected the key. Check you copied all of it.');
  if (e instanceof Anthropic.NotFoundError) return httpError(400, 'Anthropic doesn’t know that model. Pick another one in Settings → AI.');
  if (e instanceof Anthropic.RateLimitError) return httpError(429, 'Anthropic is rate limiting this key or it’s out of credit. Try again later.');
  if (e instanceof Anthropic.BadRequestError) return httpError(400, `Anthropic error: ${e.message}`);
  if (e instanceof Anthropic.APIError) return httpError(502, `Anthropic error ${e.status}: ${e.message}`);
  return httpError(502, `Couldn’t reach Anthropic (${e.message}).`);
}
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
