/* ---------- Settings → Analysis: switches for the heavy, in-browser features (see 21-heavy.js) ---------- */
const HEAVY_WHY = {
  crash: N_('the browser stopped while it was running'),
  memory: N_('the device ran out of memory'),
  slow: N_('it ran too slowly on this device'),
  failures: N_('it failed twice in a row'),
};

/* a model download as text, bar and the "no data for a while" warning. Shared by Settings → Analysis, the first-run wizard and the Pronunciation tab */
const DL_STALL_WARN_MS = 20000; // Heavy stops a download that sends nothing for a minute (21-heavy.js); the warning comes sooner
function dlStalled(st) { return !!(st && st.state === 'downloading' && st.at && Date.now() - st.at > DL_STALL_WARN_MS); }
function dlParts(st, mb) {
  const pct = Math.round((st.progress || 0) * 100), done = Math.round((st.bytes || 0) / 1e6);
  return { pct, text: st.bytes ? t('{pct}% · {done} of {mb} MB', { pct, done, mb }) : t('{pct}% of {mb} MB', { pct, mb }) };
}

function analysisView() {
  const ids = Heavy.list();
  const box = h('div', { class: 'stack' });
  const draw = () => {
    const d = Heavy.device();
    const dev = [
      d.memGB != null ? t('Memory: {gb} GB or more', { gb: d.memGB }) : t('Memory: not reported by this browser'),
      d.cores != null ? tp(d.cores, '{n} processor core', '{n} processor cores') : null,
      d.mobile ? t('Phone or tablet') : null,
      d.saveData ? t('Data saver on') : null,
      d.storageMB != null ? t('{mb} MB of free storage', { mb: Math.max(0, d.storageMB) }) : null,
    ].filter(Boolean).join(' · ');
    // a feature with a `parent` is an add-on: drawn inside its parent's group
    const group = (id) => [featureCard(id, draw), ...ids.filter((c) => Heavy.spec(c).parent === id).map((c) => h('div', { class: 'nest' }, featureCard(c, draw)))];
    mount(box,
      h('p', { class: 'muted' }, t('These features run an AI model inside your browser, on this device. They are off until you turn them on. Turning one on downloads its model straight away (you see the size first), and the rest of the app works the same without them. These switches apply to this device only.')),
      h('div', { class: 'card' }, h('h3', null, t('This device')), h('p', { class: 'small muted' }, dev)),
      ids.filter((id) => !Heavy.spec(id).parent).map(group),
      libraryCard(draw),
      takesCard());
  };
  draw();
  Heavy.refreshDevice().then(() => { if (box.isConnected) draw(); });
  const stop = Heavy.onChange(() => { if (box.isConnected) draw(); else stop(); });
  return box;
}

/* "Prepare my library": works out the speaker's sounds for clips that don't have them yet (older clips, or clips made while Pronunciation analysis was off),
   so ranking and "Clips for your sounds" cover every clip. Opt-in, one clip at a time in the background (28-rank.js). */
function libraryCard(redraw) {
  if (!Heavy.isOn('pronunciation')) return null;
  const box = h('div', { class: 'card' });
  const paint = () => {
    const c = Rank.counts(), j = Rank.job, ready = Pron.on();
    const missing = c.total - c.ready - c.failed;
    mount(box,
      h('h3', null, t('Prepare my library')),
      h('p', { class: 'small' }, t('New clips get their sounds worked out automatically. Older clips, or ones made while this was off, only get them when you practise them. This does the rest in the background, one clip at a time, so sorting and suggestions cover every clip.')),
      h('p', { class: 'small muted', role: 'status' }, j.running ? t('Working: {done} of {total} done. It pauses while you record or play a video.', { done: j.done, total: j.total }) : t('{ready} of {total} clips are ready.', { ready: c.ready, total: c.total }) + (c.failed ? ' ' + t('{n} couldn’t be read (the video isn’t on this device or the link is down).', { n: c.failed }) : '')),
      j.running ? h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': j.total, 'aria-valuenow': j.done }, h('i', { style: { width: (j.total ? Math.round((j.done / j.total) * 100) : 0) + '%' } })) : null,
      j.error ? h('p', { class: 'small warn' }, j.error) : null,
      !ready ? h('p', { class: 'small muted' }, t('Wait for the pronunciation model to finish downloading first.')) : null,
      h('div', { class: 'row' }, j.running ? btn(t('Stop'), () => Rank.stopLibrary(), { size: 'sm' }) : btn(missing > 0 ? tp(missing, 'Prepare {n} clip', 'Prepare {n} clips') : t('Nothing to prepare'), () => Rank.prepareLibrary(), { kind: 'primary', size: 'sm', disabled: !ready || missing <= 0 })));
  };
  paint();
  const off = Rank.onChange(() => { if (box.isConnected) paint(); else off(); });
  return box;
}

