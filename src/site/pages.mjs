// Content of the public site. scripts/build.mjs wraps each page in the shared layout
// (head, meta and Open Graph tags, header, footer) and writes it to dist/<path>index.html.
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

// Illustration of the app's pitch view: the speaker's melody, yours, the lag, and the loudness under it.
export function demoSvg() {
  let bars = '';
  let seed = 7;
  for (let i = 0; i < 64; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const env = Math.sin((i / 64) * Math.PI * 3.2) ** 2 * 0.8 + 0.2;
    const hgt = Math.max(3, Math.round((seed / 233280) * 40 * env + 4));
    bars += `<rect x="${20 + i * 8.2}" y="${300 - hgt}" width="5" height="${hgt}" rx="2"/>`;
  }
  return `<svg viewBox="0 0 560 320" role="img" aria-labelledby="demoT demoD">
  <title id="demoT">Pitch lines of the speaker and the learner</title>
  <desc id="demoD">Two melody lines over a short clip. The learner's line follows the speaker's closely, about 0.18 seconds behind, with a slightly flatter rise and fall.</desc>
  <rect class="lane" x="0" y="0" width="560" height="320" rx="14"/>
  <g class="grid"><line x1="20" y1="70" x2="540" y2="70"/><line x1="20" y1="130" x2="540" y2="130"/><line x1="20" y1="190" x2="540" y2="190"/></g>
  <path class="speaker" d="M20 160 C60 120 90 95 120 125 S170 190 200 160 S260 70 300 92 S360 170 390 150 S450 105 480 130 S520 180 540 170"/>
  <path class="you" d="M34 160 C74 132 104 112 134 132 S184 180 214 157 S274 92 314 106 S374 162 404 147 S464 118 494 134 S530 168 546 164"/>
  <g class="wave">${bars}</g>
  <circle class="key-s" cx="28" cy="28" r="6"/><text class="lbl" x="40" y="33">Speaker</text>
  <circle class="key-y" cx="118" cy="28" r="6"/><text class="lbl" x="130" y="33">You</text>
  <rect class="chip" x="380" y="12" width="164" height="34" rx="17"/><text class="chip-t" x="462" y="34" text-anchor="middle">Lag 0.18 s behind</text>
</svg>`;
}

const FAQ = [
  ['What is shadowing?', 'Shadowing means speaking along with a recording at the same time as the speaker, copying their rhythm, melody and sounds as closely as you can. It trains the way you speak, not just the way you understand. <a href="/what-is-shadowing/">Read the full guide</a>.'],
  ['Does it cost anything?', 'No. Euno Shadowing is free. AI feedback is optional and uses your own API key, so any AI usage is billed to you directly by the provider you pick, and you choose the model.'],
  ['Which languages and accents does it support?', 'English at launch, with any accent as your target: General Australian, General American, Southern British or another one you name. More languages, such as French, Spanish and Japanese, are planned.'],
  ['Where are my videos and recordings stored?', 'On your device, in your browser’s storage. If you want them on more than one device, you can turn on Google Drive sync, and the files go into a “Euno Shadowing” folder in your own Drive. Our server only keeps your practice notes and progress, never the audio or video.'],
  ['Which videos can I use?', 'Any video or audio file you have the right to use for your own practice: upload a file from your device or paste a direct link to an .mp4. Interviews, podcasts and talks with one clear speaker work best.'],
  ['Do I need an AI key?', 'No. Everything works without one. With a key from Anthropic, OpenAI or OpenRouter, you can ask for feedback on what sounded off in your recording. Without a key, Euno writes the prompt for you to paste into any chatbot.'],
  ['Do I need a microphone?', 'Yes, for recording passes and check-ins. A headset or earphones help, so the speaker’s voice doesn’t leak into your recording.'],
];

export function faqJsonLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
  };
}

