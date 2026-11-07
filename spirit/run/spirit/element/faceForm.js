// spirit/run/spirit/element/faceForm.js
// THE FACE FORM, ONE SHELL ELEMENT (goal/G30.1, box v39). One row: the relay dropdown, the face name and Ask, then what
// this node holds on the relay picked and the relay's answer. relay.face is {url, name} (box v30): the relay pairs the
// name with the verified email it holds for this node. THE SAME FORM EVERYWHERE (goal/G40.10, box v19; Andy: "same with
// the face form"): Join, Info and the relay details draw it by mount; the relay details fix the dropdown to their relay.
// ITS OWN RELAYS (Andy: "doesn't show up if the user has zero verified emails anywhere; only shows relay in the dropdown,
// where the user has a confirmed email address. THAT's WHY THE FORMS HAVE SEPARATE RELAY DROPDOWNS."): since goal/G40.11
// the node keeps no email, and a seat taken by email is a verified one, so the dropdown offers the relays this node is
// seated on. AND STARRED (goal/G43.18, box v29: "At home, faceForm offers a face only on a starred relay", which turns round
// goal/G41.32's not starred; Andy: "on the home node, NO face is offered (faceForm hides itself) for a relay without star."):
// the home node answers a face only from a starred relay. With none left its box is not shown, so a mounter's tile goes with
// it (Andy, G41.32: "if there are no relays that satisfy the requirement, don't display the form at all.", "faceForm provides
// that check as a function", "info-app: don't show the faceForm, if the faceForm says it shouldn't be displayed").
//
//   offers(relays)     -> whether any relay row can be offered: the check, for whoever asks
//   mount(box, opts)   -> draws the form and asks: opts.relays, relay rows (url, label, face, claimed or owned, mine), its box
//                         hidden with no relay to offer; opts.fixed, a url, fixes the dropdown to that relay;
//                         opts.none, words: with no relay to offer the form stays, says them where its messages go, and asks
//                         nothing (Join: Andy, "leave the form, and print that message at the bottom right of the form");
//                         opts.reload() (Promise, after a face is confirmed). It follows each relay's row in the
//                         contact family's cache, reading nothing, and redraws if the ones it offers changed (goal/G41.32).
// A ROWFORM (goal/G41.27; Andy: "faceForm:\n\n[❓] [Relay▾][Face-name-input][Ask-button]"): the title above the bubble,
// then ❓, the relay dropdown and the face name in its span, Ask its button; what this node holds and the relay's answer
// below it.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the rowForm, asked as this file runs.
  if (window.spirit && typeof window.spirit.require === 'function') window.spirit.require('spirit/element/rowForm.js');
  // IT ESCAPES WITH spirit.escapeHtml (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves"): no escape is handed to it.
  function esc(s) { return window.spirit.escapeHtml(s == null ? '' : s); }

  function offered(relays, o) {
    var list = (Array.isArray(relays) ? relays : []).filter(function (r) { return r && (r.claimed || r.owned) && r.mine === true; });
    return o && o.fixed ? list.filter(function (r) { return r.url === o.fixed; }) : list;
  }

  // What this node holds on a relay: its face name (relay.get's row; the node keeps no email, goal/G40.11).
  function holds(r) {
    var face = (r && r.face) || {};
    return face.name ? 'This node holds ' + face.name + ' on this relay.' : 'No face name on this relay yet.';
  }

  // The form drawn into box, or nothing with no relay to offer: the title, the rowForm, the lines under it.
  function form(box, relays, opts) {
    var o = opts || {};
    var escape = esc;
    var list = offered(relays, o);
    box.innerHTML = '';
    // Its box hidden, and the tile a mounter gave it with it, unless the mounter asked it to stay and say why.
    box.style.display = !list.length && !o.none ? 'none' : '';
    if (!list.length && !o.none) return;
    var picked = list.filter(function (r) { return r.url === o.picked; })[0] || list[0] || null;
    box.innerHTML = '<div class="label">A face name on one relay</div>' +
      '<div class="sp-face-form"></div>' +
      '<div class="job-manifest-note sp-face-now">' + escape(holds(picked)) + '</div>' +
      '<div class="job-start-error sp-face-out"></div>';
    var f = window.spirit.element.rowForm.create(box.querySelector('.sp-face-form'), { icon: '❓', button: 'Ask' });
    f.button.className = 'sp-face-go';
    f.button.disabled = !picked;
    f.span.innerHTML =
      '<select class="sp-face-relay"' + (o.fixed ? ' disabled' : '') + '>' +
        list.map(function (r) { return '<option value="' + escape(r.url) + '"' + (r === picked ? ' selected' : '') + '>' + escape(r.label || r.url) + '</option>'; }).join('') +
      '</select>' +
      '<input type="text" class="sp-face-name" placeholder="face name: one word, letters and digits" value="' +
        escape(o.name != null ? o.name : ((picked && picked.face && picked.face.name) || '')) + '">';
    if (!picked) box.querySelector('.sp-face-out').textContent = String(o.none);
  }

  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    var was = box.querySelector && box.querySelector('.sp-face-relay');
    var typed = box.querySelector && box.querySelector('.sp-face-name');
    box._spFace = { relays: Array.isArray(o.relays) ? o.relays : [], fixed: o.fixed, reload: o.reload, none: o.none };
    function draw(picked, name) {
      var now = box._spFace;
      form(box, now.relays, { fixed: now.fixed, picked: picked, name: name, none: now.none });
      if (box._faceSaid) say(box._faceSaid.text, box._faceSaid.bad);
    }
    function say(text, bad) {
      var out = box.querySelector('.sp-face-out');
      if (!out) return;
      out.className = (bad ? 'job-start-error' : 'job-manifest-note') + ' sp-face-out';
      out.textContent = text || '';
    }
    // What the user has picked or typed survives a redraw.
    draw(was ? was.value : '', typed && typed.value ? typed.value : null);
    if (box._spFaceBound) return;
    box._spFaceBound = true;
    // THE ONE TABLE (goal/G40.11) IS THE CONTACT FAMILY'S CACHE (goal/G41.28): a relay's row carries what this form reads
    // (goal/G41.32), so a seat or a star changing anywhere is followed with no read, and the form redraws only when the
    // relays it offers changed, keeping what is picked and typed. It lets go once its box has left the page.
    function shown() {
      return JSON.stringify(offered(box._spFace.relays, { fixed: box._spFace.fixed }).map(function (r) { return [r.url, r.label, (r.face && r.face.name) || '']; }));
    }
    var heard = shown();
    var stop = null;
    function take(key, row) {
      if (!key) return;
      if (!box.isConnected) { if (stop) stop(); return; }
      var now = box._spFace.relays;
      var mineNow = function (r) { return r && (r.key === key || (row && row.url && r.url === row.url)); };
      if (!row) {
        // A change with no value is not a row gone until the cache says so.
        if (window.spirit.data.contact.data.contact(key)) return;
        box._spFace.relays = now.filter(function (r) { return !mineNow(r); });
      } else {
        if (row.relay !== true) return;
        var plain = Object.assign({}, row);
        // A row's face is a name, a relay row's here a { name }.
        if (typeof plain.face === 'string') plain.face = { name: plain.face };
        if (!now.some(mineNow)) {
          if (!row.url) return;
          box._spFace.relays = now.concat([plain]);
        } else box._spFace.relays = now.map(function (r) { return mineNow(r) ? Object.assign({}, r, plain) : r; });
      }
      var asJson = shown();
      if (asJson === heard) return;
      heard = asJson;
      var pick = box.querySelector('.sp-face-relay');
      var name = box.querySelector('.sp-face-name');
      draw(pick ? pick.value : '', name && name.value !== name.defaultValue ? name.value : null);
    }
    var left = false;
    Promise.resolve(window.spirit.cacheManager('contact')).then(function () {
      if (!left && ((window.spirit.data || {}).contact || {}).data) stop = window.spirit.data.contact.data.watch(take);
    });
    box._spFaceStop = function () { left = true; if (typeof stop === 'function') stop(); stop = null; };

    var busy = false;
    function save() {
      var relay = box.querySelector('.sp-face-relay');
      var name = box.querySelector('.sp-face-name');
      if (!relay || !name || busy) return Promise.resolve();
      if (!name.value.trim()) { box._faceSaid = { text: 'a face name is needed', bad: true }; say(box._faceSaid.text, true); return Promise.resolve(); }
      busy = true;
      say('asking the relay…', false);
      // Through the spirit object (goal/G32.2): spirit.relay.face answers the reply's body, or refuses with the node's words.
      return spirit.ready.then(function (s) { return s.relay.face({ url: relay.value, name: name.value }); }).then(function (said) { return said || {}; }, function (e) { return { ok: false, error: (e && e.message) || 'the relay did not answer' }; }).then(function (said) {
        box._faceSaid = said.ok
          ? { text: 'the relay confirmed ' + said.name + ' for ' + said.email, bad: false }
          : { text: said.error || 'the relay did not answer', bad: true };
        say(box._faceSaid.text, box._faceSaid.bad);
        // The node now holds the new pair: read the rows again so the line under the form says so.
        var reload = box._spFace && box._spFace.reload;
        if (said.ok && typeof reload === 'function') return reload();
      }).then(function () { busy = false; }, function () { busy = false; });
    }
    box.addEventListener('change', function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains('sp-face-relay')) return;
      box._faceSaid = null;
      draw(e.target.value, null);
    });
    box.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.sp-face-go')) save();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('sp-face-name')) { e.preventDefault(); save(); }
    });
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19; goal/G41.27, the general UI test): create(container, options) mounts the form
  // and answers its destroy, which lets the stream go and leaves the container empty.
  function create(container, options) {
    mount(container, options);
    return { destroy: function () { if (container && typeof container._spFaceStop === 'function') container._spFaceStop(); if (container) container.innerHTML = ''; } };
  }
  window.spirit.element.faceForm = { create: create, mount: mount, offers: function (relays) { return offered(relays).length > 0; } };
}());
