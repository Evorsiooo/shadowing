/* ---------- admin page: users, sign-up and invite codes, support inbox ---------- */
/* Only shown to admins (Api.role); the server checks the role again on every /api/admin call. */
ICONS.shield = '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>';

const Admin = { tab: 'users', open: 0 };
const AI_PROVIDER_NAMES = { anthropic: 'Anthropic', openai: 'OpenAI', openrouter: 'OpenRouter' };
const isAdmin = () => Store.mode === 'cloud' && Api.role === 'admin';

function fmtWhen(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 86400000);
  const date = fmtDate(d, d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  if (ms > Date.now()) return date; // invite end dates
  return days < 1 ? t('today {time}', { time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }) : days < 2 ? t('yesterday') : date;
}

async function openAdmin(tab = Admin.tab) {
  Admin.tab = tab;
  const tabs = [['users', t('Users')], ['signup', t('Sign-up')], ['inbox', Admin.open ? t('Inbox ({n})', { n: Admin.open }) : t('Inbox')]];
  const body = h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('Loading…')));
  openView([
    modalHead(t('Admin'), t('Accounts, sign-up and messages from the contact form.')),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => btn(l, () => openAdmin(k), { size: 'sm', on: k === tab }))),
    body,
  ], { page: 'admin', sub: tab === 'users' ? null : tab });
  try {
    const view = tab === 'users' ? await adminUsersView() : tab === 'signup' ? await adminSignupView() : await adminInboxView();
    if (Admin.tab === tab && body.isConnected) mount(body, view);
  } catch (e) {
    if (body.isConnected) mount(body, h('p', { class: 'muted' }, t('Couldn’t load this: {error}', { error: e.message })), btn(t('Try again'), () => openAdmin(tab), { size: 'sm' }));
  }
}

/* ---------- users ---------- */
async function adminUsersView() {
  const { users } = await Api.req('GET', '/api/admin/users');
  const active = users.filter((u) => u.last_seen && Date.now() - u.last_seen < 7 * 86400000).length;
  return h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, tp(users.length, '{n} account, {active} active in the last 7 days. Practice data stays private: you see counts, not content.', '{n} accounts, {active} active in the last 7 days. Practice data stays private: you see counts, not content.', { active })),
    h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, [t('Account'), t('Joined'), t('Last seen'), t('Sessions'), t('Drive'), t('AI key'), ''].map((x) => h('th', null, x)))),
      h('tbody', null, users.map((u) => h('tr', null,
        h('td', null,
          h('div', { style: { fontWeight: 600 } }, u.name || u.email, u.role === 'admin' ? h('span', { class: 'muted small' }, ` · ${t('admin')}`) : null, u.disabled ? h('span', { class: 'small', style: { color: 'var(--red)' } }, ` · ${t('disabled')}`) : null),
          u.name ? h('div', { class: 'small muted' }, u.email) : null,
          u.invite_code ? h('div', { class: 'small muted' }, t('Invite {code}', { code: u.invite_code })) : null),
        h('td', null, fmtWhen(u.created)),
        h('td', null, fmtWhen(u.last_seen)),
        h('td', null, String(u.sessions)),
        h('td', null, u.drive ? t('Connected@@drive') : h('span', { class: 'muted' }, t('No'))),
        h('td', null, u.ai ? (AI_PROVIDER_NAMES[u.ai] || u.ai) : h('span', { class: 'muted' }, t('No'))),
        h('td', null, u.self || u.role === 'admin' ? null : h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
          btn(u.disabled ? t('Enable') : t('Disable'), () => adminSetDisabled(u, !u.disabled), { size: 'sm', title: u.disabled ? t('Let this account sign in again') : t('Sign this account out and stop it signing in') }),
          btn(t('Delete'), () => adminConfirmDelete(u), { size: 'sm', kind: 'danger' }))))))),
    ));
}

async function adminSetDisabled(u, disabled) {
  try {
    await Api.req('PATCH', `/api/admin/users/${encodeURIComponent(u.id)}`, { disabled });
    toast(disabled ? t('{email} is disabled and signed out.', { email: u.email }) : t('{email} can sign in again.', { email: u.email }), 'good');
  } catch (e) { toast(e.message, 'bad', 7000); }
  openAdmin('users');
}

