// spirit/run/shell/js/icons/listElement.js
// THE ICONS LIST, A DROP-IN SHELL ELEMENT (goal/G30.21): the Icons app's set (shell/icons/iconSet.json, each glyph with
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
  var E = window.spiritElements = window.spiritElements || {};
  var SET = 'shell/icons/iconSet.json';

  function create(host, opts) {
    var o = opts || {};
    var rows = [];
    var list = null;
    function reload() {
      return Promise.resolve(o.api.verb('fs.load', { path: SET })).then(function (r) {
        var set = {};
        try { set = JSON.parse((r && r.body && r.body.text) || '{}'); } catch (e) { set = {}; }
        rows = Object.keys(set).map(function (g) { return { key: g, glyph: g, keywords: Array.isArray(set[g]) ? set[g] : [] }; });
        if (list) list.redraw();
        return set;
      }, function () { rows = []; if (list) list.redraw(); return {}; });
    }
    list = E.probabilitySearch.create(host, {
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
      element: function (row, key) { return E.iconElement.create(Object.assign({ glyph: key }, row)); },
      // The icon itself is searched too (Andy: "it doesn't search the icon itself"): pasted glyphs find their rows.
      matched: function (row) { return { glyph: String(row.glyph || ''), keywords: (row.keywords || []).join(' ') }; },
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      details: typeof o.details === 'function' ? function (row, key) { o.details(row, key); } : undefined,
      empty: o.empty || 'No icon matches.',
    });
    // The set written again (by the Icons app, or anyone): read again.
    var unwatch = window.spiritData ? window.spiritData.watch('files/' + SET, function () { reload(); }) : null;
    var destroy = list.destroy;
    list.destroy = function () { if (typeof unwatch === 'function') unwatch(); destroy(); };
    list.reload = reload;
    reload();
    return list;
  }

  E.iconList = { create: create, SET: SET };
}());
