'use strict';
// spirit/run/spirit/element/search/icon/rowElement.js
// ONE ICON, AS A ROW ELEMENT (goal/G30.21). Its subject is a glyph, the icon itself (Andy: "it's the icon we store or
// use"); its fields the glyph and the keywords it is found by, from the system set (spirit/iconSet.json).
// rowElement.js does the shared work; this file says what an icon is. The set is one file, not a stream, so there is no
// dispatch: a list built again from a changed set makes its rows again.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: the glyph is the icon element (spirit/element/icon.js), loaded here too.
  if (window.spirit.require) ['spirit/element/rowElement.js', 'spirit/element/icon.js'].forEach(function (p) { window.spirit.require(p); });
  var icons = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // THE ICON IS THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all shell elements
  // and apps."): made by icon.create and handed on as its markup, since a cell is painted as text; the glyph as plain text
  // while icon.js has not loaded.
  function iconHtml(glyph) {
    var I = E.spirit.element.icon;
    if (!I || typeof I.create !== 'function' || typeof document === 'undefined') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }
  function index() { icons = icons || E.spirit.element.rowElement.index(function () {}); return icons; }

  function create(row) {
    var r = row || {};
    var glyph = String(r.glyph || r.key || '');
    return E.spirit.element.rowElement.create({
      kind: 'icon',
      key: glyph,
      index: index(),
      row: { glyph: glyph, keywords: Array.isArray(r.keywords) ? r.keywords.slice() : [] },
      fields: [
        { name: 'glyph', paint: function (v) { return '<span style="font-size:1.3em">' + iconHtml(v.glyph) + '</span>'; } },
        { name: 'keywords', paint: function (v) { return esc(v.keywords.join(', ')); } },
      ],
      actions: [],
    });
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/icon/rowElement.js', { create: create }); });
}());
