// Public site script: swaps the sign-in buttons for "Open the app" when already signed in,
// and sends the contact form. Everything works without it (links and a plain form post).
(function () {
  'use strict';

  // Signed in? /api/me answers 200 for a valid session and 401 otherwise.
  fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) return;
      document.querySelectorAll('[data-signin]').forEach(function (a) {
        a.setAttribute('href', '/app/');
        var label = a.querySelector('[data-label]');
        if (label) label.textContent = a.getAttribute('data-signed-in') || 'Open the app';
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
    if (data.website) { say('Thanks! Your message has been sent.', 'ok'); form.reset(); return; } // bots fill the hidden field
    if (!data.email || !data.message) { say('Please add your email and a message.', 'bad'); return; }
    button.disabled = true;
    say('Sending…');
    fetch('/api/support', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      // the inbox stores {email, message}; topic and name ride along in the message so nothing is lost
      body: JSON.stringify({ email: data.email, message: '[' + (data.topic || 'question') + ']' + (data.name ? ' from ' + data.name : '') + '\n\n' + data.message, name: data.name || '', topic: data.topic || 'question' }),
    })
      .then(function (r) {
        if (r.ok) { say('Thanks! Your message has been sent. You’ll get a reply by email.', 'ok'); form.reset(); return; }
        return r.json().catch(function () { return {}; }).then(function (j) {
          say(r.status === 429 ? 'Too many messages from here. Please try again later.' : (r.status === 400 && j && j.error) || 'Your message couldn’t be sent right now. Please try again later.', 'bad');
        });
      })
      .catch(function () { say('You seem to be offline. Your message hasn’t been sent.', 'bad'); })
      .then(function () { button.disabled = false; });
  });
})();
