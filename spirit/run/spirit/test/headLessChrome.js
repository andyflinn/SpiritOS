'use strict';

// spirit/run/spirit/test/headLessChrome.js
// WHAT A TEST NEEDS TO DRIVE A REAL BROWSER (goal/G41.22): a scratch node with its DEBUG on, and headless Chrome on a
// scratch profile, one page of it over the debugging protocol. Taken out of the shell's general rules
// (spirit/test/script-sibling-browser.js), so an element's own test can open its own pages, /DEBUG/<path>/test/<page>.html
// (spirit/DEBUG/test/script.md), in the same browser on the same kind of node. Never Andy's node nor an agent's.

const fs = require('fs');
const net = require('net');
const path = require('path');
// CHROME PROFILES FROM THE ONE TEMP HELPER (goal/G47.1, the box: "nothing else builds a temp path"): each under a route of
// this file's own, spirit/test/headLessChrome, named by a random suffix (never a process id), so a profile its watcher removes
// after the test has ended is no suite's leftover.
const tempFolder = require('../tempFolder/script.js').tempFolder;
const PROFILES = 'spirit/test/headLessChrome';
const { spawn, execSync } = require('child_process');

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const WAIT = 20000;

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(250); } return false; }
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

// THE RUNS OF ONE APP'S SCRIPT ON A SCRATCH NODE (goal/G43.19): the processes whose command line runs
// spirit/app/<name>/<name>.js of the scratch tree at root (by its path or, run by a relative one, by its working folder).
// appRuns(root, name) -> [pid], once. watchRuns(root, name, opts) -> { stop() -> Promise<{ most, seen, pids }> }: sampled
// until stopped, most the largest number at once, seen how many samples found one. On Linux from /proc every 10 ms; on
// Windows one PowerShell kept running, since a PowerShell started per sample sees about one a second and misses a short
// run (cw found it). A query there still takes longer than a short run, so with opts.base (the node's address) it also
// asks the job spirit.app.<name> for the pid of its last run, and pids is how many it named: a run proved by the node
// where no sample caught it.
function runPattern(name) { return new RegExp('spirit[\\\\/]app[\\\\/]' + name + '[\\\\/]' + name + '\\.js'); }
function appRuns(root, name) {
  const want = runPattern(name);
  const out = [];
  if (process.platform === 'win32') {
    let text = '';
    try { text = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | ForEach-Object { [string]$_.ProcessId + \' \' + $_.CommandLine }"', { encoding: 'utf8', maxBuffer: 1 << 24 }); } catch (e) { text = ''; }
    text.split(/\r?\n/).forEach(function (l) { if (want.test(l) && l.toLowerCase().indexOf(String(root).toLowerCase()) !== -1) out.push(l.split(' ')[0]); });
    return out;
  }
  let pids = [];
  try { pids = fs.readdirSync('/proc').filter(function (p) { return /^\d+$/.test(p); }); } catch (e) { pids = []; }
  pids.forEach(function (p) {
    let cmd = '';
    let cwd = '';
    try { cmd = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8').split('\0').join(' '); } catch (e) { return; }
    if (!want.test(cmd)) return;
    try { cwd = fs.readlinkSync('/proc/' + p + '/cwd'); } catch (e) { cwd = ''; }
    if (cmd.indexOf(root) !== -1 || cwd.indexOf(root) === 0) out.push(p);
  });
  return out;
}
function watchRuns(root, name, opts) {
  let most = 0;
  let seen = 0;
  const take = function (n) { most = Math.max(most, n); if (n) seen += 1; };
  const pids = new Set();
  let asking = !!(opts && opts.base);
  const asked = (async function () {
    while (asking) {
      try {
        const r = await fetch(opts.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.job.get', args: { key: 'spirit.app.' + name } }) });
        const b = await r.json();
        const pid = b && b.job && b.job.data && b.job.data.pid;
        if (pid) pids.add(String(pid));
      } catch (e) { /* the next ask */ }
      await sleep(5);
    }
  }());
  const finish = function (r) { asking = false; return asked.then(function () { r.pids = pids.size; return r; }); };
  if (process.platform === 'win32') {
    const want = runPattern(name).source.replace(/'/g, "''");
    const at = String(root).toLowerCase().replace(/'/g, "''");
    const loop = "while ($true) { $n = @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match '" + want + "' -and $_.CommandLine.ToLower().Contains('" + at + "') }).Count; [Console]::Out.WriteLine('N ' + $n); [Console]::Out.Flush(); Start-Sleep -Milliseconds 10 }";
    const kid = spawn('powershell', ['-NoProfile', '-Command', loop], { stdio: ['ignore', 'pipe', 'ignore'] });
    let rest = '';
    kid.stdout.on('data', function (d) { rest += String(d); const lines = rest.split(/\r?\n/); rest = lines.pop(); lines.forEach(function (l) { const m = /^N (\d+)/.exec(l); if (m) take(Number(m[1])); }); });
    return { stop: function () { try { kid.kill(); } catch (e) { /* gone */ } return finish({ most: most, seen: seen }); } };
  }
  let on = true;
  const done = (async function () { while (on) { take(appRuns(root, name).length); await sleep(10); } }());
  return { stop: function () { on = false; return done.then(function () { return finish({ most: most, seen: seen }); }); } };
}

// Chrome where this machine keeps it: on Linux by its name, on Windows in its usual folders.
function findChrome() {
  const env = process.env.SPIRIT_CHROME;
  if (env && fs.existsSync(env)) return env;
  const win = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')];
  if (process.platform === 'win32') return win.filter(function (p) { return fs.existsSync(p); })[0] || '';
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const p = execSync('command -v ' + name, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (p) return p; } catch (e) { /* not this one */ }
  }
  return '';
}

// THE LAB NODES (goal/G47.3, the box: "the move: headLessChrome.js scratchNode hands out a reset lab node instead of a
// fresh copy"): every node and relay a test uses is one of lab's, in the git-ignored repo://lab/node/, handed out by
// lab/labNodes.js, holding the files under test, reset before it is handed out, one test on it at a time.
// Found where it lives: repo://lab/ of the checkout, or, run from inside a lab node (repo://lab/node/<name>/), the lab that
// node belongs to. Loaded when a node is first asked for, so a test using only the page helpers needs no lab.
let LAB_MODULE = null;
const LAB = {
  get: function () {
    if (LAB_MODULE) return LAB_MODULE;
    const own = path.join(REPO, 'lab', 'labNodes.js');
    const outer = path.join(REPO, '..', '..', 'labNodes.js');
    const at = fs.existsSync(own) ? own : (path.basename(path.dirname(REPO)) === 'node' && fs.existsSync(outer)) ? outer : '';
    if (!at) throw new Error('no lab: neither ' + own + ' nor a lab around ' + REPO);
    LAB.nested = at !== own;
    LAB_MODULE = require(at);
    return LAB_MODULE;
  },
  nested: false,
  handOut: function (kind) { return LAB.get().handOut(kind).then(LAB.own); },
  handOutSync: function (kind) { return LAB.own(LAB.get().handOutSync(kind)); },
  // RUN FROM INSIDE A LAB NODE, THE NODE HANDED OUT HOLDS THIS TREE (goal/G47.1; cw found it in testicle's own test in debug
  // mode: the scripts it planted in its own tree never reached the classifier's node, so nothing was classified). Lab's
  // snapshot is the outer checkout; the files under test here are this tree, the ones a test planted in it too (ignored by
  // git or not). So every file of this spirit/run that differs is copied over, and one this tree lacks is removed; the node's
  // state is not touched (lab has just reset it).
  own: function (lab) {
    if (LAB.nested) syncTree(RUN, lab.run);
    return lab;
  },
};
const SYNC_SKIP = ['state', 'app-state', '.git'];
function syncTree(from, to) {
  const walk = function (dir, fn) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    names.forEach(function (d) { if (d.isDirectory()) { if (SYNC_SKIP.indexOf(d.name) === -1) walk(path.join(dir, d.name), fn); } else if (d.isFile()) fn(path.join(dir, d.name)); });
  };
  walk(from, function (src) {
    const dst = path.join(to, path.relative(from, src));
    // THE SAME BY SIZE AND TIME (goal/G47.1: reading both copies of every file took 2.5 s a sync, on every nested start, the
    // classifier's among them): a copy takes its source's time, so a file left alone compares equal without being read.
    let same = false;
    let a = null;
    try { a = fs.statSync(src); const b = fs.statSync(dst); same = a.size === b.size && Math.floor(a.mtimeMs) === Math.floor(b.mtimeMs); } catch (e) { same = false; }
    if (!same) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      try { if (a) fs.utimesSync(dst, a.atime, a.mtime); } catch (e) { /* compared by content next time it differs */ }
    }
  });
  walk(to, function (dst) {
    const src = path.join(from, path.relative(to, dst));
    if (!fs.existsSync(src)) { try { fs.rmSync(dst, { force: true }); } catch (e) { /* the next reset takes it */ } }
  });
}

// A node started on a lab node's tree on a free port (or o.port), until it answers, its DEBUG on by the node's own verb (the
// DEBUG page is answered only then). Answers { child, base, port, up, debug }.
// A LAB NODE'S HOME IS IN ITS OWN TREE (goal/G47.1, wsl: "every scratch node's backup writes into the real
// ~/.SpiritOS/backups (374 folders)"): spirit/state/config.json's spiritHome, the one setting backup reads for where it
// copies to (spirit/app/backup/backup.js spiritHome), set to <tree>/.spiritHome unless the test set one; the reset clears it.
function homeInTree(run) {
  const file = path.join(run, 'spirit', 'state', 'config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { cfg = {}; }
  if (cfg.spiritHome) return;
  cfg.spiritHome = path.join(path.dirname(path.dirname(run)), '.spiritHome');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}
async function startNode(lab, port) {
  const at = port || await freePort();
  homeInTree(lab.run);
  const child = spawn(process.execPath, ['spirit/server/script.js', '--port', String(at)], { cwd: lab.run, stdio: 'ignore' });
  lab.started(child.pid);
  const base = 'http://127.0.0.1:' + at;
  const up = await until(function () {
    return fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
  }, 60000);
  // spirit.debug, node.debug before goal/G49.23 (box v22 Part 2).
  const debug = up ? await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.debug', args: { debug: { on: true } } }) })
    .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.debug === true); }, function () { return false; }) : false;
  return { child: child, base: base, port: at, up: up, debug: debug };
}
function stopChild(child) { return new Promise(function (r) { if (!child || child.exitCode !== null) return r(); child.once('exit', function () { r(); }); try { child.kill(); } catch (e) { r(); } setTimeout(r, 6000); }); }

