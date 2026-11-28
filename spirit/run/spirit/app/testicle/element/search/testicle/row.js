'use strict';
// spirit/run/spirit/app/testicle/element/search/testicle/row.js
// A TEST ROW, AN ELEMENT (goal/G47.1, the search cycle): one row of testicle's test table as ./list.js and
// ./detail.js draw it, on the shared row element (spirit/element/row/script.js).
//
//   spirit.required.spirit.app.testicle.element.search.testicle.row.create(row) -> the row element
//
// The box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity
// second; the title third; then the script name (no path), then the suite name (no path)", "The test row also shows its
// severity, two decimal places, even for 0 and 1 (0.00, 1.00)", "The script column and the suite column show the file
// name only, no path; hovering over a script or a suite shows its full name as a tooltip", "The test title is shown in
// full."
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  keepAnswer('spirit/element/row/script.js');
  // A result's icon worded by testicle's words (goal/G47.1; ../../../words.js), loaded as this file runs (rule/26).
  keepAnswer('spirit/app/testicle/words.js');

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }
  function nameOf(p) { var s = String(p == null ? '' : p); return s.slice(s.lastIndexOf('/') + 1); }
  function fileCell(p) { return '<span title="' + esc(p) + '">' + esc(nameOf(p)) + '</span>'; }
  // A SCRIPT IN ITS OWN FOLDER SHOWS THE FOLDER (goal/G49.27, box v4: "the script column in testicle's search shows the folder name of
  // a <folder>/script.js"): spirit/contact/hub/script.js shows hub, its full path in the tooltip; every other script its file name.
  function scriptName(p) { var s = String(p == null ? '' : p); var parts = s.split('/'); return parts.length > 1 && parts[parts.length - 1] === 'script.js' ? parts[parts.length - 2] : nameOf(s); }
  function scriptCell(p) { return '<span title="' + esc(p) + '">' + esc(scriptName(p)) + '</span>'; }

  var index = null;
  function create(row) {
    var R = ANSWER['spirit/element/row/script.js'];
    var r = row || {};
    index = index || R.index(function () {});
    return R.create({
      kind: 'testicle',
      key: String(r.key || ''),
      index: index,
      row: r,
      fields: [
        { name: 'verified', paint: function (v) { return ANSWER['spirit/app/testicle/words.js'].result(!!v.verified); } },
        { name: 'severity', paint: function (v) { return esc((Number(v.severity) || 0).toFixed(2)); } },
        { name: 'test', paint: function (v) { return esc(v.test); } },
        { name: 'script', paint: function (v) { return scriptCell(v.script); } },
        { name: 'suite', paint: function (v) { return fileCell(v.suite); } },
      ],
      actions: [],
    });
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
