/* ---------- first-run setup ---------- */
/* A step-by-step wizard on first launch: your name, your languages, the accent you're aiming for,
   where files live, a first video, AI feedback and the week-0 baseline. Steps whose when() is
   false are skipped (no video step if you already have videos, and so on).
   Each step is { id, label (shown under the progress bar), title(W), sub(W), body(W), next(W) }.
   next(W) checks or saves the step's fields; returning false stays on the step.
   onboardingStorageStep is the device + optional Google Drive choice from 17-media.js.
   onboardingAiStep is the key and model picker from 87-ai.js. */
const ONBOARDING_STEPS = [
  {
    id: 'name', label: N_('You'),
    title: () => t('Welcome to Euno Shadowing'),
    sub: () => t('A few quick questions to set things up. You can change any answer later in Settings → Profile.'),
    // the interface language first, so the rest of the wizard reads in it; switching redraws this step (the draft keeps what was typed)
    body: (W) => [h('div', { class: 'field' }, h('span', { class: 'flabel', id: 'obUiLangLbl' }, t('Interface language')), uiLangPicker(() => renderOnboarding(W), 'obUiLangLbl')), nameField(W.draft)],
    next: (W) => {
      W.draft.name = W.draft.name.trim();
      if (!W.draft.name) { toast(t('Tell us what to call you.'), 'bad'); return false; }
      saveProfile({ name: W.draft.name });
      return true;
    },
  },
  {
    id: 'languages', label: N_('Languages'),
    title: (W) => (W.draft.name ? t('Nice to meet you, {name}', { name: W.draft.name }) : t('Nice to meet you')),
    sub: () => t('Which languages do you already speak, and which one are you practising?'),
    body: (W) => [nativeLanguagesField(W.draft), targetLanguageField(W.draft)],
    next: (W) => {
      if (!splitLanguages(W.draft.nativeLanguages).length) { toast(t('Add at least one language you speak.'), 'bad'); return false; }
      saveProfile({ nativeLanguages: W.draft.nativeLanguages, targetLanguage: W.draft.targetLanguage });
      return true;
    },
  },
  {
    id: 'accent', label: N_('Accent'),
    title: () => t('Which accent are you aiming for?'),
    sub: () => t('Pick the one you’d like to sound like. Your practice clips should be of a speaker with this accent.'),
    body: (W) => [accentField(W.draft), notesField(W.draft)],
    next: (W) => {
      if (!W.draft.accent) { toast(t('Pick the accent you’re aiming for.'), 'bad'); return false; }
      if (W.draft.accent === 'other' && !W.draft.accentOther.trim()) { toast(t('Describe the accent you’re aiming for.'), 'bad'); return false; }
      saveProfile(W.draft);
      return true;
    },
  },
  {
    id: 'goal', label: N_('Goal'),
    title: () => t('How often will you practise?'),
    sub: () => t('Pick a goal you can keep. A short session counts, and you can change it later in Settings.'),
    body: (W) => [choiceGroup('obGoal', t('Days per week'), [
      { value: 3, title: t('3 days a week'), hint: t('Relaxed. Good for a busy week.') },
      { value: 5, title: t('5 days a week'), hint: t('Steady. Most people improve fastest here.') },
      { value: 7, title: t('Every day'), hint: t('Ambitious. One rest day in a row never breaks your streak.') },
    ], W.goal, (v) => { W.goal = v; })],
    next: (W) => {
      if (!W.goal) { toast(t('Pick a goal to continue.'), 'bad'); return false; }
      saveSettings({ weeklyTarget: W.goal });
      return true;
    },
  },
  {
    id: 'storage', label: N_('Files'),
    title: () => t('Where your files live'),
    sub: () => t('Videos and recordings can be large, so they’re kept with you rather than on our server.'),
    body: (W) => onboardingStorageStep(W),
  },
  {
    id: 'video', label: N_('Video'),
    when: () => !Store.all('videos').some((v) => !v.archived),
    title: () => t('Your first video'),
    sub: () => t('You’ll practise with short clips from a video of someone whose accent you want.'),
    body: (W) => [
      h('div', { class: 'card' },
        h('h3', null, t('What works best')),
        h('ul', { class: 'ticks' },
          h('li', null, t('One person speaking naturally: an interview, a podcast, a talk or a vlog.')),
          h('li', null, t('Clear sound, with little music or background noise.')),
          h('li', null, t('A file on your device, or a direct link to an .mp4 file.'))),
        h('p', { class: 'small muted' }, t('You’ll cut it into clips of one sentence or so (10 to 20 seconds) after it’s added.'))),
      h('label', { class: 'check', for: 'obVideo' }, h('input', { type: 'checkbox', id: 'obVideo', checked: W.addVideo, onchange: (e) => { W.addVideo = e.target.checked; } }), t('Open the “Add a video” form when I finish')),
    ],
  },
  {
    id: 'ai', label: N_('AI'),
    title: () => t('AI feedback (optional)'),
    sub: () => t('After a recorded pass you can write down what sounded off and get advice on it.'),
    body: (W) => onboardingAiStep(W),
  },
  {
    id: 'baseline', label: N_('Baseline'),
    when: () => !checkinHasAll(checkinFor(0)),
    title: () => t('Your starting point'),
    sub: () => t('Record a week 0 baseline so you can hear how far you’ve come.'),
    body: (W) => [
      h('p', null, t('Before your first session, record six sentences read aloud, a 60-second retelling and a 60-second answer to a question you haven’t seen. It takes about 3 minutes, and your check-ins at weeks 4, 8 and 12 are compared with it.')),
      choiceGroup('obBaseline', t('When to record the baseline'), [
        { value: 'now', title: t('Record it now'), hint: t('Opens the check-in when you finish.') },
        { value: 'later', title: t('Later'), hint: t('Start it any time from Check-ins in the top bar.') },
      ], W.baseline ? 'now' : 'later', (v) => { W.baseline = v === 'now'; }),
    ],
  },
];

