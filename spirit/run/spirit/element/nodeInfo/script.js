'use strict';
// spirit/run/spirit/element/nodeInfo/script.js
// WHAT THIS NODE SAYS ABOUT ITSELF, AN ELEMENT (goal/G43.24, requirement 6; Q2, Andy: "nodeInfo is fine."). The Info app is
// its wrapper (spirit/app/info/element.js). Its contract and its test: ./test/script.md and ./test/nodeInfo.js.
//
//   Andy: "i want an intrinsic app info, in which, for now the user can maintain both fields in this file, more to come."
//
//   spirit.required.spirit.element.nodeInfo.create(container, { open }) -> { destroy() }
//     open(key, spec)  the stack its mounter opens layers in (the shell's, appSelector.js): the rotate key dialog opens over
//                      all of Info there. Without one, nodeInfo keeps a stack over itself (panel.js), as file does.
//
// Top down:
//   - the two things this node answers to anybody who asks (spirit/nodeCard.js), its name and its description: the elements
//     changeMyLabel and changeMyDescription (goal/G41.6), each holding its field rule, its check as typed and its save. The
//     card is read with node.card and kept in the node family's cache (goal/G41.28), from which each field draws itself.
//   - the email form above the face form (joinForm, faceForm; goal/G30.1, G40.10), from relaysOf(): the email form always,
//     over every relay this node lists, the face form only for a seated, starred relay (goal/G43.27).
//     Andy, 2026-10-19: "for this a little section in the info-app will be enough." and "this UI section in info will have
//     to address ONE relay specifically." The relays are a probe of every configured mailbox and land when they land; the
//     fields do not wait for them.
//   - the Rotate button, a rowForm (goal/G41.27; Andy: "[🆘] [Rotate this node's cipher key]"), which opens the rotate key
//     dialog (spirit/element/rotateKey/script.js) as a layer over Info through panel.js (Andy: "it's just a panel that opens
//     exactly overtop of the calling panel, new-shell-style.", "like fstat"); its ✕ shows Info again.
// No key is shown (goal/G40.10, box v15; Andy: "remove ANY indication of keys from all user interfaces"). Nothing ticks:
// nothing here changes without this element asking, and a repaint while somebody types takes the cursor out of the box.
// WHAT IT NEEDS, IT GETS ITSELF (Andy: "every fucking element gets the interfaces it needs"): the spirit object's families,
// no api handed.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
// Each by its api.js path, never by a name (goal/G49.6): the relay and node branches.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/contact/api.js', 'spirit/node/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // THE RELAYS AS A SCREEN WANTS THEM, built from the contact branch (goal/G49.11, box v9: "what a page needs of them it builds
  // from contact.search and contact.get"): the relays this node keeps, each got, { status, text, body: { name, rows, ownedUrls,
  // claimedUrls, mustPick, relayStatus, more } }, relayStatus by each relay's url; a refused search answers its own body.
  function relaysOf(c, name) {
    function said(e) { return { status: (e && e.status) || 0, text: '', body: (e && e.body) || { ok: false, error: String((e && e.message) || e) } }; }
    return Promise.resolve(c.search({ q: '*', relay: true, keep: true })).then(function (s) {
      if (!s || !s.ok) return { status: 200, text: JSON.stringify(s || {}), body: s };
      return Promise.all((s.items || []).map(function (i) { return Promise.resolve(c.get({ key: i.key })).then(null, function () { return null; }); })).then(function (gets) {
        var rows = [];
        var relayStatus = {};
        gets.forEach(function (g) { if (!g || !g.ok || !g.relay) return; rows.push(g.relay); if (g.report) relayStatus[g.relay.url] = g.report; });
        var ownedUrls = rows.filter(function (r) { return r.owned; }).map(function (r) { return r.url; });
        var body = { name: name || '', rows: rows, ownedUrls: ownedUrls,
          claimedUrls: rows.filter(function (r) { return r.owned || r.claimed; }).map(function (r) { return r.url; }),
          // One fact about this node, never a row: it owns more than one relay and picks which one it is known by.
          mustPick: ownedUrls.length > 1, relayStatus: relayStatus, more: !!s.more };
        return { status: 200, text: JSON.stringify(body), body: body };
      });
    }, said);
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/panel/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/changeMyLabel/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/changeMyDescription/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all(['spirit/element/changeMyLabel/script.js', 'spirit/element/changeMyDescription/script.js', 'spirit/element/joinForm/script.js',
    'spirit/element/faceForm/script.js', 'spirit/element/rowForm/script.js', 'spirit/element/panel/script.js'].map(function (p) { return keepAnswer(p); }));

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var relays = [];
    var stack = null;
    var made = [];
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    // Its box keeps what it holds inside (spirit-sibling-browser.js: the box it puts into its container declares a constraint, overflow not visible).
    box.style.overflow = 'hidden';
    var page = document.createElement('div');
    page.className = 'stack';
    page.innerHTML =
      '<div class="stat-tile wide stack">' +
        '<div class="label">What this node says about itself</div>' +
        // The one thing worth saying before two boxes: these are answered to anybody who asks, which is not obvious from a
        // form and is the whole reason to think before typing in one.
        '<div class="job-manifest-note">Anybody who asks this node is told these two ' +
          'things, whether or not you have ever met. Nothing else about this box is ' +
          'answered to a stranger.</div>' +
        '<div data-info="name"></div>' +
        '<div data-info="description"></div>' +
        '<div data-info="said" class="job-start-error"></div>' +
      '</div>' +
      '<div class="stat-tile wide" data-info="email"></div>' +
      '<div class="stat-tile wide" data-info="face"></div>' +
      '<div data-info="rotate"></div>';
    box.appendChild(page);
    container.appendChild(box);
    function slot(name) { return page.querySelector('[data-info="' + name + '"]'); }
    function say(text) { var s = slot('said'); if (s) s.textContent = text || ''; }

    // THE EMAIL FORM ALWAYS, THE FACE FORM ONLY FOR A STARRED RELAY (goal/G43.27; Andy: "setting a star on a relay is what
    // makes the face-form appear in \"info\", the email form must always show in \"info\""): the email form is handed every
    // relay this node lists, Join where it holds no seat and Change where it does; the face form is handed them too and
    // offers only a seated, starred one itself (faceForm.offered), hiding its box with none.
    // Each form is made once by its create, kept with what destroy lets go (rule/8: its contact watch goes with Info), and
    // only handed the relays again after.
    var forms = {};
    function drawForm(key, name, slotName, opts) {
      var F = ANSWER['spirit/element/' + name + '/script.js'];
      if (!F) return;
      if (forms[key]) F.mount(slot(slotName), opts);
      else { forms[key] = F.create(slot(slotName), opts); made.push(forms[key]); }
    }
    function drawForms() {
      if (gone) return;
      drawForm('email', 'joinForm', 'email', { relays: relays });
      drawForm('face', 'faceForm', 'face', { relays: relays, reload: loadRelays });
    }
    // relaysOf() answers { status, text, body: { rows, ... } } itself (goal/G49.11), so it is read as it comes.
    function loadRelays() {
      return Promise.resolve(S.readyPromise).then(function () { return keepAnswer('spirit/contact/api.js'); }).then(function (s) { return relaysOf(s, ''); }).then(function (r) {
        var said = (r && r.body) || {};
        relays = Array.isArray(said.rows) ? said.rows : [];
      }, function () { relays = []; }).then(function () { return parts.then(drawForms, function () { /* a form missing is not drawn */ }); });
    }

    // THE ROTATE KEY DIALOG, A LAYER OVER INFO: through the mounter's stack, or nodeInfo's own.
    function openRotate() {
      var into = typeof o.open === 'function' ? o.open : function (k, spec) { return stack.open(k, spec); };
      return into('rotateKey', { icon: '🆘', label: 'Rotate this node\'s cipher key', fill: function (pane, closed) {
        return keepAnswer('spirit/element/rotateKey/script.js').then(function () {
          if (closed()) return null;
          return ANSWER['spirit/element/rotateKey/script.js'].create(pane, {});
        });
      } });
    }

    var fields = parts.then(function () {
      if (gone) return null;
      if (typeof o.open !== 'function') stack = ANSWER['spirit/element/panel/script.js'].create(box, page);
      made.push(ANSWER['spirit/element/changeMyLabel/script.js'].create(slot('name')));
      made.push(ANSWER['spirit/element/changeMyDescription/script.js'].create(slot('description')));
      var rotate = ANSWER['spirit/element/rowForm/script.js'].create(slot('rotate'), { icon: '🆘', button: 'Rotate this node\x27s cipher key' });
      rotate.button.addEventListener('click', function () { openRotate(); });
      // THE CARD IS THE NODE FAMILY'S CACHE (goal/G41.28): node.card's answer is kept in spirit.required.spirit.data.node.data, and each of
      // the two fields draws itself from it.
      return keepAnswer('spirit/node/api.js').then(function () {
        return S.callOutcome(Promise.resolve(S.readyPromise).then(function () { return keepAnswer('spirit/node/api.js'); }).then(function (s) { return s.card({}); }));
      }).then(function (r) {
        if (gone) return;
        var card = r && r.body;
        if (!card || !card.ok) { say((card && card.error) || 'node.card did not answer'); return; }
        S.required.spirit.data.node.data.card.keep(card);
      });
    }, function () { say('Info could not be loaded.'); });
    // TWO CALLS, NOT ONE AWAITING THE OTHER: the card is a file on this disk and lands at once; the relays take as long as
    // the slowest of them.
    loadRelays();

    return {
      ready: fields,
      destroy: function () {
        gone = true;
        made.forEach(function (m) { try { if (m && m.destroy) m.destroy(); } catch (e) { /* its own */ } });
        made = [];
        if (stack) stack.destroy();
        stack = null;
        container.innerHTML = '';
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
