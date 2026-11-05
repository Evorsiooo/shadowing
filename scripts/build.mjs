// Builds the site into dist/ for Cloudflare Pages:
//   dist/app/index.html  — the app's page, served at /app/
//   dist/assets/h/       — the app's script and styles (minified) and the fonts, named by content hash
//                          so browsers keep them for a year and fetch new ones only after a change
//   dist/index.html, dist/<page>/index.html, dist/404.html — the public site (src/site/), pre-rendered,
//                    in English at the root and in French and Spanish under dist/fr/ and dist/es/
//   dist/assets/         — site script, icons and the social image; dist/favicon.ico at the root
//   dist/robots.txt, dist/sitemap.xml, dist/llms.txt, dist/site.webmanifest
//   dist/sw.js           — the service worker (reminder notifications; makes the site installable)
//   dist/_headers        — security headers, caching and noindex rules
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transformSync, buildSync } from 'esbuild';
import { SITE, LANGS, DEFAULT_LANG, langPath, pages, signInButton } from '../src/site/pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const out = (path, text) => { mkdirSync(dirname(join(dist, path)), { recursive: true }); writeFileSync(join(dist, path), text); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

/* ---------- fingerprinted files: dist/assets/h/<name>.<hash>.<ext>, cached for a year ---------- */
rmSync(join(dist, 'assets', 'h'), { recursive: true, force: true });
function fingerprint(name, ext, content) {
  const path = `assets/h/${name}.${createHash('sha256').update(content).digest('hex').slice(0, 10)}.${ext}`;
  out(path, content);
  return `/${path}`;
}

