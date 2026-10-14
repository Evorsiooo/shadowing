/* ---------- "what sounded off" notes, AI feedback, issues ---------- */
const noteDrafts = new Map();

function noteForm(ctx) {
  const key = ctx.recId || `${ctx.sessionId}:${ctx.pass}`;
  const clip = Store.get('clips', ctx.clipId);
  if (!noteDrafts.has(key)) noteDrafts.set(key, { sentence: clip.sentence || clip.label || '', off: '', aim: '', issue: '', reply: null, saved: null, open: false });
  const D = noteDrafts.get(key);
  const replyBox = h('div');
  const status = h('div', { role: 'status', class: 'small' });
  const issueNames = Store.all('issues').filter((i) => !i.mergedInto).map((i) => i.name);
  const drawReply = () => mount(replyBox, D.reply ? replyView(D.reply) : null);

  const ask = async (askBtn) => {
    if (!D.off.trim()) { mount(status, h('span', { class: 'formerr' }, 'Write what sounded off first.')); return; }
    if (Store.mode === 'cloud') {
      if (!Api.ai) { openCopyPrompt(D, issueNames, drawReply); return; }
      askBtn.disabled = true;
      mount(status, h('span', { class: 'muted' }, 'Thinking…'));
      try {
        const { reply } = await Api.req('POST', '/api/ai/feedback', { sentence: D.sentence, off: D.off, aim: D.aim, issues: issueNames, profile: profileForAI() });
        D.reply = normaliseReply(reply);
        if (D.reply.issue && !D.issue) { D.issue = D.reply.issue; const inp = $(`#issue-${key}`); if (inp) inp.value = D.issue; }
        status.replaceChildren();
        drawReply();
        if (D.saved) saveNote(ctx, D, true);
      } catch (e) {
        mount(status, h('span', { class: 'formerr' }, e.message), ' ', btn('Copy prompt instead', () => openCopyPrompt(D, issueNames, drawReply), { size: 'sm', kind: 'ghost' }));
      } finally { askBtn.disabled = false; }
      return;
    }
    if (!Caps.sample) { openCopyPrompt(D, issueNames, () => { drawReply(); }); return; }
    askBtn.disabled = true;
    mount(status, h('span', { class: 'muted' }, 'Thinking… (this uses your Claude plan)'));
    try {
      const r = await Caps.sample.json(claudePrompt(D, issueNames), { cache: false });
      D.reply = normaliseReply(r);
      if (D.reply.issue && !D.issue) { D.issue = D.reply.issue; const inp = $(`#issue-${key}`); if (inp) inp.value = D.issue; }
      status.replaceChildren();
      drawReply();
      if (D.saved) saveNote(ctx, D, true);
    } catch (e) {
      const code = e && e.code;
      const msg = code === 'not_granted' || code === 'sampling_disabled' ? 'Claude isn’t allowed for this page. Use “Copy prompt” and paste the reply instead.'
        : code === 'rate_limited' ? 'Claude is busy or your usage limit was reached. Try again in a little while.'
        : code === 'invalid_json' && e.text ? null
        : `Claude didn’t answer (${code || 'error'}).`;
      if (code === 'invalid_json' && e.text) { D.reply = { text: e.text }; drawReply(); status.replaceChildren(); }
      else mount(status, h('span', { class: 'formerr' }, msg));
    } finally { askBtn.disabled = false; }
  };

  const askLabel = Store.mode === 'cloud' ? (Api.ai ? 'Ask AI' : 'Copy prompt for AI') : Caps.sample ? 'Ask Claude' : 'Copy prompt for Claude';
  const askBtn = btn(askLabel, () => ask(askBtn), { kind: 'blue', size: 'sm', icon: 'sparkle' });
  const body = h('div', { class: 'stack' },
    h('label', { class: 'field', for: `off-${key}` }, 'What sounded off?',
      h('textarea', { id: `off-${key}`, rows: 2, placeholder: langContent().examples.off, value: D.off, oninput: (e) => { D.off = e.target.value; } })),
    h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' } },
      h('label', { class: 'field', for: `sent-${key}` }, 'Sentence (optional)',
        h('input', { type: 'text', id: `sent-${key}`, value: D.sentence, placeholder: 'What the speaker says', oninput: (e) => { D.sentence = e.target.value; } })),
      h('label', { class: 'field', for: `aim-${key}` }, 'Aiming for (optional)',
        h('input', { type: 'text', id: `aim-${key}`, value: D.aim, placeholder: langContent().examples.aim, oninput: (e) => { D.aim = e.target.value; } })),
      h('label', { class: 'field', for: `issue-${key}` }, 'Recurring issue (optional)',
        h('input', { type: 'text', id: `issue-${key}`, value: D.issue, list: `issues-${key}`, placeholder: 'Pick or name one', oninput: (e) => { D.issue = e.target.value; } }),
        h('datalist', { id: `issues-${key}` }, issueNames.map((n) => h('option', { value: n }))))),
    h('div', { class: 'row' },
      btn(D.saved ? 'Update note' : 'Save note', () => { saveNote(ctx, D); mount(status, h('span', { class: 'formok' }, 'Note saved.')); }, { size: 'sm', kind: 'primary', icon: 'note' }),
      askBtn),
    status, replyBox);
  drawReply();
  return h('details', { class: 'card', open: D.open, ontoggle: (e) => { D.open = e.target.open; } },
    h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, D.saved ? 'Note saved · edit' : 'What sounded off? Add a note'),
    body);
}

