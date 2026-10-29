// spirit/run/shell/js/grantSelector/listElement.js
// THE GRANT LIST, A DROP-IN SHELL ELEMENT (goal/G41.14), OF WHICHEVER GRANTS TABLE ITS CALLER HANDS IT (goal/G41.16;
// Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel
// element"): the grants as a pane, each row a grant row element (./rowElement.js) with its Revoke. It names no table.
//
//   create(host, opts) -> { list, refresh(), destroy() }
//     opts.grants    the grants table, required: { branch, key, label, search(text) -> { items, more }, revoke, stream },
//                    handed on to each row as it is
//     opts.filters   the page's filters, handed to probabilitySearch as they are
//     opts.serves(path)  handed to each row: a path no server serves today reads deprecated
//     opts.api       the app's shell api, handed to each row for its are-you-sure
//     opts.empty     the words when nothing matches
// A VIEW OF ITS TABLE'S BRANCH (Andy: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"): the table's
// search seats its rows there, and the stream keeps them current through the grant row element, so one grant appears
// or goes and nothing is read again.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) ['shell/js/probabilitySearch.js', 'shell/js/grantSelector/rowElement.js'].forEach(function (p) { window.spirit.require(p); });

  function create(host, opts) {
    var o = opts || {};
    var g = o.grants;
    if (!g || !g.branch || !g.key || !g.label || typeof g.search !== 'function') {
      throw new Error('grantList: a grants table is required ({ branch, key, label, search, revoke, stream })');
    }
    // THE SOURCE: the table's search, the text trimmed, answered as a reply.
    function search(args) {
      var text = String((args && args.text) || '').trim();
      return Promise.resolve(g.search(text)).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var list = window.spirit.elements.probabilitySearch.create(host, {
      api: { verb: function (name, args) { return search(args); } },
      data: String(g.branch),
      server: 'table',
      verb: 'search',
      face: 'pane',
      args: function (text) { return { text: text }; },
      columns: [
        { field: 'name', label: 'Whose', sort: 'text' },
        { field: 'path', label: 'Path', sort: 'text' },
        { field: 'revoke', label: '' },
      ],
      element: function (row) { return window.spirit.elements.grantElement.create(row, { grants: g, api: o.api, serves: o.serves }); },
      // Matched on whose grant it is, the table's label field, and the words of its path, never the id.
      matched: function (row) { return { name: String((row && row[g.label]) || ''), path: String((row && row.path) || '').split('.').join(' ') }; },
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
