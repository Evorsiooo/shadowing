/* ---------- learner profile and per-language content ---------- */
/* The profile (name, native languages, target language and accent, optional notes) lives in
   meta/settings as `profile`. It drives the AI prompts, the listener-pack labels and the
   check-in content. Content is keyed by target language so others can be added later:
   add an entry to LANGUAGES with its accents and check-in material. */

const LANGUAGES = {
  en: {
    name: 'English',
    accents: [
      { id: 'us', name: 'General American English', short: 'American', spelling: 'American', hint: 'The accent of most US film, TV and news.' },
      { id: 'gb', name: 'Southern British English', short: 'British', spelling: 'British', hint: 'Often called RP or “BBC English”.' },
      { id: 'au', name: 'General Australian English', short: 'Australian', spelling: 'Australian', hint: 'The everyday accent of most Australians.' },
    ],
    // read-aloud sets: a programme keeps the set its baseline was recorded with
    readSets: {
      'en-1': [
        'I usually walk to work, but on rainy days I take the bus instead.',
        'We should probably have a look at the numbers before we decide anything.',
        'Honestly, it was a really tough week, and everyone did a fantastic job.',
        'Could you bring the bags in from the car while I put the kettle on?',
        'My neighbour bought a new bike, and now she rides to the beach every Saturday.',
        'It’s not a bad start to the year, but there’s definitely a lot more to come.',
      ],
      // the first set, kept so programmes started with it still compare like for like
      'en-0': [
        'I reckon we got the most out of the car today, so I’m pretty happy with that.',
        'The tyres went off a bit towards the end, but we managed them well enough.',
        'Honestly, it was a really tough race, and the team did a fantastic job.',
        'We’ll go back, have a look at the data, and hopefully come back stronger next weekend.',
        'My mate from Melbourne bought a new car, and now he drives to the beach every Saturday.',
        'It’s not a bad start to the year, but there’s definitely a lot more to come.',
      ],
    },
    readSet: 'en-1',
    questions: [
      'What’s a skill you wish you’d learnt earlier, and why?', 'Describe the best meal you’ve had in the last year.', 'If you could live in any city for a year, where would it be?',
      'What’s something most people get wrong about where you grew up?', 'Talk about a time a plan went completely wrong.', 'What would your perfect Saturday look like?',
      'Which sport would you play professionally if you could pick any?', 'What’s a film or show you could watch again and again? Why?', 'Describe a teacher or coach who changed how you think.',
      'What’s the most useful thing you own?', 'If you ran a café, what would make it different?', 'Talk about a trip that didn’t go as expected.',
      'What’s a habit you’re trying to build, and how’s it going?', 'Explain how to cook something you know well.', 'What job would you be terrible at, and why?',
      'Describe your ideal car and where you’d drive it.', 'What’s a rule you think should change?', 'Talk about a time you had to learn something quickly.',
      'What’s the best piece of advice you’ve been given?', 'If you had a free week with no phone, what would you do?', 'Describe the place you feel most relaxed.',
      'What’s something you changed your mind about recently?', 'Talk about a game or match you remember well.', 'What makes a good friend, in your view?',
      'If you could ask one famous person a question, who and what?', 'Describe a normal day for you from start to finish.', 'What would you do with an extra hour every day?',
      'What’s a small thing that always puts you in a good mood?', 'Talk about something you built, fixed or made.', 'Where do you see yourself in five years?',
    ],
    retellHelp: 'Retell something you watched recently (a video, an episode, a match) for about 60 seconds.',
  },
};
const NATIVE_LANGUAGE_HINTS = ['English', 'French', 'Spanish', 'Portuguese', 'German', 'Italian', 'Dutch', 'Polish', 'Russian', 'Ukrainian', 'Turkish', 'Arabic', 'Hindi', 'Bengali', 'Urdu', 'Mandarin Chinese', 'Cantonese', 'Japanese', 'Korean', 'Vietnamese', 'Thai', 'Indonesian', 'Tagalog'];

const PROFILE_DEFAULTS = { name: '', nativeLanguages: '', targetLanguage: 'en', accent: '', accentOther: '', notes: '', onboarded: null };
function profile() { return { ...PROFILE_DEFAULTS, ...(settings().profile || {}) }; }
function saveProfile(fields) { saveSettings({ profile: { ...profile(), ...fields } }); }
/* native languages are kept as one comma-separated string (what the AI prompt reads); the picker edits a list */
function splitLanguages(s) { return [...new Set(String(s || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean))]; }
function joinLanguages(list) { return list.join(', ').slice(0, 120); }

function langContent(p = profile()) { return LANGUAGES[p.targetLanguage] || LANGUAGES.en; }
/* the target accent: { name, short, spelling }; "Other" uses the learner's own words */
function targetAccent(p = profile()) {
  const lang = langContent(p);
  const known = lang.accents.find((a) => a.id === p.accent);
  if (known) return known;
  const other = String(p.accentOther || '').trim().slice(0, 80);
  if (other) return { name: other, short: other, spelling: null };
  return { name: `a native ${lang.name} accent`, short: 'native', spelling: null };
}

/* the read-aloud set for a programme: whatever its baseline used, else the language's current set */
function readSentences(c) {
  const lang = langContent();
  const base = Store.all('checkins').find((x) => x.week === 0);
  const id = (c && c.readSet) || (base && (base.readSet || 'en-0')) || lang.readSet;
  return { id, sentences: lang.readSets[id] || LANGUAGES.en.readSets[id] || lang.readSets[lang.readSet] };
}

/* what the AI needs to know about the learner; shared by the in-app prompt and the server */
function profileForAI(p = profile()) {
  const a = targetAccent(p);
  return {
    nativeLanguages: String(p.nativeLanguages || '').slice(0, 120),
    targetLanguage: langContent(p).name,
    accent: a.name,
    spelling: a.spelling,
    notes: String(p.notes || '').slice(0, 500),
  };
}
