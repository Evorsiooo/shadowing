/* ---------- settings, data and device checks ---------- */
const SETTING_GROUPS = [
  { title: N_('Daily session'), fields: [
    ['listenPasses', N_('Listen: passes'), 1, 10, 1], ['listenMinutes', N_('Listen: minutes'), 1, 10, 1],
    ['shadowPasses', N_('Shadow: passes'), 1, 40, 1], ['shadowMinutes', N_('Shadow: minutes'), 1, 20, 1],
    ['recordMinutes', N_('Record & compare: minutes'), 1, 10, 1],
    ['againPasses', N_('Shadow again: passes (before the final recorded pass)'), 0, 30, 1], ['againMinutes', N_('Shadow again: minutes'), 1, 15, 1],
    ['loopGap', N_('Gap between loops (seconds)'), 0, 5, 0.1], ['shortenHintAfter', N_('Offer the “can’t keep up” button after this many shadow passes'), 1, 20, 1],
    ['weeklyTarget', N_('Sessions per week target'), 1, 7, 1],
  ] },
  { title: N_('Bad-day mode'), fields: [['badListenPasses', N_('Listen: passes'), 1, 10, 1], ['badShadowPasses', N_('Shadow: passes'), 1, 20, 1], ['badMinutes', N_('Minutes'), 2, 15, 1]] },
  { title: N_('Clips'), fields: [['clipMin', N_('Target length: shortest (seconds)'), 2, 60, 1], ['clipMax', N_('Target length: longest (seconds)'), 3, 90, 1]] },
  { title: N_('Review runs'), fields: [['review', N_('Bring finished clips back for a shorter review run'), 'bool'], ['reviewAfterDays', N_('Review after (days)'), 1, 7, 1], ['reviewShadowPasses', N_('Review: shadow passes'), 1, 20, 1]] },
  { title: N_('Sync and microphone'), fields: [
    ['alignMode', N_('Line up your recording'), 'select', [['auto', N_('Automatically (match loudness patterns)')], ['manual', N_('With my manual offset')]]],
    ['manualOffsetMs', N_('Manual offset (ms); used when auto-alignment fails or is off'), -500, 2000, 10],
    ['latencyMs', N_('Device delay correction (ms); subtracted from every lag'), -500, 1000, 5],
    ['livePitchAllPasses', N_('Show my live pitch line on every shadow pass (not just recorded ones)'), 'bool'],
    ['keepAllPassRecordings', N_('Keep every pass recording (uses more storage)'), 'bool'],
    ['micAuto', N_('Automatic microphone volume (recommended)'), 'bool'],
    ['micGain', N_('Microphone boost when automatic volume is off (×)'), 0.5, 12, 0.5],
    ['echoCancellation', N_('Echo cancellation (only if you can’t use headphones)'), 'bool'],
    ['noiseSuppression', N_('Noise suppression'), 'bool'],
    ['pitchSmoothing', N_('Pitch line smoothing (frames)'), 1, 15, 2],
  ] },
];

function openSettings(tab = 'practice') {
  const tabs = [['practice', t('Practice')], ['profile', t('Profile')], ['storage', t('Storage')], ['ai', t('AI')], ['reminders', t('Reminders')], ['apps', t('Connected apps')], ['data', t('Data')], ['checks', t('Device checks')], ['look', t('Language and theme')]];
  const body = tab === 'practice' ? settingsForm() : tab === 'profile' ? profileView() : tab === 'storage' ? storageView() : tab === 'ai' ? aiPanel() : tab === 'reminders' ? remindersView() : tab === 'apps' ? connectedAppsView() : tab === 'data' ? dataView() : tab === 'checks' ? checksView() : lookView();
  openModal([
    modalHead(t('Settings')),
    h('div', { class: 'tabs' }, tabs.map(([k, l]) => btn(l, () => openSettings(k), { size: 'sm', on: k === tab }))),
    body,
  ], { onClose: () => renderAll() });
}

