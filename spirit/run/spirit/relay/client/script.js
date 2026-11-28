'use strict';
// spirit/run/spirit/relay/client/script.js
// WHAT A CLIENT KNOWS OF A RELAY'S BRANCH (goal/G49.25, box v25: spirit.relay "implemented properly as a system branch in the tree").
// Loaded by its branch's script (spirit/relay/script.js), the one file that requires it. A relay's rows travel on its members' stream
// and in sealed answers, never on a node's job stream, so its client keeps none yet; it is the branch's other half, by which the fs
// cache marks spirit/relay a branch on a relay (spirit/fs/filter/branch/script.js), and where its reads stand when it has some.
(function family(given, out) {
  var OUT = out || {};
  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23): this file runs again with it once it has loaded.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }
  D.handOut(OUT, D.makeFamily('spirit.relay', function () { return {}; }));
}());
