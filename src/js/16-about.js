/* ---------- what Euno knows about you ----------
   Short facts about the learner (level, goals, background, how they like to practise) in meta/about:
   { facts: [{ id, text, at, by: 'euno' | 'ai' | 'you' }] }. Euno adds them during a chat (87-ask.js), the learner's own AI can
   add or remove them over MCP (server/about.js), and they are listed, edited and deleted in Settings → You. They go to the learner's
   AI provider with each question and note, next to what they typed in "Anything Euno should know". */
const ABOUT_MAX = 30;
const About = {
  facts() { const d = Store.get('meta', 'about'); return d && Array.isArray(d.facts) ? d.facts.filter((f) => f && f.id && f.text) : []; },
  /* another app may have saved a fact since this page loaded: take the server's copy before changing anything */
  async refresh() {
    if (Store.mode !== 'cloud') return;
    try {
      const r = await Api.req('GET', '/api/docs/meta/about');
      if (r && r.data) Store.data.meta.about = { ...r.data, id: 'about' }; else delete Store.data.meta.about;
    } catch { /* offline: work from what is here */ }
  },
  save(facts) { Store.put('meta', { id: 'about', facts: facts.slice(-ABOUT_MAX) }); },
  async add(texts, by = 'you') {
    await this.refresh();
    const facts = this.facts();
    const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const added = [];
    for (const raw of texts) {
      const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (text.length < 3 || facts.some((f) => norm(f.text) === norm(text))) continue;
      const f = { id: uid(), text, at: dayKey(), by };
      facts.push(f); added.push(f);
    }
    if (added.length) this.save(facts);
    return added;
  },
  async edit(id, text) {
    await this.refresh();
    const t2 = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    this.save(this.facts().flatMap((f) => (f.id !== id ? [f] : t2 ? [{ ...f, text: t2 }] : [])));
  },
  async remove(id) {
    await this.refresh();
    this.save(this.facts().filter((f) => f.id !== id));
  },
};

/* the card in Settings → You */
function aboutCard() {
  const list = h('div', { class: 'about-list' });
  const draw = () => {
    const facts = About.facts();
    mount(list, ...(facts.length ? facts.map((f) => h('div', { class: 'about-row' },
      h('input', { type: 'text', maxlength: 200, value: f.text, 'aria-label': t('What Euno knows about you'),
        onchange: async (e) => { await About.edit(f.id, e.target.value); draw(); } }),
      btn('', async () => { await About.remove(f.id); draw(); }, { kind: 'ghost', size: 'sm', icon: 'close', title: t('Forget this'), aria: t('Forget this') })))
      : [h('p', { class: 'small muted' }, t('Nothing yet. Tell Euno about yourself in a chat, or tell your own AI app connected to Euno, and it appears here.'))]));
  };
  draw();
  About.refresh().then(draw);
  const input = h('input', { type: 'text', maxlength: 200, placeholder: t('e.g. Is C2 in English except for speaking.'), 'aria-label': t('Add something Euno should know') });
  const add = async () => { const v = input.value; input.value = ''; if (v.trim()) { await About.add([v], 'you'); draw(); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return h('div', { class: 'card' }, h('h3', null, t('What Euno knows about you')),
    h('p', { class: 'small muted' }, t('Euno saves things you tell him about yourself, such as your level and goals. Your own AI app can too, if you connected one. Edit or forget any of it. It is sent to your AI provider with your questions.')),
    list, h('div', { class: 'about-row' }, input, btn(t('Add'), add, { size: 'sm' })));
}
