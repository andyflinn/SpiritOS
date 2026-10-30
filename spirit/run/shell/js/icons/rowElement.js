// spirit/run/shell/js/icons/rowElement.js
// ONE ICON, AS A ROW ELEMENT (goal/G30.21). Its subject is a glyph, the icon itself (Andy: "it's the icon we store or
// use"); its fields the glyph and the keywords it is found by, from the Icons app's set (relay-state/shell/icons/iconSet.json, else shell/json/iconSet.json).
// rowElement.js does the shared work; this file says what an icon is. The set is one file, not a stream, so there is no
// dispatch: a list built again from a changed set makes its rows again.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: the glyph is the icon element (shell/js/icon.js), loaded here too.
  if (window.spirit.require) ['shell/js/rowElement.js', 'shell/js/icon.js'].forEach(function (p) { window.spirit.require(p); });
  var icons = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // THE ICON IS THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all shell elements
  // and apps."): made by icon.create and handed on as its markup, since a cell is painted as text; the glyph as plain text
  // while icon.js has not loaded.
  function iconHtml(glyph) {
    var I = E.icon;
    if (!I || typeof I.create !== 'function' || typeof document === 'undefined') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }
  function index() { icons = icons || E.rowElement.index(function () {}); return icons; }

  function create(row) {
    var r = row || {};
    var glyph = String(r.glyph || r.key || '');
    return E.rowElement.create({
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

  E.iconElement = { create: create };
}());
