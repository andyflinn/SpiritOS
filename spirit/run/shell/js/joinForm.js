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
//   mount(box, opts)  -> the general form: its own relay picker over the form, for a page that is no relay's own.

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ONE CONTROL FOR JOIN, ADD AND CHANGE (goal/G30.1, box v41; Andy: "Join, Add AND Change email address MUST be one and
  // the same control, a bit flexible..."). Its words follow where the node stands on that relay, so every caller asks
  // here and none keeps words of its own: no seat, Join; a seat without a verified email, Add; verified, Change, with
  // the address held in the field.
  function words(state) {
    var s = state || {};
    if (!s.seated) return { title: 'Join a relay', label: 'Your email', button: 'Join', email: '' };
    if (!s.emailVerified) return { title: 'Add email address', label: 'Email address', button: 'Add', email: '' };
    return { title: 'Change email address', label: 'Email address', button: 'Change', email: String(s.email || '') };
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
    // Through the spirit object (goal/G32.2): spirit.relay.join answers the reply's body, or refuses with the node's words.
    return spirit.ready.then(function (s) { return s.relay.join({ url: url, email: email, code: '' }); }).then(function (said) {
      said = said || {};
      // Andy (goal/G30.1): "an email in your inbox contains a confirmation link for the entered email".
      if (said.ok) return { ok: true, text: 'An email in your inbox at ' + email + ' holds a confirmation link. Open it on this computer within 10 minutes.' };
      return { ok: false, text: String(said.error || 'the relay did not answer') };
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

  // THE GENERAL FORM, WITH ITS OWN RELAY PICKER (goal/G40.10, box v15; Andy: "in info, it needs a replay picker with it,
  // (the general form of that element)", and "one each. those forms are atomic"). Every relay thing names its relay, so
  // where no relay's own page stands around the form, the form picks one; its words follow the relay picked. Info draws
  // it above the face form.
  //   mount(box, opts)   opts.seats: the relay rows this node holds a seat on (url, label, email, emailVerified);
  //                      opts.escape: the shell's escapeHtml. Drawn again by its caller with fresh rows.
  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    var escape = o.escape || esc;
    var seats = Array.isArray(o.seats) ? o.seats : [];
    if (!seats.length) { box.innerHTML = ''; return; }
    var was = box.querySelector('.sp-join-relay');
    var picked = was ? was.value : '';
    function row() { var p = box.querySelector('.sp-join-relay'); return seats.filter(function (r) { return p && r.url === p.value; })[0] || seats[0]; }
    function draw() {
      var r = row();
      var w = words({ seated: true, email: r.email, emailVerified: !!r.emailVerified });
      var form = box.querySelector('.sp-join-body');
      if (form) form.innerHTML = '<div class="label">' + escape(w.title) + '</div>' + html(w);
    }
    box.innerHTML =
      '<div class="start-job-form card"><label class="field-label">Relay<select class="sp-join-relay">' +
        seats.map(function (r) { return '<option value="' + escape(r.url) + '">' + escape(r.label || r.url) + '</option>'; }).join('') +
      '</select></label></div>' +
      '<div class="sp-join-body"></div>';
    var pick = box.querySelector('.sp-join-relay');
    if (picked && seats.some(function (r) { return r.url === picked; })) pick.value = picked;
    pick.addEventListener('change', draw);
    draw();
    bind(box, { url: function () { return row().url; } });
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.joinForm = { words: words, html: html, bind: bind, send: send, mount: mount };
}());
