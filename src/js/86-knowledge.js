/* ---------- Euno's research notes (the knowledgebase) ----------
   KNOWLEDGE is filled in by scripts/build.mjs from src/knowledge/entries.json: 31 short entries about what research says on
   shadowing and accent learning, each with its evidence label and the studies it rests on. They ship with the app as plain
   text, each with a short plain "coach" answer, are matched to the question on this device, and the best few go along with the question to the learner's own AI
   key (server/ai.js chatSystemPrompt), which may only cite what they say. Nothing is hosted and nothing is looked up. */
const Know = {
  STOP: new Set(('a an and are as at be but by can do does for from has have how i if in is it its me my of on or so than that the their them then there these this to was we what when where which who why will with would you your ' +
    'shadowing shadow euno should could about really actually really also just get got into not no yes ' +
    'le la les un une des du de et est que qui pour pas sur dans avec je tu il elle nous vous ils ce cette ' +
    'el los las una unos unas del y es por para con que como mi tu su').split(' ')),
  GENERIC: new Set(['accent', 'pronunciation', 'sound', 'sounds', 'speak', 'speaking', 'language', 'learn', 'learning', 'practice', 'better', 'improve', 'help', 'work', 'works', 'french', 'spanish']),
  stems: null,
  words(s) { return String(s || '').toLowerCase().match(/[a-zà-ÿñ][a-zà-ÿñ'-]*/g) || []; },
  stem(w) { return w.replace(/'s$/, '').slice(0, 6); },
  build() {
    Know.stems = KNOWLEDGE.map((e) => {
      const kw = new Set(), q = new Set(), gen = new Set(Array.from(Know.GENERIC, Know.stem));
      for (const w of Know.words(e.keywords)) if (!Know.STOP.has(w)) kw.add(Know.stem(w));
      for (const w of Know.words(e.question)) if (!Know.STOP.has(w)) q.add(Know.stem(w));
      return { kw, q, gen };
    });
  },
  /* score = distinct question words that hit the entry's keywords (3 each, 1 for very common words like "accent"), plus 1 when the word is also in the entry's question */
  score(i, text) {
    const { kw, q, gen } = Know.stems[i];
    let s = 0;
    for (const st of new Set(Know.words(text).filter((w) => !Know.STOP.has(w) && w.length > 2).map(Know.stem))) s += (kw.has(st) ? (gen.has(st) ? 1 : 3) : 0) + (q.has(st) ? 1 : 0);
    return s;
  },
  /* the best entries (most three) for the latest question; a short follow-up borrows the question before it */
  pick(texts, max = 3, min = 3) {
    if (!Know.stems) Know.build();
    const [last, before] = [texts[texts.length - 1] || '', texts[texts.length - 2] || ''];
    const rank = (text) => KNOWLEDGE.map((e, i) => ({ e, s: Know.score(i, text) })).filter((x) => x.s >= min).sort((a, b) => b.s - a.s);
    let r = rank(last);
    if (!r.length && Know.words(last).length <= 6 && before) r = rank(before + ' ' + last);
    // keep entries scoring close to the best one, so one clear match isn't padded with weak ones
    return r.filter((x) => x.s >= r[0].s * 0.6).slice(0, max).map((x) => x.e);
  },
  /* one entry as text for the model (English; the model answers in the learner's language) */
  render(e) {
    const src = e.sources.map((s) => `- ${s.cite}${s.read ? ` [read: ${s.read}]` : ''}${s.design ? ` Design: ${s.design}.` : ''}${s.finding ? ` Finding: ${s.finding}` : ''}`).join('\n');
    const unfinished = e.status !== 'draft' ? ` Entry status: ${e.status} (sources still being completed or checked).` : '';
    return `NOTE ${e.id}. Question: ${e.question}\nCoach answer (default wording; say it in your own words): ${e.coach}\nEvidence label (for you, not for the learner unless they ask): ${e.evidence}.${unfinished}${e.english_only_sound_comparison ? ' Euno\'s sound-by-sound comparison works for English only, not French or Spanish.' : ''}\nFull summary (only when they ask for the research or sources): ${e.answer}\nSources:\n${src}\nCaveats: ${e.caveats.join(' ') || '(none)'}\nThis does NOT say: ${e.not_say.join(' ') || '(n/a)'}${e.app_note ? `\nAbout the app: ${e.app_note}` : ''}`.slice(0, 4000);
  },
};
