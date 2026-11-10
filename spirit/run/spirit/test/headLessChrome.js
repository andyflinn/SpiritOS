'use strict';

// spirit/run/spirit/test/headLessChrome.js
// WHAT A TEST NEEDS TO DRIVE A REAL BROWSER (goal/G41.22): a scratch node with its DEBUG on, and headless Chrome on a
// scratch profile, one page of it over the debugging protocol. Taken out of the shell's general rules
// (spirit/test/spirit-sibling-generalRules.js), so an element's own test can open its own pages, /DEBUG/<path>/test/<page>.html
// (spirit/test/DEBUG.md), in the same browser on the same kind of node. Never Andy's node nor an agent's.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
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
        const r = await fetch(opts.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'jobs.get', args: { key: 'spirit.app.' + name } }) });
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

// A scratch copy of the tracked files of spirit/run, its node started on a free port. o.servers names app servers turned
// on before it starts, as their owner turns one on: an app of spirit/app/<name>/ runs by active in
// spirit/state/<name>/node.json (goal/G43.12, spirit/jobs.js), every server being one since goal/G43.20.
async function scratchNode(o) {
  // One node for a whole run of every file (below): the run that started this one hands its address on.
  if (process.env.SPIRIT_MOUNT_BASE) return { base: process.env.SPIRIT_MOUNT_BASE, child: null, root: '', up: true, debug: true, shared: true };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shell-child-'));
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  ((o && o.servers) || []).forEach(function (name) {
    const dir = path.join(run, 'spirit', 'state', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'node.json'), JSON.stringify({ active: true }));
  });
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
  }, 60000);
  // ITS DEBUG ON, by the node's own verb: the DEBUG page is answered only then.
  const debug = up ? await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'node.debug', args: { debug: { on: true } } }) })
    .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.debug === true); }, function () { return false; }) : false;
  return { root: root, base: base, child: child, up: up, debug: debug };
}

// A SCRATCH RELAY (goal/G41.30; Andy: "The relay's door is not tested yet: there is no scratch relay helper. - close
// this gap, dammit!"): a scratch copy of the tracked files of spirit/run, a relay identity planted and an owner written
// as a relay is installed (o.owner, an identity of relayAuth's; one is made when none is given), its face domain
// (o.faceDomain, spirit/state/face.json), and relayServer.js started on a free port with its spirit object's DEBUG on
// when o.debug, until it answers. Never a live relay.
async function scratchRelay(o) {
  const opts = o || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-child-'));
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const auth = require(path.join(run, 'spirit', 'relayAuth.js'));
  auth.nameIdentity(run, 'relay');
  const owner = opts.owner || auth.generateIdentity('owner');
  auth.writeOwner(run, owner.publicKey);
  fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
  if (opts.faceDomain) fs.writeFileSync(path.join(run, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: opts.faceDomain }));
  const port = await freePort();
  const code = 'require("./spirit/spirit.js").debug(' + (opts.debug ? 'true' : 'false') + '); process.argv[1] = require("path").resolve("spirit/relayServer.js"); require("./spirit/relayServer.js");';
  const child = spawn(process.execPath, ['-e', code], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { PORT: String(port) }) });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/').then(function (r) { return r.status > 0; }); }, 30000);
  return { root: root, run: run, base: base, port: port, child: child, up: up, owner: owner, auth: auth };
}

