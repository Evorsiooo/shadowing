/* ---------- Euno, the mascot ----------
   He is drawn live by the avatar engine (src/euno/, window.EunoEngine) and follows a few rules:
   - he always has a job: he shows what the app is doing, looks at what to do next, or reacts to how a pass went;
   - one Euno per screen, peeking from behind the card he's attending to (.peek in styles.css);
   - he listens and doesn't talk, except in Ask Euno, when asked;
   - no guilt: on a rest day he sleeps;
   - calm: he holds one pose in each place (EUNO_LOOKS) and a mood only changes his eyes; still for reduced motion;
   - what he shows is always also written in words next to him,
     so to screen readers he is decoration (aria-hidden).
   The app redraws most screens from scratch, so each place he appears is a named slot that keeps the same element and
   engine between redraws: moving him into the new markup carries on his animation instead of restarting it. */
/* each mood is one expression he holds (only his eyes change), and whether he blinks */
const EUNO_MOODS = {
  idle: ['attentive-left'],
  watching: ['downward-gaze'],
  reading: ['gentle-downward-gaze'],
  waiting: ['small-attentive'],
  listening: ['attentive-left'],
  shadowing: ['gentle-downward-gaze'],
  pondering: ['upward-side-glance'],
  working: ['curious-left'],
  pleased: ['joyful-down-right'],
  proud: ['joyful-wide'],
  happy: ['joyful-wide'],
  celebrate: ['joyful-wide'],
  sleeping: ['eyes-closed', false],
  drowsy: ['sleepy-squint', false],
  curious: ['curious-left'],
  searching: ['small-attentive'],
  confused: ['skeptical-left'],
  shy: ['shy-downward'],
};
/* where he faces in each place, [up/down, left/right] in degrees (negative: down, left); his pose stays put there */
const EUNO_LOOKS = {
  today: [-12, -22], // over the This week card, towards Start
  session: [-12, -20], // over the review card, towards its buttons
  focus: [-6, 18], // beside the instruction under the video, towards the words
  player: [-10, 0],
  panel: [-10, 0],
  ask: [-6, 14],
};
const EUNO_DEFS = new Map();
function eunoDefinition(look) {
  const key = look.join(',');
  if (!EUNO_DEFS.has(key)) EUNO_DEFS.set(key, EunoEngine.calm({ look, holds: EUNO_MOODS }));
  return EUNO_DEFS.get(key);
}
const Euno = {
  slots: new Map(),
  reduce: window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false },
  seen: typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const s = e.target._euno;
      if (!s) continue;
      s.visible = e.isIntersecting;
      if (e.isIntersecting) Euno.apply(s, true); else if (s.ctrl) s.ctrl.pause();
    }
  }) : null,

  /* the element for `slot`, showing `mood`; `then: [mood, ms]` moves on to another mood after a while */
  el(slot, mood, { cls = '', then = null } = {}) {
    let s = this.slots.get(slot);
    if (!s) {
      const host = h('span', { class: 'euno', 'aria-hidden': 'true' });
      s = { host, ctrl: null, mood: null, shown: null, visible: true, timer: null };
      host._euno = s;
      this.slots.set(slot, s);
      if (window.EunoEngine) {
        const look = EUNO_LOOKS[slot] || [0, 0];
        try { s.ctrl = EunoEngine.create(host, { definition: eunoDefinition(look), defaultExpression: (EUNO_MOODS[mood] || EUNO_MOODS.idle)[0], autoplay: false, ariaLabel: 'Euno' }); } catch (e) { console.warn('Euno could not be drawn', e); }
        const svgHost = host.firstChild;
        if (svgHost) { svgHost.removeAttribute('role'); svgHost.setAttribute('aria-hidden', 'true'); }
      }
      if (this.seen) this.seen.observe(host);
    }
    s.host.className = `euno ${cls}`.trim();
    const key = `${mood}|${then ? then.join(':') : ''}`;
    if (s.key !== key) {
      s.key = key;
      clearTimeout(s.timer);
      s.mood = mood;
      this.apply(s);
      if (then) s.timer = setTimeout(() => { s.mood = then[0]; this.apply(s); }, then[1]);
    }
    return s.host;
  },
  apply(s, resume = false) {
    if (!s.ctrl) return;
    const mood = EUNO_MOODS[s.mood] ? s.mood : 'idle';
    if (!s.visible) return; // starts when he scrolls into view
    if (this.reduce.matches) {
      const still = EUNO_MOODS[mood][0];
      if (s.shown !== `x:${still}`) { s.ctrl.setExpression(still); s.shown = `x:${still}`; }
      return;
    }
    if (s.shown !== `a:${mood}` || resume) { s.ctrl.play(mood); s.shown = `a:${mood}`; }
  },
  /* a slot that won't be shown again (a closed window) */
  drop(slot) {
    const s = this.slots.get(slot);
    if (!s) return;
    clearTimeout(s.timer);
    if (this.seen) this.seen.unobserve(s.host);
    if (s.ctrl) s.ctrl.destroy();
    this.slots.delete(slot);
  },
};
if (Euno.reduce.addEventListener) Euno.reduce.addEventListener('change', () => { for (const s of Euno.slots.values()) { s.shown = null; Euno.apply(s); } });

/* the logo: Euno drawn once as plain SVG at build time (EUNO_LOGO in scripts/build.mjs), so it costs nothing to show */
function eunoLogo(cls = 'logo') {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = typeof EUNO_LOGO === 'string' ? EUNO_LOGO : '';
  return el;
}
