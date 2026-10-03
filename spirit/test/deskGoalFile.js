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
//   3. WHAT. One JSON object: `change` and `line`, the desk's two cursors as `changes` answers them at that
//      moment (so an agent asks changes {n: change, line} for everything since); `goal`, the current goal's id;
//      `items`, every item of the current goal INCLUDING the goal's own row and the closed ones, each with its facts
//      (as item.get gives them: id, title, status, buttons, go, ...) and its `box`, `version`, `checks` and `chat`
//      (the lines as item.chat gives them: by, at, text). The group chat desk/G0.0 is not in it.
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
const GROUP = 'desk/G0.0';

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

// One desk server, with the arguments given; its door, its state.
async function server(name, args) {
  const state = path.join(scratch, name, 'state');
  fs.mkdirSync(state, { recursive: true });
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
  const quiet = await server('quiet', {});
  await quiet.call('session.set', { json: JSON.stringify({ goal: { id: 'q/G1', title: 'Quiet' }, items: [{ id: 'q/G1.1', title: 'One', blocks: ['q/G1'] }] }) }, CW);
  await quiet.call('press', { id: 'q/G1', what: 'end-design' }, ANDY);
  await quiet.call('press', { id: 'q/G1.1', what: 'go' }, ANDY);
  await sleep(200);
  const quietFiles = fs.readdirSync(path.join(scratch, 'quiet')).concat(fs.readdirSync(quiet.state)).filter(function (f) { return /currentGoal/.test(f); });
  if (!quietFiles.length && bytesOf(REPO_FILE) === repoBytesBefore) test.check('spawned with {}: no currentGoal.json in its folders, and the repo file untouched');
  else test.fail(OWED + 'spawned with {} the server wrote ' + JSON.stringify(quietFiles) + '; repo file changed: ' + (bytesOf(REPO_FILE) !== repoBytesBefore));

  test.subHeading('3. written on Go, go-all, Done and session.set; left alone by a line');
  const file = path.join(scratch, 'written', 'goal.json');
  const args = Object.assign({}, defaults);
  if (argName) args[argName] = file;
  const d = await server('written', args);
  const set = await d.call('session.set', { json: JSON.stringify({ goal: { id: 'w/G1', title: 'Written' }, items: [
    { id: 'w/G1.1', title: 'First', blocks: ['w/G1'] },
    { id: 'w/G1.2', title: 'Second', blocks: ['w/G1'] },
    { id: 'w/G1.3', title: 'Closed early', blocks: ['w/G1'] },
  ] }) }, CW);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  await sleep(200);
  const afterSet = readJson(file);
  if (afterSet && afterSet.goal === 'w/G1' && afterSet.change === set.body.change) test.check('session.set writes it: goal w/G1, change ' + set.body.change + ' (his open point, taken as yes)');
  else test.fail(OWED + 'after session.set the file is ' + JSON.stringify(afterSet).slice(0, 160) + ' (session.set answered change ' + (set.body || {}).change + ')');
  await d.call('press', { id: 'w/G1', what: 'end-design' }, ANDY);
  await d.call('box.write', { id: 'w/G1.1', text: 'THE-BOX-OF-FIRST', version: 0 }, CW);
  await d.call('chat.add', { id: 'w/G1.1', text: 'a line under first', by: 'claude-windows' }, CW);
  await d.call('chat.add', { id: GROUP, text: 'a group line, not of the goal' }, ANDY);
  await d.call('press', { id: 'w/G1.3', what: 'close' }, ANDY);
  await sleep(200);
  const beforeGo = readJson(file);
  const go = await d.call('press', { id: 'w/G1.1', what: 'go' }, ANDY);
  await sleep(200);
  const afterGo = readJson(file);
  if (go.status === 200 && afterGo && afterGo.change === go.body.change && beforeGo && beforeGo.change < afterGo.change) test.check('his Go writes it: change ' + afterGo.change + ', the Go\'s own record');
  else test.fail(OWED + 'after his Go: ' + JSON.stringify(afterGo).slice(0, 160) + '; go answered ' + JSON.stringify(go.body));
  const line = await d.call('chat.add', { id: 'w/G1.1', text: 'a line after the Go' }, ANDY);
  await sleep(200);
  const afterLine = readJson(file);
  if (line.status === 200 && afterLine && afterLine.change === afterGo.change) test.check('a chat line leaves the file as it was (change still ' + afterGo.change + ')');
  else test.fail(OWED + 'after a chat line the file says change ' + (afterLine || {}).change + ', the line was record ' + (line.body || {}).change);
  await d.call('press', { id: 'w/G1.1', what: 'claim-done' }, CW);
  const done = await d.call('press', { id: 'w/G1.1', what: 'done' }, ANDY);
  await sleep(200);
  const afterDone = readJson(file);
  if (done.status === 200 && afterDone && afterDone.change === done.body.change) test.check('his Done writes it: change ' + afterDone.change);
  else test.fail(OWED + 'after his Done: ' + JSON.stringify(afterDone).slice(0, 160) + '; done answered ' + JSON.stringify(done.body));
  const goAll = await d.call('press', { id: 'w/G1', what: 'go-all' }, ANDY);
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
  if (ids.join() === ['w/G1', 'w/G1.1', 'w/G1.2', 'w/G1.3'].join()) test.check('items: the goal\'s row and its three items, the closed one included');
  else test.fail(OWED + 'items in the file: ' + JSON.stringify(ids) + (byId[GROUP] ? ' (the group chat is in it)' : ''));
  if (!byId[GROUP] && JSON.stringify(doc).indexOf('a group line, not of the goal') === -1) test.check('the group chat desk/G0.0 and its line are not in it');
  else test.fail(OWED + 'the file carries the group chat');
  const first = byId['w/G1.1'] || {};
  const facts = first.status === 'done' && Array.isArray(first.buttons) && first.go === true && first.title === 'First';
  const chat = Array.isArray(first.chat) && first.chat.some(function (l) { return l && l.text === 'a line after the Go' && l.by === 'andy' && typeof l.at === 'string'; });
  if (facts && first.box === 'THE-BOX-OF-FIRST' && first.version === 1 && Array.isArray(first.checks) && chat) test.check('w/G1.1 carries its facts (done, go true, buttons), its box and version, its checks and its chat lines {by, at, text}');
  else test.fail(OWED + 'w/G1.1 in the file: ' + JSON.stringify(first).slice(0, 300));
  if ((byId['w/G1.3'] || {}).status === 'closed') test.check('w/G1.3, closed and off the List, is in the file as closed');
  else test.fail(OWED + 'w/G1.3 in the file: ' + JSON.stringify(byId['w/G1.3'] || null).slice(0, 120));

  test.subHeading('5. the cursors: changes {n: change, line} answers everything since, and nothing before');
  const later = await d.call('chat.add', { id: 'w/G1.2', text: 'the line after the file' }, ANDY);
  const since = await d.call('changes', { n: doc.change, line: doc.line }, CW);
  const recs = (since.body && since.body.records) || [];
  const texts = recs.map(function (r) { return String(r.body); });
  if (typeof doc.line === 'number' && since.status === 200 && recs.length === 1 && /the line after the file/.test(texts[0]) && recs[0].n === (later.body || {}).change) test.check('from the file\'s change ' + doc.change + ' and line ' + doc.line + ', changes answers the one record written since');
  else test.fail(OWED + 'changes from the file\'s cursors answered ' + recs.length + ' record(s): ' + JSON.stringify(texts).slice(0, 200) + '; line in file: ' + JSON.stringify(doc.line));
  const bytes = bytesOf(file);
  await d.call('items.find', { text: 'first', by: '', since: '', before: '' }, CW);
  await d.call('item.get', { id: 'w/G1.1' }, CW);
  await d.call('item.chat', { id: 'w/G1.1' }, CW);
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
