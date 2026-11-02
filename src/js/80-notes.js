/* ---------- "what sounded off" notes, AI feedback, issues ---------- */
const noteDrafts = new Map();

/* a recording can have several notes: the saved ones, then one more form to add another */
function noteForms(ctx) {
  const base = ctx.recId || `${ctx.sessionId}:${ctx.pass}`;
  const clip = Store.get('clips', ctx.clipId);
  if (!noteDrafts.has(base)) {
    const saved = ctx.recId ? Store.all('notes').filter((n) => n.recId === ctx.recId && !(n.auto && !n.confirmed)).sort((a, b) => ((a.created || '') < (b.created || '') ? -1 : 1)) : [];
    const list = saved.map((n) => ({ sentence: n.sentence || '', off: n.off || '', aim: n.aim || '', issue: (Store.get('issues', n.issueId) || {}).name || '', reply: n.reply || null, saved: n.id, open: false }));
    if (!list.length) list.push(blankNote(clip));
    noteDrafts.set(base, list);
  }
  const list = noteDrafts.get(base);
  const wrap = h('div', { class: 'stack' });
  const draw = () => {
    const last = list[list.length - 1];
    mount(wrap,
      list.map((D, i) => noteForm(ctx, D, `${base}-${i}`, list.length > 1 ? i + 1 : 0, draw)),
      last.saved ? btn(t('Add another note'), () => { list.push({ ...blankNote(clip), sentence: last.sentence, open: true }); draw(); }, { size: 'sm', kind: 'ghost', icon: 'note' }) : null);
  };
  draw();
  return wrap;
}
function blankNote(clip) {
  return { sentence: (clip && (clip.sentence || clip.label)) || '', off: '', aim: '', issue: '', reply: null, saved: null, open: false };
}

