// spirit/run/shell/js/joinForm.js
// THE EMAIL FORM, ONE SHELL ELEMENT (goal/G30.1, box v33; Andy: "you better make that form a shell-element"). One row:
// the relay dropdown, the email field and its button, then the line under it, asking relay.join of the relay picked:
// the relay mails a link to this node, and opening it takes the seat or, for a key already seated, verifies the new
// email. THE SAME FORM EVERYWHERE (goal/G40.10, box v19; Andy: "the form is: [relay-dropdown] [email-adress-input]
// [change-or-join] the SAME FUCKING FORM EVERYWHERE"): Join, Info and the relay details draw it by mount, each with its
// relays; the relay details fix the dropdown to their one relay. None keeps a form of its own.
//
//   words(state)      -> { title, label, button, email } for where the node stands on a relay (seated, emailVerified).
//   row(relays, opts) -> the form's markup: relays are relay rows (url, label, claimed or owned, email, emailVerified);
//                        opts.fixed, a url, gives the dropdown that one relay and fixes it; opts.picked the url picked.
//   mount(box, opts)  -> draws the row into box and sends it: opts.relays, opts.pick ('seated': only relays with a seat;
//                        else every relay listed), opts.fixed, opts.escape. It hears relay-rows itself and redraws when
//                        its relays changed (goal/G40.10, box v21), keeping what is typed.
//   send(opts)        -> Promise of { ok, text }: the sentence the line shows.

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
  function wordsFor(r) { return words({ seated: !!(r && (r.claimed || r.owned)), email: r && r.email, emailVerified: !!(r && r.emailVerified) }); }

  // The relays the dropdown offers: the one fixed, else all given.
  function offered(relays, o) {
    var list = Array.isArray(relays) ? relays : [];
    return o && o.fixed ? list.filter(function (r) { return r.url === o.fixed; }) : list;
  }

  function row(relays, opts) {
    var o = opts || {};
    var escape = o.escape || esc;
    var list = offered(relays, o);
    if (!list.length) return '';
    var picked = list.filter(function (r) { return r.url === o.picked; })[0] || list[0];
    var w = wordsFor(picked);
    if (o.email != null) w.email = o.email;
    return '<div class="label sp-join-title">' + escape(w.title) + '</div>' +
      '<div class="start-job-form card">' +
      '<label class="field-label">Relay<select class="sp-join-relay"' + (o.fixed ? ' disabled' : '') + '>' +
        list.map(function (r) { return '<option value="' + escape(r.url) + '"' + (r === picked ? ' selected' : '') + '>' + escape(r.label || r.url) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field-label grow"><span class="sp-join-label">' + escape(w.label) + '</span>' +
        '<input type="email" class="sp-join-email" placeholder="you@example.org" autocomplete="email" value="' + escape(w.email) + '"></label>' +
      '<button type="button" class="sp-join-go">' + escape(w.button) + '</button>' +
      '</div>' +
      '<div class="job-manifest-note sp-join-out"></div>';
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
    return spirit.ready.then(function (s) { return s.relay.join({ url: url, email: email, code: '' }); }).then(function (said) {
      said = said || {};
      // Andy (goal/G30.1): "an email in your inbox contains a confirmation link for the entered email".
      if (said.ok) return { ok: true, text: 'An email in your inbox at ' + email + ' holds a confirmation link. Open it on this computer within 10 minutes.' };
      return { ok: false, text: String(said.error || 'the relay did not answer') };
    }, function (e) { return { ok: false, text: String((e && e.message) || e) }; });
  }

  function rules() { return (window.spirit && window.spirit.fieldRules) || null; }
  // The relays a place offers, out of relay-rows' rows: 'seated' only those with a seat, else every one listed.
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
    box.innerHTML = row(now.relays, { fixed: now.fixed, picked: now.picked || (was ? was.value : ''), email: typed, escape: now.escape });
  }
  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    box._spJoin = { relays: Array.isArray(o.relays) ? o.relays : [], pick: o.pick, fixed: o.fixed, escape: o.escape, picked: '' };
    draw(box);
    if (box._spJoinBound) return;
    box._spJoinBound = true;
    function relayUrl() { var p = box.querySelector('.sp-join-relay'); return p ? p.value : ''; }
    // THE RELAYS ON THE STREAM (goal/G40.10, box v21): relay-rows, heard here; the form redraws only when its own
    // relays changed, and lets go once its box has left the page.
    var heard = JSON.stringify(box._spJoin.relays);
    var stop = null;
    function take(job) {
      if (!job || job.type !== 'relay-rows' || !job.data) return;
      if (!box.isConnected) { if (stop) stop(); return; }
      var next = picking(job.data.rows, box._spJoin.pick);
      var asJson = JSON.stringify(next);
      if (asJson === heard) return;
      heard = asJson;
      box._spJoin.relays = next;
      draw(box);
    }
    if (window.spirit && window.spirit.events && typeof window.spirit.events.subscribe === 'function') {
      stop = window.spirit.events.subscribe({ onSnapshot: function (jobs) { (jobs || []).forEach(take); }, onUpdate: take });
    }
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

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.joinForm = { words: words, row: row, mount: mount, send: send };
}());
