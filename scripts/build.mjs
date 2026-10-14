// Builds the site into dist/ for Cloudflare Pages:
//   dist/app/index.html  — the whole app as one page (styles and scripts inlined), served at /app/
//   dist/index.html, dist/<page>/index.html, dist/404.html — the public site (src/site/), pre-rendered
//   dist/assets/         — site script, icons and the social image
//   dist/robots.txt, dist/sitemap.xml, dist/site.webmanifest
//   dist/sw.js           — the service worker (reminder notifications; makes the site installable)
//   dist/_headers        — security headers, caching and noindex rules
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SITE, LOGO, pages, signInButton } from '../src/site/pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const out = (path, text) => { mkdirSync(dirname(join(dist, path)), { recursive: true }); writeFileSync(join(dist, path), text); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

/* ---------- the app, at /app/ ---------- */
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const js = readdirSync(join(src, 'js'))
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

const header = `<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/" aria-label="${SITE.name} home">${LOGO}<span>Euno <small>Shadowing</small></span></a>
  <nav class="site-nav" aria-label="Main">
    <a class="hide-sm" href="/what-is-shadowing/">What is shadowing?</a>
    <a class="hide-sm" href="/accent-shadowing/">Daily routine</a>
    ${signInButton('Sign in', 'btn btn-primary btn-sm').replace('data-signin', 'data-signin data-signed-in="Open the app"')}
  </nav>
</div></header>`;

const footer = `<footer class="site-foot"><div class="wrap">
  <a class="brand" href="/">Euno <small>Shadowing</small></a>
  <nav aria-label="Footer">
    <a href="/what-is-shadowing/">What is shadowing?</a>
    <a href="/accent-shadowing/">Accent shadowing routine</a>
    <a href="/contact/">Contact</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
  </nav>
  <span class="copy">© ${year} ${SITE.name}</span>
</div></footer>`;

function render(page) {
  const url = SITE.url + (page.path === '/404.html' ? '/' : page.path);
  const ld = page.jsonld ? page.jsonld() : [];
  const ldTag = ld.length ? `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  const isArticle = ld.some((x) => x['@type'] === 'Article');
  const meta = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    '<meta name="theme-color" content="#45b52a">',
    `<meta property="og:site_name" content="${SITE.name}">`,
    `<meta property="og:type" content="${isArticle ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(page.title.replace(/ \| Euno Shadowing$/, ''))}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE.url}/assets/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${SITE.name}: the speaker’s pitch line and yours, with the lag between them">`,
    '<meta property="og:locale" content="en_US">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
  return `<!doctype html>
<html lang="en">
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
${header}
<main id="main">
${page.body().trim()}
</main>
${footer}
</body>
</html>
`;
}

for (const page of pages) out(page.path.endsWith('.html') ? page.path : page.path + 'index.html', render(page));

mkdirSync(join(dist, 'assets'), { recursive: true });
for (const f of readdirSync(join(src, 'site', 'assets'))) copyFileSync(join(src, 'site', 'assets', f), join(dist, 'assets', f));
copyFileSync(join(src, 'site', 'site.js'), join(dist, 'assets', 'site.js'));
copyFileSync(join(src, 'site', 'sw.js'), join(dist, 'sw.js'));

out('robots.txt', `User-agent: *\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
out(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url><loc>${SITE.url}${p.path}</loc><lastmod>${SITE.updated}</lastmod><priority>${p.priority}</priority></url>`)
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
  `script-src 'self' ${sha(themeJs)}`,
  `style-src 'self' ${sha(siteCss)} https://fonts.googleapis.com`,
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
console.log(`built dist/app/index.html (${(body.length / 1024).toFixed(0)} KB) and ${pages.length} site pages`);