function adminConfirmDelete(u) {
  const input = h('input', { type: 'text', id: 'admin-del', placeholder: u.email, autocomplete: 'off', spellcheck: 'false', autofocus: true });
  openModal([
    modalHead(t('Delete this account?')),
    h('p', null, t('This deletes {email} and everything the server keeps for it (practice data, files, reminders), for good. They can sign up again later as a new account.', { email: u.email })),
    h('label', { class: 'field', for: 'admin-del' }, t('Type their email address to confirm'), input),
    h('div', { class: 'row' },
      btn(t('Delete account'), async () => {
        try {
          await Api.req('DELETE', `/api/admin/users/${encodeURIComponent(u.id)}`, { confirm: input.value });
          toast(t('{email} was deleted.', { email: u.email }), 'good');
          openAdmin('users');
        } catch (e) { toast(e.message, 'bad', 7000); }
      }, { kind: 'danger' }),
      btn(t('Cancel'), () => openAdmin('users'), { kind: 'ghost' })),
  ], { narrow: true, onClose: () => openAdmin('users') });
}

/* ---------- sign-up mode and invite codes ---------- */
async function adminSignupView() {
  const [{ mode }, { invites }] = await Promise.all([Api.req('GET', '/api/admin/signup'), Api.req('GET', '/api/admin/invites')]);
  const setMode = async (m) => {
    if (m === mode) return;
    try { await Api.req('PUT', '/api/admin/signup', { mode: m }); toast(m === 'open' ? t('Anyone can sign up now.') : t('Sign-up is invite-only now.'), 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
    openAdmin('signup');
  };
  const draft = { maxUses: 1, expiresDays: '', note: '' };
  const create = async () => {
    try {
      const { invite } = await Api.req('POST', '/api/admin/invites', draft);
      copyInvite(invite.code, true);
    } catch (e) { toast(e.message, 'bad', 7000); return; }
    openAdmin('signup');
  };
  const statusText = { active: t('Active'), used: t('Used up'), ended: t('Ended') };
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, t('Who can sign up')),
      h('div', { class: 'row', role: 'group', 'aria-label': t('Sign-up mode') },
        btn(t('Anyone'), () => setMode('open'), { on: mode === 'open', pressed: mode === 'open' }),
        btn(t('Invite code needed'), () => setMode('invite'), { on: mode === 'invite', pressed: mode === 'invite' })),
      h('p', { class: 'small muted' }, mode === 'open'
        ? t('Anyone with a Google account can create an account.')
        : t('New people paste an invite code before signing in with Google. People who already have an account sign in as usual.'))),
    h('div', { class: 'card' }, h('h3', null, t('New invite code')),
      h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' } },
        h('label', { class: 'field', for: 'inv-uses' }, t('How many people can use it'),
          h('input', { type: 'number', id: 'inv-uses', min: 1, max: 1000, step: 1, value: draft.maxUses, oninput: (e) => { draft.maxUses = e.target.value; } })),
        h('label', { class: 'field', for: 'inv-days' }, t('Ends after (days, empty = never)'),
          h('input', { type: 'number', id: 'inv-days', min: 1, max: 365, step: 1, placeholder: t('Never'), oninput: (e) => { draft.expiresDays = e.target.value; } })),
        h('label', { class: 'field', for: 'inv-note' }, t('Note (who it’s for)'),
          h('input', { type: 'text', id: 'inv-note', maxlength: 200, placeholder: t('Optional'), oninput: (e) => { draft.note = e.target.value; } }))),
      h('div', { class: 'row' }, btn(t('Create code'), create, { kind: 'primary', icon: 'plus' }))),
    h('div', { class: 'card' }, h('h3', null, t('Invite codes')),
      invites.length ? h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, [t('Code'), t('Used'), t('Ends'), t('Used by'), ''].map((x) => h('th', null, x)))),
        h('tbody', null, invites.map((i) => h('tr', null,
          h('td', null, h('div', { style: { fontWeight: 600, fontFamily: 'ui-monospace, monospace' } }, i.code),
            h('div', { class: 'small muted' }, [statusText[i.status], i.note].filter(Boolean).join(' · '))),
          h('td', null, t('{uses} of {max}', { uses: i.uses, max: i.max_uses })),
          h('td', null, i.expires ? fmtWhen(i.expires) : t('Never')),
          h('td', { class: 'small' }, i.usedBy.length ? i.usedBy.map((u) => h('div', null, u.email)) : h('span', { class: 'muted' }, t('Nobody yet'))),
          h('td', null, i.status === 'active' ? h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
            btn(t('Copy link'), () => copyInvite(i.code), { size: 'sm' }),
            btn(t('Revoke'), async () => {
              try { await Api.req('DELETE', `/api/admin/invites/${encodeURIComponent(i.code)}`); toast(t('Code revoked.'), 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
              openAdmin('signup');
            }, { size: 'sm', kind: 'danger' })) : null)))))) : h('p', { class: 'small muted' }, t('No codes yet.'))));
}

