/* ---------- settings, data and device checks ---------- */
const SETTING_GROUPS = [
  { title: 'Daily session', fields: [
    ['listenPasses', 'Listen: passes', 1, 10, 1], ['listenMinutes', 'Listen: minutes', 1, 10, 1],
    ['shadowPasses', 'Shadow: passes', 1, 40, 1], ['shadowMinutes', 'Shadow: minutes', 1, 20, 1],
    ['recordMinutes', 'Record & compare: minutes', 1, 10, 1],
    ['againPasses', 'Shadow again: passes (before the final recorded pass)', 0, 30, 1], ['againMinutes', 'Shadow again: minutes', 1, 15, 1],
    ['loopGap', 'Gap between loops (seconds)', 0, 5, 0.1], ['shortenHintAfter', 'Offer the “can’t keep up” button after this many shadow passes', 1, 20, 1],
    ['weeklyTarget', 'Sessions per week target', 1, 7, 1],
  ] },
  { title: 'Bad-day mode', fields: [['badListenPasses', 'Listen: passes', 1, 10, 1], ['badShadowPasses', 'Shadow: passes', 1, 20, 1], ['badMinutes', 'Minutes', 2, 15, 1]] },
  { title: 'Clips', fields: [['clipMin', 'Target length: shortest (seconds)', 2, 60, 1], ['clipMax', 'Target length: longest (seconds)', 3, 90, 1]] },
  { title: 'Review runs', fields: [['review', 'Bring finished clips back for a shorter review run', 'bool'], ['reviewAfterDays', 'Review after (days)', 1, 7, 1], ['reviewShadowPasses', 'Review: shadow passes', 1, 20, 1]] },
  { title: 'Sync and microphone', fields: [
    ['alignMode', 'Line up your recording', 'select', [['auto', 'Automatically (match loudness patterns)'], ['manual', 'With my manual offset']]],
    ['manualOffsetMs', 'Manual offset (ms); used when auto-alignment fails or is off', -500, 2000, 10],
    ['latencyMs', 'Device delay correction (ms); subtracted from every lag', -500, 1000, 5],
    ['livePitchAllPasses', 'Show my live pitch line on every shadow pass (not just recorded ones)', 'bool'],
    ['keepAllPassRecordings', 'Keep every pass recording (uses more storage)', 'bool'],
    ['micAuto', 'Automatic microphone volume (recommended)', 'bool'],
    ['micGain', 'Microphone boost when automatic volume is off (×)', 0.5, 12, 0.5],
    ['echoCancellation', 'Echo cancellation (only if you can’t use headphones)', 'bool'],
    ['noiseSuppression', 'Noise suppression', 'bool'],
    ['pitchSmoothing', 'Pitch line smoothing (frames)', 1, 15, 2],
  ] },
];

function openSettings(tab = 'practice') {
  const tabs = [['practice', 'Practice'], ['profile', 'Profile'], ['reminders', 'Reminders'], ['data', 'Data'], ['checks', 'Device checks'], ['look', 'Appearance']];
  const body = tab === 'practice' ? settingsForm() : tab === 'profile' ? profileView() : tab === 'reminders' ? remindersView() : tab === 'data' ? dataView() : tab === 'checks' ? checksView() : lookView();
  openModal([
    modalHead('Settings'),
    h('div', { class: 'tabs' }, tabs.map(([k, l]) => btn(l, () => openSettings(k), { size: 'sm', on: k === tab }))),
    body,
  ], { onClose: () => renderAll() });
}