function settingsForm() {
  const s = settings();
  const draft = { ...s };
  const groups = SETTING_GROUPS.map((g) => h('div', { class: 'card' }, h('h3', null, t(g.title)),
    h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' } }, g.fields.map(([key, label, a, b, step]) => {
      const id = `set-${key}`;
      if (a === 'bool') return h('label', { class: 'check', for: id }, h('input', { type: 'checkbox', id, checked: !!draft[key], onchange: (e) => { draft[key] = e.target.checked; } }), t(label));
      if (a === 'select') return h('label', { class: 'field', for: id }, t(label), h('select', { id, onchange: (e) => { draft[key] = e.target.value; } }, b.map(([v, l]) => h('option', { value: v, selected: draft[key] === v }, t(l)))));
      return h('label', { class: 'field', for: id }, t(label), h('input', { type: 'number', id, min: a, max: b, step, value: draft[key], oninput: (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) draft[key] = clamp(v, a, b); } }));
    }))));
  let startDraft = savedProgrammeStart();
  const start = h('div', { class: 'card' }, h('h3', null, Object.keys(LANGUAGES).length > 1 ? t('{lang} programme', { lang: t(langContent().name) }) : t('Programme')),
    h('label', { class: 'field', for: 'set-programmeStart' }, t('Programme start date (week 0)'), h('input', { type: 'date', id: 'set-programmeStart', value: programmeStart(), onchange: (e) => { startDraft = e.target.value || null; } })),
    h('p', { class: 'small muted' }, t('Check-ins fall due 4, 8 and 12 weeks after this date.')));
  return h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (draft.clipMin >= draft.clipMax) { toast(t('The shortest clip length must be less than the longest.'), 'bad'); return; }
    saveSettings({ ...draft, ...programmeStartPatch(startDraft) });
    toast(t('Settings saved.'), 'good');
    closeModal();
  } },
  groups, start,
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary big' }, h('span', null, t('Save settings'))),
    btn(t('Reset to defaults'), () => { saveSettings({ ...DEFAULT_SETTINGS, programmeStart: s.programmeStart, programmeStarts: s.programmeStarts }); toast(t('Defaults restored.')); openSettings('practice'); }, { kind: 'ghost' })));
}

function dataView() {
  const usage = h('p', { class: 'small muted' }, '');
  if (Caps.assets && Store.blobMode === 'assets') Caps.assets.list().then((r) => { usage.textContent = t('File storage: {used} MB of {max} MB, {files} of {maxFiles} files.', { used: (r.usage.bytes / 1048576).toFixed(1), max: (r.usage.maxBytes / 1048576).toFixed(0), files: r.usage.files, maxFiles: r.usage.maxFiles }); }).catch(() => {});
  const counts = COLS.filter((c) => c !== 'meta').map((c) => countLabel(c, Store.all(c).length)).join(' · ');
  const passRecs = Store.all('recordings').filter((r) => r.kind === 'pass' && !r.slot);
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, t('Where your data lives')), h('p', null, storageTitle()), h('p', { class: 'small muted' }, counts), usage),
    Store.mode === 'cloud' ? accountCard() : null,
    h('div', { class: 'card' }, h('h3', null, t('Backup')),
      h('p', { class: 'small muted' }, t('A backup holds your videos, clips, sessions, notes, issues, check-ins and settings (not the video and audio files themselves; those are on this device and in Google Drive if it’s connected). Importing adds anything missing and never overwrites.')),
      h('div', { class: 'row' },
        btn(t('Export backup'), () => saveText(`shadowing-backup-${dayKey()}.json`, Store.exportJSON()), { icon: 'download', kind: 'primary' }),
        filePickButton(t('Import backup'), 'application/json,.json', async (f) => {
          try { const n = await Store.importJSON(await f.text()); toast(tp(n, 'Imported {n} item.', 'Imported {n} items.'), 'good'); renderAll(); } catch (e) { toast(e.message, 'bad'); }
        }, { icon: 'upload' }))),
    passRecs.length ? h('div', { class: 'card' }, h('h3', null, t('Extra pass recordings')),
      h('p', { class: 'small muted' }, tp(passRecs.length, '{n} recording beyond the step 3 and final passes. Step 3, final and check-in recordings are always kept.', '{n} recordings beyond the step 3 and final passes. Step 3, final and check-in recordings are always kept.')),
      h('div', { class: 'row' }, btn(t('Remove extra pass recordings'), async () => {
        for (const r of passRecs) { await Store.deleteBlob(r.ref); Store.data.recordings[r.id] = undefined; delete Store.data.recordings[r.id]; Store.schedule('recordings', r.id, 50); }
        toast(t('Removed.')); openSettings('data');
      }, { kind: 'danger' }))) : null);
}

