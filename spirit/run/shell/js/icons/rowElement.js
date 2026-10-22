// spirit/run/shell/js/icons/rowElement.js
// ONE ICON, AS A ROW ELEMENT (goal/G30.21). Its subject is a glyph, the icon itself (Andy: "it's the icon we store or
// use"); its fields the glyph and the keywords it is found by, from the Icons app's set (shell/icons/iconSet.json).
// rowElement.js does the shared work; this file says what an icon is. The set is one file, not a stream, so there is no
// dispatch: a list built again from a changed set makes its rows again.
(function () {
  var E = window.spiritElements = window.spiritElements || {};
  var icons = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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
        { name: 'glyph', paint: function (v) { return '<span style="font-size:1.3em">' + esc(v.glyph) + '</span>'; } },
        { name: 'keywords', paint: function (v) { return esc(v.keywords.join(', ')); } },
      ],
      actions: [],
    });
  }

  E.iconElement = { create: create };
}());
