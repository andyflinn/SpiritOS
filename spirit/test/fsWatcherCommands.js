'use strict';

// goal/G4.25: the file watcher on chokidar streams tree commands, not the whole file list. Red on today's tree;
// wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-02 and 2026-10-04 (box of goal/G4.25, carried from goal/G2.17): "the current design is horrid. for
//   lazy load the stream can send createDirectory run / createDirectory media / createFile index.html etc... just send
//   \"commands up the stream to modify the tree.\""; the test: "monitor a scratch folder, and create a parallel folder
//   with correct filename, and each file holds an x / once the duplicated tree has the exact same structure, we know
//   that we re reading the fs-watch-data correctly"; "chokidar is the library"; "forget about batching"; "local copy it
//   is"; his grants G1-G4 (jobs.js, server.js, js/client/shell.js, package.json) and his Go on goal/G4.25.
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  THE LOCAL COPY: chokidar and readdirp committed under spirit/run/node_modules/ (each with its package.json and
//      its licence file), so require('chokidar') resolves from spirit/run/js as for any package; .gitignore gains the
//      exception that lets that one folder in. No npm step anywhere.
//   2  THE COMMANDS: every fs-watcher job-updated carries data.command {op, path, at}: op one of createDirectory,
//      createFile, changeFile, deleteFile, deleteDirectory; path relative to the watched root, '/'-separated; at an ISO
//      time. One command per message (no batching). data.files is gone from the job.
//   3  THE TREE AT CONNECT: jobs.fsTreeCommands() answers the create commands for the tree as it stands (a
//      createDirectory before anything inside it); the node writes those to a page that connects, each its own
//      fs-watcher job-updated, after the snapshot, whose fs-watcher job no longer carries a file list.
//   4  ERADICATED: the hand-rolled fs.watch reader and its rescan, and every reader of data.files (jobs.js, server.js,
//      nodeSearches.js, js/client/shell.js, shell/files, shell/process-browser). fs.search keeps answering, from the
//      watcher's tree.
//
// LEFT OPEN, not asserted: the shell's own tree and the API apps read it by (api.onFiles fed by commands, or a new
// call), and whether the tree is drawn by a shell element now or in goal/G4.23; how Files draws one command (the
// box's "draw only what a command touched"). Those are shapes still being argued under G4.25 and G4.23.

const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G4.25: ';
const REPO = path.resolve(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
const OPS = ['createDirectory', 'createFile', 'changeFile', 'deleteFile', 'deleteDirectory'];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 240); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
async function waitFor(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(150); } return false; }

// The tree on disk under root, as 'd:rel' and 'f:rel' entries.
function onDisk(root) {
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (e.isDirectory()) { out.push('d:' + rel); walk(full); } else out.push('f:' + rel);
    });
  }(root));
  return out.sort();
}
// A mirror built only by applying commands, as Andy's parallel folder is.
function mirror() {
  const set = new Set();
  return {
    apply: function (c) {
      if (!c || OPS.indexOf(c.op) === -1) return;
      if (c.op === 'createDirectory') set.add('d:' + c.path);
      else if (c.op === 'createFile' || c.op === 'changeFile') set.add('f:' + c.path);
      else if (c.op === 'deleteFile') set.delete('f:' + c.path);
      else if (c.op === 'deleteDirectory') Array.from(set).forEach(function (k) { const p = k.slice(2); if (p === c.path || p.indexOf(c.path + '/') === 0) set.delete(k); });
    },
    list: function () { return Array.from(set).sort(); },
  };
}

test.startTest('goal/G4.25: the file watcher streams tree commands, on a local copy of chokidar');

