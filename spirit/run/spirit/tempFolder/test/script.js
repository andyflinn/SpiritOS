'use strict';

// spirit/run/spirit/tempFolder/test/script.js
// The tests of spirit/tempFolder/script.js, and of no other module (spec: ./script.md; goal/G47.1, the box, OTHER STUFF, no
// pollution: names and folders). Every folder it makes is under the system temp folder and removed after.
require('../../script.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');
// IT EXPOSES AN OBJECT, NEVER A BARE FUNCTION (goal/G49.16, Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING
// OBJECT. PERIOD!"; box v4: "spirit/tempFolder/script.js { tempFolder, path }"): asked in a process of its own, spirit.requireScript answers an
// object holding tempFolder and path, each a function.
test.run('spirit/tempFolder/script.js exposes an object holding tempFolder and path, never a bare function', 0.2, function () {
  const P = require('path');
  let run = __dirname;
  while (run !== P.dirname(run) && !require('fs').existsSync(P.join(run, 'spirit', 'script.js'))) run = P.dirname(run);
  const r = require('child_process').spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); let m = null; try { m = spirit.requireScript('spirit/tempFolder/script.js'); } catch (e) { m = null; } process.stdout.write(JSON.stringify({ t: typeof m, k: ['tempFolder', 'path'].map(function (k) { return m ? typeof m[k] : ''; }) }));"], { cwd: run, encoding: 'utf8', timeout: 20000 });
  let o = null; try { o = JSON.parse(r.stdout); } catch (e) { o = null; }
  return (!!o && o.t === 'object' && o.k.length === 2 && o.k.every(function (k) { return k === 'function'; })) || false;
}, test.limit.quick);

const FILE = path.join(RUN, 'spirit', 'tempFolder', 'script.js');
let T = null;
const made = [];
test.after(function () { made.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } }); });

// A run of its own, with a key of its own, in the system temp folder.
const KEY = 'zz-test-public-key';
const FAKE_RUN = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-run-'));
made.push(FAKE_RUN);
fs.mkdirSync(path.join(FAKE_RUN, 'spirit', 'state'), { recursive: true });
fs.writeFileSync(path.join(FAKE_RUN, 'spirit', 'state', 'identity.json'), JSON.stringify({ publicKey: KEY }));
const NODE = crypto.createHash('sha256').update(KEY).digest('hex').slice(0, 16);

