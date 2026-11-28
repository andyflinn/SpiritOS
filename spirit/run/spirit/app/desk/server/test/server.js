'use strict';

// spirit/run/spirit/app/desk/server/test/server.js
// THE DESK SERVER WITHOUT PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./server/server.md): desk/server/server.js, desk's server.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.", Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, and a desk server
// started on a scratch state folder, asked through its own pipe; Andy's desk is not touched.

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/desk/test/nodeDesk/' + name + tempAsked); }
const appClient = SPIRIT.requireScript('spirit/app/adapter/script.js');

function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function tracked(dir) { return execSync('git ls-files -- "' + dir + '"', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');
// The app is known by its id, its folder's path in dots (goal/G49.19): its pipe from its folder, its row and its calls by its id.
const ID = 'spirit.app.desk';

const W = {};
// One of the folders: gone from git and from the disk.
function folderGone(dir) {
  const left = tracked(dir);
  return (!left.length && !fs.existsSync(path.join(REPO, dir))) || false;
}

// WHAT WENT, NOW IN THE DESK'S OWN TEST (goal/G47.4; Andy: "you make bloody well sure that such stupid hard-coded tests move to
// app-child-* immediately, or whatever is fucking appropriate"; cw: these "are about desk and deskClient themselves, not about
// the app server"): moved here from spirit/server/app/test/script.js. Box v15, what goes: the desk keeps no bundled() of its own;
// goal/G41.24, Andy: "DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder itself."
function deskFiles(dir) { const out = []; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'node_modules') walk(f); } else if (/\.(js|json)$/.test(e.name)) out.push(f); }); }(dir)); return out; }
test.run('the desk server has no bundled() of its own', 0.2, function () {
  const deskJs = code(path.join(DESK, 'server', 'server.js'));
  return (!!deskJs && !/function\s+bundled\s*\(/.test(deskJs)) || false;
}, test.limit.quick);
test.run('nothing in the desk folder names DEPENDENCIES or hands serve() a dependencies list', 0.2, function () {
  const named = deskFiles(DESK).filter(function (f) {
    const t = code(f);
    return /DEPENDENCIES/.test(t) || /\bdependencies\s*:/.test(t) || /opts\.dependencies|withDependencies|checkDependencies/.test(t);
  });
  return named.length === 0 || false;
}, test.limit.quick);

// NO CORE IN THE DESK (Andy, 2026-11-17: "The stupid core designation is worthless in desk anyway ... may as well toss that
// shit from desk and make desk a little more simple"; measured that day on his node, every search, write and subscribe of
// the desk checked each listed file with coreFiles.isCore, an app's json read from disc each time, 3.2 s a pass).
test.run('nothing in the desk folder works out whether a file is core: no coreFiles, no isCore, no core mark on a file', 0.2, function () {
  const named = deskFiles(DESK).filter(function (f) {
    const t = code(f);
    return /coreFiles|isCore|data-core|CORE_GRANT|coreGrant/.test(t) || /\bcore:\s*(true|false|isCore|e\.core|o\.row\.core)/.test(t);
  });
  return named.length === 0 || false;
}, test.limit.quick);

// Andy: "removal of plugin folders."
test.run('the desk app\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/plugins'); }, test.limit.quick);
test.run('the desk element\'s plugins folder is gone', 0.2, function () { return folderGone('spirit/run/spirit/app/desk/element/desk/plugins'); }, test.limit.quick);
test.run('the old shell\'s stackFrameCheckDetail folder is gone', 0.2, function () { return folderGone('spirit/run/shell/stackFrameCheckDetail'); }, test.limit.quick);

// Andy: "removal of plugin support.", and "G0 goes, from ui and server"
test.run('desk.js mounts no plugin and asks none for a refusal', 0.2, function () {
  const desk = code(path.join(DESK, 'server', 'server.js'));
  return (!!desk && !/plugins|PLUGIN/.test(desk)) || false;
}, test.limit.quick);
test.run('desk.js knows no team chat goal, goal/G0', 0.2, function () {
  const desk = code(path.join(DESK, 'server', 'server.js'));
  return (!!desk && !/goal\/G0['"]/.test(desk)) || false;
}, test.limit.quick);

// A desk server of the tree, on a scratch state folder: what its api serves, and what a fresh one holds.
test.run('a scratch desk answers api with its verbs, item.get among them', 0.2, async function () {
  // A unix socket's path is short (108 bytes): the helper's folder for this suite gives a socket path of 91 on Linux
  // (/tmp/spirit/<node>/spirit/app/desk/test/nodeDesk/spn1/spirit/state/app/desk/door.sock); Windows has named pipes.
  const scratch = W.scratch = ownTemp('spn');
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = appClient.pipePathFor(scratch, 'spirit/app/desk', process.platform);
  // The node makes the folder of a server's door before it starts it; so does the test.
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  W.kid = spawn(process.execPath, [path.join(DESK, 'desk.js'), '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const client2 = appClient.createAppClient({ rootDir: scratch });
  if (typeof client2.register === 'function') client2.register(ID, pipe);
  const ask = W.ask = function (body) { return client2.ask(body).then(function (r) { return r || {}; }, function () { return {}; }); };
  let api = {};
  const until = Date.now() + 15000;
  // Asked until the desk listens: before that the client answers app-not-running for it.
  while (Date.now() < until) { const r = await ask('api'); const b = r && r.body && (r.body[ID] || r.body); if (b && typeof b === 'object' && b.ok !== false && Object.keys(b).length) { api = b; break; } await new Promise(function (r2) { setTimeout(r2, 200); }); }
  W.api = api[ID] || api;
  const verbs = W.verbs = Object.keys(W.api);
  return (verbs.length > 5 && verbs.indexOf('item.get') !== -1) || false;
}, test.limit.slow, { why: 'it starts a desk server as a process' });
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
  const g0 = await W.ask({ [ID]: { 'item.get': { id: 'goal/G0' } } });
  const held = !!(g0.body && g0.body.item);
  return !held || false;
}, test.limit.quick);

test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  await new Promise(function (r) { setTimeout(r, 300); });
  // The suite's whole temp folder, once the desk it started is gone: removed before the kill, the desk's open database
  // kept it on Windows, and an empty folder was left ("it leaves no temp folder behind", 2026-11-17, on Andy's node).
  try { fs.rmSync(tempFolder.path('spirit/app/desk/test/nodeDesk'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