// A lab node, reset to the files under test, its node started. o.servers names app servers turned on before it starts, as
// their owner turns one on: an app of spirit/app/<name>/ runs by active in spirit/state/<name>/node.json (goal/G43.12,
// spirit/job/engine/script.js), every server being one since goal/G43.20. o.before(run), when given, plants what the test needs in the
// tree before the node starts; o.start false hands out the tree with no node, for start() later; o.port a port of the
// test's own. Answers { root, run, base, port, child, up, debug, start(), stop(), restart(), release() }: stop() ends the
// node, restart() starts it again on the same tree and port, release() frees the lab node for the next test (it is freed
// anyway when this process ends).
async function handed(opts) {
  const base = process.env.SPIRIT_MOUNT_BASE;
  const run = process.env.SPIRIT_MOUNT_RUN ? path.resolve(process.env.SPIRIT_MOUNT_RUN) : '';
  const post = function (call, args) {
    return fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function () { return { status: 0, body: null }; });
  };
  if (run && typeof opts.before === 'function') await opts.before(run);
  for (const name of opts.servers || []) {
    await post('spirit.app.active', { key: name, active: true });
    await until(function () { return post('api', { branch: name }).then(function (r) { return !!(r.body && r.body.interface); }); }, 30000);
  }
  const theRuns = function () { return Promise.reject(new Error('a handed node is its run\'s: ask scratchNode({ own: true }) for one to stop or restart')); };
  return { base: base, root: run ? path.dirname(path.dirname(run)) : '', run: run, child: null, up: true, debug: true, shared: true,
    startPage: function () { return Promise.resolve(true); }, stop: theRuns, restart: theRuns, release: function () { return Promise.resolve(); } };
}
async function scratchNode(o) {
  const opts = o || {};
  // ONE NODE HANDED TO A WHOLE RUN (goal/G47.1, Q10: testicle's UI tests "share one node and one Chrome that testicle hands
  // them"): the run that started this one names the node's address in SPIRIT_MOUNT_BASE and its tree in SPIRIT_MOUNT_RUN. A test
  // handed one gets that node and its tree to plant in (o.before), and the servers it asks for switched on there (app.active,
  // as its owner turns one on), waited for until each answers its interface. A test that stops or restarts its node, or
  // starts it later or on a port of its own, gets a node of its own (o.own, o.start false, o.port): the handed one is the run's.
  if (process.env.SPIRIT_MOUNT_BASE && opts.shared === true) return handed(opts);
  const lab = await LAB.handOut('node');
  const run = lab.run;
  trees.set(path.resolve(run), lab);
  (opts.servers || []).forEach(function (name) {
    // Its switch where the node reads it, the app's state folder by spirit.statePath (goal/G49.17). A server is named by its
    // id, its folder in dots (goal/G49.19: spirit.app.desk), and its folder is that id in slashes, never built from a word.
    const S = require('../script.js');
    const dir = path.join(run, ...S.statePath(S.slashedPath(name)).split('/'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'node.json'), JSON.stringify({ active: true }));
  });
  if (typeof opts.before === 'function') await opts.before(run);
  const n = { root: lab.root, run: run, name: lab.name, base: '', port: opts.port || 0, child: null, up: false, debug: false };
  n.start = async function () {
    const s = await startNode(lab, n.port);
    Object.assign(n, s);
    return n.up;
  };
  n.stop = function () { const c = n.child; n.up = false; return stopChild(c); };
  n.restart = async function () { await n.stop(); return n.start(); };
  n.release = async function () { await n.stop(); lab.release(); };
  if (opts.start !== false) await n.start();
  return n;
}

