/* ---------- first-run setup ---------- */
/* A short wizard on first launch: about you, where files live, a first video, AI feedback and
   the week-0 baseline. Steps whose when() is false are skipped (no video step if you already
   have videos, and so on). Steps still waiting on other work are placeholders:
   - 'storage': storageStepBody() in 17-media.js (this device, plus optional Google Drive);
   - 'ai': the bring-your-own-key work replaces body() with the key and model picker.
   A step can set next(W) to check or save its fields; returning false stays on the step. */
const ONBOARDING_STEPS = [
  {
    id: 'profile', title: 'About you',
    body: (W) => profileFields(W.draft),
    next: (W) => {
      if (!W.draft.accent) { toast('Pick the accent you’re aiming for.', 'bad'); return false; }
      if (W.draft.accent === 'other' && !W.draft.accentOther.trim()) { toast('Describe the accent you’re aiming for.', 'bad'); return false; }
      saveProfile(W.draft);
      return true;
    },
  },
  {
    id: 'storage', title: 'Where your files live',
    body: () => storageStepBody(), // 17-media.js
  },
  {
    id: 'video', title: 'Your first video',
    when: () => !Store.all('videos').some((v) => !v.archived),
    body: (W) => [
      h('p', null, 'You’ll practise with short clips from a video of someone whose accent you want. What works best:'),
      h('ul', { style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' } },
        h('li', null, 'One person speaking naturally: an interview, a podcast, a talk or a vlog.'),
        h('li', null, 'Clear sound, with little music or background noise.'),
        h('li', null, 'A file on your device, or a direct link to an .mp4 file.')),
      h('p', { class: 'small muted' }, 'You’ll cut it into clips of one sentence or so (10 to 20 seconds) after it’s added.'),
      h('label', { class: 'check', for: 'obVideo' }, h('input', { type: 'checkbox', id: 'obVideo', checked: W.addVideo, onchange: (e) => { W.addVideo = e.target.checked; } }), 'Open the “Add a video” form when I finish'),
    ],
  },
  {
    id: 'ai', title: 'AI feedback (optional)',
    body: () => [
      h('p', null, 'After a recorded pass you can write down what sounded off and get advice on it. This is optional.'),
      h('div', { class: 'cards' },
        h('div', { class: 'card' }, h('h3', null, 'Copy a prompt'), h('p', { class: 'small muted' }, 'No key needed: the app writes a prompt for you to paste into any AI chat, and you paste the answer back.')),
        h('div', { class: 'card', 'aria-disabled': 'true', style: { opacity: 0.6 } }, h('h3', null, 'Use your own API key'), h('p', { class: 'small muted' }, 'Answers right inside the app, with a key from Anthropic, OpenAI or OpenRouter and the model you pick. Coming soon in Settings.'))),
    ],
  },
  {
    id: 'baseline', title: 'Your starting point',
    when: () => !checkinHasAll(checkinFor(0)),
    body: (W) => [
      h('p', null, 'Before your first session, record a week 0 baseline: six sentences read aloud, a 60-second retelling and a 60-second answer to a question you haven’t seen. It takes about 3 minutes, and your check-ins at weeks 4, 8 and 12 are compared with it.'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'When to record the baseline' },
        h('button', { type: 'button', class: W.baseline ? 'on' : '', onclick: () => { W.baseline = true; renderOnboarding(W); } }, 'Record it now'),
        h('button', { type: 'button', class: W.baseline ? '' : 'on', onclick: () => { W.baseline = false; renderOnboarding(W); } }, 'Later')),
    ],
  },
];

function needsOnboarding() { return !profile().onboarded; }

function openOnboarding() {
  const W = { i: 0, draft: { ...profile() }, addVideo: true, baseline: true };
  W.steps = ONBOARDING_STEPS.filter((s) => !s.when || s.when());
  renderOnboarding(W);
}

