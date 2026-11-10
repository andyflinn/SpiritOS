'use strict';
// spirit/run/spirit/element/search/api/listElement.js
// THE FAMILY LIST, THE API SEARCH'S LIST (goal/G43.32; Andy: "uniformity, in the search elements and their folders, contain
// list, row an detail elements."): the app-server selector of apiAuth/G1.8, which stood in ../api.js beside the family
// selector it is half of. Each row is ./rowElement.js; in a pane, a row pressed opens its family's verbs, ./detailElement.js.
// Its contract and its test: ./test/listElement.md and ./test/listElement.js.
//
//   Andy: "the appServer selector (a subComponent of the api-path selector)", and the tree it reads: "the shell's api tree is
//   a straight copy of the node's owner-api-tree ?" — "yes". So it fills itself from the verb api on the flat apiDoor
//   (goal/G30.6), and lists spirit.apiTreeIndex.servers(tree): sorted, a server that did not answer left out
//   (apiTreeIndex.js decides; this paints). SINCE goal/G30.4 that answer is the whole flat table, the node's own families
//   (fs, job, relay ...) beside the apps', so the list holds every family the grant system sees (Andy, 2026-10-20: "the grant
//   system looks at apiDoors whole damn table of families and verbs").
//
//   spirit.element.spirit.element.search.api.listElement.create(container, options) -> root
//     root.value   the chosen family's name; root.tree the api answer it was painted from, so the verb half can read one
//                  family's verbs without asking again. One bubbling `change` once value is set; `tree` once a tree is in.
//     root.load(fn)  lists another party's tree, fn() a promise of it, and clears the choice; none: this node's own
//     options.face        'pane' is the list itself, a row pressed opening its detail under it; the default is the dropdown
//     options.placeholder, options.all   the dropdown's words; all is what the field reads while nothing is chosen, and the
//                         dropdown's None sets it back (Grants: unchosen means every family)
//     options.tree        another party's tree (introSpector: a peer node's, a relay's), a function answering a promise of it
//
// A PROBABILITYSEARCH (goal/G41.5; the old shell's list search, forbidden on the face, goal/G40.8), never a native select.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): the list, its row and its detail,
  // the reader of the api tree, and the node family's cache manager, the keeper of the api tree (goal/G41.28).
  var parts = Promise.all([window.spirit.require('spirit/element/search.js'), window.spirit.require('spirit/element/search/api/rowElement.js'),
    window.spirit.require('spirit/element/search/api/detailElement.js'), window.spirit.require('spirit/client/apiTreeIndex.js'),
    window.spirit.cacheManager('node')]);

  // THE NODE'S API TREE IN spirit.data (goal/G41.28; Andy, Q7: "Shall the app-server selector keep the node's api tree in an
  // apiTree branch of spirit.data, read again when a server job changes, and the family, verb and app-server selectors
  // draw from it?" "yes."): this list reads it, and the node family's cache manager keeps it (spirit.data.node.data:
  // families, and each family's verbs, as apiTreeIndex reads the tree). Read again, the tree replaces both whole. A server
  // job changing on the stream reads it again: one translator for every list. Another party's tree (options.tree:
  // introSpector's peer or relay) is that party's, and stays out of it.
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

  function createFamilyList(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var root = document.createElement('div');
    root.className = 'app-server-selector' + (options.className ? ' ' + options.className : '');
    // An input control stands inline, never a block of its own (goal/G29.7: server and verb side by side); a pane is a block.
    root.style.display = isPane ? 'block' : 'inline-block';
    var host = document.createElement('span');
    root.appendChild(host);
    var detailBox = null;
    var detail = null;
    if (isPane) { detailBox = document.createElement('div'); root.appendChild(detailBox); }
    root.value = '';
    root.tree = null;

    // The node's own tree is the apiTree branch; another party's is its own rows.
    var own = typeof options.tree !== 'function';
    root.own = own;
    function rows() {
      var names = root.tree ? window.spirit.apiTreeIndex.servers(root.tree) : [];
      return names.map(function (name) { return { key: name, name: name }; });
    }
    function clearDetail() { if (detail) detail.destroy(); detail = null; }
    var list = { redraw: function () {} };
    var made = parts.then(function () {
      var E = window.spirit.element.spirit.element;
      list = E.search.create(host, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a server…'),
        all: isPane ? undefined : options.all,
        data: own ? window.spirit.data.node.data.treeBranch : undefined,
        rows: own ? undefined : rows,
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        element: function (row, key) { return E.search.api.rowElement.create(Object.assign({ name: key }, row)); },
        pick: function (row, key) {
          root.value = row ? String(key || row.key || '') : '';
          root.dispatchEvent(new Event('change', { bubbles: true }));
        },
        // A PANE'S PRESS: the family's verbs under the list, read from the tree it was painted from.
        details: isPane ? function (row, key) {
          clearDetail();
          detail = E.search.api.detailElement.create(detailBox, { family: String(key || (row && row.name) || ''), tree: root.tree });
        } : undefined,
        empty: 'No server matches.',
      });
    });

    // ANY PARTY'S TREE (goal/G30.5): options.tree, a function answering a promise of the tree, lists another party's
    // families (introSpector: a peer node's, a relay's); root.load(fn) lists a new one and clears the choice. Without it,
    // this node's own.
    root.load = function (fn) {
      root.value = '';
      root.tree = null;
      clearDetail();
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
    // Its list and its detail destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it
    // takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { clearDetail(); if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself").
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/api/listElement.js', { create: function (container, options) { var root = createFamilyList(options); container.appendChild(root); return root; } }); });
})();
