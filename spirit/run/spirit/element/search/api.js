// spirit/run/spirit/element/search/api.js
// ONE SHELL ELEMENT: the app-server selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.element,
//   which the shell hands to apps at mount as api.ui.element.
//
// Loaded by index.html before the shell, on the globals every shell script
// has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree....").
  // The node family's cache manager comes with it, as part of its tree: the keeper of the api tree (goal/G41.28).
  var parts = Promise.all([window.spirit.require ? window.spirit.require('spirit/element/search.js') : null,
    window.spirit.cacheManager('node')]);

  // THE NODE'S API TREE IN spirit.data (goal/G41.28; Andy, Q7: "Shall the app-server selector keep the node's api tree in an
  // apiTree branch of spirit.data, read again when a server job changes, and the family, verb and app-server selectors
  // draw from it?" "yes."): this selector reads it, and the node family's cache manager keeps it (spirit.data.node.data:
  // families, and each family's verbs, as apiTreeIndex reads the tree). Read again, the tree replaces both whole. A
  // server job changing on the stream reads it again: one translator for every selector.
  // Another party's tree (options.tree: introSpector's peer or relay) is that party's, and stays out of it.
  function keepTree(tree) {
    window.spirit.data.node.data.keepTree(tree, window.spirit.apiTreeIndex);
  }
  var reading = null;
  function readOwnTree() {
    reading = reading || parts.then(function () { return spirit.ready; }).then(function (s) { return s.tree(); }).then(function (tree) {
      reading = null;
      var t = tree && typeof tree === 'object' ? tree : null;
      keepTree(t);
      return t;
    }, function () { reading = null; return null; });
    return reading;
  }
  function follow(D) {
    if (D && typeof D.addTranslator === 'function') D.addTranslator({ onJob: function (job) { if (job && job.kind === 'server') readOwnTree(); } });
  }
  if (window.spirit && window.spirit.data) follow(window.spirit.data);
  else if (window.spirit && window.spirit.require) Promise.resolve(window.spirit.require('spirit/data.js')).then(function () { follow(window.spirit.data); }, function () {});

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
  // A PROBABILITYSEARCH DROPDOWN (goal/G41.5; the old shell's list search, forbidden on the face, goal/G40.8),
  // never a native select. options.all is what the field reads while nothing is chosen, and the dropdown's None sets it
  // back (Grants: unchosen means every server).
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

    // The node's own tree is the apiTree branch; another party's is its own rows.
    var own = typeof options.tree !== 'function';
    root.own = own;
    function rows() {
      var names = root.tree ? window.spirit.apiTreeIndex.servers(root.tree) : [];
      return names.map(function (name) { return { key: name, name: name }; });
    }
    var list = { redraw: function () {} };
    var made = parts.then(function () {
      list = window.spirit.element.probabilitySearch.create(host, {
        face: 'dropdown',
        placeholder: options.placeholder || 'choose a server…',
        all: options.all,
        data: own ? window.spirit.data.node.data.treeBranch : undefined,
        rows: own ? undefined : rows,
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        pick: function (row, key) {
          root.value = row ? String(key || row.key || '') : '';
          root.dispatchEvent(new Event('change', { bubbles: true }));
        },
        empty: 'No server matches.',
      });
    });

    // ANY PARTY'S TREE (goal/G30.5): options.tree, a function answering a promise of the tree, lists another party's
    // families (introSpector: a peer node's, a relay's); root.load(fn) lists a new one and clears the choice. Without
    // it, this node's own, as before.
    root.load = function (fn) {
      root.value = '';
      root.tree = null;
      list.redraw();
      // The node's own api answer, through the spirit object (goal/G32.2), kept in the apiTree branch; a party's, its own.
      var got = typeof fn === 'function' ? fn() : readOwnTree();
      return Promise.all([got, made]).then(function (both) {
        var tree = both[0];
        root.tree = tree && typeof tree === 'object' ? tree : null;
        list.redraw();
        root.dispatchEvent(new Event('tree', { bubbles: false }));
      }, function () { /* the list stays empty; the node says why elsewhere */ });
    };
    root.load(options.tree);
    // Its list destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  window.spirit.element.appServerSelector = { create: function (container, options) { var root = createAppServerSelector(options); container.appendChild(root); return root; } };
})();