function noteForm(ctx, D, key, num, onSaved) {
  const replyBox = h('div');
  const status = h('div', { role: 'status', class: 'small' });
  const issueNames = Store.all('issues').filter((i) => !i.mergedInto).map((i) => i.name);
  const drawReply = () => mount(replyBox, D.reply ? replyView(D.reply) : null);

  const ask = async (askBtn) => {
    if (!D.off.trim()) { mount(status, h('span', { class: 'formerr' }, t('Write what sounded off first.'))); return; }
    if (Store.mode === 'cloud') {
      if (!Api.ai) { openCopyPrompt(D, issueNames, drawReply, ctx); return; }
      askBtn.disabled = true;
      mount(status, h('span', { class: 'muted' }, t('Thinking…')));
      try {
        const { reply } = await Api.req('POST', '/api/ai/feedback', { sentence: D.sentence, off: D.off, aim: D.aim, issues: issueNames, measured: measuredForNote(ctx), profile: profileForAI() });
        D.reply = normaliseReply(reply);
        if (D.reply.issue && !D.issue) { D.issue = D.reply.issue; const inp = $(`#issue-${key}`); if (inp) inp.value = D.issue; }
        status.replaceChildren();
        drawReply();
        if (D.saved) saveNote(ctx, D, true);
      } catch (e) {
        mount(status, h('span', { class: 'formerr' }, e.message), ' ', btn(t('Copy prompt instead'), () => openCopyPrompt(D, issueNames, drawReply, ctx), { size: 'sm', kind: 'ghost' }));
      } finally { askBtn.disabled = false; }
      return;
    }
    if (!Caps.sample) { openCopyPrompt(D, issueNames, () => { drawReply(); }, ctx); return; }
    askBtn.disabled = true;
    mount(status, h('span', { class: 'muted' }, t('Thinking… (this uses your Claude plan)')));
    try {
      const r = await Caps.sample.json(claudePrompt(D, issueNames, measuredForNote(ctx)), { cache: false });
      D.reply = normaliseReply(r);
      if (D.reply.issue && !D.issue) { D.issue = D.reply.issue; const inp = $(`#issue-${key}`); if (inp) inp.value = D.issue; }
      status.replaceChildren();
      drawReply();
      if (D.saved) saveNote(ctx, D, true);
    } catch (e) {
      const code = e && e.code;
      const msg = code === 'not_granted' || code === 'sampling_disabled' ? t('Claude isn’t allowed for this page. Use “Copy prompt” and paste the reply instead.')
        : code === 'rate_limited' ? t('Claude is busy or your usage limit was reached. Try again in a little while.')
        : code === 'invalid_json' && e.text ? null
        : t('Claude didn’t answer ({code}).', { code: code || 'error' });
      if (code === 'invalid_json' && e.text) { D.reply = { text: e.text }; drawReply(); status.replaceChildren(); }
      else mount(status, h('span', { class: 'formerr' }, msg));
    } finally { askBtn.disabled = false; }
  };

  const askLabel = Store.mode === 'cloud' ? (Api.ai ? t('Ask AI') : t('Copy prompt for AI')) : Caps.sample ? t('Ask Claude') : t('Copy prompt for Claude');
  const askBtn = btn(askLabel, () => ask(askBtn), { kind: 'blue', size: 'sm', icon: 'sparkle' });
  const body = h('div', { class: 'stack' },
    h('label', { class: 'field', for: `off-${key}` }, t('What sounded off?'),
      h('textarea', { id: `off-${key}`, rows: 2, placeholder: t(langContent().examples.off), value: D.off, oninput: (e) => { D.off = e.target.value; } })),
    h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' } },
      h('label', { class: 'field', for: `sent-${key}` }, t('Sentence (optional)'),
        h('input', { type: 'text', id: `sent-${key}`, value: D.sentence, placeholder: t('What the speaker says'), oninput: (e) => { D.sentence = e.target.value; } })),
      h('label', { class: 'field', for: `aim-${key}` }, t('Aiming for (optional)'),
        h('input', { type: 'text', id: `aim-${key}`, value: D.aim, placeholder: t(langContent().examples.aim), oninput: (e) => { D.aim = e.target.value; } })),
      h('label', { class: 'field', for: `issue-${key}` }, t('Recurring issue (optional)'),
        h('input', { type: 'text', id: `issue-${key}`, value: D.issue, list: `issues-${key}`, placeholder: t('Pick or name one'), oninput: (e) => { D.issue = e.target.value; } }),
        h('datalist', { id: `issues-${key}` }, issueNames.map((n) => h('option', { value: n }))))),
    h('div', { class: 'row' },
      btn(D.saved ? t('Update note') : t('Save note'), () => { saveNote(ctx, D); if (!D.saved) return; mount(status, h('span', { class: 'formok' }, t('Note saved.'))); onSaved(); }, { size: 'sm', kind: 'primary', icon: 'note' }),
      askBtn),
    status, replyBox);
  drawReply();
  const details = h('details', { class: 'card', open: D.open, ontoggle: (e) => { D.open = e.target.open; } },
    h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, D.saved ? t('Note saved · edit') : t('What sounded off? Add a note'), num ? ` (${num})` : ''),
    body);
  const sugg = D.saved ? null : pronSuggestions(ctx, D, key, details);
  return sugg ? h('div', { class: 'stack' }, sugg, details) : details;
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
  if (r.text) return h('div', { class: 'reply' }, h('h4', null, t('Feedback')), h('p', { style: { whiteSpace: 'pre-wrap' } }, r.text));
  if (r.unsure) return h('div', { class: 'reply' }, h('h4', null, t('Not sure what you meant')), h('p', null, r.question || t('I don’t know what you meant. Can you describe it differently?')));
  return h('div', { class: 'reply' },
    r.feature ? [h('h4', null, t('Likely feature')), h('p', null, r.feature)] : null,
    r.change ? [h('h4', null, t('What to change')), h('p', null, r.change)] : null,
    r.listenFor ? [h('h4', null, t('Listen for this in the clip')), h('p', null, r.listenFor)] : null,
    r.issue ? h('p', { class: 'small muted' }, t('Suggested issue: '), h('span', { class: 'issue-pill' }, r.issue)) : null);
}

/* who the learner is, from their profile (the server builds the same text in server/ai.js) */
function learnerLine(P) {
  const native = P.nativeLanguages ? `Their native language: ${P.nativeLanguages}.` : '';
  return `The learner is moving their ${P.targetLanguage} accent towards ${P.accent}. ${native}${P.notes ? ` About them: ${P.notes}` : ''}`.trim();
}
function spellingLine(P) {
  if (P.replyLanguage && P.replyLanguage !== 'English') return `Answer in ${P.replyLanguage}, plainly`;
  return P.spelling ? `Answer in ${P.spelling} spelling, plainly` : 'Answer plainly';
}