const home = {
  path: '/',
  title: 'Euno Shadowing: daily shadowing practice for your English accent',
  description: SITE.description,
  priority: '1.0',
  jsonld: () => [
    {
      '@type': 'WebApplication',
      name: SITE.name,
      url: SITE.url + '/',
      description: SITE.description,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires a modern browser with microphone access.',
      inLanguage: 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: ['Guided four-step shadowing sessions', 'Pitch and timing comparison with the speaker', 'Recording and side-by-side playback', 'Notes with optional AI feedback (bring your own key)', '12-week check-ins against a baseline', 'Discord practice reminders'],
      image: SITE.url + '/assets/og.png',
    },
    { '@type': 'WebSite', name: SITE.name, url: SITE.url + '/', inLanguage: 'en' },
    faqJsonLd(),
  ],
  body: () => `
<section class="hero">
  <div class="wrap">
    <div>
      <span class="eyebrow">Free accent practice</span>
      <h1>Sound more like the speakers you listen to.</h1>
      <p class="lede">Euno Shadowing is a daily coach for shadowing: pick a short clip, speak along with it, and see your melody and timing next to the speaker’s. Fifteen minutes a day, and your accent moves.</p>
      <div class="cta">${signInButton('Start practising with Google')}<a class="btn btn-ghost btn-big" href="#how">How it works</a></div>
      <p class="fine">Free. Works in your browser. Your videos and recordings stay on your device.</p>
    </div>
    <figure class="demo">${demoSvg()}<figcaption>After each pass, Euno lines your voice up with the speaker’s and shows how far behind you were and where your melody went flat.</figcaption></figure>
  </div>
</section>

<section class="block" id="how">
  <div class="wrap">
    <h2>A 15-minute session, done for you</h2>
    <p class="intro">Each session works on one clip of one or two sentences. Euno loops it, counts your passes and keeps the time, so all you do is listen and speak.</p>
    <ol class="steps">
      <li><h3>Listen</h3><p><span class="t">2 min.</span> Hear the clip three times without speaking. Notice the rhythm and where the voice rises and falls.</p></li>
      <li><h3>Shadow</h3><p><span class="t">7 min.</span> Speak along with the speaker, about 15 passes, no transcript. Copy everything: rhythm, melody and sounds.</p></li>
      <li><h3>Record and compare</h3><p><span class="t">2 min.</span> Record one pass and play it next to the original. Check your pitch line and your lag.</p></li>
      <li><h3>Shadow again</h3><p><span class="t">4 min.</span> About 8 more passes, then a final recording to compare with the first one.</p></li>
    </ol>
    <p class="intro after">Short on time? Bad-day mode runs a five-minute version, so you never have to skip a day. Every duration and pass count is a setting.</p>
  </div>
</section>

<section class="block" id="features">
  <div class="wrap">
    <h2>Everything a shadowing routine needs</h2>
    <div class="cards">
      <div class="card"><div class="ic">${icons.scissors}</div><h3>Clips from any video</h3><p>Add a video, then drag on the timeline to cut a clip. A zoomed waveform helps you trim exactly at the pauses.</p></div>
      <div class="card"><div class="ic">${icons.wave}</div><h3>See your melody</h3><p>Pitch tracking draws the speaker’s intonation and yours, each relative to its own voice, so you can see where you go flat.</p></div>
      <div class="card"><div class="ic">${icons.timer}</div><h3>Measure your lag</h3><p>After each pass, Euno aligns your recording with the clip and tells you how far behind or ahead you were.</p></div>
      <div class="card"><div class="ic">${icons.mic}</div><h3>Record and compare</h3><p>Play the original, yourself, one after the other or both together. Your step 3 and final recordings are kept for every clip.</p></div>
      <div class="card"><div class="ic">${icons.note}</div><h3>Notes that find patterns</h3><p>Write down what sounded off. Recurring problems collect into an issues list, so you know what to target next.</p></div>
      <div class="card"><div class="ic">${icons.chart}</div><h3>12-week check-ins</h3><p>Record a baseline, then check in at weeks 4, 8 and 12 with the same tasks, and hear how far you’ve come.</p></div>
    </div>
  </div>
</section>

<section class="block" id="privacy">
  <div class="wrap">
    <h2>Your voice stays yours</h2>
    <div class="split">
      <div class="panel sky">
        <h3>Files on your device, or your own Drive</h3>
        <ul>
          <li>Videos and voice recordings are stored in your browser, on your device.</li>
          <li>Want them on another device too? Turn on Google Drive sync, and they go into a folder in your own Drive.</li>
          <li>Our server only keeps your practice notes, settings and progress, and you can export or delete them any time.</li>
        </ul>
      </div>
      <div class="panel wattle">
        <h3>AI feedback with your own key, if you want it</h3>
        <ul>
          <li>Bring a key from Anthropic, OpenAI or OpenRouter and pick the model, from cheap and fast to the most capable.</li>
          <li>Your key is encrypted on our server and never shown again, not even to you.</li>
          <li>No key? Euno writes the prompt for you to paste into any chatbot.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="block" id="faq">
  <div class="wrap">
    <h2>Questions</h2>
    <div class="faq">
      ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <div class="panel">
      <h2>Your first clip takes two minutes</h2>
      <p>Sign in with Google, pick a speaker whose accent you want, and start your first session today.</p>
      ${signInButton()}
    </div>
  </div>
</section>`,
};

