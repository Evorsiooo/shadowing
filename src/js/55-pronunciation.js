/* ---------- Pronunciation tab in the analysis panel ----------
   The clip's words as a sentence. Words whose sounds differ from the speaker's are marked; one of them at a time is
   opened below with the speaker's sounds and yours, each playable. Press a word to play from there (never during a
   pass); the word being said is underlined as the clip plays. At most three differences, most certain first.
   The data comes through PronSource (54-pron-source.js). The wording is "differences from the speaker". */
const PronTab = {
  top: lsGet('pronTop', 'words'), // 'phones': show the sounds under every word, not only the ones that differ
  sel: 0, selFor: null, // the difference that is open
  cache: new Map(), // `${clipId}:${recId}` -> PronResult
  asked: new Set(),
  /* "Sounds the same to me" for one word: saved in the synced pronunciation document (meta/pron), so every device and a reinstall keep it.
     Older ones kept only in this browser are moved over the first time they are read. */
  dismissed: {
    list() {
      const d = Pron.doc(), old = lsGet('pronDismissed', null);
      if (old && old.length && Store.get('meta', 'pron')) { d.dismissedWords = [...new Set([...(d.dismissedWords || []), ...old])].slice(-500); Pron.save(d); lsSet('pronDismissed', null); }
      return d.dismissedWords || [];
    },
    has(k) { return this.list().includes(k); },
    add(k) { const d = Pron.doc(); d.dismissedWords = [...this.list().filter((x) => x !== k), k].slice(-500); Pron.save(d); },
  },
  wordsFailed: new Set(), // clips whose words couldn't be read this time
  noWords: false, // the source gave sounds but no words: show sounds only
  MAX: 3, // at most this many differences are shown for a take

  /* the take to compare: the pass just recorded, else the clip's newest saved recording */
  take(clip) {
    const R = Session.review;
    if (Session.active && R && R.clipId === clip.id) return { id: R.recId, blob: R.blob, url: R.url, analysis: R.analysis };
    const rec = Store.all('recordings').filter((r) => r.clipId === clip.id && r.kind === 'pass' && r.ref).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
    return rec ? { id: rec.id, ref: rec.ref, url: null, analysis: rec.analysis } : null;
  },
  takeKey(clip) { const k = this.take(clip); return k ? k.id || 'review' : 'none'; },
  async takeUrl(take) { if (!take.url) take.url = await Store.blobUrl(take.ref); return take.url; },
  label(w) { return w.text || pvPlain(w.phones, 'spk'); },
  skey(clip, w) { return `${clip.id}|${PronTab.label(w)}|${w.phones.map((p) => (p.spk || '') + '>' + (p.you || '')).join(',')}`; },
  /* the differences worth showing: not dismissed, most certain first, at most MAX */
  shown(clip, res) {
    return res.confidence === 'low' ? [] : res.words.filter((w) => w.differs && !this.dismissed.has(this.skey(clip, w))).sort((a, b) => b.confidence - a.confidence).slice(0, this.MAX);
  },
  dismiss(clip, w) {
    this.dismissed.add(this.skey(clip, w));
  },
};

/* phone pairs as text, the differing symbols marked: spk side or you side */
function pvPhones(phones, who) {
  const out = [];
  for (const p of phones) {
    const v = p[who];
    if (p.spk === p.you) out.push(v);
    else out.push(h('b', { class: 'x' }, v || '∅'));
  }
  return out;
}
const pvPlain = (phones, who) => phones.map((p) => p[who] || '').join('');
/* the first difference in a word, in words */
function pvWhy(w) {
  const p = w.phones.find((x) => x.spk !== x.you);
  if (!p) return '';
  if (!p.you) return t('The speaker says {a} here; you may have left it out.', { a: p.spk });
  if (!p.spk) return t('You may have added {b} here.', { b: p.you });
  return t('The speaker has {a} here; you may have said {b}.', { a: p.spk, b: p.you });
}

