// Claude feedback on "what sounded off" notes, through the Claude API.
// The API key lives only in the server's secrets (ANTHROPIC_API_KEY).
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-5-5';

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

Write ${spelling ? `in ${spelling} spelling, ` : ''}plainly, with no linguistics jargon: if you need to name a sound, describe it with everyday example words. If their description is too ambiguous to work out, don't guess: set unsure to true, put "I don't know what you meant by ..." and a short question in question, and leave the other fields empty.`;
}

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

export function claudeConfigured(env) { return !!env.ANTHROPIC_API_KEY; }
export function claudeModel(env) { return env.CLAUDE_MODEL || MODEL; }

export async function noteFeedback(env, { sentence = '', off = '', aim = '', issues = [], profile = {} }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  const user = `Sentence being practised: ${String(sentence).slice(0, 500) || '(not given)'}
What sounded off: ${String(off).slice(0, 2000)}
What they were aiming for: ${String(aim).slice(0, 500) || '(not given)'}
Issue names they already track: ${issues.length ? issues.slice(0, 60).map(String).join('; ') : '(none yet)'}`;
  let res;
  try {
    res = await client.messages.create({
      model: env.CLAUDE_MODEL || MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: NOTE_SCHEMA } },
      system: systemPrompt(profile && typeof profile === 'object' ? profile : {}),
      messages: [{ role: 'user', content: user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw httpError(502, 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.');
    if (e instanceof Anthropic.RateLimitError) throw httpError(429, 'Claude is rate limited or out of credit. Try again later.');
    if (e instanceof Anthropic.APIError) throw httpError(502, `Claude API error ${e.status}: ${e.message}`);
    throw httpError(502, `Couldn't reach Claude (${e.message}).`);
  }
  if (res.stop_reason === 'refusal') throw httpError(422, 'Claude declined to answer this one.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { return { text }; }
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
