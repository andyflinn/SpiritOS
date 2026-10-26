// spirit/run/shell/js/faceForm.js
// THE FACE FORM, ONE SHELL ELEMENT (goal/G30.1, box v39). One row: the relay dropdown, the face name and Ask, then what
// this node holds on the relay picked and the relay's answer. relay.face is {url, name} (box v30): the relay pairs the
// name with the verified email it holds for this node. THE SAME FORM EVERYWHERE (goal/G40.10, box v19; Andy: "same with
// the face form"): Join, Info and the relay details draw it by mount; the relay details fix the dropdown to their relay.
// ITS OWN RELAYS (Andy: "doesn't show up if the user has zero verified emails anywhere; only shows relay in the dropdown,
// where the user has a confirmed email address. THAT's WHY THE FORMS HAVE SEPARATE RELAY DROPDOWNS."): since goal/G40.11
// the node keeps no email, and a seat taken by email is a verified one, so the dropdown offers the relays this node is
// seated on, and with none the form draws nothing.
//
//   row(relays, opts)  -> the form's markup, or '' with no relay to offer: relays are relay rows (url, label, face,
//                         claimed or owned); opts.fixed, a url, fixes the dropdown to that relay; opts.picked.
//   mount(box, opts)   -> draws the row and asks: opts.relays, opts.fixed, opts.reload() (Promise, after a face is
//                         confirmed), opts.escape. It hears the shadow stream itself and, when a relay's row changed,
//                         reads the relays again and redraws if the ones it offers changed (goal/G40.11).

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function offered(relays, o) {
    var list = (Array.isArray(relays) ? relays : []).filter(function (r) { return r && (r.claimed || r.owned); });
    return o && o.fixed ? list.filter(function (r) { return r.url === o.fixed; }) : list;
  }

  // What this node holds on a relay: its face name (relay.get's row; the node keeps no email, goal/G40.11).
  function holds(r) {
    var face = (r && r.face) || {};
    return face.name ? 'This node holds ' + face.name + ' on this relay.' : 'No face name on this relay yet.';
  }

  function row(relays, opts) {
    var o = opts || {};
    var escape = o.escape || esc;
    var list = offered(relays, o);
    if (!list.length) return '';
    var picked = list.filter(function (r) { return r.url === o.picked; })[0] || list[0];
    return '<div class="label">A face name on one relay</div>' +
      '<div class="start-job-form card">' +
      '<label class="field-label">Relay<select class="sp-face-relay"' + (o.fixed ? ' disabled' : '') + '>' +
        list.map(function (r) { return '<option value="' + escape(r.url) + '"' + (r === picked ? ' selected' : '') + '>' + escape(r.label || r.url) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field-label grow">Face name<input type="text" class="sp-face-name" placeholder="one word, letters and digits" value="' +
        escape(o.name != null ? o.name : ((picked.face && picked.face.name) || '')) + '"></label>' +
      '<button type="button" class="sp-face-go">Ask</button>' +
      '</div>' +
      '<div class="job-manifest-note sp-face-now">' + escape(holds(picked)) + '</div>' +
      '<div class="job-start-error sp-face-out"></div>';
  }

  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    var was = box.querySelector && box.querySelector('.sp-face-relay');
    var typed = box.querySelector && box.querySelector('.sp-face-name');
    box._spFace = { relays: Array.isArray(o.relays) ? o.relays : [], fixed: o.fixed, escape: o.escape, reload: o.reload };
    function draw(picked, name) {
      var now = box._spFace;
      box.innerHTML = row(now.relays, { fixed: now.fixed, picked: picked, name: name, escape: now.escape });
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
    // THE ONE TABLE ON THE STREAM (goal/G40.11): the shadow job hands each row as it changed; a relay's row changing (a
    // seat taken or left anywhere) reads the relays again, and the form redraws only when the relays it offers changed,
    // keeping what is picked and typed. It lets go once its box has left the page.
    var heard = JSON.stringify(offered(box._spFace.relays, { fixed: box._spFace.fixed }));
    var stop = null;
    function take(job) {
      if (!job || job.type !== 'shadow' || !job.data || !job.data.row || job.data.row.relay !== true) return;
      if (!box.isConnected) { if (stop) stop(); return; }
      if (!window.spirit || !window.spirit.relay || typeof window.spirit.relay.status !== 'function') return;
      window.spirit.relay.status('').then(function (r) {
        var rows = (r && r.body && Array.isArray(r.body.rows)) ? r.body.rows : [];
        var asJson = JSON.stringify(offered(rows, { fixed: box._spFace.fixed }));
        if (asJson === heard) return;
        heard = asJson;
        box._spFace.relays = rows;
        var pick = box.querySelector('.sp-face-relay');
        var name = box.querySelector('.sp-face-name');
        draw(pick ? pick.value : '', name && name.value !== name.defaultValue ? name.value : null);
      }, function () { /* the next change reads them again */ });
    }
    if (window.spirit && window.spirit.events && typeof window.spirit.events.subscribe === 'function') {
      stop = window.spirit.events.subscribe({ onUpdate: take });
    }

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

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.faceForm = { row: row, mount: mount };
}());
