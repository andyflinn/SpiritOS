// spirit/run/shell/js/bundleSelector.js
// ONE SHELL ELEMENT: the bundle selector, the bundle picker apps build their screens with (goal/G41.13; Andy, box v7:
// "A standard bundleSelector element picks one bundle, beside the shell's other selectors"). Its contract and its test:
// ./test/bundleSelector.md and ./test/bundleSelector.js.
//
// A THIN WRAPPER AROUND THE SHELL'S STANDARD LIST, probabilitySearch (shell/js/probabilitySearch.js), WHICH IT LOADS
// ITSELF (rule/26, Andy: "every shell element loads its own elements dynamically through the fucking apirit.require
// functionality", and "there will be NOTHING pre-loaded after the relays-supplied boot scripts"): never the old shell's
// list search, which the face does not load (goal/G40.8). Its rows are the node's bundles, auth.bundle
// { op: 'search', text } through the spirit object, each keyed by the bundle's id, its label the bundle as auth.bundle get
// shows it: { id, label, description, paths }.
//
//   spirit.elements.createBundleSelector(options) -> root
//     root.value   the chosen bundle's id, '' while none is
//     root.row     the chosen bundle, its paths with it (what the grants app grants from), null while none is
//     one bubbling `change` on a pick; refresh() asks again
//     options.face 'pane' is the list itself; the default is the dropdown, the chosen bundle's label in a closed field
(function () {
  function parseRow(item) {
    var row = null;
    try { row = JSON.parse(item && item.label); } catch (e) { row = null; }
    if (!row || typeof row !== 'object') row = { label: '' };
    row.key = String((item && item.key) || '');
    if (!Array.isArray(row.paths)) row.paths = [];
    return row;
  }

  function createBundleSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var root = document.createElement('div');
    root.className = 'bundle-selector ' + (isPane ? 'bundle-selector-face-pane' : 'bundle-selector-face-dropdown') +
      (options.className ? ' ' + options.className : '');
    root.value = '';
    root.row = null;
    var pane = document.createElement('div');
    pane.className = 'bundle-selector-pane';
    root.appendChild(pane);
    var list = null;

    function pick(row) {
      root.value = row ? row.key : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // THE ROWS' SOURCE, as the list's api: the node's auth.bundle search, through the spirit object.
    var api = {
      verb: function (name, body) {
        var text = String((body && body.text) || '');
        return Promise.resolve(window.spirit.ready).then(function (s) { return s.auth.bundle({ op: 'search', text: text }); }).then(function (answer) {
          var items = ((answer && answer.items) || []).filter(function (i) { return i && i.key; }).map(function (i) {
            return { key: String(i.key), label: JSON.stringify(parseRow(i)) };
          });
          return { status: 200, body: { items: items, more: !!(answer && answer.more) } };
        });
      },
    };
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(window.spirit.require ? window.spirit.require('shell/js/probabilitySearch.js') : null).then(function () {
      list = window.spirit.elements.probabilitySearch.create(pane, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a bundle…'),
        all: isPane ? undefined : options.all,
        api: api,
        server: 'auth',
        verb: 'bundle',
        args: function (text) { return { text: text }; },
        columns: [{ field: 'label', label: 'Bundle', sort: 'text' }],
        name: function (row) { return String((row && (row.label || row.key)) || ''); },
        pick: function (row) { pick(row); },
        empty: options.empty || 'No bundle matches.',
      });
      list.refresh();
    });

    root.refresh = function () { if (list) list.refresh(); };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createBundleSelector = createBundleSelector;
})();
