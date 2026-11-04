// spirit/run/process/js/fileServer/data.js
// WHAT A CLIENT KNOWS OF THE fileServer FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; a page finds it by the family's name (spirit.cacheManager).
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: each file it holds is its own verb, run and answered, not a row anyone reads again.
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.data.fileServer.data for them, as every family's readers do.
(function () {
  // Its reads stand at spirit.data.fileServer.data as every family's do, and it has none yet.
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../../spirit/data.js');
  D.makeFamily('fileServer');
}());
