'use strict';
// spirit/run/spirit/node/data.js
// WHAT A CLIENT KNOWS OF A NODE ITSELF, IN THE node FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until every
// family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data". A page loads
// it through spirit.cacheManager('node'); it keeps what the node said of itself in that page's spirit.data, under the
// node.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the app-server, family and verb selectors)
// asks spirit.data.node.data (below), never a branch by name.
//   apiTree    family -> { name }, the node's api tree as apiTreeIndex reads it (a server that did not answer left out)
//   apiVerbs   'family.verb' -> { family, name }, each family's verbs (DEBUG never offered)
// Andy, Q7: "Shall the app-server selector keep the node's api tree in an apiTree branch of spirit.data, read again when
// a server job changes, and the family, verb and app-server selectors draw from it?" "yes." The selector reads the tree
// (spirit.tree) and hands it here; read again, the tree replaces both branches whole. This file asks nothing.
//   nodeCard   'self' -> { name, description }, what the node says of itself, as node.card answered it and each save
//              (node.setName, node.setDescription) stored it; Info keeps both here and draws its fields from it
(function () {
  var TREE = 'apiTree';
  var VERBS = 'apiVerbs';
  var CARD = 'nodeCard';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../spirit.js').require('spirit/data.js');
  D.makeFamily('node', function () {
    var HOME = D.viewAt(null, 'node');
    // THE READS AND THE ONE WRITE:
    //   keepTree(tree, index)   the node's api answer kept, index being apiTreeIndex (servers(tree), verbs(tree, name))
    //   families()  family -> row;  verbs()  'family.verb' -> row
    //   treeBranch, verbsBranch  whole paths, for a list that is a view of one (probabilitySearch's data)
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
      keepTree: function (tree, index) {
        var S = (typeof window !== 'undefined' ? window : globalThis).spirit;
        var I = index || (S && S.apiTreeIndex);
        if (!I) return;
        var names = tree ? I.servers(tree) : [];
        var verbs = {};
        names.forEach(function (name) { I.verbs(tree, name).forEach(function (v) { verbs[name + '.' + v] = { family: name, name: v }; }); });
        Object.keys(HOME.branch(TREE)).forEach(function (k) { if (names.indexOf(k) === -1) HOME.del(TREE + '/' + k); });
        Object.keys(HOME.branch(VERBS)).forEach(function (k) { if (!verbs[k]) HOME.del(VERBS + '/' + k); });
        names.forEach(function (name) { HOME.set(TREE + '/' + name, { name: name }); });
        Object.keys(verbs).forEach(function (k) { HOME.set(VERBS + '/' + k, verbs[k]); });
      },
      families: function () { return HOME.branch(TREE); },
      verbs: function () { return HOME.branch(VERBS); },
      get treeBranch() { return HOME.path(TREE); },
      get verbsBranch() { return HOME.path(VERBS); },
    };
    return nodeReads;
  });
}());
