// spirit/run/spirit/node/clientCacheManager.js
// WHAT A CLIENT KNOWS OF A NODE ITSELF, IN THE node FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until every
// family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data". A page loads
// it through spirit.cacheManager('node'); it keeps what the node said of itself in that page's spirit.data, under the
// node.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the app-server, family and verb selectors)
// asks spirit.nodeData (below), never a branch by name.
//   apiTree    family -> { name }, the node's api tree as apiTreeIndex reads it (a server that did not answer left out)
//   apiVerbs   'family.verb' -> { family, name }, each family's verbs (DEBUG never offered)
// Andy, Q7: "Shall the app-server selector keep the node's api tree in an apiTree branch of spirit.data, read again when
// a server job changes, and the family, verb and app-server selectors draw from it?" "yes." The selector reads the tree
// (spirit.tree) and hands it here; read again, the tree replaces both branches whole. This file asks nothing.
(function (root) {
  var TREE = 'apiTree';
  var VERBS = 'apiVerbs';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.node.clientCacheManager') : '__nodeClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).nodeData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'node');
    // THE READS AND THE ONE WRITE:
    //   keepTree(tree, index)   the node's api answer kept, index being apiTreeIndex (servers(tree), verbs(tree, name))
    //   families()  family -> row;  verbs()  'family.verb' -> row
    //   treeBranch, verbsBranch  whole paths, for a list that is a view of one (probabilitySearch's data)
    var nodeData = {
      keepTree: function (tree, index) {
        var I = index || (root.spirit && root.spirit.apiTreeIndex);
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
    try { Object.defineProperty(D, ATTACHED, { value: nodeData }); } catch (e) { D[ATTACHED] = nodeData; }
    (root.spirit = root.spirit || {}).nodeData = nodeData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  // A page without the data set yet loads it first, as part of this file's tree.
  var sp = root.spirit;
  if (sp && !sp.data && typeof sp.require === 'function' && typeof sp.isBrowser === 'function' && sp.isBrowser()) {
    Promise.resolve(sp.require('spirit/spiritData.js')).then(function () { attach(root); }, function () { /* no data set: nothing kept */ });
  } else attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
