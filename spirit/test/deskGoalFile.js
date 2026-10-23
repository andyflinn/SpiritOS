'use strict';

// spirit/test/deskGoalFile.js
// goal/G3.14: the desk server writes the current goal into the repo, spirit/run/process/js/desk/currentGoal.json.
// RED on today's tree: the desk server writes only into its state folder (desk/G1 D5); no such file exists.
//
//   Andy, 2026-10-03, the musing (verbatim): "The desk server will produce a file
//   "spirit/run/process/js/desk/currentGoal.json" it will contain the complete data set of the current goal,
//   including the commit-level agains which the file was generated. the file re-generation is triggered by 'Go'
//   and 'Done events' and the data includes items not visible to the user." "this, will automatically be pushed when
//   the user syncs his repo to the current state." "the commit-level is implicit in the users push." "this will let
//   git log desk history as well." In the group chat: "it's the truth scoped by commit level."; "ah, the agents
//   sees the file itself, and that is cheaper"; "please create an item with this all summarized." His Go is his
//   press on goal/G3.14 (2026-10-03).
//
// THE CONTRACT (the box of goal/G3.14, both agents; the shapes wsl-claude fixes here are named). One file,
// process/js/desk/desk.js and its manifest desk.json; no core module.
//   1. THE ARGUMENT. desk.json carries one argument whose default names the file, `currentGoal.json`, a path
//      relative to the desk folder (process/js/desk). The node hands that default when it starts the server
//      (jobs.js), so Andy's desk writes beside desk.js; a server spawned with '{}' (every suite) has no value and
//      writes no file anywhere. The shape fixed here: the value IS the path (empty: off), so this suite can point it
//      into its scratch and the clone it runs in is never written. The argument's name is the builder's: this suite
//      reads desk.json and hands the defaults over as the node would, with the file's path replaced by its own.
//   2. WHEN. The file is written whole on his go, go-all and done, and on session.set (his open point, taken as
//      yes unless he said no); a chat line, a box write, a claim or a press of another kind leave it as it was.
//      Since goal/G33.7 session.set is gone: the switch to a goal (his make-current) writes it in its place.
//   3. WHAT. One JSON object: `change`, the desk's change number at that moment (since goal/G33.4, with
//      `changes` gone, what was written after it carries a later number on the desk's stream); `goal`, the current goal's id;
//      `items`, every item of the current goal INCLUDING the goal's own row and the closed ones, each with its facts
//      (as item.get gives them: id, title, status, buttons, go, ...) and its `box`, `version`, `checks` and `chat`
//      (the lines as item.chat gives them: by, at, text). The group chat goal/G0 is not in it.
//   4. THE FILE IN THE REPO. spirit/run/process/js/desk/currentGoal.json is tracked by git (committed at birth,
//      so the lab suites, which refuse an untracked file under spirit/, keep running) and parses as that object.
//   5. A read is a read: the finds, the chats and item.get write nothing to it (its bytes stay as they were).
// Not asserted, the builder's: the order of keys, pretty-printing, what else the file may carry (a written-at
// time, the commit?), whether abandoned goals' files are kept.
// Not proven: this suite has run only against today's tree, where every owed check is red.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G3.14: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK_DIR = path.join(RUN, 'process', 'js', 'desk');
const DESK = path.join(DESK_DIR, 'desk.js');
const MANIFEST = path.join(DESK_DIR, 'desk.json');
const REPO_FILE = path.join(DESK_DIR, 'currentGoal.json');
const GROUP = 'goal/G0';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskGoalFileTestDeskNodeAAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskGoalFileTestPeerCWAAAAAAAAAAAAAAA=', label: 'claude-windows' };

test.startTest('goal/G3.14: the desk server writes the current goal into the repo, currentGoal.json');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskgoalfile-'));
const win = process.platform === 'win32';
const kids = [];
const readJson = function (file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const bytesOf = function (file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } };

// The manifest's defaults, as the node hands them (jobs.js: one JSON object of name -> default).
function manifestDefaults() {
  const m = readJson(MANIFEST) || {};
  const out = {};
  (Array.isArray(m.args) ? m.args : []).forEach(function (a) { if (a && a.name) out[a.name] = a.default; });
  return out;
}
// The one argument that names the file: its default ends in currentGoal.json.
function fileArgName(defaults) {
  return Object.keys(defaults).filter(function (k) { return /currentGoal\.json$/.test(String(defaults[k])); })[0] || '';
}

