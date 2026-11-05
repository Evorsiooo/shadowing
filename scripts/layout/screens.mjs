// The screens the layout check visits. Add a screen here when you add one to the app.
// ALLOW lists the boxes that are *meant* to scroll (they show a bar only when their content is longer than the box).
// Everything else that shows a scrollbar is a bug. Text fields, buttons and links may never scroll.
export const ALLOW = ['.askp-body', '.modal-back', '.sidebar', '.layout.focus.split .below', '.table-wrap', '.cal2', '.pv-edit', '.side .session', '.modal-back.obpage > .modal'] // the setup wizard scrolls when the window is shorter than a step;

const go = (hash) => async (p) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(300); };
const longText = 'This is a long question that keeps going so that the box has to grow past one line and eventually past its limit. '.repeat(12);

export const SCREENS = [
  { name: 'Today', run: go('#today'), themes: ['light', 'dark'] },
  { name: 'Today, nothing added yet', empty: true, run: go('#today') },
  { name: 'Library', run: go('#library') },
  { name: 'Progress overview', run: go('#progress') },
  { name: 'Progress issues', run: go('#progress/issues') },
  { name: 'Settings', run: go('#settings') },
  ...['measures', 'checkins', 'clips'].map((k) => ({ name: 'Progress ' + k, run: go('#progress/' + k) })),
  ...['you', 'data', 'connections', 'advanced'].map((k) => ({ name: 'Settings ' + k, run: go('#settings/' + k) })),
  { name: 'Library, a clip open', run: async (p) => { await go('#library')(p); await p.locator('.citem .clabel, .lib-table .linkbtn').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); } },
  { name: 'Session, first screen', run: async (p) => { await go('#today')(p); await p.getByRole('button', { name: /^Start/ }).first().click(); await p.waitForTimeout(800); } },
  { name: 'Setup wizard, first run', empty: true, run: async () => {}, allow: [] },
  { name: 'Ask Euno, empty', run: go('#ask') },
  { name: 'Ask Euno, one line typed', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', 'How do I pronounce the r in there?'); } },
  { name: 'Ask Euno, a long question', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', longText); await p.dispatchEvent('.ask-form textarea', 'input'); } },
  { name: 'Ask Euno, typed then cleared', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', longText); await p.dispatchEvent('.ask-form textarea', 'input'); await p.fill('.ask-form textarea', ''); await p.dispatchEvent('.ask-form textarea', 'input'); } },
  // the public site (no sign-in)
  ...[['Site home', '/'], ['Site home, French', '/fr/'], ['Site guide page', '/what-is-shadowing/'], ['Site contact form', '/contact/']].map(([name, path]) => ({ name, path, ready: 'main, h1', run: async () => {}, themes: ['light', 'dark'] })),
];
