'use strict';
// spirit/run/spirit/element/search/grant/list.js
// The list the grant selector, ../grant.js, draws (goal/G43.32: it was search/grant.js). Its test: ../test/grant.js, through the selector.
// THE GRANT LIST, A DROP-IN SHELL ELEMENT (goal/G41.14), OF WHICHEVER GRANTS TABLE ITS CALLER HANDS IT (goal/G41.16;
// Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel
// element"): the grants as a pane, each row a grant row element (./row.js) with its Revoke. It names no table.
//
//   create(host, opts) -> { list, refresh(), destroy() }
//     opts.grants    the grants table, required: { branch, key, label, search(text) -> { items, more }, revoke, watch },
//                    handed on to each row as it is (the note an unconfigured list draws still says stream)
//     opts.filters   the page's filters, handed to probabilitySearch as they are
//     opts.selectors the page's selectors, handed to probabilitySearch as they are, drawn in its 🪣 row
//     opts.empty     the words when nothing matches
//     opts.face      'dropdown' a closed field opening to the same list (box v123: "every search supports both pane and
//                    dropdown"); anything else, the pane it always was. opts.placeholder and opts.pick(row, key), the dropdown's,
//                    as probabilitySearch's
// A VIEW OF ITS TABLE'S BRANCH (Andy: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"): the table's
// search seats its rows there, and the stream keeps them current through the table's family's cache manager (the
// node's grants: the auth family's, goal/G41.28), so one grant appears or goes and nothing is read again.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) ['spirit/element/search.js', 'spirit/element/search/grant/row.js'].forEach(function (p) { window.spirit.require(p); });

  function create(host, opts) {
    var o = opts || {};
    var g = o.grants;
    // UNCONFIGURED, IT SAYS SO and throws nothing (goal/G41.19, box v23: "no throw even unconfigured").
    if (!g || !g.branch || !g.key || !g.label || typeof g.search !== 'function') {
      var note = document.createElement('div');
      note.className = 'job-manifest-note';
      // Its box keeps its words inside (spirit-sibling-browser.js: overflow not visible).
      note.style.overflow = 'hidden';
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
    var list = window.spirit.required.spirit.element.search.create(host, {
      // Its own data source (goal/G43.24): the search asks it, and is handed no api.
      search: search,
      data: String(g.branch),
      server: 'table',
      verb: 'search',
      face: o.face === 'dropdown' ? 'dropdown' : 'pane',
      placeholder: o.placeholder || 'choose a grant…',
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      columns: [
        { field: 'name', label: 'Whose', sort: 'text' },
        { field: 'path', label: 'Path', sort: 'text' },
        // AT THE RIGHT EDGE, OF A FIXED WIDTH (goal/G47.4; Andy: "can you make the revoke-button column stick to the right
        // edge so the button doesn't jump out my way when i try to revoke haiku's grants?"): a row going away moves no Revoke.
        { field: 'revoke', label: '', width: '6em', align: 'right' },
      ],
      element: function (row) { return window.spirit.required.spirit.element.search.grant.row.create(row, { grants: g }); },
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

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/grant/list.js', { create: create }); });
}());
