// Builds the site into dist/ for Cloudflare Pages:
//   dist/app/index.html  — the whole app as one page (styles and scripts inlined), served at /app/
//   dist/index.html, dist/<page>/index.html, dist/404.html — the public site (src/site/), pre-rendered,
//                    in English at the root and in French and Spanish under dist/fr/ and dist/es/
//   dist/assets/         — site script, icons and the social image
//   dist/robots.txt, dist/sitemap.xml, dist/site.webmanifest
//   dist/sw.js           — the service worker (reminder notifications; makes the site installable)
//   dist/_headers        — security headers, caching and noindex rules
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SITE, LOGO, LANGS, DEFAULT_LANG, langPath, pages, signInButton } from '../src/site/pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const out = (path, text) => { mkdirSync(dirname(join(dist, path)), { recursive: true }); writeFileSync(join(dist, path), text); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

/* ---------- the app, at /app/ ---------- */
const css = readFileSync(join(src, 'styles.css'), 'utf8');
// Interface translations: src/i18n/*.json, merged into one table the app reads through t() (src/js/01-i18n.js).
const i18n = {};
for (const f of readdirSync(join(src, 'i18n')).filter((f) => f.endsWith('.json')).sort()) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(src, 'i18n', f), 'utf8')))) i18n[k] = { ...(i18n[k] || {}), ...v };
}
const js = `const I18N_STRINGS = ${JSON.stringify(i18n).replace(/</g, '\\u003c')};\n` + readdirSync(join(src, 'js'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `/* ---- ${f} ---- */\n` + readFileSync(join(src, 'js', f), 'utf8'))
  .join('\n');
if (js.includes('</script')) throw new Error('A script contains "</script", which would break the inline page.');

const body = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('/*@STYLES@*/', () => css)
  .replace('/*@SCRIPTS@*/', () => js);

const ICON_LINKS = `<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">\n<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">`;

// The app's CSP is a <meta> tag so it can pin the page's own inline scripts by hash. Scripts are
// only these; everything else the app loads is data: video links on any https site, Google Drive,
// Google profile pictures, and blob: URLs for files on the device. Styles stay 'unsafe-inline'
// because the app sets style attributes. frame-ancestors can't go in a meta tag; X-Frame-Options covers it.
const appScripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
const appCsp = [
  "default-src 'self'",
  `script-src 'self' ${appScripts.join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
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
out(
  'app/index.html',
  `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${appCsp}">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="robots" content="noindex, nofollow">\n${ICON_LINKS}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);

/* ---------- the public site ---------- */
const siteCss = readFileSync(join(src, 'site', 'site.css'), 'utf8');
// Same as the app's first-paint theme script (src/index.html), so the saved light/dark choice applies here too.
const themeJs = `try { const t = JSON.parse(localStorage.getItem('shadowing:theme')); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch { /* storage blocked */ }`;
const year = SITE.updated.slice(0, 4);

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
  <a class="brand" href="${L('/')}" aria-label="${esc(u.homeAria)}">${LOGO}<span>Euno <small>Shadowing</small></span></a>
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
  <a class="brand" href="${L('/')}">Euno <small>Shadowing</small></a>
  <nav aria-label="${esc(u.footerNav)}">
    <a href="${L('/what-is-shadowing/')}">${u.navWhat}</a>
    <a href="${L('/accent-shadowing/')}">${u.footRoutine}</a>
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
    page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    ...alternates,
    '<meta name="theme-color" content="#45b52a">',
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap">
<style>${siteCss}</style>
<script src="/assets/site.js" defer></script>${ldTag}
</head>
<body>
${header(page)}
<main id="main">
${page.body().trim()}
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
copyFileSync(join(src, 'site', 'sw.js'), join(dist, 'sw.js'));

out('robots.txt', `User-agent: *\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
// Every indexable page in every language, each listing its translations (xhtml:link alternates).
out(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url>\n    <loc>${SITE.url}${p.path}</loc>\n    <lastmod>${SITE.updated}</lastmod>\n    <priority>${p.priority}</priority>\n${[...LANGS.map((l) => [l.code, pageIn(p, l.code)]), ['x-default', pageIn(p, DEFAULT_LANG)]]
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
    start_url: '/app/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f8f1',
    theme_color: '#45b52a',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n',
);

// The public pages get a strict CSP (their only inline script and style are pinned by hash).
// The app has its own CSP in a <meta> tag (above), so the site's one is detached under /app/.
const siteCsp = [
  "default-src 'self'",
  `script-src 'self' ${[...inlineScripts].map(sha).join(' ')}`,
  `style-src 'self' ${[...inlineStyles].map(sha).join(' ')} https://fonts.googleapis.com`,
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self'",
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

/sw.js
  Cache-Control: no-cache

# Preview and pages.dev copies must not compete with shadowing.euno.cc in search results.
https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
`,
);
console.log(`built dist/app/index.html (${(body.length / 1024).toFixed(0)} KB) and ${pages.length} site pages in ${LANGS.length} languages (${LANGS.map((l) => l.code).join(', ')})`);
