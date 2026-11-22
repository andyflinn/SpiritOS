'use strict';
// spirit/run/spirit/owner/data.js
// WHAT A CLIENT KNOWS OF THE owner FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; its api.js requires it, and no other file does.
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: no client reads the owner's boxes or sends his commands from a page yet; the first that reads boxSearch or boxGet keeps the boxes here.
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.required.spirit.data.owner.data for them, as every family's readers do.
(function family() {
  // Its reads stand at spirit.required.spirit.data.owner.data as every family's do, and it has none yet.
  var D = typeof require === 'function' ? require('../spirit.js').require('spirit/data.js') : window.spirit.required.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.require,
  // data.js exactly as api.js"): on a page that has not loaded spirit/data.js yet, this file loads it and runs again.
  if (!D) { window.spirit.require('spirit/data.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('owner');
}());