/* the sign-in link with the code filled in, so people don't have to type it */
async function copyInvite(code, created = false) {
  const link = `${location.origin}/auth/google?invite=${encodeURIComponent(code)}`;
  try {
    await navigator.clipboard.writeText(link);
    toast(created ? t('Created {code}. The sign-up link is copied.', { code }) : t('Sign-up link copied.'), 'good', 6000);
  } catch {
    toast(created ? t('Created {code}. Sign-up link: {link}', { code, link }) : link, 'good', 12000);
  }
}

/* ---------- support inbox ---------- */
async function adminInboxView() {
  const { messages } = await Api.req('GET', '/api/admin/support');
  Admin.open = messages.filter((m) => m.status === 'open').length;
  const setStatus = async (m, status) => {
    try { await Api.req('PATCH', `/api/admin/support/${encodeURIComponent(m.id)}`, { status }); } catch (e) { toast(e.message, 'bad', 7000); }
    openAdmin('inbox');
  };
  if (!messages.length) return h('p', { class: 'muted' }, t('No messages yet. Anything sent through the contact form shows up here.'));
  return h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, Admin.open ? tp(Admin.open, '{n} message to handle.', '{n} messages to handle.') : t('All handled.')),
    messages.map((m) => {
      const subject = encodeURIComponent('Re: your message to Euno Shadowing');
      const quoted = encodeURIComponent(`\n\n> ${m.message.split('\n').join('\n> ')}`);
      return h('div', { class: 'card', style: m.status === 'done' ? { opacity: 0.65 } : null },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { style: { fontWeight: 600 } }, m.user_name ? `${m.user_name} · ${m.email}` : m.email || t('No email given')),
            h('div', { class: 'small muted' }, [fmtWhen(m.created), m.user_id ? t('signed in') : t('not signed in'), m.status === 'done' ? t('handled') : null].filter(Boolean).join(' · ')))),
        h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, m.message),
        h('div', { class: 'row' },
          m.email ? h('a', { class: 'btn sm primary', href: `mailto:${m.email}?subject=${subject}&body=${quoted}` }, h('span', { class: 'txt' }, t('Reply by email'))) : null,
          m.status === 'open' ? btn(t('Mark as handled'), () => setStatus(m, 'done'), { size: 'sm', icon: 'check' }) : btn(t('Mark as not handled'), () => setStatus(m, 'open'), { size: 'sm' }),
          btn(t('Delete'), async () => {
            if (!confirm(t('Delete this message for good?'))) return;
            try { await Api.req('DELETE', `/api/admin/support/${encodeURIComponent(m.id)}`); } catch (e) { toast(e.message, 'bad', 7000); }
            openAdmin('inbox');
          }, { size: 'sm', kind: 'ghost' })));
    }));
}

/* the unread count on the navbar button, checked once at start-up */
async function refreshAdminBadge() {
  if (!isAdmin()) return;
  try {
    const { messages } = await Api.req('GET', '/api/admin/support');
    Admin.open = messages.filter((m) => m.status === 'open').length;
    renderChips();
  } catch { /* the badge is a nicety */ }
}
