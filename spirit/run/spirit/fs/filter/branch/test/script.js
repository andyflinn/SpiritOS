'use strict';

// spirit/run/spirit/fs/filter/branch/test/script.js
// THE TESTS OF spirit/fs/filter/branch/script.js, and of no other script (spec: ./script.md). goal/G49.15, box v16: "One condition per
// flag, each its own small script: api (old, api.js and data.js), branch (new, script.js and client/script.js), app
// (<name>/<name>.json)"; "the flag conditions live in spirit/fs/filter/<flagName>/script.js". Its shape, (dir, has) answering
// true or false, as the fs cache's writer asks it (spirit/fs/server/script.js).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
// IT EXPOSES AN OBJECT, NEVER A BARE FUNCTION (goal/G49.16, Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING
// OBJECT. PERIOD!"; box v4: "spirit/fs/filter/branch/script.js { branch }"): asked in a process of its own, spirit.requireScript answers an
// object holding branch, each a function.
test.run('spirit/fs/filter/branch/script.js exposes an object holding branch, never a bare function', 0.2, function () {
  const P = require('path');
  let run = __dirname;
  while (run !== P.dirname(run) && !require('fs').existsSync(P.join(run, 'spirit', 'script.js'))) run = P.dirname(run);
  const r = require('child_process').spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); let m = null; try { m = spirit.requireScript('spirit/fs/filter/branch/script.js'); } catch (e) { m = null; } process.stdout.write(JSON.stringify({ t: typeof m, k: ['branch'].map(function (k) { return m ? typeof m[k] : ''; }) }));"], { cwd: run, encoding: 'utf8', timeout: 20000 });
  let o = null; try { o = JSON.parse(r.stdout); } catch (e) { o = null; }
  return (!!o && o.t === 'object' && o.k.length === 1 && o.k.every(function (k) { return k === 'function'; })) || false;
}, test.limit.quick);
let F = null;
try { F = SPIRIT.requireScript('spirit/fs/filter/branch/script.js'); } catch (e) { F = null; }
// A folder's files as the fs cache holds them: has(path) is true for each path listed.
function hasOf(files) { return function (p) { return files.indexOf(p) !== -1; }; }
function ask(dir, files) { try { return F(dir, hasOf(files)); } catch (e) { return 'threw'; } }

test.run('it is a function, (dir, has)', 0.2, function () { return typeof F === 'function' || false; }, test.limit.quick);
test.run('a folder holding script.js and client/script.js is a branch', 0.2, function () { return ask('spirit/zz', ['spirit/zz/script.js', 'spirit/zz/client/script.js']) === true || false; }, test.limit.quick);
test.run('a folder holding script.js alone is not a branch, as contact, fs and job are today', 0.2, function () { return ask('spirit/zz', ['spirit/zz/script.js']) === false || false; }, test.limit.quick);
test.run('a folder holding client/script.js alone is not a branch', 0.2, function () { return ask('spirit/zz', ['spirit/zz/client/script.js']) === false || false; }, test.limit.quick);
test.run('a folder holding api.js and data.js, the old shape, is not a branch', 0.2, function () { return ask('spirit/zz', ['spirit/zz/api.js', 'spirit/zz/data.js']) === false || false; }, test.limit.quick);
