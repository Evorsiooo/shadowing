/* ---------- Say something: talk to Euno inside the Ask Euno chat ----------
   A mic button next to the text box. You say a word or a sentence (up to SAY_MAX seconds); the take is read by the pronunciation
   model (24-phones.js, on this device, English only) and the chat shows the sounds the model heard, with your take to play back.
   It is not a voice chat: nothing is sent to the AI by this, and Euno does not answer out loud.
   Two parts:
     1. What the model heard. No reference, so it cannot say right or wrong; it is labelled as the model's guess.
     2. "Compare with a speaker": finds clips in your library whose words contain what you said (the words in clip.words, from the
        Word labels add-on) and runs the normal comparison against that stretch of the speaker's audio.
   Stored in the chat (meta/askEuno), so it follows you to every device, as a message { id, role: 'say', ref, sec, level, words, cmp? }.
   The audio is kept like any recording (Store.putBlob); on another device without it, only playback is missing. */
const SAY_MAX = 12; // seconds of one take
const SAY_LOW = 0.5; // a sound the model was less sure of than this is shown faded (the engine's confidence is not calibrated; this cut-off is untuned)
const Say = { phase: 'idle', rec: null, timer: 0, t0: 0, error: null, notice: null, find: new Map(), mem: new Map(), cmpBusy: null };

const sayNorm = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
const sayTokens = (text) => String(text || '').split(/\s+/).map(sayNorm).filter(Boolean).slice(0, 12);

function sayCanOffer() { return Store.mode === 'cloud' && !!Api.ai && typeof Pron !== 'undefined' && Pron.available(); }

