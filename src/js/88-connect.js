/* ---------- Settings → Connected apps: the MCP server for Claude, ChatGPT and Gemini ---------- */
function connectedAppsView() {
  const wrap = h('div', { class: 'stack' });
  if (Store.mode !== 'cloud') {
    mount(wrap, h('p', { class: 'muted' }, 'Connecting AI apps needs the online version of the app.'));
    return wrap;
  }
  const url = `${location.origin}/mcp`;
  let list = null; // [{id, name, host, created, lastUsed}]
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Address copied.'); } catch { toast(url); }
  };
  const draw = () => {
    mount(wrap,
      h('p', { class: 'muted' }, 'Let Claude, ChatGPT or Gemini read your practice: your sessions, notes, issues and progress. They can ask things like “what did I struggle with this week?” They can’t change anything, and they never see your recordings, AI keys or Discord webhook.'),
      h('div', { class: 'card' }, h('h3', null, 'Server address'),
        h('div', { class: 'row' }, h('code', { style: { wordBreak: 'break-all' } }, url), btn('Copy', copy, { size: 'sm' })),
        h('ul', { class: 'small', style: { margin: '6px 0 0', paddingLeft: '20px' } },
          h('li', null, h('strong', null, 'Claude: '), 'Settings → Connectors → Add (top right). Give it a name, paste the address, then Continue. Leave everything as it is, then Add and Connect.'),
          h('li', null, h('strong', null, 'ChatGPT: '), 'Plugins (sidebar) → Add (top right) → Add Custom MCP Server. Give it a name, paste the address, then Authenticate.'),
          h('li', null, h('strong', null, 'Gemini: '), 'Settings → Connected apps → Custom (top right). Paste the address, then Connect.')),
        h('p', { class: 'small muted' }, 'You’ll be asked to sign in here and allow the app.')),
      h('div', { class: 'card' }, h('h3', null, 'Connected'),
        !list ? h('p', { class: 'small muted' }, 'Checking…')
          : !list.length ? h('p', { class: 'small muted' }, 'No apps connected yet.')
            : h('div', { class: 'stack' }, list.map((c) => h('div', { class: 'row' },
              h('span', null, h('strong', null, c.name), h('span', { class: 'small muted' }, ` · connected ${fmtDay(c.created)}${c.lastUsed ? `, last used ${fmtDay(c.lastUsed)}` : ''}`)),
              btn('Disconnect', async () => {
                if (!confirm(`Disconnect ${c.name}? It loses access straight away. You can connect it again later.`)) return;
                try { await Api.req('DELETE', `/api/connections/${encodeURIComponent(c.id)}`); list = list.filter((x) => x.id !== c.id); draw(); toast(`${c.name} disconnected.`); } catch (e) { toast(e.message, 'bad'); }
              }, { size: 'sm', kind: 'ghost' }))))));
  };
  const fmtDay = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  draw();
  Api.req('GET', '/api/connections').then((d) => { list = d.connections || []; draw(); }).catch((e) => { list = []; draw(); toast(e.message, 'bad'); });
  return wrap;
}
