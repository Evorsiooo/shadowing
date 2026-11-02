/* ---------- Settings → Analysis: switches for the heavy, in-browser features (see 21-heavy.js) ---------- */
const HEAVY_WHY = {
  crash: N_('the browser stopped while it was running'),
  memory: N_('the device ran out of memory'),
  slow: N_('it ran too slowly on this device'),
  failures: N_('it failed twice in a row'),
};

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
    mount(box,
      h('p', { class: 'muted' }, t('These features run an AI model inside your browser, on this device. They are off until you turn them on, each one downloads a model the first time you use it, and the rest of the app works the same without them. These switches apply to this device only.')),
      h('div', { class: 'card' }, h('h3', null, t('This device')), h('p', { class: 'small muted' }, dev)),
      ids.map((id) => featureCard(id, draw)));
  };
  draw();
  Heavy.refreshDevice().then(() => { if (box.isConnected) draw(); });
  return box;
}

function featureCard(id, redraw) {
  const s = Heavy.spec(id), st = Heavy.state(id), chk = Heavy.check(id), on = Heavy.isOn(id);
  const size = s.sizeMB ? t('Download: about {mb} MB, kept on this device.', { mb: s.sizeMB }) : null;
  const confirmArea = h('div', { class: 'stack' });
  const askOn = () => mount(confirmArea, h('div', { class: 'card' },
    h('p', null, s.sizeMB ? t('{name} downloads about {mb} MB the first time you use it and uses a lot of memory while it runs. If it makes your device struggle, it turns itself off.', { name: t(s.name), mb: s.sizeMB }) : t('{name} uses a lot of memory while it runs. If it makes your device struggle, it turns itself off.', { name: t(s.name) })),
    chk.reasons.length ? h('ul', { class: 'small' }, chk.reasons.map((r) => h('li', null, r))) : null,
    h('div', { class: 'row' }, btn(t('Turn on'), () => { Heavy.enable(id); redraw(); }, { kind: 'primary' }), btn(t('Cancel'), () => mount(confirmArea), { kind: 'ghost' }))));
  return h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h3', { class: 'grow' }, t(s.name)), h('span', { class: `st ${on ? 'ok' : ''}` }, on ? t('On') : t('Off'))),
    s.about ? h('p', { class: 'small' }, t(s.about)) : null,
    size ? h('p', { class: 'small muted' }, size) : null,
    st.off ? h('p', { class: 'small' }, t('Turned off automatically because {why}. Your recordings and everything else are fine.', { why: t(HEAVY_WHY[st.off] || HEAVY_WHY.failures) })) : null,
    chk.level === 'no' ? h('div', null, h('p', { class: 'small' }, t('Not available on this device.')), h('ul', { class: 'small' }, chk.reasons.map((r) => h('li', null, r)))) : null,
    confirmArea,
    h('div', { class: 'row' },
      on ? btn(t('Turn off'), () => { Heavy.disable(id); redraw(); }) : chk.level === 'no' ? null : btn(st.off ? t('Try again') : t('Turn on…'), askOn, { kind: 'primary' }),
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

/* never load a model or run heavy analysis while a pass is being recorded: it could glitch the take */
Heavy.blockers.push(() => !!(Session.active && Session.recordingThisPass));
