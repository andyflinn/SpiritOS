// spirit/run/shell/js/bundleSelector.js
// ONE SHELL ELEMENT: the bundle selector, the bundle picker apps build their screens with (goal/G41.13; Andy, box v7:
// "A standard bundleSelector element picks one bundle, beside the shell's other selectors"). Its contract and its test:
// ./test/bundleSelector.md and ./test/bundleSelector.js.
//
// A THIN WRAPPER AROUND THE SHARED LIST, as the contact selector is (shell/js/contactSelector.js): the search, its cache,
// its ranking and its one request on the wire are shellCreateListSearch's; this file says only what a bundle row is.
// Its rows are the node's bundles, auth.bundle { op: 'search', text } through the spirit object, each keyed by the
// bundle's id, its label the bundle as auth.bundle get shows it: { id, label, description, paths }.
//
//   spirit.elements.createBundleSelector(options) -> root
//     root.value   the chosen bundle's id, '' while none is
//     root.row     the chosen bundle, its paths with it (what the grants app grants from), null while none is
//     one bubbling `change` on a pick; refresh() asks again
//     options.face 'pane' is the list itself; the default is the shared list's dropdown
(function () {
  var escapeHtml = spirit.escapeHtml;

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

    function paint(row, mark) {
      var m = typeof mark === 'function' ? mark : escapeHtml;
      return '<td class="label-cell">' + m(row.label || row.key) + '</td>';
    }
    function pick(row) {
      root.value = row ? row.key : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // THE ROWS' SOURCE, as the list's api: the node's auth.bundle search, through the spirit object.
    var api = {
      verb: function (name, body) {
        var text = String((body && body.text) || '');
        return spirit.ready.then(function (s) { return s.auth.bundle({ op: 'search', text: text }); }).then(function (answer) {
          var items = ((answer && answer.items) || []).filter(function (i) { return i && i.key; }).map(function (i) {
            return { key: String(i.key), label: JSON.stringify(parseRow(i)) };
          });
          return { status: 200, body: { items: items, more: !!(answer && answer.more) } };
        });
      },
    };
    var list = window.spirit.elements.shellCreateListSearch(pane, {
      mode: isPane ? 'pane' : 'dropdown',
      placeholder: isPane ? '' : (options.placeholder || 'choose a bundle…'),
      all: isPane ? undefined : options.all,
      api: api,
      server: 'auth',
      verb: 'bundle',
      args: function (text) { return { text: text }; },
      paint: paint,
      pick: function (row) { pick(row); },
      empty: options.empty || 'No bundle matches.',
    });

    root.refresh = function () { list.refresh(); };
    list.refresh();
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createBundleSelector = createBundleSelector;
})();
