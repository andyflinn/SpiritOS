'use strict';
// goal/G50.1, the box: "repo://run/spirit/script.js gains its first function: spirit.requireScript()", "both in the
// browser and node.js". Required in node, and run as a page runs it (window, no module), it holds a function requireScript.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var node = typeof require(file).requireScript === 'function';
  var page = {};
  page.window = page;
  require('vm').runInNewContext(require('fs').readFileSync(file, 'utf8'), page);
  return node && !!page.window.spirit && typeof page.window.spirit.requireScript === 'function';
};
