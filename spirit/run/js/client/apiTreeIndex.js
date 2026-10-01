'use strict';

// The owner's api tree, read for choosing — apiAuth/G1.8.
//
//   Andy: "the appServer selector (a subComponent of the api-path
//   selector)", and on its source: "the shell's api tree is a straight
//   copy of the node's owner-api-tree ?" — "yes". The tree is what
//   jobs.api answers to 'api': one branch per server, each branch that
//   server's verbs, or { ok: false, ... } for a server that did not
//   answer (Andy: "the boot continues. and the failure is logged. and
//   that server will not be part of the apiTree").
//
// Nothing here touches the DOM, the iconIndex.js shape: the widget built
// on it (createAppServerSelector, shell.js) is a thin painter over these
// arrays, so the deciding can be asserted in node rather than only
// looked at. apiAuth/G1.9 extends this file with the verb list of one
// server; this half lists the servers.

// The names of the servers in an 'api' answer, sorted. A branch that is
// not an object, or that is an error ({ ok: false }: a server that did
// not answer), is not a server.
function apiTreeServers(tree) {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) return [];
  return Object.keys(tree).filter(function (name) {
    var branch = tree[name];
    return branch && typeof branch === 'object' && !Array.isArray(branch) && branch.ok !== false;
  }).sort();
}

// ONE SERVER'S VERBS (apiAuth/G1.9), sorted, for the verb dropdown. DEBUG and DEPENDENCIES are the owner's and
// never offered (Andy: "DEBUG/DEPENDENCIES are owner only and will never be offered to peerPost clients."); AGENTS
// is a verb like any other. A server the tree does not hold, or whose branch is an error, has no verbs.
var API_TREE_OWNER_VERBS = ['DEBUG', 'DEPENDENCIES'];
function apiTreeVerbs(tree, server) {
  if (apiTreeServers(tree).indexOf(server) === -1) return [];
  return Object.keys(tree[server]).filter(function (verb) {
    return API_TREE_OWNER_VERBS.indexOf(verb) === -1;
  }).sort();
}

var apiTreeIndexApi = {
  servers: apiTreeServers,
  verbs: apiTreeVerbs,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = apiTreeIndexApi;
} else if (typeof window !== 'undefined') {
  window.spiritApiTreeIndex = apiTreeIndexApi;
}
