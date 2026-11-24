'use strict';
// spirit/run/spirit/app/grants/element.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6), an app of spirit/app/ (goal/G43.24). Its
// contract and its test: ./test/grants.md and ./test/grants.js.
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has interactive access", "yes i
//   find it by searching labels, then select one key, and issue or revoke grand rows for that key.", and on G43.24: "no i
//   want those apps to basically be wrappers for spirit/element/ things....", "box that these apps must mount in the new
//   format of the new shell."
//
//   spirit.required.spirit.app.grants.element.create(container, opts) -> { destroy() }
//
// A WRAPPER, MOUNTED THE NEW SHELL'S WAY, as spirit/app/file/element.js is: it loads its elements and mounts them, nothing of
// its own. Two tabs (goal/G41.13), in the tab container: Grants, the grants panel (spirit/element/search/grant/grantsPanel/script.js) configured
// with the contacts as its IDs and the node's own grants table, grantsPanel.nodeGrants (the callers configure the panel,
// Andy, G41.16); Bundles, the bundle editor (spirit/element/bundleEditor/script.js), which opens each bundle's branchEditor as a
// closable tab of this row (goal/G41.32; Andy: "in the Grants app, this will be the grant app's tabContainer."), each named
// owner-bundle (Andy: "Grants: <owner>-<bundle>."). Every change goes through the loopback verbs apiAuth.js answers, each
// element asking them itself.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/tabContainer/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/grant/grantsPanel/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/bundleEditor/script.js');
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all(['spirit/element/search/grant/grantsPanel/script.js', 'spirit/element/tabContainer/script.js', 'spirit/element/bundleEditor/script.js']
    .map(function (p) { return S.requireScript(p); }));

  function create(container) {
    var gone = false;
    var tabs = null;
    container.innerHTML = '';
    parts.then(function () {
      if (gone) return;
      tabs = ANSWER['spirit/element/tabContainer/script.js'].create(container, {
        tabs: [
          { name: 'grants', label: 'Grants', mount: function (box) {
            return ANSWER['spirit/element/search/grant/grantsPanel/script.js'].create(box, { ids: { table: 'loopback://api/contact/search' }, grants: ANSWER['spirit/element/search/grant/grantsPanel/script.js'].nodeGrants });
          } },
          { name: 'bundles', label: 'Bundles', mount: function (box) {
            return ANSWER['spirit/element/bundleEditor/script.js'].create(box, { tabs: tabs, tabLabel: function (row) { return String(row.owner || 'node') + '-' + String(row.label || ''); } });
          } },
        ],
      });
    }, function () { if (!gone) container.textContent = 'Grants could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (tabs) tabs.destroy();
        tabs = null;
        container.innerHTML = '';
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
