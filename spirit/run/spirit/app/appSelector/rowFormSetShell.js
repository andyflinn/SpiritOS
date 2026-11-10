'use strict';
// spirit/run/spirit/app/appSelector/rowFormSetShell.js
// THE NODE'S SHELL, AT HOME OR ON ITS FACE, ONE rowForm (goal/G43.18, box v29, "The shell"; the RULE: "a shell must be able to
// replace itself"). Andy drew the two rows of the app detail:
//   rowForm: [🏡] "Home shell" app:search:dropdown [armingButton-'Set'], the dropdown first showing the configured home shell.
//   rowForm: [😋] "Face shell" app:search:dropdown [armingButton-'Set'], the dropdown first showing the configured face shell.
// "shown only for an app whose <name>.json says shell:true:true", and "Both dropdowns list only the apps whose <name>.json says
// shell:true:true". Q12: "the two set-shell rows are elements of their own, which any app that wants to be a shell can use."
//
//   spirit.elements.rowFormSetShell.create(host, { key, at }) -> { destroy() }
//     key   the app whose detail it stands in: no row unless that app may be a shell
//     at    'home' or 'face'
//
// Beside the dropdown, the shell the node names now (node.shell({ at })), by its label; a pick is held until Set, an
// armingButton, whose second press asks the node, node.shell({ at, name }), and the row says what the node answered.
(function () {
  window.spirit.require('spirit/element/rowForm.js');
  window.spirit.require('spirit/element/armingButton.js');
  window.spirit.require('spirit/element/search/app.js');
  window.spirit.cacheManager('app');

  var LOOK = { home: { icon: '🏡', words: 'Home shell' }, face: { icon: '😋', words: 'Face shell' } };

  function create(host, options) {
    var S = window.spirit;
    var o = options || {};
    var key = String(o.key || '');
    var at = o.at === 'face' ? 'face' : 'home';
    var gone = false;
    var form = null;
    var list = null;
    var picked = '';
    var named = '';
    var shown = null;
    var said = null;
    function rows() { var A = S.data.app && S.data.app.data; return A ? A.rows() : {}; }
    function labelOf(name) { var r = rows()[name]; return r ? String(r.label || name) : name; }
    function paint() { if (shown) shown.textContent = named ? labelOf(named) : ''; }
    function ask() {
      return S.ready.then(function (s) { return s.node.shell({ at: at }); }).then(function (r) { named = String((r && r.name) || ''); paint(); }, function () { /* the row stays */ });
    }
    // ONLY FOR AN APP THAT MAY BE A SHELL: its row, from <name>.json alone (spirit/app.js), drawn once it is known.
    function draw() {
      if (gone || form) return;
      var row = rows()[key];
      if (!row || row.shell !== true) return;
      var E = S.element;
      form = E.spirit.element.rowForm.create(host, { icon: LOOK[at].icon, button: 'Set' });
      form.span.appendChild(document.createTextNode(LOOK[at].words + ' '));
      shown = document.createElement('span');
      form.span.appendChild(shown);
      form.span.appendChild(document.createTextNode(' '));
      var listHost = document.createElement('span');
      form.span.appendChild(listHost);
      list = E.spirit.element.search.app.create(listHost, { face: 'dropdown', shells: true, pick: function (r, k) { picked = k || ''; } });
      said = document.createElement('div');
      said.className = 'job-manifest-note';
      host.appendChild(said);
      E.spirit.element.armingButton.attach(form.button, { label: 'Set', run: function () {
        if (!picked) { said.textContent = 'Choose a shell first.'; return; }
        S.ready.then(function (s) { return s.node.shell({ at: at, name: picked }); }).then(function (r) {
          named = String((r && r.name) || picked);
          said.textContent = '';
          paint();
        }, function (e) { said.textContent = 'Not set: ' + ((e && e.message) || e); });
      } });
      paint();
      ask();
    }
    var off = S.data.app.data.watch(function () { draw(); paint(); });
    Promise.all(['spirit/element/rowForm.js', 'spirit/element/armingButton.js', 'spirit/element/search/app.js'].map(function (p) { return S.require(p); })).then(function () {
      if (gone) return;
      if (!rows()[key]) {
        S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) { if (!gone) S.data.seatRows(S.data.app.data.branch, got.items); }, function () { /* the row comes with the stream */ });
      }
      draw();
    });
    return {
      destroy: function () {
        gone = true;
        off();
        if (list) list.destroy();
        host.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/appSelector/rowFormSetShell.js', { create: create }); });
}());
