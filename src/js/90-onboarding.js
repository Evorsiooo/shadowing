/* ---------- first-run setup ---------- */
/* A step-by-step wizard on first launch: your name, your languages, the accent you're aiming for,
   where files live, a first video, AI feedback and the week-0 baseline. Steps whose when() is
   false are skipped (no video step if you already have videos, and so on).
   Each step is { id, label (shown under the progress bar), title(W), sub(W), body(W), next(W) }.
   next(W) checks or saves the step's fields; returning false stays on the step.
   One step is still a placeholder, in its own function below so other work can replace it:
   - onboardingStorageStep: the Google Drive sync work replaces it with the connect flow.
   onboardingAiStep is the key and model picker from 87-ai.js. */
const ONBOARDING_STEPS = [
  {
    id: 'name', label: 'You',
    title: () => 'Welcome to Euno Shadowing',
    sub: () => 'A few quick questions to set things up. You can change any answer later in Settings → Profile.',
    body: (W) => nameField(W.draft),
    next: (W) => {
      W.draft.name = W.draft.name.trim();
      if (!W.draft.name) { toast('Tell us what to call you.', 'bad'); return false; }
      saveProfile({ name: W.draft.name });
      return true;
    },
  },
  {
    id: 'languages', label: 'Languages',
    title: (W) => `Nice to meet you, ${W.draft.name || 'there'}`,
    sub: () => 'Which languages do you already speak, and which one are you practising?',
    body: (W) => [nativeLanguagesField(W.draft), targetLanguageField(W.draft)],
    next: (W) => {
      if (!splitLanguages(W.draft.nativeLanguages).length) { toast('Add at least one language you speak.', 'bad'); return false; }
      saveProfile({ nativeLanguages: W.draft.nativeLanguages, targetLanguage: W.draft.targetLanguage });
      return true;
    },
  },
  {
    id: 'accent', label: 'Accent',
    title: () => 'Which accent are you aiming for?',
    sub: () => 'Pick the one you’d like to sound like. Your practice clips should be of a speaker with this accent.',
    body: (W) => [accentField(W.draft), notesField(W.draft)],
    next: (W) => {
      if (!W.draft.accent) { toast('Pick the accent you’re aiming for.', 'bad'); return false; }
      if (W.draft.accent === 'other' && !W.draft.accentOther.trim()) { toast('Describe the accent you’re aiming for.', 'bad'); return false; }
      saveProfile(W.draft);
      return true;
    },
  },
  {
    id: 'storage', label: 'Files',
    title: () => 'Where your files live',
    sub: () => 'Videos and recordings can be large, so they’re kept with you rather than on our server.',
    body: (W) => onboardingStorageStep(W),
  },
  {
    id: 'video', label: 'Video',
    when: () => !Store.all('videos').some((v) => !v.archived),
    title: () => 'Your first video',
    sub: () => 'You’ll practise with short clips from a video of someone whose accent you want.',
    body: (W) => [
      h('div', { class: 'card' },
        h('h3', null, 'What works best'),
        h('ul', { class: 'ticks' },
          h('li', null, 'One person speaking naturally: an interview, a podcast, a talk or a vlog.'),
          h('li', null, 'Clear sound, with little music or background noise.'),
          h('li', null, 'A file on your device, or a direct link to an .mp4 file.')),
        h('p', { class: 'small muted' }, 'You’ll cut it into clips of one sentence or so (10 to 20 seconds) after it’s added.')),
      h('label', { class: 'check', for: 'obVideo' }, h('input', { type: 'checkbox', id: 'obVideo', checked: W.addVideo, onchange: (e) => { W.addVideo = e.target.checked; } }), 'Open the “Add a video” form when I finish'),
    ],
  },
  {
    id: 'ai', label: 'AI',
    title: () => 'AI feedback (optional)',
    sub: () => 'After a recorded pass you can write down what sounded off and get advice on it.',
    body: (W) => onboardingAiStep(W),
  },
  {
    id: 'baseline', label: 'Baseline',
    when: () => !checkinHasAll(checkinFor(0)),
    title: () => 'Your starting point',
    sub: () => 'Record a week 0 baseline so you can hear how far you’ve come.',
    body: (W) => [
      h('p', null, 'Before your first session, record six sentences read aloud, a 60-second retelling and a 60-second answer to a question you haven’t seen. It takes about 3 minutes, and your check-ins at weeks 4, 8 and 12 are compared with it.'),
      choiceGroup('obBaseline', 'When to record the baseline', [
        { value: 'now', title: 'Record it now', hint: 'Opens the check-in when you finish.' },
        { value: 'later', title: 'Later', hint: 'Start it any time from Check-ins in the top bar.' },
      ], W.baseline ? 'now' : 'later', (v) => { W.baseline = v === 'now'; }),
    ],
  },
];