// THE TREE ONLY, FOR A TEST THAT MAKES ITS WORLD IN PLAIN FUNCTIONS (goal/G47.3): a lab node reset to the files under test,
// no node on it yet, handed out without a promise. Answers { root, run, release() }; the test plants what it needs in run
// and starts its node there by startNodeOn, as often as it restarts it. Freed when this process ends.
const trees = new Map();
function scratchTree() {
  const lab = LAB.handOutSync('node');
  trees.set(path.resolve(lab.run), lab);
  return { root: lab.root, run: lab.run, name: lab.name, release: function () { trees.delete(path.resolve(lab.run)); lab.release(); } };
}
// THE NODE ON IT: spirit/server/script.js on that tree's spirit/run on the port the test chose, the child answered at once, as a
// test's own spawn did (o.stdio as spawn's, 'ignore' unless given). Only a tree lab handed out to this process: every node
// a test uses is one of lab's (the box: "the lab nodes are to satisfy the testing needs").
function startNodeOn(run, port, o) {
  const lab = trees.get(path.resolve(run));
  if (!lab) throw new Error('startNodeOn: ' + run + ' is no lab node handed out by scratchTree');
  homeInTree(lab.run);
  const child = spawn(process.execPath, ['spirit/server/script.js', '--port', String(port)], Object.assign({ cwd: lab.run, stdio: 'ignore' }, (o && o.stdio) ? { stdio: o.stdio } : {}, (o && o.windowsHide) ? { windowsHide: true } : {}));
  lab.started(child.pid);
  return child;
}

// A TEST DONE WITH ITS LAB NODE frees it, never deletes it: lab resets it for the next test (the box: "the lab nodes made
// once, instead of one copy of the tree per test run"). x is what scratchTree, scratchNode or a test's own world named
// { root, run } handed it; anything else is left alone.
function freeTree(x) {
  if (!x) return;
  if (typeof x.release === 'function') { try { x.release(); } catch (e) { /* freed when this process ends */ } return; }
  const run = path.resolve(x.run || path.join(String(x.root || ''), 'spirit', 'run'));
  const lab = trees.get(run);
  if (lab) { trees.delete(run); lab.release(); return; }
  // A test's own temp folder, no lab node: deleted, as the test did before (never a folder under repo://lab/node/).
  const root = path.resolve(String(x.root || ''));
  const inLab = root.split(path.sep).join('/').indexOf('/lab/node/') !== -1;
  if (x.root && !inLab) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* a door still closing */ }
  }
}

// A SCRATCH RELAY (goal/G41.30; Andy: "The relay's door is not tested yet: there is no scratch relay helper. - close
// this gap, dammit!"): one of lab's two relays (goal/G47.3; Andy: "i specifically wanted two of them so that we can test
// members of one relay talking to members of another."), reset to the files under test, a relay identity planted and an
// owner written as a relay is installed (o.owner, an identity of relayAuth's; one is made when none is given), its face
// domain (o.faceDomain, spirit/state/face.json), and relayServer.js started on a free port with its spirit object's DEBUG
// on when o.debug, until it answers. Never a live relay.
// A file node loads before the one server (-r), written into the lab tree's own state folder, which lab resets: what a scratch
// relay's child did before requiring the old relay server itself.
function relayPreload(run, name, code) {
  const file = path.join(run, 'spirit', 'state', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '\'use strict\';\n' + code + '\n');
  return file;
}
async function scratchRelay(o) {
  const opts = o || {};
  const lab = await LAB.handOut('relay');
  const root = lab.root;
  const run = lab.run;
  const auth = require(path.join(run, 'spirit', 'relayAuth', 'script.js'));
  auth.nameIdentity(run, 'relay');
  const owner = opts.owner || auth.generateIdentity('owner');
  auth.writeOwner(run, owner.publicKey);
  fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
  if (opts.faceDomain) fs.writeFileSync(path.join(run, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: opts.faceDomain }));
  const port = await freePort();
  // THE ONE SERVER, STARTED AS A RELAY (goal/G49.25, box v16: "spirit/server/script.js is THE server, for node and relay alike";
  // "spirit.server.relay goes."): node runs spirit/server/script.js --relay itself, since it starts a server only when it is the
  // file node was started with; its DEBUG set first by a file node loads before it (-r), in the lab tree's state folder.
  const pre = relayPreload(run, 'zzScratchRelay.js', 'require(require("path").resolve("spirit/script.js")).debugLog(' + (opts.debug ? 'true' : 'false') + ');');
  const child = spawn(process.execPath, ['-r', pre, 'spirit/server/script.js', '--relay', '--port', String(port)], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { PORT: String(port) }) });
  lab.started(child.pid);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/').then(function (r) { return r.status > 0; }); }, 30000);
  return { root: root, run: run, base: base, port: port, child: child, up: up, owner: owner, auth: auth, name: lab.name,
    release: async function () { await stopChild(child); lab.release(); } };
}