function normaliseReply(r) {
  if (!r || typeof r !== 'object') return { text: String(r || '') };
  if (r.text && !r.feature && !r.change) return { text: String(r.text) };
  return {
    feature: String(r.feature || ''), change: String(r.change || ''), listenFor: String(r.listenFor || r.listen_for || ''),
    issue: r.issue ? String(r.issue).slice(0, 60) : '', unsure: !!r.unsure, question: r.question ? String(r.question) : '',
  };
}

function replyView(r) {
  if (r.text) return h('div', { class: 'reply' }, h('h4', null, 'Feedback'), h('p', { style: { whiteSpace: 'pre-wrap' } }, r.text));
  if (r.unsure) return h('div', { class: 'reply' }, h('h4', null, 'Not sure what you meant'), h('p', null, r.question || 'I don’t know what you meant. Can you describe it differently?'));
  return h('div', { class: 'reply' },
    r.feature ? [h('h4', null, 'Likely feature'), h('p', null, r.feature)] : null,
    r.change ? [h('h4', null, 'What to change'), h('p', null, r.change)] : null,
    r.listenFor ? [h('h4', null, 'Listen for this in the clip'), h('p', null, r.listenFor)] : null,
    r.issue ? h('p', { class: 'small muted' }, 'Suggested issue: ', h('span', { class: 'issue-pill' }, r.issue)) : null);
}

/* who the learner is, from their profile (the server builds the same text in server/ai.js) */
function learnerLine(P) {
  const native = P.nativeLanguages ? `Their native language: ${P.nativeLanguages}.` : '';
  return `The learner is moving their ${P.targetLanguage} accent towards ${P.accent}. ${native}${P.notes ? ` About them: ${P.notes}` : ''}`.trim();
}
function spellingLine(P) {
  return P.spelling ? `Answer in ${P.spelling} spelling, plainly` : 'Answer plainly';
}

function claudePrompt(D, issueNames) {
  const P = profileForAI();
  return `You are helping a learner with shadowing practice: they repeat a model speaker's clip to pick up the accent, rhythm and melody. ${learnerLine(P)}

${spellingLine(P)}, with no linguistics jargon: if you need to name a sound, describe it with everyday ${P.targetLanguage} example words. If their description is too ambiguous to work out, do not guess: set "unsure" to true and ask what they meant.

Sentence being practised: ${D.sentence.trim() || '(not given)'}
What sounded off: ${D.off.trim()}
What they were aiming for: ${D.aim.trim() || '(not given)'}
Issue names they already track: ${issueNames.length ? issueNames.join('; ') : '(none yet)'}

Reply with only a JSON object, no other text:
{"feature": "the likely ${P.accent} feature behind this, 1-2 sentences", "change": "what to change in their speech, 1-3 sentences", "listenFor": "what to listen for in the model clip, 1-2 sentences", "issue": "a short name (max 5 words) for this as a recurring problem; reuse one of their existing issue names if it fits", "unsure": false, "question": ""}
If unsure, use {"unsure": true, "question": "I don't know ... what did you mean by ...?", "feature": "", "change": "", "listenFor": "", "issue": ""}.`;
}