(async function () {
  // ── 1. the local copy ──
  test.subHeading('1. chokidar and readdirp are a local copy, committed, with their licences');
  ['chokidar', 'readdirp'].forEach(function (name) {
    const dir = path.join(RUN, 'node_modules', name);
    const pkg = path.join(dir, 'package.json');
    const licence = fs.existsSync(dir) && fs.readdirSync(dir).some(function (f) { return /^licen[cs]e/i.test(f); });
    const tracked = spawnSync('git', ['ls-files', '--', path.relative(REPO, pkg).split(path.sep).join('/')], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
    if (fs.existsSync(pkg) && licence && tracked) test.check(name + ': spirit/run/node_modules/' + name + ', its package.json and licence, in git');
    else test.fail(OWED + name + ': package.json ' + fs.existsSync(pkg) + ', licence ' + licence + ', tracked by git ' + !!tracked);
  });
  let resolved = '';
  try { resolved = require.resolve('chokidar', { paths: [path.join(RUN, 'js')] }); } catch (e) { resolved = ''; }
  if (resolved && resolved.indexOf(path.join(RUN, 'node_modules')) === 0) test.check('require(\'chokidar\') from spirit/run/js resolves to that copy');
  else test.fail(OWED + 'require(\'chokidar\') from spirit/run/js resolves to ' + short(resolved));

  // ── 2. the watcher ──
  test.subHeading('2. Andy\'s mirror: a tree built only from the commands matches the disk');
  const jobsJs = path.join(RUN, 'js', 'jobs.js');
  const jc = code(jobsJs);
  if (/require\(\s*['"]chokidar['"]\s*\)/.test(jc) && !/\bfs\.watch\s*\(/.test(jc)) test.check('jobs.js requires chokidar and calls no fs.watch');
  else test.fail(OWED + 'jobs.js: requires chokidar ' + /require\(\s*['"]chokidar['"]\s*\)/.test(jc) + ', still calls fs.watch ' + /\bfs\.watch\s*\(/.test(jc));
  // Inside spirit/run, as fsWatcherQuiet.js says: scanFolder refuses anything outside ROOT_DIR.
  const home = path.join(RUN, 'fswatch-commands-test');
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, 'a'), { recursive: true });
  fs.writeFileSync(path.join(home, 'a', 'x.txt'), 'x');
  let jobs = null;
  let job = null;
  try {
    const spirit = require('../run/js/kernel.js');
    jobs = require('../run/js/jobs.js')(spirit, 65432);
    const seen = [];
    let biggest = 0;
    let listCarried = false;
    jobs.events.on('job-updated', function (u) {
      if (!job || u.id !== job.id) return;
      const bytes = Buffer.byteLength(JSON.stringify(u), 'utf8');
      if (bytes > biggest) biggest = bytes;
      if (u.data && u.data.files !== undefined) listCarried = true;
      if (u.data && u.data.command) seen.push(u.data.command);
    });
    job = jobs.startFsWatcherJob(home);
    await sleep(1500);
    const m = mirror();
    const start = typeof jobs.fsTreeCommands === 'function' ? jobs.fsTreeCommands() : null;
    if (Array.isArray(start)) start.forEach(m.apply);
    const startOk = Array.isArray(start) && JSON.stringify(m.list()) === JSON.stringify(onDisk(home));
    if (startOk) test.check('jobs.fsTreeCommands() is the tree as it stands: ' + start.length + ' create commands');
    else test.fail(OWED + 'jobs.fsTreeCommands() answered ' + short(start) + '; the disk holds ' + short(onDisk(home)));
    const firstDir = Array.isArray(start) ? start.findIndex(function (c) { return c.path === 'a'; }) : -1;
    const firstFile = Array.isArray(start) ? start.findIndex(function (c) { return c.path === 'a/x.txt'; }) : -1;
    if (firstDir !== -1 && firstFile > firstDir) test.check('a createDirectory comes before anything inside it');
    else test.fail(OWED + 'in fsTreeCommands, a at ' + firstDir + ', a/x.txt at ' + firstFile);

    // The changes: a folder and a file, a 50-file burst, a file renamed, a folder renamed with its file, an edit, a
    // folder removed with everything in it.
    fs.mkdirSync(path.join(home, 'b'));
    fs.writeFileSync(path.join(home, 'b', 'y.txt'), 'x');
    await sleep(400);
    fs.mkdirSync(path.join(home, 'c'));
    for (let i = 0; i < 50; i++) fs.writeFileSync(path.join(home, 'c', 'f' + i + '.txt'), 'x');
    await sleep(800);
    fs.renameSync(path.join(home, 'a', 'x.txt'), path.join(home, 'a', 'z.txt'));
    await sleep(400);
    fs.renameSync(path.join(home, 'b'), path.join(home, 'b2'));
    await sleep(400);
    fs.writeFileSync(path.join(home, 'a', 'z.txt'), 'xx');
    await sleep(400);
    fs.rmSync(path.join(home, 'c'), { recursive: true, force: true });
    await sleep(2000);
    seen.forEach(m.apply);
    const want = onDisk(home);
    if (seen.length && JSON.stringify(m.list()) === JSON.stringify(want)) test.check('after the changes, the mirror matches the disk: ' + want.length + ' entries, from ' + seen.length + ' commands');
    else test.fail(OWED + 'the mirror holds ' + short(m.list()) + ' against the disk ' + short(want) + ' (' + seen.length + ' commands)');
    const bad = seen.filter(function (c) { return OPS.indexOf(c.op) === -1 || typeof c.path !== 'string' || c.path.indexOf('\\') !== -1 || /^\//.test(c.path) || isNaN(Date.parse(c.at)); });
    if (seen.length && !bad.length) test.check('every command is {op, path, at}: one of the five ops, a relative \'/\' path, an ISO time');
    else test.fail(OWED + (seen.length ? 'commands out of shape: ' + short(bad.slice(0, 3)) : 'no data.command arrived'));
    if (seen.some(function (c) { return c.op === 'changeFile' && c.path === 'a/z.txt'; })) test.check('the edit arrived as changeFile a/z.txt');
    else test.fail(OWED + 'no changeFile a/z.txt among ' + short(seen.map(function (c) { return c.op + ' ' + c.path; }).slice(-8)));
    const now = jobs.getJob(job.id) || {};
    if (!listCarried && !(now.data && now.data.files !== undefined) && biggest > 0 && biggest < 2000) test.check('no job-updated carries a file list; the largest was ' + biggest + ' bytes');
    else test.fail(OWED + 'a file list still travels (on an update ' + listCarried + ', on the job ' + !!(now.data && now.data.files) + '), largest job-updated ' + biggest + ' bytes');
  } catch (e) {
    test.fail(OWED + 'the watcher could not be run: ' + (e && e.message || e));
  } finally {
    try { if (job && jobs) jobs.cancelJob(job.id); } catch (e) { /* stopped */ }
    fs.rmSync(home, { recursive: true, force: true });
  }

  // ── 3. a page that connects ──
  await theNode();

  // ── 4. eradicated ──
  test.subHeading('4. nothing reads or sends the whole file list any more');
  const readers = ['js/jobs.js', 'js/server.js', 'js/nodeSearches.js', 'js/client/shell.js', 'shell/files/files.js', 'shell/process-browser/process-browser.js'];
  const still = readers.filter(function (r) { return /\bdata\.files\b/.test(code(path.join(RUN, r))); });
  if (!still.length) test.check('no data.files in ' + readers.join(', '));
  else test.fail(OWED + 'data.files still read in ' + still.join(', '));
  if (!/\bscheduleRescan\b|\blastFilesJson\b/.test(jc)) test.check('the hand-rolled rescan is gone from jobs.js');
  else test.fail(OWED + 'jobs.js still holds the rescan (scheduleRescan / lastFilesJson)');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});

function freePort() { return new Promise(function (resolve) { const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }
function post(port, body) {
  return new Promise(function (resolve) {
    const data = JSON.stringify(body);
    const rq = http.request({ host: '127.0.0.1', port: port, path: '/api/spirit', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, function (rs) {
      let t = ''; rs.on('data', function (c) { t += c; }); rs.on('end', function () { let b = null; try { b = JSON.parse(t); } catch (e) { b = null; } resolve({ status: rs.statusCode, body: b }); });
    });
    rq.on('error', function () { resolve({ status: 0, body: null }); });
    rq.end(data);
  });
}

async function theNode() {
  test.subHeading('3. a page that connects gets the tree as create commands, after a snapshot without a file list');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fswatchcommands-'));
  const home = path.join(scratch, 'home', 'spirit', 'run');
  let node = null;
  let stream = null;
  try {
    require('./plantRun.js').plantRunTree(home);
    fs.writeFileSync(path.join(home, 'fswatch-probe-g425.txt'), 'x');
    const port = await freePort();
    node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
    let said = '';
    node.stderr.on('data', function (b) { said = (said + b).slice(-2000); });
    const up = await waitFor(function () { return post(port, { verb: 'fs.search', q: 'js/server.js' }).then(function (r) { return r.status === 200; }); }, 20000);
    if (!up) { test.fail('the planted node did not answer' + (said.trim() ? ' — node said: ' + said.trim().slice(-300) : '')); return; }
    const events = [];
    let buf = '';
    stream = http.get({ host: '127.0.0.1', port: port, path: '/api/events' }, function (rs) {
      rs.setEncoding('utf8');
      rs.on('data', function (c) {
        buf += c;
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(block); const da = /^data: (.*)$/m.exec(block);
          if (ev) { let d = null; try { d = JSON.parse(da ? da[1] : 'null'); } catch (e) { d = null; } events.push({ event: ev[1], data: d }); }
        }
      });
    });
    stream.on('error', function () {});
    const commandsOf = function () { return events.filter(function (e) { return e.event === 'job-updated' && e.data && e.data.type === 'fs-watcher' && e.data.data && e.data.data.command; }).map(function (e) { return e.data.data.command; }); };
    await waitFor(function () { return commandsOf().some(function (c) { return c.op === 'createFile' && c.path === 'js/server.js'; }); }, 8000);
    const snap = events.filter(function (e) { return e.event === 'snapshot'; })[0];
    const watcher = snap && snap.data && (snap.data.jobs || []).filter(function (j) { return j.type === 'fs-watcher'; })[0];
    if (snap && watcher && !(watcher.data && watcher.data.files !== undefined)) test.check('the snapshot\'s fs-watcher job carries no file list');
    else test.fail(OWED + 'the snapshot\'s fs-watcher job: ' + short(watcher && watcher.data && Object.keys(watcher.data)));
    const cmds = commandsOf();
    const m = mirror();
    cmds.forEach(m.apply);
    const has = function (k) { return m.list().indexOf(k) !== -1; };
    if (has('d:js') && has('f:js/server.js') && has('d:shell') && cmds.indexOf(cmds.filter(function (c) { return c.path === 'js'; })[0]) < cmds.indexOf(cmds.filter(function (c) { return c.path === 'js/server.js'; })[0])) {
      test.check('then the tree arrives as create commands, ' + cmds.length + ' of them, js before js/server.js');
    } else test.fail(OWED + 'after the snapshot ' + cmds.length + ' commands arrived; the mirror holds js ' + has('d:js') + ', js/server.js ' + has('f:js/server.js'));
    const found = await post(port, { verb: 'fs.search', q: 'fswatch-probe-g425.txt' });
    const keys = ((found.body || {}).items || []).map(function (x) { return x.key; });
    if (found.status === 200 && keys.indexOf('fswatch-probe-g425.txt') !== -1) test.check('fs.search still finds a file by its path');
    else test.fail('fs.search fswatch-probe-g425.txt answered ' + found.status + ' ' + short(found.body));
  } finally {
    try { if (stream) stream.destroy(); } catch (e) { /* closed */ }
    try { if (node) node.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
}