// A SCRATCH RELAY WITH FACES (goal/G41.30): one of lab's two relays as scratchRelay's, its real relayServer.js and relay.js
// in a child of their own, so a crash is seen and harms nothing. Members named in o.members are seated by the relay's own join, each with a
// face, its node present (a stream whose lines come back as { stream: name, line }), logged in by its emailed token.
// Answers { base, port, child, root, auth, relayKey, members: { <name>: { publicKey, privateKey, sid, host } },
// lines: [{ stream, line }], stop() }, or up false.
async function scratchFaceRelay(o) {
  const opts = o || {};
  const domain = opts.faceDomain || 'relay.example';
  const names = opts.members || ['harbour', 'quay'];
  const lab = await LAB.handOut('relay');
  const root = lab.root;
  const run = lab.run;
  const auth = require(path.join(run, 'spirit', 'relayAuth', 'script.js'));
  auth.nameIdentity(run, 'relay');
  // Its owner: o.ownerKey, a real node's key that this relay then calls its owner, or a stranger made here.
  auth.writeOwner(run, opts.ownerKey || auth.generateIdentity('owner').publicKey);
  fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: domain }));
  const port = await freePort();
  // The child: relay.js's own createRelay, its mailer a stand-in that keeps the mail; then the real relayServer.js.
  // Loaded before the one server starts as a relay (-r; goal/G49.25): the hook on createRelay, and once the server has made its
  // relay, the seating below, a tick later.
  const code = 'const path = require("path"); const R = require(path.resolve("spirit/relay/processor/script.js")); const made = R.createRelay; const mails = []; let box = null;' +
    ' R.createRelay = function (root, deps) { box = made(root, Object.assign({}, deps, { sendMail: function (m) { mails.push(m); if (process.send) process.send({ mail: m }); return Promise.resolve({ ok: true }); } })); setImmediate(seat); return box; };' +
    ' function seat() {' +
    ' const auth = require(path.resolve("spirit/relayAuth/script.js")); const store = require(path.resolve("spirit/relay/store/script.js")).open(box.rootDir ? box.rootDir() : process.cwd());' +
    ' const out = { relayKey: box.relayPublicKey(), members: {} };' +
    ' ' + JSON.stringify(names) + '.forEach(function (name) { const id = auth.generateIdentity(name); const mail = name + "@example.org";' +
    '  box.join(id.publicKey, mail, "http://127.0.0.1:1/face.html", ""); const code = /[?&]join=([A-Za-z0-9_-]+)/.exec(mails[mails.length - 1].text)[1]; box.joinConfirm(id.publicKey, code, "");' +
    '  store.members.setFace(id.publicKey, name, mail);' +
    '  const sink = { write: function (x) { process.send({ stream: name, line: String(x) }); return true; }, end: function () {}, on: function () {}, once: function () {}, writeHead: function () {}, setHeader: function () {}, flushHeaders: function () {}, socket: {} };' +
    '  box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), sink);' +
    '  box.faceLogin(name, mail); const token = mails[mails.length - 1].text.split(/\\r?\\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];' +
    '  out.members[name] = { publicKey: id.publicKey, privateKey: id.privateKey, sid: box.faceLogin(name, token).session, host: name + "." + ' + JSON.stringify(domain) + ' }; });' +
    // A dishonest relay: it gives a member a face the member never asked for (setFace, below).
    ' process.on("message", function (m) { if (m && m.setFace) { store.members.setFace(m.setFace[0], m.setFace[1], m.setFace[2]); process.send({ faceSet: m.setFace[1] }); } });' +
    ' process.send({ ready: out }); }';
  const pre = relayPreload(run, 'zzScratchFaceRelay.js', code);
  const start = function () { return spawn(process.execPath, ['-r', pre, 'spirit/server/script.js', '--relay', '--port', String(port)], { cwd: run, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { PORT: String(port) }) }); };
  let child = start();
  lab.started(child.pid);
  const base = 'http://127.0.0.1:' + port;
  const lines = [];
  // Every mail the relay sent, for a real node joining it and a face logging in (spirit/contact/faceHome/test/script.js).
  const mailed = [];
  let ready = null;
  const hear = function (m) { if (m && m.ready) ready = m.ready; else if (m && m.mail) mailed.push(m.mail); else if (m && m.stream) lines.push(m); };
  child.on('message', hear);
  const up = await until(function () { return ready ? fetch(base + '/').then(function (r) { return r.status > 0; }) : false; }, 30000);
  return { up: up && !!ready, root: root, run: run, base: base, port: port, child: child, auth: auth, relayKey: ready && ready.relayKey, members: ready ? ready.members : {}, lines: lines, mailed: mailed, setFace: function (key, name, mail) { child.send({ setFace: [key, name, mail] }); },
    // THE OWNER MARK PUT THERE OVER SSH: the relay stopped, owner.json written, started again on the same folder and port.
    becomeOwned: async function (key) {
      await new Promise(function (resolve) { child.once('exit', resolve); child.kill(); });
      auth.writeOwner(run, key);
      ready = null;
      child = start();
      lab.started(child.pid);
      child.on('message', hear);
      return until(function () { return ready ? fetch(base + '/').then(function (r) { return r.status > 0; }) : false; }, 30000);
    },
    // Its relay ended and the lab relay freed: lab resets it before the next test, nothing is deleted here.
    stop: function () { try { child.kill(); } catch (e) { /* gone */ } lab.release(); } };
}

