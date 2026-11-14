'use strict';
// spirit/run/spirit/element/joinForm.js
// THE EMAIL FORM, ONE SHELL ELEMENT (goal/G30.1, box v33; Andy: "you better make that form a shell-element"). One row:
// the relay dropdown, the email field and its button, then the line under it, asking relay.join of the relay picked:
// the relay mails a link to this node, and opening it takes the seat or, for a key already seated, verifies the new
// email. THE SAME FORM EVERYWHERE (goal/G40.10, box v19; Andy: "the form is: [relay-dropdown] [email-adress-input]
// [change-or-join] the SAME FUCKING FORM EVERYWHERE"): Join, Info and the relay details draw it by mount, each with its
// relays; the relay details fix the dropdown to their one relay. None keeps a form of its own.
//
//   words(state)      -> { title, icon, button, email } for where the node stands on a relay (seated).
//   mount(box, opts)  -> draws the form into box and sends it: opts.relays, relay rows (url, label, claimed or owned);
//                        opts.pick ('seated': only relays with a seat; else every relay listed); opts.fixed, a url, gives
//                        the dropdown that one relay and fixes it. It follows each relay's row in the
//                        contact family's cache, reading nothing, and redraws if the relays it shows changed
//                        (goal/G40.11, G41.32), keeping what is typed.
//   send(opts)        -> Promise of { ok, text }: the sentence the line shows.
// A ROWFORM (goal/G41.27; Andy: "joinForm? it has several modes"): the title above the bubble, then ➕ or ✏️, the relay
// dropdown and the email in its span, Join or Change its button, the line of what was sent below it. The icon follows the
// mode as the words do; a change of relay that changes the mode draws the form again, with its new icon and words.

// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/contact/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the rowForm, asked as this file runs.
  if (window.spirit && typeof window.spirit.require === 'function') window.spirit.require('spirit/element/rowForm.js');
  // Its email field's limit, fieldInput's email rule (goal/G47.1, -browser: "every input it draws has a maxlength").
  if (window.spirit && typeof window.spirit.require === 'function') window.spirit.require('spirit/element/fieldInput.js');
  // IT ESCAPES WITH spirit.escapeHtml (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves"): no escape is handed to it.
  function esc(s) { return window.spirit.escapeHtml(s == null ? '' : s); }

  // ONE CONTROL FOR JOIN AND CHANGE (goal/G30.1, box v41; Andy: "Join, Add AND Change email address MUST be one and
  // the same control, a bit flexible..."). Its words follow where the node stands on that relay, so every caller asks
  // here and none keeps words of its own: no seat, Join; a seat, Change. THE FIELD IS NEVER PREFILLED (goal/G40.11, box
  // v24): the node keeps no email ("the email address holds no value to the personal node, it is injected only for
  // seating", Andy, 2026-10-26), so there is none to show.
  function words(state) {
    var s = state || {};
    if (!s.seated) return { title: 'Join a relay', icon: '➕', button: 'Join', email: '' };
    return { title: 'Change email address', icon: '✏️', button: 'Change', email: '' };
  }
  function wordsFor(r) { return words({ seated: !!(r && (r.claimed || r.owned)) }); }

  // The relays the dropdown offers: the one fixed, else all given.
  function offered(relays, o) {
    var list = Array.isArray(relays) ? relays : [];
    return o && o.fixed ? list.filter(function (r) { return r.url === o.fixed; }) : list;
  }

  // The form drawn into box: the title, the rowForm, the line under it. relays are relay rows; o.fixed, o.picked the url
  // picked, o.email what is typed.
  function form(box, relays, opts) {
    var o = opts || {};
    var escape = esc;
    var list = offered(relays, o);
    box.innerHTML = '';
    if (!list.length) return;
    var picked = list.filter(function (r) { return r.url === o.picked; })[0] || list[0];
    var w = wordsFor(picked);
    if (o.email != null) w.email = o.email;
    box.innerHTML = '<div class="label sp-join-title">' + escape(w.title) + '</div>' +
      '<div class="sp-join-form"></div>' +
      '<div class="job-manifest-note sp-join-out"></div>';
    var f = window.spirit.element.spirit.element.rowForm.create(box.querySelector('.sp-join-form'), { icon: w.icon, button: w.button });
    f.button.className = 'sp-join-go';
    f.span.innerHTML =
      '<select class="sp-join-relay"' + (o.fixed ? ' disabled' : '') + '>' +
        list.map(function (r) { return '<option value="' + escape(r.url) + '"' + (r === picked ? ' selected' : '') + '>' + escape(r.label || r.url) + '</option>'; }).join('') +
      '</select>' +
      '<input type="email" class="sp-join-email" placeholder="your email" autocomplete="email" value="' + escape(w.email) + '">';
    var FI = window.spirit.required && window.spirit.required.spirit && window.spirit.required.spirit.element && window.spirit.required.spirit.element.fieldInput;
    if (FI) FI.attach(f.span.querySelector('.sp-join-email'), 'email');
  }

  function send(opts) {
    var o = opts || {};
    var url = String((typeof o.url === 'function' ? o.url() : o.url) || '');
    var email = String(o.email || '').trim();
    // The one email rule (fieldRules.emailProblem, goal/G40.10, box v20): a malformed address is told what is wrong.
    var bad = rules() ? rules().emailProblem(email) : (email ? '' : 'an email address is needed');
    if (bad) return Promise.resolve({ ok: false, text: bad });
    if (!url) return Promise.resolve({ ok: false, text: 'no relay to send it to' });
    // Through the spirit object (goal/G32.2): spirit.relay.join answers the reply's body, or refuses with the node's words.
    // THE CALLER'S LINK (goal/G40.10, box v25): the link the shell wants the mail to open, which only the shell knows
    // (spirit.shell.joinLink); without a shell that says, the node puts its own face on the loopback.
    var shell = window.spirit && window.spirit.shell;
    var joinLink = shell && typeof shell.joinLink === 'function' ? String(shell.joinLink() || '') : '';
    var args = { url: url, email: email, code: '' };
    if (joinLink) args.link = joinLink;
    return spirit.ready.then(function (s) { return s.relay.join(args); }).then(function (said) {
      said = said || {};
      // Andy (goal/G30.1): "an email in your inbox contains a confirmation link for the entered email".
      if (said.ok) return { ok: true, text: 'An email in your inbox at ' + email + ' holds a confirmation link. Open it on this computer within 10 minutes.' };
      return { ok: false, text: String(said.error || 'the relay did not answer') };
    }, function (e) { return { ok: false, text: String((e && e.message) || e) }; });
  }

  function rules() { return (window.spirit && window.spirit.fieldRules) || null; }
  // The relays a place offers, out of relay.status' rows: 'seated' only those with a seat, else every one listed.
  function picking(rows, pick) {
    var list = Array.isArray(rows) ? rows : [];
    return pick === 'seated' ? list.filter(function (r) { return r && (r.claimed || r.owned); }) : list;
  }

  // Drawn into box; the picked relay and what is typed survive a redraw, and a change of relay redraws the words.
  // Delegated on box, so a redraw keeps the button and Enter working.
  function draw(box) {
    var now = box._spJoin || {};
    var was = box.querySelector('.sp-join-relay');
    var field = box.querySelector('.sp-join-email');
    var typed = field && field.value !== field.defaultValue ? field.value : null;
    form(box, now.relays, { fixed: now.fixed, picked: now.picked || (was ? was.value : ''), email: typed });
  }
  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    box._spJoin = { relays: Array.isArray(o.relays) ? o.relays : [], pick: o.pick, fixed: o.fixed, picked: '' };
    draw(box);
    if (box._spJoinBound) return;
    box._spJoinBound = true;
    function relayUrl() { var p = box.querySelector('.sp-join-relay'); return p ? p.value : ''; }
    // THE ONE TABLE (goal/G40.11) IS THE CONTACT FAMILY'S CACHE (goal/G41.28): a relay's row carries what this form reads
    // (goal/G41.32), so a seat taken or left anywhere is followed with no read, and the form redraws only when what it shows of
    // its own relays changed. It lets go once its box has left the page.
    var all = (box._spJoin.relays || []).slice();
    function shown(list) { return JSON.stringify(list.map(function (r) { return [r.url, r.label, r.claimed, r.owned, r.services]; })); }
    var heard = shown(box._spJoin.relays);
    var stop = null;
    function take(key, row) {
      if (!key || !row || row.relay !== true) return;
      if (!box.isConnected) { if (stop) stop(); return; }
      var same = function (r) { return r && (r.key === key || (row.url && r.url === row.url)); };
      if (all.some(same)) all = all.map(function (r) { return same(r) ? Object.assign({}, r, row, { face: r.face }) : r; });
      else if (row.url) all = all.concat([Object.assign({}, row, { face: undefined })]);
      var next = picking(all, box._spJoin.pick);
      var asJson = shown(next);
      if (asJson === heard) return;
      heard = asJson;
      box._spJoin.relays = next;
      draw(box);
    }
    var left = false;
    Promise.resolve(window.spirit.cacheManager('contact')).then(function () {
      if (!left && ((window.spirit.data || {}).contact || {}).data) stop = window.spirit.data.contact.data.watch(take);
    });
    box._spJoinStop = function () { left = true; if (typeof stop === 'function') stop(); stop = null; };
    // THE FIELD STOPS AT ITS LIMIT (goal/G40.10, box v20): past fieldRules' 254 bytes nothing more is taken.
    box.addEventListener('input', function (e) {
      var f = e.target;
      if (!f || !f.classList || !f.classList.contains('sp-join-email') || !rules()) return;
      var held = rules().clip(f.value, rules().EMAIL_MAX_BYTES);
      if (held !== f.value) f.value = held;
    });
    function go(button) {
      var field = box.querySelector('.sp-join-email');
      var out = box.querySelector('.sp-join-out');
      button.disabled = true;
      send({ url: relayUrl(), email: field ? field.value : '' }).then(function (r) {
        if (out) { out.className = 'job-manifest-note sp-join-out ' + (r.ok ? 'is-token' : 'is-error'); out.textContent = r.text; }
        button.disabled = false;
      });
    }
    box.addEventListener('change', function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains('sp-join-relay')) return;
      box._spJoin.picked = e.target.value;
      var field = box.querySelector('.sp-join-email');
      if (field) field.value = field.defaultValue;
      draw(box);
    });
    box.addEventListener('click', function (e) {
      var button = e.target && e.target.closest && e.target.closest('.sp-join-go');
      if (button) go(button);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target || !e.target.classList || !e.target.classList.contains('sp-join-email')) return;
      var button = box.querySelector('.sp-join-go');
      if (button) { e.preventDefault(); go(button); }
    });
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19; goal/G41.27, the general UI test): create(container, options) mounts the form
  // and answers its destroy, which lets the stream go and leaves the container empty.
  function create(container, options) {
    mount(container, options);
    return { destroy: function () { if (container && typeof container._spJoinStop === 'function') container._spJoinStop(); if (container) container.innerHTML = ''; } };
  }
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/joinForm.js', { words: words, create: create, mount: mount, send: send }); });
}());
