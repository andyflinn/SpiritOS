// spirit/run/shell/js/bundleSelector/listElement.js
// THE BUNDLE LIST, A DROP-IN SHELL ELEMENT (goal/G41.14). Andy, box: "both new auth/bundle tables receive Selector shell
// elements, these shell elements must follow the design pattern of the contactSelector, with a sibling folder for a
// listElement.js and a rowElement.js script to fit within the probabilitySearch framework", "bundleSelector.js and
// bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and selecting bundle rows." The grants
// app draws it as a dropdown; the bundle editor as a pane whose rows edit their label in place.
//
//   create(host, opts) -> { list, refresh(), destroy() }; list.value and list.row are the one picked in a dropdown
//     opts.face, opts.placeholder, opts.all, opts.pick(row, key)   as probabilitySearch's
//     opts.columns   the row's fields it shows, in order, of label, edit and delete; label alone by default
//     opts.editable  each row edits its label in place (the editor's pane)
//     opts.api       the app's shell api, handed to each row for its are-you-sure
//     opts.empty     the words when nothing matches
// A VIEW OF data.bundles (goal/G41.14; Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their
// data set"): auth.bundle's search seats its rows there, and the node's stream keeps them current through the bundle
// row element (./rowElement.js, the type's own), so a bundle added, renamed or deleted anywhere shows in every list.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) ['shell/js/probabilitySearch.js', 'shell/js/bundleSelector/rowElement.js'].forEach(function (p) { window.spirit.require(p); });
  var COLUMNS = {
    label: { field: 'label', label: 'Bundle', sort: 'text' },
    edit: { field: 'edit', label: '' },
    delete: { field: 'delete', label: '' },
  };

  function create(host, opts) {
    var o = opts || {};
    var list = null;
    // THE SOURCE: auth.bundle's search, the text trimmed, answered as a reply.
    function search(args) {
      var text = String((args && args.text) || '').trim();
      return spirit.ready.then(function (s) { return s.auth.bundle({ op: 'search', text: text }); }).then(function (got) {
        return { status: 200, body: { ok: true, items: (got && got.items) || [], more: !!(got && got.more) } };
      });
    }
    var names = Array.isArray(o.columns) && o.columns.length ? o.columns : ['label'];
    list = window.spirit.elements.probabilitySearch.create(host, {
      api: { verb: function (name, args) { return search(args); } },
      data: 'bundles',
      server: 'auth',
      verb: 'bundle',
      face: o.face,
      placeholder: o.placeholder || 'choose a bundle…',
      all: o.all,
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      args: function (text) { return { text: text }; },
      columns: names.map(function (n) { return COLUMNS[n]; }).filter(Boolean),
      element: function (row, key) {
        return window.spirit.elements.bundleElement.create(row, { editable: o.editable === true, api: o.api });
      },
      // A pick shows the bundle's label, never its number (Andy: "the bundleSelector shows a fucking number is selected
      // instead of the fucking label"); the number is hidden (box: "a hidden numeric key").
      name: function (row) { return String((row && row.label) || ''); },
      // Matched on its label alone.
      matched: function (row) { return { label: String((row && row.label) || '') }; },
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

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.bundleList = { create: create };
}());
