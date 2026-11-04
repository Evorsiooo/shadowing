/* ---------- sound-level differences in the app's own screens (data: 24-pron.js) ----------
   The review card after a recorded pass, "Drill this", the start of a note, the step 3 vs final line, the line in the
   end-of-session popup, and the step 4 hint. The Pronunciation tab in the analysis panel is separate. */

/* start working out a take's sounds; the review card fills in when it is done */
function startPhones(R, args) {
  R.phonesError = null; R.phonesProgress = null;
  args = { ...args, onProgress: (p) => { R.phonesProgress = p; if (R.onPhonesProgress) R.onPhonesProgress(p); }, onError: (why) => { R.phonesError = why; } };
  R.phonesPromise = Pron.process(args).then((p) => { R.phones = p; return p; }, () => { R.phones = null; return null; });
}

const itemLabel = (d) => `${d.words ? `“${d.words}”` : fmtSec(d.a)} (${soundName(d.from)} → ${soundName(d.to)})`;

/* the learner's sounds next to the speaker's, with the differing sound marked */
function phoneRow(label, phones, mark) {
  return h('div', { class: 'pron-ph' }, h('span', { class: 'small muted' }, label),
    phones.map((p) => h('b', { class: p === mark ? 'diff' : '' }, p)));
}

/* "Speaker" / "You" for one difference: a 2-4 s stretch around it */
function playSnippetOriginal(clip, a, b, then) {
  Player2.stop();
  Session.previewRec = null;
  Player.v.muted = UI.volume === 0;
  Session.preview = { stopAt: clip.start + b, then };
  Player.seek(clip.start + a);
  Player.play();
}
function pronPlay(clip, d, who, R) {
  const [a, b] = Pron.snippet(clip, d);
  if (who === 'speaker') playSnippetOriginal(clip, a, b);
  else playSynced(clip, R.url, R.analysis, { from: clip.start + a, stopAt: clip.start + b });
}

/* "Differences from the speaker", at the sound level: at most three, playable, dismissable */
function pronCard(clip, R) {
  if (!Pron.on() || !R) return null;
  const wrap = h('div');
  const draw = () => {
    if (R.phones === undefined) {
      const txt = h('span', null), bar = h('i', { style: { width: '0%' } });
      const show = (p) => { txt.textContent = p ? `${t('Checking the sounds…')} ${t('step {n} of {m}', { n: p.step, m: p.steps })}` : t('Checking the sounds…'); bar.style.width = (p ? Math.round(p.fraction * 100) : 0) + '%'; };
      show(R.phonesProgress);
      R.onPhonesProgress = (p) => { if (wrap.isConnected) show(p); };
      mount(wrap, h('div', { role: 'status' }, h('p', { class: 'small muted' }, txt), h('div', { class: 'pv-prog', 'aria-hidden': 'true' }, bar)));
      return;
    }
    if (R.phones === null) { mount(wrap, R.phonesError ? h('p', { class: 'small muted' }, t('Couldn’t check the sounds: {why}', { why: R.phonesError })) : null); return; }
    const other = R.slot === 'final' && Session.doc ? Pron.phonesFor(Session.doc.recs.step3) : null;
    const { items, total, repeated } = Pron.shown(R.phones, other);
    mount(wrap, h('div', { class: 'card' },
      h('div', { class: 'row' }, h('strong', { class: 'grow' }, t('Sounds that differ from the speaker')), h('span', { class: 'chip' }, t('beta'))),
      items.length ? [
        h('p', { class: 'small muted' }, tp(total, 'Worth a listen ({shown} of {n} spot)', 'Worth a listen ({shown} of {n} spots)', { shown: items.length })),
        items.map((d) => h('div', { class: 'pron-item' },
          h('div', { class: 'row' },
            h('strong', null, d.words ? `“${d.words}”` : t('At {when}', { when: fmtSec(d.a) })),
            d.words ? h('span', { class: 'small muted' }, fmtSec(d.a)) : null,
            repeated(d) ? h('span', { class: 'issue-pill' }, t('also in your step 3 take')) : null),
          phoneRow(t('Speaker'), d.speaker, d.from), phoneRow(t('You'), d.you, d.to),
          soundWord(d.from) ? h('p', { class: 'small muted' }, t('{a} as in “{aw}”; you may have said {b}{bw}.', { a: soundName(d.from), aw: soundWord(d.from), b: soundName(d.to), bw: soundWord(d.to) ? ` (“${soundWord(d.to)}”)` : '' })) : null,
          h('div', { class: 'row' },
            btn(t('Speaker'), () => pronPlay(clip, d, 'speaker', R), { size: 'sm', icon: 'play' }),
            btn(t('You'), () => pronPlay(clip, d, 'you', R), { size: 'sm', icon: 'mic' }),
            btn(t('Drill this'), () => openDrill(clip, d), { size: 'sm', kind: 'blue', icon: 'replay' }),
            btn(t('Sounds the same to me'), () => {
              Pron.dismiss(Pron.pairOf(d));
              toast(t('Okay. {a} → {b} won’t be flagged again.', { a: soundName(d.from), b: soundName(d.to) }));
              draw();
            }, { size: 'sm', kind: 'ghost' }))))] : h('p', { class: 'small' }, t('No clear differences this time.')),
      h('p', { class: 'small muted' }, t('Not exact: a computer listened to both of you and can be wrong. Play both and decide for yourself.'))));
  };
  draw();
  if (R.phones === undefined && R.phonesPromise) R.phonesPromise.then(draw);
  return wrap;
}

