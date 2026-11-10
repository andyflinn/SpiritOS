'use strict';

// spirit/run/spirit/app/deskClient/test/deskClient-chokidar.js
// deskClient WATCHES ITS CLONE WITH chokidar FROM spirit/jobs/ (goal/G43.25; spec: ./deskClient-chokidar.md). Andy: "can we hide
// those suckers in spirit/jobs/ for now? without the damn node_modules container?". deskClient.js requires chokidar by path, the
// one in spirit/jobs/chokidar/, and what it requires, watching a folder, hears a file added. The move itself is
// spirit/test/jobs-vendoredLibraries.js. The watcher run in a child process on a scratch folder inside spirit/run.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const NEW = 'spirit/run/spirit/jobs/';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }

test.startTest('deskClient-chokidar.js: deskClient requires chokidar from spirit/jobs/ by path, and its watcher hears (goal/G43.25)');

const idxNew = path.join(REPO, NEW, 'chokidar', 'index.js');
const users = ['spirit/run/spirit/app/deskClient/deskClient.js'];
test.subHeading('3. the two users require it by path: deskClient.js here, jobs.js in spirit/test/jobs-vendoredLibraries.js');
users.forEach(function (u) {
  const c = code(fs.readFileSync(path.join(REPO, u), 'utf8'));
  const specs = (c.match(/require\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); });
  let to = '';
  // goal/G43.32: loaded by spirit.require, by its run-root path ("spirit/jobs/chokidar/index.js"); a relative path is the old way.
  try { to = specs.length === 1 ? require.resolve(specs[0].charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, u)), specs[0]) : path.join(RUN, specs[0])) : ''; } catch (e) { to = ''; }
  ok(to === idxNew, u + ' requires ' + specs[0] + ', which is spirit/jobs/chokidar/index.js', u + ' requires ' + short(specs) + ' (resolves to ' + short(to || 'nothing') + ')');
});

test.subHeading('4. the file watcher works as before: deskClient\'s');
// Scratch folders inside spirit/run (scanFolder refuses anything outside it, as fsWatcherCommands.js says), removed after.
function child(src, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  fs.rmSync(dir, { recursive: true, force: true });
  return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : '');
}
// deskClient's watch of its clone: what deskClient requires, watching a folder, hears a file added.
const dcSpec = (code(fs.readFileSync(path.join(REPO, users[0]), 'utf8')).match(/require\(\s*['"]([^'"]*chokidar[^'"]*)['"]\s*\)/) || [])[1] || '';
const dcFrom = dcSpec.charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, users[0])), dcSpec) : path.join(RUN, dcSpec);
const dcOut = child([
  "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
  "let w = null; try { w = require(require.resolve(" + JSON.stringify(dcFrom) + ", { paths: [" + JSON.stringify(path.dirname(path.join(REPO, users[0]))) + "] })); } catch (e) { console.log('NOT LOADED ' + e.message); process.exit(0); }",
  "w.watch(dir, { ignoreInitial: true, persistent: true }).on('add', function (f) { if (/made\\.txt$/.test(f)) { console.log('HEARD'); process.exit(0); } });",
  "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
  "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
].join('\n'), path.join(RUN, 'vendoredFolders-desk-test'));
ok(/^HEARD/.test(dcOut) && dcFrom.indexOf('chokidar') !== -1, 'deskClient\'s watcher (' + dcSpec + ') hears a file added', 'deskClient\'s watcher (' + short(dcSpec) + '): ' + short(dcOut));

test.reportSuccessFailureCount();
process.exit(0);