function settingsForm() {
  const s = settings();
  const draft = { ...s };
  const groups = SETTING_GROUPS.map((g) => h('div', { class: 'card' }, h('h3', null, g.title),
    h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' } }, g.fields.map(([key, label, a, b, step]) => {
      const id = `set-${key}`;
      if (a === 'bool') return h('label', { class: 'check', for: id }, h('input', { type: 'checkbox', id, checked: !!draft[key], onchange: (e) => { draft[key] = e.target.checked; } }), label);
      if (a === 'select') return h('label', { class: 'field', for: id }, label, h('select', { id, onchange: (e) => { draft[key] = e.target.value; } }, b.map(([v, l]) => h('option', { value: v, selected: draft[key] === v }, l))));
      return h('label', { class: 'field', for: id }, label, h('input', { type: 'number', id, min: a, max: b, step, value: draft[key], oninput: (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) draft[key] = clamp(v, a, b); } }));
    }))));
  const start = h('div', { class: 'card' }, h('h3', null, 'Programme'),
    h('label', { class: 'field', for: 'set-programmeStart' }, 'Programme start date (week 0)', h('input', { type: 'date', id: 'set-programmeStart', value: draft.programmeStart || programmeStart(), onchange: (e) => { draft.programmeStart = e.target.value || null; } })),
    h('p', { class: 'small muted' }, 'Check-ins fall due 4, 8 and 12 weeks after this date.'));
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (draft.clipMin >= draft.clipMax) { toast('The shortest clip length must be less than the longest.', 'bad'); return; }
    saveSettings(draft);
    toast('Settings saved.', 'good');
    closeModal();
  } },
  groups, start,
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, 'Save settings')),
    btn('Reset to defaults', () => { saveSettings({ ...DEFAULT_SETTINGS, programmeStart: s.programmeStart }); toast('Defaults restored.'); openSettings('practice'); }, { kind: 'ghost' })));
}

function dataView() {
  const usage = h('p', { class: 'small muted' }, '');
  if (Caps.assets && Store.blobMode === 'assets') Caps.assets.list().then((r) => { usage.textContent = `File storage: ${(r.usage.bytes / 1048576).toFixed(1)} MB of ${(r.usage.maxBytes / 1048576).toFixed(0)} MB, ${r.usage.files} of ${r.usage.maxFiles} files.`; }).catch(() => {});
  const counts = COLS.filter((c) => c !== 'meta').map((c) => `${Store.all(c).length} ${c}`).join(' · ');
  const passRecs = Store.all('recordings').filter((r) => r.kind === 'pass' && !r.slot);
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, 'Where your data lives'), h('p', null, storageTitle()), h('p', { class: 'small muted' }, counts), usage),
    h('div', { class: 'card' }, h('h3', null, 'Backup'),
      h('p', { class: 'small muted' }, 'A backup holds your videos, clips, sessions, notes, issues, check-ins and settings (not the audio files). Importing adds anything missing and never overwrites.'),
      h('div', { class: 'row' },
        btn('Export backup', () => saveText(`shadowing-backup-${dayKey()}.json`, Store.exportJSON()), { icon: 'download', kind: 'primary' }),
        filePickButton('Import backup', 'application/json,.json', async (f) => {
          try { const n = await Store.importJSON(await f.text()); toast(`Imported ${n} item${n === 1 ? '' : 's'}.`, 'good'); renderAll(); } catch (e) { toast(e.message, 'bad'); }
        }, { icon: 'upload' }))),
    passRecs.length ? h('div', { class: 'card' }, h('h3', null, 'Extra pass recordings'),
      h('p', { class: 'small muted' }, `${passRecs.length} recordings beyond the step 3 and final passes. Step 3, final and check-in recordings are always kept.`),
      h('div', { class: 'row' }, btn('Remove extra pass recordings', async () => {
        for (const r of passRecs) { await Store.deleteBlob(r.ref); Store.data.recordings[r.id] = undefined; delete Store.data.recordings[r.id]; Store.schedule('recordings', r.id, 50); }
        toast('Removed.'); openSettings('data');
      }, { kind: 'danger' }))) : null);
}