/* Drill this: the speaker's snippet three times to shadow, the last one recorded, then both to compare by ear. No score. */
function openDrill(clip, d) {
  const [a, b] = Pron.snippet(clip, d);
  const PASSES = 3;
  let n = 0, stopped = false, mine = null, recorder = null;
  const body = h('div', { class: 'stack' });
  const stopAll = () => {
    stopped = true;
    if (recorder) { recorder.stop().catch(() => {}); recorder = null; }
    stopReviewPlayback();
  };
  const playMineBlob = (then) => {
    const au = new window.Audio(mine);
    MineLevel.attach(au, MineLevel.gain(null, clip));
    au.onended = () => then && then();
    au.play().catch(() => {});
  };
  const draw = (state) => {
    const phones = h('div', { class: 'stack' }, phoneRow(t('Speaker'), d.speaker, d.from), phoneRow(t('You'), d.you, d.to));
    if (state === 'running') {
      mount(body, phones, h('p', { role: 'status' }, h('strong', null, t('Pass {n} of {total}', { n, total: PASSES })), ' ',
        n === PASSES ? t('Shadow along. This one is recorded.') : t('Shadow along with the speaker.')));
    } else if (state === 'done') {
      mount(body, phones,
        h('p', null, mine ? t('Hear any difference?') : t('Done. Hear any difference between how you sound and the speaker?')),
        h('div', { class: 'row' },
          btn(t('Speaker'), () => playSnippetOriginal(clip, a, b), { size: 'sm', icon: 'play' }),
          mine ? btn(t('Mine'), () => playMineBlob(), { size: 'sm', icon: 'mic' }) : null,
          mine ? btn(t('Speaker then mine'), () => playSnippetOriginal(clip, a, b, () => setTimeout(() => playMineBlob(), 300)), { size: 'sm' }) : null,
          btn(t('Again'), () => run(), { size: 'sm', kind: 'blue', icon: 'replay' })));
    } else {
      mount(body, phones,
        h('p', { class: 'small muted' }, t('The speaker’s snippet ({a}–{b} s) plays {n} times. Shadow it; the last time is recorded. Headphones on.', { a: fmtNum(a, 1), b: fmtNum(b, 1), n: PASSES })),
        btn(t('Start'), () => run(), { kind: 'primary', icon: 'play' }));
    }
  };
  const run = async () => {
    stopped = false; mine = null;
    stopReviewPlayback();
    for (n = 1; n <= PASSES && !stopped; n++) {
      if (n === PASSES && (await Mic.open().catch(() => false))) { recorder = new Recording(); recorder.start(); }
      draw('running');
      await new Promise((res) => playSnippetOriginal(clip, a, b, res));
      if (stopped) return;
      if (recorder) {
        await sleep(500);
        const r = await recorder.stop();
        recorder = null;
        if (r.blob && r.blob.size) mine = URL.createObjectURL(r.blob);
      }
      await sleep(700);
    }
    if (!stopped) draw('done');
  };
  draw('ready');
  openModal([modalHead(t('Drill this'), itemLabel(d)), body], { narrow: true, onClose: stopAll });
}

