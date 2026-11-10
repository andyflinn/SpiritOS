'use strict';
// spirit/run/spirit/element/search/icon/listElement.js
// THE ICONS LIST, A DROP-IN SHELL ELEMENT (goal/G30.21): the system set (spirit/iconSet.json, each glyph with
// the keywords it is found by) on the standard list-tool (spirit/element/search.js), each row an icon row element (./rowElement.js). The
// Icons app draws it as a pane; the Apps panel's icon field as a dropdown. Words are matched against the glyph and its
// keywords. A
// pick hands over the glyph itself, never a key into a table.
//
// THE SET IS THE FS FAMILY'S, AND FOLLOWED (goal/G43.32; Andy: "It obviously must require the fs interface so it can
// listen to changes in the file it loads for it's icon list...."): the file is read through the fs family, kept in the fs
// family's cache (spirit.data.fs.data.icons), and the list draws that branch. Each list watches the file's row and reads it
// again when it changes, and the fs tree for it coming back whole after a reconnect forgot the set; lists read together
// read once. This ends
// the set as a constant held beside spirit.data (goal/G43.11, "we make it a constant"): his newer words.
//
//   set() -> the set, { glyph: [keywords] }, as the fs cache holds it, read once when it holds none; the icon selector
//            offers the same one
//   create(host, opts) -> { value, row, refresh(), redraw(), reload(), destroy() }, the list made once the fs cache is in
//     opts.face          'pane' or 'dropdown'
//     opts.placeholder, opts.all, opts.empty, opts.visible(row)   false holds a row back (the selector's exclude)
//     opts.pick(row, glyph)   an icon chosen; row { glyph, keywords }
//     opts.details(row, glyph)   a pane's press, when the app opens the icon itself
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: each icon it lists is the icon element (spirit/element/icon.js), which its rows paint through.
  if (window.spirit.require) ['spirit/element/search/icon/rowElement.js', 'spirit/element/search.js', 'spirit/element/icon.js'].forEach(function (p) { window.spirit.require(p); });
  // Andy, goal/G43.11: "run://spirit/iconSet.json IS the system set now."
  var SET = 'spirit/iconSet.json';

  // The fs family's cache, where the set is kept and the file followed.
  var cache = window.spirit.cacheManager('fs');
  function F() { return ((window.spirit.data || {}).fs || {}).data || null; }

  // A read that is refused keeps nothing, so a face that gets its star can read it later. Lists read together read once.
  var reading = null;
  // The file's row as last read (modified and size): a row written again unchanged is read only if the set is gone (a
  // reconnect empties spirit.data, and the push sets the row again).
  var readStamp = '';
  function stampOf(row) { return row ? String(row.modified) + ':' + String(row.size) : ''; }
  function held() {
    var I = F() && F().icons;
    var rows = I && window.spirit.data.rowsOf ? window.spirit.data.rowsOf(I.branch) || [] : [];
    if (!rows.length) return null;
    var set = {};
    rows.forEach(function (r) { set[r.glyph || r.key] = Array.isArray(r.keywords) ? r.keywords : []; });
    return set;
  }
  function load() {
    if (reading) return reading;
    // Through the spirit object (goal/G32.2).
    var stamp = '';
    reading = Promise.resolve(cache).then(function () { stamp = F() ? stampOf(F().file(SET)) : ''; return spirit.ready; }).then(function (s) { return s.fs.loadFile(SET); }).then(function (text) {
      reading = null;
      readStamp = stamp;
      var set = JSON.parse(text);
      if (!set || typeof set !== 'object') return {};
      F().icons.keep(set);
      return set;
    }).catch(function () { reading = null; return {}; });
    return reading;
  }
  function readSet() { return Promise.resolve(cache).then(function () { return held() || load(); }, function () { return {}; }); }

  function create(host, opts) {
    var o = opts || {};
    var list = null;
    var off = null;
    var gone = false;
    var made = {
      value: '', row: null,
      refresh: function () { if (list) list.refresh(); },
      redraw: function () { if (list) list.redraw(); },
      // The file read again, into the fs cache, whose branch the list draws.
      reload: function () { return load(); },
      destroy: function () { gone = true; if (off) off(); off = null; if (list) list.destroy(); list = null; },
    };
    Promise.resolve(cache).then(function () {
      if (gone || !F()) return;
      // WHAT IT LOADS, IT LISTENS FOR: the file's row, read again as it changes; and the tree, only for it coming back whole
      // after a reconnect (path ''), which forgot the set with everything else.
      var offRow = F().watch(SET, function (row) { if (row && (stampOf(row) !== readStamp || !held())) load(); });
      var offTree = F().watch(function (p) { if (p === '' && !held()) load(); });
      off = function () { offRow(); offTree(); };
      make();
      if (!held()) load();
    }, function () { if (!gone) host.textContent = 'The icons could not be loaded.'; });
    function make() {
    list = E.spirit.element.search.create(host, {
      // Its own data source (goal/G43.24), which finds nothing: the rows are the fs cache's icons branch.
      search: function () { return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); },
      server: 'fs',
      verb: 'search',
      data: F().icons.branch,
      face: o.face,
      visible: typeof o.visible === 'function' ? o.visible : undefined,
      placeholder: o.placeholder || 'choose an icon…',
      all: o.all,
      name: function (row) { return String(row.glyph || '') + ' ' + String((row.keywords || [])[0] || ''); },
      columns: [
        { field: 'glyph', label: '' },
        { field: 'keywords', label: 'Keywords' },
      ],
      element: function (row, key) { return E.spirit.element.search.icon.rowElement.create(Object.assign({ glyph: key }, row)); },
      pick: function (row, key) { made.value = key; made.row = row; if (typeof o.pick === 'function') o.pick(row, key); },
      details: typeof o.details === 'function' ? function (row, key) { o.details(row, key); } : undefined,
      empty: o.empty || 'No icon matches.',
    });
    list.refresh();
    }
    return made;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/icon/listElement.js', { create: create, set: readSet, SET: SET }); });
}());
