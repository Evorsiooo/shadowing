/* ---------- interface language ---------- */
/* The interface is written in English and translated through t():
     t('Save settings')                      -> 'Enregistrer les réglages' in French
     t('Week {n}', { n: 4 })                 -> placeholders in braces
     tp(n, '{n} day', '{n} days')            -> plural pair; the right form for the language
     N_('Read aloud')                        -> marks a string kept in a constant; translate it with t() when shown
   Translations live in src/i18n/*.json as { "English text": { "fr": "...", "es": "..." } }; the build merges
   them into I18N_STRINGS. Plural entries use the key "one|other" and the same shape in each language.
   Never call t() at the top level of a file: the language can change while the page is open.
   `npm run check:i18n` lists strings that are missing a translation. */
const UI_LANGS = { en: 'English', fr: 'Français', es: 'Español' };
const UI_LANG_NAMES_EN = { en: 'English', fr: 'French', es: 'Spanish' };
const UI_LOCALES = { en: 'en-AU', fr: 'fr-FR', es: 'es-ES' };
/* the saved choice (shared with the public site), else the browser's languages, else English */
function detectUiLang() {
  const saved = lsGet('lang', null);
  if (UI_LANGS[saved]) return saved;
  const nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).slice(0, 2).toLowerCase());
  return nav.find((l) => UI_LANGS[l]) || 'en';
}
let LANG = detectUiLang();
function uiLocale() { return UI_LOCALES[LANG] || 'en-AU'; }
document.documentElement.lang = uiLocale();

function fillVars(s, vars) { return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s; }
function t(key, vars) {
  const e = typeof I18N_STRINGS !== 'undefined' && I18N_STRINGS[key];
  return fillVars((LANG !== 'en' && e && e[LANG]) || key, vars);
}
function tp(n, one, other, vars) {
  const key = `${one}|${other}`;
  const e = typeof I18N_STRINGS !== 'undefined' && I18N_STRINGS[key];
  const forms = ((LANG !== 'en' && e && e[LANG]) || key).split('|');
  let cat = 'other';
  try { cat = new Intl.PluralRules(uiLocale()).select(n); } catch { cat = n === 1 ? 'one' : 'other'; }
  return fillVars(cat === 'one' ? forms[0] : forms[forms.length - 1], { n, ...(vars || {}) });
}
function N_(key) { return key; }

/* switch language in place: everything is drawn by functions, so a re-render picks it up */
function setUiLang(l) {
  if (!UI_LANGS[l] || l === LANG) return;
  LANG = l;
  lsSet('lang', l);
  document.documentElement.lang = uiLocale();
  if (typeof renderAll === 'function') renderAll();
}
