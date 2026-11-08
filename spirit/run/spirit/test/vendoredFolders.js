'use strict';

// spirit/run/spirit/test/vendoredFolders.js
// NO run://node_modules/ (goal/G43.25; spec: ./vendoredFolders.md). Andy: "can we hide those suckers in spirit/jobs/ for
// now? without the damn node_modules container?". chokidar and readdirp move whole to spirit/jobs/, chokidar finds
// readdirp by path, its two users require it by path, the watcher works as before, nothing names spirit/run/node_modules,
// and fileSystem.js keeps the one list of vendored folders that every walker reads. The tree read as it is; the watcher
// run in child processes on scratch folders. No node, no port.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const NEW = 'spirit/run/spirit/jobs/';
const VENDORED = ['spirit/jobs/chokidar', 'spirit/jobs/readdirp', 'spirit/element/codeMirror'];
const SELF = /spirit\/run\/spirit\/test\/vendoredFolders\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }

test.startTest('vendoredFolders.js: chokidar and readdirp in spirit/jobs/, no run://node_modules, one list of vendored folders (goal/G43.25)');

test.subHeading('the world');
const before = git('ls-tree -r --name-only ' + BASE + ' -- ' + OLD).split('\n').filter(Boolean);
ok(before.length === 12 && before.indexOf(OLD + 'chokidar/index.js') !== -1 && before.indexOf(OLD + 'readdirp/index.js') !== -1,
  'the world: ' + BASE + ' holds the 12 files of spirit/run/node_modules/ (chokidar and readdirp)', BASE + ' holds ' + before.length + ' files there: nothing to compare with');
const tracked = git('ls-files').split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');

test.subHeading('1. both folders move whole to spirit/jobs/, spirit/run/node_modules/ is gone');
before.forEach(function (f) {
  const to = NEW + f.slice(OLD.length);
  const there = fs.existsSync(path.join(REPO, to)) && tracked.indexOf(to) !== -1;
  if (!there) { test.fail(to + ' is not there, in git'); return; }
  if (f === OLD + 'chokidar/index.js') { test.check(to + ' is there, in git (its one changed line judged under 2)'); return; }
  // Line ends aside: a Windows checkout (autocrlf) holds CRLF on disk where git holds LF.
  const same = fs.readFileSync(path.join(REPO, to), 'latin1').replace(/\r\n/g, '\n') === execSync('git show ' + BASE + ':' + f, { cwd: REPO, maxBuffer: 1 << 26 }).toString('latin1').replace(/\r\n/g, '\n');
  ok(same, to + ' is there, in git, as it was', to + ' differs from ' + f + ' at ' + BASE);
});
['chokidar', 'readdirp'].forEach(function (n) {
  const dir = path.join(REPO, NEW, n);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  ok(files.indexOf('package.json') !== -1 && files.some(function (x) { return /^licen[cs]e/i.test(x); }), 'spirit/jobs/' + n + '/ keeps its package.json and licence', 'spirit/jobs/' + n + '/ holds ' + short(files));
});
ok(!fs.existsSync(path.join(RUN, 'node_modules')), 'spirit/run/node_modules/ is gone from the disk', 'spirit/run/node_modules/ is still on the disk');
const stillTracked = tracked.filter(function (f) { return f.indexOf(OLD) === 0; });
ok(!stillTracked.length, 'no tracked file is left under spirit/run/node_modules/', stillTracked.length + ' still are: ' + short(stillTracked));