/* ---------- notes: start from what was found ---------- */
function pronFill(D, d, clip) {
  const f = soundName(d.from), to = soundName(d.to);
  D.sentence = (clip && clip.sentence) || d.words || D.sentence || '';
  D.off = d.words ? t('I said {to} where the speaker says {from} in “{words}”.', { to, from: f, words: d.words }) : t('I said {to} where the speaker says {from}.', { to, from: f });
  D.aim = soundWord(d.from) ? t('{sound} as in “{word}”', { sound: f, word: soundWord(d.from) }) : '';
  if (!D.issue) D.issue = `${f} → ${to}`;
  D.open = true;
}
/* the row above a note form: "From this take: three — Use in note" */
function pronSuggestions(ctx, D, key, details) {
  if (ctx.noSuggest) return null;
  const items = Pron.itemsFor(ctx.recId, ctx.sessionId);
  if (!items.length) return null;
  const clip = Store.get('clips', ctx.clipId);
  const set = (id, v) => { const el = $(`#${id}-${key}`); if (el) el.value = v; };
  return h('div', { class: 'stack' }, h('span', { class: 'small muted' }, t('From this take:')),
    items.map((d) => h('div', { class: 'row' },
      h('span', { class: 'small grow' }, t('{label}: you may have said {to} where the speaker says {from}', { label: d.words ? `“${d.words}”` : fmtSec(d.a), to: soundName(d.to), from: soundName(d.from) })),
      btn(t('Use in note'), () => {
        pronFill(D, d, clip);
        set('off', D.off); set('sent', D.sentence); set('aim', D.aim); set('issue', D.issue);
        if (details) details.open = true;
      }, { size: 'sm' }))));
}
/* a note form in a popup (from the end-of-session line or an automatic note) */
function openNoteModal(ctx, D, title, back) {
  D.open = true;
  const form = noteForm({ ...ctx, noSuggest: true }, D, `pn-${uid()}`, 0, () => {});
  openModal([modalHead(title), form, back ? btn(t('Back to issues'), back, { kind: 'ghost' }) : null]);
}

/* ---------- step 3 against the final pass ---------- */
function pronCompareCard(A, B) {
  if (!Pron.on()) return null;
  const r = Pron.compareTakes(A && A.phones, B && B.phones);
  if (!r || !(r.gone.length || r.still.length || r.fresh.length)) return null;
  const list = (arr) => arr.slice(0, 4).map(itemLabel).join(', ');
  return h('div', { class: 'card' },
    h('strong', null, t('Sounds that differ from the speaker: step 3 and final')),
    h('ul', { class: 'small' },
      r.gone.length ? h('li', null, t('No longer flagged: {list}.', { list: list(r.gone) })) : null,
      r.still.length ? h('li', null, t('Still flagged: {list}.', { list: list(r.still) })) : null,
      r.fresh.length ? h('li', null, t('Newly flagged: {list}.', { list: list(r.fresh) })) : null),
    h('p', { class: 'small muted' }, t('“No longer flagged” isn’t proof it’s fixed, and “still flagged” isn’t proof it’s wrong: the computer can be off either way. Listen to both.')));
}