function sayUpdate(id, patch) {
  const d = askDoc();
  Store.put('meta', { ...d, id: 'askEuno', messages: d.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

async function sayToggle() {
  if (Say.phase === 'recording') return sayStop();
  if (Say.phase !== 'idle' || Ask.busy) return;
  Say.error = null; Say.notice = null;
  const S = typeof Session !== 'undefined' ? Session : null;
  if (S && S.active && (S.phase === 'recording' || S.phase === 'armed')) { Say.error = t('Finish the pass you are recording first.'); return openAsk(); }
  if (!Pron.on()) { Say.notice = Pron.enabled() ? 'model' : 'off'; return openAsk(); }
  if (!(await Mic.open())) { Say.error = Mic.error; return openAsk(); }
  const rec = new Recording();
  rec.start();
  Say.rec = rec; Say.phase = 'recording'; Say.t0 = performance.now();
  Say.timer = setInterval(() => {
    const s = (performance.now() - Say.t0) / 1000, el = $('#sayTime');
    if (el) el.textContent = fmtTime(s);
    if (s >= SAY_MAX) sayStop();
  }, 200);
  openAsk();
}

function sayRelease() {
  clearInterval(Say.timer);
  const S = typeof Session !== 'undefined' ? Session : null;
  if (!(S && S.active)) Mic.close();
}
async function sayCancel() {
  if (Say.phase !== 'recording') return;
  const rec = Say.rec;
  Say.rec = null; Say.phase = 'idle';
  try { await rec.stop(); } catch { /* nothing to keep */ }
  sayRelease();
}

/* sounds (and words, when the add-on is on) for one take -> [{ t: word|null, p: [{ s, lo }] }] */
function sayUnits(seq, ext) {
  const S = ext ? Phones.attachExternalWords(seq, ext) : seq;
  let i = 0;
  return pronWords(S, [], ext ? S.external : null).map((w) => ({ t: w.text, p: w.phones.map((x) => ({ s: x.spk, lo: S.phones[i++].conf < SAY_LOW })) }));
}

async function sayStop() {
  const rec = Say.rec;
  if (!rec) return;
  Say.rec = null; Say.phase = 'working'; Say.error = null;
  openAsk();
  try {
    const res = await rec.stop();
    sayRelease();
    const sec = res.samples.length / 16000;
    let ref = null;
    try { ref = await Store.putBlob(res.blob); } catch { /* the sounds still show; only playback is lost */ }
    const seq = await Heavy.run('pronunciation', () => Phones.transcribe(res.samples), { timeoutMs: 90000 });
    const good = seq.quality.level === 'good';
    let ext = null;
    if (good && Heavy.isOn('words') && ['downloaded', 'ready'].includes(Words.status().state)) {
      try {
        const r = await Heavy.run('words', ({ signal }) => Words.transcribe(res.samples, signal), { timeoutMs: 90000 });
        if (r && r.words && r.words.length) ext = { source: 'asr', timing: r.timing, words: r.words.map((x) => ({ text: x.w, t0: x.s, t1: x.e })) };
      } catch { /* sounds alone are fine */ }
    }
    const m = { id: uid(), role: 'say', at: new Date().toISOString(), ref, sec: round(sec, 1), level: seq.quality.level, reasons: seq.quality.reasons || [], words: good ? sayUnits(seq, ext) : [], wordsFrom: ext ? 'asr' : null };
    Say.mem.set(m.id, res.samples);
    askSave([...askDoc().messages, m]);
  } catch (e) {
    sayRelease();
    Say.error = Pron.reason(e);
  }
  Say.phase = 'idle';
  if (UI.askOpen) openAsk();
}

async function sayPlay(m) {
  try { if (typeof Player2 !== 'undefined') Player2.stop(); } catch { /* nothing playing */ }
  if (m.ref) { const a = await Player2.play(m.ref); if (a) return; }
  const s = Say.mem.get(m.id);
  if (s) sayPlaySamples(s); else toast(t('This take isn’t on this device.'), 'bad');
}
function sayPlaySamples(samples) {
  try {
    const ctx = AudioEng.getCtx();
    if (ctx.resume) ctx.resume();
    const b = ctx.createBuffer(1, samples.length, 16000);
    b.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(ctx.destination); src.start();
  } catch { toast(t('The recording couldn’t play in this browser.'), 'bad'); }
}

/* ---------- (b) compare with a speaker ---------- */
function sayFinder(m) {
  let f = Say.find.get(m.id);
  if (!f) {
    const said = m.words.length && m.words.every((w) => w.t) ? m.words.map((w) => w.t).join(' ') : '';
    f = { open: false, text: said, hits: null, unlabelled: 0 };
    Say.find.set(m.id, f);
  }
  return f;
}
function sayFindClips(f) {
  const want = sayTokens(f.text), n = want.length, hits = [];
  f.unlabelled = 0;
  if (!n) { f.hits = []; return; }
  for (const c of Store.all('clips')) {
    if (c.archived || !Store.get('videos', c.videoId)) continue;
    if (!c.words || !c.words.length) { f.unlabelled++; continue; }
    const ws = c.words.map((x) => sayNorm(x.w));
    for (let i = 0; i + n <= ws.length; i++) {
      if (want.every((w, k) => ws[i + k] === w)) {
        const from = Math.max(0, i - 3), to = Math.min(ws.length, i + n + 3);
        hits.push({ clipId: c.id, a: c.words[i].s, b: c.words[i + n - 1].e, before: c.words.slice(from, i).map((x) => x.w).join(' '), said: c.words.slice(i, i + n).map((x) => x.w).join(' '), after: c.words.slice(i + n, to).map((x) => x.w).join(' ') });
        break;
      }
    }
  }
  f.hits = hits.slice(0, 6);
}

const SAY_PAD = 0.12; // seconds of the speaker's audio kept either side of the words
async function saySpeakerPart(hit) {
  const clip = Store.get('clips', hit.clipId);
  if (!clip) throw new Error(t('This clip isn’t in your library any more.'));
  const all = await speakerSamples(clip); // 54-pron-source.js: the clip's sound, read from the video when needed
  const a0 = Math.max(0, hit.a - SAY_PAD), b0 = Math.min(all.length / 16000, hit.b + SAY_PAD);
  return { clip, a0, b0, samples: all.slice(Math.floor(a0 * 16000), Math.ceil(b0 * 16000)) };
}
async function sayHear(hit) {
  try { sayPlaySamples((await saySpeakerPart(hit)).samples); } catch (e) { toast(e.message || t('The speaker’s sound couldn’t be read from the video. Load the video again (a local file works best) and try again.'), 'bad'); }
}
async function sayTakeSamples(m) {
  const mem = Say.mem.get(m.id);
  if (mem) return mem;
  const blob = m.ref && (await Store.getBlob(m.ref));
  if (!blob) throw new Error(t('This take isn’t on this device, so it can’t be compared. Say it again.'));
  return AudioEng.decodeBlob(blob);
}
async function sayCompare(m, hit) {
  if (Say.cmpBusy) return;
  Say.cmpBusy = m.id; Say.error = null;
  openAsk();
  try {
    const [sp, you] = await Promise.all([saySpeakerPart(hit), sayTakeSamples(m)]);
    const res = await Heavy.run('pronunciation', () => Phones.analyse(sp.samples, you, { speakerOriginSec: sp.a0 }), { timeoutMs: 90000 });
    const words = (sp.clip.words || []).filter((w) => w.e > sp.a0 && w.s < sp.b0).map((w) => ({ text: w.w, t0: w.s - sp.a0, t1: w.e - sp.a0 }));
    const speaker = words.length ? Phones.attachExternalWords(res.speaker, { source: 'asr', timing: sp.clip.wordsFor && sp.clip.wordsFor.timing, words }) : res.speaker;
    const pr = pronFromClipResult({ ...res, speaker });
    const v = Store.get('videos', sp.clip.videoId);
    sayUpdate(m.id, { cmp: { clipId: sp.clip.id, clip: clipName(sp.clip), speaker: (v && v.speaker) || '', a: round(hit.a, 2), b: round(hit.b, 2), status: res.status, hidden: pr.hidden, words: pr.words.map((w) => ({ t: w.text, d: w.differs, p: w.phones.map((x) => ({ a: x.spk, b: x.you })) })) } });
    const f = Say.find.get(m.id); if (f) f.open = false;
  } catch (e) {
    Say.error = Pron.reason(e);
  }
  Say.cmpBusy = null;
  if (UI.askOpen) openAsk();
}

/* ---------- what the chat shows ---------- */
const SAY_WHY = {
  'too-short': N_('too short'), 'little-speech': N_('not enough speech'), 'low-confidence': N_('too noisy or unclear'),
  'implausible-rate': N_('the speaking rate looked wrong'), noisy: N_('too noisy'), clipping: N_('too loud, so it distorted'),
};

function sayWordLine(words, who) {
  return h('div', { class: 'say-line' }, words.map((w) => h('span', { class: 'say-w' + (w.d ? ' diff' : '') },
    w.t ? h('span', { class: 'say-t' }, w.t) : null,
    h('span', { class: 'ipa say-ipa' }, who === 'heard' ? w.p.map((x) => (x.lo ? h('i', { class: 'lo', title: t('The model was less sure of this sound.') }, x.s) : x.s)) : pvPhones(w.p.map((x) => ({ spk: x.a, you: x.b })), who)))));
}

function sayCompareCard(m) {
  const c = m.cmp;
  const head = h('p', { class: 'small muted say-cmp-head' }, t('Compared with {who} in “{clip}”.', { who: c.speaker || t('the speaker'), clip: c.clip }));
  if (c.status === 'speaker-low-quality') return h('div', { class: 'say-cmp' }, head, h('p', null, t('The speaker’s sound was too unclear there to compare.')));
  if (c.status === 'learner-low-quality') return h('div', { class: 'say-cmp' }, head, h('p', null, t('Your take was too unclear to compare. Try again closer to the microphone.')));
  const diff = c.words.filter((w) => w.d);
  return h('div', { class: 'say-cmp' }, head,
    diff.length ? [
      h('p', { class: 'say-sum' }, tp(diff.length, '{n} difference from the speaker', '{n} differences from the speaker')),
      ...diff.map((w) => {
        const pw = { phones: w.p.map((x) => ({ spk: x.a, you: x.b })) };
        return h('div', { class: 'say-diff' },
          w.t ? h('b', null, w.t) : null,
          h('div', { class: 'say-pair' }, h('span', { class: 'small muted' }, t('Speaker')), h('span', { class: 'ipa say-ipa spk' }, pvPhones(pw.phones, 'spk'))),
          h('div', { class: 'say-pair' }, h('span', { class: 'small muted' }, t('You')), h('span', { class: 'ipa say-ipa you' }, pvPhones(pw.phones, 'you'))),
          h('p', { class: 'small' }, pvWhy(pw)));
      }),
      c.hidden ? h('p', { class: 'small muted' }, tp(c.hidden, '{n} more, less certain, not shown.', '{n} more, less certain, not shown.')) : null,
    ] : h('p', null, t('Euno found no clear differences from the speaker.')),
    h('p', { class: 'small muted' }, t('A computer comparison of sounds, so it can be wrong.')));
}

function sayFinderPanel(m) {
  const f = sayFinder(m);
  const input = h('input', { type: 'text', class: 'say-text', value: f.text, placeholder: t('The word or words you said'), 'aria-label': t('The word or words you said'),
    oninput: (e) => { f.text = e.target.value; },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); f.text = input.value; sayFindClips(f); openAsk(); } } });
  return h('div', { class: 'say-find' },
    h('p', { class: 'small muted' }, t('Type what you said, and Euno looks for a speaker saying it in your clips.')),
    h('div', { class: 'row' }, input, btn(t('Find'), () => { f.text = input.value; sayFindClips(f); openAsk(); }, { size: 'sm', kind: 'primary' })),
    f.hits ? (f.hits.length
      ? h('div', { class: 'say-hits' }, f.hits.map((hit) => {
        const clip = Store.get('clips', hit.clipId), v = clip && Store.get('videos', clip.videoId), busy = Say.cmpBusy === m.id;
        return h('div', { class: 'say-hit' },
          h('p', { class: 'say-snip' }, hit.before ? hit.before + ' ' : '', h('b', null, hit.said), hit.after ? ' ' + hit.after : ''),
          h('p', { class: 'small muted' }, `${clip ? clipName(clip) : ''}${v && v.speaker ? ` · ${v.speaker}` : ''}`),
          h('div', { class: 'row' },
            btn(t('Hear the speaker'), () => sayHear(hit), { size: 'sm', icon: 'play' }),
            btn(busy ? t('Comparing…') : t('Compare'), () => sayCompare(m, hit), { size: 'sm', kind: 'primary', disabled: !!Say.cmpBusy })));
      }))
      : h('p', { class: 'small' }, t('No clip in your library has those words.'))) : null,
    f.hits && f.unlabelled ? h('p', { class: 'small muted' }, tp(f.unlabelled, '{n} clip has no word labels yet, so it wasn’t searched. Settings → Analysis can prepare your library.', '{n} clips have no word labels yet, so they weren’t searched. Settings → Analysis can prepare your library.')) : null);
}