// Headless Chrome on a scratch profile, and one page of it over the debugging protocol.
// A TEST'S CHROME ENDS WITH THE TEST (goal/G47.1, Q9, Andy: "anything that leaves 77 useless chromes running must be
// fixed."). A test that ends without closing its page, or is killed, never runs its own cleanup, so a watcher of its own,
// a process apart, asks twice a second whether the test still lives; once it is gone, it ends that Chrome and deletes its
// profile. A Chrome that ends first ends its watcher too.
// ITS PROFILE GOES WITH IT, EITHER WAY (goal/G47.1, Andy: "make sure with spirit/test/headLessChrome.js that no chromes are left
// cluttering my machine."; found on his Windows machine: 2274 spirit-chrome-* profiles left in TEMP): a Chrome that ended
// first left its profile behind, and on Windows a profile is still locked for a moment after its Chrome is killed, so the one
// delete a test did failed. The watcher deletes it once its Chrome is gone, trying again for ten seconds.
function watchChrome(kid, profile) {
  if (!kid || !kid.pid) return;
  const code = 'const [test, chrome, profile] = process.argv.slice(1); const fs = require("fs"); const alive = function (p) { try { process.kill(Number(p), 0); return true; } catch (e) { return false; } };' +
    ' const rm = function (n) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} if (fs.existsSync(profile) && n < 20) setTimeout(function () { rm(n + 1); }, 500); };' +
    ' const t = setInterval(function () { if (!alive(chrome)) { clearInterval(t); rm(0); return; } if (alive(test)) return; clearInterval(t);' +
    ' try { process.kill(Number(chrome), "SIGTERM"); } catch (e) {}' +
    ' setTimeout(function () { try { process.kill(Number(chrome), "SIGKILL"); } catch (e) {} rm(0); }, 2000); }, 500);';
  try {
    const w = spawn(process.execPath, ['-e', code, String(process.pid), String(kid.pid), profile], { stdio: 'ignore', detached: true, windowsHide: true });
    w.unref();
  } catch (e) { /* no watcher: the test's own cleanup is all there is */ }
}
// THE PROFILES LEFT BEFORE, SWEPT (the same finding): once per test process, a process apart deletes every chrome-*
// profile older than an hour. No test's Chrome lives that long (a job is killed at two minutes); a locked one stays for the
// next sweep.
let swept = false;
function sweepProfiles() {
  if (swept) return;
  swept = true;
  const code = 'const fs = require("fs"); const path = require("path"); const dir = process.argv[1]; const old = Date.now() - 3600000;' +
    ' let names = []; try { names = fs.readdirSync(dir); } catch (e) {}' +
    ' names.forEach(function (n) { if (n.indexOf("chrome-") !== 0) return; const p = path.join(dir, n);' +
    ' try { if (fs.statSync(p).mtimeMs < old) fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} });';
  try {
    const w = spawn(process.execPath, ['-e', code, tempFolder.path(PROFILES)], { stdio: 'ignore', detached: true, windowsHide: true });
    w.unref();
  } catch (e) { /* swept by the next test */ }
  // Chrome's own scratch in the system temp folder (.com.google.Chrome.*, .org.chromium.Chromium.*), once an hour old
  // (goal/G49.23; Andy: "they still fucking litter, and fill the temp folders").
  const chromeScratch = 'const fs = require("fs"); const path = require("path"); const dir = process.argv[1]; const old = Date.now() - 3600000;' +
    ' let names = []; try { names = fs.readdirSync(dir); } catch (e) {}' +
    ' names.forEach(function (n) { if (n.indexOf(".com.google.Chrome.") !== 0 && n.indexOf(".org.chromium.Chromium.") !== 0) return;' +
    ' const p = path.join(dir, n); try { if (fs.lstatSync(p).mtimeMs < old) fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} });';
  try {
    const w = spawn(process.execPath, ['-e', chromeScratch, require('os').tmpdir()], { stdio: 'ignore', detached: true, windowsHide: true });
    w.unref();
  } catch (e) { /* swept by the next test */ }
  // Under every node's temp root too, since each scratch node has its own (Andy: "WHERE ARE THE FIXES FOR TESTS THAT
  // LITTER ALL OVER THE FUCKING PLACE?"; 150 Chrome processes found on WSL, up to 38 hours old, their watchers gone).
  try {
    const base = path.resolve(tempFolder.path(PROFILES), '..', '..', '..', '..');
    const w = spawn(process.execPath, ['-e', '(' + endOrphans.toString() + ')(process.argv[1], process.argv[2])', base, PROFILES], { stdio: 'ignore', detached: true, windowsHide: true });
    w.unref();
  } catch (e) { /* swept by the next test */ }
}
// A TEST CHROME NOBODY OWNS IS ENDED, AND THE EMPTY FOLDERS ITS PROFILES LEFT GO. Run in a process apart, given the temp
// base (<tmp>/spirit) and this file's route. A Chrome is nobody's when its parent is gone (on Linux re-parented to init, on
// WSL /init): a test's Chrome ends with the test (above), and a run's live Chrome, of any testicle on the machine, has its
// parent, so it is never touched. It is ended and its profile removed. Then each <base>/<node>/<route> left empty is
// removed, with every parent folder of it that is empty, up to the base; and so, first, is a profile there older than an
// hour that no process runs on.
function endOrphans(base, route) {
  const fs = require('fs');
  const path = require('path');
  const cp = require('child_process');
  const marker = ('--user-data-dir=' + path.join(base, '')).toLowerCase();
  const sep = route.split('/').join(path.sep).toLowerCase() + path.sep + 'chrome-';
  let rows = [];
  try {
    if (process.platform === 'linux') {
      rows = fs.readdirSync('/proc').filter(function (d) { return /^\d+$/.test(d); }).map(function (d) {
        let args = ''; let ppid = 0; let parent = null;
        try { args = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').split('\0').join(' '); } catch (e) { return null; }
        try { ppid = Number(/^PPid:\s*(\d+)/m.exec(fs.readFileSync('/proc/' + d + '/status', 'utf8'))[1]); } catch (e) { ppid = 0; }
        try { parent = fs.readFileSync('/proc/' + ppid + '/cmdline', 'utf8').split('\0')[0]; } catch (e) { parent = null; }
        return { pid: Number(d), args: args, orphan: ppid <= 1 || parent === null || parent === '/init' || parent === '/sbin/init' };
      }).filter(Boolean);
    } else if (process.platform === 'win32') {
      const out = cp.execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', '$a = @{}; Get-CimInstance Win32_Process | ForEach-Object { $a[[int]$_.ProcessId] = 1 }; Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ForEach-Object { "$($_.ProcessId) $(if ($a.ContainsKey([int]$_.ParentProcessId)) {1} else {0}) $($_.CommandLine)" }'], { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 1 << 24 });
      rows = out.split(/\r?\n/).map(function (l) { const m = /^\s*(\d+)\s+([01])\s+(.*)$/.exec(l); return m ? { pid: Number(m[1]), args: m[3], orphan: m[2] === '0' } : null; }).filter(Boolean);
    }
  } catch (e) { rows = []; }
  rows.forEach(function (r) {
    const low = r.args.toLowerCase();
    const at = low.indexOf(marker);
    if (at === -1 || low.indexOf('--type=') !== -1 || low.indexOf(sep) === -1 || !r.orphan) return;
    const profile = r.args.slice(at + '--user-data-dir='.length).split(/\s+--/)[0].replace(/^"|"$/g, '').trim();
    try { process.kill(r.pid, 'SIGKILL'); } catch (e) { /* gone */ }
    if (profile.toLowerCase().indexOf(sep) !== -1) setTimeout(function () { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* locked: the next sweep */ } }, 1500);
  });
  let nodes = [];
  try { nodes = fs.readdirSync(base); } catch (e) { nodes = []; }
  // A profile no process runs on, older than an hour, is the hourly sweep's rule (above) on every node's root.
  const old = Date.now() - 3600000;
  const inUse = rows.map(function (r) { return r.args.toLowerCase(); }).join('\n');
  nodes.forEach(function (n) {
    const at = path.join(base, n, route.split('/').join(path.sep));
    let names = [];
    try { names = fs.readdirSync(at); } catch (e) { names = []; }
    names.forEach(function (c) {
      if (c.indexOf('chrome-') !== 0) return;
      const p = path.join(at, c);
      if (inUse.indexOf(p.toLowerCase()) !== -1) return;
      try { if (fs.statSync(p).mtimeMs < old) fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* locked: the next sweep */ }
    });
  });
  nodes.forEach(function (n) {
    let dir = path.join(base, n, route.split('/').join(path.sep));
    while (dir.length > base.length + 1) {
      try { if (fs.readdirSync(dir).length) break; fs.rmdirSync(dir); } catch (e) { break; }
      dir = path.dirname(dir);
    }
  });
}
// ONE CHROME FOR A WHOLE RUN (goal/G47.1, box v144: "run on one node and one Chrome for the whole run"): a run that judges many
// scripts starts one Chrome by sharedChrome() and names its debugging port to the processes it starts, in SPIRIT_CHROME_PORT;
// there chromePage opens a fresh page of that Chrome (0.1 s) in place of a Chrome of its own (0.7 s), and its kill() closes
// only that page. Measured on Windows before: a lab node's boot 6.4 s and a Chrome 0.7 s, paid again for every script.
let ownShared = null;
async function sharedChrome(chrome) {
  const was = process.env.SPIRIT_CHROME_PORT;
  delete process.env.SPIRIT_CHROME_PORT;
  const first = await chromePage(chrome);
  if (was !== undefined) process.env.SPIRIT_CHROME_PORT = was;
  if (first.error) return first;
  ownShared = { kid: first.kid, profile: first.profile, port: first.port, chrome: chrome, close: function () { try { first.sock.close(); } catch (e) { /* gone */ } try { first.kid.kill(); } catch (e) { /* gone */ } } };
  return ownShared;
}
// A SHARED CHROME THAT WILL NOT SERVE IS REPLACED (goal/G47.1, box v144: "only a hung page is reloaded"): one this process started,
// after a page of it hung or would not open, is ended and a fresh one started in its place, its port named anew for every page
// opened after. Answers the new port, or '' when there is none.
async function renewChrome() {
  const old = ownShared;
  if (!old) return '';
  old.close();
  const fresh = await sharedChrome(old.chrome);
  if (fresh.error) { delete process.env.SPIRIT_CHROME_PORT; return ''; }
  process.env.SPIRIT_CHROME_PORT = String(fresh.port);
  return String(fresh.port);
}
// A page that will not open within OPEN_LIMIT_MS (found on Windows: the 15th page of one Chrome never came) renews the Chrome
// once, when this process owns it.
const OPEN_LIMIT_MS = 5000;
async function pageOf(port, again) {
  const late = new Promise(function (r) { setTimeout(function () { r(null); }, OPEN_LIMIT_MS); });
  const opened = await Promise.race([openPage(port), late]);
  if (opened && !opened.error) return opened;
  if (!again && ownShared && String(ownShared.port) === String(port)) { const p = await renewChrome(); if (p) return pageOf(p, true); }
  return opened || { error: 'the shared Chrome opened no page in ' + (OPEN_LIMIT_MS / 1000) + ' s' };
}
async function openPage(port) {
  const made = await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' }).then(function (r) { return r.json(); }, function (e) { return { error: String(e && e.message || e) }; });
  if (!made || !made.webSocketDebuggerUrl) return { error: 'the shared Chrome opened no page: ' + JSON.stringify(made).slice(0, 200) };
  const close = function () { fetch('http://127.0.0.1:' + port + '/json/close/' + made.id).catch(function () { /* gone with its Chrome */ }); };
  return Object.assign(await attach(made.webSocketDebuggerUrl), { kid: { kill: close, pid: 0 }, profile: '', port: port, shared: true });
}
async function attach(url) {
  const sock = new WebSocket(url);
  await new Promise(function (resolve, reject) { sock.onopen = resolve; sock.onerror = reject; });
  let n = 0;
  const waiting = {};
  const heard = [];
  sock.onmessage = function (m) {
    const msg = JSON.parse(String(m.data));
    if (msg.id && waiting[msg.id]) { waiting[msg.id](msg); delete waiting[msg.id]; } else if (msg.method) heard.push(msg);
  };
  const send = function (method, params) { const id = ++n; sock.send(JSON.stringify({ id: id, method: method, params: params || {} })); return new Promise(function (r) { waiting[id] = r; }); };
  const evaluate = function (expr) {
    return send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(function (r) {
      return r.result && r.result.result ? r.result.result.value : undefined;
    });
  };
  await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable'); await send('Page.enable');
  return { send: send, evaluate: evaluate, heard: heard, sock: sock };
}
async function chromePage(chrome) {
  if (process.env.SPIRIT_CHROME_PORT) return pageOf(process.env.SPIRIT_CHROME_PORT);
  sweepProfiles();
  const profile = tempFolder(PROFILES + '/chrome-' + require('crypto').randomBytes(6).toString('hex'));
  // ALL IT WRITES INSIDE ITS PROFILE, AND NO CRASH DUMP (goal/G49.23; Andy: "they still fucking litter, and fill the temp folders",
  // "whatever assigns those TEMP spots, should be able two know which shit needs cleaning up"): Chrome's own scratch folders went
  // to the system temp folder beside its profile, where no sweep owns them, and a Chrome that crashed under WSL left a core
  // dump of 669 GB in its crash folder. Its temp is a folder inside its profile, so the profile's removal takes it; its crash
  // reporter is off; and on Linux it starts with core dumps at zero (exec keeps its process id, so its watch and its kill hold).
  // Its temp stays the system's: Chrome makes its sockets in its temp folder, and a temp inside the profile, under the
  // node's temp root, is too long a path for a socket, so no page answered (wsl, 2026-11-28: the text page 5/18 with it,
  // 18/18 without). What it leaves there, sweepProfiles removes once an hour old.
  const env = process.env;
  const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-breakpad', '--disable-crash-reporter', '--window-size=1280,800', 'about:blank'];
  const how = { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env: env };
  // NO CRASH DUMP, EVER (goal/G49.27; Andy: "the test system is STILL littering all over the TEMP folders. my ubuntu choked today"): a
  // test Chrome that crashed under WSL left a 682 GB dump in Windows' temp folder (wsl-crashes) and filled the C: drive. WSL's
  // core_pattern is a pipe (|/wsl-capture-crash), and the kernel ignores a core limit of 0 for a pipe; a limit of exactly 1 byte is
  // the one it honours there, skipping the dump (wsl, measured: an aborted process dumps without it, not with it). prlimit execs, so
  // the pid stays Chrome's, and every child Chrome starts inherits the limit.
  const kid = process.platform === 'linux' ? spawn(fs.existsSync('/usr/bin/prlimit') ? '/usr/bin/prlimit' : 'prlimit', ['--core=1', chrome].concat(args), how) : spawn(chrome, args, how);
  watchChrome(kid, profile);
  let err = '';
  kid.stderr.on('data', function (d) { err += String(d); });
  let ws = '';
  await until(function () { const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) ws = m[1]; return !!ws; }, WAIT);
  if (!ws) return { kid: kid, profile: profile, error: 'Chrome gave no debugging address: ' + err.slice(-200) };
  const port = new URL(ws).port;
  let target = null;
  await until(function () {
    return fetch('http://127.0.0.1:' + port + '/json/list').then(function (r) { return r.json(); }).then(function (list) { target = list.filter(function (t) { return t.type === 'page'; })[0]; return !!target; });
  }, WAIT);
  if (!target) return { kid: kid, profile: profile, error: 'Chrome opened no page' };
  return Object.assign(await attach(target.webSocketDebuggerUrl), { kid: kid, profile: profile, port: port });
}