/* "3 videos" for the data summary, one plural pair per collection */
function countLabel(col, n) {
  switch (col) {
    case 'videos': return tp(n, '{n} video', '{n} videos');
    case 'clips': return tp(n, '{n} clip', '{n} clips');
    case 'sessions': return tp(n, '{n} session', '{n} sessions');
    case 'recordings': return tp(n, '{n} recording', '{n} recordings');
    case 'notes': return tp(n, '{n} note', '{n} notes');
    case 'issues': return tp(n, '{n} issue', '{n} issues');
    case 'checkins': return tp(n, '{n} check-in', '{n} check-ins');
    case 'media': return tp(n, '{n} media file', '{n} media files');
    default: return `${n} ${col}`;
  }
}

/* signed-in account: sign out, or delete the account and everything the server keeps */
function accountCard() {
  const confirmInput = h('input', { type: 'email', id: 'acct-del', placeholder: Api.email || '', autocomplete: 'off', spellcheck: 'false' });
  return h('div', { class: 'card' }, h('h3', null, t('Account')),
    h('p', null, Api.role === 'admin' ? t('Signed in with Google as {email} (admin).', { email: Api.email }) : t('Signed in with Google as {email}.', { email: Api.email })),
    h('div', { class: 'row' }, btn(t('Sign out'), async () => { await Store.flushAll(); await Promise.race([Push.disable(), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); location.href = '/auth/logout'; }, { size: 'sm' })),
    h('details', null, h('summary', null, t('Delete my account')),
      h('p', { class: 'small muted' }, t('This deletes your account and all your practice data on the server, for good. Export a backup first if you want to keep it.')),
      h('label', { class: 'field', for: 'acct-del' }, t('Type your email address to confirm'), confirmInput),
      h('div', { class: 'row' }, btn(t('Delete my account'), async () => {
        try { await Api.req('DELETE', '/api/account', { confirm: confirmInput.value }); location.href = '/'; } catch (e) { toast(e.message, 'bad', 7000); }
      }, { kind: 'danger', size: 'sm' }))));
}

async function saveText(name, text) {
  if (Caps.downloads) {
    try { await Caps.downloads.save({ filename: name, data: text }); toast(t('Saved.'), 'good'); } catch (e) { if (e.code !== 'declined') toast(t('Couldn’t save the file ({code}).', { code: e.code }), 'bad'); }
    return;
  }
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

function lookView() {
  const cur = lsGet('theme', 'system');
  const set = (theme) => { lsSet('theme', theme); applyTheme(); openSettings('look'); };
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, t('Interface language')),
      uiLangPicker(() => openSettings('look')), // 90-onboarding.js; re-open this tab so it shows in the new language
      h('p', { class: 'small muted' }, t('The language of the app’s buttons, messages and AI feedback. Your practice language is set in Settings → Profile.'))),
    h('div', { class: 'card' }, h('h3', null, t('Theme')),
      h('div', { class: 'seg' }, [['system', t('Match device')], ['light', t('Light')], ['dark', t('Dark')]].map(([k, l]) => h('button', { type: 'button', class: cur === k ? 'on' : '', onclick: () => set(k) }, l))),
      h('p', { class: 'small muted' }, t('Inside Claude, the viewer’s own theme setting can also switch this.'))));
}
function applyTheme() {
  const t = lsGet('theme', 'system');
  if (t === 'system') {
    if (!Caps.inArtifact) document.documentElement.removeAttribute('data-theme');
  } else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- device checks: the spec's "test first" list, runnable on any device ---------- */
const CHECKS = [
  { key: 'storage', name: N_('Saving data across devices'), run: checkStorage },
  { key: 'files', name: N_('Storing recordings'), run: checkFiles },
  { key: 'mic', name: N_('Microphone'), run: checkMic },
  { key: 'video', name: N_('Video link plays'), run: checkVideoPlays },
  { key: 'sound', name: N_('Reading the video’s sound (for pitch and waveform)'), run: checkVideoSound },
  { key: 'claude', name: N_('AI feedback from the app'), run: checkClaude },
  { key: 'pitch', name: N_('Pitch tracking on your clips'), run: checkPitch },
  { key: 'align', name: N_('Auto-alignment on your passes'), run: checkAlign },
];
const checkResults = lsGet('checks', {});

function checksView() {
  const grid = h('div', { class: 'diag' });
  const draw = () => mount(grid, CHECKS.map((c) => {
    const r = checkResults[c.key];
    return [
      h('span', { class: `st ${r ? r.state : ''}` }, r ? (r.state === 'ok' ? t('Works') : r.state === 'fail' ? t('Fails') : r.state === 'warn' ? t('Partly') : '…') : t('Not run')),
      h('div', null, h('strong', null, t(c.name)), r ? h('p', { class: 'small muted' }, r.msg) : null),
      btn(t('Run'), async (e) => { checkResults[c.key] = { state: '', msg: t('Running…') }; draw(); checkResults[c.key] = await safeRun(c.run); lsSet('checks', checkResults); draw(); }, { size: 'sm' }),
    ];
  }));
  draw();
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, Caps.inArtifact ? (Store.mode === 'cloud' ? t('These test what works in this Claude artifact on this device, with your server. Open a video and select a clip first so the video and pitch checks have something to test.') : t('These test what works in this Claude artifact on this device, with your storage. Open a video and select a clip first so the video and pitch checks have something to test.')) : (Store.mode === 'cloud' ? t('These test what works in this browser on this device, with your server. Open a video and select a clip first so the video and pitch checks have something to test.') : t('These test what works in this browser on this device, with your storage. Open a video and select a clip first so the video and pitch checks have something to test.'))),
    btn(t('Run all checks'), async () => { for (const c of CHECKS) { checkResults[c.key] = { state: '', msg: t('Running…') }; draw(); checkResults[c.key] = await safeRun(c.run); draw(); } lsSet('checks', checkResults); }, { kind: 'primary', icon: 'flask' }),
    grid);
}
async function safeRun(fn) { try { return await fn(); } catch (e) { return { state: 'fail', msg: t('Error: {error}', { error: e.message || e.code || e }) }; } }

