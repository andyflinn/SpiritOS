'use strict';
// goal/G50.1, box v23, Open: "state.json files need a gitignore line"; Decided: results "land back beside the test, in
// test/<id>/state.json", and general verdicts in "that script's test/general/<id>/state.json".
// The shape is Andy's: the id is the folder, so no title; "a test ... gets the exact spirit path of it's subject
// ('spirit/server/script.js') as an argument and returns true or false"; it is loaded by spirit.requireScript.
// git ignores a state.json in a test folder and in a general one, at any depth, and never a test's script.js.
module.exports = function (subject) {
  var path = require('path');
  var spawnSync = require('child_process').spawnSync;
  // The subject's path is relative to repo://run/; requireScript hands a test the require of repo://run/spirit/script.js,
  // so run/ is one folder above what './script.js' resolves to. git asks from the subject's folder.
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var folder = path.dirname(path.join(run, subject));
  function ignored(p) { return spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: folder }).status === 0; }
  return ignored('test/zzSomeTest/state.json') &&
    ignored('server/test/zzSomeTest/state.json') &&
    ignored('server/test/general/zzSomeGeneral/state.json') &&
    ignored('zzA/zzB/test/zzSomeTest/state.json') &&
    !ignored('test/zzSomeTest/script.js') &&
    !ignored('server/test/zzSomeTest/script.js');
};
