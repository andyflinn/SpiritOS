'use strict';
// ITS NAMES STAY ITS OWN (goal/G47.1; Andy: "is there any motherfucking reason that this fucking shit cannot be fucking
// contained in the motherfucking spirit objects"): a page loads this file through a script tag, so the whole of it runs
// inside one function, and what it hands out goes onto the spirit object or module.exports, never the window.
(function () {
if (typeof require === 'function') require('../script.js'); // node only: a page has the global spirit already, and no require

// The owner's api tree, read for choosing — apiAuth/G1.8.
//
//   Andy: "the appServer selector (a subComponent of the api-path
//   selector)", and on its source: "the shell's api tree is a straight
//   copy of the node's owner-api-tree ?" — "yes". The tree is what
//   the verb api answers on /spirit (goal/G30.6): one branch per server, each branch that
//   server's verbs, or { ok: false, ... } for a server that did not
//   answer (Andy: "the boot continues. and the failure is logged. and
//   that server will not be part of the apiTree").
//
// Nothing here touches the DOM: the widget built
// on it (createAppServerSelector, spirit/element/search/api/script.js) is a thin painter over these
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

// ONE SERVER'S VERBS (apiAuth/G1.9), sorted, for the verb dropdown. DEBUG is the owner's and never offered (Andy:
// "DEBUG/... are owner only and will never be offered to peerPost clients."). A server the tree does not hold, or
// whose branch is an error, has no verbs.
var API_TREE_OWNER_VERBS = ['DEBUG'];
function apiTreeVerbs(tree, server) {
  if (apiTreeServers(tree).indexOf(server) === -1) return [];
  return Object.keys(tree[server]).filter(function (verb) {
    return API_TREE_OWNER_VERBS.indexOf(verb) === -1;
  }).sort();
}

// WHETHER THE TREE SERVES A PATH TODAY (apiAuth/G1.6): how the Grants
// app tells a live grant from a deprecated one. 'app' is served when
// that server answered; 'app.verb' when the verb is among its verbs —
// verbs(), so DEBUG is nobody's grant. A grant this
// says is gone is REPORTED, never pruned: Andy, "so we defer pruning to
// be triggered by the owners auth app, who can report deprecated
// branches".
// The branch is the longest served one the path starts with (goal/G49.19): an app is named by its folder's path in dots,
// spirit.app.desk, so it holds dots of its own; never split at the first dot.
function apiTreeServes(tree, p) {
  var path = String(p == null ? '' : p);
  var app = '';
  apiTreeServers(tree).forEach(function (b) { if (b.length > app.length && (path === b || path.indexOf(b + '.') === 0)) app = b; });
  if (!app) return false;
  return path === app || apiTreeVerbs(tree, app).indexOf(path.slice(app.length + 1)) !== -1;
}

var apiTreeIndexApi = {
  servers: apiTreeServers,
  verbs: apiTreeVerbs,
  serves: apiTreeServes,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = apiTreeIndexApi;
} else if (typeof window !== 'undefined') {
  // ONE PLACE, spirit.required.<its path> (goal/G49.4; Andy: "spirit.requireScript() places the loaded script at the exact same
  // motherfucking location/path in the spirit object"): on a page as in node, where the loader finds it.
  var R = ((window.spirit = window.spirit || {}).required = window.spirit.required || {});
  ((R.spirit = R.spirit || {}).fuckingGarbage = R.spirit.fuckingGarbage || {}).apiTreeIndex = apiTreeIndexApi;
}
}());
