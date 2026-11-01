// spirit/run/shell/js/apiVerbSelector.js
// ONE SHELL ELEMENT: the verb dropdown, the verbs of one family of an api tree (goal/G41.5).
//
//   Andy, 2026-10-27: "the Dropdowns for family and verb MUST be new or updated shell elements for those data types.
//   including test folders." The family half is the app-server selector (shell/js/appServerSelector.js); this is the
//   verb half, and the family selector (shell/js/apiFamilySelector.js) holds the two side by side.
//
// spirit.elements.apiVerbSelector.create(container, options) -> root, the control: root.value is the chosen verb, '' for its first option, All
// Verbs, every verb (goal/G41.14; Andy: "the apiVerbSelector element MUST offer a (valid) All option at the top, which
// results in an empty string as value"); a pick fires one bubbling `change`. root.show(tree, server) lists that family's verbs,
// apiTreeIndex.verbs, so DEBUG is never offered (Andy: "DEBUG/... are owner only and will never be offered to peerPost
// clients."); with no server it hides, lists nothing and clears the choice.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree....").
  // The app-server selector too: the keeper of the apiVerbs branch it draws from (goal/G41.28).
  var parts = Promise.all(['shell/js/probabilitySearch.js', 'shell/js/appServerSelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  function createApiVerbSelector(options) {
    options = options || {};
    var root = document.createElement('span');
    root.className = 'api-verb-selector' + (options.className ? ' ' + options.className : '');
    root.hidden = true;
    root.value = '';
    var tree = null;
    var server = '';
    var list = { redraw: function () {} };

    // THE NODE'S OWN VERBS ARE spirit.data's (goal/G41.28; Andy, Q7: "the family, verb and app-server selectors draw from
    // it"): a view of the apiVerbs branch the app-server selector keeps, the chosen family's alone; another party's tree
    // (options.own false: introSpector's peer or relay) is listed from that tree, as before.
    var own = options.own !== false;
    function rows() {
      var verbs = server && tree ? window.spirit.apiTreeIndex.verbs(tree, server) : [];
      return verbs.map(function (v) { return { key: v, name: v }; });
    }
    // A PROBABILITYSEARCH DROPDOWN (the old shell's list search is forbidden on the face, goal/G40.8).
    parts.then(function () {
      var S = window.spirit.elements.appServerSelector;
      list = window.spirit.elements.probabilitySearch.create(root, {
        face: 'dropdown',
        placeholder: options.placeholder || 'All Verbs',
        all: 'All Verbs',
        data: own && S ? S.verbs : undefined,
        rows: own && S ? undefined : rows,
        filters: own && S ? [{ name: 'family', when: function () { return false; }, test: function (row) { return row && row.family === server ? 1 : 0; } }] : [],
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        pick: function (row, key) {
          root.value = row ? String((row.name != null ? row.name : key) || '') : '';
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
    // Its list destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go).
    root.destroy = function () { parts.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  window.spirit.elements.apiVerbSelector = { create: function (container, options) { var root = createApiVerbSelector(options); container.appendChild(root); return root; } };
})();
