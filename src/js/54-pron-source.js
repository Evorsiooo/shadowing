/* ---------- pronunciation data source ----------
   The Pronunciation tab (55-pronunciation.js) reads everything through PronSource. PronSource uses the engine
   (global `Phones`, src/js/24-phones.js, contract v1 in euno/pronunciation-contract.md) when it exists and a
   MOCK otherwise. THE MOCK IS DEMO DATA: it invents words and sounds, in the engine's ClipResult shape, so the
   conversion below is the real one.

   What the view gets (times in seconds from the start of the clip):
   PronPhone  { spk: string|null, you: string|null }   aligned pair; null = nothing there (left out / added)
   PronWord   { text: string|null, start, end, phones: PronPhone[], differs: boolean, confidence: 0..1 }
              text is null when no word covers it (no words for the clip, or the recogniser skipped it): the view then shows its sounds.
              ext = index of that word in clip.words (for fixing its spelling), else null.
   PronResult { confidence: 'ok'|'low', lowWho: 'you'|'speaker'|null, words: PronWord[], hidden: number }
              hidden = real but less certain differences that are not shown (the engine's top 3 only, never padded)

   PronSource.supported()        -> { ok, reason? }
   PronSource.status()           -> ModelStatus  (state: unsupported|not-downloaded|downloading|downloaded|loading|ready|error)
   PronSource.onStatus(fn)       -> unsubscribe
   PronSource.download()         -> Promise<void>   (normally started by the Settings → Analysis switch; this is the fallback)
   PronSource.load()             -> Promise<void>   (download if needed, then load into memory)
   PronSource.stop()             -> stop loading the model
   PronSource.analyse(clip, take, signal?)-> Promise<PronResult>  take = { id, blob, url, ref, analysis } or null (speaker only) */

/* engine words (PhoneWord, no text) + the differences to show -> PronWord[] */
function pronWords(S, shown, ext) {
  const exts = ext && ext.source !== 'none' ? ext.words : null;
  return S.words.map((w, wi) => {
    const phones = [];
    const mine = shown.filter((d) => d.speaker && d.speaker.i >= w.first && d.speaker.i <= w.last);
    for (let i = w.first; i <= w.last; i++) {
      const p = S.phones[i], d = mine.find((x) => x.speaker.i === i);
      phones.push({ spk: p.sym, you: d ? (d.learner ? d.learner.sym : null) : p.sym });
    }
    const ins = shown.filter((d) => d.kind === 'ins' && d.speakerWord === wi && d.learner);
    ins.forEach((d) => phones.push({ spk: null, you: d.learner.sym }));
    let text = null, ext = null;
    if (exts) { // the external word most of this word's sounds fall in
      const n = {};
      for (let i = w.first; i <= w.last; i++) if (S.phones[i].extWord != null) n[S.phones[i].extWord] = (n[S.phones[i].extWord] || 0) + 1;
      const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
      if (best != null && exts[best]) { text = exts[best].text; ext = +best; }
    }
    const used = mine.concat(ins);
    return { text, ext, start: w.t0, end: w.t1, phones, differs: used.length > 0, confidence: used.length ? Math.max(...used.map((d) => d.confidence)) : 1 };
  });
}
function pronFromClipResult(res) {
  const D = res.comparison.diffs, shown = res.suggested.map((id) => D.find((d) => d.id === id)).filter(Boolean);
  const bad = res.status !== 'ok';
  return {
    confidence: bad ? 'low' : 'ok',
    lowWho: res.status === 'speaker-low-quality' ? 'speaker' : bad ? 'you' : null,
    words: pronWords(res.speaker, bad ? [] : shown, res.speaker.external),
    hidden: bad ? 0 : D.filter((d) => !d.weak && !shown.includes(d)).length,
  };
}
function pronFromSequence(seq) {
  const bad = seq.quality.level !== 'good';
  return { confidence: bad ? 'low' : 'ok', lowWho: bad ? 'speaker' : null, words: bad ? [] : pronWords(seq, [], seq.external), hidden: 0 };
}

