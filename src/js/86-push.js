/* ---------- push notifications: practice reminders on this device ---------- */
/* The service worker (/sw.js, built from src/site/sw.js) shows the notifications. Each device that
   turns them on gets its own push subscription, which the server keeps with the user's reminder
   channels (server/reminders.js). On iPhone and iPad, Safari only offers push to a site that has
   been added to the Home Screen and opened from there. */
const Push = {
  reg: null,
  supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  installed() { return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); },
  permission() { return 'Notification' in window ? Notification.permission : 'unsupported'; },
  async register() {
    if (!('serviceWorker' in navigator)) return null;
    try { this.reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); } catch (e) { console.warn('service worker not registered', e); }
    return this.reg;
  },
  async registration() {
    if (!('serviceWorker' in navigator)) return null;
    return this.reg || (await navigator.serviceWorker.getRegistration('/').catch(() => null)) || this.register();
  },
  /** This device's subscription, or null. */
  async current() {
    if (!this.supported()) return null;
    const reg = await this.registration();
    return reg ? reg.pushManager.getSubscription().catch(() => null) : null;
  },
  /** Ask for permission (must run straight from a tap), subscribe, and hand the subscription to the server. */
  async enable(publicKey) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error(perm === 'denied'
        ? t('Notifications are blocked for this site. Allow them in your browser’s site settings (or the system notification settings), then try again.')
        : t('Notifications weren’t allowed.'));
    }
    if (!(await this.registration())) throw new Error(t('This browser couldn’t start the notification service.'));
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // a subscription made for a different server key can't receive our messages
    if (sub && sub.options && sub.options.applicationServerKey && b64url(sub.options.applicationServerKey) !== publicKey) { await sub.unsubscribe(); sub = null; }
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
      } catch (e) {
        // "Registration failed - push service error": the browser couldn't reach its own push service
        if (e && (e.name === 'AbortError' || /push service/i.test(e.message || ''))) {
          throw new Error(/Brave/.test(navigator.userAgent) || navigator.brave
            ? t('Brave has push turned off. Turn on “Use Google services for push messaging” in brave://settings/privacy, restart Brave, and try again.')
            : t('This browser couldn’t reach its notification service. A VPN, firewall or ad blocker may be blocking it, or this browser may not support push. Try again without them, or in Chrome, Edge, Firefox or Safari.'));
        }
        throw e;
      }
    }
    await Api.req('POST', '/api/reminders/push', { subscription: sub.toJSON(), label: deviceLabel() });
    return sub;
  },
  /** Stop notifications on this device (server first, so a failed unsubscribe still stops them). */
  async disable() {
    const sub = await this.current();
    if (!sub) return;
    await Api.req('DELETE', '/api/reminders/push', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  },
};

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

/* The "Notifications" card in Settings → Practice. `status.push` comes from GET /api/reminders. */
function pushCard(status, { onChange }) {
  const card = h('div', { class: 'card stack' }, h('h3', null, t('Notifications on this device')));
  card.add = (...nodes) => card.append(...nodes.filter(Boolean));
  const push = status && status.push;
  const others = push ? push.devices - (push.thisDevice ? 1 : 0) : 0;
  const more = others > 0 ? h('p', { class: 'small muted' }, tp(others, 'Also on {n} other device.', 'Also on {n} other devices.')) : null;
  if (!status) { card.add(h('p', { class: 'small muted' }, t('Checking…'))); return card; }
  if (!push || !push.available) { card.add(h('p', { class: 'muted' }, t('Notifications aren’t available yet. Discord reminders work in the meantime.'))); return card; }
  if (!Push.supported()) {
    card.add(Push.ios() && !Push.installed()
      ? h('p', { class: 'muted' }, t('On iPhone and iPad, notifications need the app on your Home Screen: tap the Share button, choose “Add to Home Screen”, open Euno from there, and come back here.'))
      : h('p', { class: 'muted' }, t('This browser can’t show notifications from websites. Try Chrome, Edge, Firefox or Safari.')), more);
    return card;
  }
  if (push.thisDevice && Push.permission() === 'granted') {
    card.add(
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, icon('check'), t('On for this device')),
        btn(t('Turn off here'), async () => {
          await Push.disable(); toast(t('Notifications are off on this device.')); onChange();
        }, { size: 'sm', kind: 'ghost' })),
      more);
    return card;
  }
  const blocked = Push.permission() === 'denied';
  card.add(
    h('p', { class: 'muted' }, t('Get reminders as a notification on this phone or computer. Turn them on on each device you want them on.')),
    blocked ? h('p', { class: 'small muted' }, t('Notifications are blocked for this site. Allow them in your browser’s site settings, then turn them on here.')) : null,
    h('div', { class: 'row' },
      btn(t('Turn on notifications'), async () => {
        try {
          await Push.enable(push.publicKey);
          if (!reminderSettings().enabled) saveReminders({ enabled: true });
          toast(t('Notifications are on for this device.'), 'good');
          onChange();
        } catch (e) { toast(e.message, 'bad', 8000); }
      }, { kind: 'primary', size: 'sm', icon: 'bell' })),
    more);
  return card;
}
