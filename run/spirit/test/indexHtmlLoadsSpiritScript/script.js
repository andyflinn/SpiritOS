'use strict';
// goal/G50.1; Andy, of the page source: "shouldn't the script tag specify spirit/script.js, and no fudging of the
// namespace???". index.html's script tag names the spirit object by its tree path, spirit/script.js.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var html = require('fs').readFileSync(path.join(path.dirname(file), 'index.html'), 'utf8');
  return /<script[^>]*\bsrc=["']\/?spirit\/script\.js["']/i.test(html);
};
