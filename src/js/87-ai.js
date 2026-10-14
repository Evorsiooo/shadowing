/* ---------- AI feedback with your own key (Settings → AI, and the onboarding 'ai' step) ---------- */
/* The key goes to the server once and is stored encrypted; the app only ever sees its last 4
   characters. Without a key, notes fall back to "Copy prompt for AI". */
function aiPanel({ onboarding = false } = {}) {
  const wrap = h('div', { class: 'stack' });
  if (Store.mode !== 'cloud') {
    mount(wrap, h('p', { class: 'muted' }, t('Using your own AI key needs the online version of the app. Notes still offer a prompt you can copy into any AI chat.')));
    return wrap;
  }
  let st = null; // GET /api/ai: {available, providers, configured, provider, providerName, model, hint}
  let list = null; // {models, cheap} | {error}
  let replacing = false;
  let provider = 'anthropic';
  let filter = '';
  let testMsg = null;
  const keep = (s) => {
    st = { ...st, ...s };
    Api.ai = st.configured ? { provider: st.provider, providerName: st.providerName, model: st.model } : null;
  };
  const loadModels = async () => {
    list = null; draw();
    try { const r = await Api.req('GET', '/api/ai/models'); list = { models: r.models, cheap: r.cheap }; } catch (e) { list = { error: e.message }; }
    draw();
  };

  const keyForm = () => {
    const P = st.providers.find((p) => p.id === provider) || st.providers[0];
    const input = h('input', { type: 'password', id: 'ai-key', placeholder: P.keyHint, autocomplete: 'off', spellcheck: 'false' });
    const save = btn(t('Save key'), async () => {
      if (!input.value.trim()) { toast(t('Paste your API key first.'), 'bad'); return; }
      save.disabled = true;
      try {
        const r = await Api.req('PUT', '/api/ai', { provider, key: input.value.trim() });
        keep(r); replacing = false; testMsg = null;
        list = { models: r.models, cheap: r.model };
        draw(); toast(t('Key saved. Using {model}.', { model: r.model }), 'good');
      } catch (e) { toast(e.message, 'bad', 7000); save.disabled = false; }
    }, { kind: 'primary', size: 'sm' });
    return h('div', { class: 'stack' },
      h('div', { class: 'seg', role: 'group', 'aria-label': t('AI provider') }, st.providers.map((p) =>
        h('button', { type: 'button', class: p.id === provider ? 'on' : '', 'aria-pressed': String(p.id === provider), onclick: () => { provider = p.id; draw(); } }, p.name))),
      h('label', { class: 'field', for: 'ai-key' }, t('{provider} API key', { provider: P.name }), input),
      h('p', { class: 'small muted' }, t('Get one at {link}.', { link: '\u0000' }).split('\u0000').flatMap((part, i) => (i ? [h('a', { href: P.keyUrl, target: '_blank', rel: 'noopener noreferrer' }, P.keyUrl.replace(/^https:\/\//, '')), part] : [part])),
        ' ', t('It’s stored encrypted on our server, only used for your feedback, and never shown again. You pay your provider directly; one answer on the default model costs a tiny fraction of a cent.')),
      h('div', { class: 'row' }, save, replacing ? btn(t('Cancel'), () => { replacing = false; draw(); }, { size: 'sm', kind: 'ghost' }) : null));
  };

  const modelPicker = () => {
    if (!list) return h('p', { class: 'small muted' }, t('Loading models…'));
    if (list.error) return h('p', { class: 'small' }, h('span', { class: 'formerr' }, list.error), ' ', btn(t('Try again'), loadModels, { size: 'sm', kind: 'ghost' }));
    let models = list.models;
    if (!models.some((m) => m.id === st.model)) models = [{ id: st.model, name: st.model }, ...models];
    const many = models.length > 30;
    const q = filter.trim().toLowerCase();
    const shown = q ? models.filter((m) => m.id === st.model || `${m.id} ${m.name}`.toLowerCase().includes(q)) : models;
    const label = (m) => `${m.name}${m.name !== m.id ? ` (${m.id})` : ''}${m.id === list.cheap ? ` · ${t('cheap and fast')}` : ''}${m.note ? ` · ${m.note}` : ''}`;
    return h('div', { class: 'stack' },
      many ? h('label', { class: 'field', for: 'ai-filter' }, t('Find a model'),
        h('input', { type: 'search', id: 'ai-filter', value: filter, placeholder: t('e.g. haiku, mini, flash'), oninput: (e) => { filter = e.target.value; const pos = e.target.selectionStart; draw(); const f = $('#ai-filter'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } } })) : null,
      h('label', { class: 'field', for: 'ai-model' }, t('Model'),
        h('select', { id: 'ai-model', onchange: async (e) => {
          try { keep(await Api.req('PUT', '/api/ai', { model: e.target.value })); testMsg = null; draw(); toast(t('Now using {model}.', { model: st.model }), 'good'); } catch (err) { toast(err.message, 'bad'); }
        } }, shown.map((m) => h('option', { value: m.id, selected: m.id === st.model }, label(m))))),
      list.cheap && st.model !== list.cheap ? h('p', { class: 'small muted' }, t('Short feedback like this doesn’t need a big model.'), ' ',
        btn(t('Use {model}', { model: list.cheap }), async () => { try { keep(await Api.req('PUT', '/api/ai', { model: list.cheap })); draw(); } catch (err) { toast(err.message, 'bad'); } }, { size: 'sm', kind: 'ghost' })) : null);
  };

  const draw = () => {
    if (!st) { mount(wrap, h('p', { class: 'small muted' }, t('Checking…'))); return; }
    if (!st.available) { mount(wrap, h('p', { class: 'muted' }, t('AI keys aren’t switched on for this site yet. Notes still offer a prompt you can copy into any AI chat.'))); return; }
    const intro = onboarding ? null : h('p', { class: 'muted' }, t('Get feedback on your notes right inside the app, using your own key from Anthropic, OpenAI or OpenRouter. This is optional: without a key, notes give you a prompt to copy into any AI chat.'));
    if (!st.configured || replacing) { mount(wrap, intro, keyForm()); return; }
    const test = btn(t('Test key'), async () => {
      test.disabled = true; testMsg = h('span', { class: 'muted' }, t('Asking…')); draw();
      try {
        const r = await Api.req('POST', '/api/ai/test', { profile: profileForAI() });
        testMsg = r.ok ? h('span', { class: 'formok' }, t('It works: {model} answered in {secs} s.', { model: r.model, secs: fmtNum(r.ms / 1000, 1) })) : h('span', { class: 'formerr' }, t('The model answered, but not in the expected format. Try another model.'));
      } catch (e) { testMsg = h('span', { class: 'formerr' }, e.message); }
      draw();
    }, { size: 'sm' });
    mount(wrap, intro,
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, icon('check'), t('{provider} key saved ({hint})', { provider: st.providerName, hint: st.hint })),
        btn(t('Replace key'), () => { replacing = true; provider = st.provider; draw(); }, { size: 'sm' }),
        btn(t('Remove key'), async () => {
          try { await Api.req('DELETE', '/api/ai'); keep({ configured: false }); list = null; testMsg = null; draw(); toast(t('Key removed. Notes will offer “Copy prompt for AI”.')); } catch (e) { toast(e.message, 'bad'); }
        }, { size: 'sm', kind: 'ghost' })),
      modelPicker(),
      h('div', { class: 'row' }, test, testMsg ? h('span', { class: 'small', role: 'status' }, testMsg) : null));
  };

  draw();
  Api.req('GET', '/api/ai').then((r) => { keep(r); draw(); if (r.configured) loadModels(); })
    .catch((e) => mount(wrap, h('p', { class: 'formerr' }, e.message)));
  return wrap;
}
