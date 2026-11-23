'use strict';

// spirit/run/spirit/test/server.js
// The tests of spirit/server.js, the launcher, in this one file (spec: ./server.md; goal/G48.5). The node's own tests, once
// here, are spirit/server/test/node.js (the box: "spirit/test/server.js becomes the launcher's test; the node's goes to
// spirit/server/test/node.js, so the two histories are not mixed").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const H = S.requireScript('spirit/test/headLessChrome.js');

// ── THE LAUNCHER (goal/G48.5, the box, "completeness, asserted": "spirit/server.js starts a node with no mode and with
// --node, a relay with --relay, a server process with --app <script>; an unknown mode is refused; every argument after the
// mode reaches the module unchanged; a refused relay exits 78", "no tracked file names an old path", "no file stands at an
// old path"). Each start in a lab tree of its own (spirit/test/headLessChrome.js scratchTree), stopped and let go after.
const { spawn: spawnL, execFileSync: execL } = require('child_process');
const L = { trees: [], kids: [] };
function labTree() {
  const t = H.scratchTree();
  L.trees.push(t);
  // The node's home inside the tree, as spirit/test/headLessChrome.js's startNode makes it.
  const file = path.join(t.run, 'spirit', 'state', 'config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { cfg = {}; }
  if (!cfg.spiritHome) { cfg.spiritHome = path.join(path.dirname(path.dirname(t.run)), '.spiritHome'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(cfg, null, 2)); }
  return t;
}
function launch(run, args) {
  const kid = spawnL(process.execPath, ['spirit/server.js'].concat(args), { cwd: run, stdio: 'ignore' });
  const r = { kid: kid, code: null };
  kid.on('exit', function (c) { r.code = c; });
  L.kids.push(kid);
  return r;
}
function answers(port) { return fetch('http://127.0.0.1:' + port + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }
async function nodeComesUp(modeArgs) {
  const t = labTree();
  const port = await H.freePort();
  const r = launch(t.run, modeArgs.concat(['--port', String(port)]));
  const up = await H.until(function () { return r.code !== null ? Promise.resolve(false) : answers(port); }, 60000);
  await done(t, r);
  return !!up;
}
// Lab holds a few trees: each start lets its tree go once its test is done.
function done(t, r) {
  try { if (r && r.kid) r.kid.kill(); } catch (e) { /* gone */ }
  const i = L.trees.indexOf(t); if (i !== -1) L.trees.splice(i, 1);
  return new Promise(function (res) { setTimeout(function () { try { t.release(); } catch (e) { /* freed when this process ends */ } res(); }, 500); });
}
test.after(function () {
  L.kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  L.trees.forEach(function (t) { try { t.release(); } catch (e) { /* freed when this process ends */ } });
});
test.run('the launcher, spirit/server.js, with no mode and --port, starts a node on that port', 0.4, async function () {
  return (await nodeComesUp([])) || false;
}, test.limit.long);
test.run('the launcher, spirit/server.js, with --node and --port, starts a node on that port', 0.4, async function () {
  return (await nodeComesUp(['--node'])) || false;
}, test.limit.long);
test.run('the launcher refuses a mode it does not know: it exits, with a code that is not 0, and serves nothing', 0.8, async function () {
  const t = labTree();
  const port = await H.freePort();
  const r = launch(t.run, ['--zzNoSuchMode', '--port', String(port)]);
  await H.until(function () { return Promise.resolve(r.code !== null); }, 15000);
  const served = await answers(port);
  await done(t, r);
  return (r.code !== null && r.code !== 0 && !served) || false;
}, test.limit.slow);
test.run('a relay the launcher starts with --relay, whose store cannot open, exits 78 for systemd', 0.8, async function () {
  const t = labTree();
  const db = path.join(t.run, 'spirit', 'state', 'relay.db');
  fs.mkdirSync(path.dirname(db), { recursive: true }); fs.writeFileSync(db, 'not a database at all, so the store refuses to open');
  const port = await H.freePort();
  const r = launch(t.run, ['--relay', '--port', String(port)]);
  await H.until(function () { return Promise.resolve(r.code !== null); }, 30000);
  const code = r.code;
  await done(t, r);
  return code === 78 || false;
}, test.limit.slow);
// The old paths, spelled in pieces so that this file names none of them itself.
const OLD_PATHS = ['spirit/' + 'appServer.js', 'spirit/' + 'relayServer.js', 'spirit/' + 'serveCommon.js', 'node' + 'Agent.js', 'node' + 'Chat.js', 'node' + 'Desk.js', 'node' + 'Icons.js'];
const OLD_FILES = ['spirit/' + 'appServer.js', 'spirit/' + 'relayServer.js', 'spirit/' + 'serveCommon.js', 'spirit/app/agent/node' + 'Agent.js', 'spirit/app/chat/node' + 'Chat.js', 'spirit/app/desk/node' + 'Desk.js', 'spirit/app/icons/node' + 'Icons.js'];
test.run('no tracked file names an old path: none of the three moved core files, none of the four node<Name>.js', 0.4, function () {
  const REPO = path.resolve(RUN, '..', '..');
  const hits = OLD_PATHS.filter(function (p) { try { execL('git', ['grep', '-l', '-F', p], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); return true; } catch (e) { return false; } });
  // Written in pieces too (cw: "the old-path check should also catch the pieces form, 'spirit', 'serveCommon.js'"; boot.js's test
  // stalled Andy's Ubuntu testicle so): an old file built from the run root, RUN, 'spirit', '<old>.js'.
  const q = "'";
  const pieces = new RegExp('RUN, ' + q + 'spirit' + q + ', ' + q + '(' + ['app' + 'Server', 'relay' + 'Server', 'serve' + 'Common'].join('|') + ')\\.js' + q);
  let built = '';
  try { built = execL('git', ['grep', '-n', '-E', pieces.source], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { built = ''; }
  return (!hits.length && !built.trim()) || false;
}, test.limit.slow);
test.run('no file stands at an old path: neither the three core files nor the four node<Name>.js', 0.4, function () {
  return !OLD_FILES.some(function (f) { return fs.existsSync(path.join(RUN, f)); }) || false;
}, test.limit.quick);
test.run('spirit/server.js is the launcher: it hands its modes to spirit/server/node.js, relay.js and app.js', 0.4, function () {
  let src = ''; try { src = fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8'); } catch (e) { return false; }
  return ['server/node.js', 'server/relay.js', 'server/app.js'].every(function (m) { return src.indexOf(m) !== -1; }) || false;
}, test.limit.quick);
