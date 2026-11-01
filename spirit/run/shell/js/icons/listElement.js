// spirit/run/shell/js/icons/listElement.js
// THE ICONS LIST, A DROP-IN SHELL ELEMENT (goal/G30.21): the Icons app's set (relay-state/shell/icons/iconSet.json, else shell/json/iconSet.json, each glyph with
// the keywords it is found by) on the standard list-tool (shell/js/probabilitySearch.js), each row an iconElement. The
// Icons app draws it as a pane; the Apps panel's icon field as a dropdown. Words are matched against the glyph and its
// keywords. A
// pick hands over the glyph itself, never a key into a table.
//
// No data.js: the set is one file. It is read once, and again when the Files cache says it changed.
//
//   create(host, opts) -> the list (value, row, words(), refresh(), redraw(), destroy(), reload())
//     opts.api           the app's shell api (verb), to read the set
//     opts.face          'pane' or 'dropdown'
//     opts.placeholder, opts.all, opts.empty
//     opts.pick(row, glyph)   an icon chosen; row { glyph, keywords }
//     opts.details(row, glyph)   a pane's press, when the app opens the icon itself
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: each icon it lists is the icon element (shell/js/icon.js), which its rows paint through.
  if (window.spirit.require) ['shell/js/icons/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/icon.js'].forEach(function (p) { window.spirit.require(p); });
  // The owner's own set, out of git; the system set until he has one (goal/G40.8, shell/icons/icons.js says why).
  var SET = 'relay-state/shell/icons/iconSet.json';
  var SYSTEM_SET = 'shell/json/iconSet.json';

  // THE ICON SET IN spirit.data (goal/G41.28; Andy, box v15: "If its rows are NOT cached in the proper place, with the shells
  // one and only spirit.data object, then that must be fixed, too."): kept by the fs family's cache manager, the set
  // being a file the family serves (spirit.fsData.icons, glyph -> its row), loaded with this element. A set read again
  // replaces it whole: a glyph the set no longer has leaves it.
  window.spirit.cacheManager('fs');
  function fsData() { return (window.spirit && window.spirit.fsData) || null; }
  function keepSet(set) { var F = fsData(); if (F) F.icons.keep(set); }

  function create(host, opts) {
    var o = opts || {};
    var list = null;
    function reload() {
      // Through the spirit object (goal/G32.2).
      return spirit.ready.then(function (s) { return s.fs.loadFile(SET).then(function (own) { return own != null ? own : s.fs.loadFile(SYSTEM_SET); }); }).then(function (text) {
        var set = {};
        try { set = JSON.parse(text || '{}'); } catch (e) { set = {}; }
        keepSet(set);
        return set;
      }, function () { keepSet({}); return {}; });
    }
    list = E.probabilitySearch.create(host, {
      api: { verb: function () { return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); } },
      server: 'fs',
      verb: 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose an icon…',
      all: o.all,
      name: function (row) { return String(row.glyph || '') + ' ' + String((row.keywords || [])[0] || ''); },
      // A view of the icon set's branch: what keepSet writes, it draws.
      data: fsData().icons.branch,
      columns: [
        { field: 'glyph', label: '' },
        { field: 'keywords', label: 'Keywords' },
      ],
      element: function (row, key) { return E.iconElement.create(Object.assign({ glyph: key }, row)); },
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      details: typeof o.details === 'function' ? function (row, key) { o.details(row, key); } : undefined,
      empty: o.empty || 'No icon matches.',
    });
    // The set written again (by the Icons app, or anyone): read again.
    var unwatch = fsData() ? fsData().watchFile(SET, function () { reload(); }) : null;
    var destroy = list.destroy;
    list.destroy = function () { if (typeof unwatch === 'function') unwatch(); destroy(); };
    list.reload = reload;
    reload();
    return list;
  }

  E.iconList = { create: create, SET: SET };
}());