function claudePromptPlain(D) {
  const P = profileForAI();
  const native = P.nativeLanguages ? ` My native language is ${P.nativeLanguages}.` : '';
  return `I'm doing shadowing practice to move my ${P.targetLanguage} accent towards ${P.accent}.${native}${P.notes ? ` ${P.notes}` : ''} Please ${P.spelling ? `answer in ${P.spelling} spelling, ` : ''}plainly, no jargon. If my description is too ambiguous, say "I don't know" and ask what I meant.

Sentence: ${D.sentence.trim() || '(not given)'}
What sounded off: ${D.off.trim()}
What I was aiming for: ${D.aim.trim() || '(not given)'}

Tell me: 1) the likely ${P.accent} feature, 2) what to change, 3) what to listen for in the model clip.`;
}

function openCopyPrompt(D, issueNames, onDone) {
  const text = claudePromptPlain(D);
  const ta = h('textarea', { rows: 8, readonly: true, value: text, id: 'promptText' });
  const reply = h('textarea', { rows: 6, id: 'replyPaste', placeholder: 'Paste the reply here' });
  openModal([
    modalHead('Ask an AI', `Copy the prompt into any AI chat (Claude, ChatGPT, Gemini…), then paste the reply back here so it’s saved with the note.${Store.mode === 'cloud' ? ' To get answers right here instead, add your own API key in Settings → AI.' : ''}`),
    ta,
    h('div', { class: 'row' }, btn('Copy prompt', async () => {
      try { await navigator.clipboard.writeText(text); toast('Prompt copied.'); } catch { ta.select(); toast('Select-all done; press Ctrl+C to copy.'); }
    }, { kind: 'primary', icon: 'note' })),
    h('label', { class: 'field', for: 'replyPaste' }, 'The reply', reply),
    h('div', { class: 'row' }, btn('Save reply', () => { if (reply.value.trim()) { D.reply = { text: reply.value.trim() }; onDone(); } closeModal(); }, { kind: 'primary' })),
  ]);
}

function saveNote(ctx, D, quiet) {
  const clip = Store.get('clips', ctx.clipId);
  if (D.sentence.trim() && clip && clip.sentence !== D.sentence.trim()) Store.patch('clips', clip.id, { sentence: D.sentence.trim() });
  const fields = {
    clipId: ctx.clipId, sessionId: ctx.sessionId, recId: ctx.recId || null, pass: ctx.pass, step: ctx.step,
    sentence: D.sentence.trim(), off: D.off.trim(), aim: D.aim.trim(), reply: D.reply || null, date: dayKey(),
  };
  if (!fields.off && !quiet) { toast('Write what sounded off first.'); return; }
  const note = D.saved ? Store.patch('notes', D.saved, fields) : Store.put('notes', { ...fields, created: new Date().toISOString() });
  D.saved = note.id;
  if (D.issue.trim()) linkIssue(note, D.issue.trim());
}

function linkIssue(note, name) {
  const all = Store.all('issues');
  let iss = all.find((i) => i.name.toLowerCase() === name.toLowerCase());
  while (iss && iss.mergedInto) iss = Store.get('issues', iss.mergedInto);
  // remove from any other issue first
  for (const i of all) if (i.noteIds && i.noteIds.includes(note.id) && (!iss || i.id !== iss.id)) Store.patch('issues', i.id, { noteIds: i.noteIds.filter((x) => x !== note.id) });
  if (!iss) iss = Store.put('issues', { name, noteIds: [], status: 'open', created: dayKey() });
  if (!iss.noteIds.includes(note.id)) Store.patch('issues', iss.id, { noteIds: [...iss.noteIds, note.id], lastSeen: dayKey(), status: iss.status === 'fixed' ? 'open' : iss.status });
  Store.patch('notes', note.id, { issueId: iss.id });
}

