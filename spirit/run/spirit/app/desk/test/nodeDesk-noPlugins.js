'use strict';

// spirit/run/spirit/app/desk/test/nodeDesk-noPlugins.js
// THE DESK SERVER WITHOUT PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./nodeDesk-noPlugins.md): nodeDesk.js, desk's server.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.", Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, and a desk server
// started on a scratch state folder, asked through its own pipe; Andy's desk is not touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function tracked(dir) { return execSync('git ls-files -- "' + dir + '"', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

test.startTest('nodeDesk-noPlugins.js: the desk server keeps goals, items and rules; plugins and the team chat go (goal/G43.22)');

(async function () {
  test.subHeading('Andy: "removal of plugin folders."');
  for (const dir of ['spirit/run/spirit/app/desk/plugins', 'spirit/run/spirit/app/desk/element/desk/plugins', 'spirit/run/shell/stackFrameCheckDetail']) {
    const left = tracked(dir);
    ok(!left.length && !fs.existsSync(path.join(REPO, dir)), dir + '/ is gone', dir + '/ still holds ' + short(left.length ? left : 'files on the disk'));
  }

  test.subHeading('Andy: "removal of plugin support.", and "G0 goes, from ui and server"');
  const desk = code(path.join(DESK, 'nodeDesk.js'));
  ok(!!desk && !/plugins|PLUGIN/.test(desk), 'desk.js mounts no plugin and asks none for a refusal', 'desk.js still names plugins');
  ok(!!desk && !/goal\/G0['"]/.test(desk), 'desk.js knows no team chat goal, goal/G0', 'desk.js still names goal/G0');

  // A desk server of the tree, on a scratch state folder: what its api serves, and what a fresh one holds.
  // A unix socket's path is short (108 bytes): a long temp folder would leave the desk unable to listen.
  const scratch = fs.mkdtempSync(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'spn-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
  // The node makes the folder of a server's door before it starts it; so does the test.
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  let kid = null;
  try {
    kid = spawn(process.execPath, [path.join(DESK, 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const client2 = appClient.createAppClient({ rootDir: scratch });
    if (typeof client2.register === 'function') client2.register('desk', pipe);
    const ask = function (body) { return client2.ask(body).then(function (r) { return r || {}; }, function () { return {}; }); };
    let api = {};
    const until = Date.now() + 15000;
    // Asked until the desk listens: before that the client answers app-not-running for it.
    while (Date.now() < until) { const r = await ask('api'); const b = r && r.body && (r.body.desk || r.body); if (b && typeof b === 'object' && b.ok !== false && Object.keys(b).length) { api = b; break; } await new Promise(function (r2) { setTimeout(r2, 200); }); }
    const verbs = Object.keys(api.desk || api);
    ok(verbs.length > 5 && verbs.indexOf('item.get') !== -1, 'the world: a scratch desk answers api, ' + verbs.length + ' verbs', 'no desk answered api: nothing judged. ' + short(api));
    const plug = verbs.filter(function (v) { return /^(stackFrameChecks|vision|fallout)\./.test(v); });
    ok(verbs.length > 5 && !plug.length, 'its api serves no verb of a plugin', 'its api still serves ' + short(plug));
    const g0 = await ask({ desk: { 'item.get': { id: 'goal/G0' } } });
    const held = !!(g0.body && g0.body.item);
    ok(verbs.length > 5 && !held, 'a fresh desk holds no goal/G0', 'a fresh desk holds goal/G0: ' + short(g0.body));
  } finally {
    try { if (kid) kid.kill(); } catch (e) { /* gone */ }
    await new Promise(function (r) { setTimeout(r, 300); });
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