// spirit/run/spirit/element/search/api.js
// ONE SHELL ELEMENT: the family selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.element,
//   which the shell hands to apps at mount as api.ui.element.
//
// On the globals every shell script has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.
//
// It was apiBranchSelector.js (goal/G41.14; Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is
// the proper name for it"), and keeps its verb half: "apiFamiliySelector.js will use apiVerbSelector as part of itself,
// because the verb selector NEEDs the family selector to have any meaning at all." Built from its two halves, which it
// loads itself (goal/G41.5): the family dropdown, the app-server selector, and the verb dropdown, apiVerbSelector. It
// only puts them side by side and joins their choices into one path.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its two halves, the app-server half
  // above in this same file since goal/G43.18 ("apiFamilySelector.js ... folds into search/api.js"), the verb half its filter.
  var parts = Promise.all(['spirit/element/search/api/verb.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  // ── THE FAMILY SELECTOR (apiAuth/G1.9) ─────────────────────────────
  //
  //   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the
  //   verb-dropdown selection chances automatically depending on the
  //   selection in the appServer-dropdown", and "the verb dropdown will have
  //   an option ( ** all verbs **)".
  //
  // Both halves are probabilitySearch dropdowns (the old shell's list search is forbidden on the face, goal/G40.8), never
  // native selects; the verb half shows only once a family is chosen (Andy: "[chose a verb, displayed only when a server
  // is chosen ]"). root.family is the chosen family ('' for none), root.verb the chosen verb ('' when none or All Verbs
  // is chosen), and root.value the PATH a grant takes: 'family' when no single verb is chosen, 'family.verb' when one
  // is, '' with no family. options.all names the family half's first row (unchosen: every family). It fires a bubbling
  // change.
  function createApiFamilySelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'api-family-selector' + (options.className ? ' ' + options.className : '');
    // SIDE BY SIDE (goal/G29.7; Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not
    // stacked"): the pair is one inline row in the line it stands in.
    root.style.display = 'inline-flex';
    root.style.alignItems = 'center';
    root.style.gap = '1em';
    root.family = '';
    root.verb = '';
    root.value = '';
    var families = null;
    var verbs = null;

    function settle() {
      root.value = !root.family ? '' : root.verb ? root.family + '.' + root.verb : root.family;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function quiet(event) { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); }
    var made = parts.then(function () {
      var E = window.spirit.element;
      families = E.appServerSelector.create(root, { placeholder: options.familyPlaceholder, all: options.all, tree: options.tree });
      // options.grantable: for a grant or a branch, the FS group left out (goal/G41.28), as the verb half says.
      verbs = E.apiVerbSelector.create(root, { own: typeof options.tree !== 'function', grantable: options.grantable === true });
      families.addEventListener('change', function (event) {
        quiet(event);
        if (families.value === root.family) return;
        root.family = families.value || '';
        root.verb = '';
        verbs.show(families.tree, root.family);
        settle();
      });
      verbs.addEventListener('change', function (event) {
        quiet(event);
        root.verb = verbs.value || '';
        settle();
      });
      families.addEventListener('tree', function () { root.tree = families.tree; root.dispatchEvent(new Event('tree', { bubbles: false })); });
      root.families = families;
      root.verbs = verbs;
    });
    // A NEW PARTY'S TREE (goal/G30.5): the choice clears, the verb half hides, and root.tree is the tree once loaded.
    root.load = function (fn) {
      return made.then(function () {
        root.family = '';
        root.verb = '';
        verbs.show(null, '');
        settle();
        return families.load(fn);
      });
    };
    // Both halves destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (families) families.destroy(); if (verbs) verbs.destroy(); }); };
    return root;
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  window.spirit.element.apiFamilySelector = { create: function (container, options) { var root = createApiFamilySelector(options); container.appendChild(root); return root; } };
})();
