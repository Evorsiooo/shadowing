/* ---------- admin page: users, sign-up and invite codes, support inbox ---------- */
/* Only shown to admins (Api.role); the server checks the role again on every /api/admin call. */
ICONS.shield = '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>';

const Admin = { tab: 'users', open: 0 };
const isAdmin = () => Store.mode === 'cloud' && Api.role === 'admin';

function fmtWhen(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 86400000);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`}`;
  if (ms > Date.now()) return date; // invite end dates
  return days < 1 ? `today ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : days < 2 ? 'yesterday' : date;
}

async function openAdmin(tab = Admin.tab) {
  Admin.tab = tab;
  const tabs = [['users', 'Users'], ['signup', 'Sign-up'], ['inbox', `Inbox${Admin.open ? ` (${Admin.open})` : ''}`]];
  const body = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Loading…'));
  openModal([
    modalHead('Admin', 'Accounts, sign-up and messages from the contact form.'),
    h('div', { class: 'tabs' }, tabs.map(([k, l]) => btn(l, () => openAdmin(k), { size: 'sm', on: k === tab }))),
    body,
  ]);
  try {
    const view = tab === 'users' ? await adminUsersView() : tab === 'signup' ? await adminSignupView() : await adminInboxView();
    if (Admin.tab === tab && body.isConnected) mount(body, view);
  } catch (e) {
    if (body.isConnected) mount(body, h('p', { class: 'muted' }, `Couldn’t load this: ${e.message}`), btn('Try again', () => openAdmin(tab), { size: 'sm' }));
  }
}

/* ---------- users ---------- */
async function adminUsersView() {
  const { users } = await Api.req('GET', '/api/admin/users');
  const active = users.filter((u) => u.last_seen && Date.now() - u.last_seen < 7 * 86400000).length;
  return h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, `${users.length} account${users.length === 1 ? '' : 's'}, ${active} active in the last 7 days. Practice data stays private: you see counts, not content.`),
    h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Account', 'Joined', 'Last seen', 'Sessions', ''].map((t) => h('th', null, t)))),
      h('tbody', null, users.map((u) => h('tr', null,
        h('td', null,
          h('div', { style: { fontWeight: 700 } }, u.name || u.email, u.role === 'admin' ? h('span', { class: 'muted small' }, ' · admin') : null, u.disabled ? h('span', { class: 'small', style: { color: 'var(--red)' } }, ' · disabled') : null),
          u.name ? h('div', { class: 'small muted' }, u.email) : null,
          u.invite_code ? h('div', { class: 'small muted' }, `Invite ${u.invite_code}`) : null),
        h('td', null, fmtWhen(u.created)),
        h('td', null, fmtWhen(u.last_seen)),
        h('td', null, String(u.sessions)),
        h('td', null, u.self || u.role === 'admin' ? null : h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
          btn(u.disabled ? 'Enable' : 'Disable', () => adminSetDisabled(u, !u.disabled), { size: 'sm', title: u.disabled ? 'Let this account sign in again' : 'Sign this account out and stop it signing in' }),
          btn('Delete', () => adminConfirmDelete(u), { size: 'sm', kind: 'danger' }))))))),
    ));
}

async function adminSetDisabled(u, disabled) {
  try {
    await Api.req('PATCH', `/api/admin/users/${encodeURIComponent(u.id)}`, { disabled });
    toast(disabled ? `${u.email} is disabled and signed out.` : `${u.email} can sign in again.`, 'good');
  } catch (e) { toast(e.message, 'bad', 7000); }
  openAdmin('users');
}

function adminConfirmDelete(u) {
  const input = h('input', { type: 'text', id: 'admin-del', placeholder: u.email, autocomplete: 'off', spellcheck: 'false', autofocus: true });
  openModal([
    modalHead('Delete this account?'),
    h('p', null, `This deletes ${u.email} and everything the server keeps for it (practice data, files, reminders), for good. They can sign up again later as a new account.`),
    h('label', { class: 'field', for: 'admin-del' }, 'Type their email address to confirm', input),
    h('div', { class: 'row' },
      btn('Delete account', async () => {
        try {
          await Api.req('DELETE', `/api/admin/users/${encodeURIComponent(u.id)}`, { confirm: input.value });
          toast(`${u.email} was deleted.`, 'good');
          openAdmin('users');
        } catch (e) { toast(e.message, 'bad', 7000); }
      }, { kind: 'danger' }),
      btn('Cancel', () => openAdmin('users'), { kind: 'ghost' })),
  ], { narrow: true, onClose: () => openAdmin('users') });
}

/* ---------- sign-up mode and invite codes ---------- */
async function adminSignupView() {
  const [{ mode }, { invites }] = await Promise.all([Api.req('GET', '/api/admin/signup'), Api.req('GET', '/api/admin/invites')]);
  const setMode = async (m) => {
    if (m === mode) return;
    try { await Api.req('PUT', '/api/admin/signup', { mode: m }); toast(m === 'open' ? 'Anyone can sign up now.' : 'Sign-up is invite-only now.', 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
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
  const statusText = { active: 'Active', used: 'Used up', ended: 'Ended' };
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('h3', null, 'Who can sign up'),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Sign-up mode' },
        btn('Anyone', () => setMode('open'), { on: mode === 'open', pressed: mode === 'open' }),
        btn('Invite code needed', () => setMode('invite'), { on: mode === 'invite', pressed: mode === 'invite' })),
      h('p', { class: 'small muted' }, mode === 'open'
        ? 'Anyone with a Google account can create an account.'
        : 'New people paste an invite code before signing in with Google. People who already have an account sign in as usual.')),
    h('div', { class: 'card' }, h('h3', null, 'New invite code'),
      h('div', { class: 'cards', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' } },
        h('label', { class: 'field', for: 'inv-uses' }, 'How many people can use it',
          h('input', { type: 'number', id: 'inv-uses', min: 1, max: 1000, step: 1, value: draft.maxUses, oninput: (e) => { draft.maxUses = e.target.value; } })),
        h('label', { class: 'field', for: 'inv-days' }, 'Ends after (days, empty = never)',
          h('input', { type: 'number', id: 'inv-days', min: 1, max: 365, step: 1, placeholder: 'Never', oninput: (e) => { draft.expiresDays = e.target.value; } })),
        h('label', { class: 'field', for: 'inv-note' }, 'Note (who it’s for)',
          h('input', { type: 'text', id: 'inv-note', maxlength: 200, placeholder: 'Optional', oninput: (e) => { draft.note = e.target.value; } }))),
      h('div', { class: 'row' }, btn('Create code', create, { kind: 'primary', icon: 'plus' }))),
    h('div', { class: 'card' }, h('h3', null, 'Invite codes'),
      invites.length ? h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Code', 'Used', 'Ends', 'Used by', ''].map((t) => h('th', null, t)))),
        h('tbody', null, invites.map((i) => h('tr', null,
          h('td', null, h('div', { style: { fontWeight: 800, fontFamily: 'ui-monospace, monospace' } }, i.code),
            h('div', { class: 'small muted' }, [statusText[i.status], i.note].filter(Boolean).join(' · '))),
          h('td', null, `${i.uses} of ${i.max_uses}`),
          h('td', null, i.expires ? fmtWhen(i.expires) : 'Never'),
          h('td', { class: 'small' }, i.usedBy.length ? i.usedBy.map((u) => h('div', null, u.email)) : h('span', { class: 'muted' }, 'Nobody yet')),
          h('td', null, i.status === 'active' ? h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
            btn('Copy link', () => copyInvite(i.code), { size: 'sm' }),
            btn('Revoke', async () => {
              try { await Api.req('DELETE', `/api/admin/invites/${encodeURIComponent(i.code)}`); toast('Code revoked.', 'good'); } catch (e) { toast(e.message, 'bad', 7000); }
              openAdmin('signup');
            }, { size: 'sm', kind: 'danger' })) : null)))))) : h('p', { class: 'small muted' }, 'No codes yet.')));
}

/* the sign-in link with the code filled in, so people don't have to type it */
async function copyInvite(code, created = false) {
  const link = `${location.origin}/auth/google?invite=${encodeURIComponent(code)}`;
  try {
    await navigator.clipboard.writeText(link);
    toast(created ? `Created ${code}. The sign-up link is copied.` : 'Sign-up link copied.', 'good', 6000);
  } catch {
    toast(created ? `Created ${code}. Sign-up link: ${link}` : link, 'good', 12000);
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
  if (!messages.length) return h('p', { class: 'muted' }, 'No messages yet. Anything sent through the contact form shows up here.');
  return h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, Admin.open ? `${Admin.open} message${Admin.open === 1 ? '' : 's'} to handle.` : 'All handled.'),
    messages.map((m) => {
      const subject = encodeURIComponent('Re: your message to Euno Shadowing');
      const quoted = encodeURIComponent(`\n\n> ${m.message.split('\n').join('\n> ')}`);
      return h('div', { class: 'card', style: m.status === 'done' ? { opacity: 0.65 } : null },
        h('div', { class: 'row' },
          h('div', { class: 'grow' },
            h('div', { style: { fontWeight: 700 } }, m.user_name ? `${m.user_name} · ${m.email}` : m.email || 'No email given'),
            h('div', { class: 'small muted' }, `${fmtWhen(m.created)}${m.user_id ? ' · signed in' : ' · not signed in'}${m.status === 'done' ? ' · handled' : ''}`))),
        h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, m.message),
        h('div', { class: 'row' },
          m.email ? h('a', { class: 'btn sm primary', href: `mailto:${m.email}?subject=${subject}&body=${quoted}` }, h('span', { class: 'txt' }, 'Reply by email')) : null,
          m.status === 'open' ? btn('Mark as handled', () => setStatus(m, 'done'), { size: 'sm', icon: 'check' }) : btn('Mark as not handled', () => setStatus(m, 'open'), { size: 'sm' }),
          btn('Delete', async () => {
            if (!confirm('Delete this message for good?')) return;
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
