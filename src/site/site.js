// Public site script: swaps the sign-in buttons for "Open the app" when already signed in,
// remembers the language for the app, and sends the contact form.
// Everything works without it (links and a plain form post).
(function () {
  'use strict';

  // The page language (en-AU, fr-FR, es-ES) picks the messages below.
  var LANG = String(document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  var MESSAGES = {
    en: {
      openApp: 'Open the app',
      sent: 'Thanks! Your message has been sent.',
      sentReply: 'Thanks! Your message has been sent. You’ll get a reply by email.',
      missing: 'Please add your email and a message.',
      sending: 'Sending…',
      tooMany: 'Too many messages from here. Please try again later.',
      failed: 'Your message couldn’t be sent right now. Please try again later.',
      offline: 'You seem to be offline. Your message hasn’t been sent.',
    },
    fr: {
      openApp: 'Ouvrir l’app',
      sent: 'Merci ! Ton message a bien été envoyé.',
      sentReply: 'Merci ! Ton message a bien été envoyé. Tu recevras une réponse par e-mail.',
      missing: 'Ajoute ton e-mail et un message.',
      sending: 'Envoi…',
      tooMany: 'Trop de messages envoyés d’ici. Réessaie plus tard.',
      failed: 'Impossible d’envoyer ton message pour le moment. Réessaie plus tard.',
      offline: 'Tu sembles hors ligne. Ton message n’a pas été envoyé.',
    },
    es: {
      openApp: 'Abrir la app',
      sent: '¡Gracias! Tu mensaje se ha enviado.',
      sentReply: '¡Gracias! Tu mensaje se ha enviado. Recibirás una respuesta por correo.',
      missing: 'Añade tu correo y un mensaje.',
      sending: 'Enviando…',
      tooMany: 'Demasiados mensajes desde aquí. Inténtalo de nuevo más tarde.',
      failed: 'No se ha podido enviar tu mensaje ahora mismo. Inténtalo de nuevo más tarde.',
      offline: 'Parece que no tienes conexión. Tu mensaje no se ha enviado.',
    },
  };
  var M = MESSAGES[LANG] || MESSAGES.en;

  // The app (/app/) reads this key to pick its interface language.
  function saveLang(code) {
    try { localStorage.setItem('shadowing:lang', JSON.stringify(code)); } catch (e) { /* storage blocked */ }
    // the server reads the cookie for its own pages (sign-in) and messages
    try { document.cookie = 'euno_lang=' + code + '; path=/; max-age=31536000; samesite=lax' + (location.protocol === 'https:' ? '; secure' : ''); } catch (e) { /* cookies blocked */ }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var code = a.getAttribute('data-lang-switch');
    if (code) { saveLang(code); return; }
    // Signing in or opening the app from a French or Spanish page opens the app in that language.
    if (LANG !== 'en' && MESSAGES[LANG] && (a.hasAttribute('data-signin') || /^\/app\//.test(a.getAttribute('href') || ''))) saveLang(LANG);
  });

  // The header language menu closes on Escape or a click elsewhere.
  var menu = document.querySelector('details.lang-menu');
  if (menu) {
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }

  // Signed in? /api/me answers 200 for a valid session and 401 otherwise.
  fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) return;
      document.querySelectorAll('[data-signin]').forEach(function (a) {
        a.setAttribute('href', '/app/');
        var label = a.querySelector('[data-label]');
        if (label) label.textContent = a.getAttribute('data-signed-in') || M.openApp;
        var g = a.querySelector('.g');
        if (g) g.remove();
      });
    })
    .catch(function () { /* offline or no backend: keep the sign-in buttons */ });

  var form = document.querySelector('form.contact');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var button = form.querySelector('button[type="submit"]');
  function say(text, kind) { status.textContent = text; status.className = 'form-status' + (kind ? ' ' + kind : ''); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
    if (data.website) { say(M.sent, 'ok'); form.reset(); return; } // bots fill the hidden field
    if (!data.email || !data.message) { say(M.missing, 'bad'); return; }
    button.disabled = true;
    say(M.sending);
    fetch('/api/support', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-euno-lang': LANG },
      // the inbox stores {email, message}; topic, name and page language ride along in the message so nothing is lost
      body: JSON.stringify({ email: data.email, message: '[' + (data.topic || 'question') + ']' + (LANG !== 'en' ? ' [' + LANG + ']' : '') + (data.name ? ' from ' + data.name : '') + '\n\n' + data.message, name: data.name || '', topic: data.topic || 'question' }),
    })
      .then(function (r) {
        if (r.ok) { say(M.sentReply, 'ok'); form.reset(); return; }
        return r.json().catch(function () { return {}; }).then(function (j) {
          say(r.status === 429 ? M.tooMany : (r.status === 400 && j && j.error) || M.failed, 'bad');
        });
      })
      .catch(function () { say(M.offline, 'bad'); })
      .then(function () { button.disabled = false; });
  });
})();
