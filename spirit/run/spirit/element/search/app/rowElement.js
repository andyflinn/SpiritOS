'use strict';
// spirit/run/spirit/element/search/app/rowElement.js
// ONE APP, AS A ROW ELEMENT (goal/G43.2), as spirit/element/search/bundle/rowElement.js is one bundle. rowElement.js does the
// shared work; this file says what an app is. Its contract and its test: ./test/rowElement.md and ./test/rowElement.js.
//
//   spirit.element.spirit.element.search.app.rowElement.create(row) -> a rowElement of kind app; row { key, label, icon }
//
// WHO PAINTS, LISTENS (Andy, G41.32): one watch on spirit.data.app.data for every app row on the page, each change to the rows
// of that key. A row asks nothing of its own; what it shows is what the stream said.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/app/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  // On spirit.element since goal/G43.18, as its file is in spirit/element/search/app/.
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  ['spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/element/search/app/rowFormAppActive.js'].forEach(function (p) { window.spirit.require(p); });
  var appReady = Promise.resolve(window.spirit.cacheManager('app')).then(function () { return ((window.spirit.data || {}).app || {}).data; });

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
    listen(((window.spirit.data || {}).app || {}).data);
    if (!off) appReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    apps = apps || window.spirit.element.spirit.element.rowElement.index(dispatch);
    return apps;
  }

  function esc(s) { return window.spirit.escapeHtml(s); }
  // THE ICON IS THE ICON ELEMENT (goal/G41.23), handed on as its markup, since a cell is painted as text.
  function iconHtml(glyph) {
    if (!window.spirit.element.spirit.element.icon) return esc(glyph);
    var hold = document.createElement('span');
    window.spirit.element.spirit.element.icon.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }

  function create(row) {
    var r = row || {};
    var el = window.spirit.element.spirit.element.rowElement.create({
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
        var made = Promise.resolve(window.spirit.require('spirit/element/search/app/rowFormAppActive.js')).then(function () {
          if (installer !== made) return;
          installer = window.spirit.element.spirit.element.search.app.rowFormAppActive.create(cell, { key: key });
        });
        installer = made;
      }
      return el;
    };
    el.destroy = function () { dropInstaller(); return destroy(); };
    return el;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/app/rowElement.js', { create: create }); });
}());
