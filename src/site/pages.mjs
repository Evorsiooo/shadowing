// Content of the public site. scripts/build.mjs wraps each page in the shared layout
// (head, meta and Open Graph tags, header, footer) and writes it to dist/<path>index.html.
// English is at the root (/, /privacy/, ...); French and Spanish use the same slugs under /fr/ and /es/.
// The words of each language live in src/site/content/<lang>.mjs; the markup lives here.
import en from './content/en.mjs';
import fr from './content/fr.mjs';
import es from './content/es.mjs';

export const SITE = {
  name: 'Euno Shadowing',
  url: 'https://shadowing.euno.cc',
  description: 'Euno Shadowing is a free daily coach for accent shadowing. Speak along with real clips, see your pitch and timing next to the speaker’s, and track your accent over 12 weeks.',
  // Starts Google sign-in (owned by the accounts work) and comes back to the app.
  signInUrl: '/auth/google',
  updated: '2026-10-14',
};

const G = '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

export const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#45b52a"/><path d="M10 38c6 0 7-14 13-14s7 18 13 18 7-22 13-22 5 10 5 10" fill="none" stroke="#bfeaa9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"/><path d="M10 38c6 0 7-14 13-14s7 18 13 18 7-22 13-22 5 10 5 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function signInButton(label = 'Sign in with Google', cls = 'btn btn-primary btn-big') {
  return `<a class="${cls}" href="${SITE.signInUrl}" data-signin rel="nofollow">${G}<span data-label>${label}</span></a>`;
}

const icons = {
  wave: '<svg viewBox="0 0 24 24"><path d="M2 12h2l2-6 4 12 4-14 4 10 2-2h2"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
  scissors: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};
// the feature cards, in the order of home.cards in each content file
const CARD_ICONS = ['scissors', 'wave', 'timer', 'mic', 'note', 'chart'];

/* ---------- languages ---------- */
// The path of a page in a language: '/privacy/' -> '/fr/privacy/'.
export function langPath(code, path) {
  return code === 'en' ? path : `/${code}${path}`;
}
const helpers = (code) => ({ SITE, L: (path) => langPath(code, path), host: SITE.url.replace('https://', '') });
export const LANGS = [en, fr, es].map((make) => make(helpers(make.code)));
export const DEFAULT_LANG = 'en';

// Illustration of the app's pitch view: the speaker's melody, yours, the lag, and the loudness under it.
export function demoSvg(d = LANGS[0].demo) {
  let bars = '';
  let seed = 7;
  for (let i = 0; i < 64; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const env = Math.sin((i / 64) * Math.PI * 3.2) ** 2 * 0.8 + 0.2;
    const hgt = Math.max(3, Math.round((seed / 233280) * 40 * env + 4));
    bars += `<rect x="${20 + i * 8.2}" y="${300 - hgt}" width="5" height="${hgt}" rx="2"/>`;
  }
  // the second key follows the first label, whose length depends on the language
  const youX = 40 + Math.round(d.speaker.length * 8.5) + 22;
  return `<svg viewBox="0 0 560 320" role="img" aria-labelledby="demoT demoD">
  <title id="demoT">${d.title}</title>
  <desc id="demoD">${d.desc}</desc>
  <rect class="lane" x="0" y="0" width="560" height="320" rx="14"/>
  <g class="grid"><line x1="20" y1="70" x2="540" y2="70"/><line x1="20" y1="130" x2="540" y2="130"/><line x1="20" y1="190" x2="540" y2="190"/></g>
  <path class="speaker" pathLength="1" d="M20 160 C60 120 90 95 120 125 S170 190 200 160 S260 70 300 92 S360 170 390 150 S450 105 480 130 S520 180 540 170"/>
  <path class="you" pathLength="1" d="M34 160 C74 132 104 112 134 132 S184 180 214 157 S274 92 314 106 S374 162 404 147 S464 118 494 134 S530 168 546 164"/>
  <g class="wave">${bars}</g>
  <circle class="key-s" cx="28" cy="28" r="6"/><text class="lbl" x="40" y="33">${d.speaker}</text>
  <circle class="key-y" cx="${youX - 12}" cy="28" r="6"/><text class="lbl" x="${youX}" y="33">${d.you}</text>
  <rect class="chip" x="364" y="12" width="180" height="34" rx="17"/><text class="chip-t" x="454" y="34" text-anchor="middle">${d.lag}</text>
</svg>`;
}