test.subHeading('2. chokidar finds readdirp by path, the one line changed in the library');
const idxNew = path.join(REPO, NEW, 'chokidar', 'index.js');
const now = fs.existsSync(idxNew) ? fs.readFileSync(idxNew, 'utf8').split(/\r?\n/) : [];
const was = execSync('git show ' + BASE + ':' + OLD + 'chokidar/index.js', { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/);
ok(/from\s+['"]readdirp['"]/.test(was[5] || ''), 'the world: index.js:6 at ' + BASE + ' imports readdirp by name', 'index.js:6 at ' + BASE + ' reads ' + short(was[5]));
ok(/from\s+['"]\.\.\/readdirp\/index\.js['"]/.test(now[5] || ''), 'spirit/jobs/chokidar/index.js:6 imports from "../readdirp/index.js"', 'index.js:6 reads ' + short(now[5] || '(no file)'));
const differ = now.length ? was.map(function (l, i) { return l === now[i] ? -1 : i + 1; }).filter(function (i) { return i !== -1; }) : ['no file'];
ok(now.length === was.length && differ.length === 1 && differ[0] === 6, 'no other line of index.js changed', 'lines changed: ' + short(differ) + ' (' + now.length + ' lines, were ' + was.length + ')');
ok(now.length && !now.some(function (l) { return /from\s+['"]readdirp['"]|require\(\s*['"]readdirp['"]\s*\)/.test(l); }), 'index.js names readdirp by name nowhere', now.length ? 'index.js still imports readdirp by name' : 'no spirit/jobs/chokidar/index.js to judge');

test.subHeading('3. the two users require it by path');
const users = ['spirit/run/spirit/jobs.js', 'spirit/run/process/js/deskClient/deskClient.js'];
users.forEach(function (u) {
  const c = code(fs.readFileSync(path.join(REPO, u), 'utf8'));
  const specs = (c.match(/require\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); });
  let to = '';
  try { to = specs.length === 1 && specs[0].charAt(0) === '.' ? require.resolve(path.resolve(path.dirname(path.join(REPO, u)), specs[0])) : ''; } catch (e) { to = ''; }
  ok(to === idxNew, u + ' requires ' + specs[0] + ', which is spirit/jobs/chokidar/index.js', u + ' requires ' + short(specs) + ' (resolves to ' + short(to || 'nothing') + ')');
});
const byName = tracked.filter(function (f) { return /\.(js|mjs|cjs|html)$/.test(f) && !SELF.test(f) && f.indexOf(NEW + 'chokidar/') !== 0; })
  .filter(function (f) { return /require\(\s*['"]chokidar['"]\s*\)|from\s+['"]chokidar['"]|import\(\s*['"]chokidar['"]\s*\)/.test(code(fs.readFileSync(path.join(REPO, f), 'utf8'))); });
ok(!byName.length, 'nothing does require("chokidar") by name', byName.length + ' still do: ' + short(byName));

test.subHeading('4. the file watcher works as before');
// Scratch folders inside spirit/run (scanFolder refuses anything outside it, as fsWatcherCommands.js says), removed after.
function child(src, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  fs.rmSync(dir, { recursive: true, force: true });
  return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : '');
}
// The node's fs-watcher job (the Files tree and the spirit.fs events): a file made in its folder comes as a createFile.
const jobsOut = child([
  "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
  "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'jobs.js')) + ")(1);",
  "let job = null; jobs.events.on('job-updated', function (u) {",
  "  if (job && u.id === job.id && u.data && u.data.command && u.data.command.op === 'createFile' && u.data.command.path === 'made.txt') { console.log('HEARD'); process.exit(0); } });",
  "job = jobs.startFsWatcherJob(dir);",
  "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
  "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
].join('\n'), path.join(RUN, 'vendoredFolders-jobs-test'));
ok(/^HEARD/.test(jobsOut), 'the fs-watcher job hears a file made in its folder (createFile made.txt)', 'the fs-watcher job: ' + short(jobsOut));
// deskClient's watch of its clone: what deskClient requires, watching a folder, hears a file added.
const dcSpec = (code(fs.readFileSync(path.join(REPO, users[1]), 'utf8')).match(/require\(\s*['"]([^'"]*chokidar[^'"]*)['"]\s*\)/) || [])[1] || '';
const dcFrom = dcSpec.charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, users[1])), dcSpec) : dcSpec;
const dcOut = child([
  "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
  "let w = null; try { w = require(require.resolve(" + JSON.stringify(dcFrom) + ", { paths: [" + JSON.stringify(path.dirname(path.join(REPO, users[1]))) + "] })); } catch (e) { console.log('NOT LOADED ' + e.message); process.exit(0); }",
  "w.watch(dir, { ignoreInitial: true, persistent: true }).on('add', function (f) { if (/made\\.txt$/.test(f)) { console.log('HEARD'); process.exit(0); } });",
  "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
  "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
].join('\n'), path.join(RUN, 'vendoredFolders-desk-test'));
ok(/^HEARD/.test(dcOut) && dcFrom.indexOf('chokidar') !== -1, 'deskClient\'s watcher (' + dcSpec + ') hears a file added', 'deskClient\'s watcher (' + short(dcSpec) + '): ' + short(dcOut));

test.subHeading('5. no file names spirit/run/node_modules any more');
// The desk's shared currentGoal.json quotes the items' boxes, this one's among them: no file of the product.
const naming = tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/brains/') !== 0 && f !== 'spirit/run/process/js/desk/currentGoal.json' && !/\.(png|jpe?g|gif|ico|woff2?|ttf|zip|db)$/i.test(f); })
  .filter(function (f) { return /spirit\/run\/node_modules|!\/spirit\/run\/node_modules/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
ok(!naming.length, 'no tracked file names spirit/run/node_modules', naming.length + ' still do: ' + short(naming));
const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
ok(!/run\/node_modules/.test(gi), '.gitignore holds no exception for spirit/run/node_modules', '.gitignore still names it');
['install/microscopic/create.js', 'install/chat-windows/create.js'].forEach(function (f) {
  ok(naming.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)), f + ' names spirit/run/node_modules no more', f + (fs.existsSync(path.join(REPO, f)) ? ' still names it' : ' is not there to judge'));
});
const fwc = code(fs.readFileSync(path.join(REPO, 'spirit', 'test', 'fsWatcherCommands.js'), 'utf8'));
ok(!/node_modules/.test(fwc) && /jobs['"\/,\s]+['"]?chokidar|spirit\/jobs\/chokidar/.test(fwc), 'the fsWatcherCommands test checks spirit/jobs/chokidar, not node_modules', 'fsWatcherCommands.js: names node_modules ' + /node_modules/.test(fwc) + ', names spirit/jobs/chokidar ' + /jobs['"\/,\s]+['"]?chokidar|spirit\/jobs\/chokidar/.test(fwc));

test.subHeading('6. one list of vendored folders, in fileSystem.js, read by every walker');
const fsPath = path.join(RUN, 'spirit', 'fileSystem.js');
const fsm = require(fsPath);
const listName = Object.keys(fsm).filter(function (k) {
  const v = fsm[k];
  const arr = Array.isArray(v) ? v : (v instanceof Set ? Array.from(v) : null);
  return arr && arr.length === VENDORED.length && arr.every(function (x) { return typeof x === 'string'; }) &&
    JSON.stringify(arr.map(trim).sort()) === JSON.stringify(VENDORED.slice().sort());
})[0] || '';
ok(!!listName, 'fileSystem.js exports the vendored folders, ' + listName + ': ' + VENDORED.join(', '), 'fileSystem.js exports no list of exactly ' + VENDORED.join(', ') + ' (it exports ' + short(Object.keys(fsm)) + ')');
// Not listed in Files: the node's file scan, from spirit/run.
const scanned = typeof fsm.scanFolder === 'function' ? fsm.scanFolder(RUN, []).map(function (e) { return path.relative(RUN, path.join(e.parentPath, e.name)).split(path.sep).join('/'); }) : [];
ok(scanned.indexOf('spirit/jobs/api.js') !== -1, 'the world: the node\'s file scan lists ' + scanned.length + ' entries, spirit/jobs/api.js among them', 'the scan lists ' + scanned.length + ' entries, no spirit/jobs/api.js: nothing judged');
VENDORED.forEach(function (v) {
  const inside = scanned.filter(function (s) { return s === v || s.indexOf(v + '/') === 0; });
  const there = fs.existsSync(path.join(RUN, v));
  ok(there && !inside.length, 'the file scan lists nothing of ' + v, there ? 'the file scan lists ' + inside.length + ' entries of ' + v + ', e.g. ' + short(inside.slice(0, 3)) : v + ' is not there to judge');
});
// Served, never written. Andy, Q1 (the page loads CodeMirror from spirit/element/codeMirror/): "servable but not writeable."
['spirit/jobs/chokidar/index.js', 'spirit/jobs/readdirp/index.js', 'spirit/element/codeMirror/lib/codemirror.js'].forEach(function (f) {
  const there = fs.existsSync(path.join(RUN, f));
  ok(there && fsm.fileServable(f) && !fsm.fileWritable(f), f + ' is servable but not writable',
    there ? f + ': servable ' + fsm.fileServable(f) + ', writable ' + fsm.fileWritable(f) : f + ' is not there to judge');
});
// The walkers: every tracked script that skipped node_modules at BASE, and the ones that skipped codeMirror beside it.
const atBase = git('ls-tree -r --name-only ' + BASE).split('\n').filter(function (f) { return /\.js$/.test(f) && f.indexOf(OLD) !== 0; });
const grepped = git('grep -l -e node_modules ' + BASE + ' -- "*.js"').split('\n').filter(Boolean).map(function (l) { return l.replace(BASE + ':', ''); });
const walkers = grepped.filter(function (f) {
  if (atBase.indexOf(f) === -1 || f === 'spirit/test/fsWatcherCommands.js' || !fs.existsSync(path.join(REPO, f))) return false;
  return /node_modules/.test(code(execSync('git show ' + BASE + ':' + f, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })).replace(/shell\\?\/node_modules/g, ''));
});
ok(walkers.length > 30 && walkers.indexOf('spirit/run/spirit/fileSystem.js') !== -1 && walkers.indexOf('spirit/run/spirit/word.js') !== -1 && walkers.indexOf('spirit/test/oneDoor.js') !== -1,
  'the world: ' + walkers.length + ' walkers skipped node_modules at ' + BASE + ', fileSystem.js, word.js and oneDoor.js among them', 'only ' + walkers.length + ' walkers found at ' + BASE + ': nothing judged');
const CM_SKIPPERS = ['spirit/run/test/testModule.js', 'spirit/run/test/spirit-sibling-generalRules.js', 'spirit/run/test/spirit-sibling-testReachRules.js', 'spirit/run/test/caches.js', 'spirit/run/test/test/testReportVerifier.js'];
walkers.forEach(function (f) {
  const c = code(fs.readFileSync(path.join(REPO, f), 'utf8'));
  const own = /node_modules/.test(c.replace(/shell\\?\/node_modules/g, '')) ? 'node_modules' : (CM_SKIPPERS.indexOf(f) !== -1 && /codeMirror|codemirror/.test(c) ? 'codeMirror' : '');
  const reads = !!listName && new RegExp('\\b' + listName + '\\b').test(c) && (f === 'spirit/run/spirit/fileSystem.js' || /fileSystem/.test(c));
  ok(!own && reads, f + ': reads ' + (listName || 'the list') + ', no skip of its own', f + ': ' + (own ? 'still skips ' + own + ' itself' : '') + (own && !reads ? ', and ' : '') + (!reads ? 'does not read fileSystem.js\'s list' : ''));
});

test.reportSuccessFailureCount();
process.exit(0);