/* placeholder until Google Drive sync lands */
function onboardingStorageStep() {
  const cloud = Store.mode === 'cloud';
  return h('div', { class: 'cards' },
    h('div', { class: 'card' }, h('h3', null, 'On this device'),
      h('p', { class: 'small muted' }, cloud
        ? 'Works straight away. Videos and recordings stay in this browser. Your clips, notes and progress are saved to your account, so they follow you to other devices.'
        : `Works straight away. ${storageTitle()}`)),
    h('div', { class: 'card', 'aria-disabled': 'true', style: { opacity: 0.6 } }, h('h3', null, 'Google Drive'),
      h('p', { class: 'small muted' }, 'Keep a copy in your own Drive and use your videos on any device. Coming soon, and there’s nothing to decide now: you can turn it on later in Settings.')));
}

/* placeholder until bring-your-own-key AI lands */
function onboardingAiStep() {
  return [
    aiPanel({ onboarding: true }),
    h('p', { class: 'small muted' }, 'No key? Skip this step: notes give you a prompt to paste into any AI chat instead. You can add a key later in Settings → AI.'),
  ];
}

function needsOnboarding() { return !profile().onboarded; }

function openOnboarding() {
  const draft = { ...profile() };
  if (!draft.name && Api.name) draft.name = String(Api.name).split(/\s+/)[0].slice(0, 40); // first name from Google
  const W = { i: 0, draft, addVideo: true, baseline: true };
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
  const progress = h('ol', { class: 'wiz-progress', style: `--n: ${n}`, 'aria-label': `Step ${W.i + 1} of ${n}` },
    W.steps.map((s, i) => h('li', { class: i < W.i ? 'done' : i === W.i ? 'cur' : '', 'aria-current': i === W.i ? 'step' : null },
      h('i', null), h('span', null, s.label))));
  const form = h('form', { class: 'wiz', novalidate: true, onsubmit: (e) => { e.preventDefault(); go(); } },
    h('div', { class: 'wiz-top' },
      h('span', { class: 'label' }, `Step ${W.i + 1} of ${n}`),
      h('span', { class: 'grow' }),
      btn('', () => closeModal(), { icon: 'close', kind: 'ghost', size: 'sm', title: 'Close (you can finish setting up in Settings)', aria: 'Close' })),
    progress,
    h('div', { class: 'wiz-head' }, h('h2', null, step.title(W)), step.sub ? h('p', { class: 'muted' }, step.sub(W)) : null),
    h('div', { class: 'wiz-body stack' }, step.body(W)),
    h('div', { class: 'wiz-foot' },
      W.i > 0 ? btn('Back', back, { kind: 'ghost', icon: 'back' }) : null,
      h('span', { class: 'grow' }),
      h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, last ? 'Finish' : 'Continue'))));
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
  return h('label', { class: 'field', for: 'pfName' }, 'What should we call you?',
    h('input', { type: 'text', id: 'pfName', maxlength: 40, autocomplete: 'given-name', placeholder: 'Your first name', value: draft.name, oninput: (e) => { draft.name = e.target.value; } }));
}