/* what was measured on the recording, for the prompt; empty when there's nothing */
const PHONES_CAVEAT = 'Lines starting "Phones" come from a phone recogniser that is only about 90% right per sound, so it can be wrong: say "may", never state a difference as fact. Compare the speaker\'s sounds with the learner\'s and describe what may differ in everyday example words.';
const HISTORY_NOTE = 'Lines starting "History" say how often the same difference came up over the last weeks (chances are places where the speaker has that sound). Use them to say whether it seems to be improving or recurring, gently and with "may"; if one says it went quiet, acknowledge the progress rather than re-diagnosing it.';
function measuredBlock(lines) {
  if (!lines || !lines.length) return '';
  const phones = lines.some((l) => l.startsWith('Phones'));
  return `\nMeasured on their recording by software (${phones ? 'the pitch, loudness and timing lines can\'t hear vowels or consonants' : 'pitch, loudness and timing only, so it can\'t hear vowels or consonants'}; speech recognition can also miss clear words). Treat it as evidence about the recording, not as the learner's opinion, and don't invent problems beyond it and their description:\n${lines.map((l) => `- ${l}`).join('\n')}\n${phones ? PHONES_CAVEAT + '\n' : ''}${lines.some((l) => l.startsWith('History')) ? HISTORY_NOTE + '\n' : ''}`;
}

function claudePrompt(D, issueNames, measured) {
  const P = profileForAI();
  return `You are helping a learner with shadowing practice: they repeat a model speaker's clip to pick up the accent, rhythm and melody. ${learnerLine(P)}

${spellingLine(P)}, with no linguistics jargon: if you need to name a sound, describe it with everyday ${P.targetLanguage} example words. If their description is too ambiguous to work out, do not guess: set "unsure" to true and ask what they meant.

Sentence being practised: ${D.sentence.trim() || '(not given)'}
What sounded off: ${D.off.trim()}
What they were aiming for: ${D.aim.trim() || '(not given)'}
Issue names they already track: ${issueNames.length ? issueNames.join('; ') : '(none yet)'}
${measuredBlock(measured)}
Reply with only a JSON object, no other text:
{"feature": "the likely ${P.accent} feature behind this, 1-2 sentences", "change": "what to change in their speech, 1-3 sentences", "listenFor": "what to listen for in the model clip, 1-2 sentences", "issue": "a short name (max 5 words) for this as a recurring problem; reuse one of their existing issue names if it fits", "unsure": false, "question": ""}
If unsure, use {"unsure": true, "question": "I don't know ... what did you mean by ...?", "feature": "", "change": "", "listenFor": "", "issue": ""}.`;
}

function claudePromptPlain(D, measured) {
  const P = profileForAI();
  const native = P.nativeLanguages ? ` My native language is ${P.nativeLanguages}.` : '';
  return `I'm doing shadowing practice to move my ${P.targetLanguage} accent towards ${P.accent}.${native}${P.notes ? ` ${P.notes}` : ''} Please answer ${P.replyLanguage && P.replyLanguage !== 'English' ? `in ${P.replyLanguage}, ` : P.spelling ? `in ${P.spelling} spelling, ` : ''}plainly, no jargon. If my description is too ambiguous, say "I don't know" and ask what I meant.

Sentence: ${D.sentence.trim() || '(not given)'}
What sounded off: ${D.off.trim()}
What I was aiming for: ${D.aim.trim() || '(not given)'}
${measuredBlock(measured)}
Tell me: 1) the likely ${P.accent} feature, 2) what to change, 3) what to listen for in the model clip.`;
}

