/* ---------- Ask Euno: a short chat about your own practice ----------
   The one place Euno talks, and only when asked. Answers come from the learner's own AI key (server/ai.js chatReply);
   the conversation is kept in their data (meta/askEuno), so it follows them to every device like the rest. */
const ASK_KEEP = 60; // messages kept
const Ask = { busy: false, error: null };

function askDoc() { return Store.get('meta', 'askEuno') || { id: 'askEuno', messages: [] }; }
function askSave(messages) { Store.put('meta', { ...askDoc(), id: 'askEuno', messages: messages.slice(-ASK_KEEP) }); }

/* what Euno knows about your practice, worked out on this device (never translated: the prompt is English) */
function askContext() {
  const out = [];
  const info = streakInfo();
  out.push(`Streak: ${info.streak} day(s); ${info.weekCount} of ${settings().weeklyTarget} practice days this week; ${info.minutes} minutes in total.`);
  const issues = Store.all('issues').filter((i) => !i.mergedInto && i.status !== 'fixed').slice(0, 6);
  for (const i of issues) out.push(`Open issue the learner tracks: "${i.name}" (${(i.noteIds || []).length} note(s)).`);
  const notes = Store.all('notes').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  for (const n of notes) out.push(`Recent note (${n.date}): what sounded off: "${String(n.off || '').slice(0, 160)}"${n.aim ? `; aiming for: "${String(n.aim).slice(0, 80)}"` : ''}.`);
  if (Pron.on()) for (const r of Pron.seenAcross().slice(0, 3)) out.push(`Phones: the sound recogniser flagged ${Pron.pairName(r.pair)} on ${r.e.days.length} day(s), in ${r.flagged} of ${r.occurred} places where the speaker has that sound.`);
  try { for (const r of ProsodyLog.summary().filter((x) => x.T.recent.o >= 3).slice(0, 3)) out.push(`Timing/pitch: "${PROSODY_PLAIN[r.kind]}" in ${r.T.recent.f} of ${r.T.recent.o} recent recorded passes.`); } catch { /* optional */ }
  const clip = Store.get('clips', UI.clipId);
  if (clip) {
    const v = Store.get('videos', clip.videoId);
    out.push(`Clip they're on: "${clipName(clip)}"${v && v.speaker ? ` spoken by ${v.speaker}` : ''}, ${round(clip.end - clip.start, 1)} s${clip.sentence ? `, sentence: "${String(clip.sentence).slice(0, 200)}"` : ''}.`);
  }
  return out;
}

const ASK_STARTS = [
  N_('What should I focus on this week?'),
  N_('How do I make the “th” sound?'),
  N_('Why does shadowing help with an accent?'),
];

async function askSend(text) {
  text = String(text || '').trim();
  if (!text || Ask.busy) return;
  Ask.error = null;
  const msgs = [...askDoc().messages, { role: 'user', text, at: new Date().toISOString() }];
  askSave(msgs);
  Ask.busy = true;
  if (UI.askOpen) openAsk();
  try {
    const r = await Api.req('POST', '/api/ai/chat', { messages: msgs.map((m) => ({ role: m.role, text: m.text })), context: askContext(), profile: profileForAI() });
    askSave([...askDoc().messages, { role: 'assistant', text: r.text, at: new Date().toISOString() }]);
  } catch (e) {
    Ask.error = t('Euno couldn’t answer: {error}', { error: e.message || 'error' });
  }
  Ask.busy = false;
  if (UI.askOpen) openAsk();
}

/* Ask Euno opens as a panel over whatever is on screen, so nothing underneath is lost; the X (or Escape) closes it
   and you are exactly where you were. The messages scroll; the box to type in stays at the bottom. */
