'use strict';
// spirit/run/spirit/element/search/file/tile/script.js
// ONE FILE, AS A TILE (goal/G47.4, the box: "Tile mode is a search's own: a search that has a tile.js, beside its row.js, has
// tile mode. Its tile.js draws its tile and decides what a press does"). The file search hands it to the shared search as its
// tile part (../list/script.js). Its contract and its test: ./test/script.md and ./test/tile.js.
//
//   spirit.required.spirit.element.search.file.tile.create(row, { icon, press(row, key) }) -> the tile's node;
//     row { key or path, kind }, icon the glyph the file search chose for it
//
// The tile as the file search drew it (goal/G43.17, Q14: "a file's tile shows its kind's icon and its name"): the icon through
// the icon element, a tile-bar the shared search draws the relevance into (goal/G43.6), and the file's name, the last part of
// its path. A press on it is press(row, key): the file search does what a press on its row does, a folder opening or shutting.
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
  keepAnswer('spirit/element/icon/script.js');

  function create(row, opts) {
    var r = row || {};
    var o = opts || {};
    var key = String(r.key || r.path || '');
    var n = document.createElement('div');
    n.className = 'app-icon';
    n.setAttribute('data-key', key);
    var icon = document.createElement('span');
    icon.className = 'icon';
    var I = E.spirit && E.spirit.element && ANSWER['spirit/element/icon/script.js'];
    if (I && typeof I.create === 'function') I.create(icon, { glyph: String(o.icon || '') });
    else icon.textContent = String(o.icon || '');
    var bar = document.createElement('div');
    bar.className = 'tile-bar';
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = key.slice(key.lastIndexOf('/') + 1);
    n.appendChild(icon);
    n.appendChild(bar);
    n.appendChild(label);
    n.addEventListener('click', function () { if (typeof o.press === 'function') o.press(r, key); });
    return n;
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