/* ---------- fonts: Rubik and Nunito (SIL OFL, src/fonts/), served from this site ---------- */
// Rubik is the interface's font. Nunito is kept only for sound symbols (IPA), which Rubik doesn't cover.
// Variable fonts, Latin and Latin Extended subsets as Google Fonts cuts them; browsers fetch the
// extended file only when a page uses one of its characters.
const SUBSETS = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
};
const FAMILIES = [['Rubik', 'rubik', '300 900'], ['Nunito', 'nunito', '400 800']];
const fontFiles = {};
for (const [, file] of FAMILIES) for (const sub of Object.keys(SUBSETS)) fontFiles[`${file}-${sub}`] = fingerprint(`${file}-${sub}`, 'woff2', readFileSync(join(src, 'fonts', `${file}-${sub}.woff2`)));
const fontCss = FAMILIES.flatMap(([family, file, weight]) => Object.entries(SUBSETS).map(([sub, range]) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${fontFiles[`${file}-${sub}`]}) format('woff2');unicode-range:${range}}`)).join('\n');
// the Latin files are needed for the first paint of every page, so fetch them straight away
const FONT_PRELOADS = ['rubik-latin'].map((k) => `<link rel="preload" href="${fontFiles[k]}" as="font" type="font/woff2" crossorigin>`).join('\n');
const minify = (code, loader) => transformSync(code, { loader, minify: true, legalComments: 'none' }).code;

/* ---------- the app, at /app/ ---------- */
const css = fontCss + '\n' + readFileSync(join(src, 'styles.css'), 'utf8');
// Interface translations: src/i18n/*.json, merged into one table the app reads through t() (src/js/01-i18n.js).
const i18n = {};
for (const f of readdirSync(join(src, 'i18n')).filter((f) => f.endsWith('.json')).sort()) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(src, 'i18n', f), 'utf8')))) i18n[k] = { ...(i18n[k] || {}), ...v };
}
/* ---------- in-browser pronunciation engine (src/phones/): worker + ONNX Runtime Web files, served from this site ---------- */
// The worker bundles onnxruntime-web (MIT) and the engine. The two runtime files (loader + WASM, about 11 MB) are copied
// next to it, so nothing about the engine comes from a third-party host except the model download itself.
const ORT_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
const ortDist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const bundle = (entry) => buildSync({ entryPoints: [join(src, 'phones', entry)], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' }).outputFiles[0].text;
const phonesWorker = bundle('worker.mjs');
const phonesDev = bundle('dev.mjs');
const phonesHash = createHash('sha256').update(phonesWorker).update(phonesDev);
for (const f of ORT_FILES) phonesHash.update(readFileSync(join(ortDist, f)));
const phonesDir = `assets/h/phones/${phonesHash.digest('hex').slice(0, 10)}`;
out(`${phonesDir}/worker.js`, phonesWorker);
out(`${phonesDir}/dev.js`, phonesDev);
for (const f of ORT_FILES) copyFileSync(join(ortDist, f), join(dist, phonesDir, f));
const withPhones = (code) => code.replace('__PHONES_WORKER_URL__', `/${phonesDir}/worker.js`).replace('__PHONES_WASM_BASE__', `/${phonesDir}/`);

/* ---------- in-browser word labels (src/words/): Whisper base.en through transformers.js, worker + its own ONNX Runtime files ---------- */
// transformers.js ships a different ONNX Runtime build from the pronunciation engine's, so its files get their own folder. Only the
// WebAssembly backend is used (device: 'wasm'), but the JSEP build is the one this transformers.js version is compiled against.
const WORDS_ORT = ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'];
const wordsDist = join(root, 'node_modules', '@huggingface', 'transformers', 'dist');
const wordsWorker = buildSync({ entryPoints: [join(src, 'words', 'worker.mjs')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none' }).outputFiles[0].text;
const wordsHash = createHash('sha256').update(wordsWorker);
for (const f of WORDS_ORT) wordsHash.update(readFileSync(join(wordsDist, f)));
const wordsDir = `assets/h/words/${wordsHash.digest('hex').slice(0, 10)}`;
out(`${wordsDir}/worker.js`, wordsWorker);
for (const f of WORDS_ORT) copyFileSync(join(wordsDist, f), join(dist, wordsDir, f));
const withWords = (code) => code.replace('__WORDS_WORKER_URL__', `/${wordsDir}/worker.js`).replace('__WORDS_WASM_BASE__', `/${wordsDir}/`);

/* ---------- Euno, the mascot (src/euno/): the avatar engine bundled with his definition ---------- */
// The engine is the Bible Strong avatar lab's (AGPL-3.0, src/euno/engine/LICENSE). It draws Euno live in the app and on the
// home page; eunoSvg() draws him once, as plain SVG, for the logo, the icons and the server's pages.
const EUNO_BUILD = { bundle: true, write: false, platform: 'browser', target: 'es2020', minify: true, legalComments: 'none', alias: { 'ajv/dist/2020.js': join(src, 'euno', 'ajv-stub.js') } };
const eunoJs = buildSync({ ...EUNO_BUILD, entryPoints: [join(src, 'euno', 'entry.mjs')], format: 'iife' }).outputFiles[0].text;
const eunoStatic = await import('data:text/javascript;base64,' + Buffer.from(buildSync({ ...EUNO_BUILD, entryPoints: [join(src, 'euno', 'static.mjs')], format: 'esm', platform: 'node', minify: false }).outputFiles[0].text).toString('base64'));
const eunoSvg = eunoStatic.eunoSvg;

// Euno's research notes (src/knowledge/entries.json), shipped inside the app script as plain text (see src/js/86-knowledge.js).
const knowledge = JSON.parse(readFileSync(join(src, 'knowledge', 'entries.json'), 'utf8'));
const js = eunoJs + '\n' + `const KNOWLEDGE = ${JSON.stringify(knowledge).replace(/</g, '\\u003c')};\n` + `const EUNO_LOGO = ${JSON.stringify(eunoSvg('attentive-left', { label: null, idSuffix: '-logo' }))};\n` + `const I18N_STRINGS = ${JSON.stringify(i18n).replace(/</g, '\\u003c')};\n` + readdirSync(join(src, 'js'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `/* ---- ${f} ---- */\n` + withWords(withPhones(readFileSync(join(src, 'js', f), 'utf8'))))
  .join('\n');
if (js.includes('</script')) throw new Error('A script contains "</script", which would break the inline page.');

const appCss = fingerprint('app', 'css', minify(css, 'css'));
const appJs = fingerprint('app', 'js', minify(js, 'js'));
const body = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('<!--@FONTS@-->', () => FONT_PRELOADS)
  // relative, so dist/app/index.html also opens from disk (without the server it runs in browser storage)
  .replace('@STYLES@', () => `..${appCss}`)
  .replace('@SCRIPTS@', () => `..${appJs}`);

// Google's search results want a PNG/ICO whose size is a multiple of 48px, so the 48 and 96 are not optional.
// The icon URLs carry a short hash of the icon files: browsers keep favicons for a very long time, so a changed
// icon only shows up once its URL changes too. /favicon.ico itself stays unversioned for crawlers that ask for it blindly.
const ICON_V = createHash('sha256').update(readFileSync(join(src, 'site', 'favicon.ico'))).update(readFileSync(join(src, 'site', 'assets', 'favicon.svg'))).digest('hex').slice(0, 8);
const ICON_LINKS = `<link rel="icon" href="/favicon.ico?v=${ICON_V}" sizes="48x48">\n<link rel="icon" href="/assets/favicon.svg?v=${ICON_V}" type="image/svg+xml">\n<link rel="icon" href="/assets/favicon-32.png?v=${ICON_V}" sizes="32x32" type="image/png">\n<link rel="icon" href="/assets/favicon-48.png?v=${ICON_V}" sizes="48x48" type="image/png">\n<link rel="icon" href="/assets/favicon-96.png?v=${ICON_V}" sizes="96x96" type="image/png">\n<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png?v=${ICON_V}">\n<link rel="manifest" href="/site.webmanifest">`;
const APP_THEME_COLOR = '<meta name="theme-color" content="#f6f7f3">'; // light is the default; applyTheme (88-settings.js) switches it for dark

