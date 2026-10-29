// spirit/run/shell/js/branchSelector/listElement.js
// THE BRANCH LIST, A DROP-IN SHELL ELEMENT (goal/G41.14). Andy, box: "branchSelector.js and branchSelector/ folder,
// featuring a pane mode and a dropdown mode for displaying and selecting branch rows", "the branchSelector element will
// use the standard apiFamilySelector and apiVerbSelector elements as pickers for family and verb search filters", and
// "apiFamiliySelector.js will use apiVerbSelector as part of itself". So one family selector, its verb half with it,
// stands above the list as its filter; the verb half's hiding until a family is chosen is the family selector's own.
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.bundle    the bundle whose branches it lists (auth.branch's bundle filter); none: every bundle's
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's
//     opts.columns   the row's fields it shows, in order, of family, verb and delete; family and verb by default
//     opts.api       the app's shell api, handed to each row for its are-you-sure
//     opts.empty     the words when nothing matches
// Its rows are auth.branch's search, through the spirit object; nothing streams a branch, so a row's delete asks the
// list again.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/probabilitySearch.js', 'shell/js/branchSelector/rowElement.js', 'shell/js/apiFamilySelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  var COLUMNS = {
    family: { field: 'family', label: 'Family', sort: 'text' },
    verb: { field: 'verb', label: 'Verb', sort: 'text' },
    delete: { field: 'delete', label: '' },
  };

  function create(host, opts) {
    var o = opts || {};
    var E = window.spirit.elements;
    var list = null;
    // THE FILTER: the family selector, above the list.
    var filters = document.createElement('div');
    filters.className = 'branch-list-filters';
    var family = E.createApiFamilySelector({ all: 'every family' });
    filters.appendChild(family);
    host.appendChild(filters);
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
    list = E.probabilitySearch.create(box, {
      api: { verb: function (name, args) { return search(args); } },
      server: 'auth',
      verb: 'branch',
      face: o.face,
      placeholder: o.placeholder || 'choose a branch…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      columns: names.map(function (n) { return COLUMNS[n]; }).filter(Boolean),
      element: function (row) { return E.branchElement.create(row, { api: o.api, changed: function () { list.refresh(); } }); },
      // Matched on its family and verb alone: its numbers are hidden.
      matched: function (row) { return { family: String((row && row.family) || ''), verb: String((row && row.verb) || '') }; },
      empty: o.empty || 'No branch matches.',
    });
    family.addEventListener('change', function () { list.refresh(); });
    list.refresh();
    return {
      list: list,
      refresh: function () { list.refresh(); },
      destroy: function () { list.destroy(); },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // Its parts are loaded first, so a caller that requires this file and waits finds them all on the page.
  window.spirit.elements.branchList = { create: create, ready: parts };
}());