async function saveText(name, text) {
  if (Caps.downloads) {
    try { await Caps.downloads.save({ filename: name, data: text }); toast('Saved.', 'good'); } catch (e) { if (e.code !== 'declined') toast(`Couldn’t save the file (${e.code}).`, 'bad'); }
    return;
  }
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

function lookView() {
  const cur = lsGet('theme', 'system');
  const set = (t) => { lsSet('theme', t); applyTheme(); openSettings('look'); };
  return h('div', { class: 'card' }, h('h3', null, 'Theme'),
    h('div', { class: 'seg' }, [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => h('button', { type: 'button', class: cur === k ? 'on' : '', onclick: () => set(k) }, l))),
    h('p', { class: 'small muted' }, 'Inside Claude, the viewer’s own theme setting can also switch this.'));
}
function applyTheme() {
  const t = lsGet('theme', 'system');
  if (t === 'system') {
    if (!Caps.inArtifact) document.documentElement.removeAttribute('data-theme');
  } else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- device checks: the spec's "test first" list, runnable on any device ---------- */
const CHECKS = [
  { key: 'storage', name: 'Saving data across devices', run: checkStorage },
  { key: 'files', name: 'Storing recordings', run: checkFiles },
  { key: 'mic', name: 'Microphone', run: checkMic },
  { key: 'video', name: 'Video link plays', run: checkVideoPlays },
  { key: 'sound', name: 'Reading the video’s sound (for pitch and waveform)', run: checkVideoSound },
  { key: 'claude', name: 'Asking Claude from the app', run: checkClaude },
  { key: 'pitch', name: 'Pitch tracking on your clips', run: checkPitch },
  { key: 'align', name: 'Auto-alignment on your passes', run: checkAlign },
];
const checkResults = lsGet('checks', {});

function checksView() {
  const grid = h('div', { class: 'diag' });
  const draw = () => mount(grid, CHECKS.map((c) => {
    const r = checkResults[c.key];
    return [
      h('span', { class: `st ${r ? r.state : ''}` }, r ? (r.state === 'ok' ? 'Works' : r.state === 'fail' ? 'Fails' : r.state === 'warn' ? 'Partly' : '…') : 'Not run'),
      h('div', null, h('strong', null, c.name), r ? h('p', { class: 'small muted' }, r.msg) : null),
      btn('Run', async (e) => { checkResults[c.key] = { state: '', msg: 'Running…' }; draw(); checkResults[c.key] = await safeRun(c.run); lsSet('checks', checkResults); draw(); }, { size: 'sm' }),
    ];
  }));
  draw();
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `These test what works in this ${Caps.inArtifact ? 'Claude artifact' : 'browser'} on this device, with your ${Store.mode === 'cloud' ? 'server' : 'storage'}. Open a video and select a clip first so the video and pitch checks have something to test.`),
    btn('Run all checks', async () => { for (const c of CHECKS) { checkResults[c.key] = { state: '', msg: 'Running…' }; draw(); checkResults[c.key] = await safeRun(c.run); draw(); } lsSet('checks', checkResults); }, { kind: 'primary', icon: 'flask' }),
    grid);
}
async function safeRun(fn) { try { return await fn(); } catch (e) { return { state: 'fail', msg: `Error: ${e.message || e.code || e}` }; } }