async function checkStorage() {
  if (Store.mode === 'cloud') {
    await Api.req('PUT', '/api/docs/meta/probe', { at: new Date().toISOString() });
    await Api.req('DELETE', '/api/docs/meta/probe');
    return { state: 'ok', msg: Api.email ? t('Your account’s database saves and reads back (signed in as {email}). Your data follows you to any device.', { email: Api.email }) : t('Your account’s database saves and reads back. Your data follows you to any device.') };
  }
  if (Store.mode === 'artifact') {
    const ref = Caps.db.collection('meta').doc('probe');
    await ref.set({ at: new Date().toISOString() });
    const snap = await ref.get();
    await ref.delete();
    return snap.exists ? { state: 'ok', msg: t('The artifact’s database saves and reads back. Your data follows you to any device.') } : { state: 'fail', msg: t('A test write didn’t read back.') };
  }
  if (Store.mode === 'local') return { state: 'warn', msg: t('Saving works, but only in this browser on this device. Use Settings → Data → Export backup to move it.') };
  return { state: 'fail', msg: t('Storage is blocked here; nothing is kept.') };
}
async function checkFiles() {
  if (Store.blobMode === 'device') {
    // straight to device storage, so the test file never syncs anywhere
    const id = `probe-${uid()}`;
    await DeviceFiles.put(id, new Blob([new Uint8Array(4096)], { type: 'audio/webm' }));
    const back = await DeviceFiles.get(id);
    await DeviceFiles.del(id);
    if (!back || back.size !== 4096) return { state: 'fail', msg: t('A test file didn’t read back from this device’s storage.') };
    const q = await DeviceFiles.estimate();
    const free = q ? ` ${t('About {gb} GB free for this browser.', { gb: fmtNum((q.quota - q.usage) / 1073741824, 1) })}` : '';
    return Drive.connected()
      ? { state: 'ok', msg: t('Recordings and videos go into your Google Drive, with a copy in this browser for quick playback.') + free }
      : { state: 'warn', msg: t('Recordings and videos are only in this browser. Connect Google Drive in Settings → Storage to keep them safe and on your other devices.') + free };
  }
  if (Store.blobMode === 'assets') {
    const blob = new Blob([new Uint8Array(2048)], { type: 'video/webm' });
    const r = await Caps.assets.upload(blob, { type: 'video/webm' });
    const list = await Caps.assets.list();
    await Caps.assets.delete(r.id);
    const u = list.usage;
    const mins = Math.floor((u.maxBytes - u.bytes) / (16000 * 60));
    return { state: 'ok', msg: t('File storage works. {used} of {max} MB used, {files}/{maxFiles} files; 20 MB per recording maximum (about {mins} more minutes of recordings at typical quality).', { used: (u.bytes / 1048576).toFixed(1), max: (u.maxBytes / 1048576).toFixed(0), files: u.files, maxFiles: u.maxFiles, mins }) };
  }
  return { state: 'fail', msg: t('Recordings can’t be kept here.') };
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
  return peak > -70 ? { state: 'ok', msg: t('The microphone works (peak level {db} dB in 1.5 s).', { db: peak.toFixed(0) }) } : { state: 'warn', msg: t('The microphone opened but heard silence. Check the input device.') };
}
async function checkVideoPlays() {
  const v = Player.current();
  if (!v) return { state: '', msg: t('Open a video first.') };
  if (LocalFiles.get(v.id)) return { state: 'warn', msg: t('Playing from a file on this device, so the link wasn’t tested.') };
  const r = await checkPlayable(videoSrc(v));
  return r.ok ? { state: 'ok', msg: v.fileRef || v.assetId ? t('“{title}” plays from its stored copy ({time} long).', { title: v.title, time: fmtTime(r.duration) }) : t('“{title}” plays from its link ({time} long).', { title: v.title, time: fmtTime(r.duration) }) } : { state: 'fail', msg: r.reason };
}
async function checkVideoSound() {
  const v = Player.current();
  if (!v) return { state: '', msg: t('Open a video first.') };
  VideoAudio.cache.delete(v.id);
  const t0 = performance.now();
  const r = await VideoAudio.ensure(v, 0, 10);
  const secs = fmtNum((performance.now() - t0) / 1000, 1);
  if (r.status === 'ready') return { state: 'ok', msg: r.method === 'partial'
    ? t('The app reads just the part of “{title}” it needs (10 s of sound in {secs} s, decoded with {via}). Pitch and waveform will work.', { title: v.title, secs, via: r.via })
    : t('The app can read the sound of “{title}”, but has to download the whole file each visit ({secs} s here){why}.', { title: v.title, secs, why: r.mp4Failed ? `: ${r.mp4Failed}` : '' }) };
  return { state: 'fail', msg: r.error };
}
async function checkClaude() {
  if (Store.mode === 'cloud') {
    if (!Api.ai) return { state: 'warn', msg: t('No AI key saved, so notes offer “Copy prompt for AI”. Add a key in Settings → AI to get answers in the app.') };
    const r = await Api.req('POST', '/api/ai/test', { profile: profileForAI() });
    return r.ok ? { state: 'ok', msg: t('{provider} answered with {model} in {secs} s.', { provider: Api.ai.providerName, model: r.model, secs: (r.ms / 1000).toFixed(1) }) } : { state: 'warn', msg: t('The model answered in an unexpected format. Try another model in Settings → AI.') };
  }
  if (!Caps.sample) return { state: 'fail', msg: Caps.inArtifact ? t('Claude access isn’t available in this view.') : t('This standalone version can’t reach Claude. Notes offer “Copy prompt for Claude” instead.') };
  const r = await Caps.sample('Reply with just the word OK.', { modelTier: 'quick', cache: false });
  return /ok/i.test(r.text) ? { state: 'ok', msg: t('Claude answered. Feedback on notes will use your Claude plan.') } : { state: 'warn', msg: t('Claude answered unexpectedly: “{text}”', { text: r.text.slice(0, 60) }) };
}
async function checkPitch() {
  const clips = Store.all('clips').filter((c) => c.model);
  if (!clips.length) return { state: '', msg: t('Save a clip whose sound can be read first.') };
  const rel = clips.map((c) => c.model.reliability || 0);
  const avg = mean(rel);
  const weak = clips.filter((c) => (c.model.reliability || 0) < 0.55);
  return { state: avg > 0.7 ? 'ok' : avg > 0.5 ? 'warn' : 'fail', msg: tp(clips.length, 'On average {pct}% of voiced speech gets a reliable pitch reading across {n} clip.', 'On average {pct}% of voiced speech gets a reliable pitch reading across {n} clips.', { pct: Math.round(avg * 100) }) + (weak.length ? ` ${tp(weak.length, '{n} clip is patchy (background noise); flag it as noisy if the line jumps.', '{n} clips are patchy (background noise); flag them as noisy if the line jumps.')}` : '') };
}
async function checkAlign() {
  const recs = Store.all('recordings').filter((r) => r.kind === 'pass' && r.score != null).sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 12);
  if (!recs.length) return { state: '', msg: t('Record a few passes first.') };
  const good = recs.filter((r) => r.score > 0.3);
  const share = good.length / recs.length;
  return { state: share > 0.75 ? 'ok' : share > 0.4 ? 'warn' : 'fail', msg: t('{good} of the last {total} recorded passes lined up automatically (average match {score}). When it fails, the manual offset in Settings is used.', { good: good.length, total: recs.length, score: mean(recs.map((r) => r.score)).toFixed(2) }) };
}