function openAsk() {
  const msgs = askDoc().messages;
  const canAsk = Store.mode === 'cloud' && !!Api.ai;
  let root = $('#askPanel');
  if (!root) {
    root = h('div', { id: 'askPanel', class: 'askp-wrap', hidden: true },
      h('div', { class: 'askp-back', onclick: () => closeAsk() }),
      h('aside', { class: 'askp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'askTitle' }));
    document.body.appendChild(root);
  }
  const wasOpen = UI.askOpen;
  UI.askOpen = true;
  closeMenu();
  const log = h('div', { class: 'ask-log', 'aria-live': 'polite' },
    msgs.map((m) => (m.role === 'user'
      ? h('div', { class: 'msg you' }, m.text)
      : h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says' }, m.text)))),
    Ask.busy ? h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says muted' }, t('Thinking…'))) : null,
    Ask.error ? h('p', { class: 'formerr' }, Ask.error) : null,
    canAsk && !msgs.length ? h('div', { class: 'ask-starts' }, ASK_STARTS.map((q) => h('button', { type: 'button', class: 'chip', onclick: () => askSend(t(q)) }, t(q)))) : null);
  const box = h('textarea', { id: 'askBox', rows: 1, placeholder: t('Ask Euno about a sound, your notes or your practice'), 'aria-label': t('Your question'),
    oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(200, e.target.scrollHeight) + 'px'; },
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askSend(box.value); } } });
  const head = h('div', { class: 'askp-head' }, Euno.el('ask', Ask.busy ? 'pondering' : msgs.length ? 'listening' : 'waiting'),
    h('div', { class: 'grow' }, h('h2', { id: 'askTitle' }, t('Ask Euno')),
      h('p', { class: 'small muted' }, t('Euno knows your notes, your issues and what the computer flagged lately. He hasn’t heard your voice, so he can be wrong.'))),
    btn('', () => closeAsk(), { icon: 'close', kind: 'ghost', size: 'sm', title: t('Close'), aria: t('Close') }));
  const body = canAsk
    ? h('div', { class: 'askp-body' }, log)
    : h('div', { class: 'askp-body' }, h('div', { class: 'tintcard' },
      h('h3', null, Store.mode === 'cloud' ? t('Euno answers with your own AI key') : t('Ask Euno needs an account')),
      h('p', null, Store.mode === 'cloud'
        ? t('Add a key from Anthropic, OpenAI or OpenRouter in Settings → Connections. It’s stored encrypted and only used when you ask.')
        : t('Sign in to the web app to ask questions here.')),
      Store.mode === 'cloud' ? btn(t('Open Connections'), () => { closeAsk(); openSettings('connections'); }, { kind: 'primary', cls: 'self-start' }) : null));
  const foot = canAsk ? h('div', { class: 'askp-foot' },
    h('form', { class: 'ask-form', onsubmit: (e) => { e.preventDefault(); askSend(box.value); } }, box, btn('', null, { kind: 'primary', icon: 'arrow-up', title: t('Send'), aria: t('Send'), cls: 'send', disabled: Ask.busy })),
    msgs.length && !Ask.busy ? h('div', { class: 'row' }, h('span', { class: 'small muted grow' }, t('Kept with your practice data, on every device.')),
      btn(t('Clear the conversation'), () => { askSave([]); Ask.error = null; openAsk(); }, { size: 'sm', kind: 'ghost' })) : null) : null;
  const panel = root.querySelector('.askp');
  const keep = panel.querySelector('#askBox');
  const draft = keep ? keep.value : '';
  mount(panel, head, body, foot);
  if (draft && !Ask.busy) box.value = draft;
  root.hidden = false;
  document.body.classList.add('ask-open');
  if (!wasOpen) { Ask.returnFocus = document.activeElement; }
  const sendBtn = panel.querySelector('.ask-form .send');
  if (sendBtn) sendBtn.type = 'submit';
  if (canAsk && !Ask.busy) setTimeout(() => box.focus(), 50);
  const scroller = panel.querySelector('.askp-body');
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
function closeAsk() {
  const root = $('#askPanel');
  if (!root || !UI.askOpen) return;
  UI.askOpen = false;
  root.hidden = true;
  document.body.classList.remove('ask-open');
  Euno.drop('ask');
  if (location.hash === '#ask') history.replaceState(null, '', `#${UI.tab}`);
  const f = Ask.returnFocus;
  Ask.returnFocus = null;
  if (f && f.isConnected && f.focus) f.focus();
}
