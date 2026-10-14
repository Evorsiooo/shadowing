// The server's messages in the user's language (English, French, Spanish).
// The app sends its interface language in the x-euno-lang header (and the euno_lang cookie); pages opened
// straight in the browser (sign-in, Drive, the MCP consent screen) read the cookie, then Accept-Language.
// Reminders, which run with no request, use the language saved in the user's settings (uiLang).
//
// Most messages are written in English where they're raised and translated on the way out:
// localise() rewrites the `error` of JSON error responses and the text of the small HTML pages,
// matching each message against MESSAGES (src: server/messages.js). A message with {placeholders}
// matches any text with the same fixed parts; the values are kept (and translated too when they are
// messages themselves). tr() translates directly where the text is built from pieces.
import { MESSAGES } from './messages.js';

export const LANGS = ['en', 'fr', 'es'];
export const LOCALES = { en: 'en-AU', fr: 'fr-FR', es: 'es-ES' };

export function cleanLang(l) { const x = String(l || '').slice(0, 2).toLowerCase(); return LANGS.includes(x) ? x : null; }

export function requestLang(request) {
  const fromHeader = cleanLang(request.headers.get('x-euno-lang'));
  if (fromHeader) return fromHeader;
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)euno_lang=([a-z]{2})/);
  const fromCookie = cookie && cleanLang(cookie[1]);
  if (fromCookie) return fromCookie;
  for (const part of (request.headers.get('accept-language') || '').split(',')) {
    const l = cleanLang(part.trim());
    if (l) return l;
  }
  return 'en';
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);

/** Translate one English message (placeholders filled from vars). */
export function tr(lang, en, vars) {
  const e = lang !== 'en' && MESSAGES[en];
  return fill((e && e[lang]) || en, vars);
}

// messages with placeholders, as regular expressions: "Couldn’t reach {label} ({detail})." -> /^Couldn’t reach (.*?) \((.*?)\)\.$/
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = Object.keys(MESSAGES).filter((k) => /\{\w+\}/.test(k)).map((k) => {
  const names = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const re = new RegExp('^' + k.split(/\{\w+\}/).map(escRe).join('([\\s\\S]*?)') + '$');
  return { key: k, names, re };
}).sort((a, b) => b.key.length - a.key.length); // most specific first

/** Translate a message that may have been built with values in it; unknown text comes back unchanged. */
export function translateMessage(lang, msg, depth = 0) {
  if (lang === 'en' || typeof msg !== 'string' || !msg) return msg;
  const e = MESSAGES[msg];
  if (e && e[lang]) return e[lang];
  if (depth > 1) return msg;
  for (const p of PATTERNS) {
    const m = msg.match(p.re);
    if (!m) continue;
    const vars = {};
    p.names.forEach((n, i) => { vars[n] = translateMessage(lang, m[i + 1], depth + 1); });
    return tr(lang, p.key, vars);
  }
  return msg;
}

/** Rewrite a response's messages into `lang`: JSON errors, and the text of HTML pages. */
export async function localise(res, lang) {
  if (lang === 'en' || !res || !res.body) return res;
  const type = res.headers.get('content-type') || '';
  if (type.startsWith('application/json') && res.status >= 400) {
    const text = await res.text();
    let out = text;
    try {
      const d = JSON.parse(text);
      if (d && typeof d === 'object') {
        if (typeof d.error === 'string' && d.error.includes(' ')) d.error = translateMessage(lang, d.error); // OAuth error codes have no spaces
        if (typeof d.error_description === 'string') d.error_description = translateMessage(lang, d.error_description);
        out = JSON.stringify(d);
      }
    } catch { /* not JSON after all */ }
    return new Response(out, res);
  }
  if (type.startsWith('text/html')) {
    const html = (await res.text())
      .replace(/<html lang="en">/, `<html lang="${LOCALES[lang]}">`)
      .replace(/(<(title|h1|p|li|a|button|label|span|strong)\b[^>]*>)([^<]+)(?=<)/g, (all, open, tag, text) => {
        const trimmed = text.trim();
        if (!trimmed) return all;
        const t = translateMessage(lang, trimmed);
        return t === trimmed ? all : open + text.replace(trimmed, t);
      });
    return new Response(html, res);
  }
  return res;
}