// The app's CSP is a <meta> tag so it can pin the page's own inline scripts by hash. Scripts are
// only these and this site's own files; everything else the app loads is data: video links on any https site, Google Drive,
// Google profile pictures, and blob: URLs for files on the device. Styles stay 'unsafe-inline'
// because the app sets style attributes. frame-ancestors can't go in a meta tag; X-Frame-Options covers it.
const appScripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
const appCsp = [
  "default-src 'self'",
  `script-src 'self' ${appScripts.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https: http:",
  "connect-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

mkdirSync(dist, { recursive: true });
rmSync(join(dist, 'artifact.html'), { force: true });
// Developer page for the pronunciation engine: /app/phones-dev/ (signed-in users only, like the rest of /app/, and noindex)
out('app/phones-dev/index.html', readFileSync(join(src, 'phones', 'dev.html'), 'utf8')
  .replace('@CLIENT@', () => `/${phonesDir}/client.js`).replace('@DEV@', () => `/${phonesDir}/dev.js`));
out(`${phonesDir}/client.js`, withPhones(readFileSync(join(src, 'js', '24-phones.js'), 'utf8')));

out(
  'app/index.html',
  `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${appCsp}">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex, nofollow">\n${APP_THEME_COLOR}\n${ICON_LINKS}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);

/* ---------- the public site ---------- */
const siteCss = minify(fontCss + '\n' + readFileSync(join(src, 'site', 'site.css'), 'utf8'), 'css');
// Same as the app's first-paint theme script (src/index.html), so the saved theme choice applies here too (light when none is saved).
const themeJs = `try { const t = JSON.parse(localStorage.getItem('shadowing:theme')); if (t === 'dark' || t === 'system') document.documentElement.setAttribute('data-theme', t); } catch { /* storage blocked */ }`;
const year = SITE.updated.slice(0, 4);
// Euno on the site: drawn once as SVG for the logo and for the home page's first paint. On the home page the engine then
// takes over in place: the still is drawn in the engine's own frame and pose, so the swap can't be seen, and he simply
// holds one pose looking at the demo card below him, and blinks. With reduced motion he stays as drawn.
const SITE_LOGO = eunoSvg('attentive-left', { label: null, idSuffix: '-site' });
const HERO_LOOK = [-14, -6]; // he looks down at the demo card
const HERO_EUNO = eunoSvg('downward-gaze', { label: null, idSuffix: '-hero', fit: false, look: HERO_LOOK });
const eunoSiteJs = fingerprint('euno-site', 'js', minify(eunoJs + `
(function () {
  var el = document.querySelector('[data-euno-hero]');
  if (!el || !window.EunoEngine || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var still = el.firstElementChild;
  var def = window.EunoEngine.calm({ look: ${JSON.stringify(HERO_LOOK)}, holds: { watching: ['downward-gaze'] } });
  var a = window.EunoEngine.create(el, { definition: def, defaultExpression: 'downward-gaze', autoplay: false });
  a.play('watching');
  if (still && still.parentNode === el) el.removeChild(still);
  document.addEventListener('visibilitychange', function () { if (document.hidden) a.pause(); else a.play('watching'); });
})();`, 'js'));

const LANG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

