// spirit/run/spirit/owner/clientCacheManager.js
// WHAT A CLIENT KNOWS OF THE owner FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; a page finds it by the family's name (spirit.cacheManager).
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: no client reads the owner's boxes or sends his commands from a page yet; the first that reads boxSearch or boxGet keeps the boxes here.
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.ownerData for them, as every family's readers do.
(function (root) {
  // Its reader is on spirit as every family's is, and has no read yet.
  var none = Object.freeze({});
  function attach(root) { if (root) (root.spirit = root.spirit || {}).ownerData = none; }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
