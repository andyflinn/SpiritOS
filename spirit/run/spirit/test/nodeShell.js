'use strict';

// spirit/run/spirit/test/nodeShell.js
// THE SHELL THE NODE NAMES (goal/G43.18, box v29, "The shell"; spec: ./nodeShell.md): the verb node.shell, where it is kept,
// the shell app, and app.shell gone. A real node on a scratch copy of the tracked files, asked at its own loopback door, and
// started again to see what it kept. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// A shell-worthy app of the test's own, beside the shell app: <name>.json says shell.true true.
const ZZ = { identity: { label: 'Zz Shell', icon: '🧪' }, shell: { true: true, mount: true, tile: true } };
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodeshell-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const zz = path.join(run, 'spirit', 'app', 'zzshell');
  fs.mkdirSync(zz, { recursive: true });
  fs.writeFileSync(path.join(zz, 'zzshell.json'), JSON.stringify(ZZ));
  fs.writeFileSync(path.join(zz, 'zzshell.js'), '// a shell-worthy app of the test\n');
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function boot(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }
const nameOf = function (a) { return a && a.body && typeof a.body.name === 'string' ? a.body.name : null; };
// Refused by the verb itself: "no such verb" judges nothing.
const refused = function (a) { return a.status >= 400 && a.status < 500 && !/no such verb/.test(a.text); };

// What the tests share: the scratch copy and its node, made by "the world:" tests below.
const W = { s: null, N: null };
const FILE = function () { return path.join(W.s.run, 'spirit', 'state', 'shell.json'); };
const NO_NODE = 'no scratch node: the world failed';
async function home() { return call(W.N.base, 'node.shell', { at: 'home' }); }

// the tree
// "spirit/app/shell/, an app that wraps the app search (spirit/element/search/app.js) as the shell"; since goal/G43.32 the app
// app, spirit/app/app/ (the box: "app.json is shell.json, renamed (shell true:true). The node's default shell ... "app"").
test.run('spirit/app/app/app.json is there and says shell:true:true', 0.2, function () {
  const own = readJson(path.join(RUN, 'spirit', 'app', 'app', 'app.json'));
  return (!!own && !!own.shell && own.shell.true === true) || 'spirit/app/app/app.json: ' + short(own);
}, 1000);
test.run('spirit/app/app/element.js loads the app search', 0.2, function () {
  const code = fs.existsSync(path.join(RUN, 'spirit', 'app', 'app', 'element.js')) ? fs.readFileSync(path.join(RUN, 'spirit', 'app', 'app', 'element.js'), 'utf8').replace(/\/\/.*$/gm, '') : '';
  return /spirit\/element\/search\/app\.js/.test(code) || 'spirit/app/app/element.js ' + (code ? 'does not load spirit/element/search/app.js' : 'is not there');
}, 1000);
// "the Allow row of the app detail and its element, spirit/app/appSelector/rowFormAppShell.js, are deleted, and with them the
// verb app.shell" (Q10)
test.run('rowFormAppShell.js is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'app', 'appSelector', 'rowFormAppShell.js')) || 'spirit/app/appSelector/rowFormAppShell.js is still there';
}, 1000);
test.run('the app family has no verb shell', 0.2, function () {
  const appApi = require(path.join(RUN, 'spirit', 'app', 'api.js'));
  return (!('shell' in appApi.verbs) && !('shell' in (appApi.functions || {}))) || 'spirit/app/api.js still has shell: ' + short(Object.keys(appApi.verbs));
}, 1000);
test.run('the node family has shell { at, name? }', 0.2, function () {
  const v = require(path.join(RUN, 'spirit', 'node', 'api.js')).verbs.shell;
  return (!!v && Object.keys(v).sort().join() === 'at,name' && !/\?/.test(v.at) && /\?$/.test(v.name)) || 'spirit/node/api.js shell: ' + short(v);
}, 1000);

test.run('the world: a scratch node comes up', 0.2, async function () {
  W.s = scratch();
  W.N = await boot(W.s.run);
  return W.N.up || 'the scratch node did not come up: nothing judged';
}, 7000);

