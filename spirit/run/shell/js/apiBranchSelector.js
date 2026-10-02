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
  // The appServer selector (G1.8) inside it; the verbs of the chosen server
  // from spiritApiTreeIndex.verbs, refilled when the server changes. root.value
  // is the PATH a grant takes: 'app' when all verbs is chosen, 'app.verb'
  // otherwise, '' until both are chosen. It fires a bubbling change once set.
  function createApiBranchSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'api-branch-selector' + (options.className ? ' ' + options.className : '');
    var servers = window.spiritElements.createAppServerSelector({ placeholder: options.serverPlaceholder });
    var verbSelect = document.createElement('select');
    root.appendChild(servers);
    root.appendChild(verbSelect);
    root.value = '';
    var ALL = '** all verbs **';

    function paintVerbs() {
      var server = servers.value;
      var verbs = server ? window.spiritApiTreeIndex.verbs(servers.tree, server) : [];
      verbSelect.innerHTML = server
        ? '<option value="">choose a verb…</option><option value="*">' + escapeHtml('( ' + ALL + ' )') + '</option>' +
          verbs.map(function (v) { return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>'; }).join('')
        : '<option value="">choose a server first</option>';
    }
    function settle() {
      var server = servers.value;
      var verb = verbSelect.value;
      root.value = !server || !verb ? '' : verb === '*' ? server : server + '.' + verb;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The inner elements' changes stop here; the root speaks for the whole.
    servers.addEventListener('change', function (event) {
      if (event.stopPropagation) event.stopPropagation();
      paintVerbs();
      settle();
    });
    verbSelect.addEventListener('change', function (event) {
      if (event.stopPropagation) event.stopPropagation();
      settle();
    });
    paintVerbs();
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createApiBranchSelector = createApiBranchSelector;
})();
