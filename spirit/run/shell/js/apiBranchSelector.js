// spirit/run/shell/js/apiBranchSelector.js
// ONE SHELL ELEMENT: the api-branch selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.elements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// On the globals every shell script has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.
//
// Built from its two halves, which it loads itself (goal/G41.5; Andy: "the Dropdowns for family and verb MUST be new or
// updated shell elements for those data types."): the family dropdown, the app-server selector, and the verb dropdown,
// apiVerbSelector. It only puts them side by side and joins their choices into one path.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its two halves.
  var parts = Promise.all(['shell/js/appServerSelector.js', 'shell/js/apiVerbSelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  // ── THE API-BRANCH SELECTOR (apiAuth/G1.9) ─────────────────────────
  //
  //   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the
  //   verb-dropdown selection chances automatically depending on the
  //   selection in the appServer-dropdown", and "the verb dropdown will have
  //   an option ( ** all verbs **)".
  //
  // Both halves are probabilitySearch dropdowns (the old shell's list search is forbidden on the face, goal/G40.8), never
  // native selects; the verb half shows only once a server is chosen (Andy: "[chose a verb, displayed only when a server
  // is chosen ]"). root.server is the chosen server ('' for none), root.verb the chosen verb ('' when none or all verbs
  // is chosen), and root.value the PATH a grant takes: 'app' when no single verb is chosen, 'app.verb' when one is, ''
  // with no server. options.all names the server half's first row (unchosen: every server). It fires a bubbling change.
  function createApiBranchSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'api-branch-selector' + (options.className ? ' ' + options.className : '');
    // SIDE BY SIDE (goal/G29.7; Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not
    // stacked"): the pair is one inline row in the line it stands in.
    root.style.display = 'inline-flex';
    root.style.alignItems = 'center';
    root.style.gap = '1em';
    root.server = '';
    root.verb = '';
    root.value = '';
    var servers = null;
    var verbs = null;

    function settle() {
      root.value = !root.server ? '' : root.verb ? root.server + '.' + root.verb : root.server;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function quiet(event) { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); }
    var made = parts.then(function () {
      var E = window.spirit.elements;
      servers = E.createAppServerSelector({ placeholder: options.serverPlaceholder, all: options.all, tree: options.tree });
      verbs = E.createApiVerbSelector({});
      root.appendChild(servers);
      root.appendChild(verbs);
      servers.addEventListener('change', function (event) {
        quiet(event);
        if (servers.value === root.server) return;
        root.server = servers.value || '';
        root.verb = '';
        verbs.show(servers.tree, root.server);
        settle();
      });
      verbs.addEventListener('change', function (event) {
        quiet(event);
        root.verb = verbs.value || '';
        settle();
      });
      servers.addEventListener('tree', function () { root.tree = servers.tree; root.dispatchEvent(new Event('tree', { bubbles: false })); });
      root.servers = servers;
      root.verbs = verbs;
    });
    // A NEW PARTY'S TREE (goal/G30.5): the choice clears, the verb half hides, and root.tree is the tree once loaded.
    root.load = function (fn) {
      return made.then(function () {
        root.server = '';
        root.verb = '';
        verbs.show(null, '');
        settle();
        return servers.load(fn);
      });
    };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createApiBranchSelector = createApiBranchSelector;
})();
