'use strict';

// spirit/run/spirit/fs/filter/api/test/script.js
// THE TESTS OF spirit/fs/filter/api/script.js, and of no other script (spec: ./script.md). goal/G49.15, box v16: "One condition per
// flag, each its own small script: api (old, api.js and data.js), branch (new, script.js and client/script.js), app
// (<name>/<name>.json)"; "the flag conditions live in spirit/fs/filter/<flagName>/script.js". Its shape, (dir, has) answering
// true or false, as the fs cache's writer asks it (spirit/fs/server/script.js).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
let F = null;
try { F = SPIRIT.requireScript('spirit/fs/filter/api/script.js'); } catch (e) { F = null; }
// A folder's files as the fs cache holds them: has(path) is true for each path listed.
function hasOf(files) { return function (p) { return files.indexOf(p) !== -1; }; }
function ask(dir, files) { try { return F(dir, hasOf(files)); } catch (e) { return 'threw'; } }

test.run('it is a function, (dir, has)', 0.2, function () { return typeof F === 'function' || false; }, test.limit.quick);
test.run('a folder holding api.js and data.js is api', 0.2, function () { return ask('spirit/zz', ['spirit/zz/api.js', 'spirit/zz/data.js']) === true || false; }, test.limit.quick);
test.run('a folder holding api.js alone is not api', 0.2, function () { return ask('spirit/zz', ['spirit/zz/api.js']) === false || false; }, test.limit.quick);
test.run('a folder holding data.js alone is not api', 0.2, function () { return ask('spirit/zz', ['spirit/zz/data.js']) === false || false; }, test.limit.quick);
test.run('a folder holding neither is not api', 0.2, function () { return ask('spirit/zz', ['spirit/zz/script.js']) === false || false; }, test.limit.quick);
