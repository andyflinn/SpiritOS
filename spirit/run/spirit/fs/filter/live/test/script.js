'use strict';

// spirit/run/spirit/fs/filter/live/test/script.js
// THE TESTS OF spirit/fs/filter/live/script.js, and of no other script (spec: ./script.md). goal/G49.15, box v16: "A third flag,
// live, on an app folder's row, set from spirit/state/<app>/node.json when that file changes"; "the flag conditions live in
// spirit/fs/filter/<flagName>/script.js". Its shape, (dir, read), read(path) answering a file's text or null, as the fs
// cache's writer asks it (cw, goal/G49.15: "live takes (dir, read) ... since it reads node.json's content"). The owner's
// switch is node.json's active.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
// IT EXPOSES AN OBJECT, NEVER A BARE FUNCTION (goal/G49.16, Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING
// OBJECT. PERIOD!"; box v4: "spirit/fs/filter/live/script.js { live }"): asked in a process of its own, spirit.requireScript answers an
// object holding live, each a function.
test.run('spirit/fs/filter/live/script.js exposes an object holding live, never a bare function', 0.2, function () {
  const P = require('path');
  let run = __dirname;
  while (run !== P.dirname(run) && !require('fs').existsSync(P.join(run, 'spirit', 'script.js'))) run = P.dirname(run);
  const r = require('child_process').spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); let m = null; try { m = spirit.requireScript('spirit/fs/filter/live/script.js'); } catch (e) { m = null; } process.stdout.write(JSON.stringify({ t: typeof m, k: ['live'].map(function (k) { return m ? typeof m[k] : ''; }) }));"], { cwd: run, encoding: 'utf8', timeout: 20000 });
  let o = null; try { o = JSON.parse(r.stdout); } catch (e) { o = null; }
  return (!!o && o.t === 'object' && o.k.length === 1 && o.k.every(function (k) { return k === 'function'; })) || false;
}, test.limit.quick);
let F = null;
try { F = SPIRIT.requireScript('spirit/fs/filter/live/script.js'); } catch (e) { F = null; }
// The run folder's files by path, their text: read(path) answers it, null for a file not there.
function ask(dir, files) { try { return F.live(dir, function (p) { return Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null; }); } catch (e) { return 'threw'; } }

test.run('it holds its function, live(dir, read)', 0.2, function () { return typeof (F && F.live) === 'function' || false; }, test.limit.quick);
test.run('an app folder whose node.json says active true is live', 0.2, function () { return ask('spirit/app/zz', { 'spirit/state/zz/node.json': '{"active":true}' }) === true || false; }, test.limit.quick);
test.run('an app folder whose node.json says active false is not live', 0.2, function () { return ask('spirit/app/zz', { 'spirit/state/zz/node.json': '{"active":false}' }) === false || false; }, test.limit.quick);
test.run('an app folder with no node.json is not live', 0.2, function () { return ask('spirit/app/zz', {}) === false || false; }, test.limit.quick);
test.run('an app folder whose node.json is no json is not live', 0.2, function () { return ask('spirit/app/zz', { 'spirit/state/zz/node.json': 'not json' }) === false || false; }, test.limit.quick);
test.run('another app\'s node.json does not make it live', 0.2, function () { return ask('spirit/app/zz', { 'spirit/state/other/node.json': '{"active":true}' }) === false || false; }, test.limit.quick);
test.run('a folder that is no app folder is not live', 0.2, function () { return ask('spirit/zz', { 'spirit/state/zz/node.json': '{"active":true}' }) === false || false; }, test.limit.quick);