function renderOnboarding(W) {
  const step = W.steps[W.i];
  const last = W.i === W.steps.length - 1;
  const go = () => {
    if (step.next && step.next(W) === false) return;
    if (last) finishOnboarding(W); else { W.i++; renderOnboarding(W); }
  };
  openModal([
    modalHead(W.i === 0 ? 'Welcome to Euno Shadowing' : step.title, `Step ${W.i + 1} of ${W.steps.length}${W.i === 0 ? ` · ${step.title}` : ''}`),
    h('div', { class: 'stack' }, step.body(W)),
    h('div', { class: 'row' },
      W.i > 0 ? btn('Back', () => { W.i--; renderOnboarding(W); }, { kind: 'ghost' }) : null,
      h('span', { class: 'grow' }),
      btn(last ? 'Finish' : 'Next', go, { kind: 'primary', size: 'big' })),
  ], { narrow: true, onClose: () => finishOnboarding(W, true) });
}

/* closing early keeps whatever was filled in; everything can be changed later in Settings → Profile */
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

/* the profile fields, shared by onboarding and Settings → Profile; edits go into draft */
function profileFields(draft) {
  const lang = LANGUAGES[draft.targetLanguage] || LANGUAGES.en;
  const other = h('label', { class: 'field', for: 'pfAccentOther', hidden: draft.accent !== 'other' }, 'Describe the accent',
    h('input', { type: 'text', id: 'pfAccentOther', maxlength: 80, placeholder: 'e.g. Scottish English', value: draft.accentOther, oninput: (e) => { draft.accentOther = e.target.value; } }));
  return [
    h('label', { class: 'field', for: 'pfNative' }, 'Your native language(s)',
      h('input', { type: 'text', id: 'pfNative', maxlength: 120, list: 'pfNativeList', placeholder: 'e.g. French', value: draft.nativeLanguages, oninput: (e) => { draft.nativeLanguages = e.target.value; } }),
      h('datalist', { id: 'pfNativeList' }, NATIVE_LANGUAGE_HINTS.map((l) => h('option', { value: l })))),
    h('label', { class: 'field', for: 'pfLang' }, 'Language you’re practising',
      h('select', { id: 'pfLang', onchange: (e) => { draft.targetLanguage = e.target.value; } },
        Object.entries(LANGUAGES).map(([id, l]) => h('option', { value: id, selected: id === draft.targetLanguage }, l.name)))),
    Object.keys(LANGUAGES).length === 1 ? h('p', { class: 'small muted' }, 'More languages are on the way.') : null,
    h('label', { class: 'field', for: 'pfAccent' }, 'Accent you’re aiming for',
      h('select', { id: 'pfAccent', onchange: (e) => { draft.accent = e.target.value; other.hidden = draft.accent !== 'other'; } },
        h('option', { value: '', selected: !draft.accent, disabled: true }, 'Choose one'),
        lang.accents.map((a) => h('option', { value: a.id, selected: draft.accent === a.id }, a.name)),
        h('option', { value: 'other', selected: draft.accent === 'other' }, 'Other'))),
    other,
    h('label', { class: 'field', for: 'pfNotes' }, 'Anything the AI feedback should know (optional)',
      h('textarea', { id: 'pfNotes', rows: 2, maxlength: 500, placeholder: 'e.g. I understand everything but only started speaking it recently; rhythm is my weak spot.', value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } })),
  ];
}

function profileView() {
  const draft = { ...profile() };
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (draft.accent === 'other' && !draft.accentOther.trim()) { toast('Describe the accent you’re aiming for.', 'bad'); return; }
    saveProfile(draft);
    toast('Profile saved.', 'good');
    closeModal();
  } },
  h('div', { class: 'card' }, h('h3', null, 'About you'), h('p', { class: 'small muted' }, 'Used for AI feedback, the listener pack and your check-ins.'), profileFields(draft)),
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, 'Save profile'))));
}