function article({ path, title, h1, description, crumb, lede, body, related }) {
  return {
    path,
    title,
    description,
    priority: '0.8',
    jsonld: () => [
      {
        '@type': 'Article',
        headline: h1,
        description,
        inLanguage: 'en',
        datePublished: SITE.updated,
        dateModified: SITE.updated,
        mainEntityOfPage: SITE.url + path,
        image: SITE.url + '/assets/og.png',
        author: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
        publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/', logo: { '@type': 'ImageObject', url: SITE.url + '/assets/icon-512.png' } },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.url + '/' },
          { '@type': 'ListItem', position: 2, name: crumb, item: SITE.url + path },
        ],
      },
    ],
    body: () => `
<article class="page">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">${SITE.name}</a> › ${crumb}</nav>
    <h1>${h1}</h1>
    <p class="lede">${lede}</p>
    ${body}
    <aside class="callout"><p><strong>Try it with a guide on the side.</strong> Euno Shadowing runs this routine for you: it loops the clip, counts passes, records you and shows your pitch and lag next to the speaker’s.</p><p>${signInButton('Start free with Google', 'btn btn-primary')}</p></aside>
    <div class="related"><h2>Read next</h2><p>${related}</p></div>
  </div>
</article>`,
  };
}

const whatIs = article({
  path: '/what-is-shadowing/',
  title: 'What is shadowing? How the technique works for pronunciation | Euno Shadowing',
  h1: 'What is shadowing?',
  crumb: 'What is shadowing?',
  description: 'Shadowing is speaking along with a recording at the same time as the speaker. Learn how it works, why it improves rhythm and intonation, and how to start.',
  lede: 'Shadowing is a speaking technique where you repeat what a speaker says while they are saying it, a fraction of a second behind them, like their shadow.',
  body: `
    <h2>How shadowing works</h2>
    <p>You play a short recording of a native or fluent speaker and speak along with it, out loud, at the same time. You don’t wait for the sentence to finish, and you don’t read a transcript. Your ears lead and your mouth follows a moment later.</p>
    <p>Because you can’t stop to think, you end up copying the whole shape of the speech, not just the words: where the stress falls, how the voice rises and falls, which syllables are squeezed together and where the speaker pauses.</p>
    <p>Conference interpreters have long used shadowing as a training exercise, and language learners have adopted it as a way to practise speaking with nobody else around.</p>

    <h2>Why it helps your accent</h2>
    <p>Most of what makes an accent noticeable isn’t individual sounds, it’s <strong>prosody</strong>: rhythm, stress and intonation. Those are hard to learn from rules, because you would need to think about them consciously while speaking. Shadowing trains them by imitation instead.</p>
    <ul>
      <li><strong>Rhythm and stress.</strong> Keeping pace with a speaker forces you to shorten unstressed syllables and lengthen stressed ones the way they do.</li>
      <li><strong>Intonation.</strong> You copy the melody of whole phrases, including the parts textbooks rarely mention.</li>
      <li><strong>Connected speech.</strong> Linking, reductions and dropped sounds come along for free, because you can’t pronounce every word separately at full speed.</li>
      <li><strong>Fluency.</strong> Repeating the same clip many times makes the phrases automatic, so they come out more smoothly in your own speech.</li>
    </ul>

    <h2>Shadowing versus listen and repeat</h2>
    <p>In listen-and-repeat, you hear a sentence, then say it back. That leaves time to fall back on how you think the sentence should sound. In shadowing, you speak during the sentence, which keeps your attention on what you actually hear. Both are useful; shadowing is the more demanding one, and the better one for prosody.</p>

    <h2>How to start</h2>
    <ol>
      <li><strong>Pick one speaker</strong> whose accent you would like to have. Interviews and podcasts with clear audio and little background noise work well.</li>
      <li><strong>Cut a short clip</strong> of one or two sentences, about 10 to 20 seconds.</li>
      <li><strong>Listen a few times</strong> without speaking.</li>
      <li><strong>Shadow it many times in a row</strong>, about 15 passes. Mumbling at first is fine.</li>
      <li><strong>Record yourself</strong> and compare with the original. What still sounds different?</li>
      <li><strong>Repeat daily.</strong> Fifteen minutes every day beats an hour once a week.</li>
    </ol>
    <p>For a complete daily plan, read <a href="/accent-shadowing/">how to improve your accent with shadowing</a>.</p>

    <h2>Common mistakes</h2>
    <ul>
      <li><strong>Clips that are too long.</strong> If you can’t keep up after five or six passes, shorten the clip.</li>
      <li><strong>Reading along.</strong> A transcript pulls you towards spelling and away from sound. Use it once to check words, then put it away.</li>
      <li><strong>Only copying the words.</strong> The point is the melody and timing. Exaggerate them if you need to.</li>
      <li><strong>Never listening back.</strong> You can’t hear yourself well while speaking. Record a pass and compare it with the original.</li>
      <li><strong>Switching speakers every day.</strong> Stick with one voice for a while so the patterns can settle in.</li>
    </ul>`,
  related: '<a href="/accent-shadowing/">How to improve your English accent with shadowing: a 15-minute daily routine</a>',
});