function openCopyPrompt(D, issueNames, onDone, ctx) {
  const text = claudePromptPlain(D, ctx ? measuredForNote(ctx) : []);
  const ta = h('textarea', { rows: 8, readonly: true, value: text, id: 'promptText' });
  const reply = h('textarea', { rows: 6, id: 'replyPaste', placeholder: t('Paste the reply here') });
  openModal([
    modalHead(t('Ask an AI'), t('Copy the prompt into any AI chat (Claude, ChatGPT, Gemini…), then paste the reply back here so it’s saved with the note.') + (Store.mode === 'cloud' ? ' ' + t('To get answers right here instead, add your own API key in Settings → AI.') : '')),
    ta,
    h('div', { class: 'row' }, btn(t('Copy prompt'), async () => {
      try { await navigator.clipboard.writeText(text); toast(t('Prompt copied.')); } catch { ta.select(); toast(t('Select-all done; press Ctrl+C to copy.')); }
    }, { kind: 'primary', icon: 'note' })),
    h('label', { class: 'field', for: 'replyPaste' }, t('The reply'), reply),
    h('div', { class: 'row' }, btn(t('Save reply'), () => { if (reply.value.trim()) { D.reply = { text: reply.value.trim() }; onDone(); } closeModal(); }, { kind: 'primary' })),
  ]);
}

function saveNote(ctx, D, quiet) {
  const clip = Store.get('clips', ctx.clipId);
  if (D.sentence.trim() && clip && clip.sentence !== D.sentence.trim()) Store.patch('clips', clip.id, { sentence: D.sentence.trim() });
  const fields = {
    clipId: ctx.clipId, sessionId: ctx.sessionId, recId: ctx.recId || null, pass: ctx.pass, step: ctx.step,
    sentence: D.sentence.trim(), off: D.off.trim(), aim: D.aim.trim(), reply: D.reply || null, date: dayKey(),
  };
  const prev = D.saved && Store.get('notes', D.saved);
  if (prev && prev.auto && !quiet) fields.confirmed = true; // saving an automatic note is confirming it
  if (prev && prev.auto) { delete fields.date; delete fields.created; }
  if (!fields.off && !quiet) { toast(t('Write what sounded off first.')); return; }
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
      pronSeenView(draw),
      prosodyTrendView(),
      h('p', { class: 'muted' }, t('Problems pulled from your notes. Ones that keep coming back over several days are the ones to target in step 4.')),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, t('Issue')), h('th', null, t('Notes')), h('th', null, t('Last 14 days')), h('th', null, t('Days seen')), h('th', null, ''))),
        h('tbody', null, rows.map(({ i, notes, recent, days }) => h('tr', null,
          h('td', null, h('input', { type: 'checkbox', checked: i.status === 'fixed', 'aria-label': t('Mark {name} as sorted', { name: i.name }), title: t('Tick when it no longer comes back'), onchange: (e) => { Store.patch('issues', i.id, { status: e.target.checked ? 'fixed' : 'open' }); draw(); } })),
          h('td', null, h('strong', { style: { textDecoration: i.status === 'fixed' ? 'line-through' : 'none' } }, i.name),
            recent >= 2 && days >= 2 && i.status !== 'fixed' ? h('div', null, h('span', { class: 'issue-pill' }, t('target this next'))) : null,
            i.status !== 'fixed' && Pron.quietIssue(i.id) ? h('div', { class: 'row' }, h('span', { class: 'small muted' }, t('Looks quiet lately.')), btn(t('Mark as fixed?'), () => { Store.patch('issues', i.id, { status: 'fixed' }); draw(); }, { size: 'sm', kind: 'ghost' })) : null),
          h('td', { class: 'num' }, notes.length),
          h('td', { class: 'num' }, recent),
          h('td', { class: 'num' }, days),
          h('td', null, h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
            btn(t('Notes'), () => openIssueNotes(i), { size: 'sm', kind: 'ghost' }),
            btn(t('Rename'), () => renameIssue(i, draw), { size: 'sm', kind: 'ghost' }),
            rows.length > 1 ? btn(t('Merge'), () => mergeIssue(i, draw), { size: 'sm', kind: 'ghost' }) : null))))))) : h('p', { class: 'muted' }, t('No issues yet. They appear when you add notes after recorded passes.')));
  };
  draw();
  return wrap;
}

