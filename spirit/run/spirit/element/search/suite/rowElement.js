'use strict';
// spirit/run/spirit/element/search/suite/rowElement.js
// A SUITE ROW, AN ELEMENT (goal/G47.1, the UI cycle): one suite row of testicle's suite table as ./listElement.js draws it, on
// the shared row element (spirit/element/rowElement.js). Its fields: the suite's filename, and its status, "needs running"
// while the row is flagged, shown red (the box: "the filename AND its status \"needs running\", which will be shown as red
// in the UI").
//
//   spirit.element.spirit.element.search.suite.rowElement.create(row) -> the row element
(function () {
  var S = window.spirit = window.spirit || {};
  S.require('spirit/element/rowElement.js');

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  var index = null;
  function create(row) {
    var R = S.element.spirit.element.rowElement;
    var r = row || {};
    index = index || R.index(function () {});
    return R.create({
      kind: 'suite',
      key: String(r.key || ''),
      index: index,
      row: r,
      fields: [
        { name: 'suite', paint: function (v) { return esc(v.suite); } },
        { name: 'status', paint: function (v) { return v.status ? '<span class="suite-status" style="color:#c00">' + esc(v.status) + '</span>' : ''; } },
      ],
      actions: [],
    });
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/suite/rowElement.js', { create: create }); });
}());
