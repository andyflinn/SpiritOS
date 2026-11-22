'use strict';
// goal/G50.1, the box: "everything inside repo:/run/ is gitignored except repo:/run/spirit/". git counts a file and a
// folder in repo://run/ ignored, and a file in repo://run/spirit/ not.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var path = require('path');
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var file = path.join(run, subject);
  var spawnSync = require('child_process').spawnSync;
  function ignored(p) { return spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: run }).status === 0; }
  return ignored('zzSomeFile.js') && ignored('zzSomeFolder/x.js') && !ignored('spirit/zzSomeFile.js') && !ignored('spirit/zzA/zz.js');
};
