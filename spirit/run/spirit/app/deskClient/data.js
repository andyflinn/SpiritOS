// spirit/run/spirit/app/deskClient/data.js
// WHAT A CLIENT KNOWS OF THE deskClient FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; a page finds it by the family's name (spirit.cacheManager).
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: cache.dump saves a server's cache to its disk and history.search answers one search for the agent that asked it, in node.
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.data.deskClient.data for them, as every family's readers do.
(function () {
  // Its reads stand at spirit.data.deskClient.data as every family's do, and it has none yet.
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../data.js');
  D.makeFamily('deskClient');
}());
