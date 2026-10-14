// English words of the public site (the reference version). The markup is in ../pages.mjs.
// L(path) gives a page's path in this language; keep the same keys in fr.mjs and es.mjs.
const make = ({ SITE, L, host }) => ({
  code: 'en',
  htmlLang: 'en-AU',
  ogLocale: 'en_AU',
  label: 'English',
  date: (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ui: {
    skip: 'Skip to content',
    homeAria: `${SITE.name} home`,
    mainNav: 'Main',
    footerNav: 'Footer',
    langNav: 'Language',
    langNow: 'Language: English',
    navWhat: 'What is shadowing?',
    navRoutine: 'Daily routine',
    footRoutine: 'Accent shadowing routine',
    contact: 'Contact',
    privacy: 'Privacy',
    terms: 'Terms',
    signIn: 'Sign in',
    openApp: 'Open the app',
    signInGoogle: 'Sign in with Google',
    ogImageAlt: `${SITE.name}: the speaker’s pitch line and yours, with the lag between them`,
    crumbs: 'Breadcrumb',
    updated: (d) => `Last updated ${d}`,
    legalRef: null,
    tryHtml: '<strong>Try it with a guide on the side.</strong> Euno Shadowing runs this routine for you: it loops the clip, counts passes, records you and shows your pitch and lag next to the speaker’s.',
    startFree: 'Start free with Google',
    readNext: 'Read next',
  },
  demo: {
    title: 'Pitch lines of the speaker and the learner',
    desc: 'Two melody lines over a short clip. The learner’s line follows the speaker’s closely, about 0.18 seconds behind, with a slightly flatter rise and fall.',
    speaker: 'Speaker',
    you: 'You',
    lag: 'Lag 0.18 s behind',
  },
  faq: [
    ['What is shadowing?', `Shadowing means speaking along with a recording at the same time as the speaker, copying their rhythm, melody and sounds as closely as you can. It trains the way you speak, not just the way you understand. <a href="${L('/what-is-shadowing/')}">Read the full guide</a>.`],
    ['Does it cost anything?', 'No. Euno Shadowing is free. AI feedback is optional and uses your own API key, so any AI usage is billed to you directly by the provider you pick, and you choose the model.'],
    ['Which languages and accents does it support?', 'You can practise English (General Australian, General American or Southern British), French (Parisian or Québécois) or Spanish (Mexican, Spain or Rioplatense), or name another accent of those languages. The app itself is available in English, French and Spanish. More languages, such as Japanese and German, are planned.'],
    ['Where are my videos and recordings stored?', 'On your device, in your browser’s storage. If you want them on more than one device, you can turn on Google Drive sync, and the files go into a “Euno Shadowing” folder in your own Drive. Our server only keeps your practice notes and progress, never the audio or video.'],
    ['Which videos can I use?', 'Any video or audio file you have the right to use for your own practice: upload a file from your device or paste a direct link to an .mp4. Interviews, podcasts and talks with one clear speaker work best.'],
    ['Do I need an AI key?', 'No. Everything works without one. With a key from Anthropic, OpenAI or OpenRouter, you can ask for feedback on what sounded off in your recording. Without a key, Euno writes the prompt for you to paste into any chatbot.'],
    ['Do I need a microphone?', 'Yes, for recording passes and check-ins. A headset or earphones help, so the speaker’s voice doesn’t leak into your recording.'],
  ],
  home: {
    title: 'Euno Shadowing: daily shadowing practice for your English accent',
    description: SITE.description,
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires a modern browser with microphone access.',
    featureList: ['Guided four-step shadowing sessions', 'Pitch and timing comparison with the speaker', 'Recording and side-by-side playback', 'Notes with optional AI feedback (bring your own key)', '12-week check-ins against a baseline', 'Discord practice reminders'],
    eyebrow: 'Free accent practice',
    h1: 'Sound more like the speakers you listen to.',
    lede: 'Euno Shadowing is a daily coach for shadowing: pick a short clip, speak along with it, and see your melody and timing next to the speaker’s. Fifteen minutes a day, and your accent moves.',
    cta: 'Start practising with Google',
    how: 'How it works',
    fine: 'Free. Works in your browser. Your videos and recordings stay on your device.',
    caption: 'After each pass, Euno lines your voice up with the speaker’s and shows how far behind you were and where your melody went flat.',
    howH2: 'A 15-minute session, done for you',
    howIntro: 'Each session works on one clip of one or two sentences. Euno loops it, counts your passes and keeps the time, so all you do is listen and speak.',
    steps: [
      ['Listen', '2 min.', 'Hear the clip three times without speaking. Notice the rhythm and where the voice rises and falls.'],
      ['Shadow', '7 min.', 'Speak along with the speaker, about 15 passes, no transcript. Copy everything: rhythm, melody and sounds.'],
      ['Record and compare', '2 min.', 'Record one pass and play it next to the original. Check your pitch line and your lag.'],
      ['Shadow again', '4 min.', 'About 8 more passes, then a final recording to compare with the first one.'],
    ],
    after: 'Short on time? Bad-day mode runs a five-minute version, so you never have to skip a day. Every duration and pass count is a setting.',
    featH2: 'Everything a shadowing routine needs',
    cards: [
      ['Clips from any video', 'Add a video, then drag on the timeline to cut a clip. A zoomed waveform helps you trim exactly at the pauses.'],
      ['See your melody', 'Pitch tracking draws the speaker’s intonation and yours, each relative to its own voice, so you can see where you go flat.'],
      ['Measure your lag', 'After each pass, Euno aligns your recording with the clip and tells you how far behind or ahead you were.'],
      ['Record and compare', 'Play the original, yourself, one after the other or both together. Your step 3 and final recordings are kept for every clip.'],
      ['Notes that find patterns', 'Write down what sounded off. Recurring problems collect into an issues list, so you know what to target next.'],
      ['12-week check-ins', 'Record a baseline, then check in at weeks 4, 8 and 12 with the same tasks, and hear how far you’ve come.'],
    ],
    privH2: 'Your voice stays yours',
    panels: [
      ['Files on your device, or your own Drive', [
        'Videos and voice recordings are stored in your browser, on your device.',
        'Want them on another device too? Turn on Google Drive sync, and they go into a folder in your own Drive.',
        'Our server only keeps your practice notes, settings and progress, and you can export or delete them any time.',
      ]],
      ['AI feedback with your own key, if you want it', [
        'Bring a key from Anthropic, OpenAI or OpenRouter and pick the model, from cheap and fast to the most capable.',
        'Your key is encrypted on our server and never shown again, not even to you.',
        'No key? Euno writes the prompt for you to paste into any chatbot.',
      ]],
    ],
    faqH2: 'Questions',
    faqIntro: `The short answers. The guides go deeper on <a href="${L('/what-is-shadowing/')}">what shadowing is</a> and <a href="${L('/accent-shadowing/')}">the daily routine</a>.`,
    faqMore: `Something else? <a href="${L('/contact/')}">Send us a message</a>.`,
    finalH2: 'Your first clip takes two minutes',
    finalP: 'Sign in with Google, pick a speaker whose accent you want, and start your first session today.',
  },
  whatIs: {
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
    <p>For a complete daily plan, read <a href="${L('/accent-shadowing/')}">how to improve your accent with shadowing</a>.</p>

    <h2>Common mistakes</h2>
    <ul>
      <li><strong>Clips that are too long.</strong> If you can’t keep up after five or six passes, shorten the clip.</li>
      <li><strong>Reading along.</strong> A transcript pulls you towards spelling and away from sound. Use it once to check words, then put it away.</li>
      <li><strong>Only copying the words.</strong> The point is the melody and timing. Exaggerate them if you need to.</li>
      <li><strong>Never listening back.</strong> You can’t hear yourself well while speaking. Record a pass and compare it with the original.</li>
      <li><strong>Switching speakers every day.</strong> Stick with one voice for a while so the patterns can settle in.</li>
    </ul>`,
    related: `<a href="${L('/accent-shadowing/')}">How to improve your English accent with shadowing: a 15-minute daily routine</a>`,
  },
  howTo: {
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
    related: `<a href="${L('/what-is-shadowing/')}">What is shadowing? How the technique works for pronunciation</a>`,
  },
  privacy: {
    title: 'Privacy policy | Euno Shadowing',
    description: 'What Euno Shadowing stores, where your recordings live, how AI keys and Google data are handled, and how to export or delete your account.',
    h1: 'Privacy policy',
    lede: 'Short version: your videos and voice recordings stay on your device or in your own Google Drive. Our server stores your account and your practice notes and progress. We don’t sell data, show ads or use tracking.',
    body: `
    <h2>Who we are</h2>
    <p>Euno Shadowing (“we”, “us”) is the shadowing practice service at ${host}. You can reach us through the <a href="${L('/contact/')}">contact form</a>.</p>

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
    <p>If we change this policy, we’ll update the date at the top, and tell you in the app if the change is significant.</p>`,
  },
  terms: {
    title: 'Terms of use | Euno Shadowing',
    description: 'The terms for using Euno Shadowing, the free shadowing practice app.',
    h1: 'Terms of use',
    lede: 'By using Euno Shadowing you agree to these terms. They are short; please read them.',
    body: `
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
    <p>Questions? Use the <a href="${L('/contact/')}">contact form</a>.</p>`,
  },
  contact: {
    title: 'Contact and support | Euno Shadowing',
    description: 'Questions, bug reports or feedback about Euno Shadowing? Send us a message.',
    h1: 'Contact and support',
    lede: 'A question, a bug, an idea, or a request about your data? Send a message and we’ll reply by email.',
    email: 'Your email',
    name: 'Name',
    optional: '(optional)',
    topic: 'Topic',
    topics: { question: 'A question', bug: 'Something isn’t working', feedback: 'Feedback or an idea', account: 'My account or my data' },
    message: 'Message',
    honeypot: 'Leave this empty',
    send: 'Send message',
    footnote: `We use your email only to reply. See the <a href="${L('/privacy/')}">privacy policy</a>.`,
  },
  notFound: {
    title: 'Page not found | Euno Shadowing',
    description: 'This page doesn’t exist.',
    h1: 'That page doesn’t exist',
    lede: 'The link may be old or mistyped.',
    home: 'Go to the home page',
  },
});
make.code = 'en';
export default make;
