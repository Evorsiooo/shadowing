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
    contact: 'Contact',
    privacy: 'Privacy',
    terms: 'Terms',
    signIn: 'Sign in',
    openApp: 'Open the app',
    signInGoogle: 'Sign in with Google',
    ogImageAlt: `${SITE.name}: shadow a real speaker and see which of your sounds differ`,
    crumbs: 'Breadcrumb',
    updated: (d) => `Last updated ${d}`,
    legalRef: null,
    tryHtml: '<strong>Try it with a guide on the side.</strong> It is completely free, with no subscription. Euno Shadowing runs this routine for you: it loops the clip, counts passes, records you and, in English, marks where your sounds differ from the speaker’s.',
    startFree: 'Start free with Google',
    readNext: 'Read next',
  },
  example: {
    aria: 'Example of the Pronunciation tab: in the sentence “I think this is the one”, “think” and “this” are marked. The speaker says “think” with the “th” sound and you said an “s”, so it came out like “sink”.',
    tag: 'What Euno shows you',
    sentence: 'I <mark>think</mark> <mark>this</mark> is the one.',
    word: 'think',
    speaker: 'Speaker',
    you: 'You',
    speakerSound: 'th',
    youSound: 's',
    note: 'The speaker says “think” with a “th”, as in “thin”. You said an “s”, so it came out like “sink”.',
    more: 'Play the speaker, then yourself, and hear the difference.',
  },
  faq: [
    ['What is shadowing?', `Shadowing means speaking along with a recording at the same time as the speaker, copying their rhythm, melody and sounds as closely as you can. It trains the way you speak, not just the way you understand. <a href="${L('/what-is-shadowing/')}">Read the full guide</a>.`],
    ['What is Euno Shadowing, and is it related to job shadowing or Euno AI?', `Euno Shadowing is a free web app for practising your accent by shadowing: speaking along with short clips of videos you bring. After a recorded pass it compares your recording with the speaker’s audio and, for English, marks the sounds that differ. It also shows your timing and melody next to theirs. It is not related to job-shadowing programmes such as Erasmus+, to medical shadowing, or to the Euno enterprise AI platform. <a href="${L('/what-is-euno-shadowing/')}">What it is, and what it is not</a>.`],
    ['Can it correct my pronunciation?', 'In part, and only for English. After a recorded pass, the Pronunciation tab compares the sounds in your recording with the sounds in the speaker’s audio and marks up to three places where yours differ, with the words they fall in. It shows differences from the speaker, not mistakes: it compares you with the speaker you chose, not with a transcript or a standard accent, and it gives no score. It does not coach where to put your tongue or lips. It is a beta feature and it can misread a sound, so each item can be dismissed with “Sounds the same to me”. It runs in your browser, on a computer: it is off until you turn it on in Settings → Analysis, which downloads a speech model of about 71 MB to your device once (from Hugging Face, a third-party host), and your recording is not uploaded for it. French and Spanish clips get the timing and melody measurements only, for now.'],
    ['What feedback does it give?', 'For English, the Pronunciation tab marks up to three places per recorded pass where your sounds differ from the speaker’s audio (beta, off by default, no score). For every language, Euno also shows how far behind or ahead of the speaker you were, where you went faster or slower, and where your pitch and stress went another way. You can play the original and your recording one after the other or together. An optional speech-recognition check (Chrome only, off by default) can mark words that may have been unclear. Ask Euno, with your own AI key, can answer questions about your notes and these measurements. Euno gives no score, and it has no automatic subtitles or transcripts.'],
    ['Does it cost anything?', 'No. Euno Shadowing is completely free: there is no subscription, no paid plan, no premium tier and no card to enter. The only thing that can cost money is the optional Ask Euno feature, which uses your own AI key, so any usage is billed to you directly by the provider you pick (Anthropic, OpenAI or OpenRouter). Everything else works without it.'],
    ['Is there a free trial or a paid plan?', 'No. There is no free trial because there is nothing to subscribe to: every feature of the app is free from the start, and there are no paid tiers. You can start by signing in with Google.'],
    ['Which languages and accents does it support?', 'You can practise English (General Australian, General American or Southern British), French (Parisian or Québécois) or Spanish (Mexican, Spain or Rioplatense), or name another accent of those languages. The app itself is available in English, French and Spanish. More languages, such as Japanese and German, are planned. The sound-level Pronunciation tab is English only for now.'],
    ['Where are my videos and recordings stored?', 'In your own Google Drive. When you connect it, the app puts your files in a “Euno Shadowing” folder there, so they’re on every device you sign in on, and it can only see the files it creates. Your browser also keeps a copy of the files you open so they play instantly. Our server only keeps your practice notes and progress, never the audio or video.'],
    ['Which videos can I use?', 'Any video or audio file you have the right to use for your own practice: upload a file from your device or paste a direct link to an .mp4. Interviews, podcasts and talks with one clear speaker work best.'],
    ['Does Euno come with lessons, videos or transcripts?', 'No. You shadow your own videos: upload a file from your device or paste a link, then cut the clips you want to practise. Euno has no lesson library, subtitles or transcripts of its own. It runs the shadowing routine on your clips and compares your voice with the speaker’s.'],
    ['Do I need an AI key?', 'No. Everything works without one. With a key from Anthropic, OpenAI or OpenRouter, you can ask Euno about a sound, your notes or your practice inside the app. Without a key, notes give you a prompt to paste into any chatbot.'],
    ['Can I connect Claude, ChatGPT or Gemini?', 'Yes, optionally. In Settings → Connections you can link Claude, ChatGPT or Gemini to your own practice data through MCP. They can read your notes, sessions and pronunciation history, and nothing else: they cannot change anything and never receive audio.'],
    ['Do I need a microphone?', 'Yes, for recording passes and check-ins. A headset or earphones help, so the speaker’s voice doesn’t leak into your recording.'],
  ],
  home: {
    title: 'Euno Shadowing: free accent practice that marks where your sounds differ from the speaker’s',
    description: SITE.description,
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires a modern browser with microphone access.',
    featureList: ['English pronunciation feedback: marks the sounds that differ from the speaker’s audio, analysed in your browser (beta, no score)', 'Guided four-step shadowing sessions on clips cut from your own videos', 'Pronunciation history across sessions: which differences keep coming back', 'Timing and melody comparison with the speaker', 'Recording and side-by-side playback', 'Ask Euno: questions and notes answered with your own AI key (optional)', 'Read-only MCP connection to Claude, ChatGPT or Gemini (optional)', '12-week check-ins against a baseline', 'Discord and push practice reminders'],
    h1: 'Shadow a real speaker. See which of your sounds differ.',
    lede: 'Euno Shadowing is a free web app for accent practice. Cut a short clip from a video of someone whose accent you want, speak along with it for fifteen minutes, and Euno compares your recording with the speaker’s audio and marks the sounds that differ.',
    cta: 'Start practising with Google',
    how: 'How it works',
    fine: 'Completely free: no subscription, no paid plan, no card. Runs in your browser. The sound comparison is English only, and a beta. Your files go to your own Google Drive, not our server.',
    caption: 'An example of the Pronunciation tab, drawn for this page. Not a real recording.',
    howH2: 'A session, start to finish',
    howIntro: 'Each session works on one clip of one or two sentences. Euno loops it, counts your passes and keeps the time, so all you do is listen and speak.',
    steps: [
      ['Listen', '2 min.', 'Hear the clip three times without speaking. Notice the rhythm and where the voice rises and falls.'],
      ['Shadow', '7 min.', 'Speak along with the speaker, about 15 passes, no transcript. Copy everything: rhythm, melody and sounds.'],
      ['Record and compare', '2 min.', 'Record one pass and play it next to the original. In English, the Pronunciation tab (beta, off by default) marks up to three places where your sounds differ from the speaker’s. Timing and melody are shown too.'],
      ['Shadow again', '4 min.', 'About 8 more passes, then a final recording to compare with the first one.'],
    ],
    after: 'Short on time? Bad-day mode runs a five-minute version, so you never have to skip a day. Every duration and pass count is a setting.',
    soundsH2: 'Your sounds, set against the speaker’s',
    soundsIntro: 'This is what the Pronunciation tab does after a recorded pass. It is English only, a beta, and off until you turn it on in Settings → Analysis, a one-time download of about 71 MB. It runs on your device, and your recording is not uploaded for it.',
    soundsPoints: [
      '<strong>Compared with the speaker, not a rulebook.</strong> Euno lines up the sounds in your recording with the sounds in the speaker’s audio. It uses no transcript and no standard accent, so the target is the person you chose.',
      '<strong>Up to three places per pass.</strong> The words are marked in the sentence. Open one to see the speaker’s sound and yours.',
      '<strong>It remembers.</strong> Across sessions, Euno keeps track of which differences keep coming back and which have gone quiet, so you know what to listen for next.',
      '<strong>No score, and it can be wrong.</strong> A computer is listening. It can misread a sound, or show nothing on a noisy clip, so you decide by ear, and you can dismiss any item with “Sounds the same to me”.',
    ],
    whatH2: 'You pick the speaker. Euno runs the practice.',
    whatIntro: 'Euno Shadowing is a practice tool, not a course, so there are no lessons to follow. The voice you copy is one you chose, and the comparison is against that voice.',
    whatPanels: [
      ['Your clips, your speaker', [
        'Upload a video or audio file, or paste a link to an .mp4, then cut a clip of one or two sentences.',
        'Pick any speaker whose accent you want: an interviewee, a podcaster, a speaker you admire.',
        'There are no built-in lessons, subtitles or transcripts. The routine, the timer, the recording and the comparison are what Euno adds.',
      ]],
      ['Ask Euno, if you want', [
        'Ask about a sound, your notes or your practice, right in the app. Euno knows your notes and what the computer flagged lately. He hasn’t heard your voice, so he can be wrong.',
        'It uses your own key from Anthropic, OpenAI or OpenRouter, so you choose the model and pay the provider directly. Only text is sent, never audio.',
        'No key? Notes give you a prompt to paste into any chatbot. Everything else works the same.',
      ]],
    ],
    featH2: 'Around the practice',
    cards: [
      ['Clips from any video', 'Add a video, then drag on the timeline to cut a clip. A zoomed waveform helps you trim exactly at the pauses.'],
      ['Timing and melody', 'Next to the sounds, Euno shows how far behind or ahead of the speaker you were and where your pitch and stress went another way. French and Spanish clips get these.'],
      ['Notes that find patterns', 'Write down what sounded off. Recurring problems collect into an issues list, so you know what to target next.'],
      ['Ask Euno', 'Questions about a sound or your week, answered with your own AI key. Optional.'],
      ['12-week check-ins', 'Record a baseline, then check in at weeks 4, 8 and 12 with the same tasks, and hear how far you’ve come.'],
      ['Reminders that fit your day', 'Optional Discord and browser push reminders, so the practice actually happens.'],
    ],
    privH2: 'Free, private, and nothing hosted by us',
    panels: [
      ['Your files, in your own Drive', [
        'Videos and voice recordings go into a “Euno Shadowing” folder in your own Google Drive, so they’re on every device you sign in on.',
        'The app can only see the files it puts there, and our server never stores them.',
        'Our server only keeps your practice notes, settings and progress, and you can export or delete them any time.',
        'The English sound comparison is worked out in your browser, so your recording is not uploaded for it.',
      ]],
      ['Your AI key, your AI apps', [
        'Bring a key from Anthropic, OpenAI or OpenRouter only if you want Ask Euno. Your key is encrypted on our server and never shown again, not even to you.',
        'You can also connect Claude, ChatGPT or Gemini to your own practice data, read-only, to ask them about your progress. They never receive audio and cannot change anything.',
        'No key and no AI app? Everything else works the same.',
      ]],
    ],
    limitsH2: 'What it does not do',
    limitsIntro: 'So you know before you sign in.',
    limits: [
      ['No lessons or library.', 'You bring the videos. Euno has no courses, ready-made clips, subtitles or transcripts.'],
      ['No score.', 'Nothing says right or wrong. It shows where your sounds, timing and melody differ from the speaker’s, and a computer can misjudge them.'],
      ['Sound comparison is English only.', 'It is a beta. French and Spanish clips get timing and melody for now.'],
      ['No mouth coaching.', 'It does not tell you where to put your tongue or lips. For a sound that keeps coming back, pair it with minimal pairs or a phonetics guide.'],
    ],
    faqH2: 'Questions',
    faqIntro: `The short answers. The guides go deeper on <a href="${L('/what-is-shadowing/')}">what shadowing is</a> and <a href="${L('/accent-shadowing/')}">the daily routine</a>.`,
    faqMore: `Something else? <a href="${L('/contact/')}">Send us a message</a>.`,
    finalH2: 'Start with one clip',
    finalP: 'Sign in with Google, add a video of a speaker whose accent you want, cut one sentence, and run your first session today.',
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
    <p>For English clips there is one more thing to look at: the Pronunciation tab (beta) shows up to three places where the sounds you made differ from the sounds in the speaker’s audio. Treat each as a place to listen, not as a verdict.</p>

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
  },
  privacy: {
    title: 'Privacy policy | Euno Shadowing',
    description: 'What Euno Shadowing stores, where your recordings live, what stays on your device for the pronunciation analysis, how AI keys and Google data are handled, and how to export or delete your account.',
    h1: 'Privacy policy',
    lede: 'Short version: your videos and voice recordings are kept in your own Google Drive, not on our server. Our server stores your account and your practice notes and progress. We don’t sell data, show ads or use tracking.',
    body: `
    <h2>Who we are</h2>
    <p>Euno Shadowing (“we”, “us”) is the shadowing practice service at ${host}. You can reach us through the <a href="${L('/contact/')}">contact form</a>.</p>

    <h2>What we store and why</h2>
    <table class="simple">
      <thead><tr><th>Data</th><th>Where</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Your Google account’s email address, name and account id</td><td>Our database</td><td>To sign you in and identify your account</td></tr>
        <tr><td>Practice data: your video list, clips, sessions, notes, issues, check-in results, measurements and settings</td><td>Our database</td><td>To run the app and show your progress on any device</td></tr>
        <tr><td>Videos and voice recordings</td><td>A “Euno Shadowing” folder in your own Google Drive, plus a copy in your browser of the files you open so they play instantly. If you choose to keep files only in this browser (Settings → Data), they stay on your device.</td><td>To play clips and compare your recordings. We don’t keep copies on our server.</td></tr>
        <tr><td>AI provider key (optional)</td><td>Our database, encrypted</td><td>To request AI feedback from the provider you chose, when you ask for it</td></tr>
        <tr><td>Discord webhook and user id (optional)</td><td>Our database</td><td>To send the practice reminders you set up</td></tr>
        <tr><td>English pronunciation results (optional)</td><td>Our database, with your practice data</td><td>To show the sounds that differed from the speaker, follow them across sessions and, if you ask, include them in AI feedback. They are short text, such as a sound pair and an example word, never audio.</td></tr>
        <tr><td>Contact form messages</td><td>Our database</td><td>To answer you</td></tr>
        <tr><td>A sign-in cookie</td><td>Your browser</td><td>To keep you signed in. It’s the only cookie we set, and it is strictly necessary.</td></tr>
      </tbody>
    </table>
    <p>Our hosting provider, Cloudflare, processes technical request data such as IP addresses to deliver and protect the site.</p>

    <h2>Google data</h2>
    <p>When you sign in with Google we receive your email address, name and account id, and nothing else. When you connect Google Drive, we ask for permission to access only the files Euno Shadowing creates in your Drive (the <code>drive.file</code> permission). We can’t see any of your other files.</p>
    <p>Euno Shadowing’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements. We don’t use Google data for advertising, don’t sell it, and don’t let people read it except where you ask us to (for example in a support request), for security, or where the law requires it.</p>

    <h2>Analysis on your device</h2>
    <p>These optional features are off until you turn them on in Settings.</p>
    <ul>
      <li><strong>Word labels for the Pronunciation tab (beta, optional).</strong> A second, separate switch in Settings → Analysis downloads a speech model (Whisper) of about 80 MB, once, from Hugging Face, with the same privacy terms as above. It runs in your browser to put words above the sounds, because clips have no transcripts. Your audio is not uploaded for it.</li>
      <li><strong>English pronunciation check (beta).</strong> It compares your recording with the speaker’s audio inside your browser. Turning it on downloads a speech model of about 71 MB, once, from Hugging Face, a third-party host. Hugging Face receives the request for that file, as any website does (for example your IP address), but not your recordings or your practice data. Your audio is not uploaded for the check. Its written results (the sounds that differed, example words and counts over time) are saved with your practice data on our server, and AI apps you connect through Euno’s MCP link can read them.</li>
      <li><strong>Speech-recognition check (Chrome only).</strong> It uses your browser’s built-in speech recognition. In Chrome, that sends your voice to Google while the check runs, under Google’s own privacy policy.</li>
    </ul>

    <h2>AI feedback</h2>
    <p>AI feedback is optional. If you add a key, your key is encrypted on our server, is never sent back to your browser, and is used only when you ask for feedback. The text of your note (the sentence, what sounded off and your recurring issues) and short text lines describing what was measured on your recording (such as a sound or timing difference) are then sent to the provider you chose: Anthropic, OpenAI or OpenRouter. Their own privacy policies apply to that request. Audio is not sent.</p>

    <h2>What we don’t do</h2>
    <ul>
      <li>No advertising, no analytics trackers, no selling or renting data.</li>
      <li>We don’t listen to your recordings; they aren’t on our server.</li>
      <li>The administrator can see account details (email, join date, last visit, whether Google Drive is connected and an AI key is set) to run the service, but not your practice content.</li>
    </ul>

    <h2>How long we keep data</h2>
    <p>We keep your account and practice data until you delete your account. Contact messages are kept until they are dealt with, and no longer than a year.</p>

    <h2>Your rights and choices</h2>
    <ul>
      <li><strong>Export:</strong> download a full backup of your practice data from the app’s settings.</li>
      <li><strong>Delete:</strong> delete your account from the app’s settings, or ask us through the contact form. This removes your account, practice data, AI key and reminder settings from our database. Files in your Google Drive stay yours, and copies in your browser stay until you clear them.</li>
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
      <li>Files in your Google Drive or on your device are your responsibility to back up.</li>
    </ul>

    <h2>AI providers</h2>
    <p>If you add your own AI key, requests made with it are between you and that provider. Their terms and prices apply, and you are responsible for that usage. AI feedback can be wrong; use your own judgement.</p>

    <h2>Acceptable use</h2>
    <p>Don’t misuse the service: no attempts to access other people’s data, disrupt or overload the service, get around limits, or use it for anything unlawful.</p>

    <h2>No warranty</h2>
    <p>Euno Shadowing is provided “as is”, without warranties of any kind. We don’t promise it will be uninterrupted or error-free, or that it will change your accent. Pronunciation feedback, including the sounds the app says differ from the speaker, is an automatic estimate and can be wrong. To the extent the law allows, we aren’t liable for indirect or consequential losses, or for loss of data. Nothing in these terms limits rights you have under consumer law that can’t be limited.</p>

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