/* ---------- issues list ---------- */
function issuesView() {
  const wrap = h('div', { class: 'stack' });
  const draw = () => {
    const list = Store.all('issues').filter((i) => !i.mergedInto);
    const since = addDays(dayKey(), -14);
    const rows = list.map((i) => {
      const notes = (i.noteIds || []).map((id) => Store.get('notes', id)).filter(Boolean);
      const recent = notes.filter((n) => n.date >= since).length;
      const days = new Set(notes.map((n) => n.date)).size;
      return { i, notes, recent, days };
    }).sort((a, b) => (a.i.status === 'fixed') - (b.i.status === 'fixed') || b.recent - a.recent || b.notes.length - a.notes.length);
    mount(wrap,
      h('p', { class: 'muted' }, 'Problems pulled from your notes. Ones that keep coming back over several days are the ones to target in step 4.'),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Issue'), h('th', null, 'Notes'), h('th', null, 'Last 14 days'), h('th', null, 'Days seen'), h('th', null, ''))),
        h('tbody', null, rows.map(({ i, notes, recent, days }) => h('tr', null,
          h('td', null, h('input', { type: 'checkbox', checked: i.status === 'fixed', 'aria-label': `Mark ${i.name} as sorted`, title: 'Tick when it no longer comes back', onchange: (e) => { Store.patch('issues', i.id, { status: e.target.checked ? 'fixed' : 'open' }); draw(); } })),
          h('td', null, h('strong', { style: { textDecoration: i.status === 'fixed' ? 'line-through' : 'none' } }, i.name),
            recent >= 2 && days >= 2 && i.status !== 'fixed' ? h('div', null, h('span', { class: 'issue-pill' }, 'target this next')) : null),
          h('td', { class: 'num' }, notes.length),
          h('td', { class: 'num' }, recent),
          h('td', { class: 'num' }, days),
          h('td', null, h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
            btn('Notes', () => openIssueNotes(i), { size: 'sm', kind: 'ghost' }),
            btn('Rename', () => renameIssue(i, draw), { size: 'sm', kind: 'ghost' }),
            rows.length > 1 ? btn('Merge', () => mergeIssue(i, draw), { size: 'sm', kind: 'ghost' }) : null))))))) : h('p', { class: 'muted' }, 'No issues yet. They appear when you add notes after recorded passes.'));
  };
  draw();
  return wrap;
}

function renameIssue(i, after) {
  const inp = h('input', { type: 'text', id: 'renameIssue', value: i.name, autofocus: true });
  openModal([modalHead('Rename issue'), inp, h('div', { class: 'row' }, btn('Save', () => { const v = inp.value.trim(); if (v) Store.patch('issues', i.id, { name: v }); closeModal(); openProgress('issues'); }, { kind: 'primary' }))], { narrow: true });
}
function mergeIssue(i, after) {
  const others = Store.all('issues').filter((x) => !x.mergedInto && x.id !== i.id);
  const sel = h('select', { id: 'mergeTarget' }, others.map((o) => h('option', { value: o.id }, o.name)));
  openModal([modalHead(`Merge “${i.name}” into…`), sel, h('div', { class: 'row' }, btn('Merge', () => {
    const target = Store.get('issues', sel.value);
    if (!target) return;
    const ids = [...new Set([...(target.noteIds || []), ...(i.noteIds || [])])];
    Store.patch('issues', target.id, { noteIds: ids, lastSeen: [target.lastSeen, i.lastSeen].filter(Boolean).sort().pop() });
    Store.patch('issues', i.id, { mergedInto: target.id, noteIds: [] });
    for (const id of i.noteIds || []) Store.patch('notes', id, { issueId: target.id });
    closeModal(); openProgress('issues');
  }, { kind: 'primary' }))], { narrow: true });
}
function openIssueNotes(i) {
  const notes = (i.noteIds || []).map((id) => Store.get('notes', id)).filter(Boolean).sort((a, b) => (a.created < b.created ? 1 : -1));
  openModal([modalHead(i.name, `${notes.length} note${notes.length === 1 ? '' : 's'}`), notes.map(noteCard), btn('Back to issues', () => openProgress('issues'), { kind: 'ghost' })]);
}
function noteCard(n) {
  const c = Store.get('clips', n.clipId);
  return h('div', { class: 'card' },
    h('div', { class: 'row small muted' }, h('span', null, fmtDay(n.date)), c ? h('span', null, `· ${clipName(c)}`) : null),
    n.sentence ? h('p', null, h('em', null, `“${n.sentence}”`)) : null,
    h('p', null, h('strong', null, 'Sounded off: '), n.off),
    n.aim ? h('p', null, h('strong', null, 'Aiming for: '), n.aim) : null,
    n.reply ? replyView(n.reply) : null);
}