function sayRow(m) {
  const f = sayFinder(m);
  const good = m.level === 'good' && m.words.length;
  return h('div', { class: 'msg you say' },
    h('div', { class: 'say-head' }, btn('', () => sayPlay(m), { icon: 'play', size: 'sm', kind: 'ghost', title: t('Play your take'), aria: t('Play your take') }), h('span', { class: 'small muted' }, t('You said something ({sec})', { sec: fmtSec(m.sec) }))),
    good ? [
      sayWordLine(m.words, 'heard'),
      h('p', { class: 'small muted say-note' }, t('These are the sounds the model heard. It is a guess, not a grade; faded sounds are ones it was unsure of.') + (m.wordsFrom ? ' ' + t('The words come from speech recognition and can be wrong.') : '')),
    ] : h('p', null, t('Euno couldn’t read sounds from this take ({why}). Try again, a little closer to the microphone.', { why: (m.reasons.length ? m.reasons : ['low-confidence']).map((r) => (SAY_WHY[r] ? t(SAY_WHY[r]) : r)).join(', ') })),
    m.cmp ? sayCompareCard(m) : null,
    good ? h('div', { class: 'row' }, btn(m.cmp ? t('Compare with another speaker') : t('Compare with a speaker'), () => { f.open = !f.open; openAsk(); }, { size: 'sm', pressed: f.open })) : null,
    good && f.open ? sayFinderPanel(m) : null);
}