async function checkStorage() {
  if (Store.mode === 'cloud') {
    await Api.req('PUT', '/api/docs/meta/probe', { at: new Date().toISOString() });
    await Api.req('DELETE', '/api/docs/meta/probe');
    return { state: 'ok', msg: `Your Cloudflare database saves and reads back${Api.email ? ` (signed in as ${Api.email})` : ''}. Your data follows you to any device.` };
  }
  if (Store.mode === 'artifact') {
    const ref = Caps.db.collection('meta').doc('probe');
    await ref.set({ at: new Date().toISOString() });
    const snap = await ref.get();
    await ref.delete();
    return snap.exists ? { state: 'ok', msg: 'The artifact’s database saves and reads back. Your data follows you to any device.' } : { state: 'fail', msg: 'A test write didn’t read back.' };
  }
  if (Store.mode === 'local') return { state: 'warn', msg: 'Saving works, but only in this browser on this device. Use Settings → Data → Export backup to move it.' };
  return { state: 'fail', msg: 'Storage is blocked here; nothing is kept.' };
}
async function checkFiles() {
  if (Store.blobMode === 'r2') {
    const ref = await Store.putBlob(new Blob([new Uint8Array(4096)], { type: 'audio/webm' }), 'misc');
    const back = await Store.getBlob(ref);
    await Store.deleteBlob(ref);
    return back && back.size === 4096 ? { state: 'ok', msg: 'Recordings and videos are stored in your R2 bucket and play on every device.' } : { state: 'fail', msg: 'A test file didn’t read back.' };
  }
  if (Store.blobMode === 'assets') {
    const blob = new Blob([new Uint8Array(2048)], { type: 'video/webm' });
    const r = await Caps.assets.upload(blob, { type: 'video/webm' });
    const list = await Caps.assets.list();
    await Caps.assets.delete(r.id);
    const u = list.usage;
    const mins = Math.floor((u.maxBytes - u.bytes) / (16000 * 60));
    return { state: 'ok', msg: `File storage works. ${(u.bytes / 1048576).toFixed(1)} of ${(u.maxBytes / 1048576).toFixed(0)} MB used, ${u.files}/${u.maxFiles} files; 20 MB per recording maximum (about ${mins} more minutes of recordings at typical quality).` };
  }
  if (Store.blobMode === 'local') {
    let est = '';
    try { const q = await navigator.storage.estimate(); est = ` About ${((q.quota - q.usage) / 1073741824).toFixed(1)} GB free for this browser.`; } catch { /* no estimate */ }
    return { state: 'warn', msg: `Recordings are kept in this browser only.${est}` };
  }
  return { state: 'fail', msg: 'Recordings can’t be kept here.' };
}
async function checkMic() {
  AudioEng.getCtx();
  const ok = await Mic.open();
  if (!ok) return { state: 'fail', msg: Mic.error };
  let peak = -100;
  const off = Mic.on((x) => { for (let i = 0; i < x.length; i += 40) peak = Math.max(peak, 20 * Math.log10(Math.abs(x[i]) + 1e-6)); });
  await sleep(1500);
  off();
  if (!Session.active) Mic.close();
  return peak > -70 ? { state: 'ok', msg: `The microphone works (peak level ${peak.toFixed(0)} dB in 1.5 s).` } : { state: 'warn', msg: 'The microphone opened but heard silence. Check the input device.' };
}
async function checkVideoPlays() {
  const v = Player.current();
  if (!v) return { state: '', msg: 'Open a video first.' };
  if (LocalFiles.get(v.id)) return { state: 'warn', msg: 'Playing from a file on this device, so the link wasn’t tested.' };
  const r = await checkPlayable(videoSrc(v));
  return r.ok ? { state: 'ok', msg: `“${v.title}” plays from its ${v.r2Key || v.assetId ? 'stored copy' : 'link'} (${fmtTime(r.duration)} long).` } : { state: 'fail', msg: r.reason };
}
async function checkVideoSound() {
  const v = Player.current();
  if (!v) return { state: '', msg: 'Open a video first.' };
  VideoAudio.cache.delete(v.id);
  const t0 = performance.now();
  const r = await VideoAudio.ensure(v, 0, 10);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  if (r.status === 'ready') return { state: 'ok', msg: r.method === 'partial'
    ? `The app reads just the part of “${v.title}” it needs (10 s of sound in ${secs} s, decoded with ${r.via}). Pitch and waveform will work.`
    : `The app can read the sound of “${v.title}”, but has to download the whole file each visit (${secs} s here)${r.mp4Failed ? `: ${r.mp4Failed}` : ''}.` };
  return { state: 'fail', msg: r.error };
}
async function checkClaude() {
  if (Store.mode === 'cloud') {
    if (!Api.claude) return { state: 'fail', msg: 'The server has no Claude API key yet. Add the ANTHROPIC_API_KEY secret to the Cloudflare project.' };
    const { reply } = await Api.req('POST', '/api/claude', { sentence: 'Go and grab the car.', off: 'the vowel in go sounds too pure', aim: '', issues: [], profile: profileForAI() });
    return reply && (reply.feature || reply.text || reply.unsure) ? { state: 'ok', msg: `Claude answered (model: ${Api.claudeModel || 'unknown'}). Feedback on notes uses your Claude API key.` } : { state: 'warn', msg: 'Claude answered in an unexpected format.' };
  }
  if (!Caps.sample) return { state: 'fail', msg: Caps.inArtifact ? 'Claude access isn’t available in this view.' : 'This standalone version can’t reach Claude. Notes offer “Copy prompt for Claude” instead.' };
  const r = await Caps.sample('Reply with just the word OK.', { modelTier: 'quick', cache: false });
  return /ok/i.test(r.text) ? { state: 'ok', msg: 'Claude answered. Feedback on notes will use your Claude plan.' } : { state: 'warn', msg: `Claude answered unexpectedly: “${r.text.slice(0, 60)}”` };
}
async function checkPitch() {
  const clips = Store.all('clips').filter((c) => c.model);
  if (!clips.length) return { state: '', msg: 'Save a clip whose sound can be read first.' };
  const rel = clips.map((c) => c.model.reliability || 0);
  const avg = mean(rel);
  const weak = clips.filter((c) => (c.model.reliability || 0) < 0.55);
  return { state: avg > 0.7 ? 'ok' : avg > 0.5 ? 'warn' : 'fail', msg: `On average ${Math.round(avg * 100)}% of voiced speech gets a reliable pitch reading across ${clips.length} clip${clips.length === 1 ? '' : 's'}.${weak.length ? ` ${weak.length} clip${weak.length === 1 ? ' is' : 's are'} patchy (background noise); flag them as noisy if the line jumps.` : ''}` };
}
async function checkAlign() {
  const recs = Store.all('recordings').filter((r) => r.kind === 'pass' && r.score != null).sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 12);
  if (!recs.length) return { state: '', msg: 'Record a few passes first.' };
  const good = recs.filter((r) => r.score > 0.3);
  const share = good.length / recs.length;
  return { state: share > 0.75 ? 'ok' : share > 0.4 ? 'warn' : 'fail', msg: `${good.length} of the last ${recs.length} recorded passes lined up automatically (average match ${mean(recs.map((r) => r.score)).toFixed(2)}). When it fails, the manual offset in Settings is used.` };
}