/* ---------- compare & history ---------- */
/* one chart with several voices overlaid on the clip's time axis (pitch or loudness) */
function overlayChart(clip, layers, view = 'pitch') {
  const c = h('canvas', { style: { height: '220px', width: '100%', display: 'block', borderRadius: '11px', background: 'var(--surface-2)' }, 'aria-label': `${view === 'pitch' ? 'Pitch' : 'Loudness'} of ${layers.map((l) => l.label).join(', ')} on one chart` });
  const draw = () => {
    if (!c.isConnected) return;
    const { W, H, dpr } = sizeCanvas(c);
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const dur = clip.end - clip.start;
    const X = (t) => (t / dur) * W;
    g.fillStyle = cssVar('--line');
    g.fillRect(0, H / 2, W, dpr);
    for (let s = 1; s < dur; s++) g.fillRect(X(s), 0, dpr, H);
    if (view === 'pitch') pitchHints(g, W, dpr, [{ top: 0, h: H }], cssVar('--muted'));
    for (const L of layers) {
      const sr = L.series;
      if (!sr || L.hidden) continue;
      g.globalAlpha = L.alpha ?? 1;
      if (view === 'pitch') {
        g.strokeStyle = L.color; g.lineWidth = (L.width || 2.5) * dpr; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
        let pen = false, prev = null;
        sr.st.forEach((v, i) => {
          const t = (sr.offset || 0) + i * sr.hop;
          if (v == null || t < 0 || t > dur || Math.abs(v) > 12) { pen = false; prev = null; return; }
          if (prev != null && Math.abs(v - prev) > 4) pen = false;
          prev = v;
          const y = H / 2 - (v / 12) * (H / 2 - 6 * dpr);
          if (!pen) { g.moveTo(X(t), y); pen = true; } else g.lineTo(X(t), y);
        });
        g.stroke();
      } else {
        const db = sr.db || [];
        const peak = percentile(db.filter((v) => v != null), 0.98);
        g.fillStyle = L.color;
        g.globalAlpha = (L.alpha ?? 1) * 0.45;
        const bw = Math.max(1, X(sr.hop) - 0.5);
        db.forEach((v, i) => {
          const t = (sr.offset || 0) + i * sr.hop;
          if (v == null || t < 0 || t > dur) return;
          const hh = clamp((v - (peak - 45)) / 45, 0, 1) * (H / 2 - 4 * dpr);
          g.fillRect(X(t), H / 2 - hh, bw, hh * 2);
        });
      }
      g.globalAlpha = 1;
    }
  };
  c.redraw = draw;
  requestAnimationFrame(() => requestAnimationFrame(draw));
  return c;
}

async function recAudio(rec, fallbackUrl) {
  const url = fallbackUrl || (rec && (await Store.blobUrl(rec.ref)));
  return url ? h('audio', { controls: true, preload: 'metadata', src: url }) : h('p', { class: 'small muted' }, 'Recording not available.');
}

async function openCompare(idA, idB, urlB) {
  const A = Store.get('recordings', idA), B = Store.get('recordings', idB);
  const clip = Store.get('clips', (A || B || {}).clipId || Session.clipId);
  if (!clip) return;
  const css = (v) => cssVar(v);
  const layers = [
    { key: 'speaker', label: 'Speaker', color: css('--green'), width: 5, alpha: 0.55, series: clip.model ? { st: clip.model.st, db: clip.model.db, hop: clip.model.hop, offset: 0 } : null },
    { key: 'step3', label: 'Step 3', color: css('--ochre'), width: 2.5, series: A && A.analysis, rec: A },
    { key: 'final', label: 'Final', color: css('--sky'), width: 3, series: B && B.analysis, rec: B, url: urlB },
  ];
  let view = 'pitch';
  const holder = h('div');
  const drawChart = () => mount(holder, overlayChart(clip, layers, view));
  const legend = h('div', { class: 'row' }, layers.map((L) => h('label', { class: 'check', for: `cmp-${L.key}` },
    h('input', { type: 'checkbox', id: `cmp-${L.key}`, checked: !L.hidden, disabled: !L.series, onchange: (e) => { L.hidden = !e.target.checked; drawChart(); } }),
    h('span', { style: { display: 'inline-block', width: '14px', height: '4px', borderRadius: '2px', background: L.color } }), L.label)));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'View' },
    ['pitch', 'wave'].map((v) => h('button', { type: 'button', class: v === view ? 'on' : '', onclick: (e) => { view = v; [...seg.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); drawChart(); } }, v === 'pitch' ? 'Pitch' : 'Waveform')));
  const players = await Promise.all(layers.slice(1).map(async (L) => h('div', { class: 'audio-row' },
    h('span', { style: { display: 'inline-block', width: '14px', height: '4px', borderRadius: '2px', background: L.color } }),
    h('strong', { class: 'small', style: { minWidth: '56px' } }, L.label),
    await recAudio(L.rec, L.url),
    h('span', { class: 'small muted' }, L.rec ? fmtLag(L.rec.lag) : ''))));
  drawChart();
  openModal([
    modalHead('Step 3 vs final pass', clipName(clip)),
    h('div', { class: 'row' }, seg, h('span', { class: 'spacer' }), legend),
    holder,
    h('div', { class: 'stack' }, players),
    h('p', { class: 'small muted' }, 'Each line is shown against that voice’s own average pitch. A final line that follows the speaker’s shape more closely than step 3, or a smaller lag, is progress.'),
  ]);
}

