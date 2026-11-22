'use strict';
// goal/G50.1; Andy: "in the browser, /spirit/script.js will create an empty global object window.spirit", "no
// spirit.name nothing, no bells, no whistles"; box v24: "holding nothing but its functions". Run as a page runs it, with
// window and no module, the subject leaves window.spirit an object whose only own key is requireScript.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var page = {};
  page.window = page;
  require('vm').runInNewContext(require('fs').readFileSync(file, 'utf8'), page);
  var s = page.window.spirit;
  return !!s && typeof s === 'object' && Object.getOwnPropertyNames(s).join() === 'requireScript' && Object.getOwnPropertySymbols(s).length === 0;
};
