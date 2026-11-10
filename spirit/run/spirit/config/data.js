'use strict';
// spirit/run/spirit/config/data.js
// WHAT A CLIENT KNOWS OF THE config FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; a page finds it by the family's name (spirit.cacheManager).
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: the family has no verb yet (kept empty for later use, goal/G30.20).
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.data.config.data for them, as every family's readers do.
(function () {
  // Its reads stand at spirit.data.config.data as every family's do, and it has none yet.
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../spirit.js').require('spirit/data.js');
  D.makeFamily('config');
}());