/* delete button with an in-place confirm */
function deleteSessionButton(sessionId, after) {
  const wrap = h('span', { class: 'row' });
  const normal = () => mount(wrap, btn('Delete session', () => ask(), { size: 'sm', kind: 'ghost' }));
  const ask = () => mount(wrap,
    h('span', { class: 'small', style: { fontWeight: 800 } }, 'Delete this session, its recordings and notes?'),
    btn('Delete', async () => { await deleteSession(sessionId); after && after(); }, { size: 'sm', kind: 'danger' }),
    btn('Keep it', normal, { size: 'sm', kind: 'ghost' }));
  normal();
  return wrap;
}

async function deleteSession(sessionId) {
  const sess = Store.get('sessions', sessionId);
  if (!sess) return;
  const drop = (col, id) => { delete Store.data[col][id]; Store.schedule(col, id, 0); };
  for (const r of Store.all('recordings').filter((x) => x.sessionId === sessionId)) {
    await Store.deleteBlob(r.ref);
    drop('recordings', r.id);
  }
  const noteIds = new Set(Store.all('notes').filter((n) => n.sessionId === sessionId).map((n) => n.id));
  for (const id of noteIds) drop('notes', id);
  for (const i of Store.all('issues')) {
    if ((i.noteIds || []).some((id) => noteIds.has(id))) Store.patch('issues', i.id, { noteIds: i.noteIds.filter((id) => !noteIds.has(id)) });
  }
  drop('sessions', sessionId);
  // the clip keeps its tick only if another complete full session remains
  const clip = Store.get('clips', sess.clipId);
  if (clip) {
    const rest = Store.all('sessions').filter((x) => x.clipId === clip.id && !x.empty);
    const stillDone = rest.some((x) => x.complete && x.mode === 'full');
    const last = rest.map((x) => x.date).sort().pop() || null;
    if (clip.done && !stillDone && sess.complete && sess.mode === 'full') Store.patch('clips', clip.id, { done: false, doneAt: null, lastPractised: last });
    else Store.patch('clips', clip.id, { lastPractised: last });
  }
  toast('Session deleted.');
  renderAll();
}

async function openHistory(clipId) {
  const clip = Store.get('clips', clipId);
  if (!clip) return;
  const sessions = Store.all('sessions').filter((s) => s.clipId === clipId && !s.empty).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const recs = Store.all('recordings').filter((r) => r.clipId === clipId);
  const notes = Store.all('notes').filter((n) => n.clipId === clipId);
  const items = await Promise.all(sessions.map(async (s) => {
    const rs = recs.filter((r) => r.sessionId === s.id).sort((a, b) => a.pass - b.pass);
    const lags = s.passes.map((p) => p.lag).filter((v) => v != null);
    const ns = notes.filter((n) => n.sessionId === s.id);
    return h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('strong', { class: 'grow' }, fmtDayLong(s.date)),
        h('span', { class: 'small muted' }, `${s.mode === 'badday' ? 'bad-day' : s.mode} · ${s.minutes} min · ${s.passes.length} passes${lags.length ? ` · avg ${fmtLag(mean(lags))}` : ''}`),
        s.complete ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : null),
      rs.length ? h('div', { class: 'stack' }, await Promise.all(rs.map(async (r) => h('div', { class: 'audio-row' },
        h('span', { class: 'small', style: { minWidth: '120px', fontWeight: 800 } }, r.slot === 'step3' ? 'Step 3' : r.slot === 'final' ? 'Final' : `Pass ${r.pass}`),
        await recAudio(r),
        h('span', { class: 'small muted' }, fmtLag(r.lag)))))) : null,
      h('div', { class: 'row' },
        s.recs && s.recs.step3 && s.recs.final ? btn('Compare step 3 and final', () => openCompare(s.recs.step3, s.recs.final), { size: 'sm', kind: 'blue' }) : null,
        h('span', { class: 'spacer' }),
        deleteSessionButton(s.id, () => openHistory(clipId))),
      ns.map(noteCard));
  }));
  openModal([
    modalHead(`History: ${clipName(clip)}`, `${sessions.length} session${sessions.length === 1 ? '' : 's'} · newest first`),
    items.length ? items : h('p', { class: 'muted' }, 'No sessions on this clip yet.'),
  ]);
}