// A FAKE PAGE'S SPIRIT, AS AN ELEMENT FINDS IT (goal/G43.32): a test that runs an element script in a world of its own
// (vm) hands that world's spirit object here. It gets a spirit.requireScript that answers what is already
// loaded at once, as spirit.requireScript does a second time: any path the test hands in loaded. Answers the spirit object.
// A SCRIPT OF THE TREE BY ITS PATH, RUN IN THAT WORLD (goal/G49.6; Andy: "make every single test use spirit.requireScript() to
// load product files"): o.window, the world's own object (made a vm context if it is not one yet), and o.real, the run-root
// paths the test has loaded as they are, its subject and any part it does not stand in for. spirit.requireScript(one of them)
// runs that file once in the world, by its path, at once, and answers what it placed at its path on the spirit object, the
// script's error when it throws; at once as the loaded ones answer (a then that calls back before it returns), so a test
// that builds its world without waiting reads what was placed on the next line. Any other path goes to the test's own
// requireScript, as before.
function pageSpirit(s, loaded, o) {
  const sp = s || {};
  const opts = o || {};
  // real: the paths, or a test of a path (a function answering true for one it loads as it is: a companion data.js named as
  // it is asked, say).
  const listed = Object.create(null);
  if (Array.isArray(opts.real)) opts.real.forEach(function (p) { listed[String(p).replace(/^\/+/, '')] = true; });
  const isReal = function (at) { return typeof opts.real === 'function' ? !!opts.real(at) : !!listed[at]; };
  const ran = Object.create(null);
  // A path's keys as spirit.js places it: a folder's script.js at its folder's own name (goal/G49.9), on the spirit object
  // itself, its first key spirit the object (goal/G49.23, box v22: "no spirit.required"): spirit/fs/script.js at spirit.fs.
  const keysOf = function (at) {
    const keys = String(at).replace(/^\/+/, '').replace(/\.js$/, '').split('/').filter(Boolean);
    if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
    return keys.slice(1);
  };
  const placedAt = function (at) {
    return keysOf(at).reduce(function (x, k) { return x == null ? undefined : x[k]; }, sp);
  };
  // What a script exposed, placed at its place, the folder's other scripts kept on it.
  const placeOn = function (spirit, at, value) {
    const keys = keysOf(at);
    if (!keys.length) return;
    let o = spirit;
    for (let i = 0; i < keys.length - 1; i += 1) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
    const last = keys[keys.length - 1];
    const was = o[last];
    if (was && typeof was === 'object' && typeof was.create !== 'function') Object.keys(was).forEach(function (k) { if (!(k in value)) value[k] = was[k]; });
    if (was === undefined || (was && typeof was === 'object' && typeof was.create !== 'function')) o[last] = value;
  };
  const runReal = function (at) {
    if (!ran[at]) {
      const vm = require('vm');
      if (!vm.isContext(opts.window)) vm.createContext(opts.window);
      const file = path.join(RUN, at);
      // IN A MODULE BOX, AS THE PAGE'S LOADER RUNS IT (goal/G49.9, box v5): what the script sets as module.exports is placed at
      // its place, a folder's script.js at its folder's name.
      const box = { exports: {} };
      const start = box.exports;
      try {
        vm.runInContext('(function (module, exports) {' + fs.readFileSync(file, 'utf8') + '\n})', opts.window, { filename: file })(box, box.exports);
        const set = box.exports !== start || Object.keys(start).length > 0;
        if (set && box.exports && (typeof box.exports === 'object' || typeof box.exports === 'function')) placeOn(sp, at, box.exports);
        ran[at] = { ok: true };
      } catch (e) { ran[at] = { ok: false, error: e }; }
    }
    const r = ran[at];
    return { then: function (f, g) {
      if (!r.ok) return typeof g === 'function' ? Promise.resolve(g(r.error)) : Promise.reject(r.error);
      const v = placedAt(at);
      return Promise.resolve(typeof f === 'function' ? f(v) : v);
    } };
  };
  const have = Object.assign({}, loaded || {});
  const own = sp.requireScript;
  sp.requireScript = function (p) {
    const at = String(p || '').replace(/^\/+/, '');
    if (Object.prototype.hasOwnProperty.call(have, at)) { const v = have[at]; return { then: function (f) { return Promise.resolve(f ? f(v) : v); } }; }
    if (opts.window && isReal(at) && fs.existsSync(path.join(RUN, at))) return runReal(at);
    return typeof own === 'function' ? own.apply(this, arguments) : Promise.resolve({});
  };
  // NO spirit.dataStore (goal/G49.23, box v22 Part 1; Andy: "no spirit.dataStore"): a world's spirit holds no store; an element
  // reads a branch's rows from the branch its requireScript answers, which a test hands in.
  return sp;
}

