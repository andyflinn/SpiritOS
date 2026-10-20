// spirit/run/shell/js/apiBranchSelector.js
// ONE SHELL ELEMENT: the api-branch selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spiritElements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// Loaded by index.html before the shell, on the globals every shell script
// has (spirit, document, window.spiritIconIndex, window.spiritApiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.
//
// Built from the app-server selector, reached through window.spiritElements, so
// index.html loads appServerSelector.js before this file.

(function () {
  var escapeHtml = spirit.core.util.escapeHtml;

  // ── THE API-BRANCH SELECTOR (apiAuth/G1.9) ─────────────────────────
  //
  //   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the
  //   verb-dropdown selection chances automatically depending on the
  //   selection in the appServer-dropdown", and "the verb dropdown will have
  //   an option ( ** all verbs **)".
  //
  // ON THE SHARED LIST (goal/G29.7): both halves are dropdowns of shellCreateListSearch, never native selects; the
  // verb half shows only once a server is chosen (Andy: "[chose a verb, displayed only when a server is chosen ]").
  // root.server is the chosen server ('' for none), root.verb the chosen verb ('' when none or all verbs is chosen),
  // and root.value the PATH a grant takes: 'app' when no single verb is chosen, 'app.verb' when one is, '' with no
  // server. options.all names the server half's first row (unchosen: every server). It fires a bubbling change.
  function createApiBranchSelector(options) {
    options = options || {};
    var ALL_VERBS = '*';   // kept for a pick that names all verbs; the dropdown's Clear means the same
    var root = document.createElement('div');
    root.className = 'api-branch-selector' + (options.className ? ' ' + options.className : '');
    var servers = window.spiritElements.createAppServerSelector({ placeholder: options.serverPlaceholder, all: options.all, tree: options.tree });
    var verbBox = document.createElement('span');
    verbBox.hidden = true;
    // SIDE BY SIDE (goal/G29.7; Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not
    // stacked"): the pair is one inline row in the line it stands in.
    root.style.display = 'inline-flex';
    root.style.alignItems = 'center';
    root.style.gap = '1em';
    root.appendChild(servers);
    root.appendChild(verbBox);
    root.server = '';
    root.verb = '';
    root.value = '';

    function verbRows() {
      var verbs = root.server ? window.spiritApiTreeIndex.verbs(servers.tree, root.server) : [];
      return verbs.map(function (v) { return { key: v, name: v }; });
    }
    var verbList = window.spiritElements.shellCreateListSearch(verbBox, {
      mode: 'dropdown',
      placeholder: 'all verbs',
      rows: verbRows,
      paint: function (row, mark) { return '<td style="white-space:nowrap">' + (typeof mark === 'function' ? mark(row.name) : escapeHtml(row.name)) + '</td>'; },
      name: function (row) { return row.name; },
      all: 'all verbs',
      pick: function (row) { root.verb = !row || row.key === ALL_VERBS ? '' : row.key; settle(); },
      empty: 'No verb matches.',
    });
    function settle() {
      root.value = !root.server ? '' : root.verb ? root.server + '.' + root.verb : root.server;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    servers.addEventListener('change', function (event) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      if (servers.value === root.server) return;
      root.server = servers.value || '';
      root.verb = '';
      verbBox.hidden = !root.server;
      verbList.redraw();
      settle();
    });
    // A NEW PARTY'S TREE (goal/G30.5): the choice clears, the verb half hides, and root.tree is the tree once loaded.
    root.load = function (fn) {
      root.server = '';
      root.verb = '';
      verbBox.hidden = true;
      verbList.redraw();
      settle();
      return servers.load(fn);
    };
    servers.addEventListener('tree', function () { root.tree = servers.tree; root.dispatchEvent(new Event('tree', { bubbles: false })); });
    root.servers = servers;
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createApiBranchSelector = createApiBranchSelector;
})();