// Q12: "a node with no shell chosen, no spirit/state/shell.json, uses the shell app for home and face"
test.run('the world: no spirit/state/shell.json', 0.2, function () {
  if (!W.s) return 'no scratch copy: the world failed';
  return !fs.existsSync(FILE()) || 'the scratch copy has a spirit/state/shell.json: nothing judged';
}, 1000);
test.run('asked for the home shell, node.shell answers the app named app', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const a = await call(W.N.base, 'node.shell', { at: 'home' });
  return (a.status === 200 && nameOf(a) === 'app') || 'node.shell at home: ' + a.status + ' ' + short(a.text);
}, 1000);
test.run('asked for the face shell, node.shell answers the app named app', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const a = await call(W.N.base, 'node.shell', { at: 'face' });
  return (a.status === 200 && nameOf(a) === 'app') || 'node.shell at face: ' + a.status + ' ' + short(a.text);
}, 1000);

// "A name that is no app, or whose <name>.json does not say shell:true:true, is refused with the reason, and the shell stays"
async function refusedWithReason(name) {
  const a = await call(W.N.base, 'node.shell', { at: 'home', name: name });
  return (refused(a) && !!(a.body && (a.body.error || a.body.reason))) || 'node.shell home ' + name + ': ' + a.status + ' ' + short(a.text);
}
async function stays(name) {
  const now = await home();
  return nameOf(now) === 'app' || 'after ' + name + ' the home shell is ' + short(now);
}
test.run('a name that is no app is refused, with the reason', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  return refusedWithReason('zzNoSuchApp');
}, 1000);
test.run('and after the name that is no app, the home shell stays app', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  return stays('zzNoSuchApp');
}, 1000);
test.run('an app whose contact.json says shell.true false is refused, with the reason', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  return refusedWithReason('contact');
}, 1000);
test.run('and after the app that says shell.true false, the home shell stays app', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  return stays('contact');
}, 1000);
test.run('at other than home or face is refused', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const at = await call(W.N.base, 'node.shell', { at: 'desk', name: 'zzshell' });
  return refused(at) || 'node.shell at desk: ' + at.status + ' ' + short(at.text);
}, 1000);

// "node.shell({ at, name }) sets it and answers { name }", "Kept in a file of its own, spirit/state/shell.json"
test.run('setting the home shell to zzshell answers { name: "zzshell" }', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const set = await call(W.N.base, 'node.shell', { at: 'home', name: 'zzshell' });
  return (set.status === 200 && nameOf(set) === 'zzshell') || 'node.shell home zzshell: ' + set.status + ' ' + short(set.text);
}, 1000);
test.run('asked again, home answers zzshell', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const a = await home();
  return nameOf(a) === 'zzshell' || 'home answers ' + short(a);
}, 1000);
test.run('and face is its own: still app', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const a = await call(W.N.base, 'node.shell', { at: 'face' });
  return nameOf(a) === 'app' || 'face answers ' + short(a);
}, 1000);
test.run('spirit/state/shell.json holds it', 0.2, function () {
  if (!W.s) return 'no scratch copy: the world failed';
  const kept = fs.existsSync(FILE()) ? fs.readFileSync(FILE(), 'utf8') : '';
  return /zzshell/.test(kept) || 'spirit/state/shell.json: ' + short(kept || 'not there');
}, 1000);
test.run('config.json, the relay\'s limits file, holds no shell', 0.2, function () {
  if (!W.s) return 'no scratch copy: the world failed';
  const cfg = readJson(path.join(W.s.run, 'spirit', 'state', 'config.json'));
  return (!cfg || !/shell/.test(JSON.stringify(cfg))) || 'config.json: ' + short(cfg);
}, 1000);
test.run('started again, the node still names zzshell at home', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  await stop(W.N.child);
  W.N = await boot(W.s.run);
  return (W.N.up && nameOf(await home()) === 'zzshell') || 'after a restart home answers ' + short(W.N.up ? await home() : 'no node');
}, 3000);

// Q10: app.shell goes, "and the shell field it writes into node.json"
test.run('app.shell is no verb', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const old = await call(W.N.base, 'app.shell', { key: 'agent', shell: true });
  return old.status >= 400 || 'app.shell answered ' + old.status + ' ' + short(old.text);
}, 1000);
test.run('app.active writes no shell into the agent\'s node.json', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  await call(W.N.base, 'app.active', { key: 'agent', active: true });
  const nodeJson = readJson(path.join(W.s.run, 'spirit', 'state', 'agent', 'node.json'));
  return (!!nodeJson && !('shell' in nodeJson)) || 'spirit/state/agent/node.json: ' + short(nodeJson);
}, 1000);

test.after(async function () {
  if (W.N) await stop(W.N.child);
  if (W.s) { try { fs.rmSync(W.s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
});