/* ---------- shortcuts ---------- */
function openShortcuts() {
  const K = (k) => h('span', { class: 'kbd' }, k);
  openModal([
    modalHead(t('Keyboard shortcuts')),
    h('div', { class: 'keys' },
      h('span', null, K(t('Space'))), h('span', null, t('Play / pause (pauses the session too)')),
      h('span', null, K('R')), h('span', null, t('Replay the loop from the start (repeats the pass in a session)')),
      h('span', null, K('C')), h('span', null, t('Clip mode on / off (drag on the timeline to select a clip)')),
      h('span', null, K('I'), ' ', K('[')), h('span', null, t('Mark clip start at the playhead')),
      h('span', null, K('O'), ' ', K(']')), h('span', null, t('Mark clip end at the playhead')),
      h('span', null, K(','), ' ', K('.')), h('span', null, t('Slower / faster (0.5x, 0.75x, 1x)')),
      h('span', null, K('L')), h('span', null, t('Loop on / off')),
      h('span', null, K('←'), ' ', K('→')), h('span', null, t('Back / forward 2 seconds')),
      h('span', null, K('Enter')), h('span', null, t('Start the step or recording when a session is waiting')),
      h('span', null, K('Esc')), h('span', null, t('Close a window, or cancel a new clip')),
      h('span', null, K('?')), h('span', null, t('Show this help'))),
  ], { narrow: true });
}

