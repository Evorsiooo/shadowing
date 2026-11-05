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
  out.push(...askSessionContext());
  try { out.push(...saySummary()); } catch { /* optional */ }
  const clip = Store.get('clips', UI.clipId);
  if (clip) {
    const v = Store.get('videos', clip.videoId);
    out.push(`Clip open on their screen (mention only if relevant): "${clipName(clip)}"${v && v.speaker ? ` spoken by ${v.speaker}` : ''}, ${round(clip.end - clip.start, 1)} s${clip.sentence ? `, sentence: "${String(clip.sentence).slice(0, 200)}"` : ''}.`);
  }
  return out;
}

/* the practice session that is running right now: which step and pass, the pass that was just recorded and what it found,
   and the notes written during it. Like the rest, background only: Euno mentions it when the question is about it. */
function askSessionContext() {
  const S = typeof Session !== 'undefined' ? Session : null;
  if (!S || !S.active || !S.doc) return [];
  const out = [];
  try {
    const clip = S.clip(), st = S.step();
    if (!clip || !st) return out;
    const v = Store.get('videos', clip.videoId);
    const phase = { review: 'looking at the pass they just recorded', recording: 'recording a pass', paused: 'paused', gap: 'between passes', armed: 'about to record a pass', intro: 'about to start the step' }[S.phase] || 'listening or shadowing';
    out.push(`Practice session in progress now (${S.mode} session): step ${S.stepIdx + 1} of ${S.plan.length}, "${st.name}", pass ${Math.min(S.pass + 1, st.passes)} of ${st.passes}; they are ${phase}. Clip: "${clipName(clip)}"${v && v.speaker ? ` by ${v.speaker}` : ''}.`);
    const R = S.review;
    if (R && R.analysis && R.analysis.lag != null && !R.analysis.manual) out.push(`The pass they just recorded was ${round(R.analysis.lag, 2)} s behind the speaker (positive = behind).`);
    if (R) {
      for (const it of tryItems(clip, R).shown) {
        const x = tryText(it, clip);
        out.push(`Found in that pass (${it.type}, computer-detected, can be wrong): ${x.word}: ${x.text}`);
      }
    }
    for (const n of Store.all('notes').filter((n) => n.sessionId === S.doc.id)) out.push(`Note written in this session: "${String(n.off || '').slice(0, 160)}"${n.aim ? `; aiming for: "${String(n.aim).slice(0, 80)}"` : ''}.`);
  } catch { /* optional */ }
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
  // research notes that fit the question, matched on this device (src/js/86-knowledge.js)
  let notes = [];
  try { notes = Know.pick(msgs.filter((m) => m.role === 'user').slice(-2).map((m) => m.text)); } catch { /* optional */ }
  Ask.busy = true;
  if (UI.askOpen) openAsk();
  try {
    const r = await Api.req('POST', '/api/ai/chat', { messages: msgs.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, text: m.text })), context: askContext(), knowledge: notes.map((e) => Know.render(e)), profile: profileForAI() });
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
    msgs.map((m) => (m.role === 'say' ? sayRow(m) : m.role === 'user'
      ? h('div', { class: 'msg you' }, m.text)
      : h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says' }, m.text)))),
    Ask.busy ? h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says muted' }, t('Thinking…'))) : null,
    Ask.error ? h('p', { class: 'formerr' }, Ask.error) : null,
    sayLogExtras(),
    canAsk && !msgs.length ? h('div', { class: 'ask-starts' }, ASK_STARTS.map((q) => h('button', { type: 'button', class: 'chip', onclick: () => askSend(t(q)) }, t(q)))) : null);
  const box = h('textarea', { id: 'askBox', rows: 1, placeholder: t('Ask Euno about a sound, your notes or your practice'), 'aria-label': t('Your question'),
    oninput: (e) => askFit(e.target),
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
    sayLive(),
    h('form', { class: 'ask-form', onsubmit: (e) => { e.preventDefault(); askSend(box.value); } }, box, sayMic(), btn('', null, { kind: 'primary', icon: 'arrow-up', title: t('Send'), aria: t('Send'), cls: 'send', disabled: Ask.busy })),
    msgs.length && !Ask.busy ? h('div', { class: 'row' }, h('span', { class: 'small muted grow' }, t('Kept with your practice data, on every device.')),
      btn(t('Clear the conversation'), () => { askSave([]); Ask.error = null; openAsk(); }, { size: 'sm', kind: 'ghost' })) : null) : null;
  const panel = root.querySelector('.askp');
  const keep = panel.querySelector('#askBox');
  const draft = keep ? keep.value : '';
  mount(panel, head, body, foot);
  if (draft && !Ask.busy) box.value = draft;
  askFit(box);
  root.hidden = false;
  document.body.classList.add('ask-open');
  if (!wasOpen) { Ask.returnFocus = document.activeElement; }
  const sendBtn = panel.querySelector('.ask-form .send');
  if (sendBtn) sendBtn.type = 'submit';
  if (canAsk && !Ask.busy) setTimeout(() => box.focus(), 50);
  const scroller = panel.querySelector('.askp-body');
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
function askFit(el) {
  el.style.height = 'auto';
  const full = el.scrollHeight;
  el.style.height = Math.min(200, full) + 'px';
  el.style.overflowY = full > 200 ? 'auto' : 'hidden';
}
function closeAsk() {
  const root = $('#askPanel');
  if (!root || !UI.askOpen) return;
  sayCancel();
  UI.askOpen = false;
  root.hidden = true;
  document.body.classList.remove('ask-open');
  Euno.drop('ask');
  if (location.hash === '#ask') history.replaceState(null, '', `#${UI.tab}`);
  const f = Ask.returnFocus;
  Ask.returnFocus = null;
  if (f && f.isConnected && f.focus) f.focus();
}