/* "Check my past recordings": the same comparison, run afterwards on takes recorded while Pronunciation analysis was off (28-rank.js, Rank.prepareTakes) */
function takesCard() {
  if (!Heavy.isOn('pronunciation')) return null;
  const box = h('div', { class: 'card' });
  const paint = () => {
    const c = Rank.takeCounts(), j = Rank.tjob, ready = Pron.on();
    mount(box,
      h('h3', null, t('Check my past recordings')),
      h('p', { class: 'small' }, t('Recordings made while Pronunciation analysis was off have no sound differences yet. This runs the same comparison on them now, against the speaker’s audio, one at a time in the background, and files each under the day you recorded it. Your recordings are not changed. Like the rest, the results are a computer’s guesses.')),
      h('p', { class: 'small muted', role: 'status' }, j.running ? t('Working: {done} of {total} done. It pauses while you record or play a video.', { done: j.done, total: j.total }) : (c.waiting ? tp(c.waiting, '{n} recording is waiting to be checked.', '{n} recordings are waiting to be checked.') : t('All your recordings have been checked.')) + (c.failed ? ' ' + tp(c.failed, '{n} couldn’t be checked (the recording or the video isn’t on this device, or the link is down).', '{n} couldn’t be checked (the recording or the video isn’t on this device, or the link is down).') : '')),
      j.running ? h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': j.total, 'aria-valuenow': j.done }, h('i', { style: { width: (j.total ? Math.round((j.done / j.total) * 100) : 0) + '%' } })) : null,
      j.error ? h('p', { class: 'small warn' }, j.error) : null,
      !ready ? h('p', { class: 'small muted' }, t('Wait for the pronunciation model to finish downloading first.')) : null,
      h('div', { class: 'row' }, j.running ? btn(t('Stop'), () => Rank.stopTakes(), { size: 'sm' }) : btn(c.waiting > 0 ? tp(c.waiting, 'Check {n} recording', 'Check {n} recordings') : t('Nothing to check'), () => Rank.prepareTakes(), { kind: 'primary', size: 'sm', disabled: !ready || c.waiting <= 0 })));
  };
  paint();
  const off = Rank.onChange(() => { if (box.isConnected) paint(); else off(); });
  return box;
}