/* a message in the Pronunciation tab; outside a session Euno shows what's going on (in a session he is on the session card) */
function pvMsg(mood, title, body, ...actions) {
  return h('div', { class: 'panel-msg pv-msg' }, Session.active ? null : Euno.el('panel', mood), h('h3', null, title), body ? h('p', null, body) : null, actions.length ? h('div', { class: 'row' }, actions) : null);
}

function buildPronView(clip) {
  const root = h('div', { class: 'pv' });
  const stop = PronSource.onStatus(() => { if (root.isConnected) fill(); else stop(); });
  let failed = null, failedMsg = '', cancelled = false, stopped = false, ctl = null;
  let stallShown = false;
  const tick = setInterval(() => {
    if (!root.isConnected) return clearInterval(tick);
    if (!prog.p) paintProg(); // the label changes with what it is waiting for
    if (dlStalled(PronSource.status()) !== stallShown) fill(); // the "no data" warning needs time to pass, not an event
  }, 1000);

  function fill() {
    Panel.canvas = null;
    Panel.refs = {};
    stallShown = false;
    const sup = PronSource.supported();
    if (!sup.ok) return mount(root, pvMsg('confused', t('This browser can’t run the pronunciation check'), t('It needs a recent Chrome, Edge, Firefox or Safari on a computer. Pitch and Waveform still work here.')));
    const m = PronSource.status(), mb = Math.round(m.bytes / 1e6) || 71, pct = Math.round(m.progress * 100);
    if (m.state === 'unsupported') return mount(root, pvMsg('confused', t('This browser can’t run the pronunciation check'), t('It needs a recent Chrome, Edge, Firefox or Safari on a computer. Pitch and Waveform still work here.')));
    // The download starts when the learner turns the switch on (Settings → Analysis). This prompt is only for a download that was interrupted, or a build without the switch.
    if (m.state === 'not-downloaded') return mount(root, pvMsg('waiting', t('The pronunciation model isn’t on this device yet'),
      t('It compares your take with the speaker, sound by sound, and runs on this device: your voice isn’t sent anywhere. It needs a one-time download of {mb} MB.', { mb }),
      btn(t('Download the model ({mb} MB)', { mb }), () => { stopped = false; PronSource.download().catch(() => {}); }, { kind: 'primary', icon: 'download' })));
    if (m.state === 'downloading') {
      const p = dlParts(m, mb), stalled = dlStalled(m);
      stallShown = stalled;
      return mount(root, pvMsg('working', t('Downloading the model…'), null,
        h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.pct }, h('i', { style: { width: p.pct + '%' } })),
        h('span', { class: 'small muted' }, p.text),
        stalled ? h('span', { class: 'small pv-stall' }, t('No data for a while. Check your connection; if it doesn’t pick up, the download stops by itself.')) : h('span', { class: 'small muted' }, t('You can leave this tab; it keeps going. The progress is also in Settings → Analysis.')),
        btn(t('Cancel download'), () => { Heavy.disable('pronunciation'); renderPanel(); }, { size: 'sm', kind: 'ghost' })));
    }
    if (m.state === 'downloaded' && stopped) return mount(root, pvMsg('drowsy', t('Stopped'), t('The model is downloaded but not started.'), btn(t('Start it'), () => { stopped = false; fill(); }, { kind: 'primary' })));
    if (m.state === 'error') return mount(root, pvMsg('confused', t('The pronunciation check couldn’t start'), (m.error && m.error.message) || null, btn(t('Try again'), () => { stopped = false; PronSource.load().catch(() => {}); }, { kind: 'primary' })));
    // from here on one screen covers everything: loading the model, the speaker's sounds and words (kept on the clip once, 27-prepare.js), your take, the comparison
    const take = PronTab.take(clip);
    const key = `${clip.id}:${take ? take.id || 'review' : 'none'}`;
    const res = PronTab.cache.get(key);
    if (failed === key) return mount(root, pvMsg('confused', cancelled ? t('Stopped') : t('The comparison didn’t work'), cancelled ? t('You stopped the comparison.') : (failedMsg || t('Something went wrong while comparing. Try again.')), btn(t('Try again'), () => { failed = null; failedMsg = ''; cancelled = false; fill(); }, { kind: 'primary' })));
    if (!res) {
      mount(root, pvMsg('pondering', take ? t('Comparing your take with the speaker…') : t('Reading the speaker…'), t('It runs on your device. The speaker’s sounds and words are kept with the clip, so next time only your take is read.'),
        h('div', { class: 'pv-prog pv-ana', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, h('i', { class: 'pv-ana-bar', style: { width: '0%' } })), h('span', { class: 'small muted pv-ana-label' }, waitLabel()),
        btn(t('Cancel'), () => { cancelled = true; failed = key; ctl && ctl.abort(); PronSource.stop(); fill(); }, { size: 'sm', kind: 'ghost' })));
      paintProg();
      if (!PronTab.asked.has(key)) {
        PronTab.asked.add(key);
        prog = { p: null, phase: '' };
        ctl = new AbortController();
        const mine = ctl;
        PronSource.analyse(clip, take, mine.signal, showProg)
          .then((r) => { PronTab.cache.set(key, r); })
          .catch((e) => { failed = key; cancelled = mine.signal.aborted; failedMsg = cancelled ? '' : Pron.reason(e); if (!cancelled) console.warn('pronunciation comparison failed:', failedMsg, e); })
          .finally(() => { PronTab.asked.delete(key); if (root.isConnected) fill(); });
      }
      return;
    }
    mount(root, renderResult(clip, res, take));
  }

  /* the one progress screen: its state lives here, not in the elements, because the screen is redrawn whenever the model's status changes */
  let prog = { p: null, phase: '' };
  const STAGE_NAME = { speaker: N_('reading the speaker’s sounds'), words: N_('reading the speaker’s words'), take: N_('reading your take'), compare: N_('comparing the two') };
  function waitLabel() {
    const { p, phase } = prog;
    if (p) return t('Step {n} of {m}: {what} · {pct}%', { n: p.step, m: p.steps, what: t(STAGE_NAME[p.stage] || ''), pct: Math.round(p.fraction * 100) });
    if (phase === 'speaker-audio') return t('Getting the speaker’s audio from the video…');
    if (phase === 'take-audio') return t('Reading your recording…');
    if (PronSource.status().state === 'loading') return t('Loading the model into memory…');
    const cur = Heavy.running();
    return cur && cur !== 'pronunciation' && Heavy.spec(cur) ? t('Waiting for “{name}” to finish first…', { name: t(Heavy.spec(cur).name) }) : t('Starting…');
  }
  function paintProg() {
    const bar = root.querySelector('.pv-ana-bar'), label = root.querySelector('.pv-ana-label');
    if (!bar || !label) return;
    const pct = prog.p ? Math.round(prog.p.fraction * 100) : 0;
    bar.style.width = pct + '%';
    bar.parentNode.setAttribute('aria-valuenow', pct);
    label.textContent = waitLabel();
  }
  function showProg(p) { if (p.phase) prog.phase = p.phase; else prog.p = p; paintProg(); }

  /* ---- the word labels (src/js/26-words.js): off until the learner asks; sounds are shown either way ---- */
  const wordsFailed = PronTab.wordsFailed;
  const relabel = (clip) => { for (const k of [...PronTab.cache.keys()]) if (k.startsWith(clip.id + ':')) PronTab.cache.delete(k); };
  function startWords(clip) {
    clip = Store.get('clips', clip.id) || clip;
    if (Words.isRunning(clip.id)) return;
    wordsFailed.delete(clip.id);
    Words.ensure(clip)
      .then((w) => { if (w) relabel(clip); else wordsFailed.add(clip.id); }) // null: feature off or the clip's sound isn't ready
      .catch(() => { wordsFailed.add(clip.id); })
      .finally(() => { if (root.isConnected) fill(); });
    if (root.isConnected) setTimeout(fill); // show "reading the words"
  }
  function wordsBlock(clip) {
    clip = Store.get('clips', clip.id) || clip;
    const has = clip.words && clip.words.length;
    if (has) {
      return h('div', { class: 'pv-words small muted' },
        clip.wordsFor && clip.wordsFor.timing === 'phrase' ? h('span', null, t('This device couldn’t time each word, so the words aren’t placed on the sounds.')) : null,
        h('span', null, t('Words are read automatically and can be wrong.')),
        btn(t('Fix words'), () => openWordsEditor(clip, () => { relabel(clip); if (root.isConnected) fill(); }), { size: 'sm', kind: 'ghost' }));
    }
    if (clip.wordsFor) return h('div', { class: 'pv-words small muted' }, t('No words were recognised in this clip, so only sounds are shown.'));
    if (!Words.supported().ok || Heavy.check('words').level === 'no') return null;
    if (Heavy.isOn('words')) {
      if (Words.isRunning(clip.id)) return wordsProgress();
      if (wordsFailed.has(clip.id)) return h('div', { class: 'pv-words small muted' }, t('The words couldn’t be read for this clip, so only sounds are shown.'), btn(t('Try again'), () => startWords(clip), { size: 'sm', kind: 'ghost' }));
      setTimeout(() => { if (root.isConnected && !Words.isRunning(clip.id)) startWords(clip); }); // on and not read yet: read it now, after the sounds
      return wordsProgress();
    }
    const chk = Heavy.check('words'), mb = Heavy.spec('words').sizeMB;
    return h('div', { class: 'pv-words card' },
      h('b', null, t('Show the words too?')),
      h('p', { class: 'small' }, t('The clip has no transcript, so Euno can read the words with a speech model that runs on this device (nothing is sent anywhere). It can mishear, and you can fix a word. Without it you still get the sounds.')),
      chk.reasons.length ? h('ul', { class: 'small' }, chk.reasons.map((r) => h('li', null, r))) : null,
      h('div', { class: 'row' }, btn(t('Get words ({mb} MB)', { mb }), () => { if (Heavy.enable('words')) startWords(clip); }, { kind: 'primary', icon: 'download' }),
        h('span', { class: 'small muted' }, t('One-time download. You can delete it in Settings → Analysis.'))));
  }
  function wordsProgress() {
    const bar = h('i'), label = h('span', { class: 'small muted' });
    const box = h('div', { class: 'pv-words', role: 'status' }, label, h('div', { class: 'pv-prog', 'aria-hidden': 'true' }, bar));
    const draw = (m) => {
      const pct = Math.round(m.progress * 100);
      label.textContent = m.state === 'downloading' ? t('Downloading the word model… {pct}% of {mb} MB', { pct, mb: Heavy.spec('words').sizeMB }) : t('Reading the words…');
      box.querySelector('.pv-prog').hidden = m.state !== 'downloading';
      bar.style.width = pct + '%';
    };
    draw(Words.status());
    const stop = Words.onStatus((m) => { if (box.isConnected) draw(m); else stop(); });
    return box;
  }

  /* The result reads like the clip itself: its words as a sentence, the ones whose sounds differ marked, and one
     difference at a time opened below with the speaker's sounds and yours, each playable. While the clip plays,
     the word being said is underlined. */
  function renderResult(clip, res, take) {
    const hasWords = res.words.some((w) => w.text); // a word the recogniser skipped shows its sounds instead
    if (PronTab.noWords === hasWords) { PronTab.noWords = !hasWords; setTimeout(renderPanel); }
    const allSounds = PronTab.top === 'phones' || !hasWords;
    const shown = PronTab.shown(clip, res).sort((a, b) => res.words.indexOf(a) - res.words.indexOf(b)); // stepped through in the order they are said
    const hidden = res.hidden || 0;
    const name = speakerName(Store.get('videos', clip.videoId));
    const selKey = `${clip.id}:${take ? take.id || 'review' : 'none'}`;
    if (PronTab.selFor !== selKey) { PronTab.selFor = selKey; PronTab.sel = 0; }
    const sel = shown.length ? shown[clamp(PronTab.sel, 0, shown.length - 1)] : null;
    const stateOf = (w) => (!take || res.confidence === 'low' ? 'none' : shown.includes(w) ? 'diff' : w.differs && !PronTab.dismissed.has(PronTab.skey(clip, w)) ? 'none' : 'ok');
    const pick = (w) => { PronTab.sel = shown.indexOf(w); fill(); };

    // the sentence
    const words = res.words.map((w) => {
      const st = stateOf(w);
      const label = w.text ? w.text : h('span', { class: 'ipa' }, pvPlain(w.phones, 'spk'));
      const sounds = (allSounds || st === 'diff') && w.text ? h('span', { class: 'pv-ipa ipa' }, pvPlain(w.phones, 'spk')) : null;
      const el = h('button', {
        type: 'button', class: `pv-w ${st}${w === sel ? ' sel' : ''}`,
        title: st === 'diff' ? t('Sounds differ from {name} here', { name }) : null,
        onclick: () => {
          if (st === 'diff' && w !== sel) { pick(w); return; }
          if (analysisCanScrub()) Player.seek(clip.start + Math.max(0, w.start - 0.05));
        },
      }, h('span', { class: 'pv-t' }, label), sounds);
      return { w, el };
    });
    Panel.canvas = null;
    Panel.refs = { words, now: null };
    const line = h('div', { class: 'pv-line', 'aria-label': t('The words of the clip') }, words.map((x) => x.el));

    // what the comparison found, in one line
    let sum, warn = false;
    if (!take) sum = t('Record a pass and Euno shows where your sounds differ from {name}.', { name });
    else if (res.confidence === 'low' && res.lowWho === 'speaker') { sum = t('The speaker’s sound is hard to analyse here (music, noise or overlapping voices), so no differences are shown.'); warn = true; }
    else if (res.confidence === 'low') { sum = t('Hard to tell for this take (too quiet, noisy or cut short), so no differences are shown. Try recording again closer to the microphone.'); warn = true; }
    else if (!shown.length) sum = t('Your sounds match {name} in this take. No clear differences.', { name });
    else sum = tp(shown.length, 'One place where your sounds differ from {name}.', '{n} places where your sounds differ from {name}.', { name });
    const head = h('div', { class: 'pv-sum' }, h('p', { class: warn ? 'warn' : null }, sum), h('span', { class: 'pv-beta' }, t('beta')));

    // the open difference
    let detail = null;
    if (sel) {
      const i = shown.indexOf(sel);
      const word = PronTab.label(sel);
      const nav = shown.length > 1 ? h('div', { class: 'pv-nav' },
        btn('', () => { PronTab.sel = (i - 1 + shown.length) % shown.length; fill(); }, { size: 'sm', icon: 'back', aria: t('Previous difference'), title: t('Previous difference') }),
        h('span', { class: 'small muted num' }, t('{n} of {total}', { n: i + 1, total: shown.length })),
        btn('', () => { PronTab.sel = (i + 1) % shown.length; fill(); }, { size: 'sm', icon: 'back', cls: 'flip', aria: t('Next difference'), title: t('Next difference') })) : null;
      const row = (who, tag, cls) => h('div', { class: `pv-row ${cls}` },
        h('span', { class: 'pv-who' }, tag),
        h('span', { class: 'pv-ph ipa' }, pvPhones(sel.phones, who)),
        btn(t('Play'), () => pronPlay(clip, take, sel, who), { size: 'sm', icon: 'play', kind: cls === 'spk' ? 'blue' : 'primary', title: who === 'spk' ? t('Hear the speaker say “{word}”', { word }) : t('Hear how you said “{word}”', { word }) }));
      const both = () => { pronPlay(clip, take, sel, 'spk'); setTimeout(() => pronPlay(clip, take, sel, 'you'), (sel.end - sel.start + 0.6) * 1000 / ((Player.v && Player.v.playbackRate) || 1)); };
      detail = h('div', { class: 'pv-detail' },
        h('div', { class: 'pv-detail-head' }, h('h3', null, word), nav),
        row('spk', name, 'spk'),
        row('you', t('You'), 'you'),
        h('p', { class: 'pv-why' }, pvWhy(sel)),
        h('div', { class: 'row' },
          btn(t('{name}, then you', { name }), both, { icon: 'replay', size: 'sm' }),
          h('span', { class: 'grow' }),
          btn(t('Sounds the same to me'), () => { PronTab.dismiss(clip, sel); fill(); }, { size: 'sm', kind: 'ghost', title: t('Hide this one. It won’t come back for this clip.') })),
        h('p', { class: 'small muted' }, t('Not exact. Listen to both and decide.')));
    }
    return [head, line, detail,
      h('div', { class: 'pv-foot' },
        hidden ? h('p', { class: 'small muted' }, tp(hidden, '{n} more possible difference is hidden because it is less certain.', '{n} more possible differences are hidden because they are less certain.')) : null,
        wordsBlock(clip))];
  }

  fill();
  return root;
}