/* things the log shows besides messages: a take being read, a notice, an error */
function sayLogExtras() {
  const out = [];
  if (Say.phase === 'working') out.push(h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says muted' }, t('Listening to your take…'))));
  if (Say.cmpBusy) out.push(h('div', { class: 'msg-row' }, eunoLogo('logo'), h('div', { class: 'msg euno-says muted' }, t('Comparing with the speaker…'))));
  if (Say.notice === 'off') out.push(h('div', { class: 'tintcard' }, h('h3', null, t('Turn on Pronunciation analysis first')),
    h('p', null, t('Euno reads your sounds with a model that runs on this device (71 MB). It is off until you turn it on in Settings → Analysis.')),
    btn(t('Open Analysis'), () => { Say.notice = null; closeAsk(); openSettings('analysis'); }, { kind: 'primary', cls: 'self-start' })));
  if (Say.notice === 'model') out.push(h('div', { class: 'tintcard' }, h('h3', null, t('The sound model isn’t ready yet')),
    h('p', null, t('It is still downloading or loading. Try again in a moment; Settings → Analysis shows how far it is.'))));
  if (Say.error) out.push(h('p', { class: 'formerr' }, Say.error));
  return out;
}

function sayMic() {
  if (!sayCanOffer()) return null;
  const rec = Say.phase === 'recording';
  return btn('', sayToggle, { icon: rec ? 'stop' : 'mic', kind: rec ? 'primary' : 'ghost', title: rec ? t('Stop and read my take') : t('Say a word or a sentence'), aria: rec ? t('Stop and read my take') : t('Say a word or a sentence'), cls: 'say-mic', disabled: Ask.busy || Say.phase === 'working' });
}
function sayLive() {
  return Say.phase === 'recording' ? h('div', { class: 'say-live' }, h('i', { class: 'say-dot' }), h('span', { id: 'sayTime' }, fmtTime((performance.now() - Say.t0) / 1000)), h('span', { class: 'small muted' }, t('Say a word or a sentence, then tap the square.'))) : null;
}

/* one line for Ask Euno's background: the latest take, if it is recent (kept on the learner's own AI key, like the rest of the context) */
function saySummary() {
  const m = askDoc().messages.filter((x) => x.role === 'say').pop();
  if (!m || Date.now() - Date.parse(m.at) > 15 * 60000 || !m.words || !m.words.length) return [];
  const heard = m.words.map((w) => `${w.t ? w.t + ' ' : ''}/${w.p.map((x) => x.s).join('')}/`).join(' ');
  const out = [`The learner just said something into the microphone. The sound recogniser (it can be wrong, and it does not grade) heard: ${heard}.`];
  if (m.cmp && m.cmp.status === 'ok') for (const w of m.cmp.words.filter((x) => x.d).slice(0, 3)) out.push(`Compared with the speaker${w.t ? ` on "${w.t}"` : ''}: speaker /${w.p.map((x) => x.a || '').join('')}/, learner /${w.p.map((x) => x.b || '').join('')}/ (computer-detected, can be wrong).`);
  return out;
}
