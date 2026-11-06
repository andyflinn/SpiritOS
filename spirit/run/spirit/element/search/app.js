// spirit/run/spirit/element/search/app.js
// THE APP LIST, A DROP-IN ELEMENT (goal/G43.2), as spirit/element/search/bundle/listElement.js is the bundle list: the
// probabilitySearch the selector draws. Its contract and its test: ./test/listElement.md and ./test/listElement.js.
//
//   create(host, opts) -> { list, refresh(), destroy() }; opts.face, opts.pick(row, key)
//
// A VIEW OF THE app FAMILY'S CACHE (spirit.data.app.data): app.search seats its rows there, and the node's stream keeps them
// current through the family's manager and the row element.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  ['spirit/element/search.js', 'spirit/element/search/app/rowElement.js'].forEach(function (p) { window.spirit.require(p); });
  window.spirit.cacheManager('app');

  function create(host, opts) {
    var o = opts || {};
    // THE SOURCE: app.search, with a search string and nothing more (Andy, box: "no filters, just a search string").
    function search(args) {
      var q = String((args && args.text) || '').trim();
      return spirit.ready.then(function (s) { return s.app.searchApp({ q: q }); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var list = window.spirit.element.search.create(host, {
      api: { verb: function (name, args) { return search(args); } },
      data: window.spirit.data.app.data.branch,
      server: 'app',
      verb: 'search',
      face: o.face,
      toggle: o.toggle === true,
      onFace: o.onFace,
      visible: o.visible,
      placeholder: 'choose an app…',
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      // Andy, box: "the appSelector will only show icon and label in the list."
      // Andy, box: "with the (de)activate buttons at the end of each row", which a dropdown has no room for.
      columns: [{ field: 'icon', label: '' }, { field: 'label', label: 'App', sort: 'text' }].concat(o.face === 'dropdown' ? [] : [{ field: 'active', label: '' }]),
      element: function (row) { return window.spirit.elements.search.app.rowElement.create(row); },
      name: function (row) { return String((row && row.label) || ''); },
      empty: 'No app matches.',
    });
    list.refresh();
    // A CONNECT FORGETS WHAT IS KEPT (spirit/data.js's forget, goal/G41.3). A face with no star hears no 'apps' job to fill it
    // again (spirit/app.js), so a forgotten branch, told with no row, asks again, or its list would stay empty.
    var off = window.spirit.data.app.data.watch(function (key) { if (!key) list.refresh(); });
    return {
      list: list,
      refresh: function () { list.refresh(); },
      // Destroy leaves its host empty, as every list, and lets its watch go.
      destroy: function () { off(); list.destroy(); host.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'app'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, window.spirit.element), { create: create });
}());