function renameIssue(i, after) {
  const inp = h('input', { type: 'text', id: 'renameIssue', value: i.name, autofocus: true });
  openModal([modalHead(t('Rename issue')), inp, h('div', { class: 'row' }, btn(t('Save'), () => { const v = inp.value.trim(); if (v) Store.patch('issues', i.id, { name: v }); closeModal(); openProgress('issues'); }, { kind: 'primary' }))], { narrow: true });
}
function mergeIssue(i, after) {
  const others = Store.all('issues').filter((x) => !x.mergedInto && x.id !== i.id);
  const sel = h('select', { id: 'mergeTarget' }, others.map((o) => h('option', { value: o.id }, o.name)));
  openModal([modalHead(t('Merge “{name}” into…', { name: i.name })), sel, h('div', { class: 'row' }, btn(t('Merge'), () => {
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
  openModal([modalHead(i.name, tp(notes.length, '{n} note', '{n} notes')), notes.map(noteCard), btn(t('Back to issues'), () => openProgress('issues'), { kind: 'ghost' })]);
}
function noteCard(n) {
  const c = Store.get('clips', n.clipId);
  return h('div', { class: 'card' },
    h('div', { class: 'row small muted' }, h('span', null, fmtDay(n.date)), c ? h('span', null, `· ${clipName(c)}`) : null),
    n.sentence ? h('p', null, h('em', null, `“${n.sentence}”`)) : null,
    h('p', null, h('strong', null, t('Sounded off: ')), n.off),
    n.aim ? h('p', null, h('strong', null, t('Aiming for: ')), n.aim) : null,
    n.reply ? replyView(n.reply) : null);
}

/* ---------- compare & history ---------- */
/* one chart with several voices overlaid on the clip's time axis (pitch or loudness) */
function overlayChart(clip, layers, view = 'pitch') {
  const c = h('canvas', { style: { height: '220px', width: '100%', display: 'block', borderRadius: '11px', background: 'var(--surface-2)' }, 'aria-label': view === 'pitch' ? t('Pitch of {voices} on one chart', { voices: layers.map((l) => l.label).join(', ') }) : t('Loudness of {voices} on one chart', { voices: layers.map((l) => l.label).join(', ') }) });
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
  if (!url) return h('p', { class: 'small muted' }, t('Recording not available.'));
  const el = h('audio', { controls: true, preload: 'metadata', src: url });
  // played back at the clip's loudness and your volume setting, like after a pass
  const clip = rec && Store.get('clips', rec.clipId);
  if (rec && rec.kind === 'pass') el.addEventListener('play', () => { if (!el._gain) MineLevel.attach(el, MineLevel.gain(rec.analysis, clip)); });
  return el;
}

async function openCompare(idA, idB, urlB) {
  const A = Store.get('recordings', idA), B = Store.get('recordings', idB);
  const clip = Store.get('clips', (A || B || {}).clipId || Session.clipId);
  if (!clip) return;
  const css = (v) => cssVar(v);
  const layers = [
    { key: 'speaker', label: t('Speaker'), color: css('--green'), width: 5, alpha: 0.55, series: clip.model ? { st: clip.model.st, db: clip.model.db, hop: clip.model.hop, offset: 0 } : null },
    { key: 'step3', label: t('Step 3'), color: css('--ochre'), width: 2.5, series: A && A.analysis, rec: A },
    { key: 'final', label: t('Final'), color: css('--sky'), width: 3, series: B && B.analysis, rec: B, url: urlB },
  ];
  let view = 'pitch';
  const holder = h('div');
  const drawChart = () => mount(holder, overlayChart(clip, layers, view));
  const legend = h('div', { class: 'row' }, layers.map((L) => h('label', { class: 'check', for: `cmp-${L.key}` },
    h('input', { type: 'checkbox', id: `cmp-${L.key}`, checked: !L.hidden, disabled: !L.series, onchange: (e) => { L.hidden = !e.target.checked; drawChart(); } }),
    h('span', { style: { display: 'inline-block', width: '14px', height: '4px', borderRadius: '2px', background: L.color } }), L.label)));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('View') },
    ['pitch', 'wave'].map((v) => h('button', { type: 'button', class: v === view ? 'on' : '', onclick: (e) => { view = v; [...seg.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); drawChart(); } }, v === 'pitch' ? t('Pitch') : t('Waveform'))));
  const players = await Promise.all(layers.slice(1).map(async (L) => h('div', { class: 'audio-row' },
    h('span', { style: { display: 'inline-block', width: '14px', height: '4px', borderRadius: '2px', background: L.color } }),
    h('strong', { class: 'small', style: { minWidth: '56px' } }, L.label),
    await recAudio(L.rec, L.url),
    h('span', { class: 'small muted' }, L.rec ? fmtLag(L.rec.lag) : ''))));
  drawChart();
  openModal([
    modalHead(t('Step 3 vs final pass'), clipName(clip)),
    h('div', { class: 'row' }, seg, h('span', { class: 'spacer' }), legend),
    holder,
    h('div', { class: 'stack' }, players),
    layers.slice(1).filter((L) => L.series && L.series.db).map((L) => { const c = prosodyCard(clip, L.series, L.rec && L.rec.heard, Pron.on()); return c && h('div', { class: 'stack' }, h('strong', { class: 'small' }, L.label), c); }),
    pronCompareCard(A, B),
    h('p', { class: 'small muted' }, t('Each line is shown against that voice’s own average pitch. A final line that follows the speaker’s shape more closely than step 3, or a smaller lag, is progress.')),
    B && B.sessionId ? noteForms({ clipId: clip.id, sessionId: B.sessionId, recId: B.id, pass: B.pass, step: B.step || 'again' }) : null,
  ]);
}

/* delete button with an in-place confirm */
function deleteSessionButton(sessionId, after) {
  const wrap = h('span', { class: 'row' });
  const normal = () => mount(wrap, btn(t('Delete session'), () => ask(), { size: 'sm', kind: 'ghost' }));
  const ask = () => mount(wrap,
    h('span', { class: 'small', style: { fontWeight: 800 } }, t('Delete this session, its recordings and notes?')),
    btn(t('Delete'), async () => { await deleteSession(sessionId); after && after(); }, { size: 'sm', kind: 'danger' }),
    btn(t('Keep it'), normal, { size: 'sm', kind: 'ghost' }));
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
  toast(t('Session deleted.'));
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
        h('span', { class: 'small muted' }, [s.mode === 'badday' ? t('bad-day') : s.mode === 'review' ? t('review') : s.mode === 'full' ? t('full') : s.mode, t('{n} min', { n: s.minutes }), tp(s.passes.length, '{n} pass', '{n} passes'), lags.length ? t('avg {lag}', { lag: fmtLag(mean(lags)) }) : null].filter(Boolean).join(' · ')),
        s.complete ? h('span', { class: 'tick done' }, icon('check', 'stroke-width="3.4"')) : null),
      rs.length ? h('div', { class: 'stack' }, await Promise.all(rs.map(async (r) => h('div', { class: 'audio-row' },
        h('span', { class: 'small', style: { minWidth: '120px', fontWeight: 800 } }, r.slot === 'step3' ? t('Step 3') : r.slot === 'final' ? t('Final') : t('Pass {n}', { n: r.pass })),
        await recAudio(r),
        h('span', { class: 'small muted' }, fmtLag(r.lag)))))) : null,
      h('div', { class: 'row' },
        s.recs && s.recs.step3 && s.recs.final ? btn(t('Compare step 3 and final'), () => openCompare(s.recs.step3, s.recs.final), { size: 'sm', kind: 'blue' }) : null,
        h('span', { class: 'spacer' }),
        deleteSessionButton(s.id, () => openHistory(clipId))),
      ns.map(noteCard));
  }));
  const trend = [...sessions].reverse().map((s) => {
    const lagOf = (id) => { const r = id && Store.get('recordings', id); return r && r.lag != null ? r.lag : null; };
    return { date: s.date, first: lagOf(s.recs && s.recs.step3), final: lagOf(s.recs && s.recs.final) };
  }).filter((x) => x.first != null && x.final != null);
  openModal([
    modalHead(t('History: {clip}', { clip: clipName(clip) }), tp(sessions.length, '{n} session · newest first', '{n} sessions · newest first')),
    trend.length ? h('div', { class: 'card' }, h('h3', null, t('First and final recording, session by session')),
      h('p', { class: 'small muted' }, t('Average lag behind the speaker in each recording. Clips and speeds differ, so read it as a rough trend.')),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, t('Date')), h('th', null, t('Step 3')), h('th', null, t('Final')))),
        h('tbody', null, trend.map((x) => h('tr', null, h('td', null, fmtDay(x.date)), h('td', { class: 'num' }, fmtLag(x.first)), h('td', { class: 'num' }, fmtLag(x.final)))))))) : null,
    items.length ? items : h('p', { class: 'muted' }, t('No sessions on this clip yet.')),
  ]);
}
