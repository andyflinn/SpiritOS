'use strict';

// spirit/run/spirit/fs/server/test/script.js
// THE TESTS OF spirit/fs/server/script.js, THE FILE WATCHER, and of no other script (spec: ./script.md). goal/G49.15, box v16:
// "The watcher leaves spirit/job/engine/script.js for the fs branch, with the flags. job/script.js keeps the jobs and the app
// starts."; "the watcher lands in spirit/fs/server/script.js and is required by the node"; "spirit/job/chokidar/ and
// spirit/job/readdirp/ move to spirit/fs/chokidar/ and spirit/fs/readdirp/"; "the flag conditions live in
// spirit/fs/filter/<flagName>/script.js and will be required by the fs portion of the node process"; "A third flag, live, on
// an app folder's row, set from spirit/state/<app>/node.json when that file changes". Its start(rootDir, jobs) answers its
// job (cw, goal/G49.15). The watcher's checks once in spirit/job/engine/test/script.js moved here with it.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = SPIRIT.requireScript('spirit/test/testReport.js');
function readRun(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return ''; } }
function codeOf(p) { return readRun(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }

// ── where it lives (box v16) ──
test.run('spirit/fs/server/script.js is there, and answers start', 0.2, function () {
  let W = null; try { W = SPIRIT.requireScript('spirit/fs/server/script.js'); } catch (e) { W = null; }
  return (!!W && typeof W.start === 'function') || false;
}, test.limit.quick);
test.run('job/script.js keeps no watcher: it names no chokidar, no folderFlags and no startFsWatcherJob', 0.2, function () {
  const c = codeOf('spirit/job/engine/script.js');
  return (c.length > 0 && !/chokidar|folderFlags|startFsWatcherJob/.test(c)) || false;
}, test.limit.quick);
// The server, node and relay alike, since goal/G49.25 (box v16: "spirit/server/script.js is THE server").
test.run('the server requires the watcher by its path, spirit/fs/server/script.js', 0.2, function () {
  return codeOf('spirit/server/script.js').indexOf("spirit.requireScript('spirit/fs/server/script.js')") !== -1 || false;
}, test.limit.quick);
test.run('the watcher requires each flag condition by its path: spirit/fs/filter/api/, branch/, app/ and live/script.js', 0.2, function () {
  const c = codeOf('spirit/fs/server/script.js');
  return ['api', 'branch', 'app', 'live'].every(function (n) { return c.indexOf("requireScript('spirit/fs/filter/" + n + "/script.js')") !== -1; }) || false;
}, test.limit.quick);
test.run('nothing is left in spirit/job/chokidar/ or spirit/job/readdirp/', 0.2, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'job', 'chokidar')) && !fs.existsSync(path.join(RUN, 'spirit', 'job', 'readdirp'))) || false;
}, test.limit.quick);

// NO run://node_modules/: chokidar and readdirp in spirit/job/ (goal/G43.25; spec: ./script.md, its section). Andy: "can we
// hide those suckers in spirit/jobs/ for now? without the damn node_modules container?". The two libraries sit in spirit/job/,
// job.js's own folder, and job.js is the user that brings them: they move whole, chokidar finds readdirp by path, job.js
// requires it by path, its fs-watcher job works as before, nothing names spirit/run/node_modules. deskClient's use is
// spirit/app/deskClient/server/test/server.js, its chokidar part; fileSystem.js's one list of vendored folders is
// ./fileSystem.js, its vendoredFolders part. The tree read as it is; the watcher run in a child process on a scratch folder.

// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const NEW = 'spirit/run/spirit/fs/';  // since goal/G49.15 (box v16), spirit/job/ before
// The suites that name the old folder on purpose, left out of the scan (5): this one, job.js, and fileSystem's and
// deskClient's, by the names they had and the one test file each is folded into.
const SELF = /spirit\/run\/spirit\/fs\/server\/test\/script\.(js|md)$|spirit\/run\/spirit\/test\/(job|job-vendoredLibraries|fileSystem|fileSystem-vendoredFolders)\.(js|md)$|spirit\/run\/spirit\/app\/deskClient\/test\/(deskClient|deskClient-chokidar)\.(js|md)$/;
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
const VL = { tracked: [] };

