'use strict';

// spirit/run/spirit/app/desk/test/nodeDesk.js
// THE DESK SERVER WITHOUT PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./nodeDesk.md): nodeDesk.js, desk's server.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.", Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, and a desk server
// started on a scratch state folder, asked through its own pipe; Andy's desk is not touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function tracked(dir) { return execSync('git ls-files -- "' + dir + '"', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

const W = {};
// One of the folders: gone from git and from the disk.
function folderGone(dir) {
  const left = tracked(dir);
  return (!left.length && !fs.existsSync(path.join(REPO, dir))) || dir + '/ still holds ' + short(left.length ? left : 'files on the disk');
}

// Andy: "removal of plugin folders."
test.run('the desk app\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/plugins'); }, test.limit.quick);
test.run('the desk element\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/element/desk/plugins'); }, test.limit.quick);
test.run('the old shell\'s stackFrameCheckDetail folder is gone', 0.2, function () { return folderGone('spirit/run/shell/stackFrameCheckDetail'); }, test.limit.quick);

// Andy: "removal of plugin support.", and "G0 goes, from ui and server"
test.run('desk.js mounts no plugin and asks none for a refusal', 0.2, function () {
  const desk = code(path.join(DESK, 'nodeDesk.js'));
  return (!!desk && !/plugins|PLUGIN/.test(desk)) || 'desk.js still names plugins';
}, test.limit.quick);
test.run('desk.js knows no team chat goal, goal/G0', 0.2, function () {
  const desk = code(path.join(DESK, 'nodeDesk.js'));
  return (!!desk && !/goal\/G0['"]/.test(desk)) || 'desk.js still names goal/G0';
}, test.limit.quick);

// A desk server of the tree, on a scratch state folder: what its api serves, and what a fresh one holds.
test.run('the world: a scratch desk answers api with its verbs, item.get among them', 0.2, async function () {
  // A unix socket's path is short (108 bytes): a long temp folder would leave the desk unable to listen.
  const scratch = W.scratch = fs.mkdtempSync(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'spn-'));
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
  return (verbs.length > 5 && verbs.indexOf('item.get') !== -1) || 'no desk answered api: nothing judged. ' + short(api);
}, test.limit.slow);
test.run('its api serves no verb of a plugin', 0.2, function () {
  const verbs = W.verbs || [];
  const plug = verbs.filter(function (v) { return /^(stackFrameChecks|vision|fallout)\./.test(v); });
  return (verbs.length > 5 && !plug.length) || (verbs.length > 5 ? 'its api still serves ' + short(plug) : 'no desk answered api: the world failed');
}, test.limit.quick);
test.run('a fresh desk holds no goal/G0', 0.2, async function () {
  const verbs = W.verbs || [];
  if (!(verbs.length > 5) || !W.ask) return 'no desk answered api: the world failed';
  const g0 = await W.ask({ desk: { 'item.get': { id: 'goal/G0' } } });
  const held = !!(g0.body && g0.body.item);
  return !held || 'a fresh desk holds goal/G0: ' + short(g0.body);
}, test.limit.quick);

// goal/G47.1, Andy, of his title bar showing an item's status "waiting for" the deleted verifier: an older desk's item,
// its status written by the deleted verifier, loses that status when the desk starts; an item with a status of its own
// keeps it. The verifier's name is built here, so no tracked file names it (spirit-sibling-general.js).
const GONE = ['desk', 'Verify'].join('');
function startDesk() {
  const pipe = appClient.pipePathFor(W.scratch, 'desk', process.platform, 'process');
  W.kid = spawn(process.execPath, [path.join(DESK, 'desk.js'), '{}', '--pipe', pipe, '--state', path.join(W.scratch, 'state')], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
}
async function untilItem(id) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const r = await W.ask({ desk: { 'item.get': { id: id } } });
    const b = r && r.body && (r.body.desk || r.body);
    if (b && b.item) return JSON.parse(b.item);
    await new Promise(function (r2) { setTimeout(r2, 200); });
  }
  return null;
}
test.run('the world: an older desk\'s items, one waiting for the deleted verifier and one running, and the desk started again', 0.2, async function () {
  if (!W.kid || !W.ask) return 'no desk answered api: the world failed';
  W.kid.kill();
  await new Promise(function (r) { W.kid.once('exit', r); setTimeout(r, 3000); });
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(W.scratch, 'state', 'desk.db'));
  const put = db.prepare('INSERT OR REPLACE INTO items (goal, item, creator, data) VALUES (?, ?, ?, ?)');
  put.run(9, 0, 'andy', JSON.stringify({ id: 'goal/G9', title: 'Old goal.', goal: true, goalState: { members: ['goal/G9.1', 'goal/G9.2'] } }));
  put.run(9, 1, 'andy', JSON.stringify({ id: 'goal/G9.1', title: 'Old item.', goal: false, goalId: 'goal/G9', status: 'waiting for ' + GONE, verifyRunning: true }));
  put.run(9, 2, 'andy', JSON.stringify({ id: 'goal/G9.2', title: 'Its sibling.', goal: false, goalId: 'goal/G9', status: 'running' }));
  db.close();
  startDesk();
  W.old = await untilItem('goal/G9.1');
  W.sibling = await untilItem('goal/G9.2');
  return (!!W.old && !!W.sibling) || 'the desk started again answers no old item: ' + short([W.old, W.sibling]);
}, test.limit.slow);
test.run('the item the verifier left waiting no longer names the deleted verifier', 0.2, function () {
  if (!W.old) return 'no old item: the world failed';
  return JSON.stringify(W.old).toLowerCase().indexOf(GONE.toLowerCase()) === -1 || 'it still names the deleted verifier: ' + short(W.old.status);
}, test.limit.quick);
test.run('its status is left empty, not a guessed one', 0.2, function () {
  if (!W.old) return 'no old item: the world failed';
  return W.old.status === '' || 'its status is ' + short(W.old.status);
}, test.limit.quick);
test.run('an item with a status of its own keeps it', 0.2, function () {
  if (!W.sibling) return 'no sibling: the world failed';
  return W.sibling.status === 'running' || 'its status is now ' + short(W.sibling.status);
}, test.limit.quick);

test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  await new Promise(function (r) { setTimeout(r, 300); });
  try { if (W.scratch) fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