// The same page in another language (a 404 has no counterpart, so it points at that language's home page).
const pageIn = (page, code) => (page.key === '404' ? langPath(code, '/') : pages.find((p) => p.key === page.key && p.lang === code).path);

// Language links: each language named in its own language. site.js saves the choice for the app.
const langLinks = (page) => LANGS.map((l) => `<a href="${pageIn(page, l.code)}" hreflang="${l.code}" lang="${l.code}" data-lang-switch="${l.code}"${l.code === page.lang ? ' aria-current="true"' : ''}>${l.label}</a>`);

function header(page) {
  const c = page.content;
  const u = c.ui;
  const L = (p) => langPath(c.code, p);
  return `<a class="skip" href="#main">${u.skip}</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${L('/')}" aria-label="${esc(u.homeAria)}">${SITE_LOGO}<span>Euno <small>Shadowing</small></span></a>
  <nav class="site-nav" aria-label="${esc(u.mainNav)}">
    <a class="hide-sm" href="${L('/what-is-shadowing/')}">${u.navWhat}</a>
    <a class="hide-sm" href="${L('/accent-shadowing/')}">${u.navRoutine}</a>
    <details class="lang-menu">
      <summary aria-label="${esc(u.langNow)}">${LANG_ICON}<span>${c.code.toUpperCase()}</span></summary>
      <div class="lang-list" role="group" aria-label="${esc(u.langNav)}">${langLinks(page).join('')}</div>
    </details>
    ${signInButton(u.signIn, 'btn btn-primary btn-sm').replace('data-signin', `data-signin data-signed-in="${esc(u.openApp)}"`)}
  </nav>
</div></header>`;
}

function footer(page) {
  const c = page.content;
  const u = c.ui;
  const L = (p) => langPath(c.code, p);
  return `<footer class="site-foot"><div class="wrap">
  <nav aria-label="${esc(u.footerNav)}">
    <a href="${L('/contact/')}">${u.contact}</a>
    <a href="${L('/privacy/')}">${u.privacy}</a>
    <a href="${L('/terms/')}">${u.terms}</a>
  </nav>
  <nav class="foot-langs" aria-label="${esc(u.langNav)}">${langLinks(page).join('')}</nav>
  <span class="copy">© ${year} ${SITE.name}</span>
</div></footer>`;
}

function render(page) {
  const c = page.content;
  const url = SITE.url + (page.key === '404' ? langPath(c.code, '/') : page.path);
  const ld = page.jsonld ? page.jsonld() : [];
  const ldTag = ld.length ? `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  const isArticle = ld.some((x) => x['@type'] === 'Article');
  const alternates = page.noindex ? [] : [
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE.url}${pageIn(page, l.code)}">`),
    `<link rel="alternate" hreflang="x-default" href="${SITE.url}${pageIn(page, DEFAULT_LANG)}">`,
  ];
  const meta = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    // Indexable pages allow full-length snippets and large image previews in search and AI answers.
    page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">\n<meta name="robots" content="max-snippet:-1, max-image-preview:large">`,
    ...alternates,
    '<meta name="theme-color" content="#f6f7f3">',
    `<meta property="og:site_name" content="${SITE.name}">`,
    `<meta property="og:type" content="${isArticle ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(page.title.replace(/ \| Euno Shadowing$/, ''))}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE.url}/assets/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(c.ui.ogImageAlt)}">`,
    `<meta property="og:locale" content="${c.ogLocale}">`,
    ...(page.noindex ? [] : LANGS.filter((l) => l.code !== c.code).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`)),
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>${themeJs}</script>
${meta}
${ICON_LINKS}
${FONT_PRELOADS}
<style>${siteCss}</style>
<script src="/assets/site.js" defer></script>${ldTag}
</head>
<body>
${header(page)}
<main id="main">
${page.body().trim().replace('@EUNO_HERO@', () => HERO_EUNO)}${page.key === 'home' ? `\n<script src="${eunoSiteJs}" defer></script>` : ''}
</main>
${footer(page)}
</body>
</html>
`;
}

// Inline scripts and styles are pinned by hash in the CSP below; collect every one actually rendered,
// so a page that gains an inline script can't silently break under the policy.
const inlineScripts = new Set();
const inlineStyles = new Set();
for (const page of pages) {
  const html = render(page);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) if (!/type="application\/ld\+json"/.test(m[1])) inlineScripts.add(m[2]);
  for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) inlineStyles.add(m[1]);
  out(page.path.endsWith('.html') ? page.path : page.path + 'index.html', html);
}

