// spirit/run/shell/js/appServerSelector.js
// ONE SHELL ELEMENT: the app-server selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.elements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// Loaded by index.html before the shell, on the globals every shell script
// has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.

(function () {
  var escapeHtml = spirit.escapeHtml;

  // ── THE APPSERVER SELECTOR (apiAuth/G1.8) ──────────────────────────
  //
  //   Andy: "the appServer selector (a subComponent of the api-path
  //   selector)", and the tree it reads: "the shell's api tree is a
  //   straight copy of the node's owner-api-tree ?" — "yes". So it fills
  //   itself from the verb api on the flat apiDoor (goal/G30.6), and lists
  //   spiritApiTreeIndex.servers(tree): sorted, a server that did not
  //   answer left out (apiTreeIndex.js decides; this paints).
  //   SINCE goal/G30.4 that answer is the whole flat table, the node's own
  //   families (fs, jobs, relay ...) beside the apps', so the picker lists
  //   every family the grant system sees (Andy, 2026-10-20: "the grant system
  //   looks at apiDoors whole damn table of families and verbs").
  //
  // ON THE SHARED LIST (goal/G29.7): a dropdown of shellCreateListSearch, as the contact selector is, never a native
  // select. options.all is what the field reads while nothing is chosen, and the dropdown's Clear sets it back
  // (Grants: unchosen means every server).
  //
  // root.value is the chosen server's name; root.tree the 'api' answer
  // it was painted from, so the api-branch selector (G1.9) can read one
  // server's verbs without asking again. The root fires a bubbling
  // `change` once value is set, as the other selectors do.
  function createAppServerSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'app-server-selector' + (options.className ? ' ' + options.className : '');
    // An input control stands inline, never a block of its own (goal/G29.7: server and verb side by side).
    root.style.display = 'inline-block';
    var host = document.createElement('span');
    root.appendChild(host);
    root.value = '';
    root.tree = null;

    function rows() {
      var names = root.tree ? window.spirit.apiTreeIndex.servers(root.tree) : [];
      var out = names.map(function (name) { return { key: name, name: name }; });
      return out;
    }
    var list = window.spirit.elements.shellCreateListSearch(host, {
      mode: 'dropdown',
      placeholder: options.placeholder || 'choose a server…',
      all: options.all,
      rows: rows,
      paint: function (row, mark) { return '<td style="white-space:nowrap">' + (typeof mark === 'function' ? mark(row.name) : escapeHtml(row.name)) + '</td>'; },
      name: function (row) { return row.name; },
      pick: function (row) {
        root.value = row ? row.key || '' : '';
        root.dispatchEvent(new Event('change', { bubbles: true }));
      },
      empty: 'No server matches.',
    });

    // ANY PARTY'S TREE (goal/G30.5): options.tree, a function answering a promise of the tree, lists another party's
    // families (introSpector: a peer node's, a relay's); root.load(fn) lists a new one and clears the choice. Without
    // it, this node's own, as before.
    root.load = function (fn) {
      root.value = '';
      root.tree = null;
      list.redraw();
      // The node's own api answer, through the spirit object (goal/G32.2).
      var got = typeof fn === 'function' ? fn() : spirit.ready.then(function (s) { return s.tree(); });
      return Promise.resolve(got).then(function (tree) {
        root.tree = tree && typeof tree === 'object' ? tree : null;
        list.redraw();
        root.dispatchEvent(new Event('tree', { bubbles: false }));
      }, function () { /* the list stays empty; the node says why elsewhere */ });
    };
    root.load(options.tree);
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createAppServerSelector = createAppServerSelector;
})();
