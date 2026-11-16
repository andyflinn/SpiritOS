'use strict';
// spirit/run/spirit/config/data.js
// WHAT A CLIENT KNOWS OF THE config FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; its api.js requires it, and no other file does.
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: the family has no verb yet (kept empty for later use, goal/G30.20).
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.data.config.data for them, as every family's readers do.
(function family() {
  // Its reads stand at spirit.data.config.data as every family's do, and it has none yet.
  var D = typeof require === 'function' ? require('../spirit.js').require('spirit/data.js') : window.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.require,
  // data.js exactly as api.js"): on a page that has not loaded spirit/data.js yet, this file loads it and runs again.
  if (!D) { window.spirit.require('spirit/data.js').then(function () { if (window.spirit.data) family(); }); return; }
  D.makeFamily('config');
}());
