'use strict';
// spirit/run/spirit/element/search/bundle/list/script.js
// THE BUNDLE LIST, A DROP-IN SHELL ELEMENT (goal/G41.14). Andy, box: "both new auth/bundle tables receive Selector shell
// elements, these shell elements must follow the design pattern of the contactSelector, with a sibling folder for a
// list.js and a row.js script to fit within the probabilitySearch framework", "bundleSelector.js and
// bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and selecting bundle rows." The grants
// app draws it as a dropdown; the bundle editor as a pane, its labels shown only (goal/G41.26).
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's
//     opts.columns   the row's fields it shows, in order, of label and owner; both by default
//     opts.family    an app server's name: it lists the bundles that server owns alone (goal/G41.25)
//     opts.empty     the words when nothing matches
// A VIEW OF THE NODE'S BUNDLES (goal/G41.14, G41.28; Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their
// data set"): spirit.bundle.search seats its rows there, and the node's stream keeps them current through the bundle
// branch's cache manager (spirit/bundle/client/script.js), so a bundle added, renamed or deleted anywhere shows in every list.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/bundle/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/bundle/row/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  if (window.spirit.requireScript) ['spirit/element/search/script.js', 'spirit/element/search/bundle/row/script.js'].forEach(function (p) { window.spirit.requireScript(p); });
  // And the auth family's cache manager, whose bundles branch the list is a view of (goal/G41.28).
  window.spirit.requireScript('spirit/bundle/script.js');
  var COLUMNS = {
    label: { field: 'label', label: 'Bundle', sort: 'text' },
    owner: { field: 'owner', label: 'Owner', sort: 'text' },
  };

  function create(host, opts) {
    var o = opts || {};
    var list = null;
    // MADE FOR AN APP SERVER, THAT SERVER'S BUNDLES ALONE (goal/G41.25; Andy, box: "if the bundleSelector is not
    // configured for an appServer, the bundleSelector will show/search ALL/ANY bundles", and "if the bundleSelector IS
    // configured for an appServer, then it will only list bundles \"owned\" by that Appserver"): the node is asked for
    // them, and of the bundles the page holds only that owner's are offered.
    var family = typeof o.family === 'string' && o.family ? o.family : '';
    // THE SOURCE: spirit.bundle.search, the text trimmed, answered as a reply.
    function search(args) {
      var text = String((args && args.text) || '').trim();
      var ask = family ? { text: text, owner: family } : { text: text };
      return spirit.readyPromise.then(function () { return spirit.requireScript('spirit/bundle/script.js'); }).then(function (s) { return s.search(ask); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var names = Array.isArray(o.columns) && o.columns.length ? o.columns : ['label', 'owner'];
    list = ANSWER['spirit/element/search/script.js'].create(host, {
      // Its own data source (goal/G43.24): the search asks it, and is handed no api.
      search: search,
      // A view of the node's bundles, the rows the bundle branch's manager keeps (spirit.required.spirit.data.bundle.data.branch).
      data: window.spirit.required.spirit.data.bundle.data.branch,
      api: 'spirit/bundle/script.js',
      verb: 'bundle',
      face: o.face,
      placeholder: o.placeholder || 'choose a bundle…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      // The owner's filter has no buttons (when: never); it is there only when the list was made for an app server.
      filters: family ? [{ name: 'owner', when: function () { return false; }, test: function (r) { return r && (r.owner || 'node') === family ? 1 : 0; } }] : [],
      columns: names.map(function (n) { return COLUMNS[n]; }).filter(Boolean),
      element: function (row, key) {
        return ANSWER['spirit/element/search/bundle/row/script.js'].create(row);
      },
      // A pick shows the bundle's label, never its number (Andy: "the bundleSelector shows a fucking number is selected
      // instead of the fucking label"); the number is hidden (box: "a hidden numeric key").
      name: function (row) { return String((row && row.label) || ''); },
      empty: o.empty || 'No bundle matches.',
    });
    list.refresh();
    return {
      list: list,
      refresh: function () { list.refresh(); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), its filters with it.
      destroy: function () { if (list) list.destroy(); host.innerHTML = ''; },
    };
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
