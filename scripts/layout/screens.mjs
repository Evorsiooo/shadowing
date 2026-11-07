// The screens the layout check visits. Add a screen here when you add one to the app.
// ALLOW lists the boxes that are *meant* to scroll (they show a bar only when their content is longer than the box).
// Everything else that shows a scrollbar is a bug. Text fields, buttons and links may never scroll.
export const ALLOW = ['.askp-body', '.modal-back', '.sidebar', '.layout.focus.split .below', '.table-wrap', '.cal2', '.pv-edit', '.side .session', '.modal-back.obpage > .modal'] // the setup wizard scrolls when the window is shorter than a step;

const go = (hash) => async (p) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(300); };
const longText = 'This is a long question that keeps going so that the box has to grow past one line and eventually past its limit. '.repeat(12);

export const SCREENS = [
  { name: 'Today', run: go('#today'), themes: ['light', 'dark'] },
  { name: 'Today, three cards under the main one', run: async (p) => { await go('#today')(p); await p.evaluate(() => { const g = document.querySelector('.tbelow'); if (!g) throw new Error('no cards under the main card'); g.append(g.lastElementChild.cloneNode(true)); }); } },
  { name: 'Today, nothing added yet', empty: true, run: go('#today') },
  { name: 'Library', run: go('#library') },
  { name: 'Progress overview', run: go('#progress') },
  { name: 'Progress issues', run: go('#progress/issues') },
  { name: 'Settings', run: go('#settings') },
  ...['measures', 'checkins', 'clips'].map((k) => ({ name: 'Progress ' + k, run: go('#progress/' + k) })),
  ...['you', 'data', 'connections', 'advanced'].map((k) => ({ name: 'Settings ' + k, run: go('#settings/' + k) })),
  { name: 'Library, a clip open', run: async (p) => { await go('#library')(p); await p.locator('.citem .clabel, .lib-table .linkbtn').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); } },
  { name: 'Session, first screen', run: async (p) => { await go('#today')(p); await p.getByRole('button', { name: /^Start/ }).first().click(); await p.waitForTimeout(800); } },
  { name: 'Session, pass controls', run: async (p) => { await go('#today')(p); await p.getByRole('button', { name: /^Start/ }).first().click(); await p.waitForTimeout(600); await p.locator('.focus-ctl .btn.primary, .focus-ctl button').first().click(); await p.waitForSelector('.fctl', { timeout: 6000 }); await p.waitForTimeout(400); },
    // the play button and the pass bar sit on the middle of the card, and the bar is there in every step
    check: async (p) => p.evaluate(() => {
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
      const card = document.querySelector('.focus-card'), play = document.querySelector('.focus-ctl .playbig'), bar = document.querySelector('.passes .bar');
      const out = [];
      if (!bar) out.push({ kind: 'no-pass-bar' });
      if (card && play && Math.abs(mid(card) - mid(play)) > 2) out.push({ kind: 'play-off-centre', detail: `${Math.round(mid(play) - mid(card))}px` });
      if (card && bar && Math.abs(mid(card) - mid(bar)) > 2) out.push({ kind: 'bar-off-centre', detail: `${Math.round(mid(bar) - mid(card))}px` });
      return out;
    }) },
  { name: 'Session, recording step keeps the video size', run: async (p) => { await go('#today')(p); await p.getByRole('button', { name: /^Start/ }).first().click(); await p.waitForTimeout(600); await p.locator('.focus-ctl .btn.primary, .focus-ctl button').first().click(); await p.waitForSelector('.fctl', { timeout: 6000 }); await p.waitForTimeout(400);
      await p.evaluate(() => { document.body.dataset.vh0 = String(document.querySelector('#player video, .player video').getBoundingClientRect().height); Mic.open = async () => true; Mic.error = null; Session.phase = 'armed'; renderSession(); window.dispatchEvent(new Event('resize')); });
      await p.waitForSelector('.preflight', { timeout: 4000 }); await p.waitForTimeout(500); },
    // the video is exactly as tall on the recording step as while passes run
    check: async (p) => p.evaluate(() => { const h0 = +document.body.dataset.vh0, h1 = document.querySelector('#player video, .player video').getBoundingClientRect().height; return Math.abs(h0 - h1) > 1 ? [{ kind: 'video-resized', detail: `${Math.round(h0)} -> ${Math.round(h1)}px` }] : []; }) },
  { name: 'Session, review of a recorded pass', run: async (p) => { await go('#today')(p); await p.getByRole('button', { name: /^Start/ }).first().click(); await p.waitForTimeout(600); await p.locator('.focus-ctl button').first().click(); await p.waitForSelector('.fctl', { timeout: 6000 }); await p.waitForTimeout(300);
      await p.evaluate(() => { Session.review = { url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', recId: 'rev-test', slot: 'step3', analysis: { st: [], db: [], hop: HOP_S, offset: 0, lag: 0.3 }, phones: [] }; Session.phase = 'review'; renderAll(); window.dispatchEvent(new Event('resize')); });
      await p.waitForSelector('.rev-bar', { timeout: 4000 }); await p.waitForTimeout(500); },
    // the play row and the note line live in the review card, right above Redo / Continue, and nothing sticks out of it
    check: async (p) => p.evaluate(() => {
      const bar = document.querySelector('.rev-bar'), card = bar && bar.closest('.session'), redo = card && [...card.querySelectorAll('button')].find((b) => /Redo/.test(b.textContent));
      const out = [];
      if (!card) return [{ kind: 'review-bar-not-in-card' }];
      if (document.querySelector('#reviewBar')) out.push({ kind: 'old-review-bar-under-video' });
      const b = bar.getBoundingClientRect(), c = card.getBoundingClientRect(), r = redo && redo.getBoundingClientRect();
      if (b.left < c.left - 1 || b.right > c.right + 1) out.push({ kind: 'review-bar-sticks-out', detail: `${Math.round(b.left - c.left)} / ${Math.round(c.right - b.right)}px` });
      if (r && r.top < b.bottom - 1) out.push({ kind: 'review-bar-overlaps-buttons' });
      for (const el of bar.querySelectorAll('button, .rev-note')) { const q = el.getBoundingClientRect(); if (q.right > b.right + 1) out.push({ kind: 'review-control-cut-off', detail: (el.textContent || '').trim().slice(0, 20) }); }
      return out;
    }) },
  { name: 'Setup wizard, first run', empty: true, run: async () => {}, allow: [] },
  { name: 'Ask Euno, empty', run: go('#ask') },
  { name: 'Ask Euno, one line typed', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', 'How do I pronounce the r in there?'); } },
  { name: 'Ask Euno, a long question', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', longText); await p.dispatchEvent('.ask-form textarea', 'input'); } },
  { name: 'Ask Euno, typed then cleared', run: async (p) => { await go('#ask')(p); await p.fill('.ask-form textarea', longText); await p.dispatchEvent('.ask-form textarea', 'input'); await p.fill('.ask-form textarea', ''); await p.dispatchEvent('.ask-form textarea', 'input'); } },
  // the public site (no sign-in)
  ...[['Site home', '/'], ['Site home, French', '/fr/'], ['Site guide page', '/what-is-shadowing/'], ['Site contact form', '/contact/']].map(([name, path]) => ({ name, path, ready: 'main, h1', run: async () => {}, themes: ['light', 'dark'] })),
];
