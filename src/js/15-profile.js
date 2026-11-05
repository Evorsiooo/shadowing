/* ---------- learner profile and per-language content ---------- */
/* The profile (name, native languages, target language and accent, optional notes) lives in
   meta/settings as `profile`. It drives the AI prompts, the listener-pack labels and the
   check-in content. Content is keyed by target language so others can be added later:
   add an entry to LANGUAGES with its accents and check-in material.
   `timing` decides which rough measures make sense: the stressed/unstressed length ratio only
   means something in stress-timed languages ('stress'), not syllable-timed ones ('syllable').
   `examples` are placeholder hints in the notes and profile forms, using the language's own words. */

const LANGUAGES = {
  en: {
    name: N_('English'),
    timing: 'stress',
    examples: { off: N_('e.g. the vowel in “go” sounds too pure, it doesn’t glide'), aim: N_('e.g. the vowel in “bird”'), accentOther: N_('e.g. Scottish English') },
    accents: [
      { id: 'us', name: N_('General American English'), short: N_('American'), spelling: 'American', hint: N_('The accent of most US film, TV and news.') },
      { id: 'gb', name: N_('Southern British English'), short: N_('British'), spelling: 'British', hint: N_('Often called RP or “BBC English”.') },
      { id: 'au', name: N_('General Australian English'), short: N_('Australian'), spelling: 'Australian', hint: N_('The everyday accent of most Australians.') },
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
    retellHelp: N_('Retell something you watched recently (a video, an episode, a match) for about 60 seconds.'),
  },
  fr: {
    name: N_('French'),
    timing: 'syllable',
    examples: { off: N_('e.g. my “u” in “rue” sounds like “ou”'), aim: N_('e.g. the nasal vowel in “vent”'), accentOther: N_('e.g. Belgian French') },
    accents: [
      { id: 'fr', name: N_('Metropolitan French'), short: N_('Parisian French'), spelling: null, hint: N_('The standard accent of France, heard on national TV and radio.') },
      { id: 'qc', name: N_('Québécois French'), short: N_('Québécois'), spelling: null, hint: N_('The everyday French of Quebec, Canada.') },
    ],
    readSets: {
      'fr-1': [
        'D’habitude, je vais au travail à pied, mais quand il pleut, je prends le bus.',
        'On devrait sans doute regarder les chiffres avant de décider quoi que ce soit.',
        'Franchement, la semaine a été vraiment dure, et tout le monde a fait un travail formidable.',
        'Tu peux rentrer les sacs de la voiture pendant que je fais chauffer l’eau ?',
        'Mon voisin s’est acheté un vélo neuf, et maintenant il roule jusqu’à la plage tous les samedis.',
        'Ce n’est pas un mauvais début d’année, mais il y a encore beaucoup de choses à venir.',
      ],
    },
    readSet: 'fr-1',
    questions: [
      'Quelle compétence aurais-tu aimé apprendre plus tôt, et pourquoi ?', 'Décris le meilleur repas que tu as mangé cette année.', 'Si tu pouvais vivre un an dans n’importe quelle ville, laquelle choisirais-tu ?',
      'Qu’est-ce que les gens comprennent souvent mal sur l’endroit où tu as grandi ?', 'Raconte une fois où un plan a complètement mal tourné.', 'À quoi ressemblerait ton samedi idéal ?',
      'Quel sport pratiquerais-tu en professionnel si tu pouvais choisir ?', 'Quel film ou quelle série pourrais-tu revoir encore et encore ? Pourquoi ?', 'Décris un prof ou un entraîneur qui a changé ta façon de penser.',
      'Quel est l’objet le plus utile que tu possèdes ?', 'Si tu tenais un café, qu’est-ce qui le rendrait différent ?', 'Raconte un voyage qui ne s’est pas passé comme prévu.',
      'Quelle habitude essaies-tu de prendre, et comment ça se passe ?', 'Explique comment préparer un plat que tu connais bien.', 'Dans quel métier serais-tu une catastrophe, et pourquoi ?',
      'Décris ta voiture de rêve et où tu irais avec.', 'Quelle règle devrait changer, selon toi ?', 'Raconte une fois où tu as dû apprendre quelque chose très vite.',
      'Quel est le meilleur conseil qu’on t’ait donné ?', 'Si tu avais une semaine libre sans téléphone, que ferais-tu ?', 'Décris l’endroit où tu te détends le mieux.',
      'Sur quoi as-tu changé d’avis récemment ?', 'Parle d’un match ou d’une partie dont tu te souviens bien.', 'Pour toi, qu’est-ce qui fait un bon ami ?',
      'Si tu pouvais poser une question à une personne célèbre, à qui et laquelle ?', 'Décris une journée normale pour toi, du matin au soir.', 'Que ferais-tu d’une heure de plus chaque jour ?',
      'Quelle petite chose te met toujours de bonne humeur ?', 'Parle de quelque chose que tu as construit, réparé ou fabriqué.', 'Où te vois-tu dans cinq ans ?',
    ],
    retellHelp: N_('Retell something you watched recently (a video, an episode, a match) for about 60 seconds, in French.'),
  },
  es: {
    name: N_('Spanish'),
    timing: 'syllable',
    examples: { off: N_('e.g. my “rr” in “perro” doesn’t roll'), aim: N_('e.g. the soft “d” in “nada”'), accentOther: N_('e.g. Colombian Spanish') },
    accents: [
      { id: 'mx', name: N_('Mexican Spanish'), short: N_('Mexican'), spelling: null, hint: N_('The most widely heard Latin American accent, common in film dubbing.') },
      { id: 'es', name: N_('Peninsular Spanish'), short: N_('Spanish (Spain)'), spelling: null, hint: N_('The accent of central Spain, with the “th” sound in “cielo”.') },
      { id: 'ar', name: N_('Rioplatense Spanish'), short: N_('Argentine'), spelling: null, hint: N_('Buenos Aires and Montevideo, with “sh” for “ll” and “y”.') },
    ],
    readSets: {
      'es-1': [
        'Normalmente camino al trabajo, pero cuando llueve tomo el autobús.',
        'Deberíamos revisar los números antes de decidir nada.',
        'La verdad, fue una semana muy difícil, y todo el mundo hizo un trabajo excelente.',
        '¿Puedes subir las bolsas mientras yo preparo el café?',
        'Mi vecina se compró una bicicleta roja y ahora va a la playa todos los sábados.',
        'No es un mal comienzo de año, pero todavía queda mucho por delante.',
      ],
    },
    readSet: 'es-1',
    questions: [
      '¿Qué habilidad te gustaría haber aprendido antes, y por qué?', 'Describe la mejor comida que has probado en el último año.', 'Si pudieras vivir un año en cualquier ciudad, ¿cuál elegirías?',
      '¿Qué suele entender mal la gente sobre el lugar donde creciste?', 'Cuenta una vez en que un plan salió completamente mal.', '¿Cómo sería tu sábado perfecto?',
      '¿Qué deporte practicarías como profesional si pudieras elegir cualquiera?', '¿Qué película o serie podrías ver una y otra vez? ¿Por qué?', 'Describe a un profesor o entrenador que cambió tu forma de pensar.',
      '¿Cuál es la cosa más útil que tienes?', 'Si tuvieras una cafetería, ¿qué la haría diferente?', 'Cuenta un viaje que no salió como esperabas.',
      '¿Qué hábito intentas crear, y cómo te va?', 'Explica cómo se prepara un plato que conoces bien.', '¿En qué trabajo serías un desastre, y por qué?',
      'Describe tu viaje por carretera ideal: ¿adónde irías?', '¿Qué norma crees que debería cambiar?', 'Cuenta una vez en que tuviste que aprender algo muy rápido.',
      '¿Cuál es el mejor consejo que te han dado?', 'Si tuvieras una semana libre sin teléfono, ¿qué harías?', 'Describe el lugar donde más te relajas.',
      '¿Sobre qué has cambiado de opinión hace poco?', 'Habla de un partido o un juego que recuerdes bien.', '¿Qué hace que alguien sea un buen amigo, para ti?',
      'Si pudieras hacerle una pregunta a una persona famosa, ¿a quién y qué le preguntarías?', 'Describe un día normal para ti, de principio a fin.', '¿Qué harías con una hora extra cada día?',
      '¿Qué pequeña cosa siempre te pone de buen humor?', 'Habla de algo que hayas construido, arreglado o hecho con tus propias manos.', '¿Dónde te ves dentro de cinco años?',
    ],
    retellHelp: N_('Retell something you watched recently (a video, an episode, a match) for about 60 seconds, in Spanish.'),
  },
};
const NATIVE_LANGUAGE_HINTS = [N_('English'), N_('French'), N_('Spanish'), N_('Portuguese'), N_('German'), N_('Italian'), N_('Dutch'), N_('Polish'), N_('Russian'), N_('Ukrainian'), N_('Turkish'), N_('Arabic'), N_('Hindi'), N_('Bengali'), N_('Urdu'), N_('Mandarin Chinese'), N_('Cantonese'), N_('Japanese'), N_('Korean'), N_('Vietnamese'), N_('Thai'), N_('Indonesian'), N_('Tagalog')];

const PROFILE_DEFAULTS = { name: '', nativeLanguages: '', targetLanguage: 'en', accent: '', accentOther: '', notes: '', onboarded: null };
function profile() { return { ...PROFILE_DEFAULTS, ...(settings().profile || {}) }; }
function saveProfile(fields) { saveSettings({ profile: { ...profile(), ...fields } }); }
/* native languages are kept as one comma-separated string (what the AI prompt reads); the picker edits a list */
function splitLanguages(s) { return [...new Set(String(s || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean))]; }
function joinLanguages(list) { return list.join(', ').slice(0, 120); }

function langContent(p = profile()) { return LANGUAGES[p.targetLanguage] || LANGUAGES.en; }
/* the target language's code, falling back to English if the saved one no longer exists */
function targetLang(p = profile()) { return LANGUAGES[p.targetLanguage] ? p.targetLanguage : 'en'; }
/* the target accent: { name, short, spelling }; "Other" uses the learner's own words */
function targetAccent(p = profile()) {
  const lang = langContent(p);
  const known = lang.accents.find((a) => a.id === p.accent);
  if (known) return known;
  const other = String(p.accentOther || '').trim().slice(0, 80);
  if (other) return { name: other, short: other, spelling: null };
  return { name: `a native ${lang.name} accent`, short: N_('native'), spelling: null }; // name goes to the AI (English); short is shown with t()
}

/* check-ins made before languages existed have no lang: they are English */
function checkinLang(c) { return (c && c.lang) || 'en'; }

/* the read-aloud set for a programme: whatever its baseline used, else the language's current set */
function readSentences(c) {
  const lang = langContent();
  const code = targetLang();
  const base = Store.all('checkins').find((x) => x.week === 0 && checkinLang(x) === code);
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
    facts: About.facts().slice(-30).map((f) => f.text), // saved from chats (16-about.js)
    replyLanguage: UI_LANG_NAMES_EN[LANG] || 'English', // the interface language: feedback is written in it
  };
}
