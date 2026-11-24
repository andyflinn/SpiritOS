'use strict';
// spirit/run/spirit/element/search/api/row.js
// ONE FAMILY OF AN API TREE, AS A ROW ELEMENT (goal/G43.32; Andy: "uniformity, in the search elements and their folders,
// contain list, row an detail elements."): the row of the family list (./list.js), its one field the family's name,
// what the list drew before as its name column. row.js does the shared work; this file says what a family is. A tree
// read again replaces the list's rows whole, so there is no dispatch. Its contract and its test: ./test/row.md and
// ./test/row.js.
//
//   spirit.required.spirit.element.search.api.row.create({ name }) -> the row element
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the shared row element.
  keepAnswer('spirit/element/row.js');

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  var index = null;
  function create(row) {
    var r = row || {};
    var R = ANSWER['spirit/element/row.js'];
    var name = String(r.name || r.key || '');
    index = index || R.index(function () {});
    return R.create({
      kind: 'family',
      key: name,
      index: index,
      row: { name: name },
      fields: [{ name: 'name', paint: function (v) { return esc(v.name); } }],
      actions: [],
    });
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
