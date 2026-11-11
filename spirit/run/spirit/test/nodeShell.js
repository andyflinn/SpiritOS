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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('nodeShell.js: the shell the node names (goal/G43.18)');

(async function () {
  test.subHeading('the tree');
  // "spirit/app/shell/, an app that wraps the app search (spirit/element/search/app.js) as the shell"; since goal/G43.32 the app
  // app, spirit/app/app/ (the box: "app.json is shell.json, renamed (shell true:true). The node's default shell ... "app"").
  const own = readJson(path.join(RUN, 'spirit', 'app', 'app', 'app.json'));
  ok(!!own && own.shell && own.shell.true === true, 'spirit/app/app/app.json is there and says shell:true:true', 'spirit/app/app/app.json: ' + short(own));
  const code = fs.existsSync(path.join(RUN, 'spirit', 'app', 'app', 'element.js')) ? fs.readFileSync(path.join(RUN, 'spirit', 'app', 'app', 'element.js'), 'utf8').replace(/\/\/.*$/gm, '') : '';
  ok(/spirit\/element\/search\/app\.js/.test(code), 'spirit/app/app/element.js loads the app search', 'spirit/app/app/element.js ' + (code ? 'does not load spirit/element/search/app.js' : 'is not there'));
  // "the Allow row of the app detail and its element, spirit/app/appSelector/rowFormAppShell.js, are deleted, and with them the
  // verb app.shell" (Q10)
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'appSelector', 'rowFormAppShell.js')), 'rowFormAppShell.js is gone', 'spirit/app/appSelector/rowFormAppShell.js is still there');
  const appApi = require(path.join(RUN, 'spirit', 'app', 'api.js'));
  ok(!('shell' in appApi.verbs) && !('shell' in (appApi.functions || {})), 'the app family has no verb shell', 'spirit/app/api.js still has shell: ' + short(Object.keys(appApi.verbs)));
  const nodeApi = require(path.join(RUN, 'spirit', 'node', 'api.js'));
  const v = nodeApi.verbs.shell;
  ok(!!v && Object.keys(v).sort().join() === 'at,name' && !/\?/.test(v.at) && /\?$/.test(v.name), 'the node family has shell { at, name? }', 'spirit/node/api.js shell: ' + short(v));

  const s = scratch();
  let N = null;
  try {
    N = await boot(s.run);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const FILE = path.join(s.run, 'spirit', 'state', 'shell.json');

    test.subHeading('Q12: "a node with no shell chosen, no spirit/state/shell.json, uses the shell app for home and face"');
    ok(!fs.existsSync(FILE), 'the world: no spirit/state/shell.json', 'the scratch copy has a spirit/state/shell.json: nothing judged');
    for (const where of ['home', 'face']) {
      const a = await call(N.base, 'node.shell', { at: where });
      const app = a.status === 200 && nameOf(a) === 'app';
      const why = 'node.shell at ' + where + ': ' + a.status + ' ' + short(a.text);
      if (where === 'home') ok(app, 'asked for the home shell, node.shell answers the app named app', why);
      else if (where === 'face') ok(app, 'asked for the face shell, node.shell answers the app named app', why);
    }

    test.subHeading('"A name that is no app, or whose <name>.json does not say shell:true:true, is refused with the reason, and the shell stays"');
    for (const bad of [['zzNoSuchApp', 'no app'], ['contact', 'an app whose contact.json says shell.true false']]) {
      const a = await call(N.base, 'node.shell', { at: 'home', name: bad[0] });
      const said = refused(a) && !!(a.body && (a.body.error || a.body.reason));
      const why = 'node.shell home ' + bad[0] + ': ' + a.status + ' ' + short(a.text);
      if (bad[0] === 'zzNoSuchApp') ok(said, 'a name that is no app is refused, with the reason', why);
      else if (bad[0] === 'contact') ok(said, 'an app whose contact.json says shell.true false is refused, with the reason', why);
      const stays = nameOf(await call(N.base, 'node.shell', { at: 'home' })) === 'app';
      const now = 'after ' + bad[0] + ' the home shell is ' + short(await call(N.base, 'node.shell', { at: 'home' }));
      if (bad[0] === 'zzNoSuchApp') ok(stays, 'and after the name that is no app, the home shell stays app', now);
      else if (bad[0] === 'contact') ok(stays, 'and after the app that says shell.true false, the home shell stays app', now);
    }
    const at = await call(N.base, 'node.shell', { at: 'desk', name: 'zzshell' });
    ok(refused(at), 'at other than home or face is refused', 'node.shell at desk: ' + at.status + ' ' + short(at.text));

    test.subHeading('"node.shell({ at, name }) sets it and answers { name }", "Kept in a file of its own, spirit/state/shell.json"');
    const set = await call(N.base, 'node.shell', { at: 'home', name: 'zzshell' });
    ok(set.status === 200 && nameOf(set) === 'zzshell', 'setting the home shell to zzshell answers { name: "zzshell" }', 'node.shell home zzshell: ' + set.status + ' ' + short(set.text));
    ok(nameOf(await call(N.base, 'node.shell', { at: 'home' })) === 'zzshell', 'asked again, home answers zzshell', 'home answers ' + short(await call(N.base, 'node.shell', { at: 'home' })));
    ok(nameOf(await call(N.base, 'node.shell', { at: 'face' })) === 'app', 'and face is its own: still app', 'face answers ' + short(await call(N.base, 'node.shell', { at: 'face' })));
    const kept = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
    ok(/zzshell/.test(kept), 'spirit/state/shell.json holds it', 'spirit/state/shell.json: ' + short(kept || 'not there'));
    const cfg = readJson(path.join(s.run, 'spirit', 'state', 'config.json'));
    ok(!cfg || !/shell/.test(JSON.stringify(cfg)), 'config.json, the relay\'s limits file, holds no shell', 'config.json: ' + short(cfg));
    await stop(N.child);
    N = await boot(s.run);
    ok(N.up && nameOf(await call(N.base, 'node.shell', { at: 'home' })) === 'zzshell', 'started again, the node still names zzshell at home', 'after a restart home answers ' + short(N.up ? await call(N.base, 'node.shell', { at: 'home' }) : 'no node'));

    test.subHeading('Q10: app.shell goes, "and the shell field it writes into node.json"');
    const old = await call(N.base, 'app.shell', { key: 'agent', shell: true });
    ok(old.status >= 400, 'app.shell is no verb', 'app.shell answered ' + old.status + ' ' + short(old.text));
    await call(N.base, 'app.active', { key: 'agent', active: true });
    const nodeJson = readJson(path.join(s.run, 'spirit', 'state', 'agent', 'node.json'));
    ok(!!nodeJson && !('shell' in nodeJson), 'app.active writes no shell into the agent\'s node.json', 'spirit/state/agent/node.json: ' + short(nodeJson));
  } finally {
    if (N) await stop(N.child);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