/* placeholder until Google Drive sync lands */
function onboardingStorageStep() { return storageStepBody(); } // 17-media.js

/* placeholder until bring-your-own-key AI lands */
function onboardingAiStep() {
  return [
    aiPanel({ onboarding: true }),
    h('p', { class: 'small muted' }, t('No key? Skip this step: notes give you a prompt to paste into any AI chat instead. You can add a key later in Settings → AI.')),
  ];
}

function needsOnboarding() { return !profile().onboarded; }

function openOnboarding() {
  const draft = { ...profile() };
  if (!draft.name && Api.name) draft.name = String(Api.name).split(/\s+/)[0].slice(0, 40); // first name from Google
  const W = { i: 0, draft, addVideo: true, baseline: true, goal: 0 }; // no goal preselected: choosing one is a small commitment
  W.steps = ONBOARDING_STEPS.filter((s) => !s.when || s.when());
  renderOnboarding(W);
}

function renderOnboarding(W) {
  const step = W.steps[W.i];
  const n = W.steps.length;
  const last = W.i === n - 1;
  const go = () => {
    if (step.next && step.next(W) === false) return;
    if (last) finishOnboarding(W); else { W.i++; renderOnboarding(W); }
  };
  const back = () => { W.i--; renderOnboarding(W); };
  const progress = h('ol', { class: 'wiz-progress', style: `--n: ${n}`, 'aria-label': t('Step {i} of {n}', { i: W.i + 1, n }) },
    W.steps.map((s, i) => h('li', { class: i < W.i ? 'done' : i === W.i ? 'cur' : '', 'aria-current': i === W.i ? 'step' : null },
      h('i', null), h('span', null, t(s.label)))));
  const form = h('form', { class: 'wiz', novalidate: true, onsubmit: (e) => { e.preventDefault(); go(); } },
    h('div', { class: 'wiz-top' },
      h('span', { class: 'label' }, t('Step {i} of {n}', { i: W.i + 1, n })),
      h('span', { class: 'grow' }),
      btn('', () => closeModal(), { icon: 'close', kind: 'ghost', size: 'sm', title: t('Close (you can finish setting up in Settings)'), aria: t('Close') })),
    progress,
    h('div', { class: 'wiz-head' }, h('h2', null, step.title(W)), step.sub ? h('p', { class: 'muted' }, step.sub(W)) : null),
    h('div', { class: 'wiz-body stack' }, step.body(W)),
    h('div', { class: 'wiz-foot' },
      W.i > 0 ? btn(t('Back'), back, { kind: 'ghost', icon: 'back' }) : null,
      h('span', { class: 'grow' }),
      h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, last ? t('Finish') : t('Continue')))));
  // focus the step's first text box, else Continue (not the close button)
  const first = form.querySelector('.wiz-body input:not([type="checkbox"]):not([type="radio"]), .wiz-body textarea') || form.querySelector('button[type="submit"]');
  first.setAttribute('autofocus', '');
  openModal(form, { narrow: true, onClose: () => finishOnboarding(W, true) });
}

