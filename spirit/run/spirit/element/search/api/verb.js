// spirit/run/spirit/element/search/api/verb.js
// ONE SHELL ELEMENT: the verb dropdown, the verbs of one family of an api tree (goal/G41.5).
//
//   Andy, 2026-10-27: "the Dropdowns for family and verb MUST be new or updated shell elements for those data types.
//   including test folders." The family half is the app-server selector (spirit/element/search/api.js); this is the
//   verb half, and the family selector (spirit/element/search/api.js) holds the two side by side.
//
// spirit.element.search.api.verb.create(container, options) -> root, the control: root.value is the chosen verb, '' for its first option, All
// Verbs, every verb (goal/G41.14; Andy: "the apiVerbSelector element MUST offer a (valid) All option at the top, which
// results in an empty string as value"); a pick fires one bubbling `change`. root.show(tree, server) lists that family's verbs,
// apiTreeIndex.verbs, so DEBUG is never offered (Andy: "DEBUG/... are owner only and will never be offered to peerPost
// clients."); with no server it hides, lists nothing and clears the choice.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree....").
  // The app-server selector too, the reader of the api tree, and with it the node family's cache manager, the keeper of
  // the verbs it draws from (goal/G41.28).
  // search/api.js, its app-server half, is asked one tick later (goal/G43.18): that file requires this one, and a require
  // made while this file runs joins this file's own load, so each would wait for the other and neither would ever load.
  // Asked outside it, this file's load does not wait for api.js; what it draws waits on parts, which still does.
  var parts = Promise.all([window.spirit.require ? window.spirit.require('spirit/element/search.js') : null,
    Promise.resolve().then(function () { return window.spirit.require ? window.spirit.require('spirit/element/search/api.js') : null; }),
    window.spirit.cacheManager('node')]);

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
    // it"): a view of the verbs the node family's cache manager keeps, the chosen family's alone. Another party's tree
    // (options.own false: introSpector's peer or relay) is listed from that tree: introSpector is the one exception, deferred
    // (Andy, the box: "the only exception is introspector, deferred for network-scope design reasons.").
    var own = options.own !== false;
    // FOR A GRANT OR A BRANCH, ONLY WHAT MAY BE GRANTED (goal/G41.28; Andy: "so the introSpector gets the FS group, BUT the
    // auth.branch won't see those verbs"): options.grantable leaves every family's FS group out; the owner's own lists
    // (the introSpector) show it.
    var grantable = options.grantable === true;
    function offered(name) { return !grantable || window.spirit.apiTreeIndex.grantable(name); }
    function rows() {
      var verbs = server && tree ? window.spirit.apiTreeIndex.verbs(tree, server) : [];
      return verbs.filter(offered).map(function (v) { return { key: v, name: v }; });
    }
    // A PROBABILITYSEARCH DROPDOWN (the old shell's list search is forbidden on the face, goal/G40.8).
    parts.then(function () {
      list = window.spirit.element.search.create(root, {
        face: 'dropdown',
        placeholder: options.placeholder || 'All Verbs',
        all: 'All Verbs',
        data: own ? window.spirit.data.node.data.verbsBranch : undefined,
        rows: own ? undefined : rows,
        filters: own ? [{ name: 'family', when: function () { return false; }, test: function (row) { return row && row.family === server && offered(row.name) ? 1 : 0; } }] : [],
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
    // Its list destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { if (root.parentNode) root.parentNode.removeChild(root); parts.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'api', 'verb'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, (window.spirit.element = window.spirit.element || {})), { create: function (container, options) { var root = createApiVerbSelector(options); container.appendChild(root); return root; } });
})();