/* "Fix words": every word of the clip as a text box. The times stay; an empty box removes the word. Fixed words keep a mark so they are
   never taken for the recogniser's own guess. */
function openWordsEditor(clip, done) {
  const words = (clip.words || []).map((x) => ({ ...x }));
  const rows = words.map((x) => {
    const inp = h('input', { type: 'text', value: x.w, 'aria-label': t('Word at {when}', { when: fmtSec(x.s) }), maxlength: 40 });
    return { x, inp };
  });
  const save = () => {
    const out = [];
    rows.forEach(({ x, inp }) => { const v = inp.value.trim(); if (v) out.push(v !== x.w ? { ...x, w: v, x: 1 } : x); });
    Words.edit(clip.id, out);
    closeModal();
    done();
  };
  openModal([
    modalHead(t('Fix the words'), t('Only the spelling changes; each word keeps its place in the clip. Clear a box to remove a word.')),
    h('div', { class: 'pv-edit' }, rows.map(({ x, inp }) => h('label', { class: 'pv-edit-w' }, h('span', { class: 'small muted' }, fmtSec(x.s)), inp))),
    h('div', { class: 'row' }, btn(t('Save'), save, { kind: 'primary' }), btn(t('Cancel'), () => closeModal(), { kind: 'ghost' })),
  ]);
}

/* play one word: the speaker's, or yours lined up with the clip */
async function pronPlay(clip, take, w, who) {
  if (!analysisCanScrub()) { toast(t('Wait until the pass is over, then play it.')); return; } // it used to do nothing, silently
  const from = clip.start + Math.max(0, w.start - 0.12), stopAt = Math.min(clip.end, clip.start + w.end + 0.2);
  if (who === 'spk') {
    stopReviewPlayback();
    Session.preview = { stopAt, then: null };
    Player.seek(from);
    Player.play();
    return;
  }
  const url = await PronTab.takeUrl(take);
  if (!url) { toast(t('That recording couldn’t be found.'), 'bad'); return; }
  playSynced(clip, url, take.analysis, { from, stopAt });
}

Panel.drawPron = function (now) {
  const R = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!R || !R.words || !clip) return;
  const tt = now - clip.start;
  const cur = Player.v && !Player.v.paused ? R.words.find((x) => tt >= x.w.start && tt < x.w.end) : null;
  if (cur === R.now) return;
  if (R.now) R.now.el.classList.remove('now');
  if (cur) cur.el.classList.add('now');
  R.now = cur;
};