// One desk server, with the arguments given; its door, its state. goal/G33.7 (session.set went): its world, seeded
// before it starts, which it takes in at start.
async function server(name, args, seed) {
  const state = path.join(scratch, name, 'state');
  fs.mkdirSync(state, { recursive: true });
  if (seed) test.seedDesk(state, seed);
  const pipe = win ? appClient.pipePathFor(path.join(scratch, name), 'desk', 'win32', 'process') : path.join(scratch, name, 'desk.sock');
  const client = appClient.createAppClient({ rootDir: path.join(scratch, name) });
  client.register('desk', pipe);
  kids.push(spawn(process.execPath, [DESK, JSON.stringify(args), '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ }
  }
  const call = function (verb, a, caller) { const q = {}; q[verb] = a; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
  return { call: call, state: state };
}

async function main() {
  test.subHeading('1. the manifest names the file, and the file is in the repo');
  const defaults = manifestDefaults();
  const argName = fileArgName(defaults);
  if (argName) test.check('desk.json has an argument (' + argName + ') whose default is ' + defaults[argName]);
  else test.fail(OWED + 'desk.json names no argument whose default ends in currentGoal.json: ' + JSON.stringify(defaults));
  let tracked = '';
  try { tracked = execSync('git ls-files -- ' + JSON.stringify(path.relative(path.join(RUN, '..', '..'), REPO_FILE).replace(/\\/g, '/')), { cwd: path.join(RUN, '..', '..'), encoding: 'utf8' }).trim(); } catch (e) { tracked = ''; }
  const repoDoc = readJson(REPO_FILE);
  if (tracked && repoDoc && typeof repoDoc.change === 'number' && Array.isArray(repoDoc.items)) test.check('spirit/run/process/js/desk/currentGoal.json is tracked by git and parses as {change, items, ...}');
  else test.fail(OWED + 'the repo file: tracked ' + JSON.stringify(tracked) + ', parsed ' + JSON.stringify(repoDoc).slice(0, 80));
  const repoBytesBefore = bytesOf(REPO_FILE);

  test.subHeading('2. a server with no value writes no file');
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  const quiet = await server('quiet', {}, { goal: { id: 'goal/G100', title: 'Quiet' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }] });
  await quiet.call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  await quiet.call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
  await sleep(200);
  const quietFiles = fs.readdirSync(path.join(scratch, 'quiet')).concat(fs.readdirSync(quiet.state)).filter(function (f) { return /currentGoal/.test(f); });
  if (!quietFiles.length && bytesOf(REPO_FILE) === repoBytesBefore) test.check('spawned with {}: no currentGoal.json in its folders, and the repo file untouched');
  else test.fail(OWED + 'spawned with {} the server wrote ' + JSON.stringify(quietFiles) + '; repo file changed: ' + (bytesOf(REPO_FILE) !== repoBytesBefore));

  test.subHeading('3. written on Go, go-all, Done and the switch to a goal; left alone by a line');
  // SINCE goal/G4.21 the desk writes the file into its own state folder, never the checkout, and goalShare.js
  // commits it from there (goalShare.js holds that half). goalPath names its place in the repo; set, sharing is on.
  const args = Object.assign({}, defaults);
  if (argName) args[argName] = 'spirit/run/process/js/desk/currentGoal.json';
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world. goal/G33.7: seeded, goal/G101 and a
  // second goal after it (so goal/G102 is current at start), and his make-current switches to goal/G101.
  const d = await server('written', args, [{ goal: { id: 'goal/G101', title: 'Written' }, items: [
    { id: 'goal/G101.1', title: 'First', blocks: ['goal/G101'] },
    { id: 'goal/G101.2', title: 'Second', blocks: ['goal/G101'] },
    { id: 'goal/G101.3', title: 'Closed early', blocks: ['goal/G101'] },
  ] }, { goal: { id: 'goal/G102', title: 'Before the switch' }, items: [{ id: 'goal/G102.1', title: 'Elsewhere', blocks: ['goal/G102'] }] }]);
  const file = path.join(d.state, 'currentGoal.json');
  const set = await d.call('press', { id: 'goal/G101', what: 'make-current' }, ANDY);
  if (set.status !== 200) { test.fail(OWED + 'make-current goal/G101 answered ' + JSON.stringify(set.body)); return; }
  await sleep(200);
  const afterSet = readJson(file);
  if (afterSet && afterSet.goal === 'goal/G101' && afterSet.change === set.body.change) test.check('the switch to goal/G101 writes it: goal goal/G101, change ' + set.body.change);
  else test.fail(OWED + 'after make-current the file is ' + JSON.stringify(afterSet).slice(0, 160) + ' (make-current answered change ' + (set.body || {}).change + ')');
  await d.call('press', { id: 'goal/G101', what: 'end-design' }, ANDY);
  await d.call('box.write', { id: 'goal/G101.1', text: 'THE-BOX-OF-FIRST', version: 0 }, CW);
  await d.call('chat.add', { id: 'goal/G101.1', text: 'a line under first', by: 'claude-windows' }, CW);
  await d.call('chat.add', { id: GROUP, text: 'a group line, not of the goal' }, ANDY);
  await d.call('press', { id: 'goal/G101.3', what: 'close' }, ANDY);
  await sleep(200);
  const beforeGo = readJson(file);
  const go = await d.call('press', { id: 'goal/G101.1', what: 'go' }, ANDY);
  await sleep(200);
  const afterGo = readJson(file);
  if (go.status === 200 && afterGo && afterGo.change === go.body.change && beforeGo && beforeGo.change < afterGo.change) test.check('his Go writes it: change ' + afterGo.change + ', the Go\'s own record');
  else test.fail(OWED + 'after his Go: ' + JSON.stringify(afterGo).slice(0, 160) + '; go answered ' + JSON.stringify(go.body));
  const line = await d.call('chat.add', { id: 'goal/G101.1', text: 'a line after the Go' }, ANDY);
  await sleep(200);
  const afterLine = readJson(file);
  if (line.status === 200 && afterLine && afterLine.change === afterGo.change) test.check('a chat line leaves the file as it was (change still ' + afterGo.change + ')');
  else test.fail(OWED + 'after a chat line the file says change ' + (afterLine || {}).change + ', the line was record ' + (line.body || {}).change);
  await d.call('press', { id: 'goal/G101.1', what: 'claim-done' }, CW);
  const done = await d.call('press', { id: 'goal/G101.1', what: 'done' }, ANDY);
  await sleep(200);
  const afterDone = readJson(file);
  if (done.status === 200 && afterDone && afterDone.change === done.body.change) test.check('his Done writes it: change ' + afterDone.change);
  else test.fail(OWED + 'after his Done: ' + JSON.stringify(afterDone).slice(0, 160) + '; done answered ' + JSON.stringify(done.body));
  const goAll = await d.call('press', { id: 'goal/G101', what: 'go-all' }, ANDY);
  await sleep(200);
  const afterGoAll = readJson(file);
  if (goAll.status === 200 && afterGoAll && afterGoAll.change === goAll.body.change) test.check('his go-all writes it: change ' + afterGoAll.change);
  else test.fail(OWED + 'after go-all: ' + JSON.stringify(afterGoAll).slice(0, 160) + '; go-all answered ' + JSON.stringify(goAll.body));

  test.subHeading('4. what it holds: the whole goal, closed items too, boxes and chats; not the group chat');
  const doc = afterGoAll || {};
  const items = Array.isArray(doc.items) ? doc.items : [];
  const byId = {};
  items.forEach(function (it) { if (it && it.id) byId[it.id] = it; });
  const ids = Object.keys(byId).sort();
  if (ids.join() === ['goal/G101', 'goal/G101.1', 'goal/G101.2', 'goal/G101.3'].join()) test.check('items: the goal\'s row and its three items, the closed one included');
  else test.fail(OWED + 'items in the file: ' + JSON.stringify(ids) + (byId[GROUP] ? ' (the group chat is in it)' : ''));
  if (!byId[GROUP] && JSON.stringify(doc).indexOf('a group line, not of the goal') === -1) test.check('the group chat goal/G0 and its line are not in it');
  else test.fail(OWED + 'the file carries the group chat');
  const first = byId['goal/G101.1'] || {};
  const facts = first.status === 'done' && Array.isArray(first.buttons) && first.go === true && first.title === 'First';
  const chat = Array.isArray(first.chat) && first.chat.some(function (l) { return l && l.text === 'a line after the Go' && l.by === 'andy' && typeof l.at === 'string'; });
  if (facts && first.box === 'THE-BOX-OF-FIRST' && first.version === 1 && Array.isArray(first.checks) && chat) test.check('goal/G101.1 carries its facts (done, go true, buttons), its box and version, its checks and its chat lines {by, at, text}');
  else test.fail(OWED + 'goal/G101.1 in the file: ' + JSON.stringify(first).slice(0, 300));
  if ((byId['goal/G101.3'] || {}).status === 'closed') test.check('goal/G101.3, closed and off the List, is in the file as closed');
  else test.fail(OWED + 'goal/G101.3 in the file: ' + JSON.stringify(byId['goal/G101.3'] || null).slice(0, 120));

  // goal/G33.4: `changes` is gone (the desk streams each row it writes, with its change number). The file's change is
  // still the desk's count at that moment: the next write is numbered right after it, and the file is not rewritten.
  test.subHeading('5. the file\'s change: the next write is numbered right after it');
  const later = await d.call('chat.add', { id: 'goal/G101.2', text: 'the line after the file' }, ANDY);
  await sleep(200);
  const stillDoc = readJson(file) || {};
  const read = await d.call('item.chat', { id: 'goal/G101.2' }, CW);
  const seen = ((read.body || {}).chat || []).some(function (l) { return l && l.text === 'the line after the file'; });
  if (later.status === 200 && (later.body || {}).change === doc.change + 1 && stillDoc.change === doc.change && seen) test.check('the line written after the file is change ' + (doc.change + 1) + ', the file still says ' + doc.change + ', and item.chat has the line');
  else test.fail(OWED + 'after the file\'s change ' + doc.change + ' the line was change ' + (later.body || {}).change + '; the file says ' + stillDoc.change + '; item.chat has it: ' + seen);
  const bytes = bytesOf(file);
  await d.call('items.search', { text: 'first', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, CW);
  await d.call('item.get', { id: 'goal/G101.1' }, CW);
  await d.call('item.chat', { id: 'goal/G101.1' }, CW);
  await sleep(100);
  if (bytes && bytesOf(file) === bytes) test.check('reads write nothing to it');
  else test.fail(OWED + 'a read changed the file');
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
