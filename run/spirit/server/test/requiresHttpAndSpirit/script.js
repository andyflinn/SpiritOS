'use strict';
// goal/G50.1, the box: "server requires http and spirit/script.js". The subject's code, comments left out, requires both.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var code = require('fs').readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  var http = /require\(\s*['"]http['"]\s*\)/.test(code);
  var spirit = /require\(\s*[^)]*['"](\.\.\/script\.js|\.\.\/script|[^'"]*spirit\/script\.js)['"]/.test(code) || /require\(\s*path\.join\([^)]*['"]script\.js['"]/.test(code);
  return http && spirit;
};
