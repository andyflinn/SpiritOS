'use strict';

// spirit/run/spirit/test/shellMove.js
// The tests of the move of relay-state's own files to spirit/state/ (spec: ./shellMove.md; goal/G43.8). Andy, the box: "remove
// proxy.json (no longer needed) and we move just the remaining files to spirit/state/", "flag day." Each run boots a real
// node or a real relay on a scratch copy of the tracked files, laid out as an old node left it. Nothing here touches this
// checkout's own state, nor a live node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const POSIX = process.platform !== 'win32';

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-state-move-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
// The old layout, as a node of the previous tag left it: its files at relay-state's top, and the two folders that stay.
function oldLayout(run, extra) {
  // keyOf loaded relayAuth in this copy, which mints a key where none stands: a node of the old layout has none here.
  fs.rmSync(path.join(run, 'spirit', 'state'), { recursive: true, force: true });
  const old = path.join(run, 'relay-state');
  fs.mkdirSync(path.join(old, 'process', 'keepme'), { recursive: true });
  fs.mkdirSync(path.join(old, 'shell', 'keepme'), { recursive: true });
  fs.mkdirSync(path.join(old, 'peerStats'), { recursive: true });
  fs.mkdirSync(path.join(old, 'someClient'), { recursive: true });
  fs.writeFileSync(path.join(old, 'process', 'keepme', 'kept.json'), '{"kept":"process"}');
  fs.writeFileSync(path.join(old, 'shell', 'keepme', 'kept.json'), '{"kept":"shell"}');
  fs.writeFileSync(path.join(old, 'peerStats', 'a.json'), '{"peer":"a"}');
  fs.writeFileSync(path.join(old, 'someClient', 'cached.json'), '{"cached":true}');
  fs.writeFileSync(path.join(old, 'proxy.json'), '{"gone":"with its verbs"}');
  fs.writeFileSync(path.join(old, 'traffic.jsonl.imported'), 'garbage\n');
  fs.writeFileSync(path.join(old, 'unknown.txt'), 'a file no list names\n');
  fs.writeFileSync(path.join(old, 'store.db'), 'not opened by anything');
  fs.writeFileSync(path.join(old, 'store.db-wal'), 'its journal');
  Object.keys(extra || {}).forEach(function (n) { fs.writeFileSync(path.join(old, n), extra[n]); });
}
function keyOf(run) { return require(path.join(run, 'spirit', 'relayAuth.js')).generateIdentity('moved'); }
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 4000); }); }
async function bootNode(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }, 60000);
  return { child: child, base: base, port: port, up: up };
}
async function cardOf(base) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'node.card', args: {} }) });
  return parsed(await r.text()) || {};
}
// Every file under the run tree that holds a private key.
function keysOnDisc(run) {
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules') return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/^identity/.test(e.name)) return;
      const j = readJson(p);
      if (j && j.privateKey) out.push(path.relative(run, p).split(path.sep).join('/'));
    });
  }(run));
  return out;
}
const THE_TOP = /relay-state['"`]?\s*[,/]\s*['"`]?(config\.json|environment\.json|identity\.json|node\.db|traffic\.json|relay\.db|peerStats|owner\.json|relays\.json|mail\.json|node\.json|face\.json|servers\.json|relayKeys\.json|invites\.json|pendingArrivals\.json|pending-owner\.json|device\.json|include\.json)/;

test.startTest('shellMove.js: relay-state\'s own files move to spirit/state/ at boot (goal/G43.8)');

(async function () {
  const live = [];
  try {
    test.subHeading('the box: "Every place that builds one of these paths follows, tests too"');
    const left = [];
    const tracked = execSync('git ls-files -- spirit/run bash', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
    tracked.filter(function (f) { return /\.(js|html|sh|service|bash)$|^bash\/[^.]*$/.test(f) && !/spirit\/shellMove\.js$|spirit\/test\/shellMove\.js$/.test(f) && fs.existsSync(path.join(REPO, f)) && !/node_modules/.test(f); }).forEach(function (f) {
      const text = fs.readFileSync(path.join(REPO, f), 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*(\/\/|\*|#)/.test(l); }).join('\n');
      if (THE_TOP.test(text)) left.push(f);
    });
    ok(!left.length, 'no code or script builds an old path', left.length + ' files still build one: ' + short(left.slice(0, 8).map(function (f) { return f.replace('spirit/run/', ''); })));
    const app = fs.readFileSync(path.join(RUN, 'spirit', 'appServer.js'), 'utf8');
    ok(app.indexOf("'relay-state', following.name") === -1, 'appServer\'s cacheDir follows', 'appServer.js still builds relay-state/<client>/');

    test.subHeading('the box: "The move runs first: before server.js requires spirit.js, which reads environment.json at once."');
    const srv = fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8').replace(/\/\/.*$/gm, '');
    const moveAt = srv.search(/require\(['"]\.\/shellMove/);
    const spiritAt = srv.search(/require\(['"]\.\.\/spirit\.js/);
    ok(moveAt !== -1 && spiritAt !== -1 && moveAt < spiritAt, 'server.js runs the move before it requires spirit.js', 'in server.js the move stands at ' + moveAt + ', spirit.js at ' + spiritAt);

    test.subHeading('a node of the old layout boots once, and everything at the top moves');
    const a = scratch();
    const id = keyOf(a.run);
    oldLayout(a.run, { 'identity.json': JSON.stringify(id), 'config.json': '{"ramLimitMB":256}' });
    let n = await bootNode(a.run); live.push(n.child);
    ok(n.up, 'it comes up', 'it did not come up');
    const state = path.join(a.run, 'spirit', 'state');
    const old = path.join(a.run, 'relay-state');
    const there = function (f) { return fs.existsSync(path.join(state, f)); };
    ['identity.json', 'config.json', 'unknown.txt', 'proxy.json', 'traffic.jsonl.imported', 'store.db', 'store.db-wal', 'peerStats/a.json', 'someClient/cached.json', 'environment.json', 'node.db'].forEach(function (f) {
      ok(there(f), 'spirit/state/' + f, 'not in spirit/state/: ' + f);
    });
    const top = fs.existsSync(old) ? fs.readdirSync(old).sort().join() : '';
    ok(top === 'process,shell', 'relay-state\'s top holds process and shell alone', 'relay-state\'s top holds: ' + short(top));
    ok(!!readJson(path.join(old, 'process', 'keepme', 'kept.json')) && !!readJson(path.join(old, 'shell', 'keepme', 'kept.json')), 'and what is in them stays', 'process/ or shell/ lost a file');
    ok(!there('process') && !there('shell'), 'neither moved', 'process or shell went to spirit/state/');
    test.subHeading('the box: "identity.json: copy it, read the copy back, check it gives the same public key, then remove the old one."');
    const card = n.up ? await cardOf(n.base) : {};
    ok(card.publicKey === id.publicKey, 'the node is who it was', 'its key was ' + short(id.publicKey) + ', it answers ' + short(card.publicKey));
    const keys = keysOnDisc(a.run);
    ok(keys.join() === 'spirit/state/identity.json', '"No second private key stays on disc": one, in spirit/state/', 'private keys on disc: ' + short(keys));
    test.subHeading('the box: "spirit/state/ is kept mode 700, as relay-state/ is."');
    if (POSIX) {
      const mode = function (p) { try { return (fs.statSync(p).mode & 0o777).toString(8); } catch (e) { return 'none'; } };
      ok(mode(state) === '700', 'spirit/state/ is 700', 'spirit/state/ is ' + mode(state));
      ok(mode(path.join(state, 'identity.json')) === '600', 'and identity.json 600', 'identity.json is ' + mode(path.join(state, 'identity.json')));
    } else test.check('mode is a POSIX matter: not judged here');
    test.subHeading('the box: "The first boot after the move still has its port."');
    const env = readJson(path.join(state, 'environment.json')) || {};
    ok(Number(env.PORT) === n.port, 'spirit/state/environment.json names this boot\'s port', 'environment.json: ' + short(env));
    const asked = await new Promise(function (resolve) {
      const c = spawn(process.execPath, ['-e', 'const s = require("./spirit.js"); s.require("spirit/node/api.js").then(function () { return s.node.card(); }).then(function (c) { console.log("KEY" + (c && c.publicKey)); process.exit(0); }, function (e) { console.log("NO" + JSON.stringify(e)); process.exit(0); });'], { cwd: a.run, stdio: ['ignore', 'pipe', 'ignore'] });
      let out = ''; c.stdout.on('data', function (d) { out += d; }); c.on('exit', function () { resolve(out); }); setTimeout(function () { c.kill(); resolve(out); }, 15000);
    });
    ok(asked.indexOf('KEY' + id.publicKey) !== -1, 'a new process requiring spirit.js finds this node', 'a new process answered: ' + short(asked));

    test.subHeading('once: a second boot moves nothing, and keeps who it is');
    await stop(n.child);
    const before = readText(path.join(state, 'identity.json'));
    n = await bootNode(a.run); live.push(n.child);
    ok(n.up && (await cardOf(n.base)).publicKey === id.publicKey && before !== null && readText(path.join(state, 'identity.json')) === before, 'the same node, the same file', 'after a second boot it is not the same node');
    ok(fs.readdirSync(old).sort().join() === 'process,shell', 'and the top stays empty', 'the top after a second boot: ' + short(fs.readdirSync(old)));
    await stop(n.child);
    fs.rmSync(a.root, { recursive: true, force: true });

    test.subHeading('the box: "stopping if that fails", "a failed move cannot bring the node up as someone else"');
    const b = scratch();
    oldLayout(b.run, { 'identity.json': '{"publicKey":"broken","privateKey":"not a key"}' });
    execSync(process.execPath + ' -e "require(\'./spirit/relayAuth.js\')"', { cwd: b.run, stdio: 'ignore' });
    ok(!fs.existsSync(path.join(b.run, 'spirit', 'state', 'identity.json')), 'a process loading relayAuth before the boot mints no second key', 'relayAuth minted a key while the old one waits to move');
    const port = await freePort();
    const bad = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: b.run, stdio: 'ignore' }); live.push(bad);
    await until(function () { return Promise.resolve(bad.exitCode !== null); }, 20000);
    ok(bad.exitCode !== null && bad.exitCode !== 0, 'a key that does not read back stops the node', 'with a broken key the node: exit ' + short(bad.exitCode));
    ok(fs.existsSync(path.join(b.run, 'relay-state', 'identity.json')), 'and the old file stays', 'the old identity.json is gone');
    const made = readJson(path.join(b.run, 'spirit', 'state', 'identity.json'));
    ok(!made || !made.privateKey || made.privateKey === 'not a key', 'and no new key was made', 'a new key stands in spirit/state/');
    await stop(bad);
    fs.rmSync(b.root, { recursive: true, force: true });

    test.subHeading('the box: "So the move is tried on a copy of a relay\'s files": a relay of the old layout');
    const c = scratch();
    const relayId = keyOf(c.run);
    const ownerId = keyOf(c.run);
    oldLayout(c.run, { 'identity.json': JSON.stringify(relayId), 'owner.json': JSON.stringify({ publicKey: ownerId.publicKey }), 'face.json': '{"domain":"relay.example"}', 'relays.json': '{}', 'invites.json': '{}' });
    const rPort = await freePort();
    const r = spawn(process.execPath, ['spirit/relayServer.js'], { cwd: c.run, stdio: 'ignore', env: Object.assign({}, process.env, { PORT: String(rPort) }) }); live.push(r);
    const rUp = await until(function () { return fetch('http://127.0.0.1:' + rPort + '/').then(function (x) { return x.status > 0; }, function () { return false; }); }, 30000);
    ok(rUp, 'the relay comes up', 'the relay did not come up');
    const rState = path.join(c.run, 'spirit', 'state');
    ['identity.json', 'owner.json', 'face.json', 'peerStats/a.json', 'unknown.txt'].forEach(function (f) { ok(fs.existsSync(path.join(rState, f)), 'spirit/state/' + f, 'not in spirit/state/: ' + f); });
    // A relay imports these into its database at start and renames them, so either name will do; only not left at the old top.
    ['invites.json', 'relays.json'].forEach(function (f) { ok(fs.existsSync(path.join(rState, f)) || fs.existsSync(path.join(rState, f + '.imported')), 'spirit/state/' + f + ' or its .imported', 'neither name in spirit/state/: ' + f); });
    ok((readJson(path.join(rState, 'identity.json')) || {}).publicKey === relayId.publicKey, 'it keeps its key', 'the relay\'s key: ' + short(readJson(path.join(rState, 'identity.json'))));
    ok((readJson(path.join(rState, 'owner.json')) || {}).publicKey === ownerId.publicKey, 'and its owner', 'the relay\'s owner: ' + short(readJson(path.join(rState, 'owner.json'))));
    const rTop = fs.existsSync(path.join(c.run, 'relay-state')) ? fs.readdirSync(path.join(c.run, 'relay-state')).sort().join() : '';
    ok(rTop === 'process,shell', 'its relay-state top holds process and shell alone', 'the relay\'s top holds: ' + short(rTop));
    ok(keysOnDisc(c.run).join() === 'spirit/state/identity.json', 'one private key on disc', 'private keys on disc: ' + short(keysOnDisc(c.run)));
    await stop(r);
    fs.rmSync(c.root, { recursive: true, force: true });
    await sleep(100);
  } finally {
    live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
