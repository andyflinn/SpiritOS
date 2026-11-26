'use strict';
// spirit/run/spirit/node/data.js
// WHAT A CLIENT KNOWS OF A NODE ITSELF, IN THE node FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until every
// family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.required.spirit.data". A page loads
// it through its api.js (spirit/node/api.js), the one file that requires it; it keeps what the node said of itself in that page's spirit.required.spirit.data, under the
// node.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the app-server, family and verb selectors)
// asks spirit.required.spirit.data.node.data (below), never a branch by name.
//   apiTree    family -> { name }, the node's api tree as apiTreeIndex reads it (a server that did not answer left out)
//   apiVerbs   'family.verb' -> { family, name }, each family's verbs (DEBUG never offered)
// Andy, Q7: "Shall the app-server selector keep the node's api tree in an apiTree branch of spirit.required.spirit.data, read again when
// a server job changes, and the family, verb and app-server selectors draw from it?" "yes." The selector reads the tree
// (spirit.apiTree) and hands it here; read again, the tree replaces both branches whole. This file asks nothing.
//   nodeCard   'self' -> { name, description }, what the node says of itself, as node.card answered it and each save
//              (node.setName, node.setDescription) stored it; Info keeps both here and draws its fields from it
(function family() {
  var TREE = 'apiTree';
  var VERBS = 'apiVerbs';
  var CARD = 'nodeCard';
  var D = typeof require === 'function' ? require('../script.js').requireScript('spirit/data/script.js') : window.spirit.required.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/data/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('node', function () {
    var HOME = D.viewAt(null, 'node');
    var parties = {};
    function viewOf(party) { var p = String(party || ''); return !p ? HOME : (parties[p] || (parties[p] = D.viewAt(p, 'node'))); }
    // THE READS AND THE ONE WRITE:
    //   keepTree(tree, index, party)   the api answer kept, index being apiTreeIndex (servers(tree), verbs(tree, name)),
    //                                  party '' for this node's own, else the peer's key or relay's address that answered it
    //   families(party)  family -> row;  verbs(party)  'family.verb' -> row
    //   treeBranch, verbsBranch  this node's whole paths, for a list that is a view of one (probabilitySearch's data);
    //   treeBranchOf(party), verbsBranchOf(party)  the same for a party
    //   card.keep(fields)  node.card's answer, or one field a save stored ({ description }), merged into the card
    //   card.get()         the card kept, or null;  card.watch(fn)  fn(card) on every change; answers its release
    var nodeReads = {
      card: {
        keep: function (fields) {
          if (!fields || typeof fields !== 'object' || fields.ok === false) return;
          var was = HOME.get(CARD + '/self') || {};
          var card = { name: was.name, description: was.description };
          if (fields.name !== undefined) card.name = fields.name;
          if (fields.description !== undefined) card.description = fields.description;
          HOME.set(CARD + '/self', card);
        },
        get: function () { return HOME.get(CARD + '/self') || null; },
        watch: function (fn) { return HOME.watch(CARD + '/self', function (whole, v) { if (typeof fn === 'function') fn(v || null); }); },
      },
      // ANOTHER PARTY'S TREE IS ITS OWN NODE'S (goal/G48.4; Andy: "fix the introSpector, too", ending the box's "the only
      // exception is introspector, deferred for network-scope design reasons."): party, a peer's key or a relay's address,
      // keeps that party's tree in the same two branches under that party's own node, so every list of a tree is a view of a
      // spirit.required.spirit.data branch; '' or left out is this node's own.
      keepTree: function (tree, index, party) {
        var S = (typeof window !== 'undefined' ? window : globalThis).spirit;
        var I = index || (S && ((((S || {}).required || {}).spirit || {}).fuckingGarbage || {}).apiTreeIndex);
        if (!I) return;
        var V = viewOf(party);
        var names = tree ? I.servers(tree) : [];
        var verbs = {};
        names.forEach(function (name) { I.verbs(tree, name).forEach(function (v) { verbs[name + '.' + v] = { family: name, name: v }; }); });
        Object.keys(V.branch(TREE)).forEach(function (k) { if (names.indexOf(k) === -1) V.del(TREE + '/' + k); });
        Object.keys(V.branch(VERBS)).forEach(function (k) { if (!verbs[k]) V.del(VERBS + '/' + k); });
        names.forEach(function (name) { V.set(TREE + '/' + name, { name: name }); });
        Object.keys(verbs).forEach(function (k) { V.set(VERBS + '/' + k, verbs[k]); });
      },
      families: function (party) { return viewOf(party).branch(TREE); },
      verbs: function (party) { return viewOf(party).branch(VERBS); },
      get treeBranch() { return HOME.path(TREE); },
      get verbsBranch() { return HOME.path(VERBS); },
      treeBranchOf: function (party) { return viewOf(party).path(TREE); },
      verbsBranchOf: function (party) { return viewOf(party).path(VERBS); },
    };
    return nodeReads;
  });
}());
