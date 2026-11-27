'use strict';
// spirit/run/spirit/element/search/app/row/script.js
// ONE APP, AS A ROW ELEMENT (goal/G43.2), as spirit/element/search/bundle/row/script.js is one bundle. row.js does the
// shared work; this file says what an app is. Its contract and its test: ./test/script.md and ./test/row.js.
//
//   spirit.required.spirit.element.search.app.row.create(row) -> a row of kind app; row { key, label, icon }
//
// WHO PAINTS, LISTENS (Andy, G41.32): one watch on spirit.required.spirit.data.app.data for every app row on the page, each change to the rows
// of that key. A row asks nothing of its own; what it shows is what the stream said.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
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
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/icon/script.js');
  // On spirit.required since goal/G43.18, as its file is in spirit/element/search/app/.
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  ['spirit/element/row/script.js', 'spirit/element/icon/script.js', 'spirit/element/search/app/rowFormAppActive/script.js'].forEach(function (p) { window.spirit.requireScript(p); });
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the app rows are its app.data.
  var storeReady = Promise.resolve(window.spirit.readyPromise);
  function appReads() { return ((window.spirit.dataStore || {}).app || {}).data; }
  var appReady = Promise.all([keepAnswer('spirit/app/script.js'), storeReady]).then(function () { return appReads(); });

  var apps = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(A) {
      if (gone || !A || off) return;
      off = A.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || ''), icon: String(v.icon || '') }); });
      });
    }
    listen(appReads());
    if (!off) appReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    apps = apps || ANSWER['spirit/element/row/script.js'].index(dispatch);
    return apps;
  }

  function esc(s) { return window.spirit.escapeHtml(s); }
  // THE ICON IS THE ICON ELEMENT (goal/G41.23), handed on as its markup, since a cell is painted as text.
  function iconHtml(glyph) {
    if (!ANSWER['spirit/element/icon/script.js']) return esc(glyph);
    var hold = document.createElement('span');
    ANSWER['spirit/element/icon/script.js'].create(hold, { glyph: glyph });
    return hold.innerHTML;
  }

  function create(row) {
    var r = row || {};
    var el = ANSWER['spirit/element/row/script.js'].create({
      kind: 'app',
      key: String(r.key || ''),
      index: index(),
      row: { key: String(r.key || ''), label: String(r.label || ''), icon: String(r.icon || '') },
      fields: [
        { name: 'icon', paint: function (v) { return iconHtml(v.icon); } },
        { name: 'label', paint: function (v) { return esc(v.label); } },
      ],
    });
    // ITS BUTTON, where the row is given a cell for it (Andy, box: "the (de)activate buttons at the end of each row"):
    // rowFormAppActive (goal/G43.15, the box: "The appSelector's detail and its rows use them."), which follows the row's active
    // itself and hides itself for an intrinsic app. A cell is painted again at each draw, so it is made anew.
    var key = String(r.key || '');
    var installer = null;
    function dropInstaller() { if (installer && typeof installer.destroy === 'function') installer.destroy(); installer = null; }
    var mount = el.mount;
    var destroy = el.destroy;
    el.mount = function (hosts) {
      mount(hosts);
      dropInstaller();
      var cell = hosts && hosts.active;
      if (cell) {
        // A press on the switch is the switch's, never the row's pick (as the installer it replaced stopped it).
        cell.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('button')) e.stopPropagation(); });
        // It may still be loading: made once it is in, unless the row was drawn again meanwhile.
        var made = Promise.resolve(keepAnswer('spirit/element/search/app/rowFormAppActive/script.js')).then(function () {
          if (installer !== made) return;
          installer = ANSWER['spirit/element/search/app/rowFormAppActive/script.js'].create(cell, { key: key });
        });
        installer = made;
      }
      return el;
    };
    el.destroy = function () { dropInstaller(); return destroy(); };
    return el;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
