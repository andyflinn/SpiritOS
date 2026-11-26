'use strict';
// spirit/run/spirit/element/search/api/list/script.js
// THE FAMILY LIST, THE API SEARCH'S LIST (goal/G43.32; Andy: "uniformity, in the search elements and their folders, contain
// list, row an detail elements."): the app-server selector of apiAuth/G1.8, which stood in ../script.js beside the family
// selector it is half of. Each row is ../row/script.js; in a pane, a row pressed opens its family's verbs, ./detail.js.
// Its contract and its test: ./test/script.md and ./test/list.js.
//
//   Andy: "the appServer selector (a subComponent of the api-path selector)", and the tree it reads: "the shell's api tree is
//   a straight copy of the node's owner-api-tree ?" — "yes". So it fills itself from the verb api on the flat apiDoor
//   (goal/G30.6), and lists spirit.requireScript('spirit/fuckingGarbage/apiTreeIndex.js')'s answer.servers(tree): sorted, a server that did not answer left out
//   (apiTreeIndex.js decides; this paints). SINCE goal/G30.4 that answer is the whole flat table, the node's own families
//   (fs, job, relay ...) beside the apps', so the list holds every family the grant system sees (Andy, 2026-10-20: "the grant
//   system looks at apiDoors whole damn table of families and verbs").
//
//   spirit.requireScript('spirit/element/search/script.js')'s answer.api.list.create(container, options) -> root
//     root.value   the chosen family's name; root.tree the api answer it was painted from, so the verb half can read one
//                  family's verbs without asking again. One bubbling `change` once value is set; `tree` once a tree is in.
//     root.load(fn, party)  lists another party's tree, fn() a promise of it, kept under party (a peer's key or a relay's
//                  address), and clears the choice; no fn: this node's own. root.party is whose it draws, '' this node's
//     options.face        'pane' is the list itself, a row pressed opening its detail under it; the default is the dropdown
//     options.placeholder, options.all   the dropdown's words; all is what the field reads while nothing is chosen, and the
//                         dropdown's None sets it back (Grants: unchosen means every family)
//     options.tree        another party's tree (introSpector: a peer node's, a relay's), a function answering a promise of it
//     options.party       whose that tree is, as root.load's party
//
// A PROBABILITYSEARCH (goal/G41.5; the old shell's list search, forbidden on the face, goal/G40.8), never a native select.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): the list, its row and its detail,
  // the reader of the api tree, and the node family's cache manager, the keeper of the api tree (goal/G41.28).
  var parts = Promise.all([keepAnswer('spirit/element/search/script.js'), keepAnswer('spirit/element/search/api/row/script.js'),
    keepAnswer('spirit/element/search/api/detail/script.js'), keepAnswer('spirit/fuckingGarbage/apiTreeIndex.js'),
    keepAnswer('spirit/node/api.js')]);

  // THE NODE'S API TREE IN spirit.requireScript('spirit/data/script.js')'s answer (goal/G41.28; Andy, Q7: "Shall the app-server selector keep the node's api tree in an
  // apiTree branch of spirit.requireScript('spirit/data/script.js')'s answer, read again when a server job changes, and the family, verb and app-server selectors
  // draw from it?" "yes."): this list reads it, and the node family's cache manager keeps it (spirit.requireScript('spirit/data/script.js')'s answer.node.data:
  // families, and each family's verbs, as apiTreeIndex reads the tree). Read again, the tree replaces both whole. A server
  // job changing on the stream reads it again: one translator for every list. Another party's tree (options.tree:
  // introSpector's peer or relay) is that party's, and stays out of it.
  function keepTree(tree) {
    ANSWER['spirit/data/script.js'].node.data.keepTree(tree, ANSWER['spirit/fuckingGarbage/apiTreeIndex.js']);
  }
  var reading = null;
  function readOwnTree() {
    reading = reading || parts.then(function () { return spirit.readyPromise; }).then(function (s) { return s.apiTree(); }).then(function (tree) {
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
  if (window.spirit && ANSWER['spirit/data/script.js']) follow(ANSWER['spirit/data/script.js']);
  else if (window.spirit && window.spirit.requireScript) Promise.resolve(keepAnswer('spirit/data/script.js')).then(function () { follow(ANSWER['spirit/data/script.js']); }, function () {});

  function createFamilyList(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var root = document.createElement('div');
    // A PANE FILLS THE BOX IT IS GIVEN, its list in a fill box of its own (rule/16), so the list's size is its pane's and not its
    // rows' (search-child-browser.js); a dropdown stands inline.
    root.className = 'app-server-selector' + (isPane ? ' fill' : '') + (options.className ? ' ' + options.className : '');
    // Its box declares its constraint (goal/G47.1, -browser): what it holds stays inside; a dropdown's list is a popover, above it.
    if (root.style) root.style.overflow = 'hidden';
    // An input control stands inline, never a block of its own (goal/G29.7: server and verb side by side); a pane is a block.
    if (!isPane) root.style.display = 'inline-block';
    var host = document.createElement(isPane ? 'div' : 'span');
    if (isPane) host.className = 'fill';
    root.appendChild(host);
    var detailBox = null;
    var detail = null;
    if (isPane) { detailBox = document.createElement('div'); root.appendChild(detailBox); }
    root.value = '';
    root.tree = null;

    // EVERY TREE IS A spirit.requireScript('spirit/data/script.js')'s answer BRANCH (goal/G48.4; Andy: "fix the introSpector, too"): the node's own tree is its apiTree
    // branch, another party's the apiTree branch under that party's node (spirit/node/data.js keepTree's party); root.party
    // names whose it draws, '' for this node's own.
    root.party = typeof options.tree === 'function' ? partyOf(options.party) : '';
    // A party's tree with no name of its party is kept under one shared party slot, never in this node's own.
    function partyOf(p) { return String(p || '') || 'party'; }
    function clearDetail() { if (detail) detail.destroy(); detail = null; }
    var list = { redraw: function () {} };
    // THE LIST IS MADE FOR ITS SOURCE (goal/G47.1, wsl's red: a party's tree loaded later still drew the node's own branch):
    // the shared search takes its branch as it is made, so a load for another party makes the list again, on that party's.
    function makeList() {
      list = ANSWER['spirit/element/search/script.js'].create(host, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a server…'),
        all: isPane ? undefined : options.all,
        data: ANSWER['spirit/data/script.js'].node.data.treeBranchOf(root.party),
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        element: function (row, key) { return ANSWER['spirit/element/search/api/row/script.js'].create(Object.assign({ name: key }, row)); },
        pick: function (row, key) {
          root.value = row ? String(key || row.key || '') : '';
          root.dispatchEvent(new Event('change', { bubbles: true }));
        },
        // A PANE'S PRESS: the family's verbs under the list, read from the tree it was painted from.
        details: isPane ? function (row, key) {
          clearDetail();
          detail = ANSWER['spirit/element/search/api/detail/script.js'].create(detailBox, { family: String(key || (row && row.name) || ''), tree: root.tree });
        } : undefined,
        empty: 'No server matches.',
      });
    }
    var made = parts.then(makeList);

    // ANY PARTY'S TREE (goal/G30.5): options.tree, a function answering a promise of the tree, lists another party's
    // families (introSpector: a peer node's, a relay's); root.load(fn) lists a new one and clears the choice. Without it,
    // this node's own.
    root.load = function (fn, p) {
      root.value = '';
      root.tree = null;
      clearDetail();
      var party = typeof fn === 'function' ? partyOf(p) : '';
      if (party !== root.party) {
        root.party = party;
        made = made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); host.innerHTML = ''; makeList(); });
      }
      list.redraw();
      // The node's own api answer, through the spirit object (goal/G32.2), kept in its apiTree branch; a party's, kept in
      // that party's.
      var got = typeof fn === 'function' ? fn() : readOwnTree();
      return Promise.all([got, made]).then(function (both) {
        var tree = both[0];
        root.tree = tree && typeof tree === 'object' ? tree : null;
        if (party) ANSWER['spirit/data/script.js'].node.data.keepTree(root.tree, ANSWER['spirit/fuckingGarbage/apiTreeIndex.js'], party);
        list.redraw();
        root.dispatchEvent(new Event('tree', { bubbles: false }));
      }, function () { /* the list stays empty; the node says why elsewhere */ });
    };
    root.load(options.tree, options.party);
    // Its list and its detail destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it
    // takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { clearDetail(); if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself").
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: function (container, options) { var root = createFamilyList(options); container.appendChild(root); return root; } };
})();
