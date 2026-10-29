// spirit/run/shell/js/grantSelector/listElement.js
// THE GRANT LIST, A DROP-IN SHELL ELEMENT (goal/G41.14): the node's grants as a pane, each row a grant row element
// (./rowElement.js) with its Revoke. It lived inside the grants app; it is an element of its own with its test folder
// (Andy: "INCLUDING COMPLETE TEST FOLDER FOR THE COMPONENTS INVOLVED!!!!").
//
//   create(host, opts) -> { list, refresh(), destroy() }
//     opts.filters   the page's filters (the grants app's ID and family), handed to probabilitySearch as they are
//     opts.serves(path)  handed to each row: a path no server serves today reads deprecated
//     opts.api       the app's shell api, handed to each row for its are-you-sure
//     opts.empty     the words when nothing matches
// A VIEW OF data.grants (Andy: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"): auth.search seats its
// rows there, and the node's stream keeps them current through the grant row element, so one grant appears or goes and
// nothing is read again.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) ['shell/js/probabilitySearch.js', 'shell/js/grantSelector/rowElement.js'].forEach(function (p) { window.spirit.require(p); });

  function create(host, opts) {
    var o = opts || {};
    // THE SOURCE: auth.search, the text trimmed, answered as a reply.
    function search(args) {
      var text = String((args && args.text) || '').trim();
      return spirit.ready.then(function (s) { return s.auth.search({ text: text }); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var list = window.spirit.elements.probabilitySearch.create(host, {
      api: { verb: function (name, args) { return search(args); } },
      data: 'grants',
      server: 'auth',
      verb: 'search',
      face: 'pane',
      args: function (text) { return { text: text }; },
      columns: [
        { field: 'name', label: 'Whose', sort: 'text' },
        { field: 'path', label: 'Path', sort: 'text' },
        { field: 'revoke', label: '' },
      ],
      element: function (row) { return window.spirit.elements.grantElement.create(row, { api: o.api, serves: o.serves }); },
      // Matched on whose grant it is and the words of its path, never the key.
      matched: function (row) { return { name: String((row && (row.label || row.name)) || ''), path: String((row && row.path) || '').split('.').join(' ') }; },
      filters: o.filters,
      empty: o.empty || 'No grant matches.',
    });
    list.refresh();
    return {
      list: list,
      refresh: function () { list.refresh(); },
      destroy: function () { list.destroy(); },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.grantList = { create: create };
}());
