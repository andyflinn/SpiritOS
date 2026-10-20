// spirit/run/shell/js/faceForm.js
// THE FACE FORM, ONE SHELL ELEMENT (goal/G30.1, box v39): moved whole out of Info, which draws it as before; the Join
// app draws it as its step Configure your node's remote control. Info keeps no copy.
//
// One relay chosen from the seats this node holds, a face name, and the relay's answer. relay.face is {url, name}
// (box v30): the relay pairs the name with the verified email it holds for this node, so a relay with no verified
// email gets no form, only the way to natterDetails, where the email is verified (box v31).
//
//   mount(box, opts)
//     opts.seats              relay rows this node holds a seat on (url, label, face, email, emailVerified)
//     opts.ask(verb, args)    the node's door, answering { status, text, body }
//     opts.callDialog(id, p)  opens natterDetails for the chosen relay
//     opts.reload()           read the rows again (Promise); the form is drawn again by its caller
//     opts.idPrefix           the ids' prefix, 'info-face-' unless said
//     opts.escape             the shell's escapeHtml

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function bodyOf(r) {
    if (r && r.body) return r.body;
    try { return JSON.parse(r && r.text); } catch (e) { return null; }
  }

  function mount(box, opts) {
    if (!box) return;
    var o = opts || {};
    var p = o.idPrefix || 'info-face-';
    var escape = o.escape || esc;
    var seats = Array.isArray(o.seats) ? o.seats : [];
    if (!seats.length) { box.innerHTML = ''; return; }
    function el(id) { return document.getElementById(p + id); }
    function say(text, bad) {
      var out = el('error');
      if (!out) return;
      out.className = bad ? 'job-start-error' : 'job-manifest-note';
      out.textContent = text || '';
    }
    // What the user has typed or chosen survives a redraw.
    var keep = { relay: '', name: '' };
    ['relay', 'name'].forEach(function (k) { var x = el(k); if (x) keep[k] = x.value; });
    box.innerHTML =
      '<div class="label">A face name on one relay</div>' +
      '<div class="job-manifest-note">Ask one relay for a name under its domain. It is paired with the verified email ' +
        'that relay holds for you (add or change it in Natter). The relay answers yes or no; asking again changes the name.</div>' +
      '<div class="start-job-form card">' +
        '<label class="field-label">Relay<select id="' + p + 'relay">' +
          seats.map(function (row) { return '<option value="' + escape(row.url) + '">' + escape(row.label || row.url) + '</option>'; }).join('') +
        '</select></label>' +
        '<span id="' + p + 'ask" class="grow">' +
          '<label class="field-label grow">Face name<input type="text" id="' + p + 'name" placeholder="one word, letters and digits"></label>' +
          '<button type="button" id="' + p + 'save">Ask</button>' +
        '</span>' +
      '</div>' +
      // No face form without a verified email: the relay would refuse the ask (box v31).
      '<div id="' + p + 'verify" class="job-manifest-note">Verify your email in Contacts, relays, before asking for a face name on this relay. ' +
        '<button type="button" id="' + p + 'open">Open this relay</button></div>' +
      '<div id="' + p + 'now" class="job-manifest-note"></div>' +
      '<div id="' + p + 'error" class="job-start-error"></div>';
    ['relay', 'name'].forEach(function (k) { var x = el(k); if (x && keep[k]) x.value = keep[k]; });

    // What this node holds on the selected relay: its face and the verified email it pairs with (relay.get's row).
    function show(fill) {
      var pick = el('relay');
      var row = seats.filter(function (r) { return pick && r.url === pick.value; })[0] || {};
      var face = row.face || {};
      var mail = row.emailVerified ? String(row.email || '') : '';
      var now = el('now');
      if (now) now.textContent = (face.name ? 'This node holds ' + face.name + ' for ' + face.email + ' on this relay.' : 'No face name on this relay yet.') +
        (mail ? ' Verified email: ' + mail + '.' : '');
      var ask = el('ask');
      var verify = el('verify');
      if (ask) ask.hidden = !row.emailVerified;
      if (verify) verify.hidden = !!row.emailVerified;
      if (!fill) return;
      var n = el('name');
      if (n) n.value = face.name || '';
    }

    var busy = false;
    function save() {
      var relay = el('relay');
      var name = el('name');
      if (!relay || !name || busy) return Promise.resolve();
      if (!name.value.trim()) { box._faceSaid = { text: 'a face name is needed', bad: true }; say(box._faceSaid.text, true); return Promise.resolve(); }
      busy = true;
      say('asking the relay…', false);
      return Promise.resolve(o.ask('relay.face', { url: relay.value, name: name.value })).then(function (r) {
        var said = bodyOf(r) || {};
        box._faceSaid = said.ok
          ? { text: 'the relay confirmed ' + said.name + ' for ' + said.email, bad: false }
          : { text: said.error || (r && r.error) || 'the relay did not answer', bad: true };
        say(box._faceSaid.text, box._faceSaid.bad);
        // The node now holds the new pair: read the rows again so the line under the form says so.
        if (said.ok && typeof o.reload === 'function') return o.reload();
      }).then(function () { busy = false; }, function () { busy = false; });
    }

    show(!keep.name);
    el('relay').addEventListener('change', function () { box._faceSaid = null; say('', false); show(true); });
    el('save').addEventListener('click', save);
    // The same dialog Contacts opens for a relay row; the rows are read again when it closes, so a verified email shows.
    el('open').addEventListener('click', function () {
      var pick = el('relay');
      if (!pick || typeof o.callDialog !== 'function') return;
      var again = function () { return typeof o.reload === 'function' ? o.reload() : null; };
      Promise.resolve(o.callDialog('shell/natterDetails', { url: pick.value })).then(again, again);
    });
    el('name').addEventListener('keydown', function (e) { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); save(); } });
    if (box._faceSaid) say(box._faceSaid.text, box._faceSaid.bad);
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.faceForm = { mount: mount };
}());