function featureCard(id, redraw) {
  const s = Heavy.spec(id), st = Heavy.state(id), chk = Heavy.check(id), on = Heavy.isOn(id);
  const parentOff = s.parent && !Heavy.isOn(s.parent) && !on; // an add-on needs its parent first
  const size = s.sizeMB ? t('Download: about {mb} MB, kept on this device.', { mb: s.sizeMB }) : t('No download.');
  const confirmArea = h('div', { class: 'stack' });
  const askOn = () => mount(confirmArea, h('div', { class: 'card' },
    h('p', null, s.sizeMB ? t('{name} downloads about {mb} MB as soon as you turn it on, and uses a lot of memory while it runs. If it makes your device struggle, it turns itself off.', { name: t(s.name), mb: s.sizeMB }) : t('{name} uses a little storage and no download. You can turn it off again any time.', { name: t(s.name) })),
    chk.reasons.length ? h('ul', { class: 'small' }, chk.reasons.map((r) => h('li', null, r))) : null,
    h('div', { class: 'row' }, btn(s.sizeMB ? t('Turn on and download') : t('Turn on'), () => { Heavy.enable(id); redraw(); }, { kind: 'primary' }), btn(t('Cancel'), () => mount(confirmArea), { kind: 'ghost' }))));

  /* what the model is doing right now: downloading (with progress and Cancel), stalled, failed, interrupted, or ready */
  const live = h('div', { class: 'stack', role: 'status' });
  const paint = () => {
    const stt = s.status ? s.status() : null, err = Heavy.downloadError(id);
    if (!on || !stt || !s.sizeMB) return mount(live);
    if (stt.state === 'downloading') {
      const p = dlParts(stt, s.sizeMB);
      return mount(live,
        h('span', { class: 'small' }, t('Downloading… {text}', { text: p.text })),
        h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.pct }, h('i', { style: { width: p.pct + '%' } })),
        dlStalled(stt) ? h('span', { class: 'small warn' }, t('No data for a while. If it doesn’t pick up, it stops by itself; you can also cancel and try again.')) : null,
        h('div', { class: 'row' }, btn(t('Cancel download'), () => { Heavy.disable(id); redraw(); }, { size: 'sm', kind: 'ghost' })));
    }
    if (stt.state === 'loading') return mount(live, h('span', { class: 'small' }, t('Getting the model ready…')));
    if (err || stt.state === 'error') return mount(live, h('span', { class: 'small warn' }, t('The download didn’t finish: {why}', { why: err || (stt.error && stt.error.message) || '' })), h('div', { class: 'row' }, btn(t('Try again'), () => { Heavy.download(id); }, { size: 'sm', kind: 'primary' })));
    if (stt.state === 'not-downloaded' && !Heavy.downloading(id)) return mount(live, h('span', { class: 'small' }, t('The download was interrupted.')), h('div', { class: 'row' }, btn(t('Resume download'), () => { Heavy.download(id); }, { size: 'sm', kind: 'primary' })));
    if (stt.state === 'downloaded' || stt.state === 'ready') return mount(live, h('span', { class: 'small ok-text' }, t('Downloaded and ready.')));
    mount(live);
  };
  paint();
  if (s.onStatus) {
    const unsub = s.onStatus(() => { if (live.isConnected) paint(); else unsub(); });
    const tick = setInterval(() => { if (live.isConnected) paint(); else clearInterval(tick); }, 4000); // the "no data" warning needs time to pass, not an event
  }

  return h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h3', { class: 'grow' }, t(s.name)), h('span', { class: `st ${on ? 'ok' : ''}` }, on ? t('On') : t('Off'))),
    s.about ? h('p', { class: 'small' }, t(s.about)) : null,
    h('p', { class: 'small muted' }, size),
    st.off ? h('p', { class: 'small' }, t('Turned off automatically because {why}. Your recordings and everything else are fine.', { why: t(HEAVY_WHY[st.off] || HEAVY_WHY.failures) })) : null,
    chk.level === 'no' ? h('div', null, h('p', { class: 'small' }, t('Not available on this device.')), h('ul', { class: 'small' }, chk.reasons.map((r) => h('li', null, r)))) : null,
    parentOff ? h('p', { class: 'small muted' }, t('Turn on {name} first. This only adds to it.', { name: t(Heavy.spec(s.parent).name) })) : null,
    live,
    confirmArea,
    h('div', { class: 'row' },
      on ? btn(t('Turn off'), () => { Heavy.disable(id); redraw(); }) : chk.level === 'no' || parentOff ? null : btn(st.off ? t('Try again') : t('Turn on…'), askOn, { kind: 'primary' }),
      btn(t('Delete downloaded data'), async () => { await Heavy.removeData(id); toast(t('Deleted. {name} is off.', { name: t(s.name) }), 'good'); redraw(); }, { kind: 'ghost' })));
}

/* tell the learner once when a feature switched itself off (including after a crash found at start-up) */
function announceHeavyOff() {
  for (const id of Heavy.list()) {
    const st = Heavy.state(id);
    if (st.off && !st.noticed) {
      Heavy.markNoticed(id);
      toast(t('{name} was turned off on this device because {why}. You can turn it back on in Settings → Analysis.', { name: t(Heavy.spec(id).name), why: t(HEAVY_WHY[st.off] || HEAVY_WHY.failures) }), '', 9000);
    }
  }
}
Heavy.onChange(announceHeavyOff);
Heavy.onChange(() => { try { renderPanel(); } catch { /* the panel isn't up yet */ } }); // the Pronunciation tab appears or goes away with the switch (the panel only redraws when its key changes)

/* never load a model or run heavy analysis while a pass is being recorded: it could glitch the take */
/* wait only while the microphone is actually recording (Session.rec); recordingThisPass stays true through the review screen and the gap, which made the analysis wait until its time ran out */
Heavy.blockers.push(() => !!(Session.active && Session.rec));

/* background preparation (27-prepare.js) also steps aside for playback anywhere in the app and for a battery that is low and not charging */
let lowBattery = false;
try {
  if (navigator.getBattery) navigator.getBattery().then((b) => {
    const f = () => { lowBattery = !b.charging && b.level < 0.2; };
    f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f);
  }).catch(() => {});
} catch { /* no battery API */ }
Heavy.idleBlockers.push(() => lowBattery || !!(Player.v && !Player.v.paused));