// vendoredLibraries: chokidar and readdirp in spirit/fs/ (goal/G49.15, box v16), no run://node_modules (goal/G43.25)
// the world
test.run('the base commit holds the 12 files of spirit/run/node_modules/, chokidar and readdirp', 0.2, function () {
  const before = git('ls-tree -r --name-only ' + BASE + ' -- ' + OLD).split('\n').filter(Boolean);
  return before.length === 12 && before.indexOf(OLD + 'chokidar/index.js') !== -1 && before.indexOf(OLD + 'readdirp/index.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('more than a hundred tracked files on disk are read', 0.2, function () {
  VL.tracked = git('ls-files').split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  return VL.tracked.length > 100 ? true : false;
}, test.limit.quick);

// 1. both folders move whole to spirit/job/, spirit/run/node_modules/ is gone
// Each of the twelve written out, so that each check has a plain title of its own.
const movedWhole = function (rel) {
  const f = OLD + rel;
  const to = NEW + f.slice(OLD.length);
  const there = fs.existsSync(path.join(REPO, to)) && VL.tracked.indexOf(to) !== -1;
  if (!there) return false;
  if (rel === 'chokidar/index.js') return true;
  const same = fs.readFileSync(path.join(REPO, to), 'latin1').replace(/\r\n/g, '\n') === execSync('git show ' + BASE + ':' + f, { cwd: REPO, maxBuffer: 1 << 26 }).toString('latin1').replace(/\r\n/g, '\n');
  return same ? true : false;
};
test.run('spirit/run/spirit/fs/chokidar/LICENSE is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/LICENSE'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/README.md is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/README.md'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/handler.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/handler.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/handler.js is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/handler.js'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/index.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/index.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/index.js is there, in git, its one changed line judged by the import checks', 0.2, function () { return movedWhole('chokidar/index.js'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/chokidar/package.json is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/package.json'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/readdirp/LICENSE is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/LICENSE'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/readdirp/README.md is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/README.md'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/readdirp/index.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/index.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/readdirp/index.js is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/index.js'); }, test.limit.quick);
test.run('spirit/run/spirit/fs/readdirp/package.json is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/package.json'); }, test.limit.quick);
const keeps = function (n) {
  const dir = path.join(REPO, NEW, n);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return files.indexOf('package.json') !== -1 && files.some(function (x) { return /^licen[cs]e/i.test(x); }) ? true : false;
};
test.run('spirit/fs/chokidar/ keeps its package.json and licence', 0.2, function () { return keeps('chokidar'); }, test.limit.quick);
test.run('spirit/fs/readdirp/ keeps its package.json and licence', 0.2, function () { return keeps('readdirp'); }, test.limit.quick);