/* ---------- end-of-session popup: one line, only for a difference that showed up in both recordings ---------- */
function pronSummaryCard(sum) {
  if (!Pron.on() || !sum.recs.step3 || !sum.recs.final) return null;
  const r = Pron.compareTakes(Pron.phonesFor(sum.recs.step3), Pron.phonesFor(sum.recs.final));
  if (!r || !r.still.length) return null;
  const rec = Store.get('recordings', sum.recs.final);
  const clip = Store.get('clips', sum.clipId);
  if (!rec || !clip) return null;
  const d = r.still[0];
  return h('div', { class: 'card row' },
    h('p', { class: 'grow' }, t('Still there in both recordings: {list}.', { list: r.still.slice(0, 2).map(itemLabel).join(', ') })),
    btn(t('Add a note'), () => {
      const D = blankNote(clip);
      pronFill(D, d, clip);
      openNoteModal({ clipId: clip.id, sessionId: rec.sessionId, recId: rec.id, pass: rec.pass, step: rec.step || 'again' }, D, t('Add a note'));
    }, { size: 'sm', icon: 'note' }));
}

/* ---------- Progress → Issues: sounds seen across sessions ---------- */
const TREND_WORDS = { less: N_('less often'), more: N_('more often'), same: N_('about the same') };

/* "5 of 9 chances flagged in the last 2 weeks (was 7 of 8) · less often" */
function trendLine(T) {
  if (!T.recent.o) return null;
  const was = T.before.o ? ` ${t('(was {f} of {o})', { f: T.before.f, o: T.before.o })}` : '';
  return t('{f} of {o} chances flagged in the last 2 weeks', { f: T.recent.f, o: T.recent.o }) + was + (T.label ? ` · ${t(TREND_WORDS[T.label])}` : '');
}
function examplesLine(e) {
  const ex = (e.ex || []).slice(-4).reverse().map((x) => `${fmtDayShort(x.d)}${x.w ? `: ${x.w}` : ''}`);
  return ex.length ? t('Recent: {list}', { list: ex.join(', ') }) : null;
}
function fmtDayShort(k) { try { return parseDay(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return k; } }

function pronSeenView(redraw) {
  const rows = Pron.seenAcross();
  const quiet = Pron.quietAcross();
  const blocked = Pron.doc().blocked;
  if (!rows.length && !blocked.length && !quiet.length) return null;
  return h('div', { class: 'card' },
    h('h3', null, t('Seen across sessions')),
    h('p', { class: 'small muted' }, t('Sounds a computer flagged on several different days, counted on this device. They can be wrong, so listen and confirm before you trust one.')),
    rows.map(({ pair, e, note, recurring, flagged, occurred, state, trend }) => h('div', { class: 'pron-item', style: state === 'easing' ? { opacity: 0.8 } : null },
      h('div', { class: 'row' },
        h('strong', null, Pron.pairName(pair)),
        recurring && note ? h('span', { class: 'issue-pill' }, t('possible, listen and confirm')) : null,
        state === 'easing' ? h('span', { class: 'issue-pill' }, t('showing up less')) : null,
        state === 'archived' ? h('span', { class: 'issue-pill' }, t('gone quiet')) : null),
      h('p', { class: 'small muted' }, t('Flagged on {days} and {clips}, in {flagged} of {occurred} places where the speaker has that sound.', { days: tp(e.days.length, '{n} day', '{n} days'), clips: tp(e.clips.length, '{n} clip', '{n} clips'), flagged, occurred })),
      trendLine(trend) ? h('p', { class: 'small muted' }, trendLine(trend)) : null,
      examplesLine(e) ? h('p', { class: 'small muted' }, examplesLine(e)) : null,
      h('div', { class: 'row' },
        recurring && note ? btn(t('Open note'), () => {
          const D = { sentence: note.sentence || '', off: note.off || '', aim: note.aim || '', issue: Pron.pairName(pair), reply: note.reply || null, saved: note.id, open: true };
          openNoteModal({ clipId: note.clipId, sessionId: note.sessionId, recId: note.recId, pass: note.pass, step: note.step, pair }, D, Pron.pairName(pair), () => openProgress('issues'));
        }, { size: 'sm', icon: 'note' }) : null,
        recurring && note ? btn(t('Make this an issue'), () => { Pron.confirm(pair); redraw(); }, { size: 'sm', kind: 'primary' }) : null,
        btn(t('Sounds the same to me'), () => { Pron.dismiss(pair); redraw(); }, { size: 'sm', kind: 'ghost' })))),
    quiet.length ? h('details', { class: 'pron-quiet' },
      h('summary', null, t('Gone quiet ({n})', { n: quiet.length })),
      h('p', { class: 'small muted' }, t('No longer flagged over several recent chances. They come back on their own if they show up again.')),
      quiet.map(({ pair, e }) => h('div', { class: 'pron-item' },
        h('div', { class: 'row' }, h('strong', null, Pron.pairName(pair)), e.stateAt ? h('span', { class: 'small muted' }, t('quiet since {date}', { date: fmtDayShort(e.stateAt) })) : null),
        examplesLine(e) ? h('p', { class: 'small muted' }, examplesLine(e)) : null,
        h('div', { class: 'row' },
          btn(t('Still happening to me'), () => { Pron.reopen(pair); redraw(); }, { size: 'sm', kind: 'ghost' }),
          btn(t('Sounds the same to me'), () => { Pron.dismiss(pair); redraw(); }, { size: 'sm', kind: 'ghost' }))))) : null,
    blocked.length ? h('p', { class: 'small muted' }, t('Ignored:'), ' ', blocked.map((p) => h('span', null, Pron.pairName(p), ' ',
      btn(t('Allow again'), () => { Pron.allow(p); redraw(); }, { size: 'sm', kind: 'ghost' }), ' '))) : null);
}

/* timing, pitch and stress over time (every language): how many of the last passes had each kind of difference */
const PROSODY_NAMES = { rushed: N_('Faster than the speaker'), dragged: N_('Slower than the speaker'), pitch: N_('Pitch moving a different way'), stress: N_('Stress in a different place') };
function prosodyTrendView() {
  const rows = ProsodyLog.summary().filter((r) => r.T.recent.o >= PRON_QUIET.easeMin);
  if (!rows.length) return null;
  return h('div', { class: 'card' },
    h('h3', null, t('Timing, pitch and stress')),
    h('p', { class: 'small muted' }, t('How many of your recent recorded passes had each kind of difference from the speaker. Rough measures, worked out on this device.')),
    rows.map(({ kind, T }) => {
      const was = T.before.o ? ` ${t('(was {f} of {o})', { f: T.before.f, o: T.before.o })}` : '';
      return h('p', { class: 'small' }, h('strong', null, t(PROSODY_NAMES[kind])), ': ', t('{f} of {o} passes in the last 2 weeks', { f: T.recent.f, o: T.recent.o }) + was + (T.label ? ` · ${t(TREND_WORDS[T.label])}` : ''));
    }));
}

/* ---------- step 4: today's focus ---------- */
function focusLine() {
  const f = topFocus();
  return f ? h('p', { class: 'session-hint' }, icon('sparkle', 'width="16" height="16"'), ' ', t('Today’s focus: {issue}', { issue: f })) : null;
}
function topFocus() {
  const since = addDays(dayKey(), -14);
  const open = Store.all('issues').filter((i) => !i.mergedInto && i.status !== 'fixed')
    .map((i) => { const ns = (i.noteIds || []).map((id) => Store.get('notes', id)).filter(Boolean); return { i, all: ns.length, recent: ns.filter((n) => n.date >= since).length }; })
    .filter((x) => x.all)
    .sort((a, b) => b.recent - a.recent || b.all - a.all)[0];
  if (open) return open.i.name;
  const poss = Pron.on() ? Pron.seenAcross().find((r) => r.recurring) : null;
  return poss ? t('{sounds} (possible)', { sounds: Pron.pairName(poss.pair) }) : null;
}
