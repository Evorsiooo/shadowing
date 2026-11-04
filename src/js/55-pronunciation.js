/* ---------- Pronunciation tab in the analysis panel ----------
   The clip's words on the same time axis as the Pitch and Waveform charts: one-second lines, an orange
   playhead, press or drag to seek (and never during a pass). A word sits where it was said and the bar under it
   is as long as the word. Green: sounds like the speaker. Orange: differs from the speaker, with a YOU line
   under it showing the sounds that differ. Grey: no comparison (no take yet, or too unsure).
   The data comes through PronSource (54-pron-source.js). The wording is "differences from the speaker". */
const PronTab = {
  top: lsGet('pronTop', 'words'), // which row is big: 'words' or 'phones'
  cache: new Map(), // `${clipId}:${recId}` -> PronResult
  asked: new Set(),
  dismissed: new Set(lsGet('pronDismissed', [])), // "Sounds the same to me", kept on this device
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
    lsSet('pronDismissed', [...this.dismissed].slice(-500));
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

/* shrink a word only if it wouldn't fit before the next word starts */
function pvFit(text, widthPx, maxRem, minRem, em = 0.6) {
  return Math.max(minRem, Math.min(maxRem, widthPx / ((String(text).length || 1) * em * 16))) + 'rem';
}

function pvMsg(title, body, ...actions) {
  return h('div', { class: 'panel-msg pv-msg' }, h('h3', null, title), body ? h('p', null, body) : null, actions.length ? h('div', { class: 'row' }, actions) : null);
}

function buildPronView(clip) {
  const root = h('div', { class: 'pv' });
  const stop = PronSource.onStatus(() => { if (root.isConnected) fill(); else stop(); });
  let failed = null, failedMsg = '', cancelled = false, stopped = false, loadAsked = false, ctl = null;
  const since = {};
  let stallShown = false;
  /* "12 s so far": shows that something is still going on. The timer below keeps the number moving */
  const elapsed = (what) => { since[what] = since[what] || Date.now(); return h('span', { class: 'small muted pv-elapsed', 'data-what': what }, t('{n} s so far', { n: Math.round((Date.now() - since[what]) / 1000) })); };
  const tick = setInterval(() => {
    if (!root.isConnected) return clearInterval(tick);
    const el = root.querySelector('.pv-elapsed');
    if (el) el.textContent = t('{n} s so far', { n: Math.round((Date.now() - since[el.dataset.what]) / 1000) });
    else for (const k of Object.keys(since)) delete since[k];
    if (dlStalled(PronSource.status()) !== stallShown) fill(); // the "no data" warning needs time to pass, not an event
  }, 1000);

  function fill() {
    Panel.canvas = null;
    Panel.refs = {};
    stallShown = false;
    const sup = PronSource.supported();
    if (!sup.ok) return mount(root, pvMsg(t('This browser can’t run the pronunciation check'), t('It needs a recent Chrome, Edge, Firefox or Safari on a computer. Pitch and Waveform still work here.')));
    const m = PronSource.status(), mb = Math.round(m.bytes / 1e6) || 71, pct = Math.round(m.progress * 100);
    if (m.state === 'unsupported') return mount(root, pvMsg(t('This browser can’t run the pronunciation check'), t('It needs a recent Chrome, Edge, Firefox or Safari on a computer. Pitch and Waveform still work here.')));
    // The download starts when the learner turns the switch on (Settings → Analysis). This prompt is only for a download that was interrupted, or a build without the switch.
    if (m.state === 'not-downloaded') return mount(root, pvMsg(t('The pronunciation model isn’t on this device yet'),
      t('It compares your take with the speaker, sound by sound, and runs on this device: your voice isn’t sent anywhere. It needs a one-time download of {mb} MB.', { mb }),
      btn(t('Download the model ({mb} MB)', { mb }), () => { stopped = false; PronSource.download().catch(() => {}); }, { kind: 'primary', icon: 'download' })));
    if (m.state === 'downloading') {
      const p = dlParts(m, mb), stalled = dlStalled(m);
      stallShown = stalled;
      return mount(root, pvMsg(t('Downloading the model…'), null,
        h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.pct }, h('i', { style: { width: p.pct + '%' } })),
        h('span', { class: 'small muted' }, p.text),
        stalled ? h('span', { class: 'small pv-stall' }, t('No data for a while. Check your connection; if it doesn’t pick up, the download stops by itself.')) : h('span', { class: 'small muted' }, t('You can leave this tab; it keeps going. The progress is also in Settings → Analysis.')),
        btn(t('Cancel download'), () => { Heavy.disable('pronunciation'); renderPanel(); }, { size: 'sm', kind: 'ghost' })));
    }
    if (m.state === 'downloaded' && !stopped && !loadAsked) { loadAsked = true; PronSource.load().catch(() => {}).finally(() => { loadAsked = false; }); } // downloaded means "on the device"; it still has to be loaded into memory
    if (m.state === 'downloaded' && stopped) return mount(root, pvMsg(t('Stopped'), t('The model is downloaded but not started.'), btn(t('Start it'), () => { stopped = false; fill(); }, { kind: 'primary' })));
    if (m.state === 'downloaded' || m.state === 'loading') return mount(root, pvMsg(t('Loading the model into memory…'), t('The download is done. This takes a few seconds, longer on a slow device.'),
      h('span', { class: 'pv-spin', 'aria-hidden': 'true' }), elapsed('load'),
      btn(t('Cancel'), () => { stopped = true; PronSource.stop(); fill(); }, { size: 'sm', kind: 'ghost' })));
    if (m.state === 'error') return mount(root, pvMsg(t('The pronunciation check couldn’t start'), (m.error && m.error.message) || null, btn(t('Try again'), () => { stopped = false; PronSource.load().catch(() => {}); }, { kind: 'primary' })));
    const take = PronTab.take(clip);
    const key = `${clip.id}:${take ? take.id || 'review' : 'none'}`;
    const res = PronTab.cache.get(key);
    if (failed === key) return mount(root, pvMsg(cancelled ? t('Stopped') : t('The comparison didn’t work'), cancelled ? t('You stopped the comparison.') : (failedMsg || t('Something went wrong while comparing. Try again.')), btn(t('Try again'), () => { failed = null; failedMsg = ''; cancelled = false; fill(); }, { kind: 'primary' })));
    if (!res) {
      const pbar = h('i', { style: { width: '0%' } }), plabel = h('span', { class: 'small muted' }, t('Starting…'));
      const stageName = { speaker: t('reading the speaker'), take: t('reading your take'), compare: t('comparing the two') };
      let seen = false, phase = ''; // seen: first real progress arrived; phase: the step before the engine starts
      const waitLabel = () => {
        if (phase === 'speaker-audio') return t('Getting the speaker’s audio from the video…');
        if (phase === 'take-audio') return t('Reading your recording…');
        const cur = Heavy.running();
        return cur && cur !== 'pronunciation' && Heavy.spec(cur) ? t('Waiting for “{name}” to finish first…', { name: t(Heavy.spec(cur).name) }) : t('Starting…');
      };
      const waitTick = setInterval(() => { if (seen || !plabel.isConnected) clearInterval(waitTick); else plabel.textContent = waitLabel(); }, 1000);
      plabel.textContent = waitLabel();
      const showProg = (p) => { if (p.phase) { phase = p.phase; if (plabel.isConnected) plabel.textContent = waitLabel(); return; } seen = true; if (!pbar.isConnected) return; const pct = Math.round(p.fraction * 100); pbar.style.width = pct + '%'; pbar.parentNode.setAttribute('aria-valuenow', pct); plabel.textContent = t('Step {n} of {m}: {what} · {pct}%', { n: p.step, m: p.steps, what: stageName[p.stage] || '', pct }) + (p.cachedSpeaker ? ' · ' + t('speaker already read') : ''); };
      mount(root, pvMsg(take ? t('Comparing your take with the speaker…') : t('Reading the speaker…'), t('It runs on your device. The bar counts the audio read so far; a short clip moves in a few steps.'),
        h('div', { class: 'pv-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, pbar), plabel,
        btn(t('Cancel'), () => { cancelled = true; failed = key; ctl && ctl.abort(); fill(); }, { size: 'sm', kind: 'ghost' })));
      if (!PronTab.asked.has(key)) {
        PronTab.asked.add(key);
        ctl = new AbortController();
        const mine = ctl;
        PronSource.analyse(clip, take, mine.signal, showProg)
          .then((r) => { PronTab.cache.set(key, r); })
          .catch((e) => { failed = key; cancelled = mine.signal.aborted; failedMsg = !cancelled && e && e.message && !(e instanceof HeavyError) ? String(e.message).slice(0, 300) : ''; if (!cancelled) console.warn('pronunciation comparison failed', e); })
          .finally(() => { PronTab.asked.delete(key); if (root.isConnected) fill(); });
      }
      return;
    }
    mount(root, renderResult(clip, res, take));
  }

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
        clip.wordsFor && clip.wordsFor.timing === 'phrase' ? h('span', null, t('The words are placed roughly: this device couldn’t time each word.')) : null,
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

  function renderResult(clip, res, take) {
    const dur = clip.end - clip.start;
    const hasWords = res.words.some((w) => w.text); // a word the recogniser skipped shows its sounds instead
    if (PronTab.noWords === hasWords) { PronTab.noWords = !hasWords; setTimeout(renderPanel); }
    const wordsTop = hasWords && PronTab.top !== 'phones';
    const pct = (s) => (s / dur) * 100 + '%';
    const shown = PronTab.shown(clip, res);
    const hidden = res.hidden || 0;
    const stateOf = (w) => (!take || res.confidence === 'low' ? 'none' : shown.includes(w) ? 'diff' : w.differs && !PronTab.dismissed.has(PronTab.skey(clip, w)) ? 'none' : 'ok');

    const words = res.words.map((w) => {
      const st = stateOf(w);
      const sp = pvPhones(w.phones, 'spk');
      const big = h('div', { class: 'tv-big ' + (wordsTop && w.text ? 'wd' : 'ph') }, h('span', null, wordsTop && w.text ? w.text : sp));
      const sub = h('div', { class: 'tv-sub ' + (wordsTop ? 'ph' : 'wd') }, hasWords && w.text ? h('span', null, wordsTop ? sp : w.text) : null);
      const el = h('div', { class: 'tv-w ' + st, style: { left: pct(w.start), width: pct(w.end - w.start) } }, big, h('div', { class: 'tv-bar' }), sub,
        st === 'diff' ? h('div', { class: 'tv-you' }, h('span', { class: 'tv-tag' }, t('You')), h('span', { class: 'tv-yph' }, pvPhones(w.phones, 'you'))) : null);
      return { w, el, big, sub };
    });

    // one-second lines, as in the Pitch and Waveform views
    const ticks = [];
    for (let s = 1; s < dur; s++) ticks.push(h('div', { class: 'tv-tick', style: { left: pct(s) } }));
    const head = h('div', { class: 'tv-head' });
    const view = h('div', { class: 'tv-view', 'aria-label': t('Words of the clip on a time line; press or drag to move through it') }, ticks, words.map((x) => x.el), head);
    Panel.canvas = view;
    Panel.refs = { view, head, dur, words, w: 0 };

    // press or drag to move through the clip, as on the Pitch and Waveform charts
    let down = false;
    const seekTo = (e) => {
      const r = view.getBoundingClientRect();
      Player.seek(Math.min(clip.start + clamp((e.clientX - r.left) / r.width, 0, 1) * dur, clip.end - 0.05));
      if (Session.previewRec && Session.previewRec.clip.id === clip.id) syncRecTo(Player.time());
    };
    view.addEventListener('pointerdown', (e) => { if (!analysisCanScrub()) return; down = true; view.setPointerCapture(e.pointerId); seekTo(e); });
    view.addEventListener('pointermove', (e) => { if (down) seekTo(e); });
    view.addEventListener('pointerup', () => { down = false; });
    view.addEventListener('pointercancel', () => { down = false; });

    // under the chart: what it shows, then the differences with their play buttons
    let note;
    if (!take) note = t('Record a pass and the differences from the speaker show up here.');
    else if (res.confidence === 'low' && res.lowWho === 'speaker') note = t('The speaker’s sound is hard to analyse here (music, noise or overlapping voices), so no differences are shown.');
    else if (res.confidence === 'low') note = t('Hard to tell for this take (too quiet, noisy or cut short), so no differences are shown. Try recording again closer to the microphone.');
    else if (!shown.length) note = t('No clear differences from the speaker this time.');
    const items = shown.map((w) => h('div', { class: 'pv-item' },
      h('span', { class: 'pv-word' + (w.text ? '' : ' ph') }, PronTab.label(w)),
      h('span', { class: 'pv-btns' },
        btn(t('Speaker'), () => pronPlay(clip, take, w, 'spk'), { size: 'sm', icon: 'play', title: t('Hear the speaker say “{word}”', { word: PronTab.label(w) }), cls: 'pv-spk' }),
        btn(t('You'), () => pronPlay(clip, take, w, 'you'), { size: 'sm', icon: 'play', title: t('Hear how you said “{word}”', { word: PronTab.label(w) }), cls: 'pv-you' })),
      btn(t('Sounds the same to me'), () => { PronTab.dismiss(clip, w); fill(); }, { size: 'sm', kind: 'ghost', title: t('Hide this one. It won’t come back for this clip.') })));
    const legend = h('div', { class: 'pv-legend small muted' },
      take && res.confidence !== 'low' ? [h('span', { class: 'pv-key ok' }), t('same as the speaker'), h('span', { class: 'pv-key diff' }), t('differs from the speaker')] : null,
      h('span', { class: 'pv-beta' }, t('beta')));
    return [view,
      h('div', { class: 'pv-foot' },
        note ? h('p', { class: 'pv-note' + (res.confidence === 'low' ? ' warn' : '') }, note) : h('div', { class: 'pv-list-head' }, h('b', null, t('Differences from the speaker')), h('span', { class: 'small muted' }, t('Worth a listen'))),
        items,
        hidden ? h('p', { class: 'small muted' }, tp(hidden, '{n} more possible difference is hidden because it is less certain.', '{n} more possible differences are hidden because they are less certain.')) : null,
        take && shown.length ? h('p', { class: 'small muted' }, t('Not exact. Listen to both and decide.')) : null,
        wordsBlock(clip),
        legend)];
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
  if (!analysisCanScrub()) return;
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
  const { view, head, dur, words } = this.refs;
  const clip = Store.get('clips', UI.clipId);
  if (!view || !clip) return;
  const W = view.clientWidth;
  if (W && W !== this.refs.w) { // size each word to the room it has before the next one starts
    this.refs.w = W;
    const wordsTop = !PronTab.noWords && PronTab.top !== 'phones';
    words.forEach(({ w, big, sub }, i) => {
      const next = words[i + 1];
      const room = ((next ? next.w.start : dur) - w.start) / dur * W - 8;
      const sp = pvPlain(w.phones, 'spk');
      big.style.fontSize = pvFit(wordsTop && w.text ? w.text : sp, room, 1.6, 0.85, wordsTop ? 0.56 : 0.62);
      sub.style.fontSize = pvFit(wordsTop ? sp : (w.text || ''), room, 0.95, 0.72, wordsTop ? 0.62 : 0.56);
    });
  }
  head.style.left = clamp((now - clip.start) / dur, 0, 1) * W + 'px';
};
