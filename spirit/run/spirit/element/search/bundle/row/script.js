'use strict';
// spirit/run/spirit/element/search/bundle/row/script.js
// ONE BUNDLE, AS A ROW ELEMENT (goal/G41.14). Its subject is a bundle of node.db's
// bundle table, keyed by its hidden number; its fields label and owner. row.js does the shared work; this
// file says what a bundle is (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates, wherever they are used").
// Its Edit and Delete went with goal/G41.32 (Andy: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete'
// Button"): a row pressed is the selector's, Delete is the branchEditor's. The label is shown only since goal/G41.26 (Andy:
// "bundleSelector:pane mode the Label should now just be an output, field").
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes
// their data set. and the SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the
// fucking elements", "NO FUCKING DATA SCRIPT", "THAT FUCKING ELEMENTS carry THEIR FUCKING DESCRIPTIONS"): the node
// publishes each changed bundle row on its permanent job 'bundles' ({ table: 'bundle', row }, gone when deleted); the
// auth family's cache manager (below) puts it into spirit.required.spirit.data.bundle.data, and every bundle row on the page repaints from there through its
// kind's index. A row asks and draws nothing of its own (rule/19): what it shows is what the stream said.
//
//   spirit.required.spirit.element.search.bundle.row.create(row) -> a row of kind bundle
//     row            { id, label, owner }, as spirit.bundle answers it
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/bundle/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  if (window.spirit.requireScript) keepAnswer('spirit/element/row/script.js');

  // A NODE'S BUNDLES ARE THE bundle BRANCH'S CACHE (goal/G41.28): what a bundle row on the stream means, and its branch,
  // are the family's own data.js's (spirit/bundle/client/script.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.required.spirit.data.bundle.data.
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the bundles are its bundle.data.
  var storeReady = Promise.resolve(window.spirit.readyPromise);
  function bundleReads() { return ((window.spirit.dataStore || {}).bundle || {}).data; }
  var authReady = Promise.all([keepAnswer('spirit/bundle/script.js'), storeReady]).then(function () { return bundleReads(); });
  // THE KIND'S INDEX: one watch on the bundles for every bundle row on the page, each change to the rows of that key;
  // its release answered to the index, which lets it go with the kind's last row.
  var bundles = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(B) {
      if (gone || !B || off) return;
      off = B.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || ''), owner: String(v.owner || 'node') }); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(bundleReads());
    if (!off) authReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    bundles = bundles || ANSWER['spirit/element/row/script.js'].index(dispatch);
    return bundles;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row) {
    var r = row || {};
    var id = Number(r.id);
    return ANSWER['spirit/element/row/script.js'].create({
      kind: 'bundle',
      key: String(id),
      index: index(),
      row: { id: id, label: String(r.label || ''), owner: String(r.owner || 'node') },
      fields: [
        { name: 'label', paint: function (v) { return esc(v.label); } },
        // THE OWNER, SHOWN ONLY (goal/G41.25; Andy, box: "the bundleSelector's list will gain a new column \"owner\",
        // displayed right after the bundles label", and "the owner field can never be changed after a bundle is added").
        { name: 'owner', paint: function (v) { return esc(v.owner); } },
      ],
    });
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
