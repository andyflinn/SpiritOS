'use strict';

// spirit/run/spirit/test/jobs-vendoredLibraries.js
// NO run://node_modules/: chokidar and readdirp in spirit/jobs/ (goal/G43.25; spec: ./jobs-vendoredLibraries.md). Andy: "can we
// hide those suckers in spirit/jobs/ for now? without the damn node_modules container?". The two libraries sit in spirit/jobs/,
// jobs.js's own folder, and jobs.js is the user that brings them: they move whole, chokidar finds readdirp by path, jobs.js
// requires it by path, its fs-watcher job works as before, nothing names spirit/run/node_modules. deskClient's use is
// spirit/app/deskClient/test/deskClient-chokidar.js; fileSystem.js's one list of vendored folders is
// ./fileSystem-vendoredFolders.js. The tree read as it is; the watcher run in a child process on a scratch folder.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const NEW = 'spirit/run/spirit/jobs/';
const VENDORED = ['spirit/jobs/chokidar', 'spirit/jobs/readdirp', 'spirit/element/codeMirror'];
const SELF = /spirit\/run\/spirit\/test\/(jobs-vendoredLibraries|fileSystem-vendoredFolders)\.(js|md)$|spirit\/run\/spirit\/app\/deskClient\/test\/deskClient-chokidar\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }

test.startTest('jobs-vendoredLibraries.js: chokidar and readdirp in spirit/jobs/, no run://node_modules (goal/G43.25)');

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

test.subHeading('3. the two users require it by path: jobs.js here, deskClient.js in its own test');
const users = ['spirit/run/spirit/jobs.js'];
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

test.subHeading('5. no file names spirit/run/node_modules any more');
const naming = tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/brains/') !== 0 && !/\.(png|jpe?g|gif|ico|woff2?|ttf|zip|db)$/i.test(f); })
  .filter(function (f) { return /spirit\/run\/node_modules|!\/spirit\/run\/node_modules/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
ok(!naming.length, 'no tracked file names spirit/run/node_modules', naming.length + ' still do: ' + short(naming));
const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
ok(!/run\/node_modules/.test(gi), '.gitignore holds no exception for spirit/run/node_modules', '.gitignore still names it');
['install/microscopic/create.js', 'install/chat-windows/create.js'].forEach(function (f) {
  ok(naming.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)), f + ' names spirit/run/node_modules no more', f + (fs.existsSync(path.join(REPO, f)) ? ' still names it' : ' is not there to judge'));
});

test.reportSuccessFailureCount();
process.exit(0);
