// spirit/run/shell/js/appServerSelector.js
// ONE SHELL ELEMENT: the app-server selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spiritElements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// Loaded by index.html before the shell, on the globals every shell script
// has (spirit, document, window.spiritIconIndex, window.spiritApiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.

(function () {
  var escapeHtml = spirit.core.util.escapeHtml;

  // ── THE APPSERVER SELECTOR (apiAuth/G1.8) ──────────────────────────
  //
  //   Andy: "the appServer selector (a subComponent of the api-path
  //   selector)", and the tree it reads: "the shell's api tree is a
  //   straight copy of the node's owner-api-tree ?" — "yes". So it fills
  //   itself from the node verb jobs.api with ask 'api', and lists
  //   spiritApiTreeIndex.servers(tree): sorted, a server that did not
  //   answer left out (apiTreeIndex.js decides; this paints).
  //
  // ON THE SHARED LIST (goal/G29.7): a dropdown of shellCreateListSearch, as the contact selector is, never a native
  // select. options.all names a first row with value '' (Grants: unchosen means every server).
  //
  // root.value is the chosen server's name; root.tree the 'api' answer
  // it was painted from, so the api-branch selector (G1.9) can read one
  // server's verbs without asking again. The root fires a bubbling
  // `change` once value is set, as the other selectors do.
  function createAppServerSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'app-server-selector' + (options.className ? ' ' + options.className : '');
    var host = document.createElement('span');
    root.appendChild(host);
    root.value = '';
    root.tree = null;

    function rows() {
      var names = root.tree ? window.spiritApiTreeIndex.servers(root.tree) : [];
      var out = names.map(function (name) { return { key: name, name: name }; });
      if (options.all) out.unshift({ key: '', name: String(options.all) });
      return out;
    }
    var list = window.spiritElements.shellCreateListSearch(host, {
      mode: 'dropdown',
      placeholder: options.placeholder || 'choose a server…',
      rows: rows,
      paint: function (row, mark) { return '<td style="white-space:nowrap">' + (typeof mark === 'function' ? mark(row.name) : escapeHtml(row.name)) + '</td>'; },
      name: function (row) { return row.name; },
      pick: function (row) {
        root.value = row.key || '';
        root.dispatchEvent(new Event('change', { bubbles: true }));
      },
      empty: 'No server matches.',
    });

    spirit.core.ask('jobs.api', { ask: 'api' }).then(function (a) {
      root.tree = (a && a.body) || null;
      list.redraw();
      root.dispatchEvent(new Event('tree', { bubbles: false }));
    }, function () { /* the list stays empty; the node says why elsewhere */ });
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createAppServerSelector = createAppServerSelector;
})();
