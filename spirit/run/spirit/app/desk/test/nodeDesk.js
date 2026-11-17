'use strict';

// spirit/run/spirit/app/desk/test/nodeDesk.js
// THE DESK SERVER WITHOUT PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./nodeDesk.md): nodeDesk.js, desk's server.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.", Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, and a desk server
// started on a scratch state folder, asked through its own pipe; Andy's desk is not touched.

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/desk/test/nodeDesk/' + name + tempAsked); }
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/desk/test/nodeDesk'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function tracked(dir) { return execSync('git ls-files -- "' + dir + '"', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

const W = {};
// One of the folders: gone from git and from the disk.
function folderGone(dir) {
  const left = tracked(dir);
  return (!left.length && !fs.existsSync(path.join(REPO, dir))) || false;
}

// Andy: "removal of plugin folders."
test.run('the desk app\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/plugins'); }, test.limit.quick);
test.run('the desk element\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/element/desk/plugins'); }, test.limit.quick);
test.run('the old shell\'s stackFrameCheckDetail folder is gone', 0.2, function () { return folderGone('spirit/run/shell/stackFrameCheckDetail'); }, test.limit.quick);

// Andy: "removal of plugin support.", and "G0 goes, from ui and server"
test.run('desk.js mounts no plugin and asks none for a refusal', 0.2, function () {
  const desk = code(path.join(DESK, 'nodeDesk.js'));
  return (!!desk && !/plugins|PLUGIN/.test(desk)) || false;
}, test.limit.quick);
test.run('desk.js knows no team chat goal, goal/G0', 0.2, function () {
  const desk = code(path.join(DESK, 'nodeDesk.js'));
  return (!!desk && !/goal\/G0['"]/.test(desk)) || false;
}, test.limit.quick);

// A desk server of the tree, on a scratch state folder: what its api serves, and what a fresh one holds.
test.run('a scratch desk answers api with its verbs, item.get among them', 0.2, async function () {
  // A unix socket's path is short (108 bytes): the helper's folder for this suite gives a socket path of 91 on Linux
  // (/tmp/spirit/<node>/spirit/app/desk/test/nodeDesk/spn1/spirit/state/desk/door.sock); Windows has named pipes.
  const scratch = W.scratch = ownTemp('spn');
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
  // The node makes the folder of a server's door before it starts it; so does the test.
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  W.kid = spawn(process.execPath, [path.join(DESK, 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const client2 = appClient.createAppClient({ rootDir: scratch });
  if (typeof client2.register === 'function') client2.register('desk', pipe);
  const ask = W.ask = function (body) { return client2.ask(body).then(function (r) { return r || {}; }, function () { return {}; }); };
  let api = {};
  const until = Date.now() + 15000;
  // Asked until the desk listens: before that the client answers app-not-running for it.
  while (Date.now() < until) { const r = await ask('api'); const b = r && r.body && (r.body.desk || r.body); if (b && typeof b === 'object' && b.ok !== false && Object.keys(b).length) { api = b; break; } await new Promise(function (r2) { setTimeout(r2, 200); }); }
  const verbs = W.verbs = Object.keys(api.desk || api);
  return (verbs.length > 5 && verbs.indexOf('item.get') !== -1) || false;
}, test.limit.slow);
test.run('its api serves no verb of a plugin', 0.2, function () {
  const verbs = W.verbs || [];
  const plug = verbs.filter(function (v) { return /^(stackFrameChecks|vision|fallout)\./.test(v); });
  return (verbs.length > 5 && !plug.length) || false;
}, test.limit.quick);
// goal/G47.1, Q16: old box versions are not kept, and their search went with them.
test.run('its api serves no search of an item\'s box versions', 0.2, function () {
  const verbs = W.verbs || [];
  return (verbs.length > 5 && verbs.indexOf('item.box.search') === -1 && verbs.indexOf('item.box') !== -1) || false;
}, test.limit.quick);
test.run('a fresh desk holds no goal/G0', 0.2, async function () {
  const verbs = W.verbs || [];
  if (!(verbs.length > 5) || !W.ask) return false;
  const g0 = await W.ask({ desk: { 'item.get': { id: 'goal/G0' } } });
  const held = !!(g0.body && g0.body.item);
  return !held || false;
}, test.limit.quick);

test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  await new Promise(function (r) { setTimeout(r, 300); });
  try { if (W.scratch) fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
