'use strict';
// spirit/run/spirit/peer/data.js
// WHAT A CLIENT KNOWS OF THE peer FAMILY, IN ITS OWN FOLDER (goal/G41.28). Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; its api.js requires it, and no other file does.
//
// IT KEEPS NOTHING, AND NAMES NO BRANCH: peer.post carries a packet and peer.acquire files a key, whose row the contact family's manager keeps (spirit.required.spirit.data.contact.data).
// A verb of this family that comes to answer rows a client reads again names its branch here, and its readers ask
// spirit.required.spirit.data.peer.data for them, as every family's readers do.
(function family(given) {
  // Its reads stand at spirit.required.spirit.data.peer.data as every family's do, and it has none yet.
  var D = typeof require === 'function' ? require('../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got); }); return; }
  D.makeFamily('peer');
}());