/* a list of languages as removable chips, a box to type any language, and one-tap suggestions */
function nativeLanguagesField(draft) {
  let list = splitLanguages(draft.nativeLanguages);
  const tags = h('div', { class: 'tags' });
  const sugg = h('div', { class: 'suggest', 'aria-label': 'Suggestions' });
  const input = h('input', { type: 'text', id: 'pfNative', maxlength: 40, autocomplete: 'off', spellcheck: 'false', placeholder: 'Type a language, then press Enter',
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
    return NATIVE_LANGUAGE_HINTS.find((l) => l.toLowerCase() === q) || NATIVE_LANGUAGE_HINTS.find((l) => !list.includes(l) && l.toLowerCase().startsWith(q)) || typed;
  };
  const sync = (keepFocus = true) => {
    draft.nativeLanguages = joinLanguages(list);
    mount(tags, list.map((l) => h('span', { class: 'tag' }, l,
      h('button', { type: 'button', 'aria-label': `Remove ${l}`, onclick: () => { list = list.filter((x) => x !== l); sync(); } }, icon('close')))));
    input.placeholder = list.length ? 'Add another' : 'Type a language, then press Enter';
    drawSuggestions();
    if (keepFocus) input.focus();
  };
  const add = (l, quiet) => {
    l = l.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (l && !list.some((x) => x.toLowerCase() === l.toLowerCase())) list.push(l);
    input.value = '';
    sync(!quiet);
  };
  const drawSuggestions = () => {
    const q = input.value.trim().toLowerCase();
    const pool = NATIVE_LANGUAGE_HINTS.filter((l) => !list.includes(l));
    const shown = q ? pool.filter((l) => l.toLowerCase().includes(q)).slice(0, 8) : pool.slice(0, 8);
    mount(sugg, shown.map((l) => h('button', { type: 'button', class: 'chip add', onmousedown: (e) => e.preventDefault(), onclick: () => add(l) }, icon('plus'), l)));
  };
  sync(false);
  return h('div', { class: 'field' },
    h('label', { for: 'pfNative' }, 'Languages you speak natively'),
    h('div', { class: 'langpick', onclick: (e) => { if (e.target === e.currentTarget || e.target === tags) input.focus(); } }, tags, input),
    sugg,
    h('p', { class: 'small muted' }, 'Add one or more. Not in the list? Type it and press Enter.'));
}

function targetLanguageField(draft) {
  const langs = Object.entries(LANGUAGES);
  return h('div', { class: 'field' },
    h('span', { class: 'flabel', id: 'pfLangLbl' }, 'Language you’re practising'),
    choiceGroup('pfLang', null, langs.map(([id, l]) => ({ value: id, title: l.name })), draft.targetLanguage, (v) => { draft.targetLanguage = v; }, 'pfLangLbl'),
    langs.length === 1 ? h('p', { class: 'small muted' }, 'More languages are on the way.') : null);
}

function accentField(draft) {
  const lang = LANGUAGES[draft.targetLanguage] || LANGUAGES.en;
  const other = h('label', { class: 'field', for: 'pfAccentOther', hidden: draft.accent !== 'other' }, 'Describe the accent',
    h('input', { type: 'text', id: 'pfAccentOther', maxlength: 80, placeholder: 'e.g. Scottish English', value: draft.accentOther, oninput: (e) => { draft.accentOther = e.target.value; } }));
  return h('div', { class: 'field' },
    h('span', { class: 'flabel', id: 'pfAccentLbl' }, 'Accent you’re aiming for'),
    choiceGroup('pfAccent', null, [
      ...lang.accents.map((a) => ({ value: a.id, title: a.name, hint: a.hint })),
      { value: 'other', title: 'Something else', hint: 'Describe it in your own words.' },
    ], draft.accent, (v) => {
      draft.accent = v; other.hidden = v !== 'other';
      if (v === 'other') setTimeout(() => $('#pfAccentOther') && $('#pfAccentOther').focus(), 0);
    }, 'pfAccentLbl'),
    other);
}

function notesField(draft) {
  return h('label', { class: 'field', for: 'pfNotes' }, h('span', null, 'Anything the AI feedback should know ', h('span', { class: 'muted' }, '(optional)')),
    h('textarea', { id: 'pfNotes', rows: 2, maxlength: 500, placeholder: 'e.g. I understand everything but only started speaking it recently; rhythm is my weak spot.', value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } }));
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
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!draft.name.trim()) { toast('Tell us what to call you.', 'bad'); return; }
    if (!splitLanguages(draft.nativeLanguages).length) { toast('Add at least one language you speak.', 'bad'); return; }
    if (draft.accent === 'other' && !draft.accentOther.trim()) { toast('Describe the accent you’re aiming for.', 'bad'); return; }
    saveProfile({ ...draft, name: draft.name.trim() });
    toast('Profile saved.', 'good');
    closeModal();
  } },
  h('div', { class: 'card' }, h('h3', null, 'About you'), h('p', { class: 'small muted' }, 'Used for AI feedback, the listener pack and your check-ins.'),
    nameField(draft), nativeLanguagesField(draft), targetLanguageField(draft)),
  h('div', { class: 'card' }, h('h3', null, 'Your target accent'), accentField(draft), notesField(draft)),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, 'Save profile')),
    btn('Run the setup again', () => { closeModal(true); openOnboarding(); }, { kind: 'ghost' })));
}
