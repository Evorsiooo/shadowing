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
    ['echoCancellation', 'Echo cancellation (only if you can’t use headphones)', 'bool'],
    ['noiseSuppression', 'Noise suppression', 'bool'],
    ['pitchSmoothing', 'Pitch line smoothing (frames)', 1, 15, 2],
  ] },
];

function openSettings(tab = 'practice') {
  const tabs = [['practice', 'Practice'], ['data', 'Data'], ['checks', 'Device checks'], ['look', 'Appearance']];
  const body = tab === 'practice' ? settingsForm() : tab === 'data' ? dataView() : tab === 'checks' ? checksView() : lookView();
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
    h('p', { class: 'muted' }, `These test what works in this ${Caps.inArtifact ? 'Claude artifact' : 'browser'} on this device. Open a video and select a clip first so the video and pitch checks have something to test.`),
    btn('Run all checks', async () => { for (const c of CHECKS) { checkResults[c.key] = { state: '', msg: 'Running…' }; draw(); checkResults[c.key] = await safeRun(c.run); draw(); } lsSet('checks', checkResults); }, { kind: 'primary', icon: 'flask' }),
    grid);
}
async function safeRun(fn) { try { return await fn(); } catch (e) { return { state: 'fail', msg: `Error: ${e.message || e.code || e}` }; } }

async function checkStorage() {
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
  return r.ok ? { state: 'ok', msg: `“${v.title}” plays from its ${v.assetId ? 'stored copy' : 'link'} (${fmtTime(r.duration)} long).` } : { state: 'fail', msg: r.reason };
}
async function checkVideoSound() {
  const v = Player.current();
  if (!v) return { state: '', msg: 'Open a video first.' };
  VideoAudio.cache.delete(v.id);
  const r = await VideoAudio.load(v);
  if (r.status === 'ready') return { state: 'ok', msg: `The app can read the sound of “${v.title}” (${fmtTime(r.samples.length / SR)} decoded). Pitch and waveform will work.` };
  return { state: 'fail', msg: r.error };
}
async function checkClaude() {
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
