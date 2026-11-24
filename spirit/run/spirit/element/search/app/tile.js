'use strict';
// spirit/run/spirit/element/search/app/tile.js
// ONE APP, AS A TILE (goal/G47.4, the box: "Tile mode is a search's own: a search that has a tile.js, beside its row.js, has
// tile mode. Its tile.js draws its tile and decides what a press does"). The app search hands it to the shared search as its
// tile part (./list.js). Its contract and its test: ./test/tile.md and ./test/tile.js.
//
//   spirit.required.spirit.element.search.app.tile.create(row, { press(row, key) }) -> the tile's node; row { key, label, icon }
//
// The tile as the app search always drew it (goal/G43.6, Andy: "A tile: its image, the relevance, its label."): the app's icon
// through the icon element, a tile-bar the shared search draws the relevance into, and the app's label. A press on it is
// press(row, key): the app search picks the app, as a press on its row does.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var E = ((window.spirit = window.spirit || {}).required = window.spirit.required || {});
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  keepAnswer('spirit/element/icon.js');

  function create(row, opts) {
    var r = row || {};
    var o = opts || {};
    var key = String(r.key || '');
    var n = document.createElement('div');
    n.className = 'app-icon';
    n.setAttribute('data-key', key);
    var icon = document.createElement('span');
    icon.className = 'icon';
    var I = E.spirit && E.spirit.element && ANSWER['spirit/element/icon.js'];
    if (I && typeof I.create === 'function') I.create(icon, { glyph: String(r.icon || '') });
    else icon.textContent = String(r.icon || '');
    var bar = document.createElement('div');
    bar.className = 'tile-bar';
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = String(r.label || '');
    n.appendChild(icon);
    n.appendChild(bar);
    n.appendChild(label);
    n.addEventListener('click', function () { if (typeof o.press === 'function') o.press(r, key); });
    return n;
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