// 2. chokidar finds readdirp by path, the one line changed in the library
const idxNew = path.join(REPO, NEW, 'chokidar', 'index.js');
test.run('line 6 of chokidar\'s index.js at the base commit imports readdirp by name', 0.2, function () {
  VL.now = fs.existsSync(idxNew) ? fs.readFileSync(idxNew, 'utf8').split(/\r?\n/) : [];
  VL.was = execSync('git show ' + BASE + ':' + OLD + 'chokidar/index.js', { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/);
  return !!/from\s+['"]readdirp['"]/.test(VL.was[5] || '') ? true : false;
}, test.limit.quick);
test.run('line 6 of spirit/fs/chokidar/index.js imports from "../readdirp/index.js"', 0.2, function () {
  const now = VL.now || [];
  return !!/from\s+['"]\.\.\/readdirp\/index\.js['"]/.test(now[5] || '') ? true : false;
}, test.limit.quick);
test.run('no other line of index.js changed', 0.2, function () {
  const now = VL.now || [];
  const was = VL.was || [];
  const differ = now.length ? was.map(function (l, i) { return l === now[i] ? -1 : i + 1; }).filter(function (i) { return i !== -1; }) : [];
  return now.length === was.length && differ.length === 1 && differ[0] === 6 ? true : false;
}, test.limit.quick);
test.run('index.js names readdirp by name nowhere', 0.2, function () {
  const now = VL.now || [];
  return now.length && !now.some(function (l) { return !!/from\s+['"]readdirp['"]|require(?:Script)?\(\s*['"]readdirp['"]\s*\)/.test(l); }) ? true : false;
}, test.limit.quick);

// 3. the two users require it by path: job.js here, deskClient.js in its own test
test.run('spirit/run/spirit/fs/server/script.js, the watcher, requires chokidar by a path that is spirit/fs/chokidar/index.js', 0.2, function () {
  const u = 'spirit/run/spirit/fs/server/script.js';
  const c = code(fs.readFileSync(path.join(REPO, u), 'utf8'));
  const specs = (c.match(/require(?:Script)?\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require(?:Script)?\(\s*['"]|['"]\s*\)$/g, ''); });
  let to = '';
  // goal/G43.32: loaded by spirit.requireScript, by its run-root path ("spirit/jobs/chokidar/index.js"); a relative path is the old way.
  try { to = specs.length === 1 ? require.resolve(specs[0].charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, u)), specs[0]) : path.join(RUN, specs[0])) : ''; } catch (e) { to = ''; }
  return to === idxNew ? true : false;
}, test.limit.quick);
test.run('no file requires chokidar by its bare name', 0.2, function () {
  const byName = VL.tracked.filter(function (f) { return /\.(js|mjs|cjs|html)$/.test(f) && !SELF.test(f) && f.indexOf(NEW + 'chokidar/') !== 0; })
    .filter(function (f) { return !!/require(?:Script)?\(\s*['"]chokidar['"]\s*\)|from\s+['"]chokidar['"]|import\(\s*['"]chokidar['"]\s*\)/.test(code(fs.readFileSync(path.join(REPO, f), 'utf8'))); });
  return !byName.length ? true : false;
}, test.limit.quick);

// 4. the file watcher works as before
// Scratch folders inside spirit/run (scanFolder refuses anything outside it, as fsWatcherCommands.js says), removed after.
function child(src, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  fs.rmSync(dir, { recursive: true, force: true });
  return String(r.stdout || '').trim();
}
// The node's fs-watcher job (the Files tree and the spirit.fs events): a file made in its folder comes as a createFile.
test.run('the fs-watcher job hears a file made.txt created in its folder', 0.2, function () {
  const jobsOut = child([
    "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
    "const W = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'server', 'script.js')) + ");",
    "let job = null; jobs.events.on('job-updated', function (u) {",
    "  if (job && u.id === job.id && u.data && u.data.command && u.data.command.op === 'createFile' && u.data.command.path === 'made.txt') { console.log('HEARD'); process.exit(0); } });",
    "job = W.start(dir, jobs);",
    "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
    "setTimeout(function () { process.exit(0); }, 12000);",
  ].join('\n'), path.join(RUN, 'vendoredFolders-jobs-test'));
  return /^HEARD/.test(jobsOut) ? true : false;
}, test.limit.slow);

// A FILE ALREADY GONE IS NO FAILURE (goal/G49.19; cw's find on Andy's Windows node, a Windows EPERM on testicle.db-journal,
// a file SQLite makes and deletes within moments, marked spirit.fs failed and stopped the file cache's feed; Andy: "cw, go",
// to "an error about a file that is already gone, EPERM, ENOENT or EBUSY on a path no longer there, is no failure; the
// watcher goes on, and only a real error fails the job"). The watcher's own error event is emitted on it, caught by the
// FSWatcher it registers its error handler on, and spirit.fs's status read back after.
function statusAfter(code, gone) {
  return child([
    "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
    "require(" + JSON.stringify(path.join(RUN, 'spirit', 'script.js')) + ");",
    "const C = spirit.requireScript('spirit/fs/chokidar/index.js');",
    "let watcher = null; const on = C.FSWatcher.prototype.on;",
    "C.FSWatcher.prototype.on = function (ev) { if (ev === 'error') watcher = this; return on.apply(this, arguments); };",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
    "const W = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'server', 'script.js')) + ");",
    "fs.writeFileSync(path.join(dir, 'there.db'), 'x');",
    "const job = W.start(dir, jobs);",
    "setTimeout(function () {",
    "  const at = path.join(dir, " + JSON.stringify(gone ? 'testicle.db-journal' : 'there.db') + ");",
    "  if (!watcher) { console.log('NO-WATCHER'); process.exit(0); }",
    "  watcher.emit('error', Object.assign(new Error(" + JSON.stringify(code) + " + ': ' + at), { code: " + JSON.stringify(code) + ", path: at }));",
    "  setTimeout(function () { const j = jobs.getJob(job.id); console.log('STATUS ' + (j ? j.status : 'none')); process.exit(0); }, 300);",
    "}, 1500);",
    "setTimeout(function () { process.exit(0); }, 12000);",
  ].join('\n'), path.join(RUN, 'vendoredFolders-gone-test'));
}
['EPERM', 'ENOENT', 'EBUSY'].forEach(function (code) {
  test.run('an ' + code + ' on a file already gone leaves spirit.fs running', 0.2, function () {
    return statusAfter(code, true) === 'STATUS running' || false;
  }, test.limit.slow);
});
test.run('an EPERM on a file still there marks spirit.fs failed', 0.2, function () {
  return statusAfter('EPERM', false) === 'STATUS failed' || false;
}, test.limit.slow);
test.run('an error of another kind, ENOSPC, marks spirit.fs failed', 0.2, function () {
  return statusAfter('ENOSPC', true) === 'STATUS failed' || false;
}, test.limit.slow);

// THE CORE FLAG IS KEPT ON THE FILE LIST (goal/G47.1; Andy: "stick that flag on the fucking file list, then you have to
// check each file once with isCore()"): the tree sent to a page that connects reads nothing from disc. Asked on every
// send, it read an app's <name>.json once per file of that app, on the node's one thread (17 of 45 s on Andy's node).
// The fs-watcher job on this checkout's run folder; then the tree asked twice, every read of an app's json counted.
let treeSent = null;
// An app of the checkout whose <name>.json says intrinsic false, and its <name>.js: the first found, never named.
const NOT_INTRINSIC = (function () {
  const apps = path.join(RUN, 'spirit', 'app');
  const name = fs.readdirSync(apps).filter(function (a) {
    try { const m = JSON.parse(fs.readFileSync(path.join(apps, a, a + '.json'), 'utf8')); return !!(m.identity && m.identity.intrinsic === false) && fs.existsSync(path.join(apps, a, a + '.js')); } catch (e) { return false; }
  })[0];
  return name ? { file: 'spirit/app/' + name + '/' + name + '.js', json: 'spirit/app/' + name + '/' + name + '.json' } : {};
}());
test.run('the fs-watcher job watches the run folder, the tree is asked twice, and reads of the app jsons are counted', 0.2, function () {
  // Not child(): it empties the folder it is given, and this one is the checkout's run folder, only read here.
  const run = function (src) { const r = spawnSync(process.execPath, ['-e', src, RUN], { cwd: RUN, encoding: 'utf8', timeout: 60000 }); return r.stderr ? '' : String(r.stdout || '').trim(); };
  const out = run([
    "const fs = require('fs'), dir = process.argv[1];",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
    "const W = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'server', 'script.js')) + ");",
    "const job = W.start(dir, jobs);",
    // goal/G49.2: the tree is spirit.client.fs, through spirit/fs/dataset/script.js, which this process's watcher fills; read once it is whole.
    "const F = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'dataset', 'script.js')) + ");",
    "const rowsOf = function () { const all = F.files(); return Object.keys(all).map(function (p) { return Object.assign({ path: p }, all[p]); }); };",
    "const end = Date.now() + 40000;",
    "(function tick() {",
    "  if (!F.ready() && Date.now() < end) return setTimeout(tick, 200);",
    "  const read = fs.readFileSync; let reads = 0;",
    "  fs.readFileSync = function (f) { if (/[\\\\/]spirit[\\\\/]app[\\\\/][^\\\\/]+[\\\\/][^\\\\/]+\\.json$/.test(String(f))) reads += 1; return read.apply(fs, arguments); };",
    "  const first = rowsOf(); const second = rowsOf();",
    "  fs.readFileSync = read;",
    "  const of = function (p) { return first.filter(function (c) { return c.path === p; })[0] || null; };",
    "  console.log(JSON.stringify({ reads: reads, files: first.length, again: second.length, spirit: of('spirit/script.js'), noCore: of(" + JSON.stringify(String(NOT_INTRINSIC.file || '')) + "), ownJson: of(" + JSON.stringify(String(NOT_INTRINSIC.json || '')) + ") }));",
    "  job._stop(); process.exit(0);",
    "})();",
  ].join('\n'));
  try { treeSent = JSON.parse(String(out).trim().split('\n').pop()); } catch (e) { treeSent = null; }
  return (!!treeSent && treeSent.files > 100) || false;
}, test.limit.slow);
test.run('the tree sent twice reads no app json from disc', 0.2, function () {
  if (!treeSent) return false;
  return treeSent.reads === 0 || false;
}, test.limit.quick);
test.run('a core file, spirit/script.js, comes with the core flag', 0.2, function () {
  if (!treeSent) return false;
  return (!!treeSent.spirit && treeSent.spirit.core === true) || false;
}, test.limit.quick);
// coreFiles.js: an app's folder is core unless its <name>.json says intrinsic false, the json itself always core. The app is
// found in the checkout by its json, never named (goal/G47.4).
test.run('a file of an app whose json says intrinsic false comes without the core flag', 0.2, function () {
  if (!NOT_INTRINSIC.file) return false;
  if (!treeSent) return false;
  return (!!treeSent.noCore && treeSent.noCore.core !== true) || false;
}, test.limit.quick);
test.run('that app\'s own json comes with the core flag', 0.2, function () {
  if (!treeSent) return false;
  return (!!treeSent.ownJson && treeSent.ownJson.core === true) || false;
}, test.limit.quick);
// THE FLAG FOLLOWS AN APP'S <name>.json (goal/G47.1, cw's fix: "again only for an app's files when its <name>.json changes";
// Andy: "we need a red so no fool takes your fix out again"). On a scratch copy of the tracked run folder (job.js judges
// core files of the tree it sits in): a planted app zzKept, its json saying intrinsic false, its zzKept.js not core; the
// json changed to intrinsic true, its zzKept.js turns core, sent as a change; changed back, it is no longer core. The
// tree is never asked to read a json as it is sent.
let flagged = null;
test.run('a scratch tree holds an app zzKept whose json turns intrinsic true and back, and its file\'s core flag is read after each', 0.2, function () {
  const tree = LABH.scratchTree();
  const root = tree.root;
  try {
    const run = path.join(root, 'spirit', 'run');
    const app = path.join(run, 'spirit', 'app', 'zzKept');
    fs.mkdirSync(app, { recursive: true });
    const manifest = function (intrinsic) { return JSON.stringify({ identity: { icon: 'z', label: 'zzKept', intrinsic: intrinsic } }); };
    fs.writeFileSync(path.join(app, 'zzKept.json'), manifest(false));
    fs.writeFileSync(path.join(app, 'zzKept.js'), '\'use strict\';\n// zzKept\n');
    const src = [
      "const fs = require('fs'), path = require('path');",
      "const run = process.argv[1];",
      "const jobs = require(path.join(run, 'spirit', 'job', 'engine', 'script.js')).installJobs(1);",
      "const W = require(path.join(run, 'spirit', 'fs', 'server', 'script.js'));",
      "const job = W.start(run, jobs);",
      "const json = path.join(run, 'spirit', 'app', 'zzKept', 'zzKept.json');",
      // goal/G49.2: the row is spirit.client.fs's, through spirit/fs/dataset/script.js, which this process's watcher fills.
      "const F = require(path.join(run, 'spirit', 'fs', 'dataset', 'script.js'));",
      "const core = function () { const c = F.file('spirit/app/zzKept/zzKept.js'); return c ? c.core === true : null; };",
      "const wait = function (want, ms) { const end = Date.now() + ms; return new Promise(function (r) { (function tick() { const now = core(); if (now === want || Date.now() > end) return r(now); setTimeout(tick, 100); })(); }); };",
      "const out = { before: null, turned: null, back: null };",
      "setTimeout(async function () {",
      "  out.before = core();",
      "  fs.writeFileSync(json, " + JSON.stringify(manifest(true)) + ");",
      "  out.turned = await wait(true, 10000);",
      "  fs.writeFileSync(json, " + JSON.stringify(manifest(false)) + ");",
      "  out.back = await wait(false, 10000);",
      "  console.log(JSON.stringify(out));",
      "  try { job._stop(); } catch (e) {}",
      "  process.exit(0);",
      "}, 3000);",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', src, run], { cwd: run, encoding: 'utf8', timeout: 60000 });
    try { flagged = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { flagged = null; }
    return !!flagged || false;
  } finally { LABH.freeTree(tree); }
}, test.limit.long);
test.run('zzKept.js, of an app whose json says intrinsic false, comes without the core flag', 0.2, function () {
  if (!flagged) return false;
  return flagged.before === false || false;
}, test.limit.quick);
test.run('with its json changed to intrinsic true, zzKept.js comes with the core flag', 0.2, function () {
  if (!flagged) return false;
  return flagged.turned === true || false;
}, test.limit.quick);
test.run('with its json changed back to intrinsic false, zzKept.js comes without the core flag again', 0.2, function () {
  if (!flagged) return false;
  return flagged.back === false || false;
}, test.limit.quick);


// ── THE FLAGS ON A FOLDER'S ROW (box v16) ──
// The watcher on a scratch folder inside spirit/run: an old-shape branch (api.js and data.js), a new-shape branch
// (script.js and client/script.js), a folder with script.js alone, an app (<name>/<name>.json) and that app's
// spirit/state/app/<name>/node.json (spirit.statePath's place, goal/G49.17), its active turned true and then false. Each row is read from the fs dataset
// (spirit/fs/dataset/script.js), which this process's watcher fills.
let rows = null;
test.run('the watcher runs on a scratch folder holding an old branch, a new branch, a script.js alone and an app, and its rows are read', 0.2, function () {
  const dir = path.join(RUN, 'fsServer-flags-test');
  fs.rmSync(dir, { recursive: true, force: true });
  const put = function (rel, text) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  put('spirit/zzOld/api.js', '// x\n'); put('spirit/zzOld/data.js', '// x\n');
  put('spirit/zzNew/script.js', '// x\n'); put('spirit/zzNew/client/script.js', '// x\n');
  put('spirit/zzAlone/script.js', '// x\n');
  put('spirit/app/zzApp/zzApp.json', '{}');
  try {
    const src = [
      "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
      "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
      "const W = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'server', 'script.js')) + ");",
      "const job = W.start(dir, jobs);",
      "const F = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'dataset', 'script.js')) + ");",
      "const row = function (p) { const r = F.file(p); return r ? { api: r.api === true, branch: r.branch === true, app: r.app === true, live: r.live === true } : null; };",
      "const state = path.join(dir, 'spirit', 'state', 'app', 'zzApp', 'node.json');",
      "const wait = function (want, ms) { const end = Date.now() + ms; return new Promise(function (r) { (function tick() { const a = row('spirit/app/zzApp'); if ((a && a.live === want) || Date.now() > end) return r(a ? a.live : null); setTimeout(tick, 100); })(); }); };",
      "const out = {};",
      "const end = Date.now() + 40000;",
      "(function tick() {",
      "  if (!F.ready() && Date.now() < end) return setTimeout(tick, 200);",
      "  setTimeout(async function () {",
      "    out.old = row('spirit/zzOld'); out.new = row('spirit/zzNew'); out.alone = row('spirit/zzAlone'); out.app = row('spirit/app/zzApp');",
      "    fs.mkdirSync(path.dirname(state), { recursive: true });",
      "    fs.writeFileSync(state, JSON.stringify({ active: true }));",
      "    out.on = await wait(true, 10000);",
      "    fs.writeFileSync(state, JSON.stringify({ active: false }));",
      "    out.off = await wait(false, 10000);",
      "    console.log(JSON.stringify(out));",
      "    try { job._stop(); } catch (e) {}",
      "    process.exit(0);",
      "  }, 1500);",
      "})();",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 90000 });
    try { rows = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { rows = null; }
    return !!rows || false;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}, test.limit.long);
test.run('a folder holding api.js and data.js carries api, and not branch', 0.2, function () { return (!!rows && !!rows.old && rows.old.api === true && rows.old.branch === false) || false; }, test.limit.quick);
test.run('a folder holding script.js and client/script.js carries branch, and not api', 0.2, function () { return (!!rows && !!rows.new && rows.new.branch === true && rows.new.api === false) || false; }, test.limit.quick);
test.run('a folder holding script.js alone carries neither api nor branch', 0.2, function () { return (!!rows && !!rows.alone && rows.alone.branch === false && rows.alone.api === false) || false; }, test.limit.quick);
test.run('an app folder carries app, and is not live with no node.json', 0.2, function () { return (!!rows && !!rows.app && rows.app.app === true && rows.app.live === false) || false; }, test.limit.quick);
test.run('its node.json written active true makes it live', 0.2, function () { return (!!rows && rows.on === true) || false; }, test.limit.quick);
test.run('its node.json changed to active false makes it not live again', 0.2, function () { return (!!rows && rows.off === false) || false; }, test.limit.quick);

// ── A NEW-STYLE APP (goal/G49.20, box v31, "WHAT IS AN APP?") ──
// "a new-style app MUST have a valid <name>/manifest.json and no <name>/<name>.json"; the fs cache sets the app flag on the
// folder's row by it: valid by spirit/type/object/manifest/script.js; "node:mount:true, then [it] MUST have a <name>/script.js
// AND a <name>/server/script.js AND a <name>/client/script.js, and only then is it also a branch"; "node:run:true the app MUST
// have a <name>/server/script.js and a <name>/script.js, but NO <name>/client/script.js"; "shell:mount:true, the app must have
// a <name>/element/script.js". Each folder sits outside spirit/app/ (an app may be mounted anywhere) and holds no json named
// after itself, so the old rule never flags it: what flags it is the new one.
let newApps = null;
const NEW_APPS = {
  zzMount: { manifest: { node: { mount: true } }, files: ['script.js', 'server/script.js', 'client/script.js'] },
  zzMountNoServer: { manifest: { node: { mount: true } }, files: ['script.js', 'client/script.js'] },
  zzRun: { manifest: { node: { run: true } }, files: ['script.js', 'server/script.js'] },
  zzRunClient: { manifest: { node: { run: true } }, files: ['script.js', 'server/script.js', 'client/script.js'] },
  zzShell: { manifest: { shell: { mount: true } }, files: ['element/script.js'] },
  zzShellNoElement: { manifest: { shell: { mount: true } }, files: [] },
  zzBoth: { manifest: { node: { mount: true, run: true } }, files: ['script.js', 'server/script.js', 'client/script.js'] },
  zzNone: { manifest: { shell: { mount: false }, node: { mount: false, run: false } }, files: ['element/script.js'] },
  zzBroken: { manifest: '{ "shell": { "mount": tr', files: ['element/script.js'] },
};
test.run('the watcher runs on a scratch folder holding new-style apps, each with its manifest.json, and their rows are read', 0.2, function () {
  const dir = path.join(RUN, 'fsServer-newApps-test');
  fs.rmSync(dir, { recursive: true, force: true });
  const put = function (rel, text) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  Object.keys(NEW_APPS).forEach(function (n) {
    const a = NEW_APPS[n];
    put('spirit/zzApps/' + n + '/manifest.json', typeof a.manifest === 'string' ? a.manifest : JSON.stringify(a.manifest));
    a.files.forEach(function (f) { put('spirit/zzApps/' + n + '/' + f, '// x\n'); });
  });
  try {
    const src = [
      "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
      "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
      "const W = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'server', 'script.js')) + ");",
      "const job = W.start(dir, jobs);",
      "const F = require(" + JSON.stringify(path.join(RUN, 'spirit', 'fs', 'dataset', 'script.js')) + ");",
      "const names = " + JSON.stringify(Object.keys(NEW_APPS)) + ";",
      "const end = Date.now() + 40000;",
      "(function tick() {",
      "  if (!F.ready() && Date.now() < end) return setTimeout(tick, 200);",
      "  setTimeout(function () {",
      "    const out = {};",
      "    names.forEach(function (n) { const r = F.file('spirit/zzApps/' + n); out[n] = r ? { app: r.app === true, branch: r.branch === true } : null; });",
      "    console.log(JSON.stringify(out));",
      "    try { job._stop(); } catch (e) {}",
      "    process.exit(0);",
      "  }, 1500);",
      "})();",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 90000 });
    try { newApps = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { newApps = null; }
    return (!!newApps && Object.keys(NEW_APPS).every(function (n) { return !!newApps[n]; })) || false;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}, test.limit.long);
const flagOf = function (n) { return newApps && newApps[n] ? newApps[n] : null; };
test.run('node mount true with script.js, server/script.js and client/script.js: an app, and a branch', 0.2, function () { const r = flagOf('zzMount'); return (!!r && r.app === true && r.branch === true) || false; }, test.limit.quick);
test.run('node mount true with no server/script.js: no app', 0.2, function () { const r = flagOf('zzMountNoServer'); return (!!r && r.app === false) || false; }, test.limit.quick);
test.run('node run true with server/script.js and script.js, no client/script.js: an app, and no branch', 0.2, function () { const r = flagOf('zzRun'); return (!!r && r.app === true && r.branch === false) || false; }, test.limit.quick);
test.run('node run true with a client/script.js: no app', 0.2, function () { const r = flagOf('zzRunClient'); return (!!r && r.app === false) || false; }, test.limit.quick);
test.run('shell mount true with element/script.js: an app', 0.2, function () { const r = flagOf('zzShell'); return (!!r && r.app === true) || false; }, test.limit.quick);
test.run('shell mount true with no element/script.js: no app', 0.2, function () { const r = flagOf('zzShellNoElement'); return (!!r && r.app === false) || false; }, test.limit.quick);
test.run('a manifest with node mount true and node run true: no app', 0.2, function () { const r = flagOf('zzBoth'); return (!!r && r.app === false) || false; }, test.limit.quick);
test.run('a manifest where none of shell mount, node mount and node run is true: no app', 0.2, function () { const r = flagOf('zzNone'); return (!!r && r.app === false) || false; }, test.limit.quick);
test.run('a manifest.json that is no JSON: no app', 0.2, function () { const r = flagOf('zzBroken'); return (!!r && r.app === false) || false; }, test.limit.quick);

// ── A RELAY'S CACHE (goal/G49.25, box v10: "if spirit.IS_RELAY, the fs cache will cache branch and app folders only"; Q6, "does
// the cache hold only spirit/<branch>/ and spirit/app/<name>/ folders with what is under them", Andy: "spirit is always
// loaded.") ── The watcher on a scratch copy of the run folder, one file planted outside spirit/, twice: as a node (spirit.IS_RELAY false) and as a relay
// (true, set before it starts). Which folders are branches and apps is the node's tree's own flags (api, branch, app), never
// named here. As a relay the tree holds spirit/'s own files, each trunk branch spirit/<name>/ and each app folder with all
// under them, everything outside spirit/ (box v12), and nothing else; as a node it holds a file of a trunk folder that is neither.
function treeAs(run, relay) {
  const src = [
    "const dir = process.argv[1];",
    "require(" + JSON.stringify(path.join(run, 'spirit', 'script.js')) + ");",
    relay ? "spirit.IS_RELAY = true;" : "",
    "const jobs = require(" + JSON.stringify(path.join(run, 'spirit', 'job', 'engine', 'script.js')) + ").installJobs(1);",
    "const W = require(" + JSON.stringify(path.join(run, 'spirit', 'fs', 'server', 'script.js')) + ");",
    "const job = W.start(dir, jobs);",
    "const F = require(" + JSON.stringify(path.join(run, 'spirit', 'fs', 'dataset', 'script.js')) + ");",
    "const end = Date.now() + 40000;",
    "(function tick() {",
    "  if (!F.ready() && Date.now() < end) return setTimeout(tick, 200);",
    "  const all = F.files(); const out = {};",
    "  Object.keys(all).forEach(function (p) { const h = all[p]; out[p] = { kind: h.kind, api: h.api === true, branch: h.branch === true, app: h.app === true }; });",
    // exit once the pipe has it all: a process.exit at once cuts a long write to a pipe
    "  job._stop(); process.stdout.write('\\nTREE ' + JSON.stringify(out) + '\\n', function () { process.exit(0); });",
    "})();",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', src, run], { cwd: run, encoding: 'utf8', timeout: 60000, maxBuffer: 1 << 28 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('TREE ') === 0; })[0];
  try { return line ? JSON.parse(line.slice(5)) : null; } catch (e) { return null; }
}
const AS = { node: null, relay: null, homes: [], plain: '' };
// Whether p is outside spirit/ (box v12: "it will still cache everything outside of run://spirit/"), spirit/'s own (the
// folder or a file right in it), or at or under one of the branch and app folders.
function outside(p) { return p !== 'spirit' && p.indexOf('spirit/') !== 0; }
function relayHolds(p) {
  if (outside(p)) return true;
  if (p === 'spirit' || /^spirit\/[^/]+$/.test(p) && AS.node[p] && AS.node[p].kind === 'file') return true;
  return AS.homes.some(function (h) { return p === h || p.indexOf(h + '/') === 0; });
}
test.run('the watcher on the run folder hands its tree as a node and as a relay', 0.2, function () {
  // On a scratch copy of the tracked run folder, with one file planted outside spirit/ (the checkout holds none there).
  const tree = LABH.scratchTree();
  try {
    const run = path.join(tree.root, 'spirit', 'run');
    fs.mkdirSync(path.join(run, 'zzOutside'), { recursive: true });
    fs.writeFileSync(path.join(run, 'zzOutside', 'kept.txt'), 'x');
    // spirit/relay with the new branch mark, script.js and client/script.js, where it has none yet (box v16: "spirit/relay/script.js").
    ['script.js', 'client/script.js'].forEach(function (n) { const p = path.join(run, 'spirit', 'relay', n); if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "'use strict';\n"); } });
    AS.node = treeAs(run, false);
    AS.relay = treeAs(run, true);
  } finally { LABH.freeTree(tree); }
  if (!AS.node || !AS.relay) return false;
  AS.homes = Object.keys(AS.node).filter(function (p) {
    const h = AS.node[p];
    return h.kind === 'folder' && ((/^spirit\/[^/]+$/.test(p) && (h.api || h.branch)) || h.app);
  });
  // A relay's branch too: spirit/relay, which the node never marks (box v16).
  if (AS.homes.indexOf('spirit/relay') === -1) AS.homes.push('spirit/relay');
  // A trunk folder that is no branch and no app, with a file in it: the first found.
  const plainDir = Object.keys(AS.node).filter(function (p) { const h = AS.node[p]; return /^spirit\/[^/]+$/.test(p) && h.kind === 'folder' && !h.api && !h.branch && !h.app && !relayHolds(p); })
    .filter(function (d) { return Object.keys(AS.node).some(function (q) { return q.indexOf(d + '/') === 0 && AS.node[q].kind === 'file'; }); })[0] || '';
  AS.plain = plainDir ? Object.keys(AS.node).filter(function (q) { return q.indexOf(plainDir + '/') === 0 && AS.node[q].kind === 'file'; })[0] : '';
  return (AS.homes.length > 5 && !!AS.plain) || false;
}, test.limit.long);
test.run('as a node, the tree holds a file of a trunk folder that is no branch and no app', 0.2, function () {
  return (!!AS.node && !!AS.plain && !!AS.node[AS.plain]) || false;
}, test.limit.quick);
test.run('as a relay, the tree holds spirit/script.js: spirit is always loaded', 0.2, function () {
  return (!!AS.relay && !!AS.relay['spirit/script.js']) || false;
}, test.limit.quick);
test.run('as a relay, the tree holds every path outside spirit/', 0.2, function () {
  if (!AS.node || !AS.relay) return false;
  const out = Object.keys(AS.node).filter(outside);
  return (out.length > 0 && out.every(function (p) { return !!AS.relay[p]; })) || false;
}, test.limit.quick);
test.run('as a relay, the tree holds every path at or under each trunk branch and each app folder', 0.2, function () {
  if (!AS.node || !AS.relay || !AS.homes.length) return false;
  return Object.keys(AS.node).filter(function (p) { return relayHolds(p) && p !== 'spirit'; }).every(function (p) { return !!AS.relay[p]; }) || false;
}, test.limit.quick);
test.run('as a relay, the tree holds nothing else: not that file of a trunk folder that is no branch and no app', 0.2, function () {
  if (!AS.node || !AS.relay || !AS.plain) return false;
  return (!AS.relay[AS.plain] && Object.keys(AS.relay).every(relayHolds)) || false;
}, test.limit.quick);
// "the fs watcher, when !spirit.IS_RELAY, will never mark spirit.relay as a branch" (box v16); a relay does, by the mark it has.
test.run('as a node, the tree never marks spirit/relay as a branch, though it has the branch mark', 0.2, function () {
  const r = AS.node && AS.node['spirit/relay'];
  return (!!r && r.kind === 'folder' && !r.branch && !r.api) || false;
}, test.limit.quick);
test.run('as a relay, the tree marks spirit/relay as a branch', 0.2, function () {
  const r = AS.relay && AS.relay['spirit/relay'];
  return (!!r && r.branch === true) || false;
}, test.limit.quick);
// Andy, G49.25: "a node, when spirit.IS_RELAY will not mark app servers as app or branch, too much weight."; "when spirit.IS_RELAY
// cgi-style servers like spirit.app.icon will still be allowed." A cgi-style app is the job engine's one-shot app (goal/G43.19:
// api.js and data.js at its top, node mount false or missing); every other app is a server. Which is which is read from the
// checkout's own folders, the same files the scratch copy holds.
function manifestNodeMount(dir) {
  const name = dir.slice(dir.lastIndexOf('/') + 1);
  for (const f of [name + '.json', 'manifest.json']) {
    try { const m = JSON.parse(fs.readFileSync(path.join(RUN, dir, f), 'utf8')); return !!(m && m.node && m.node.mount === true); } catch (e) { /* the next */ }
  }
  return false;
}
function oneShot(dir) { return !manifestNodeMount(dir) && !!AS.node[dir + '/api.js'] && !!AS.node[dir + '/data.js']; }
function appDirs() { return Object.keys(AS.node || {}).filter(function (p) { return AS.node[p].kind === 'folder' && AS.node[p].app; }); }
test.run('as a relay, an app server is marked neither an app nor a branch', 0.2, function () {
  if (!AS.node || !AS.relay) return false;
  const servers = appDirs().filter(function (p) { return !oneShot(p); });
  if (servers.length < 3) return false;
  return servers.every(function (p) { const r = AS.relay[p]; return !r || (!r.app && !r.branch); }) || false;
}, test.limit.quick);
test.run('as a relay, a cgi-style app keeps the marks the node gives it', 0.2, function () {
  if (!AS.node || !AS.relay) return false;
  const shots = appDirs().filter(oneShot);
  if (!shots.length) return false;
  return shots.every(function (p) { const r = AS.relay[p], n = AS.node[p]; return !!r && r.app === n.app && r.api === n.api && r.branch === n.branch; }) || false;
}, test.limit.quick);