/* ---------- reminders: notifications on each device and/or Discord ---------- */
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
    mount(wrap, h('p', { class: 'muted' }, t('Reminders need the online version of the app (they’re sent by the server).')));
    return wrap;
  }
  let status = null; // {configured, last, discord: {configured, hint}, push: {available, publicKey, devices, thisDevice}}
  let replacing = false;
  const load = async () => {
    const sub = await Push.current().catch(() => null);
    const d = await Api.req('GET', `/api/reminders${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''}`);
    status = { ...d, discord: d.discord || { configured: d.configured, hint: d.hint } };
    draw();
  };
  const draw = () => {
    const r = reminderSettings();
    const discord = status && status.discord;
    const hook = !status ? h('p', { class: 'small muted' }, t('Checking…'))
      : discord.configured && !replacing
        ? h('div', { class: 'row' },
          h('span', { class: 'chip' }, icon('check'), t('Webhook saved ({hint})', { hint: discord.hint })),
          btn(t('Replace'), () => { replacing = true; draw(); }, { size: 'sm' }),
          btn(t('Remove'), async () => { await Api.req('PUT', '/api/reminders', { webhook: null }); toast(t('Webhook removed.')); load().catch(() => {}); }, { size: 'sm', kind: 'ghost' }))
        : (() => {
          const input = h('input', { type: 'password', id: 'rem-hook', placeholder: 'https://discord.com/api/webhooks/…', autocomplete: 'off', spellcheck: 'false' });
          return h('div', { class: 'stack' },
            h('label', { class: 'field', for: 'rem-hook' }, t('Discord webhook link'), input),
            h('p', { class: 'small muted' }, t('In Discord: Server settings → Integrations → Webhooks → New Webhook, choose the channel, then Copy Webhook URL. It’s stored on the server only and never shown again.')),
            h('div', { class: 'row' },
              btn(t('Save webhook'), async () => {
                try {
                  const res = await Api.req('PUT', '/api/reminders', { webhook: input.value.trim() });
                  status = { ...status, configured: true, discord: { configured: true, hint: res.hint } }; replacing = false;
                  if (!reminderSettings().enabled) saveReminders({ enabled: true });
                  draw(); toast(t('Webhook saved. Reminders are on.'), 'good');
                } catch (e) { toast(e.message, 'bad', 7000); }
              }, { kind: 'primary', size: 'sm' }),
              replacing ? btn(t('Cancel'), () => { replacing = false; draw(); }, { size: 'sm', kind: 'ghost' }) : null));
        })();
    const dayBtns = [1, 2, 3, 4, 5, 6, 0].map((d) => btn(dayName(d), () => {
      const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d];
      saveReminders({ days }); draw();
    }, { size: 'sm', on: r.days.includes(d), pressed: r.days.includes(d) }));
    const last = status && status.last;
    mount(wrap,
      h('p', { class: 'muted' }, t('Get a nudge when it’s time to practise: a notification on your phone or computer, a Discord message, or both. If you’ve already practised that day, it stays quiet.')),
      pushCard(status, { onChange: () => load().catch((e) => toast(e.message, 'bad')) }),
      h('div', { class: 'card stack' }, h('h3', null, 'Discord'),
        h('p', { class: 'small muted' }, t('Reminders posted to a Discord channel, with a link straight to the app.')),
        hook,
        h('label', { class: 'field', for: 'rem-user' }, t('Your Discord user ID (optional, to get pinged)'),
          h('input', { type: 'text', id: 'rem-user', inputmode: 'numeric', placeholder: t('e.g. 123456789012345678'), value: r.discordUserId, autocomplete: 'off', spellcheck: 'false', onchange: (e) => {
            const id = e.target.value.replace(/\s/g, '');
            if (id && !/^\d{17,20}$/.test(id)) { toast(t('That doesn’t look like a Discord user ID (17 to 20 digits).'), 'bad', 7000); return; }
            saveReminders({ discordUserId: id }); toast(id ? t('You’ll be pinged in reminders.') : t('Reminders won’t ping you.'));
          } })),
        h('p', { class: 'small muted' }, t('In Discord: Settings → Advanced → turn on Developer Mode, then right-click your name → Copy User ID. Leave empty for reminders without a ping.'))),
      h('div', { class: 'card stack' }, h('h3', null, t('When')),
      h('label', { class: 'check', for: 'rem-on' }, h('input', { type: 'checkbox', id: 'rem-on', checked: r.enabled, disabled: !(status && status.configured), onchange: (e) => { saveReminders({ enabled: e.target.checked }); draw(); } }), t('Send reminders')),
      h('div', { class: 'row' },
        h('label', { class: 'field', for: 'rem-time' }, t('Reminder time'), h('input', { type: 'time', id: 'rem-time', value: r.time, step: 900, onchange: (e) => { if (e.target.value) saveReminders({ time: e.target.value }); } })),
        h('label', { class: 'field', for: 'rem-late' }, t('Second nudge if I still haven’t (optional)'), h('input', { type: 'time', id: 'rem-late', value: r.lateTime, step: 900, onchange: (e) => saveReminders({ lateTime: e.target.value || '' }) }))),
      h('div', { class: 'stack' }, h('span', { class: 'label' }, t('Days')), h('div', { class: 'row' }, dayBtns)),
      h('label', { class: 'check', for: 'rem-skip' }, h('input', { type: 'checkbox', id: 'rem-skip', checked: r.skipIfDone, onchange: (e) => saveReminders({ skipIfDone: e.target.checked }) }), t('Skip the reminder if I’ve already practised that day')),
      h('label', { class: 'check', for: 'rem-ci' }, h('input', { type: 'checkbox', id: 'rem-ci', checked: r.checkins, onchange: (e) => saveReminders({ checkins: e.target.checked }) }), t('Mention when a check-in is due')),
      h('p', { class: 'small muted' }, t('Times are in {tz} (this device’s time zone). Reminders go out within 15 minutes of the time you set.', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })),
      h('div', { class: 'row' },
        btn(t('Send a test'), async () => {
          try { await Api.req('POST', '/api/reminders/test', { appUrl: location.origin, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); toast(t('Test sent. Check your notifications or Discord.'), 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
        }, { size: 'sm', icon: 'bell', disabled: !(status && status.configured) }),
        last ? h('span', { class: 'small muted' }, last.ok ? t('Last reminder {when}: sent', { when: fmtReminderWhen(last.at) }) : t('Last reminder {when}: failed ({error})', { when: fmtReminderWhen(last.at), error: last.error })) : null)));
  };
  draw();
  load().catch((e) => { status = { configured: false, discord: { configured: false } }; draw(); toast(e.message, 'bad'); });
  return wrap;
}
function fmtReminderWhen(iso) {
  return fmtDate(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