// A PAGE SCRIPT RUN BY A NODE TEST AS THE PAGE'S LOADER RUNS IT (goal/G49.9, box v5): the file (a run path, or absolute
// under the run root) in a module box, in the context given (a vm context) or this one, and what it set as module.exports
// placed at its place on that context's window.spirit itself (a folder's script.js at its folder's name). src, when
// given, is the file's text as the test holds it. Answers what it exposed.
function runAsPage(file, context, src) {
  const vm = require('vm');
  const abs = path.isAbsolute(String(file)) ? String(file) : path.join(RUN, String(file));
  const rel = path.relative(RUN, abs).split(path.sep).join('/');
  const text = typeof src === 'string' ? src : fs.readFileSync(abs, 'utf8');
  const box = { exports: {} };
  const start = box.exports;
  const wrapped = '(function (module, exports) {' + text + '\n})';
  const fn = context ? vm.runInContext(wrapped, context, { filename: abs }) : vm.runInThisContext(wrapped, { filename: abs });
  fn(box, box.exports);
  const set = box.exports !== start || Object.keys(start).length > 0;
  const win = context ? context : (global.window || global);
  if (set && box.exports && (typeof box.exports === 'object' || typeof box.exports === 'function')) {
    win.spirit = win.spirit || {};
    // ON THE SPIRIT OBJECT ITSELF (goal/G49.23, box v22): its first key spirit the object.
    const keys = rel.replace(/\.js$/, '').split('/').filter(Boolean);
    if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
    keys.shift();
    if (!keys.length) return box.exports;
    let o = win.spirit;
    for (let i = 0; i < keys.length - 1; i += 1) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
    const last = keys[keys.length - 1];
    const was = o[last];
    if (was && typeof was === 'object' && typeof was.create !== 'function') Object.keys(was).forEach(function (k) { if (!(k in box.exports)) box.exports[k] = was[k]; });
    if (was === undefined || (was && typeof was === 'object' && typeof was.create !== 'function')) o[last] = box.exports;
  }
  return box.exports;
}

