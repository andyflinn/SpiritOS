'use strict';

// apiAuth/G1.10: every appServer process says what a peer user needs, red on today's code.
//   Andy: "an app knows it's requirements, it must provide owners with the bundle-info in an owner-only verb
//   dependencies which returns a list ofminimum api-tree-paths, a peer user requires.", "dependencies format: a list
//   of grant-shapes consisten of "appname.verb"", "the server hard-codes that reply internaly", "DEBUG and
//   DEPENDENCIES, they are assumed to exist by the shell auth app. The harness will disallow appServer that don't
//   fill these two requirements.", "Only appServer processes are retrofitted.", and on the split: "yes to shape and
//   split" (the server hard-codes only its list; appServer builds the verb from it, as it does DEBUG).
// The contract the builder follows:
//   - appServer.serve(verbs, { dependencies: ['app' | 'app.verb', ...] }) adds DEPENDENCIES {} -> { paths: [...] },
//     the list as given. A path not in that form stops the start: the process exits non-zero and says why.
//   - Every appServer process under process/js (a node-operated server whose script requires appServer.js) answers
//     DEBUG and DEPENDENCIES in its api, and its DEPENDENCIES paths are all in that form.
//   Owner-only is the gate's (G1.2); this suite checks the verb exists and says the truth's shape.
//   Not here: desk taking its writer from the caller's key (G1.10's desk retrofit) waits on a team meeting.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by apiAuth/G1.10: ';
const RUN = path.join(__dirname, '..', 'run');
const PROC = path.join(RUN, 'process', 'js');
const APPSERVER = path.join(RUN, 'js', 'appServer.js');
const PATH_FORM = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_.-]+)?$/;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('apiAuth/G1.10: every appServer process answers DEBUG and DEPENDENCIES');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deps-'));
const kids = [];

function start(name, script) {
  const pipe = appClient.pipePathFor(scratch, name, process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const state = path.join(scratch, 'state-' + name);
  fs.mkdirSync(state, { recursive: true });
  let err = '';
  const kid = spawn(process.execPath, [script, '{}', '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'test', publicKey: 'MCowBQYDK2VwAyEAtesttesttesttesttesttesttesttesttest=' })],
    { cwd: RUN, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  kid.stderr.on('data', function (d) { err += d; });
  let exited = null;
  kid.on('exit', function (code) { exited = code; });
  kids.push(kid);
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register(name, pipe);
  return { client: client, err: function () { return err; }, exited: function () { return exited; } };
}
async function tree(s, name) {
  for (let i = 0; i < 40; i++) {
    if (s.exited() !== null) return null;
    try { const r = await s.client.ask('api'); if (r && r.body && r.body[name] && r.body[name].ok !== false) return r.body[name]; } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}
// The appServer processes: a server's manifest beside its script, and the script requires appServer.js.
function appServerProcesses() {
  return fs.readdirSync(PROC).filter(function (name) {
    const script = path.join(PROC, name, name + '.js');
    const manifest = path.join(PROC, name, name + '.json');
    if (!fs.existsSync(script) || !fs.existsSync(manifest)) return false;
    let m = null;
    try { m = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch (e) { return false; }
    return m && m.kind === 'server' && /appServer(\.js)?['"]/.test(fs.readFileSync(script, 'utf8'));
  });
}

(async function () {
  test.subHeading('the contract: serve(verbs, {dependencies}) builds the verb, and a malformed path stops the start');
  const good = path.join(scratch, 'depsGood.js');
  fs.writeFileSync(good, "require(" + JSON.stringify(APPSERVER) + ").serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, { dependencies: ['desk', 'desk.item.get'] });\n");
  const g = start('depsGood', good);
  const gt = await tree(g, 'depsGood');
  let gd = null;
  if (gt && gt.DEPENDENCIES) { try { gd = (await g.client.ask({ depsGood: { DEPENDENCIES: {} } })).body; } catch (e) { gd = null; } }
  if (gd && JSON.stringify(gd) === JSON.stringify({ paths: ['desk', 'desk.item.get'] })) test.check('DEPENDENCIES {} answered { paths: [\'desk\', \'desk.item.get\'] }, the list as given');
  else test.fail(OWED + 'serve with dependencies: api ' + JSON.stringify(gt && Object.keys(gt)) + ', DEPENDENCIES answered ' + JSON.stringify(gd));

  const bad = path.join(scratch, 'depsBad.js');
  fs.writeFileSync(bad, "require(" + JSON.stringify(APPSERVER) + ").serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, { dependencies: ['not a path!'] });\n");
  const b = start('depsBad', bad);
  for (let i = 0; i < 30 && b.exited() === null; i++) await sleep(100);
  if (b.exited() !== null && b.exited() !== 0 && /not a path!/.test(b.err())) test.check('a malformed path stopped the start, exit ' + b.exited() + ', and named the path');
  else test.fail(OWED + 'a malformed dependency: exited ' + b.exited() + ', said ' + JSON.stringify(b.err().slice(0, 160)));

  test.subHeading('every appServer process in the tree answers both');
  const names = appServerProcesses();
  if (!names.length) test.fail('no appServer process found under process/js');
  for (const name of names) {
    const s = start(name, path.join(PROC, name, name + '.js'));
    const t = await tree(s, name);
    if (!t) { test.fail(OWED + name + ' did not come up: ' + JSON.stringify(s.err().slice(0, 160))); continue; }
    if (!t.DEBUG || !t.DEPENDENCIES) { test.fail(OWED + name + '\'s api lacks ' + [t.DEBUG ? '' : 'DEBUG', t.DEPENDENCIES ? '' : 'DEPENDENCIES'].filter(Boolean).join(' and ')); continue; }
    let d = null;
    try { const ask = {}; ask[name] = { DEPENDENCIES: {} }; d = (await s.client.ask(ask)).body; } catch (e) { d = null; }
    if (d && Array.isArray(d.paths) && d.paths.every(function (p) { return typeof p === 'string' && PATH_FORM.test(p); })) test.check(name + ': DEBUG and DEPENDENCIES, paths ' + JSON.stringify(d.paths));
    else test.fail(OWED + name + '\'s DEPENDENCIES answered ' + JSON.stringify(d));
  }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
