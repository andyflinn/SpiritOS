'use strict';
// goal/G50.1, box v23, Open: "state.json files need a gitignore line"; Decided: "results, classification and execution time
// land back beside the test, in test/<id>/state.json", and general verdicts in "that script's test/general/<id>/state.json".
// The shape is Andy's Q1 answer: a test exports {title, check(spirit)}, and testicle's classifier decides where it runs.
// git ignores a state.json in a test folder and in a general one, at any depth, and never a test's script.js.
module.exports = {
  title: 'every test/<id>/state.json is gitignored, and no test script is',
  check: function () {
    var path = require('path');
    var spawnSync = require('child_process').spawnSync;
    // Loaded by requireScript there is no __dirname, so git asks from the folder of the spirit object, repo://run/spirit/,
    // which require resolves for us, wherever this test stands.
    var spiritFolder = path.dirname(require.resolve('./script.js'));
    function ignored(p) { return spawnSync('git', ['check-ignore', '-q', '--no-index', p.replace(/^run\/spirit\//, '')], { cwd: spiritFolder }).status === 0; }
    return ignored('run/spirit/test/zzSomeTest/state.json') &&
      ignored('run/spirit/server/test/zzSomeTest/state.json') &&
      ignored('run/spirit/server/test/general/zzSomeGeneral/state.json') &&
      ignored('run/spirit/zzA/zzB/test/zzSomeTest/state.json') &&
      !ignored('run/spirit/test/zzSomeTest/script.js') &&
      !ignored('run/spirit/server/test/zzSomeTest/script.js');
  }
};
