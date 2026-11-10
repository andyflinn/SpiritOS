'use strict';
// spirit/run/spirit/element/search/grant.js
// THE GRANT LIST, A DROP-IN SHELL ELEMENT (goal/G41.14), OF WHICHEVER GRANTS TABLE ITS CALLER HANDS IT (goal/G41.16;
// Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel
// element"): the grants as a pane, each row a grant row element (./rowElement.js) with its Revoke. It names no table.
//
//   create(host, opts) -> { list, refresh(), destroy() }
//     opts.grants    the grants table, required: { branch, key, label, search(text) -> { items, more }, revoke, watch },
//                    handed on to each row as it is (the note an unconfigured list draws still says stream)
//     opts.filters   the page's filters, handed to probabilitySearch as they are
//     opts.selectors the page's selectors, handed to probabilitySearch as they are, drawn in its 🪣 row
//     opts.serves(path)  handed to each row: a path no server serves today reads deprecated
//     opts.empty     the words when nothing matches
// A VIEW OF ITS TABLE'S BRANCH (Andy: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"): the table's
// search seats its rows there, and the stream keeps them current through the table's family's cache manager (the
// node's grants: the auth family's, goal/G41.28), so one grant appears or goes and nothing is read again.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) ['spirit/element/search.js', 'spirit/element/search/grant/rowElement.js'].forEach(function (p) { window.spirit.require(p); });

  function create(host, opts) {
    var o = opts || {};
    var g = o.grants;
    // UNCONFIGURED, IT SAYS SO and throws nothing (goal/G41.19, box v23: "no throw even unconfigured").
    if (!g || !g.branch || !g.key || !g.label || typeof g.search !== 'function') {
      var note = document.createElement('div');
      note.className = 'job-manifest-note';
      note.textContent = 'not configured: a grants table is required ({ branch, key, label, search, revoke, stream })';
      host.appendChild(note);
      return { list: null, refresh: function () {}, destroy: function () { host.innerHTML = ''; } };
    }
    // THE SOURCE: the table's search, the text trimmed, answered as a reply.
    function search(args) {
      var text = String((args && args.text) || '').trim();
      return Promise.resolve(g.search(text)).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var list = window.spirit.element.spirit.element.search.create(host, {
      // Its own data source (goal/G43.24): the search asks it, and is handed no api.
      search: search,
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
      element: function (row) { return window.spirit.element.spirit.element.search.grant.rowElement.create(row, { grants: g, serves: o.serves }); },
      filters: o.filters,
      selectors: o.selectors,
      empty: o.empty || 'No grant matches.',
    });
    list.refresh();
    return {
      list: list,
      refresh: function () { list.refresh(); },
      destroy: function () { list.destroy(); },
    };
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/grant.js', { create: create }); });
}());
