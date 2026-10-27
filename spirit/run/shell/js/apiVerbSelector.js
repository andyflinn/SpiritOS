// spirit/run/shell/js/apiVerbSelector.js
// ONE SHELL ELEMENT: the verb dropdown, the verbs of one family of an api tree (goal/G41.5).
//
//   Andy, 2026-10-27: "the Dropdowns for family and verb MUST be new or updated shell elements for those data types.
//   including test folders." The family half is the app-server selector (shell/js/appServerSelector.js); this is the
//   verb half, and the api-branch selector (shell/js/apiBranchSelector.js) puts the two side by side.
//
// createApiVerbSelector(options) -> root, the control: root.value is the chosen verb, '' when none (its None reads all
// verbs and means every verb); a pick fires one bubbling `change`. root.show(tree, server) lists that family's verbs,
// apiTreeIndex.verbs, so DEBUG and DEPENDENCIES are never offered (Andy: "DEBUG/DEPENDENCIES are owner only and will
// never be offered to peerPost clients."); with no server it hides, lists nothing and clears the choice.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree....").
  var parts = Promise.resolve(window.spirit.require ? window.spirit.require('shell/js/probabilitySearch.js') : null);

  function createApiVerbSelector(options) {
    options = options || {};
    var root = document.createElement('span');
    root.className = 'api-verb-selector' + (options.className ? ' ' + options.className : '');
    root.hidden = true;
    root.value = '';
    var tree = null;
    var server = '';
    var list = { redraw: function () {} };

    function rows() {
      var verbs = server && tree ? window.spirit.apiTreeIndex.verbs(tree, server) : [];
      return verbs.map(function (v) { return { key: v, name: v }; });
    }
    // A PROBABILITYSEARCH DROPDOWN (the old shell's list search is forbidden on the face, goal/G40.8).
    parts.then(function () {
      list = window.spirit.elements.probabilitySearch.create(root, {
        face: 'dropdown',
        placeholder: options.placeholder || 'all verbs',
        all: 'all verbs',
        rows: rows,
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        pick: function (row, key) {
          root.value = row ? String(key || row.key || '') : '';
          root.dispatchEvent(new Event('change', { bubbles: true }));
        },
        empty: 'No verb matches.',
      });
    });
    root.show = function (t, s) {
      tree = t || null;
      server = String(s || '');
      root.value = '';
      root.hidden = !server;
      list.redraw();
    };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createApiVerbSelector = createApiVerbSelector;
})();