module.exports = { runAsPage: runAsPage, sharedChrome: sharedChrome, renewChrome: renewChrome, pageSpirit: pageSpirit, sleep: sleep, until: until, freePort: freePort, appRuns: appRuns, watchRuns: watchRuns, findChrome: findChrome, scratchNode: scratchNode, scratchTree: scratchTree, startNodeOn: startNodeOn, freeTree: freeTree, scratchRelay: scratchRelay, scratchFaceRelay: scratchFaceRelay, chromePage: chromePage, WAIT: WAIT };

// A WORLD TO HAND OUT, AS A PROCESS OF ITS OWN (goal/G47.1, Q10 1; the box: "no production module loads or requires any test
// file"): `node spirit/test/headLessChrome.js --world` boots one lab node and one Chrome side by side, prints where they are on
// one line, @@WORLD {"base", "run", "chromePort"}, and holds them until its input closes (or it is ended), then lets them go.
// testicle starts it as it starts any test file, and hands what it printed to the suite runs it starts.
if (require.main === module && process.argv.indexOf('--world') !== -1) {
  (async function () {
    const found = findChrome();
    const both = await Promise.all([scratchNode({}), found ? sharedChrome(found) : Promise.resolve(null)]);
    const node = both[0], chrome = both[1];
    const out = { base: node && node.up ? node.base : '', run: node && node.up ? node.run : '', chromePort: chrome && !chrome.error ? String(chrome.port) : '' };
    process.stdout.write('@@WORLD ' + JSON.stringify(out) + '\n');
    let ended = false;
    const end = async function () {
      if (ended) return;
      ended = true;
      try { if (chrome && chrome.close) chrome.close(); } catch (e) { /* gone */ }
      try { if (node && node.release) await node.release(); } catch (e) { /* freed as this process ends */ }
      process.exit(0);
    };
    process.stdin.on('end', end);
    process.stdin.on('close', end);
    process.on('SIGTERM', end);
    process.stdin.resume();
  }());
}
