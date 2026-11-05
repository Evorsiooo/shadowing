// Content of the public site. scripts/build.mjs wraps each page in the shared layout
// (head, meta and Open Graph tags, header, footer) and writes it to dist/<path>index.html.
// English is at the root (/, /privacy/, ...); French and Spanish use the same slugs under /fr/ and /es/.
// The words of each language live in src/site/content/<lang>.mjs; the markup lives here.
import en from './content/en.mjs';
import fr from './content/fr.mjs';
import es from './content/es.mjs';
import guidesEn from './content/guides-en.mjs';
import guidesFr from './content/guides-fr.mjs';
import guidesEs from './content/guides-es.mjs';

export const SITE = {
  name: 'Euno Shadowing',
  url: 'https://shadowing.euno.cc',
  description: 'Free accent practice by shadowing a speaker you choose. Euno compares your recording with their audio and marks the sounds that differ (English, beta, no score), plus your timing and melody.',
  // Starts Google sign-in (owned by the accounts work) and comes back to the app.
  signInUrl: '/auth/google',
  updated: '2026-11-02',
};

const G = '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';


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
  ear: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 3.5-3 4-3 7.5a2.5 2.5 0 0 1-5 0M9.5 9a2.5 2.5 0 0 1 5 0"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 22h4"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>',
};
// the feature cards, in the order of home.cards in each content file
const CARD_ICONS = ['scissors', 'wave', 'note', 'spark', 'chart', 'bell'];

/* ---------- languages ---------- */
// The path of a page in a language: '/privacy/' -> '/fr/privacy/'.
export function langPath(code, path) {
  return code === 'en' ? path : `/${code}${path}`;
}
const helpers = (code) => ({ SITE, L: (path) => langPath(code, path), host: SITE.url.replace('https://', '') });
const GUIDE_TEXT = { en: guidesEn, fr: guidesFr, es: guidesEs };
export const LANGS = [en, fr, es].map((make) => ({ ...make(helpers(make.code)), guides: GUIDE_TEXT[make.code](helpers(make.code)) }));
export const DEFAULT_LANG = 'en';

/* ---------- guides ---------- */
// Every guide, in the order of the Guides page. Their words are in content/guides-<lang>.mjs under the same key
// (the first two predate it and live in content/<lang>.mjs). group: the Guides page section; next: the "Read next" links.
const GUIDES = [
  { key: 'what-is-euno-shadowing', slug: '/what-is-euno-shadowing/', group: 'start', published: '2026-10-21', updated: '2026-11-02', next: ['what-is-shadowing', 'euno-vs-elsa-language-reactor'] },
  { key: 'what-is-shadowing', slug: '/what-is-shadowing/', group: 'start', published: '2026-10-14', text: (c) => c.whatIs, next: ['how-long-shadowing-takes', 'choosing-clips'] },
  { key: 'how-long-shadowing-takes', slug: '/how-long-does-shadowing-take/', group: 'start', published: '2026-10-15', updated: '2026-11-02', next: ['accent-shadowing', 'shadowing-vs-other-methods'] },
  { key: 'choosing-clips', slug: '/choosing-shadowing-clips/', group: 'start', published: '2026-10-15', updated: '2026-11-02', next: ['what-is-shadowing', 'how-long-shadowing-takes'] },
  { key: 'shadowing-vs-other-methods', slug: '/shadowing-vs-other-methods/', group: 'start', published: '2026-10-15', updated: '2026-11-02', next: ['what-is-shadowing', 'choosing-clips'] },
  { key: 'euno-vs-elsa-language-reactor', slug: '/euno-vs-elsa-and-language-reactor/', group: 'start', published: '2026-10-21', updated: '2026-11-02', next: ['shadowing-vs-other-methods', 'what-is-shadowing'] },
  { key: 'accent-shadowing', slug: '/accent-shadowing/', group: 'english', published: '2026-10-14', updated: '2026-11-02', text: (c) => c.howTo, next: ['english-accents', 'choosing-clips'] },
  { key: 'english-accents', slug: '/english-accents/', group: 'english', published: '2026-10-15', next: ['accent-shadowing', 'choosing-clips'] },
  { key: 'french-accent-shadowing', slug: '/french-accent-shadowing/', group: 'french', published: '2026-10-15', updated: '2026-11-02', next: ['french-accents', 'choosing-clips'] },
  { key: 'french-accents', slug: '/french-accents/', group: 'french', published: '2026-10-15', next: ['french-accent-shadowing', 'choosing-clips'] },
  { key: 'spanish-accent-shadowing', slug: '/spanish-accent-shadowing/', group: 'spanish', published: '2026-10-15', updated: '2026-11-02', next: ['spanish-accents', 'choosing-clips'] },
  { key: 'spanish-accents', slug: '/spanish-accents/', group: 'spanish', published: '2026-10-15', next: ['spanish-accent-shadowing', 'choosing-clips'] },
];
const GUIDE_GROUPS = ['start', 'english', 'french', 'spanish'];
const guideText = (c, g) => (g.text ? g.text(c) : c.guides[g.key]);
const guideByKey = (key) => GUIDES.find((g) => g.key === key);

// A list of guides as linked cards: the guide's heading and its description.
function guideCards(c, list) {
  return `<ul class="guide-grid">
      ${list.map((g) => { const t = guideText(c, g); return `<li><a href="${langPath(c.code, g.slug)}"><strong>${t.h1}</strong><span>${t.description}</span></a></li>`; }).join('\n      ')}
    </ul>`;
}

