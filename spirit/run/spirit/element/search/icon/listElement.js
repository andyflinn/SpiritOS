// spirit/run/spirit/element/search/icon/listElement.js
// THE ICONS LIST, A DROP-IN SHELL ELEMENT (goal/G30.21): the system set (spirit/iconSet.json, each glyph with
// the keywords it is found by) on the standard list-tool (spirit/element/search.js), each row an icon row element (./rowElement.js). The
// Icons app draws it as a pane; the Apps panel's icon field as a dropdown. Words are matched against the glyph and its
// keywords. A
// pick hands over the glyph itself, never a key into a table.
//
// No data.js: the set is one file, a constant, read once by the page (below).
//
//   set() -> the set, { glyph: [keywords] }, as the page holds it; the icon selector offers the same one
//   create(host, opts) -> the list (value, row, words(), refresh(), redraw(), destroy(), reload())
//     opts.face          'pane' or 'dropdown'
//     opts.placeholder, opts.all, opts.empty
//     opts.pick(row, glyph)   an icon chosen; row { glyph, keywords }
//     opts.details(row, glyph)   a pane's press, when the app opens the icon itself
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: each icon it lists is the icon element (spirit/element/icon.js), which its rows paint through.
  if (window.spirit.require) ['spirit/element/search/icon/rowElement.js', 'spirit/element/search.js', 'spirit/element/icon.js'].forEach(function (p) { window.spirit.require(p); });
  // Andy, goal/G43.11: "run://spirit/iconSet.json IS the system set now."
  var SET = 'spirit/iconSet.json';

  // Loaded with this element for the Icons app's panel, which follows spirit.data.fs.data.icons until its own item.
  window.spirit.cacheManager('fs');

  // THE SET IS A CONSTANT (goal/G43.11; Andy: "we make it a constant, that way i cannot change, and leave code that reads it
  // hanging"). The page reads the file once and holds it here, where a stream connecting does not wipe it: an exception to
  // goal/G41.28's "the shells one and only spirit.data object", for this constant. Andy's commit shows after a page reload.
  // A read that is refused is not kept, so a face that gets its star can read it later.
  var held = null;
  var reading = null;
  function readSet() {
    if (held) return Promise.resolve(held);
    if (reading) return reading;
    // Through the spirit object (goal/G32.2).
    reading = spirit.ready.then(function (s) { return s.fs.loadFile(SET); }).then(function (text) {
      reading = null;
      var set = JSON.parse(text);
      if (!set || typeof set !== 'object') return {};
      held = set;
      return held;
    }).catch(function () { reading = null; return {}; });
    return reading;
  }
  function rowsOf(set) {
    return Object.keys(set).map(function (g) { return { key: g, glyph: g, keywords: Array.isArray(set[g]) ? set[g] : [] }; });
  }

  function create(host, opts) {
    var o = opts || {};
    var list = null;
    var rows = [];
    function reload() {
      return readSet().then(function (set) {
        rows = rowsOf(set);
        if (list) list.redraw();
        return set;
      });
    }
    list = E.search.create(host, {
      api: { verb: function () { return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); } },
      server: 'fs',
      verb: 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose an icon…',
      all: o.all,
      name: function (row) { return String(row.glyph || '') + ' ' + String((row.keywords || [])[0] || ''); },
      rows: function () { return rows; },
      columns: [
        { field: 'glyph', label: '' },
        { field: 'keywords', label: 'Keywords' },
      ],
      element: function (row, key) { return E.search.icon.rowElement.create(Object.assign({ glyph: key }, row)); },
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      details: typeof o.details === 'function' ? function (row, key) { o.details(row, key); } : undefined,
      empty: o.empty || 'No icon matches.',
    });
    list.reload = reload;
    reload();
    return list;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'icon', 'listElement'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, E), { create: create, set: readSet, SET: SET });
}());