/* ---------- shortcuts ---------- */
function openShortcuts() {
  const K = (k) => h('span', { class: 'kbd' }, k);
  openModal([
    modalHead('Keyboard shortcuts'),
    h('div', { class: 'keys' },
      h('span', null, K('Space')), h('span', null, 'Play / pause (pauses the session too)'),
      h('span', null, K('R')), h('span', null, 'Replay the loop from the start (repeats the pass in a session)'),
      h('span', null, K('C')), h('span', null, 'Clip mode on / off (drag on the timeline to select a clip)'),
      h('span', null, K('I'), ' ', K('[')), h('span', null, 'Mark clip start at the playhead'),
      h('span', null, K('O'), ' ', K(']')), h('span', null, 'Mark clip end at the playhead'),
      h('span', null, K(','), ' ', K('.')), h('span', null, 'Slower / faster (0.5x, 0.75x, 1x)'),
      h('span', null, K('L')), h('span', null, 'Loop on / off'),
      h('span', null, K('←'), ' ', K('→')), h('span', null, 'Back / forward 2 seconds'),
      h('span', null, K('Enter')), h('span', null, 'Start the step or recording when a session is waiting'),
      h('span', null, K('Esc')), h('span', null, 'Close a window, or cancel a new clip'),
      h('span', null, K('?')), h('span', null, 'Show this help')),
  ], { narrow: true });
}