// The publisher, shared by every page's structured data (other nodes point at it by @id).
const ORG_ID = SITE.url + '/#organization';
const ORG = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE.name,
  url: SITE.url + '/',
  logo: { '@type': 'ImageObject', url: SITE.url + '/assets/icon-512.png', width: 512, height: 512 },
};

export function faqJsonLd(c = LANGS[0]) {
  return {
    '@type': 'FAQPage',
    inLanguage: c.code,
    mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
  };
}

/* ---------- page templates (c = one language's content) ---------- */
function home(c) {
  const h = c.home;
  const L = (p) => langPath(c.code, p);
  return {
    key: 'home',
    path: L('/'),
    title: h.title,
    description: h.description,
    priority: '1.0',
    jsonld: () => [
      ORG,
      {
        '@type': 'WebApplication',
        name: SITE.name,
        url: SITE.url + L('/'),
        description: h.description,
        applicationCategory: 'EducationalApplication',
        operatingSystem: h.operatingSystem,
        browserRequirements: h.browserRequirements,
        inLanguage: c.code,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
        featureList: h.featureList,
        image: SITE.url + '/assets/og.png',
        publisher: { '@id': ORG_ID },
      },
      { '@type': 'WebSite', name: SITE.name, url: SITE.url + L('/'), inLanguage: c.code, publisher: { '@id': ORG_ID } },
      faqJsonLd(c),
    ],
    body: () => `
<section class="hero">
  <div class="wrap">
    <div>
      <h1>${h.h1}</h1>
      <p class="lede">${h.lede}</p>
      <div class="cta">${signInButton(h.cta)}<a class="btn btn-ghost btn-big" href="#how">${h.how}</a></div>
      <p class="fine">${h.fine}</p>
    </div>
    <figure class="demo">${demoSvg(c.demo)}<figcaption>${h.caption}</figcaption></figure>
  </div>
</section>

<section class="block" id="how">
  <div class="wrap">
    <h2>${h.howH2}</h2>
    <p class="intro">${h.howIntro}</p>
    <ol class="steps">
      ${h.steps.map(([title, time, text]) => `<li><h3>${title}</h3><p><span class="t">${time}</span> ${text}</p></li>`).join('\n      ')}
    </ol>
    <p class="intro after">${h.after}</p>
  </div>
</section>

<section class="block" id="features">
  <div class="wrap">
    <h2>${h.featH2}</h2>
    <div class="cards">
      ${h.cards.map(([title, text], i) => `<div class="card"><div class="ic">${icons[CARD_ICONS[i]]}</div><h3>${title}</h3><p>${text}</p></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="block" id="privacy">
  <div class="wrap">
    <h2>${h.privH2}</h2>
    <div class="split">
      ${h.panels.map(([title, items], i) => `<div class="panel ${i ? 'wattle' : 'sky'}">
        <h3>${title}</h3>
        <ul>
          ${items.map((x) => `<li>${x}</li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="block" id="faq">
  <div class="wrap">
    <div class="faq-wrap">
      <div class="faq-intro">
        <h2>${h.faqH2}</h2>
        <p>${h.faqIntro}</p>
        <p class="faq-more">${h.faqMore}</p>
      </div>
      <div class="faq">
        ${c.faq.map(([q, a]) => `<details><summary><span>${q}</span><i aria-hidden="true"></i></summary><div class="a"><p>${a}</p></div></details>`).join('\n        ')}
      </div>
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <div class="panel">
      <h2>${h.finalH2}</h2>
      <p>${h.finalP}</p>
      ${signInButton(c.ui.signInGoogle)}
    </div>
  </div>
</section>`,
  };
}

function article(c, key, { slug, title, h1, description, crumb, lede, body, related }) {
  const path = langPath(c.code, slug);
  return {
    key,
    path,
    title,
    description,
    priority: '0.8',
    jsonld: () => [
      ORG,
      {
        '@type': 'Article',
        headline: h1,
        description,
        inLanguage: c.code,
        datePublished: SITE.updated,
        dateModified: SITE.updated,
        mainEntityOfPage: SITE.url + path,
        image: SITE.url + '/assets/og.png',
        author: { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.url + langPath(c.code, '/') },
          { '@type': 'ListItem', position: 2, name: crumb, item: SITE.url + path },
        ],
      },
    ],
    body: () => `
<article class="page">
  <div class="wrap">
    <nav class="crumbs" aria-label="${c.ui.crumbs}"><a href="${langPath(c.code, '/')}">${SITE.name}</a> › ${crumb}</nav>
    <h1>${h1}</h1>
    <p class="updated">${c.ui.updated(`<time datetime="${SITE.updated}">${c.date(SITE.updated)}</time>`)}</p>
    <p class="lede">${lede}</p>
    ${body.trim()}
    <aside class="callout"><p>${c.ui.tryHtml}</p><p>${signInButton(c.ui.startFree, 'btn btn-primary')}</p></aside>
    <div class="related"><h2>${c.ui.readNext}</h2><p>${related}</p></div>
  </div>
</article>`,
  };
}

// Privacy and terms: the English text is the reference, the translations say so.
function legal(c, key, slug, priority, { title, description, h1, lede, body }) {
  return {
    key,
    path: langPath(c.code, slug),
    title,
    description,
    priority,
    body: () => `
<article class="page">
  <div class="wrap">
    <h1>${h1}</h1>
    <p class="updated">${c.ui.updated(c.date(SITE.updated))}</p>${c.ui.legalRef ? `\n    <p class="updated ref">${c.ui.legalRef(langPath('en', slug))}</p>` : ''}
    <p class="lede">${lede}</p>
    ${body.trim()}
  </div>
</article>`,
  };
}

function contact(c) {
  const k = c.contact;
  return {
    key: 'contact',
    path: langPath(c.code, '/contact/'),
    title: k.title,
    description: k.description,
    priority: '0.4',
    body: () => `
<article class="page">
  <div class="wrap">
    <h1>${k.h1}</h1>
    <p class="lede">${k.lede}</p>
    <form class="contact" action="/api/support" method="post" novalidate>
      <label>${k.email}<input type="email" name="email" autocomplete="email" required maxlength="200"></label>
      <label>${k.name} <span class="opt">${k.optional}</span><input type="text" name="name" autocomplete="name" maxlength="100"></label>
      <label>${k.topic}
        <select name="topic">
          ${Object.entries(k.topics).map(([v, label]) => `<option value="${v}">${label}</option>`).join('\n          ')}
        </select>
      </label>
      <label>${k.message}<textarea name="message" required maxlength="5000"></textarea></label>
      <div class="hp" aria-hidden="true"><label>${k.honeypot}<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div data-turnstile></div>
      <div><button class="btn btn-primary" type="submit">${k.send}</button></div>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
    <p class="updated">${k.footnote}</p>
  </div>
</article>`,
  };
}

// One 404 per language: Cloudflare Pages serves the nearest 404.html up the path, so /fr/x gets /fr/404.html.
function notFound(c) {
  const k = c.notFound;
  return {
    key: '404',
    path: langPath(c.code, '/404.html'),
    title: k.title,
    description: k.description,
    noindex: true,
    body: () => `
<article class="page">
  <div class="wrap">
    <h1>${k.h1}</h1>
    <p class="lede">${k.lede}</p>
    <p><a class="btn btn-primary" href="${langPath(c.code, '/')}">${k.home}</a></p>
  </div>
</article>`,
  };
}

export function pagesFor(c) {
  return [
    home(c),
    article(c, 'what-is-shadowing', { slug: '/what-is-shadowing/', ...c.whatIs }),
    article(c, 'accent-shadowing', { slug: '/accent-shadowing/', ...c.howTo }),
    legal(c, 'privacy', '/privacy/', '0.3', c.privacy),
    legal(c, 'terms', '/terms/', '0.3', c.terms),
    contact(c),
    notFound(c),
  ].map((p) => ({ ...p, lang: c.code, content: c }));
}

// Every page in every language; page.key is the same across languages, page.lang says which one.
export const pages = LANGS.flatMap(pagesFor);