const PronSource = (() => {
  // ---- the mock: a ClipResult built from a few invented words ----
  const DEMO = [
    ['It', 0.25, 0.38, 'ɪt'], ['was', 0.38, 0.62, 'wəz'], ['an', 0.62, 0.78, 'ən'],
    ['unbelievably', 0.85, 1.78, 'ʌnbɪˈl{i}vəbli', 'ʌnbɪˈl{ɪ}vəbli', 0.8],
    ['important', 1.84, 2.42, 'ɪmˈpɔ{ɹ}tənt', 'ɪmˈpɔ{}tənt', 0.7],
    ['opportunity', 2.58, 3.5, 'ˌɑpɚˈ{t}unəti', 'ˌɑpɚˈ{tʃ}unəti', 0.6],
    ['for', 3.56, 3.74, 'fɔɹ'], ['us', 3.74, 4.08, 'ʌs'],
  ];
  const TOKEN = /[ˈˌ]?(?:tʃ|dʒ|.)/gu;
  function pairs(a, b) {
    const A = a.split(/(\{[^}]*\})/), B = b.split(/(\{[^}]*\})/), out = [];
    A.forEach((seg, i) => {
      if (seg.startsWith('{')) out.push({ spk: seg.slice(1, -1) || null, you: B[i].slice(1, -1) || null });
      else for (const m of seg.matchAll(TOKEN)) out.push({ spk: m[0], you: m[0] });
    });
    return out;
  }
  const forced = (() => { try { return new URLSearchParams(location.search).get('pron') || ''; } catch { return ''; } })();
  const quality = (level) => ({ level, reasons: [], durationSec: 4, speechSec: 3, meanConf: 0.8, phonesPerSpeechSec: 12, droppedOnSilence: 0 });
  function mockResult(clip, withDiffs) {
    const k = (clip.end - clip.start) / 4.4;
    const mk = (side) => {
      const phones = [], words = [], ext = [];
      DEMO.forEach(([text, a, b, spk, you], wi) => {
        const ps = pairs(spk, you || spk).filter((p) => p[side]);
        const first = phones.length;
        ps.forEach((p, j) => phones.push({ sym: p[side], t0: (a + (b - a) * j / ps.length) * k, t1: (a + (b - a) * (j + 1) / ps.length) * k, conf: 0.8, word: wi, extWord: forced === 'nowords' ? undefined : wi }));
        words.push({ first, last: phones.length - 1, t0: a * k, t1: b * k });
        ext.push({ text, t0: a * k, t1: b * k });
      });
      return { v: 1, model: 'zipa-small-crctc-300k-int8', phones, words, frameSec: 0.04, durationSec: 4.4 * k, originSec: 0, quality: quality('good'), external: forced === 'nowords' ? undefined : { source: 'asr', words: ext } };
    };
    const speaker = mk('spk'), learner = mk('you'), diffs = [];
    let si = 0, li = 0;
    DEMO.forEach(([, , , spk, you, conf], wi) => {
      const ps = pairs(spk, you || spk);
      ps.forEach((p) => {
        if (p.spk && p.you === p.spk) { si++; li++; return; }
        if (!you || !withDiffs) { if (p.spk) si++; if (p.you) li++; return; }
        const kind = !p.you ? 'del' : 'sub';
        diffs.push({ id: `${kind}:${si}:${p.you ? li : '-'}`, kind, pair: `${p.spk}→${p.you || '∅'}`, speaker: { i: si, sym: p.spk, t0: 0, t1: 0, conf }, learner: p.you ? { i: li, sym: p.you, t0: 0, t1: 0, conf } : null, t0: 0, t1: 0, learnerT0: 0, learnerT1: 0, speakerWord: wi, learnerWord: wi, distance: 0.5, confidence: conf, weak: false });
        si++; if (p.you) li++;
      });
    });
    diffs.push({ id: 'sub:99:99', kind: 'sub', pair: 'ə→ɪ', speaker: { i: 0, sym: 'ɪ', t0: 0, t1: 0, conf: 0.3 }, learner: null, t0: 0, t1: 0, learnerT0: 0, learnerT1: 0, speakerWord: 99, learnerWord: 99, distance: 0.2, confidence: 0.3, weak: false });
    const bad = forced === 'low' ? 'learner-low-quality' : forced === 'speakerlow' ? 'speaker-low-quality' : 'ok';
    return { v: 1, key: 'mock', createdAt: 0, speaker, learner, comparison: { v: 1, ops: [], diffs, stats: { speakerPhones: 0, learnerPhones: 0, agreement: 0.9, subs: 0, dels: 0, inss: 0 } }, status: withDiffs ? bad : 'ok', suggested: withDiffs && forced !== 'clean' ? diffs.slice(0, 3).map((d) => d.id) : [] };
  }
  // ?pron=missing|downloading|unsupported|analysing|clean|low|speakerlow|nowords picks a state to look at while this is a mock
  const subs = new Set();
  const M = { state: forced === 'missing' ? 'not-downloaded' : forced === 'downloading' ? 'downloading' : forced === 'unsupported' ? 'unsupported' : 'ready', progress: forced === 'downloading' ? 0.42 : 0, bytes: 71e6, slow: false, credit: '' };
  const tell = () => subs.forEach((fn) => fn({ ...M }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mock = {
    supported: () => (M.state === 'unsupported' ? { ok: false, reason: 'browser' } : { ok: typeof WebAssembly === 'object' }),
    status: () => ({ ...M }),
    onStatus(fn) { subs.add(fn); return () => subs.delete(fn); },
    async download() {
      if (M.state === 'ready') return;
      M.state = 'downloading'; M.progress = 0; tell();
      while (M.progress < 1) { await wait(160); M.progress = Math.min(1, M.progress + 0.08); tell(); }
      M.state = 'ready'; tell();
    },
    async load() { await this.download(); },
    stop() {},
    async analyse(clip, take, signal) {
      if (forced === 'analysing') await new Promise(() => {});
      await wait(take ? 900 : 150);
      const res = mockResult(clip, !!take);
      return take ? pronFromClipResult(res) : pronFromSequence(res.speaker);
    },
  };

  // ---- the engine: samples for the clip and the take, then Phones.analyse ----
  // The speaker's sound is read from the video on demand (a YouTube/hosted video or a local file), so it may not be decoded yet when a take is compared: fetch it here, with one more try, and say why when it can't be read.
  async function speakerSamples(clip, signal) {
    const get = () => VideoAudio.slice(clip.videoId, clip.start, clip.end);
    let spk = get();
    for (let attempt = 0; !spk && attempt < 2; attempt++) {
      const video = Store.get('videos', clip.videoId);
      if (!video) throw new Error(t('This clip’s video isn’t in your library any more.'));
      const e = await VideoAudio.ensure(video, clip.start, clip.end);
      if (signal && signal.aborted) throw new DOMException('Stopped', 'AbortError');
      spk = get();
      if (!spk && e && e.status === 'error' && attempt) throw new Error(e.error || t('The video’s sound couldn’t be read.'));
    }
    if (!spk) throw new Error(t('The speaker’s sound couldn’t be read from the video. Load the video again (a local file works best) and try again.'));
    return spk;
  }
  const real = {
    supported: () => Phones.supported(),
    status: () => Phones.status(),
    onStatus: (fn) => Phones.onStatus(fn),
    download: () => Phones.download(),
    load: () => Phones.load(),
    stop: () => Phones.stop(),
    async analyse(clip, take, signal) {
      clip = Store.get('clips', clip.id) || clip; // words may have arrived or been fixed since the tab opened
      const spk = await speakerSamples(clip, signal);
      // words, when the clip has them (clip.words = [{w, s, e}], automatic or fixed by the learner, seconds from the clip start); sounds alone otherwise.
      // Attached after the engine, never passed in: its cached results must not freeze an older version of the words.
      const external = clip.words && clip.words.length ? { source: 'asr', words: clip.words.map((x) => ({ text: x.w, t0: x.s, t1: x.e })) } : undefined;
      const withWords = (seq) => (external ? Phones.attachExternalWords(seq, external) : { ...seq, external: undefined });
      if (!take) return pronFromSequence(withWords(await Heavy.run('pronunciation', () => Phones.transcribe(spk, { originSec: 0 }), { timeoutMs: 90000, signal })));
      const blob = take.blob || (await (await fetch(await Store.blobUrl(take.ref))).blob());
      const you = await AudioEng.decodeBlob(blob);
      const res = await Heavy.run('pronunciation', () => Phones.analyse(spk, you, { speakerOriginSec: 0 }), { timeoutMs: 90000, signal });
      return pronFromClipResult({ ...res, speaker: withWords(res.speaker) });
    },
  };
  return new Proxy({}, { get: (_, k) => (typeof Phones !== 'undefined' ? real : mock)[k], has: (_, k) => k in mock });
})();
