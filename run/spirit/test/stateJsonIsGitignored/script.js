'use strict';
// goal/G50.1, box v23, Open: "state.json files need a gitignore line"; Decided: results "land back beside the test, in
// test/<id>/state.json", and general verdicts in "that script's test/general/<id>/state.json".
// The shape is Andy's: the test's id is its folder, spirit.test.stateJsonIsGitignored, so it has no title; "test function
// JUST returns a result"; and "a test ALWAYS KNOWS WHERE the script that it tests is: from it's own location: ../../script.js".
// git ignores a state.json in a test folder and in a general one, at any depth, and never a test's script.js.
module.exports = function () {
  var path = require('path');
  var spawnSync = require('child_process').spawnSync;
  // The script this test tests, found from the test's own place, as every test finds it.
  var spiritFolder = path.dirname(require.resolve('../../script.js'));
  function ignored(p) { return spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: spiritFolder }).status === 0; }
  return ignored('test/zzSomeTest/state.json') &&
    ignored('server/test/zzSomeTest/state.json') &&
    ignored('server/test/general/zzSomeGeneral/state.json') &&
    ignored('zzA/zzB/test/zzSomeTest/state.json') &&
    !ignored('test/zzSomeTest/script.js') &&
    !ignored('server/test/zzSomeTest/script.js');
};