const howTo = article({
  path: '/accent-shadowing/',
  title: 'How to improve your English accent with shadowing: a daily routine | Euno Shadowing',
  h1: 'How to improve your English accent with shadowing',
  crumb: 'Accent shadowing routine',
  description: 'A practical 15-minute daily shadowing routine for your English accent: choosing clips, the four steps, recording yourself and measuring progress over 12 weeks.',
  lede: 'A 15-minute daily routine that moves your accent towards a speaker you choose, with what to practise, how often, and how to tell whether it’s working.',
  body: `
    <h2>1. Choose your target accent and speaker</h2>
    <p>Decide which accent you want, for example General American, Southern British or General Australian, and find one speaker who has it. A single speaker gives you a consistent model; you can add others later.</p>
    <p>Good sources are interviews, podcasts and talks where one person speaks naturally. Avoid music under the voice, heavy editing and scripted reading, which sounds different from conversation.</p>

    <h2>2. Cut short clips</h2>
    <p>Each session uses one clip of one or two sentences, usually 10 to 20 seconds. Cut at natural pauses so the clip doesn’t start or end mid-word. Pick sentences you would actually say yourself; their patterns will carry over into your speech sooner.</p>
    <p>A useful rotation is a new clip every other day, repeating the previous day’s clip in between. Repetition across days is where the change sticks.</p>

    <h2>3. The 15-minute session</h2>
    <table class="simple">
      <thead><tr><th>Step</th><th>Time</th><th>What you do</th></tr></thead>
      <tbody>
        <tr><td>Listen</td><td>2 min</td><td>Play the clip three times without speaking.</td></tr>
        <tr><td>Shadow</td><td>7 min</td><td>Speak along with it, about 15 passes, no transcript.</td></tr>
        <tr><td>Record and compare</td><td>2 min</td><td>Record one pass and compare it with the original.</td></tr>
        <tr><td>Shadow again</td><td>4 min</td><td>About 8 more passes, then record a final pass and compare it with the earlier one.</td></tr>
      </tbody>
    </table>
    <p>On busy days, do a five-minute version: listen, then five passes of shadowing. Try never to skip two days in a row.</p>

    <h2>4. Copy everything, then target what sticks</h2>
    <p>On every pass, try to copy the speaker as closely as you can, all at once: rhythm, melody and sounds. Don’t pick a weekly focus in advance. Instead, note down what still sounds off when you compare recordings. When the same difference shows up across several days, that becomes the one thing you target in the last step of your session.</p>

    <h2>5. Record yourself and look, not just listen</h2>
    <p>Your own voice sounds different from the inside, so recording is essential. Seeing helps too: a pitch line shows whether your voice rises and falls as much as the speaker’s, and a lag measurement shows whether you are keeping pace. Both are hard to judge by ear alone.</p>

    <h2>6. Measure progress over 12 weeks</h2>
    <p>Accent change is slow, so day-to-day comparisons are misleading. Record a baseline before you start: a few sentences read aloud, a minute retelling a clip in your own words, and a minute answering a question you haven’t seen. Repeat the same tasks at weeks 4, 8 and 12 and compare. Spontaneous speech is the real test, because reading aloud improves first.</p>
    <p>For an unbiased opinion, ask a few listeners to rate your recordings without knowing which is which.</p>

    <h2>Tips that make a difference</h2>
    <ul>
      <li>Use earphones, so you hear the speaker clearly and your recording doesn’t pick them up.</li>
      <li>Slow the clip down slightly if you can’t keep up, but keep the pitch natural.</li>
      <li>Move your mouth and body the way the speaker does; exaggerating helps at first.</li>
      <li>Practise at the same time every day, and keep a streak.</li>
    </ul>`,
  related: '<a href="/what-is-shadowing/">What is shadowing? How the technique works for pronunciation</a>',
});