// An example of the Pronunciation tab, drawn for the page (not a real recording): a sentence with the differing
// words marked, and one difference open.
export function exampleCard(d = LANGS[0].example) {
  return `<div class="example" role="img" aria-label="${d.aria}">
    <p class="ex-tag">${d.tag}</p>
    <p class="ex-sentence">${d.sentence}</p>
    <div class="ex-open">
      <p class="ex-word">${d.word}</p>
      <div class="ex-pair"><span><i>${d.speaker}</i><b>${d.speakerSound}</b></span><span><i>${d.you}</i><b>${d.youSound}</b></span></div>
      <p class="ex-note">${d.note}</p><p class="ex-more">${d.more}</p>
    </div>
  </div>`;
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
    <div class="stage"><span class="euno" data-euno-hero aria-hidden="true">@EUNO_HERO@</span><figure class="demo">${exampleCard(c.example)}<figcaption>${h.caption}</figcaption></figure></div>
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

<section class="block" id="sounds">
  <div class="wrap">
    <h2>${h.soundsH2}</h2>
    <p class="intro">${h.soundsIntro}</p>
    <ul class="points">
      ${h.soundsPoints.map((x) => `<li>${x}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="block" id="what">
  <div class="wrap">
    <h2>${h.whatH2}</h2>
    <p class="intro">${h.whatIntro}</p>
    <div class="split">
      ${h.whatPanels.map(([title, items], i) => `<div class="panel ${i ? 'wattle' : 'sky'}">
        <h3>${title}</h3>
        <ul>
          ${items.map((x) => `<li>${x}</li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>
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

<section class="block" id="limits">
  <div class="wrap">
    <h2>${h.limitsH2}</h2>
    <p class="intro">${h.limitsIntro}</p>
    <ul class="limits">
      ${h.limits.map(([t, x]) => `<li><strong>${t}</strong> ${x}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="block" id="guides">
  <div class="wrap">
    <h2>${c.guides.page.homeH2}</h2>
    <p class="intro">${c.guides.page.homeIntro}</p>
    ${guideCards(c, GUIDES.filter((g) => g.group === 'start'))}
    <p class="more"><a href="${L('/guides/')}">${c.guides.page.all}</a></p>
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

function article(c, g) {
  const { title, h1, description, crumb, lede, body } = guideText(c, g);
  const path = langPath(c.code, g.slug);
  const updated = g.updated || g.published;
  const guidesPath = langPath(c.code, '/guides/');
  return {
    key: g.key,
    path,
    title,
    description,
    priority: '0.8',
    updated,
    guide: true,
    jsonld: () => [
      ORG,
      {
        '@type': 'Article',
        headline: h1,
        description,
        inLanguage: c.code,
        datePublished: g.published,
        dateModified: updated,
        mainEntityOfPage: SITE.url + path,
        image: SITE.url + '/assets/og.png',
        author: { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.url + langPath(c.code, '/') },
          { '@type': 'ListItem', position: 2, name: c.guides.page.crumb, item: SITE.url + guidesPath },
          { '@type': 'ListItem', position: 3, name: crumb, item: SITE.url + path },
        ],
      },
    ],
    body: () => `
<article class="page">
  <div class="wrap">
    <nav class="crumbs" aria-label="${c.ui.crumbs}"><a href="${langPath(c.code, '/')}">${SITE.name}</a> › <a href="${guidesPath}">${c.guides.page.crumb}</a> › ${crumb}</nav>
    <h1>${h1}</h1>
    <p class="updated">${c.ui.updated(`<time datetime="${updated}">${c.date(updated)}</time>`)}</p>
    <p class="lede">${lede}</p>
    ${body.trim()}
    <aside class="callout"><p>${c.ui.tryHtml}</p><p>${signInButton(c.ui.startFree, 'btn btn-primary')}</p></aside>
    <div class="related"><h2>${c.ui.readNext}</h2>
    ${guideCards(c, g.next.map(guideByKey))}
    <p class="more"><a href="${guidesPath}">${c.guides.page.all}</a></p></div>
  </div>
</article>`,
  };
}

// The Guides page: every guide, grouped (general first, then one group per practice language).
function guidesIndex(c) {
  const k = c.guides.page;
  const path = langPath(c.code, '/guides/');
  return {
    key: 'guides',
    path,
    title: k.title,
    description: k.description,
    priority: '0.7',
    jsonld: () => [
      ORG,
      {
        '@type': 'CollectionPage',
        name: k.h1,
        description: k.description,
        url: SITE.url + path,
        inLanguage: c.code,
        publisher: { '@id': ORG_ID },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE.url + langPath(c.code, g.slug), name: guideText(c, g).h1 })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.url + langPath(c.code, '/') },
          { '@type': 'ListItem', position: 2, name: k.crumb, item: SITE.url + path },
        ],
      },
    ],
    body: () => `
<article class="page">
  <div class="wrap">
    <nav class="crumbs" aria-label="${c.ui.crumbs}"><a href="${langPath(c.code, '/')}">${SITE.name}</a> › ${k.crumb}</nav>
    <h1>${k.h1}</h1>
    <p class="lede">${k.lede}</p>
    ${GUIDE_GROUPS.map((grp) => `<h2>${k.groups[grp]}</h2>
    ${guideCards(c, GUIDES.filter((g) => g.group === grp))}`).join('\n    ')}
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
    guidesIndex(c),
    ...GUIDES.map((g) => article(c, g)),
    legal(c, 'privacy', '/privacy/', '0.3', c.privacy),
    legal(c, 'terms', '/terms/', '0.3', c.terms),
    contact(c),
    notFound(c),
  ].map((p) => ({ ...p, lang: c.code, content: c }));
}

// Every page in every language; page.key is the same across languages, page.lang says which one.
export const pages = LANGS.flatMap(pagesFor);
