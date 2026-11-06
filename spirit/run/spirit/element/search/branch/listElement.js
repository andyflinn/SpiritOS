// spirit/run/spirit/element/search/branch/listElement.js
// THE BRANCH LIST, A DROP-IN SHELL ELEMENT (goal/G41.14). Andy, box: "branchSelector.js and branchSelector/ folder,
// featuring a pane mode and a dropdown mode for displaying and selecting branch rows", "the branchSelector element will
// use the standard apiFamilySelector and apiVerbSelector elements as pickers for family and verb search filters", and
// "apiFamiliySelector.js will use apiVerbSelector as part of itself". So one family selector, its verb half with it,
// is the list's filter, in its search's own 🪣 row (Andy, on G41.26: "any searchSelector in our system must go into the
// probabilitySearch's selectorRow, so that the user-can see, which elements belong to the search."); the verb half's hiding until a family is chosen is the family selector's own.
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.bundle    the bundle whose branches it lists (auth.branch's bundle filter); none: every bundle's
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's
//     opts.columns   the row's fields it shows, in order, of family, verb and delete; family and verb by default
//     opts.api       the app's shell api, handed to each row for its are-you-sure
//     opts.empty     the words when nothing matches
// A VIEW OF data.branches (goal/G41.14): auth.branch's search seats its rows there, and the node's stream keeps them
// current through the branch row element (./rowElement.js, the type's own), so a branch added or deleted anywhere shows
// in every list.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  // And the auth family's cache manager, whose branches branch the list is a view of (goal/G41.28).
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/search/branch/rowElement.js', 'spirit/element/search/api.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }).concat([window.spirit.cacheManager('auth')]));
  var COLUMNS = {
    family: { field: 'family', label: 'Family', sort: 'text' },
    verb: { field: 'verb', label: 'Verb', sort: 'text' },
    delete: { field: 'delete', label: '' },
  };

  function create(host, opts) {
    var o = opts || {};
    var E = window.spirit.element;
    var list = null;
    // THE FILTER: the family selector, made here and mounted by the search in its 🪣 row.
    var family = E.search.api.create(document.createElement('span'), { all: 'every family' });
    var box = document.createElement('div');
    box.className = 'fill';
    host.appendChild(box);

    // THE SOURCE: auth.branch's search, the text trimmed, narrowed by the bundle and by the filter's family and verb.
    function search(args) {
      var ask = { op: 'search', text: String((args && args.text) || '').trim() };
      if (o.bundle) ask.bundle = Number(o.bundle);
      if (family.family) ask.family = family.family;
      if (family.family && family.verb) ask.verb = family.verb;
      return spirit.ready.then(function (s) { return s.auth.branch(ask); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var names = Array.isArray(o.columns) && o.columns.length ? o.columns : ['family', 'verb'];
    list = E.search.create(box, {
      api: { verb: function (name, args) { return search(args); } },
      // A view of the node's branches, the branch the auth family's manager keeps (spirit.data.auth.data.branches.branch).
      data: window.spirit.data.auth.data.branches.branch,
      server: 'auth',
      verb: 'branch',
      face: o.face,
      placeholder: o.placeholder || 'choose a branch…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      columns: names.map(function (n) { return COLUMNS[n]; }).filter(Boolean),
      element: function (row) { return E.search.branch.rowElement.create(row, { api: o.api }); },
      // A pick shows the branch as family.verb, the family alone for (ALL), never its numbers.
      name: function (row) { return row ? (row.verb ? row.family + '.' + row.verb : row.family + ' (ALL)') : ''; },
      // THE VIEW HOLDS EVERY BRANCH THE PAGE KNOWS: this list shows its own bundle's, narrowed by the family selector, as
      // its search asks the node. The bundle's has no button: it always holds.
      filters: [
        { name: 'bundle', when: function () { return false; },
          test: function (row) { return !o.bundle || (row && Number(row.bundle) === Number(o.bundle)) ? 1 : 0; } },
      ],
      selectors: [
        { name: 'family', element: family,
          test: function (row) {
            if (!family.family) return 1;
            if (!row || row.family !== family.family) return 0;
            return !family.verb || row.verb === family.verb ? 1 : 0;
          } },
      ],
      empty: o.empty || 'No branch matches.',
    });
    family.addEventListener('change', function () { list.refresh(); });
    list.refresh();
    return {
      list: list,
      refresh: function () { list.refresh(); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), its filters with it.
      // Its family selector, in the 🪣 row, destroyed with it (goal/G41.28, rule/8).
      destroy: function () { if (list) list.destroy(); if (typeof family.destroy === 'function') family.destroy(); host.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // Its parts are loaded first, so a caller that requires this file and waits finds them all on the page.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'branch', 'listElement'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, window.spirit.element), { create: create, ready: parts });
}());
