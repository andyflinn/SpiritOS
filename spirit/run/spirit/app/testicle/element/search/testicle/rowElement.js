'use strict';
// spirit/run/spirit/app/testicle/element/search/testicle/rowElement.js
// A TEST ROW, AN ELEMENT (goal/G47.1, the search cycle): one row of testicle's test table as ./listElement.js and
// ./detailElement.js draw it, on the shared row element (spirit/element/rowElement.js).
//
//   spirit.element.spirit.app.testicle.element.search.testicle.rowElement.create(row) -> the row element
//
// The box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity
// second; the title third; then the script name (no path), then the suite name (no path)", "The test row also shows its
// severity, two decimal places, even for 0 and 1 (0.00, 1.00)", "The script column and the suite column show the file
// name only, no path; hovering over a script or a suite shows its full name as a tooltip", "The test title is shown in
// full."
(function () {
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.require === 'function') Promise.resolve(window.spirit.require('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.cacheManager === 'function') Promise.resolve(window.spirit.cacheManager('testicle')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  S.require('spirit/element/rowElement.js');

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }
  function nameOf(p) { var s = String(p == null ? '' : p); return s.slice(s.lastIndexOf('/') + 1); }
  function fileCell(p) { return '<span title="' + esc(p) + '">' + esc(nameOf(p)) + '</span>'; }

  var index = null;
  function create(row) {
    var R = S.element.spirit.element.rowElement;
    var r = row || {};
    index = index || R.index(function () {});
    return R.create({
      kind: 'testicle',
      key: String(r.key || ''),
      index: index,
      row: r,
      fields: [
        { name: 'verified', paint: function (v) { return v.verified ? '✅' : '❌'; } },
        { name: 'severity', paint: function (v) { return esc((Number(v.severity) || 0).toFixed(2)); } },
        { name: 'test', paint: function (v) { return esc(v.test); } },
        { name: 'script', paint: function (v) { return fileCell(v.script); } },
        { name: 'suite', paint: function (v) { return fileCell(v.suite); } },
      ],
      actions: [],
    });
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/testicle/element/search/testicle/rowElement.js', { create: create }); });
}());