// Its place since goal/G49.23: on the spirit object itself, spirit.tempFolder (no spirit.required).
test.run('it loads through spirit.requireScript and stands at spirit.tempFolder', 0.4, function () {
  if (!fs.existsSync(FILE)) return false;
  T = spirit.requireScript('spirit/tempFolder/script.js').tempFolder;
  return typeof T === 'function' && !!spirit.tempFolder && spirit.tempFolder.tempFolder === T || false;
}, test.limit.quick);
// The box: "the system temp folder, then spirit, then the node, then the route".
test.run('a job\'s folder is the system temp folder, then spirit, then the node, then the route', 0.4, function () {
  if (!T) return false;
  const d = T('spirit.app.zzJob', { run: FAKE_RUN }); made.push(path.join(os.tmpdir(), 'spirit', NODE));
  return d === path.join(os.tmpdir(), 'spirit', NODE, 'spirit.app.zzJob') && fs.statSync(d).isDirectory() || false;
}, test.limit.quick);
test.run('a suite\'s path makes a folder of each of its parts', 0.4, function () {
  if (!T) return false;
  const d = T('spirit/zz/test/zzSuite', { run: FAKE_RUN });
  return d === path.join(os.tmpdir(), 'spirit', NODE, 'spirit', 'zz', 'test', 'zzSuite') && fs.statSync(d).isDirectory() || false;
}, test.limit.quick);
// "The node is named by the first 16 hex characters of the hash of its key."
test.run('the node is named by the first 16 hex characters of the sha256 of its key', 0.4, function () {
  if (!T) return false;
  return path.basename(path.dirname(T.path('zzRoute', { run: FAKE_RUN }))) === NODE || false;
}, test.limit.quick);
test.run('two runs with different keys never share a folder', 0.4, function () {
  if (!T) return false;
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-run-')); made.push(other);
  fs.mkdirSync(path.join(other, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(other, 'spirit', 'state', 'identity.json'), JSON.stringify({ publicKey: 'zz-other-key' }));
  return T.path('zzRoute', { run: other }) !== T.path('zzRoute', { run: FAKE_RUN }) || false;
}, test.limit.quick);
// "No process id in a temp path."
test.run('no process id is in the path', 0.4, function () {
  if (!T) return false;
  return T.path('spirit.app.zzJob', { run: FAKE_RUN }).split(path.sep).indexOf(String(process.pid)) === -1 || false;
}, test.limit.quick);
// "made empty when asked"
test.run('asked again, it hands the folder back empty', 0.4, function () {
  if (!T) return false;
  const d = T('spirit.app.zzEmpty', { run: FAKE_RUN });
  fs.writeFileSync(path.join(d, 'left.txt'), 'left behind');
  const again = T('spirit.app.zzEmpty', { run: FAKE_RUN });
  return again === d && fs.readdirSync(d).length === 0 || false;
}, test.limit.quick);
test.run('path names the same folder and makes nothing', 0.4, function () {
  if (!T) return false;
  const p = T.path('spirit.app.zzNever', { run: FAKE_RUN });
  return p === path.join(os.tmpdir(), 'spirit', NODE, 'spirit.app.zzNever') && !fs.existsSync(p) || false;
}, test.limit.quick);
test.run('a route with an empty part, a . or .. part, or another character is refused', 0.4, function () {
  if (!T) return false;
  const bad = ['', 'a//b', '../x', 'a/./b', 'a b', 'a\\b', '/a', 'a/'];
  return bad.every(function (r) { try { T.path(r, { run: FAKE_RUN }); return false; } catch (e) { return /tempFolder:/.test(e.message); } }) || false;
}, test.limit.quick);
test.run('a run with no key yet is named by its own path, hashed the same way', 0.2, function () {
  if (!T) return false;
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-bare-')); made.push(bare);
  const want = crypto.createHash('sha256').update('run:' + path.resolve(bare)).digest('hex').slice(0, 16);
  return path.basename(path.dirname(T.path('zzRoute', { run: bare }))) === want || false;
}, test.limit.quick);

// IT LEAVES NO GARBAGE (goal/G49.23; Andy: "make sure spirit/tempFolder/ leaves NO garbage, use tests to ensure that"): a
// test or a process that is killed, by its time limit or a crash, never cleans its own spot; so each spot is marked with the
// process that asked for it, and every hand-out removes the spots whose process is gone. A live process's spots stay.
const CP = require('child_process');
function childMakes(route, stay) {
  const code = "require('./spirit/script.js'); const d = spirit.requireScript('spirit/tempFolder/script.js').tempFolder(" + JSON.stringify(route) + "); process.stdout.write(d + '\\n');" + (stay ? ' setInterval(function () {}, 1000);' : '');
  return CP.spawn(process.execPath, ['-e', code], { cwd: RUN, stdio: ['ignore', 'pipe', 'ignore'] });
}
function dirOf(child) {
  return new Promise(function (resolve) { let out = ''; child.stdout.on('data', function (b) { out += b; if (/\n/.test(out)) resolve(out.trim()); }); child.on('exit', function () { resolve(out.trim()); }); });
}
test.run('a spot whose process has ended is removed by the next hand-out', 0.2, async function () {
  const T2 = S.requireScript('spirit/tempFolder/script.js');
  const kid = childMakes('zzLeft/gone', false);
  const dir = await dirOf(kid);
  await new Promise(function (r) { if (kid.exitCode !== null) r(); else kid.on('exit', r); });
  if (!dir || !fs.existsSync(dir)) return false;
  made.push(T2.tempFolder('zzLeft/other'));
  return !fs.existsSync(dir) || false;
}, test.limit.slow);
test.run('a spot whose process still runs stays through another hand-out', 0.2, async function () {
  const T2 = S.requireScript('spirit/tempFolder/script.js');
  const kid = childMakes('zzLeft/alive', true);
  const dir = await dirOf(kid);
  try {
    if (!dir || !fs.existsSync(dir)) return false;
    made.push(T2.tempFolder('zzLeft/another'));
    return fs.existsSync(dir) || false;
  } finally { try { kid.kill(); } catch (e) { /* gone */ } made.push(dir); }
}, test.limit.slow);
test.run('a process\'s own spot stays through its own next hand-out', 0.2, function () {
  const T2 = S.requireScript('spirit/tempFolder/script.js');
  const mine = T2.tempFolder('zzLeft/mine');
  made.push(mine);
  made.push(T2.tempFolder('zzLeft/mineToo'));
  return fs.existsSync(mine) || false;
}, test.limit.quick);

// EVERY NODE'S ROOT IS SWEPT (goal/G49.27; Andy: "the test system is STILL littering all over the TEMP folders"; cw measured 191
// run folders in his Windows temp, most holding only .owners): a hand-out in a fresh process sweeps every root under
// <tmp>/spirit, not its own alone. Three planted roots of other nodes: one with a spot of a dead process (the spot goes, and with
// no live owner left and an hour untouched the root goes too), one with no owner at all and an hour old (it goes whole), and one
// whose owner is this test, alive, though as old (it stays).
const os2 = require('os');
const ROOTS = path.join(os2.tmpdir(), 'spirit');
function plantRoot(name, ownerPid, ageMs) {
  const root = path.join(ROOTS, name);
  const spot = path.join(root, 'zzPlanted', 'spot');
  fs.mkdirSync(spot, { recursive: true });
  fs.writeFileSync(path.join(spot, 'kept.txt'), 'x');
  if (ownerPid !== null) {
    fs.mkdirSync(path.join(root, '.owners'), { recursive: true });
    fs.writeFileSync(path.join(root, '.owners', 'zz.json'), JSON.stringify({ pid: ownerPid, dir: spot }));
  }
  const then = new Date(Date.now() - ageMs);
  fs.utimesSync(root, then, then);
  return { root: root, spot: spot };
}
const DEAD = (function () { const r = CP.spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }); return Number(r.stdout); }());
const PLANT = {};
test.run('a hand-out in a fresh process sweeps three planted roots of other nodes', 0.2, function () {
  PLANT.dead = plantRoot('zzRootDead' + process.pid, DEAD, 2 * 3600000);
  PLANT.none = plantRoot('zzRootNone' + process.pid, null, 2 * 3600000);
  PLANT.live = plantRoot('zzRootLive' + process.pid, process.pid, 2 * 3600000);
  // the planted spots' mtimes were set on the roots after writing into them; the hand-out runs in a process of its own
  const r = CP.spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); const d = spirit.requireScript('spirit/tempFolder/script.js').tempFolder('zzSweepAll/one'); process.stdout.write(d);"], { cwd: RUN, encoding: 'utf8', timeout: 20000 });
  if (r.stdout) made.push(r.stdout);
  return (r.status === 0 && !!r.stdout) || false;
}, test.limit.slow);
test.run('a spot of a dead process in another node\'s root is removed, and that root with it once no live owner is left', 0.2, function () {
  return (!!PLANT.dead && !fs.existsSync(PLANT.dead.spot) && !fs.existsSync(PLANT.dead.root)) || false;
}, test.limit.quick);
test.run('a root no process owns, untouched for an hour, is removed whole', 0.2, function () {
  return (!!PLANT.none && !fs.existsSync(PLANT.none.root)) || false;
}, test.limit.quick);
test.run('a root whose owner still runs stays, its spot with it, however old', 0.2, function () {
  const kept = !!PLANT.live && fs.existsSync(PLANT.live.spot);
  if (PLANT.live) try { fs.rmSync(PLANT.live.root, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
  return kept || false;
}, test.limit.quick);
