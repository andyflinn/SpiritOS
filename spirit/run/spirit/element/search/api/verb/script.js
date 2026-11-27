'use strict';
// spirit/run/spirit/element/search/api/verb/script.js
// ONE SHELL ELEMENT: the verb dropdown, the verbs of one family of an api tree (goal/G41.5).
//
//   Andy, 2026-10-27: "the Dropdowns for family and verb MUST be new or updated shell elements for those data types.
//   including test folders." The family half is the family list (../list/script.js, the app-server selector until
//   goal/G43.32); this is the verb half, and the family selector (spirit/element/search/api/script.js) holds the two side by side.
//
// spirit.requireScript('spirit/element/search/script.js')'s answer.api.verb.create(container, options) -> root, the control: root.value is the chosen verb, '' for its first option, All
// Verbs, every verb (goal/G41.14; Andy: "the apiVerbSelector element MUST offer a (valid) All option at the top, which
// results in an empty string as value"); a pick fires one bubbling `change`. root.show(tree, server) lists that family's verbs,
// apiTreeIndex.verbs, so DEBUG is never offered (Andy: "DEBUG/... are owner only and will never be offered to peerPost
// clients."); with no server it hides, lists nothing and clears the choice.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree....").
  // The family list too, the reader of the api tree (../list/script.js, goal/G43.32; it stood in ../script.js, which requires
  // this file), and with it the node family's cache manager, the keeper of the verbs it draws from (goal/G41.28).
  var parts = Promise.all([window.spirit.requireScript ? keepAnswer('spirit/element/search/script.js') : null,
    window.spirit.requireScript ? keepAnswer('spirit/element/search/api/list/script.js') : null,
    window.spirit.requireScript ? keepAnswer('spirit/fuckingGarbage/apiTreeIndex.js') : null,
    keepAnswer('spirit/script.js'),
    Promise.resolve(window.spirit.readyPromise)]);

  // goal/G49.23, box v22 Part 1 (Andy: "no spirit.dataStore"): the node branch's reads, its data, as spirit.requireScript handed
  // it back; this node's own tree and verbs through its handle. The node's handle is on the page's node alone, so another
  // party's branch is read through the reads that name a party, with no watch of its own: whoever keeps its tree redraws.
  function nodeReads() { var b = ANSWER['spirit/script.js']; return (b && b.client) || null; }
  function handleOn(branch, party) {
    var N = nodeReads();
    if (!party) return N.handle(branch);
    var whole = function () { return (branch === 'apiTree' ? N.families(party) : N.verbs(party)) || {}; };
    return {
      get path() { return branch === 'apiTree' ? N.treeBranchOf(party) : N.verbsBranchOf(party); },
      rows: function () { var w = whole(); return Object.keys(w).map(function (k) { return Object.assign({ key: k }, w[k]); }); },
      whole: whole,
      seat: function () {},
      watch: function () { return function () {}; },
      ready: function () { return true; },
    };
  }

  function createApiVerbSelector(options) {
    options = options || {};
    var root = document.createElement('span');
    root.className = 'api-verb-selector' + (options.className ? ' ' + options.className : '');
    // Its box declares its constraint (goal/G47.1, -browser): what it holds stays inside; a dropdown's list is a popover, above it.
    if (root.style) root.style.overflow = 'hidden';
    root.hidden = true;
    root.value = '';
    var tree = null;
    var server = '';
    var list = { redraw: function () {} };

    // THE VERBS ARE spirit.required.spirit.data's (goal/G41.28; Andy, Q7: "the family, verb and app-server selectors draw from it"): a view of
    // the verbs the node family's cache manager keeps, the chosen family's alone. ANOTHER PARTY'S TOO (goal/G48.4; Andy:
    // "fix the introSpector, too", ending the box's deferred exception): its verbs are the apiVerbs branch under that party's
    // node, kept there by the family list (../list/script.js) that loaded its tree; party is whose, '' this node's own.
    var party = String(options.party || '');
    // A PROBABILITYSEARCH DROPDOWN (the old shell's list search is forbidden on the face, goal/G40.8), made on its party's branch.
    var made = parts.then(makeList);
    function makeList() {
      list = ANSWER['spirit/element/search/script.js'].create(root, {
        face: 'dropdown',
        placeholder: options.placeholder || 'All Verbs',
        all: 'All Verbs',
        data: handleOn('apiVerbs', party),
        filters: [{ name: 'family', when: function () { return false; }, test: function (row) { return row && row.family === server ? 1 : 0; } }],
        columns: [{ field: 'name' }],
        name: function (row) { return row.name; },
        pick: function (row, key) {
          root.value = row ? String((row.name != null ? row.name : key) || '') : '';
          root.dispatchEvent(new Event('change', { bubbles: true }));
        },
        empty: 'No verb matches.',
      });
    }
    // party, when given, is whose tree it is now (the family list's root.party); another party's makes the list again, on
    // that party's branch.
    root.show = function (t, s, p) {
      tree = t || null;
      server = String(s || '');
      root.value = '';
      root.hidden = !server;
      if (p !== undefined && String(p || '') !== party) {
        party = String(p || '');
        made = made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); list = { redraw: function () {} }; makeList(); });
      }
      made.then(function () { list.redraw(); });
    };
    // Its list destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (list && typeof list.destroy === 'function') list.destroy(); }); };
    return root;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: function (container, options) { var root = createApiVerbSelector(options); container.appendChild(root); return root; } };
})();