// A SCRATCH RELAY WITH FACES (goal/G41.30): scratchRelay's copy, its real relayServer.js and relay.js in a child of their
// own, so a crash is seen and harms nothing. Members named in o.members are seated by the relay's own join, each with a
// face, its node present (a stream whose lines come back as { stream: name, line }), logged in by its emailed token.
// Answers { base, port, child, root, auth, relayKey, members: { <name>: { publicKey, privateKey, sid, host } },
// lines: [{ stream, line }], stop() }, or up false.
async function scratchFaceRelay(o) {
  const opts = o || {};
  const domain = opts.faceDomain || 'relay.example';
  const names = opts.members || ['harbour', 'quay'];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-face-'));
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const auth = require(path.join(run, 'spirit', 'relayAuth.js'));
  auth.nameIdentity(run, 'relay');
  // Its owner: o.ownerKey, a real node's key that this relay then calls its owner, or a stranger made here.
  auth.writeOwner(run, opts.ownerKey || auth.generateIdentity('owner').publicKey);
  fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: domain }));
  const port = await freePort();
  // The child: relay.js's own createRelay, its mailer a stand-in that keeps the mail; then the real relayServer.js.
  const code = 'const path = require("path"); const R = require(path.resolve("spirit/relay.js")); const made = R.createRelay; const mails = []; let box = null;' +
    ' R.createRelay = function (root, deps) { box = made(root, Object.assign({}, deps, { sendMail: function (m) { mails.push(m); if (process.send) process.send({ mail: m }); return Promise.resolve({ ok: true }); } })); return box; };' +
    ' process.argv[1] = path.resolve("spirit/relayServer.js"); require("./spirit/relayServer.js");' +
    ' const auth = require(path.resolve("spirit/relayAuth.js")); const store = require(path.resolve("spirit/relayStore.js")).open(box.rootDir ? box.rootDir() : process.cwd());' +
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
    ' process.send({ ready: out });';
  let child = spawn(process.execPath, ['-e', code], { cwd: run, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { PORT: String(port) }) });
  const base = 'http://127.0.0.1:' + port;
  const lines = [];
  // Every mail the relay sent, for a real node joining it and a face logging in (spirit/test/faceHome-star.js).
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
      child = spawn(process.execPath, ['-e', code], { cwd: run, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { PORT: String(port) }) });
      child.on('message', hear);
      return until(function () { return ready ? fetch(base + '/').then(function (r) { return r.status > 0; }) : false; }, 30000);
    },
    stop: function () { try { child.kill(); } catch (e) { /* gone */ } try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } } };
}

// Headless Chrome on a scratch profile, and one page of it over the debugging protocol.
async function chromePage(chrome) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chrome-'));
  const kid = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,800', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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
  const sock = new WebSocket(target.webSocketDebuggerUrl);
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
  return { kid: kid, profile: profile, send: send, evaluate: evaluate, heard: heard, sock: sock };
}

// A FAKE PAGE'S SPIRIT, AS AN ELEMENT FINDS IT (goal/G43.32): a test that runs an element script in a world of its own
// (vm) hands that world's spirit object here. It gets spirit.required, the real installSpiritElement resident at
// spirit.required.spirit.element.installSpiritElement, and a spirit.require that answers what is already loaded at once,
// as spirit.require does a second time: the helper, or any path the test hands in loaded. So an element script run there
// places its factory at spirit.element.<its path> by its own call, as it runs. Answers the spirit object.
function pageSpirit(s, loaded) {
  const sp = s || {};
  const helper = require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'));
  sp.required = sp.required || {};
  sp.required.spirit = sp.required.spirit || {};
  sp.required.spirit.element = sp.required.spirit.element || {};
  sp.required.spirit.element.installSpiritElement = helper;
  const have = Object.assign({ 'spirit/element/installSpiritElement.js': helper }, loaded || {});
  const own = sp.require;
  sp.require = function (p) {
    const at = String(p || '').replace(/^\/+/, '');
    if (Object.prototype.hasOwnProperty.call(have, at)) { const v = have[at]; return { then: function (f) { return Promise.resolve(f ? f(v) : v); } }; }
    return typeof own === 'function' ? own.apply(this, arguments) : Promise.resolve({});
  };
  return sp;
}

module.exports = { pageSpirit: pageSpirit, sleep: sleep, until: until, freePort: freePort, appRuns: appRuns, watchRuns: watchRuns, findChrome: findChrome, scratchNode: scratchNode, scratchRelay: scratchRelay, scratchFaceRelay: scratchFaceRelay, chromePage: chromePage, WAIT: WAIT };
