'use strict';
// spirit/run/spirit/element/search/branch/row/script.js
// ONE BRANCH, AS A ROW ELEMENT (goal/G41.14). Its subject is a row of node.db's branch table, keyed by its hidden
// number, the bundle it belongs to with it; its fields family, verb and delete (Andy, box: "branchSelector:pane, with
// table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'"). An empty verb is all of the family,
// drawn "(ALL)" as the filter draws it ("A branch row with an empty verb shows as "(ALL)", as the filter does").
// row.js does the shared work; this file says what a branch is.
//
//   spirit.required.spirit.element.search.branch.row.create(row, opts) -> a row of kind branch
//     row            { id, bundle, family, verb }, as spirit.branch answers it
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (goal/G41.14; Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything
// that changes their data set", "NO FUCKING DATA SCRIPT"): the node publishes each changed branch row on its permanent
// job 'bundles' ({ table: 'branch', row }, gone when deleted, a bundle's branches each gone with it); the auth family's
// cache manager (below) puts it into spirit.required.spirit.data.branch.data, and every branch row on the page repaints from there
// through its kind's index. A row asks and draws nothing of its own (rule/19).
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/branch/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/row/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/armingButton/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  var parts = Promise.all(['spirit/element/row/script.js', 'spirit/element/armingButton/script.js'].map(function (p) {
    return window.spirit.requireScript ? window.spirit.requireScript(p) : null;
  }));
  var ALL = '(ALL)';

  // A NODE'S BRANCHES ARE THE branch BRANCH'S CACHE (goal/G41.28): what a branch row on the stream means, and its branch,
  // are the family's own data.js's (spirit/branch/client/script.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.required.spirit.data.branch.data.
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the branches are its branch.data.
  var storeReady = Promise.resolve(window.spirit.readyPromise);
  function branchReads() { return ((window.spirit.dataStore || {}).branch || {}).data; }
  var authReady = Promise.all([window.spirit.requireScript('spirit/branch/script.js'), storeReady]).then(function () { return branchReads(); });
  // THE KIND'S INDEX: one watch on the branches for every branch row on the page, each change to the rows of that key;
  // its release answered to the index, which lets it go with the kind's last row.
  var branches = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(B) {
      if (gone || !B || off) return;
      off = B.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ family: String(v.family || ''), verb: String(v.verb || '') }); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(branchReads());
    if (!off) authReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    branches = branches || ANSWER['spirit/element/row/script.js'].index(dispatch);
    return branches;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row, opts) {
    var o = opts || {};
    var r = row || {};
    var el = ANSWER['spirit/element/row/script.js'].create({
      kind: 'branch',
      key: String(Number(r.id)),
      index: index(),
      row: { id: Number(r.id), bundle: Number(r.bundle), family: String(r.family || ''), verb: String(r.verb || '') },
      fields: [
        { name: 'family', paint: function (v) { return esc(v.family); } },
        { name: 'verb', paint: function (v) { return v.verb ? esc(v.verb) : ALL; } },
        { name: 'delete', paint: function () { return '<button type="button" class="cancel-btn" data-action="delete">Delete</button>'; } },
      ],
      actions: [
        { name: 'delete', label: 'Delete', run: function (it) {
          return spirit.readyPromise.then(function () { return spirit.requireScript('spirit/branch/script.js'); }).then(function (s) { return s.delete({ id: it.row.id }); });
        } },
      ],
    });
    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      mount(h);
      function controls() {
        var del = h.delete && typeof h.delete.querySelector === 'function' ? h.delete.querySelector('[data-action="delete"]') : null;
        if (del) ANSWER['spirit/element/armingButton/script.js'].attach(del, { label: 'Delete', run: function () { return el.act('delete', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the control waits for them.
      if (ANSWER['spirit/element/armingButton/script.js']) controls(); else parts.then(controls);
      return el;
    };
    return el;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
