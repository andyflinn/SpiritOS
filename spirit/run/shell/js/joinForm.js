// spirit/run/shell/js/joinForm.js
// THE JOIN FORM, ONE SHELL ELEMENT (goal/G30.1, box v33; Andy: "you better make that form a shell-element"). The email
// field, its button and the line under it, asking relay.join for one relay: the relay mails a link to this node, and
// opening it takes the seat or, for a key already seated, verifies the new email. natterDetails' claim panel, its
// email panel and the Join app all draw it; none keeps a form of its own.
//
//   html(opts)        -> the form: opts.email prefills the field (the verified address held), opts.label captions it,
//                        opts.button names the button.
//   bind(root, opts)  -> the button and Enter inside root send it; opts.url() or opts.url is the relay, opts.ask the
//                        node's door (api.verb or spirit.core.ask).
//   send(opts)        -> Promise of { ok, text }: the sentence the line shows.

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function html(opts) {
    var o = opts || {};
    return '<div class="start-job-form card">' +
      '<label class="field-label grow">' + esc(o.label || 'Your email') +
        '<input type="email" class="sp-join-email" placeholder="you@example.org" autocomplete="email" value="' + esc(o.email || '') + '"></label>' +
      '<button type="button" class="sp-join-go">' + esc(o.button || 'Join') + '</button>' +
      '</div>' +
      '<div class="job-manifest-note sp-join-out"></div>';
  }

  function send(opts) {
    var o = opts || {};
    var url = String((typeof o.url === 'function' ? o.url() : o.url) || '');
    var email = String(o.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return Promise.resolve({ ok: false, text: 'type your email address' });
    if (!url) return Promise.resolve({ ok: false, text: 'no relay to send it to' });
    return Promise.resolve(o.ask('relay.join', { url: url, email: email, code: '' })).then(function (r) {
      // api.verb answers {status, text}, spirit.core.ask {status, text, body}: the body, or the text parsed.
      var said = r && r.body;
      if (!said) { try { said = JSON.parse(r && r.text); } catch (e) { said = null; } }
      said = said || {};
      // Andy (goal/G30.1): "an email in your inbox contains a confirmation link for the entered email".
      if (said.ok) return { ok: true, text: 'An email in your inbox at ' + email + ' holds a confirmation link. Open it on this computer within 10 minutes.' };
      return { ok: false, text: String(said.error || ('the relay did not answer (' + ((r && r.status) || 'no status') + ')')) };
    }, function (e) { return { ok: false, text: String((e && e.message) || e) }; });
  }

  // Delegated on root, so a repaint of the form inside it keeps working.
  function bind(root, opts) {
    if (!root || root._spJoinBound) return;
    root._spJoinBound = true;
    function go(button) {
      var field = root.querySelector('.sp-join-email');
      var out = root.querySelector('.sp-join-out');
      button.disabled = true;
      send({ url: opts.url, ask: opts.ask, email: field ? field.value : '' }).then(function (r) {
        if (out) { out.className = 'job-manifest-note sp-join-out ' + (r.ok ? 'is-token' : 'is-error'); out.textContent = r.text; }
        button.disabled = false;
      });
    }
    root.addEventListener('click', function (e) {
      var button = e.target && e.target.closest && e.target.closest('.sp-join-go');
      if (button) go(button);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target || !e.target.classList || !e.target.classList.contains('sp-join-email')) return;
      var button = root.querySelector('.sp-join-go');
      if (button) { e.preventDefault(); go(button); }
    });
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.joinForm = { html: html, bind: bind, send: send };
}());
