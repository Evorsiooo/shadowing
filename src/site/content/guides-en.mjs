// English words of the guides (the reference version). The list, order and links are in ../pages.mjs (GUIDES).
// Keep the same keys in guides-fr.mjs and guides-es.mjs. Accent descriptions are general tendencies, not rules.
const make = ({ L }) => ({
  page: {
    title: 'Shadowing guides: technique, routines and accents | Euno Shadowing',
    description: 'Free guides to shadowing for pronunciation: how it works, how long it takes, choosing clips, and routines and accent guides for English, French and Spanish.',
    crumb: 'Guides',
    h1: 'Shadowing guides',
    lede: 'Everything you need to practise shadowing on your own: how the technique works, how to pick what to shadow, and what to listen for in English, French and Spanish.',
    groups: { start: 'Start here', english: 'English', french: 'French', spanish: 'Spanish' },
    homeH2: 'Learn the technique',
    homeIntro: 'Short, practical guides to shadowing, whichever app you use.',
    all: 'All guides, including English, French and Spanish accents →',
  },

  'what-is-euno-shadowing': {
    title: 'What is Euno Shadowing? What it does and does not do | Euno Shadowing',
    h1: 'What is Euno Shadowing? What it is, and what it is not',
    crumb: 'What is Euno Shadowing?',
    description: 'Euno Shadowing is a free web app for practising accent by shadowing your own videos. What it does, what it does not do (no lessons, subtitles or transcripts), and how it differs from similarly named things.',
    lede: 'Euno Shadowing is a free web app that runs a daily shadowing routine on short clips of videos you bring, records you, and shows how your timing and melody compare with the speaker’s.',
    body: `
    <h2>In one paragraph</h2>
    <p>You add a video or audio file of a speaker whose accent you want, cut a clip of one or two sentences, and Euno guides you through a 15-minute session: listen, shadow, record, compare, shadow again. After a recorded pass it shows your pitch line next to the speaker’s, your lag, and a few measured differences. For English clips it can also show where the sounds you made differ from the speaker’s. It works in English, French and Spanish, in your browser, and is free.</p>

    <h2>What it does</h2>
    <ul>
      <li><strong>Clips from your own videos.</strong> Upload a file or paste a link to an .mp4, then drag on the timeline to cut a clip. A zoomed waveform helps you trim at the pauses.</li>
      <li><strong>A guided session.</strong> A four-step routine with a timer, a pass counter and automatic looping. A five-minute bad-day version is built in, and every duration is a setting.</li>
      <li><strong>Playback controls.</strong> Loop the current clip, play at 0.5x, 0.75x or 1x with the pitch kept natural, and use keyboard shortcuts.</li>
      <li><strong>Recording and comparison.</strong> Play the original, yourself, one after the other, or both together. Your step 3 and final recordings are kept for each clip.</li>
      <li><strong>Pitch and lag.</strong> Euno draws the speaker’s melody and yours, each relative to its own voice, and measures how far behind or ahead of the speaker you were.</li>
      <li><strong>Differences from the speaker.</strong> After a pass it can point out stretches where you went faster or slower, where the pitch went the other way, or where the stress differed. These come from measuring the two recordings, not from a language model listening to your voice. If you switch it on in Settings (off by default, Chrome only, your voice goes to Google while it runs), it can also mark clip words the browser’s speech recognition did not hear, which may have been unclear. It can miss clear words too, so treat it as a hint.</li>
      <li><strong>Pronunciation differences (English only, for now).</strong> After a recorded pass, the Pronunciation tab lines up the sounds you made against the sounds in the speaker’s audio and marks up to three places where they differ. It compares you with the speaker you chose, not with a transcript, a dictionary or a standard accent, and it gives no score and calls nothing a mistake. It runs in your browser: the speech model downloads the first time you use it, and your recording is not uploaded for the analysis. It can misread a sound, so treat each item as a place to listen, and dismiss it with “Sounds the same to me” if it sounds the same to you. French and Spanish clips do not have this yet.</li>
      <li><strong>Notes and issues.</strong> Write down what sounded off; recurring problems collect into an issues list.</li>
      <li><strong>12-week check-ins.</strong> A baseline, then the same tasks at weeks 4, 8 and 12.</li>
      <li><strong>Reminders.</strong> Optional Discord and browser push reminders.</li>
    </ul>

    <h2>What it does not do</h2>
    <ul>
      <li><strong>It has no lessons or content library.</strong> You bring the videos. There are no built-in lessons, courses or ready-made clips.</li>
      <li><strong>It has no subtitles or transcripts.</strong> It does not transcribe the video, show synchronised subtitles or break it into sentences for you. You choose where each clip starts and ends.</li>
      <li><strong>It does not take content from YouTube or other sites.</strong> You use files you have the right to use for private practice.</li>
      <li><strong>It does not grade your pronunciation.</strong> There is no score and no verdict on right or wrong. For English, the Pronunciation tab shows sounds that differ from the speaker, and it can be mistaken; for French and Spanish there is no sound-level comparison yet. Pitch and timing are not the same as good pronunciation either.</li>
      <li><strong>It is not a coach, a course or a guarantee.</strong> It is a practice tool.</li>
    </ul>

    <h2>What feedback you get</h2>
    <p>Three kinds, and you can use any of them without the others:</p>
    <ol>
      <li><strong>Measured feedback:</strong> pitch lines, lag, the differences from the speaker described above and, for English, the Pronunciation tab (which downloads its speech model the first time you use it).</li>
      <li><strong>Your own listening:</strong> side-by-side playback and your notes about what sounded off.</li>
      <li><strong>Optional AI feedback:</strong> if you add your own API key from Anthropic, OpenAI or OpenRouter, you can ask for feedback on your notes. Only text is sent, never audio: your note, plus short lines describing what was measured on the recording (such as a stretch where you went faster than the speaker), which the AI is told not to go beyond. You pay the provider directly. Without a key, Euno writes the prompt for you to paste into any chatbot.</li>
    </ol>

    <h2>Cost and privacy</h2>
    <p>Euno Shadowing is free. Your videos and recordings are kept in a “Euno Shadowing” folder in your own Google Drive, not on our server. Our server keeps your practice notes, settings and progress. The English pronunciation analysis runs on your device, so your audio is not sent anywhere for it. Details are in the <a href="${L('/privacy/')}">privacy policy</a>.</p>

    <h2>Not to be confused with</h2>
    <p>The name is shared with unrelated things, and none of these is Euno Shadowing:</p>
    <ul>
      <li><strong>Job shadowing programmes</strong>, such as Erasmus+ job-shadowing visits for teachers, where you follow a professional at work.</li>
      <li><strong>Pre-med and clinical shadowing</strong>, where students observe doctors.</li>
      <li><strong>Euno, the enterprise AI platform</strong>, and its “shadow” deployments of AI agents.</li>
      <li><strong>Other apps called Euno</strong>, such as journaling apps.</li>
    </ul>
    <p>Euno Shadowing is only the language practice app at shadowing.euno.cc. It is not affiliated with any of the above.</p>

    <h2>Who it suits</h2>
    <p>People who understand a language reasonably well and want to sound more natural: the rhythm, melody and timing of a speaker they admire. If you want a structured course, a lesson library, subtitles or a scored course, see the <a href="${L('/euno-vs-elsa-and-language-reactor/')}">comparison with ELSA Speak and Language Reactor</a>. New to the technique? Read <a href="${L('/what-is-shadowing/')}">what shadowing is</a>.</p>`,
  },

  'how-long-shadowing-takes': {
    title: 'How long does shadowing take to improve your accent? | Euno Shadowing',
    h1: 'How long does shadowing take to work?',
    crumb: 'How long it takes',
    description: 'What to expect from daily shadowing practice: what changes first, what takes longer, and how to tell whether your accent is really moving.',
    lede: 'There is no fixed number of days. What you can count on is the order things change in: the clips you practise first, then reading aloud, and spontaneous speech last.',
    body: `
    <h2>The short answer</h2>
    <p>Most people hear a difference in the clips they practise within the first session or two, because repetition makes those few sentences smoother almost immediately. A change in how you sound when you speak freely is slower, and is best judged over weeks and months, not days. How fast it comes depends on how often you practise, how different your target accent is from the way you speak now, and how closely you listen when you compare recordings.</p>

    <h2>What changes first</h2>
    <ol>
      <li><strong>The practised clip.</strong> After 15 or 20 passes, your timing and melody on that clip get much closer to the speaker’s. This is real, but it is mostly memory of that one clip.</li>
      <li><strong>Rhythm and intonation in general.</strong> After a few weeks of daily clips, the stress patterns and melody start to carry over into other sentences, especially when you read aloud.</li>
      <li><strong>Individual sounds.</strong> Vowels and consonants that don’t exist in your first language often take longer, because you first have to hear the difference reliably.</li>
      <li><strong>Spontaneous speech.</strong> When you’re thinking about what to say, old habits come back. This is the last thing to change, and the most important test.</li>
    </ol>

    <h2>Why daily beats long sessions</h2>
    <p>Accent is a motor habit, like a tennis stroke. Short, frequent practice gives your memory more chances to consolidate than one long session a week. Fifteen minutes a day is a good default; on busy days, five minutes keeps the habit alive.</p>

    <h2>How to tell whether it’s working</h2>
    <p>Day-to-day comparisons are misleading: you have good and bad days, and you get used to your own voice. Instead:</p>
    <ul>
      <li><strong>Record a baseline</strong> before you start: a few sentences read aloud, a minute retelling something you watched, and a minute answering a question you haven’t prepared.</li>
      <li><strong>Repeat the same tasks</strong> every four weeks or so, and listen to the baseline and the new recording back to back.</li>
      <li><strong>Ask other listeners</strong> to say which recording sounds closer to the target accent, without telling them which one is newer.</li>
    </ul>
    <p>Euno Shadowing builds this in: a baseline, then check-ins at weeks 4, 8 and 12 with the same tasks. Twelve weeks is a checkpoint for comparing, not a promise that you’ll be finished.</p>

    <h2>Why progress stalls, and what to do</h2>
    <ul>
      <li><strong>Clips that are too long or too fast.</strong> If you can’t keep up after five passes, cut a shorter clip.</li>
      <li><strong>Copying words, not melody.</strong> Exaggerate the rises, falls and long syllables until it feels slightly theatrical.</li>
      <li><strong>Never comparing.</strong> Record a pass and look at it next to the original. Pitch lines and lag show what your ears miss.</li>
      <li><strong>Changing speakers too often.</strong> Stay with one voice for a few weeks so the patterns can settle.</li>
      <li><strong>Only shadowing.</strong> Use the accent in your own sentences too: retell what you shadowed in your own words.</li>
    </ul>`,
  },

  'choosing-clips': {
    title: 'How to choose speakers and clips for shadowing | Euno Shadowing',
    h1: 'How to choose speakers and clips for shadowing',
    crumb: 'Choosing clips',
    description: 'What makes a good shadowing clip: the right speaker, natural speech, clear audio, the right length and where to cut. With a checklist.',
    lede: 'The clip you shadow decides what you learn. A good one is short, natural, clear and spoken by someone whose accent you actually want.',
    body: `
    <h2>Choose the speaker first</h2>
    <p>Pick one person whose accent is the one you want, and who speaks in a way you would like to sound: similar age, a similar register, ideally a similar voice range. Copying one consistent model is easier than averaging many, so stay with that speaker for a few weeks before adding others.</p>
    <p>If you’re not sure which accent to aim for, read the accent guides for <a href="${L('/english-accents/')}">English</a>, <a href="${L('/french-accents/')}">French</a> or <a href="${L('/spanish-accents/')}">Spanish</a>.</p>

    <h2>Prefer natural speech</h2>
    <ul>
      <li><strong>Good:</strong> interviews, podcasts, talks, people speaking to camera, conversation.</li>
      <li><strong>Less good:</strong> audiobooks, news reading and scripted ads. Reading aloud has a different rhythm from talking.</li>
      <li><strong>Avoid:</strong> music under the voice, several people talking at once, heavy editing with cuts mid-sentence, and very fast or mumbled speech.</li>
    </ul>

    <h2>Get the length right</h2>
    <p>One or two sentences, usually 10 to 20 seconds. Shorter is better at first. If you can’t keep up with the speaker after five or six passes, the clip is too long or too fast; cut it in half.</p>

    <h2>Cut at the pauses</h2>
    <p>Start and end the clip in a silence between phrases, not in the middle of a word. A waveform makes this easy: the pauses are the flat parts. A clean start lets you breathe and come in with the speaker.</p>

    <h2>Pick sentences you would say</h2>
    <p>Everyday phrases, opinions and stories carry over into your own speech sooner than technical vocabulary. A clip with a clear melody, such as a question, a contrast (“not this, but that”) or a list, gives you more to copy than a flat statement.</p>

    <h2>Use files you’re allowed to use</h2>
    <p>Use recordings you have the right to use for your own private practice, and don’t redistribute them. In Euno Shadowing, you upload a video or audio file from your device or paste a direct link to an .mp4 file, then cut clips on the timeline.</p>

    <h2>Checklist</h2>
    <ul>
      <li>One speaker, with the accent you want.</li>
      <li>Natural, unscripted speech.</li>
      <li>Clear audio, no music, no overlapping voices.</li>
      <li>One or two sentences, 10 to 20 seconds.</li>
      <li>Starts and ends in a pause.</li>
      <li>Words you would actually use.</li>
    </ul>`,
  },

  'shadowing-vs-other-methods': {
    title: 'Shadowing vs listen and repeat, minimal pairs and reading aloud | Euno Shadowing',
    h1: 'Shadowing vs other pronunciation methods',
    crumb: 'Shadowing vs other methods',
    description: 'How shadowing compares with listen-and-repeat, minimal pairs, reading aloud and learning phonetics, what each is good for, and how to combine them.',
    lede: 'Shadowing is strongest for rhythm and melody. Other methods are better for single sounds or for understanding what you hear. Most learners do best with a mix.',
    body: `
    <h2>At a glance</h2>
    <table class="simple">
      <thead><tr><th>Method</th><th>Best for</th><th>Limits</th></tr></thead>
      <tbody>
        <tr><td>Shadowing</td><td>Rhythm, stress, intonation, connected speech, fluency</td><td>Hard to fix a single sound you can’t yet hear</td></tr>
        <tr><td>Listen and repeat</td><td>Beginners, careful work on a phrase</td><td>Leaves time to fall back on how you think it sounds</td></tr>
        <tr><td>Minimal pairs</td><td>Hearing and producing one contrast, like “ship” and “sheep”</td><td>Isolated words, little rhythm or melody</td></tr>
        <tr><td>Reading aloud</td><td>Linking sound to spelling, practising without a recording</td><td>Spelling pulls you towards your old habits; a reading rhythm</td></tr>
        <tr><td>Phonetics and IPA</td><td>Understanding what changes and why</td><td>Knowing isn’t doing; needs practice to stick</td></tr>
      </tbody>
    </table>

    <h2>Shadowing</h2>
    <p>You speak at the same time as the speaker, a fraction of a second behind. Because there’s no time to think, you copy the whole shape of the speech. It’s demanding, which is why it works well for prosody, the part of an accent that rules struggle to teach. <a href="${L('/what-is-shadowing/')}">More on how shadowing works</a>.</p>

    <h2>Listen and repeat</h2>
    <p>You hear a phrase, then say it in the pause. It’s gentler, and useful when a clip is still too fast to shadow. The downside is the delay: you repeat your memory of the sound, which is already filtered through your own accent.</p>

    <h2>Minimal pairs</h2>
    <p>You practise word pairs that differ in one sound, first by ear, then out loud. It’s the most direct fix for a specific sound that your first language doesn’t separate. Once you can hear the difference, shadowing helps you keep it at full speed.</p>

    <h2>Reading aloud</h2>
    <p>Useful for practising without audio and for connecting sounds to spelling. Its risk is that spelling triggers your old pronunciation, and read speech has a flatter rhythm than conversation.</p>

    <h2>Learning phonetics</h2>
    <p>Knowing where your tongue goes, or that a vowel is a diphthong, helps you notice differences. It doesn’t change your speech on its own; it makes your practice more precise.</p>

    <h2>How to combine them</h2>
    <ol>
      <li>Make shadowing your daily core: one clip, about 15 minutes.</li>
      <li>When you compare recordings, note what still sounds different.</li>
      <li>If the same single sound keeps coming up, spend a few minutes on minimal pairs for it.</li>
      <li>Then go back to shadowing to use that sound at full speed, in real sentences.</li>
    </ol>`,
  },

  'euno-vs-elsa-language-reactor': {
    title: 'Euno Shadowing vs ELSA Speak and Language Reactor | Euno Shadowing',
    h1: 'Euno Shadowing vs ELSA Speak and Language Reactor',
    crumb: 'Euno vs ELSA and Language Reactor',
    description: 'An honest comparison of Euno Shadowing, ELSA Speak and Language Reactor: what each tool is for, what it does not do, and how to choose or combine them.',
    lede: 'These three tools are often mentioned together, but they do different jobs. ELSA teaches you with lessons and scores your sounds, Language Reactor helps you understand what you watch, and Euno helps you shadow clips you choose and compare your voice with the speaker’s.',
    body: `
    <p><em>We make Euno Shadowing, so read this with that in mind. We describe the other two from their public descriptions as we understand them in October 2026; features and prices change, so check their own sites before you decide.</em></p>

    <h2>At a glance</h2>
    <table class="simple">
      <thead><tr><th></th><th>Euno Shadowing</th><th>ELSA Speak</th><th>Language Reactor</th></tr></thead>
      <tbody>
        <tr><td>What it is</td><td>A practice app for shadowing your own clips</td><td>A pronunciation course app with lessons and scoring</td><td>A browser extension for learning from Netflix and YouTube</td></tr>
        <tr><td>Content</td><td>Your own videos and audio: you upload a file or paste a link and cut clips</td><td>Lessons made by the company</td><td>The videos you already watch on streaming sites</td></tr>
        <tr><td>Main idea</td><td>Copy a real speaker, then compare your pitch and timing with theirs</td><td>Speak a prompt, get feedback on your sounds</td><td>Dual subtitles and a pop-up dictionary to understand what you hear</td></tr>
        <tr><td>Languages</td><td>English, French and Spanish accents</td><td>English</td><td>Many languages</td></tr>
        <tr><td>Feedback</td><td>Your pitch line and lag next to the speaker’s; for English, the sounds that differ from the speaker’s; optional AI feedback with your own API key</td><td>Automated scoring of your pronunciation</td><td>Not a pronunciation tool</td></tr>
        <tr><td>Cost</td><td>Free; AI usage, if you choose it, is billed by your AI provider</td><td>Free tier and paid plans</td><td>Free tier and paid plans</td></tr>
      </tbody>
    </table>

    <h2>Euno Shadowing</h2>
    <p>Euno runs the shadowing routine for you. You bring a video of a speaker whose accent you want, cut a clip of one or two sentences, and Euno loops it, counts your passes, records you and draws your melody and lag next to the speaker’s. It is built around the real speaker, not a model accent, so it works for any voice you can find.</p>
    <p><strong>What it doesn’t do:</strong> it has no lessons or library of its own, no subtitles or transcripts, no streaming-site integration, and no score or grade. It shows differences from the speaker’s melody and timing and, for English, the sounds that differ from the speaker’s; it doesn’t say you are right or wrong, and it can misread a sound. AI feedback is optional and runs on a key you provide.</p>

    <h2>ELSA Speak</h2>
    <p>ELSA is an English pronunciation app. You work through its lessons and exercises, speak, and the app scores your pronunciation and points out sounds to improve. That makes it a good fit if you want a structured course and quick feedback on individual sounds against a standard accent.</p>
    <p><strong>How it differs:</strong> the content is the company’s, you can’t practise with your own favourite speaker, and its feedback judges you against a target rather than against the person you’re imitating. It is English-focused. Euno’s English Pronunciation tab works the other way round: it compares you with the speaker you chose and gives no score.</p>

    <h2>Language Reactor</h2>
    <p>Language Reactor is a browser extension that adds dual-language subtitles, a pop-up dictionary and playback controls to videos on sites such as Netflix and YouTube. It is designed to help you understand and pick up vocabulary from real content, and it covers many languages.</p>
    <p><strong>How it differs:</strong> it is about comprehension, not about measuring how you sound. You can use any video with it, but it doesn’t record you or compare your voice with the speaker’s.</p>

    <h2>How to choose</h2>
    <ul>
      <li><strong>You want to sound like one particular speaker</strong>, with rhythm and melody as close as you can get: Euno.</li>
      <li><strong>You want a guided course</strong> and feedback on individual English sounds: ELSA.</li>
      <li><strong>You want to understand and learn words</strong> from the shows and videos you watch: Language Reactor.</li>
    </ul>

    <h2>Using them together</h2>
    <p>They don’t compete as much as they seem to. A reasonable combination: find a clip you like and learn its words with Language Reactor, then cut it and shadow it in Euno. If a single sound keeps coming up when you compare recordings, use a course such as ELSA, or <a href="${L('/shadowing-vs-other-methods/')}">minimal pairs</a>, to work on that sound, and go back to shadowing to use it at full speed.</p>
    <p>New to the technique? Start with <a href="${L('/what-is-shadowing/')}">what shadowing is</a> and <a href="${L('/choosing-shadowing-clips/')}">how to choose clips</a>.</p>`,
  },

  'english-accents': {
    title: 'Which English accent to shadow: American, British or Australian? | Euno Shadowing',
    h1: 'Which English accent should you shadow?',
    crumb: 'English accents',
    description: 'General American, Southern British and General Australian compared for shadowing: the features to listen for, and how to choose one to practise.',
    lede: 'Pick the accent you hear most, or the one you’ll use most, and stick with it. Here’s what sets the three most common models apart, so you know what to listen for.',
    body: `
    <h2>How to choose</h2>
    <ul>
      <li><strong>Where you live or will live,</strong> and who you talk to most.</li>
      <li><strong>What you listen to.</strong> Hours of input in one accent make shadowing it much easier.</li>
      <li><strong>What you like.</strong> You’ll practise more with a voice you enjoy.</li>
    </ul>
    <p>None is more “correct” than the others. What matters is choosing one model, so that your practice adds up instead of mixing features from several accents.</p>

    <h2>General American</h2>
    <p>The accent of most US film, TV and news.</p>
    <ul>
      <li><strong>The “r” is pronounced</strong> after vowels: “car”, “hard”, “water”.</li>
      <li><strong>A flapped “t”</strong> between vowels sounds close to a quick “d”: “water”, “better”, “a lot of”.</li>
      <li><strong>“Bath”, “dance” and “can’t”</strong> have the same vowel as “cat”.</li>
      <li><strong>“Lot” and “hot”</strong> have an open, unrounded vowel, close to the one in “father”.</li>
    </ul>

    <h2>Southern British</h2>
    <p>The modern standard accent of England, often called RP or “BBC English”.</p>
    <ul>
      <li><strong>No “r” after vowels</strong> unless a vowel follows: “car” and “hard” end without it, but “car alarm” links with one.</li>
      <li><strong>“Bath”, “dance” and “can’t”</strong> use the long vowel of “father”.</li>
      <li><strong>“Lot” and “hot”</strong> have a short, rounded vowel.</li>
      <li><strong>“Go” and “no”</strong> start from a central vowel, roughly “uh-oo”.</li>
      <li><strong>The “t”</strong> is often clearly released, though a glottal stop is common in everyday speech, as in “football”.</li>
    </ul>

    <h2>General Australian</h2>
    <p>The everyday accent of most Australians.</p>
    <ul>
      <li><strong>No “r” after vowels,</strong> as in Southern British.</li>
      <li><strong>Wider diphthongs:</strong> the vowels in “day”, “my” and “no” start further from where they end than in the other two accents.</li>
      <li><strong>A flapped “t”</strong> between vowels is common, as in American: “water”, “better”.</li>
      <li><strong>“Bath” and “can’t”</strong> usually have the long vowel, but “dance” and “plant” often have the vowel of “cat”.</li>
      <li><strong>Rising intonation</strong> at the end of some statements is common in casual speech.</li>
    </ul>

    <h2>What to listen for when you shadow</h2>
    <p>Whichever accent you choose, the biggest differences from your current speech are usually rhythm and melody, not single sounds. English is stress-timed: stressed syllables are long and clear, and the ones between them are short and reduced, often to a quick “uh”. Copy that contrast first. Then work on the features above that your recordings show you’re missing.</p>
    <p>Ready to start? Follow <a href="${L('/accent-shadowing/')}">the daily English shadowing routine</a>.</p>`,
  },

  'french-accent-shadowing': {
    title: 'How to improve your French accent with shadowing: a daily routine | Euno Shadowing',
    h1: 'How to improve your French accent with shadowing',
    crumb: 'French accent routine',
    description: 'A 15-minute daily shadowing routine for your French accent: French rhythm, liaison and linking, vowels, nasal vowels and the French “r”, and how to track progress.',
    lede: 'French rhythm works differently from English or Spanish, which is exactly why shadowing helps: you copy the flow of whole phrases instead of word by word.',
    body: `
    <h2>What makes a French accent sound French</h2>
    <ul>
      <li><strong>Even syllables.</strong> French is syllable-timed: each syllable takes roughly the same time, and vowels aren’t reduced the way they are in English.</li>
      <li><strong>Stress at the end of the phrase.</strong> The last syllable of each group of words is a little longer, often with a rise in the middle of a sentence and a fall at the end. Individual words don’t carry their own stress.</li>
      <li><strong>Linking.</strong> Words run together: a final consonant joins the next vowel (<em>enchaînement</em>, as in “elle a”), and some silent final consonants are pronounced before a vowel (<em>liaison</em>, as in “les amis”).</li>
      <li><strong>Pure vowels.</strong> Vowels stay steady, without the glide of English “day” or “go”. Contrasts like “u” and “ou” (“rue” and “roue”) matter.</li>
      <li><strong>Nasal vowels</strong> in “vent”, “vin” and “bon”, and the uvular “r”, made at the back of the mouth.</li>
    </ul>

    <h2>Choose your model</h2>
    <p>Decide between Metropolitan (Parisian) French and Québécois French, then find one speaker. See <a href="${L('/french-accents/')}">French accents compared</a>. Interviews, podcasts and people speaking to camera work best; read news is more formal than everyday French.</p>

    <h2>The 15-minute session</h2>
    <table class="simple">
      <thead><tr><th>Step</th><th>Time</th><th>What you do</th></tr></thead>
      <tbody>
        <tr><td>Listen</td><td>2 min</td><td>Play the clip three times without speaking. Notice where each phrase ends and the voice rises or falls.</td></tr>
        <tr><td>Shadow</td><td>7 min</td><td>About 15 passes along with the speaker, no transcript.</td></tr>
        <tr><td>Record and compare</td><td>2 min</td><td>Record one pass and compare it with the original.</td></tr>
        <tr><td>Shadow again</td><td>4 min</td><td>About 8 more passes, then a final recording.</td></tr>
      </tbody>
    </table>

    <h2>What to focus on in French</h2>
    <ul>
      <li><strong>Don’t stress words.</strong> If your first language stresses words, French will sound bumpy until you flatten them and lengthen only the end of each phrase.</li>
      <li><strong>Keep syllables even.</strong> Give unstressed vowels their full quality instead of reducing them.</li>
      <li><strong>Link everything.</strong> Shadow at full speed so the words blend; if a link feels odd, it’s usually right.</li>
      <li><strong>Watch for dropped “e”.</strong> In everyday French many silent “e” disappear (“je suis” can sound like “j’suis”). Copy what the speaker does, not the spelling.</li>
      <li><strong>Check the melody.</strong> A pitch line shows whether your voice rises at the end of each phrase within a sentence and falls at the end.</li>
    </ul>

    <h2>Track progress</h2>
    <p>Record a baseline before you start, then repeat the same tasks every four weeks: a few sentences read aloud, a minute retelling something in French and a minute answering an unseen question. Euno Shadowing does this with check-ins at weeks 4, 8 and 12. See <a href="${L('/how-long-does-shadowing-take/')}">how long shadowing takes</a>.</p>`,
  },

  'french-accents': {
    title: 'Parisian or Québécois French: which accent to shadow? | Euno Shadowing',
    h1: 'Parisian or Québécois: which French accent should you shadow?',
    crumb: 'French accents',
    description: 'Metropolitan (Parisian) and Québécois French compared for shadowing: the main differences in vowels, consonants and melody, and how to choose.',
    lede: 'Both are full, standard varieties of French with millions of speakers. Choose the one you’ll hear and use most, and listen for the features below.',
    body: `
    <h2>How to choose</h2>
    <ul>
      <li><strong>Where you’ll use French:</strong> France, Belgium, Switzerland and most of the French-speaking world are closer to the Metropolitan model; Quebec and much of French-speaking Canada use Québécois.</li>
      <li><strong>What you watch and listen to.</strong> Lots of input in one variety makes shadowing it easier.</li>
      <li><strong>Pick one and stay with it,</strong> so your practice adds up.</li>
    </ul>

    <h2>Metropolitan (Parisian) French</h2>
    <p>The standard accent of France, heard on national TV and radio.</p>
    <ul>
      <li><strong>Vowels stay pure,</strong> even long ones.</li>
      <li><strong>Several old contrasts have merged</strong> for many speakers: “brin” and “brun” sound the same, as often do “patte” and “pâte”.</li>
      <li><strong>Many silent “e” drop</strong> in everyday speech: “petit” can sound like “p’tit”.</li>
      <li><strong>The “r”</strong> is uvular, made at the back of the mouth, and often soft.</li>
    </ul>

    <h2>Québécois French</h2>
    <p>The everyday French of Quebec, Canada.</p>
    <ul>
      <li><strong>“t” and “d” before “i” and “u”</strong> become “ts” and “dz”: “tu” sounds like “tsu”, “dire” like “dzire”.</li>
      <li><strong>Short “i”, “u” and “ou”</strong> in a syllable ending in a consonant are more relaxed: “petite” has a vowel closer to English “it”.</li>
      <li><strong>Long vowels can become diphthongs,</strong> especially before “r”: “père” and “fête” can glide.</li>
      <li><strong>Contrasts kept</strong> that many Parisians have lost: “patte” and “pâte”, and often “brin” and “brun”.</li>
    </ul>

    <h2>What they share</h2>
    <p>Rhythm and phrase-final stress, linking between words, nasal vowels and pure vowels are French features in both. Work on those first; they matter more for sounding French than the differences above.</p>
    <p>Next: follow <a href="${L('/french-accent-shadowing/')}">the daily French shadowing routine</a>.</p>`,
  },

  'spanish-accent-shadowing': {
    title: 'How to improve your Spanish accent with shadowing: a daily routine | Euno Shadowing',
    h1: 'How to improve your Spanish accent with shadowing',
    crumb: 'Spanish accent routine',
    description: 'A 15-minute daily shadowing routine for your Spanish accent: Spanish rhythm, the five vowels, “r” and “rr”, soft b, d and g, linking, and tracking progress.',
    lede: 'Spanish has a clear, even rhythm and only five vowels, which makes it a great language to shadow: once you hear the patterns, you can copy them closely.',
    body: `
    <h2>What makes a Spanish accent sound Spanish</h2>
    <ul>
      <li><strong>Even syllables.</strong> Spanish is syllable-timed: unstressed vowels keep their full quality instead of shrinking to “uh”.</li>
      <li><strong>Five pure vowels.</strong> “a, e, i, o, u” stay steady, without the glide of English “day” or “go”.</li>
      <li><strong>Stress that changes meaning.</strong> “papa” and “papá”, “hablo” and “habló” differ only in stress.</li>
      <li><strong>Two r’s.</strong> A single tap in “pero”, a trill in “perro” and at the start of words like “rosa”.</li>
      <li><strong>Soft b, d and g between vowels.</strong> In “nada”, “lobo” and “lago”, the lips or tongue barely touch.</li>
      <li><strong>Linking.</strong> Words flow together, and vowels at word edges merge: “la_amiga”, “mi_hermano”.</li>
    </ul>

    <h2>Choose your model</h2>
    <p>Pick Mexican, Peninsular (Spain) or Rioplatense Spanish, then one speaker. See <a href="${L('/spanish-accents/')}">Spanish accents compared</a>.</p>

    <h2>The 15-minute session</h2>
    <table class="simple">
      <thead><tr><th>Step</th><th>Time</th><th>What you do</th></tr></thead>
      <tbody>
        <tr><td>Listen</td><td>2 min</td><td>Play the clip three times without speaking. Notice which syllables are stressed.</td></tr>
        <tr><td>Shadow</td><td>7 min</td><td>About 15 passes along with the speaker, no transcript.</td></tr>
        <tr><td>Record and compare</td><td>2 min</td><td>Record one pass and compare it with the original.</td></tr>
        <tr><td>Shadow again</td><td>4 min</td><td>About 8 more passes, then a final recording.</td></tr>
      </tbody>
    </table>

    <h2>What to focus on in Spanish</h2>
    <ul>
      <li><strong>Keep vowels full and short.</strong> English speakers tend to reduce unstressed vowels and glide stressed ones; Spanish does neither.</li>
      <li><strong>Keep the beat.</strong> Spanish can be fast. Shorten your clip rather than slowing your syllables unevenly.</li>
      <li><strong>Soften b, d and g</strong> between vowels, and make “p”, “t” and “k” without the puff of air they have in English.</li>
      <li><strong>Place the stress</strong> where the speaker does, and check it in your recording.</li>
      <li><strong>Check the melody.</strong> Statements usually end with a fall, yes/no questions with a rise. A pitch line shows whether you follow the speaker.</li>
    </ul>

    <h2>Track progress</h2>
    <p>Record a baseline before you start, then repeat the same tasks every four weeks: sentences read aloud, a minute retelling something in Spanish and a minute answering an unseen question. Euno Shadowing does this with check-ins at weeks 4, 8 and 12. See <a href="${L('/how-long-does-shadowing-take/')}">how long shadowing takes</a>.</p>`,
  },

  'spanish-accents': {
    title: 'Mexican, Spain or Argentine Spanish: which accent to shadow? | Euno Shadowing',
    h1: 'Mexican, Spain or Rioplatense: which Spanish accent should you shadow?',
    crumb: 'Spanish accents',
    description: 'Mexican, Peninsular (Spain) and Rioplatense Spanish compared for shadowing: the sounds that set each apart, and how to choose one to practise.',
    lede: 'All three are widely understood. Choose by where you’ll use Spanish and what you listen to, then listen for the features below.',
    body: `
    <h2>How to choose</h2>
    <ul>
      <li><strong>Where you’ll use Spanish:</strong> Spain, Mexico and Central America, or Argentina and Uruguay.</li>
      <li><strong>What you watch and listen to.</strong> Lots of input in one accent makes shadowing it easier.</li>
      <li><strong>Pick one and stay with it,</strong> so your practice adds up.</li>
    </ul>

    <h2>Mexican Spanish</h2>
    <p>The most widely heard Latin American accent, common in film dubbing.</p>
    <ul>
      <li><strong>“c” and “z” sound like “s”:</strong> “cielo” and “zapato” start with an “s” sound.</li>
      <li><strong>The “s” is kept</strong> at the end of syllables: “los otros”, “mismo”.</li>
      <li><strong>“ll” and “y” sound the same,</strong> like a soft “y”: “calle”, “yo”.</li>
      <li><strong>Consonants are generally clear,</strong> and unstressed vowels can be quite short in fast speech in central Mexico.</li>
    </ul>

    <h2>Peninsular Spanish (Spain)</h2>
    <p>The accent of central and northern Spain.</p>
    <ul>
      <li><strong>“c” before “e” and “i”, and “z”,</strong> are pronounced like English “th” in “think”: “cielo”, “zapato”, “gracias”.</li>
      <li><strong>The “j”</strong> (and “g” before “e” and “i”) is a strong, raspy sound at the back of the mouth: “jamón”, “gente”.</li>
      <li><strong>The “s”</strong> is made with the tip of the tongue and can sound slightly like “sh” to other speakers.</li>
      <li><strong>A final “d”</strong> is often very soft or dropped: “Madrid”, “verdad”.</li>
    </ul>

    <h2>Rioplatense Spanish</h2>
    <p>The Spanish of Buenos Aires and Montevideo.</p>
    <ul>
      <li><strong>“ll” and “y” sound like “sh”</strong> (or “zh”): “yo” sounds like “sho”, “calle” like “cashe”.</li>
      <li><strong>The “s” at the end of a syllable</strong> often becomes a breathy “h” or disappears: “mismo” sounds like “mihmo”.</li>
      <li><strong>“c” and “z” sound like “s”,</strong> as in Mexico.</li>
      <li><strong>A distinctive melody</strong> with long, falling phrase endings, often compared to Italian.</li>
      <li><strong>“Vos”</strong> replaces “tú”, with its own verb forms (“vos tenés”). That’s grammar, not accent, but you’ll hear it in every clip.</li>
    </ul>

    <h2>What they share</h2>
    <p>The five pure vowels, even syllables, the tap and trilled “r”, and the soft b, d and g are Spanish in all three. Those make the biggest difference to how Spanish you sound, whichever accent you choose.</p>
    <p>Next: follow <a href="${L('/spanish-accent-shadowing/')}">the daily Spanish shadowing routine</a>.</p>`,
  },
});
make.code = 'en';
export default make;