const privacy = {
  path: '/privacy/',
  title: 'Privacy policy | Euno Shadowing',
  description: 'What Euno Shadowing stores, where your recordings live, how AI keys and Google data are handled, and how to export or delete your account.',
  priority: '0.3',
  body: () => `
<article class="page">
  <div class="wrap">
    <h1>Privacy policy</h1>
    <p class="updated">Last updated ${SITE.updated}</p>
    <p class="lede">Short version: your videos and voice recordings stay on your device or in your own Google Drive. Our server stores your account and your practice notes and progress. We don’t sell data, show ads or use tracking.</p>

    <h2>Who we are</h2>
    <p>Euno Shadowing (“we”, “us”) is the shadowing practice service at ${SITE.url.replace('https://', '')}. You can reach us through the <a href="/contact/">contact form</a>.</p>

    <h2>What we store and why</h2>
    <table class="simple">
      <thead><tr><th>Data</th><th>Where</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Your Google account’s email address, name and account id</td><td>Our database</td><td>To sign you in and identify your account</td></tr>
        <tr><td>Practice data: your video list, clips, sessions, notes, issues, check-in results, measurements and settings</td><td>Our database</td><td>To run the app and show your progress on any device</td></tr>
        <tr><td>Videos and voice recordings</td><td>Your browser’s storage on your device, and your Google Drive if you turn on sync</td><td>To play clips and compare your recordings. We don’t keep copies on our server.</td></tr>
        <tr><td>AI provider key (optional)</td><td>Our database, encrypted</td><td>To request AI feedback from the provider you chose, when you ask for it</td></tr>
        <tr><td>Discord webhook and user id (optional)</td><td>Our database</td><td>To send the practice reminders you set up</td></tr>
        <tr><td>Contact form messages</td><td>Our database</td><td>To answer you</td></tr>
        <tr><td>A sign-in cookie</td><td>Your browser</td><td>To keep you signed in. It’s the only cookie we set, and it is strictly necessary.</td></tr>
      </tbody>
    </table>
    <p>Our hosting provider, Cloudflare, processes technical request data such as IP addresses to deliver and protect the site.</p>

    <h2>Google data</h2>
    <p>When you sign in with Google we receive your email address, name and account id, and nothing else. If you turn on Google Drive sync, we ask for permission to access only the files Euno Shadowing creates in your Drive (the <code>drive.file</code> permission). We can’t see any of your other files.</p>
    <p>Euno Shadowing’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements. We don’t use Google data for advertising, don’t sell it, and don’t let people read it except where you ask us to (for example in a support request), for security, or where the law requires it.</p>

    <h2>AI feedback</h2>
    <p>AI feedback is optional. If you add a key, your key is encrypted on our server, is never sent back to your browser, and is used only when you ask for feedback. The text of your note (the sentence, what sounded off and your recurring issues) is then sent to the provider you chose: Anthropic, OpenAI or OpenRouter. Their own privacy policies apply to that request. Audio is not sent.</p>

    <h2>What we don’t do</h2>
    <ul>
      <li>No advertising, no analytics trackers, no selling or renting data.</li>
      <li>We don’t listen to your recordings; they aren’t on our server.</li>
      <li>The administrator can see account details (email, join date, last visit, whether Drive sync and an AI key are set) to run the service, but not your practice content.</li>
    </ul>

    <h2>How long we keep data</h2>
    <p>We keep your account and practice data until you delete your account. Contact messages are kept until they are dealt with, and no longer than a year.</p>

    <h2>Your rights and choices</h2>
    <ul>
      <li><strong>Export:</strong> download a full backup of your practice data from the app’s settings.</li>
      <li><strong>Delete:</strong> delete your account from the app’s settings, or ask us through the contact form. This removes your account, practice data, AI key and reminder settings from our database. Files in your browser stay on your device until you clear them, and files in your Drive stay yours.</li>
      <li><strong>Revoke Google access</strong> at any time in your <a href="https://myaccount.google.com/permissions" rel="noopener">Google account settings</a>.</li>
      <li>Depending on where you live (for example under the GDPR in the EU and UK), you may also have the right to access, correct or restrict the use of your data, and to complain to your data protection authority.</li>
    </ul>

    <h2>Children</h2>
    <p>Euno Shadowing isn’t meant for children under 13, or under the minimum age for digital services in your country.</p>

    <h2>Changes</h2>
    <p>If we change this policy, we’ll update the date at the top, and tell you in the app if the change is significant.</p>
  </div>
</article>`,
};