/* ---------- Discord reminders ---------- */
const REMINDER_DEFAULTS = { enabled: false, time: '18:00', lateTime: '', days: [1, 2, 3, 4, 5, 6, 0], skipIfDone: true, checkins: true, discordUserId: '' };
function reminderSettings() { return { ...REMINDER_DEFAULTS, ...(settings().reminders || {}) }; }
function saveReminders(fields) {
  // the reminder Worker needs the time zone and the app's address; take them from this device
  saveSettings({ reminders: { ...reminderSettings(), ...fields, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', appUrl: location.origin } });
  Api.req('POST', '/api/reminders/arm').catch(() => {}); // make sure the schedule is running
}

function remindersView() {
  const wrap = h('div', { class: 'stack' });
  if (Store.mode !== 'cloud') {
    mount(wrap, h('p', { class: 'muted' }, 'Reminders need the online version of the app (they’re sent by the server).'));
    return wrap;
  }
  let status = null; // {configured, hint, last}
  let replacing = false;
  const draw = () => {
    const r = reminderSettings();
    const hook = !status ? h('p', { class: 'small muted' }, 'Checking…')
      : status.configured && !replacing
        ? h('div', { class: 'row' },
          h('span', { class: 'chip' }, icon('check'), `Webhook saved (${status.hint})`),
          btn('Replace', () => { replacing = true; draw(); }, { size: 'sm' }),
          btn('Remove', async () => { await Api.req('PUT', '/api/reminders', { webhook: null }); status.configured = false; saveReminders({ enabled: false }); draw(); toast('Webhook removed. Reminders are off.'); }, { size: 'sm', kind: 'ghost' }))
        : (() => {
          const input = h('input', { type: 'password', id: 'rem-hook', placeholder: 'https://discord.com/api/webhooks/…', autocomplete: 'off', spellcheck: 'false' });
          return h('div', { class: 'stack' },
            h('label', { class: 'field', for: 'rem-hook' }, 'Discord webhook link', input),
            h('p', { class: 'small muted' }, 'In Discord: Server settings → Integrations → Webhooks → New Webhook, choose the channel, then Copy Webhook URL. It’s stored on the server only and never shown again.'),
            h('div', { class: 'row' },
              btn('Save webhook', async () => {
                try {
                  const res = await Api.req('PUT', '/api/reminders', { webhook: input.value.trim() });
                  status = { ...status, configured: true, hint: res.hint }; replacing = false;
                  if (!reminderSettings().enabled) saveReminders({ enabled: true });
                  draw(); toast('Webhook saved. Reminders are on.', 'good');
                } catch (e) { toast(e.message, 'bad', 7000); }
              }, { kind: 'primary', size: 'sm' }),
              replacing ? btn('Cancel', () => { replacing = false; draw(); }, { size: 'sm', kind: 'ghost' }) : null));
        })();
    const dayBtns = [1, 2, 3, 4, 5, 6, 0].map((d) => btn(DAYS[d], () => {
      const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d];
      saveReminders({ days }); draw();
    }, { size: 'sm', on: r.days.includes(d), pressed: r.days.includes(d) }));
    const last = status && status.last;
    mount(wrap,
      h('p', { class: 'muted' }, 'Get a nudge in Discord when it’s time to practise, with a link straight to the app. If you’ve already practised that day, it stays quiet.'),
      hook,
      h('label', { class: 'check', for: 'rem-on' }, h('input', { type: 'checkbox', id: 'rem-on', checked: r.enabled, disabled: !(status && status.configured), onchange: (e) => { saveReminders({ enabled: e.target.checked }); draw(); } }), 'Send reminders'),
      h('div', { class: 'row' },
        h('label', { class: 'field', for: 'rem-time' }, 'Reminder time', h('input', { type: 'time', id: 'rem-time', value: r.time, step: 900, onchange: (e) => { if (e.target.value) saveReminders({ time: e.target.value }); } })),
        h('label', { class: 'field', for: 'rem-late' }, 'Second nudge if I still haven’t (optional)', h('input', { type: 'time', id: 'rem-late', value: r.lateTime, step: 900, onchange: (e) => saveReminders({ lateTime: e.target.value || '' }) }))),
      h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Days'), h('div', { class: 'row' }, dayBtns)),
      h('label', { class: 'check', for: 'rem-skip' }, h('input', { type: 'checkbox', id: 'rem-skip', checked: r.skipIfDone, onchange: (e) => saveReminders({ skipIfDone: e.target.checked }) }), 'Skip the reminder if I’ve already practised that day'),
      h('label', { class: 'check', for: 'rem-ci' }, h('input', { type: 'checkbox', id: 'rem-ci', checked: r.checkins, onchange: (e) => saveReminders({ checkins: e.target.checked }) }), 'Mention when a check-in is due'),
      h('label', { class: 'field', for: 'rem-user' }, 'Your Discord user ID (optional, to get pinged)',
        h('input', { type: 'text', id: 'rem-user', inputmode: 'numeric', placeholder: 'e.g. 123456789012345678', value: r.discordUserId, autocomplete: 'off', spellcheck: 'false', onchange: (e) => {
          const id = e.target.value.replace(/\s/g, '');
          if (id && !/^\d{17,20}$/.test(id)) { toast('That doesn’t look like a Discord user ID (17 to 20 digits).', 'bad', 7000); return; }
          saveReminders({ discordUserId: id }); toast(id ? 'You’ll be pinged in reminders.' : 'Reminders won’t ping you.');
        } })),
      h('p', { class: 'small muted' }, 'In Discord: Settings → Advanced → turn on Developer Mode, then right-click your name → Copy User ID. Leave empty for reminders without a ping.'),
      h('p', { class: 'small muted' }, `Times are in ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'} (this device’s time zone). Reminders go out within 15 minutes of the time you set.`),
      h('div', { class: 'row' },
        btn('Send a test', async () => {
          try { await Api.req('POST', '/api/reminders/test', { appUrl: location.origin, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); toast('Test sent. Check Discord.', 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
        }, { size: 'sm', icon: 'bell', disabled: !(status && status.configured) }),
        last ? h('span', { class: 'small muted' }, `Last reminder ${fmtWhen(last.at)}: ${last.ok ? 'sent' : `failed (${last.error})`}`) : null));
  };
  draw();
  Api.req('GET', '/api/reminders').then((d) => { status = d; draw(); }).catch((e) => { status = { configured: false }; draw(); toast(e.message, 'bad'); });
  return wrap;
}
function fmtWhen(iso) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
