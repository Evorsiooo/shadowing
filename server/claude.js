// Claude feedback on "what sounded off" notes, through the Claude API.
// The API key lives only in the server's secrets (ANTHROPIC_API_KEY).
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You help Adrien with shadowing practice. Adrien is 18, a French-Australian heritage speaker of English: his comprehension is native-level and he hears his own errors well, but he only started speaking English regularly at 17 and a half. He is moving his accent towards General Australian English (his model speaker is Oscar Piastri). His differences are mostly in rhythm, stress and melody rather than individual words.

After a recorded pass he describes what sounded off. Tell him:
- feature: the likely General Australian English feature behind it (1-2 sentences)
- change: what to change in his speech (1-3 sentences)
- listenFor: what to listen for in the model clip (1-2 sentences)
- issue: a short name (max 5 words) for this as a recurring problem; reuse one of his existing issue names when it fits

Write in Australian spelling, plainly, with no linguistics jargon: if you need to name a sound, describe it with everyday example words. If his description is too ambiguous to work out, don't guess: set unsure to true, put "I don't know what you meant by ..." and a short question in question, and leave the other fields empty.`;

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

export async function noteFeedback(env, { sentence = '', off = '', aim = '', issues = [] }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  const user = `Sentence being practised: ${String(sentence).slice(0, 500) || '(not given)'}
What sounded off: ${String(off).slice(0, 2000)}
What he was aiming for: ${String(aim).slice(0, 500) || '(not given)'}
Issue names he already tracks: ${issues.length ? issues.slice(0, 60).map(String).join('; ') : '(none yet)'}`;
  let res;
  try {
    res = await client.beta.messages.create({
      model: env.CLAUDE_MODEL || MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: NOTE_SCHEMA } },
      system: SYSTEM,
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
