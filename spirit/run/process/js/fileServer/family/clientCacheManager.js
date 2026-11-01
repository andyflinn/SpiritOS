// spirit/run/process/js/fileServer/family/clientCacheManager.js
// WHAT A CLIENT KNOWS OF THE fileServer FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; a page finds it by the family's name (spirit.cacheManager).
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: each file it holds is its own verb, run and answered, not a row anyone reads again.
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.fileServerData for them, as every family's readers do.
(function (root) {
  // Its reader is on spirit as every family's is, and has no read yet.
  var none = Object.freeze({});
  function attach(root) { if (root) (root.spirit = root.spirit || {}).fileServerData = none; }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