const terms = {
  path: '/terms/',
  title: 'Terms of use | Euno Shadowing',
  description: 'The terms for using Euno Shadowing, the free shadowing practice app.',
  priority: '0.3',
  body: () => `
<article class="page">
  <div class="wrap">
    <h1>Terms of use</h1>
    <p class="updated">Last updated ${SITE.updated}</p>
    <p class="lede">By using Euno Shadowing you agree to these terms. They are short; please read them.</p>

    <h2>The service</h2>
    <p>Euno Shadowing is a free web app for practising pronunciation by shadowing. We may change, pause or stop the service, or any feature of it, at any time. We’ll try to give notice of big changes, and you can always export your data first.</p>

    <h2>Your account</h2>
    <p>You sign in with a Google account and are responsible for what happens under it. Sign-up may sometimes need an invite code. We may suspend or delete accounts that break these terms or harm the service or other people.</p>

    <h2>Your content</h2>
    <ul>
      <li>Your recordings, notes and practice data belong to you. You give us only the permission needed to store and process them to run the service for you.</li>
      <li>Only add videos and audio you have the right to use for your own private practice. Don’t use Euno Shadowing to share or redistribute other people’s content.</li>
      <li>Files on your device or in your Google Drive are your responsibility to back up.</li>
    </ul>

    <h2>AI providers</h2>
    <p>If you add your own AI key, requests made with it are between you and that provider. Their terms and prices apply, and you are responsible for that usage. AI feedback can be wrong; use your own judgement.</p>

    <h2>Acceptable use</h2>
    <p>Don’t misuse the service: no attempts to access other people’s data, disrupt or overload the service, get around limits, or use it for anything unlawful.</p>

    <h2>No warranty</h2>
    <p>Euno Shadowing is provided “as is”, without warranties of any kind. We don’t promise it will be uninterrupted or error-free, or that it will change your accent. To the extent the law allows, we aren’t liable for indirect or consequential losses, or for loss of data. Nothing in these terms limits rights you have under consumer law that can’t be limited.</p>

    <h2>Changes to these terms</h2>
    <p>We may update these terms. If you keep using Euno Shadowing after a change, the new terms apply. If you don’t agree, you can delete your account at any time.</p>

    <h2>Contact</h2>
    <p>Questions? Use the <a href="/contact/">contact form</a>.</p>
  </div>
</article>`,
};

const contact = {
  path: '/contact/',
  title: 'Contact and support | Euno Shadowing',
  description: 'Questions, bug reports or feedback about Euno Shadowing? Send us a message.',
  priority: '0.4',
  body: () => `
<article class="page">
  <div class="wrap">
    <h1>Contact and support</h1>
    <p class="lede">A question, a bug, an idea, or a request about your data? Send a message and we’ll reply by email.</p>
    <form class="contact" action="/api/support" method="post" novalidate>
      <label>Your email<input type="email" name="email" autocomplete="email" required maxlength="200"></label>
      <label>Name <span class="opt">(optional)</span><input type="text" name="name" autocomplete="name" maxlength="100"></label>
      <label>Topic
        <select name="topic">
          <option value="question">A question</option>
          <option value="bug">Something isn’t working</option>
          <option value="feedback">Feedback or an idea</option>
          <option value="account">My account or my data</option>
        </select>
      </label>
      <label>Message<textarea name="message" required maxlength="5000"></textarea></label>
      <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div data-turnstile></div>
      <div><button class="btn btn-primary" type="submit">Send message</button></div>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
    <p class="updated">We use your email only to reply. See the <a href="/privacy/">privacy policy</a>.</p>
  </div>
</article>`,
};

const notFound = {
  path: '/404.html',
  title: 'Page not found | Euno Shadowing',
  description: 'This page doesn’t exist.',
  noindex: true,
  body: () => `
<article class="page">
  <div class="wrap">
    <h1>That page doesn’t exist</h1>
    <p class="lede">The link may be old or mistyped.</p>
    <p><a class="btn btn-primary" href="/">Go to the home page</a></p>
  </div>
</article>`,
};

export const pages = [home, whatIs, howTo, privacy, terms, contact, notFound];