mkdirSync(join(dist, 'assets'), { recursive: true });
for (const f of readdirSync(join(src, 'site', 'assets'))) copyFileSync(join(src, 'site', 'assets', f), join(dist, 'assets', f));
copyFileSync(join(src, 'site', 'site.js'), join(dist, 'assets', 'site.js'));
copyFileSync(join(src, 'site', 'favicon.ico'), join(dist, 'favicon.ico')); // crawlers ask for /favicon.ico without reading the page
// The build id changes whenever the app's files do, so each deploy installs a fresh service worker that drops the old cache.
out('sw.js', readFileSync(join(src, 'site', 'sw.js'), 'utf8').replace('@BUILD@', () => createHash('sha256').update(appJs + appCss).digest('hex').slice(0, 10)));

// Every crawler is welcome on the public pages. The AI search and answer crawlers are also named,
// so it's explicit that the site wants to be found and cited in AI answers (a named bot reads only its own group).
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
const rules = 'Allow: /\nDisallow: /api/\nDisallow: /auth/\n';
out('robots.txt', `User-agent: *\n${rules}\n${AI_SEARCH_BOTS.map((b) => `User-agent: ${b}`).join('\n')}\n${rules}\nSitemap: ${SITE.url}/sitemap.xml\n`);

// llms.txt (llmstxt.org): a plain-text summary of the site and its key pages for AI assistants and agents.
// Built from the English content, so it stays in step with the pages.
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const en = LANGS.find((l) => l.code === DEFAULT_LANG);
const pageUrl = (key, code = DEFAULT_LANG) => SITE.url + pages.find((p) => p.key === key && p.lang === code).path;
const linkTo = (key) => { const p = pages.find((x) => x.key === key && x.lang === DEFAULT_LANG); return `- [${p.title.replace(/ \| Euno Shadowing$/, '')}](${pageUrl(key)}): ${p.description}`; };
out(
  'llms.txt',
  `# ${SITE.name}

> ${SITE.description}

${plain(en.home.lede)} ${plain(en.home.fine)}

## What it is, and what it is not

- Cost: Euno Shadowing is completely free. There is no subscription, no paid plan or premium tier, no free trial (there is nothing to subscribe to) and no card to enter. Only the optional Ask Euno feature can cost money, because it uses the user's own AI key and the provider bills them directly.
- Euno Shadowing is a free web app at ${SITE.url.replace(/^https:\/\//, '')} for practising pronunciation and accent by shadowing (speaking along with a recording) in English, French and Spanish. Full explanation: ${pageUrl('what-is-euno-shadowing')}
- You bring your own videos or audio (upload a file or paste a link to an .mp4) and cut short clips of one or two sentences. There are no built-in lessons, no content library, no subtitles and no transcripts, and it does not pull content from YouTube.
- It is not an app for job shadowing (such as Erasmus+ visits for teachers), medical or pre-med shadowing, or the Euno enterprise AI platform, and is not affiliated with them. It is also not the journaling apps named Euno.
- Core idea: you pick a speaker and clips, shadow them, and Euno compares your recording with the speaker's actual audio. For English clips it marks where your sounds differ from the speaker's (a Pronunciation tab, beta); for every language it also shows your timing and melody next to the speaker's.
- Pronunciation feedback (English only, beta, off by default): after a recorded pass, the Pronunciation tab compares the sounds in your recording with the sounds in the speaker's audio and marks up to three places where yours differ, with the words they fall in. It shows differences from the speaker, not mistakes. It compares against the speaker's actual audio, not a transcript or a standard accent, and gives no score. It does not coach tongue or lip position. The analysis runs in the browser on a computer after a one-time download of a speech model of about 71 MB from Hugging Face, and the recording is not uploaded for it. It can misread a sound, and it shows nothing when the audio is too noisy. The words shown above the sounds come from a separate optional speech model, Whisper, about 80 MB, also downloaded once and run in the browser, because clips have no transcripts. Across sessions Euno keeps a history of which sound differences keep coming back and which have gone quiet. French and Spanish clips do not have the sound comparison yet; they get timing and melody.
- Other feedback: how far behind or ahead of the speaker you were, where you went faster or slower, and pitch direction and stress, after each recorded pass. An optional speech-recognition check (Chrome only, off by default) can mark clip words that may have been unclear. Ask Euno (optional, with your own Anthropic, OpenAI or OpenRouter key) answers questions about notes and measurements; only text is sent, never audio.
- No score and no grade anywhere. Euno does not claim to be a pronunciation scoring tool like ELSA Speak: it compares you with the speaker you chose.

## Features

${en.home.featureList.filter((f) => !f.startsWith('Read-only MCP')).map((f) => `- ${f}`).join('\n')}
- Optional read-only connection to Claude, ChatGPT or Gemini through MCP (sign-in required), so an AI app can see the user's own practice data, including the pronunciation history (tools get_pronunciation_progress and get_clip_pronunciation: the speaker's and the learner's sounds per clip and per take, English only, compared with the speaker's audio). It cannot change anything and never receives audio
- Clips cut from your own videos, with a zoomed waveform for trimming at the pauses
- Looping, playback at 0.5x, 0.75x or 1x, and keyboard shortcuts
- A five-minute bad-day version of the session; durations and pass counts are settings

## Guides

${pages.filter((p) => p.guide && p.lang === DEFAULT_LANG).map((p) => linkTo(p.key)).join('\n')}

## Product

- [Home page](${pageUrl('home')}): ${en.home.description}
- [All guides](${pageUrl('guides')}): ${en.guides.page.description}
- [Open the app](${SITE.url}/app/): the practice app itself (sign-in with Google required).
- [Contact and support](${pageUrl('contact')}): questions, bug reports and data requests.

## Facts

${en.faq.map(([q, a]) => `- ${plain(q)} ${plain(a).replace(/ Read the full guide\.$/, '')}`).join('\n')}

## Policies

${linkTo('privacy')}
${linkTo('terms')}

## Other languages

${LANGS.filter((l) => l.code !== DEFAULT_LANG).map((l) => `- [${l.label}](${pageUrl('home', l.code)}): ${l.home.title}`).join('\n')}
`,
);
// Every indexable page in every language, each listing its translations (xhtml:link alternates).
out(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url>\n    <loc>${SITE.url}${p.path}</loc>\n    <lastmod>${p.updated || SITE.updated}</lastmod>\n    <priority>${p.priority}</priority>\n${[...LANGS.map((l) => [l.code, pageIn(p, l.code)]), ['x-default', pageIn(p, DEFAULT_LANG)]]
      .map(([code, path]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${SITE.url}${path}"/>`)
      .join('\n')}\n  </url>`)
    .join('\n')}\n</urlset>\n`,
);
out(
  'site.webmanifest',
  JSON.stringify({
    name: SITE.name,
    short_name: 'Euno',
    description: SITE.description,
    id: '/app/',
    start_url: '/app/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f6f7f3',
    theme_color: '#f6f7f3', // the app is light by default (--bg in styles.css)
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n',
);

// The public pages get a strict CSP (their only inline script and style are pinned by hash).
// The app has its own CSP in a <meta> tag (above), so the site's one is detached under /app/.
const siteCsp = [
  "default-src 'self'",
  `script-src 'self' ${[...inlineScripts].map(sha).join(' ')} https://challenges.cloudflare.com`, // Turnstile widget on /contact/
  `style-src 'self' ${[...inlineStyles].map(sha).join(' ')}`,
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');
out(
  '_headers',
  `/*
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Permissions-Policy: microphone=(self), camera=(), geolocation=()
  Content-Security-Policy: ${siteCsp}

/app/*
  ! Content-Security-Policy
  X-Robots-Tag: noindex, nofollow

/assets/*
  Cache-Control: public, max-age=86400

/favicon.ico
  Cache-Control: public, max-age=86400

/assets/h/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

# The pronunciation worker runs WebAssembly, which the site-wide policy above would block; it has its own narrow one.
/assets/h/phones/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'

# The word-label worker runs WebAssembly and downloads Whisper from Hugging Face (and the CDN it redirects to), so it may connect out.
/assets/h/words/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https:

/sw.js
  Cache-Control: no-cache

# Preview and pages.dev copies must not compete with shadowing.euno.cc in search results.
https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
`,
);
console.log(`built dist/app/index.html (${(body.length / 1024).toFixed(1)} KB; script ${appJs}, styles ${appCss}) and ${pages.length} site pages in ${LANGS.length} languages (${LANGS.map((l) => l.code).join(', ')})`);