/* closing early keeps whatever was saved so far; everything can be changed later in Settings → Profile */
function finishOnboarding(W, closed) {
  saveProfile({ onboarded: new Date().toISOString() });
  lsSet('welcomed', true);
  if (closed) return;
  closeModal(true);
  renderAll();
  if (W.steps.some((s) => s.id === 'video') && W.addVideo) {
    UI.addOpen = true;
    renderSidebar();
    if (!W.baseline || !W.steps.some((s) => s.id === 'baseline')) { openDrawer(); setTimeout(() => { const f = $('#addUrl') || $('#addFile'); if (f) f.focus(); }, 60); }
  }
  if (W.baseline && W.steps.some((s) => s.id === 'baseline')) openCheckins(0);
}

/* ---------- profile fields, shared by onboarding and Settings → Profile; edits go into draft ---------- */
function nameField(draft) {
  return h('label', { class: 'field', for: 'pfName' }, t('What should we call you?'),
    h('input', { type: 'text', id: 'pfName', maxlength: 40, autocomplete: 'given-name', placeholder: t('Your first name'), value: draft.name, oninput: (e) => { draft.name = e.target.value; } }));
}

/* a list of languages as removable chips, a box to type any language, and one-tap suggestions */
function nativeLanguagesField(draft) {
  let list = splitLanguages(draft.nativeLanguages);
  const tags = h('div', { class: 'tags' });
  const sugg = h('div', { class: 'suggest', 'aria-label': t('Suggestions') });
  const input = h('input', { type: 'text', id: 'pfNative', maxlength: 40, autocomplete: 'off', spellcheck: 'false', placeholder: t('Type a language, then press Enter'),
    oninput: () => drawSuggestions(),
    onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (input.value.trim()) add(bestMatch());
      } else if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); sync(); }
    },
    onblur: () => { if (input.value.trim()) add(bestMatch(), true); } });
  // what Enter adds: the exact language, else the first suggestion ("fr" -> French), else what was typed
  const bestMatch = () => {
    const typed = input.value.trim(), q = typed.toLowerCase();
    // matches the English name or the name in the interface language; the English name is what's stored
    const names = (l) => [l.toLowerCase(), t(l).toLowerCase()];
    return NATIVE_LANGUAGE_HINTS.find((l) => names(l).includes(q)) || NATIVE_LANGUAGE_HINTS.find((l) => !list.includes(l) && names(l).some((x) => x.startsWith(q))) || typed;
  };
  const sync = (keepFocus = true) => {
    draft.nativeLanguages = joinLanguages(list);
    mount(tags, list.map((l) => h('span', { class: 'tag' }, t(l),
      h('button', { type: 'button', 'aria-label': t('Remove {lang}', { lang: t(l) }), onclick: () => { list = list.filter((x) => x !== l); sync(); } }, icon('close')))));
    input.placeholder = list.length ? t('Add another') : t('Type a language, then press Enter');
    drawSuggestions();
    if (keepFocus) input.focus();
  };
  const add = (l, quiet) => {
    l = l.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (l && !list.some((x) => x.toLowerCase() === l.toLowerCase() || t(x).toLowerCase() === l.toLowerCase())) list.push(l);
    input.value = '';
    sync(!quiet);
  };
  const drawSuggestions = () => {
    const q = input.value.trim().toLowerCase();
    const pool = NATIVE_LANGUAGE_HINTS.filter((l) => !list.includes(l));
    const shown = q ? pool.filter((l) => l.toLowerCase().includes(q) || t(l).toLowerCase().includes(q)).slice(0, 8) : pool.slice(0, 8);
    mount(sugg, shown.map((l) => h('button', { type: 'button', class: 'chip add', onmousedown: (e) => e.preventDefault(), onclick: () => add(l) }, icon('plus'), t(l))));
  };
  sync(false);
  return h('div', { class: 'field' },
    h('label', { for: 'pfNative' }, t('Languages you speak natively')),
    h('div', { class: 'langpick', onclick: (e) => { if (e.target === e.currentTarget || e.target === tags) input.focus(); } }, tags, input),
    sugg,
    h('p', { class: 'small muted' }, t('Add one or more. Not in the list? Type it and press Enter.')));
}

function targetLanguageField(draft, onchange) {
  const langs = Object.entries(LANGUAGES);
  return h('div', { class: 'field' },
    h('span', { class: 'flabel', id: 'pfLangLbl' }, t('Language you’re practising')),
    choiceGroup('pfLang', null, langs.map(([id, l]) => ({ value: id, title: t(l.name) })), draft.targetLanguage, (v) => {
      // accents belong to a language, so a new language starts with no accent picked
      if (v !== draft.targetLanguage) { draft.accent = ''; draft.accentOther = ''; }
      draft.targetLanguage = v;
      if (onchange) onchange(v);
    }, 'pfLangLbl'),
    langs.length === 1 ? h('p', { class: 'small muted' }, t('More languages are on the way.')) : null);
}

