/* ---------- "words that may have been unclear": the browser's speech recognition, opt-in ----------
   Chrome's Web Speech API only listens live to the microphone and sends the audio to Google, so it runs only when the
   learner switches it on (Settings → Sync and microphone), only during a recorded pass, and only keeps the text. */
const SPEECH_LANGS = { en: 'en-AU', fr: 'fr-FR', es: 'es-ES' };

const Speech = {
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },

  /* start listening; the returned stop() resolves with everything recognised (or null if nothing was) */
  start(lang) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return null;
    const parts = [];
    let on = true, r = null;
    const open = () => {
      try {
        r = new Rec();
        r.lang = SPEECH_LANGS[lang] || lang;
        r.continuous = true; r.interimResults = false;
        r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) parts.push(e.results[i][0].transcript); };
        r.onend = () => { if (on) open(); }; // the browser ends a session after a pause; carry on
        r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network' || e.error === 'language-not-supported') on = false; };
        r.start();
      } catch (e) { on = false; }
    };
    open();
    return {
      stop: () => new Promise((done) => {
        on = false;
        const finish = () => { const s = parts.join(' ').trim(); done(s || null); };
        if (!r) { finish(); return; }
        const timer = setTimeout(finish, 1500);
        r.onend = () => { clearTimeout(timer); finish(); };
        try { r.stop(); } catch (e) { clearTimeout(timer); finish(); }
      }),
    };
  },

  words(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  },

  /* the clip's words that don't appear in what was heard, in order (longest common subsequence). Null if too little to go on */
  unclear(sentence, heard) {
    const want = this.words(sentence), got = this.words(heard);
    if (want.length < 3 || got.length < 1) return null;
    const n = want.length, m = got.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = want[i] === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const raw = String(sentence).split(/\s+/).filter(Boolean);
    const shown = raw.length === n ? raw.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')) : want;
    const missing = [];
    let i = 0, j = 0;
    while (i < n) {
      if (j < m && want[i] === got[j]) { i++; j++; } else if (j < m && L[i][j + 1] >= L[i + 1][j]) j++; else { missing.push(shown[i]); i++; }
    }
    return { missing, total: n, heardWords: m };
  },
};
