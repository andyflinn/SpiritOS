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
  // root.value is the chosen server's name; root.tree the 'api' answer
  // it was painted from, so the api-branch selector (G1.9) can read one
  // server's verbs without asking again. The root fires a bubbling
  // `change` once value is set, as the other selectors do.
  function createAppServerSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'app-server-selector' + (options.className ? ' ' + options.className : '');
    var select = document.createElement('select');
    root.appendChild(select);
    root.value = '';
    root.tree = null;

    function paint(names) {
      select.innerHTML = '<option value="">' + escapeHtml(options.placeholder || 'choose a server…') + '</option>' +
        names.map(function (name) { return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>'; }).join('');
    }
    paint([]);
    select.addEventListener('change', function (event) {
      // The root speaks for the element: its own change, once value is set.
      if (event.stopPropagation) event.stopPropagation();
      root.value = select.value || '';
      root.dispatchEvent(new Event('change', { bubbles: true }));
    });

    spirit.core.ask('jobs.api', { ask: 'api' }).then(function (a) {
      root.tree = (a && a.body) || null;
      paint(window.spiritApiTreeIndex.servers(root.tree));
    }, function () { /* the empty choice stays; the node says why elsewhere */ });
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createAppServerSelector = createAppServerSelector;
})();