function accentField(draft) {
  const lang = LANGUAGES[draft.targetLanguage] || LANGUAGES.en;
  const other = h('label', { class: 'field', for: 'pfAccentOther', hidden: draft.accent !== 'other' }, t('Describe the accent'),
    h('input', { type: 'text', id: 'pfAccentOther', maxlength: 80, placeholder: t(lang.examples.accentOther), value: draft.accentOther, oninput: (e) => { draft.accentOther = e.target.value; } }));
  return h('div', { class: 'field' },
    h('span', { class: 'flabel', id: 'pfAccentLbl' }, t('Accent you’re aiming for')),
    choiceGroup('pfAccent', null, [
      ...lang.accents.map((a) => ({ value: a.id, title: t(a.name), hint: t(a.hint) })),
      { value: 'other', title: t('Something else'), hint: t('Describe it in your own words.') },
    ], draft.accent, (v) => {
      draft.accent = v; other.hidden = v !== 'other';
      if (v === 'other') setTimeout(() => $('#pfAccentOther') && $('#pfAccentOther').focus(), 0);
    }, 'pfAccentLbl'),
    other);
}

function notesField(draft) {
  return h('label', { class: 'field', for: 'pfNotes' }, h('span', null, t('Anything the AI feedback should know'), ' ', h('span', { class: 'muted' }, t('(optional)'))),
    h('textarea', { id: 'pfNotes', rows: 2, maxlength: 500, placeholder: t('e.g. I understand everything but only started speaking it recently; rhythm is my weak spot.'), value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } }));
}

/* the interface language: each language in its own name; onchange redraws whatever is open (a modal isn't redrawn by renderAll) */
function uiLangPicker(onchange, labelledby) {
  return h('div', { class: 'seg', style: { alignSelf: 'flex-start', width: 'fit-content' }, role: 'group', 'aria-label': labelledby ? null : t('Interface language'), 'aria-labelledby': labelledby || null },
    Object.entries(UI_LANGS).map(([code, name]) => h('button', { type: 'button', lang: code, class: code === LANG ? 'on' : '', 'aria-pressed': String(code === LANG),
      onclick: () => { if (code === LANG) return; setUiLang(code); if (onchange) onchange(code); } }, name)));
}

/* a set of radio cards (one choice), styled like the rest of the app instead of a dropdown */
function choiceGroup(name, label, options, value, onchange, labelledby) {
  return h('div', { class: 'choices', role: 'radiogroup', 'aria-label': label || null, 'aria-labelledby': labelledby || null },
    options.map((o) => h('label', { class: 'choice', for: `${name}-${o.value}` },
      h('input', { type: 'radio', name, id: `${name}-${o.value}`, value: o.value, checked: o.value === value, onchange: (e) => { if (e.target.checked) onchange(o.value); } }),
      h('span', { class: 'choice-text' }, h('strong', null, o.title), o.hint ? h('span', { class: 'small muted' }, o.hint) : null))));
}

function profileView() {
  const draft = { ...profile() };
  const before = targetLang();
  const accentSlot = h('div', null, accentField(draft));
  const redrawAccent = () => mount(accentSlot, accentField(draft));
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!draft.name.trim()) { toast(t('Tell us what to call you.'), 'bad'); return; }
    if (!splitLanguages(draft.nativeLanguages).length) { toast(t('Add at least one language you speak.'), 'bad'); return; }
    if (draft.accent === 'other' && !draft.accentOther.trim()) { toast(t('Describe the accent you’re aiming for.'), 'bad'); return; }
    if (!draft.accent && targetLang(draft) !== before) { toast(t('Pick the accent you’re aiming for.'), 'bad'); return; }
    saveProfile({ ...draft, name: draft.name.trim() });
    if (targetLang() !== before) {
      const had = Store.all('checkins').some((c) => checkinLang(c) === targetLang());
      const lang = t(langContent().name);
      toast(had ? t('Switched to {lang}. Your {lang} check-ins are back.', { lang }) : t('Switched to {lang}. It has its own check-ins, starting with a new week 0 baseline. Your {old} check-ins are kept.', { lang, old: t(LANGUAGES[before].name) }), 'good', 8000);
      renderAll();
    } else toast(t('Profile saved.'), 'good');
    closeModal();
  } },
  h('div', { class: 'card' }, h('h3', null, t('About you')), h('p', { class: 'small muted' }, t('Used for AI feedback, the listener pack and your check-ins.')),
    nameField(draft), nativeLanguagesField(draft), targetLanguageField(draft, redrawAccent)),
  h('div', { class: 'card' }, h('h3', null, t('Your target accent')), accentSlot, notesField(draft)),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, t('Save profile'))),
    btn(t('Run the setup again'), () => { closeModal(true); openOnboarding(); }, { kind: 'ghost' })));
}
