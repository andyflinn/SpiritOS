'use strict';

// spirit/test/deskStacksDoorSearch.js
// goal/G33.7: the Stacks door list is a bounded door search and a read per door. Andy (the item's box): "The desk's
// interface itself prevents oversized answers: no verb fetches a whole goal or a whole item; every verb that could answer
// past the payload is removed or reshaped into bounded reads", and in the approved verb list: "the Stacks door list (a
// door search with a more flag, and a read per door)". stackFrameChecks.doors answered every door in one list.
//
// THE SHAPES THIS RED NAMES (the verb change approved under goal/G33.7's list):
//   stackFrameChecks.doors.search {text}  -> {items: [{key: <door id>, label: <the door's row, JSON>}], more}: every
//                                            door ranked by text (probability, the desk's search components), filled
//                                            to one answer; more says some were left out.
//   stackFrameChecks.door {id}            -> the one door: id, gate, endpoint, paths, suites, item, last.
//   stackFrameChecks.doors                gone: refused no-such-verb, named nowhere in the desk's interface, asked by
//                                            no page.
// WHAT IS ASSERTED, by outcome, on a real desk with the plugin and a scratch list of 40 doors, each with 32 suites (the
// list's own limit), so every door together is far past one answer:
//   1. the search with no text answers under appClient.ANSWER_MAX, with more, each row a door;
//   2. the search for one door's gate puts that door first;
//   3. the read of one door answers it whole, its 32 suites among it, under one answer;
//   4. the old verb is refused no-such-verb, the interface does not name it, and neither the pane nor the door dialog
//      asks it.
// rule/11: through testSupport only; its own folders, pipes and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G33.7 (Stacks doors): ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const PLUGIN_UI = path.join(RUN, 'shell', 'desk', 'plugins', 'stackFrameChecks', 'stackFrameChecks.js');
const DIALOG = path.join(RUN, 'shell', 'stackFrameCheckDetail', 'stackFrameCheckDetail.js');
const API = path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'api.js');
const END = 'spirit/run/js/presenceNode.js';
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskStacksDoorSearchOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const DOORS = 40;
const SUITES = 32;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function bytes(x) { return Buffer.byteLength(JSON.stringify(x === undefined ? null : x), 'utf8'); }

test.startTest('goal/G33.7: the Stacks door list is a bounded door search and a read per door');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-stacks-doorsearch-'));
let node = null;
let kid = null;
let client = null;
const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, ANDY).then(function (r) { return r || {}; }, function (e) { return { status: 0, body: { error: e.message } }; }); };

async function main() {
  // A pretend node: the family interfaces, and an ok to everything else (the goal share's job, deskVerify's record).
  node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const na = test.nodeApi(j);
        if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(test.foldAsk(j) === 'api' ? '{"desk":{}}' : '{"ok":true}');
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  // The list in a scratch work tree with a remote, as deskStacksDialog.js has it: the plugin commits and pushes it.
  const gitIn = function (cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); };
  const remote = path.join(scratch, 'remote.git');
  const work = path.join(scratch, 'work');
  fs.mkdirSync(work, { recursive: true });
  gitIn(scratch, ['init', '-q', '--bare', remote]);
  gitIn(work, ['init', '-q', '-b', 'master']);
  gitIn(work, ['config', 'user.email', 'ds@example.invalid']);
  gitIn(work, ['config', 'user.name', 'ds']);
  gitIn(work, ['config', 'commit.gpgsign', 'false']);
  const listFile = path.join(work, 'stackFrameList.json');
  const list = [];
  for (let n = 1; n <= DOORS; n++) {
    const suites = [];
    for (let k = 1; k <= SUITES; k++) suites.push('doorSearchProbeSuiteNumber' + k + 'ForDoor' + n + '.js');
    list.push({ id: 'd' + n, gate: 'spirit/run/js/peerPost.js::gateNumber' + n + 'Of' + DOORS, endpoint: END, suites: suites, item: '' });
  }
  fs.writeFileSync(listFile, JSON.stringify(list, null, 2) + '\n');
  gitIn(work, ['add', 'stackFrameList.json']);
  gitIn(work, ['commit', '-q', '--no-verify', '-m', 'forty doors']);
  gitIn(work, ['remote', 'add', 'origin', remote]);
  gitIn(work, ['push', '-q', 'origin', 'master:master']);
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'desk.sock');
  client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  kid = spawn(process.execPath, [DESK, JSON.stringify({ stackFrameList: listFile, goalRepo: work }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: the desk did not start'); return; }
  await sleep(800);
  if (bytes(list) > appClient.ANSWER_MAX * 3) test.check('the world: ' + DOORS + ' doors of ' + SUITES + ' suites each, ' + bytes(list) + ' bytes together, far past one answer');
  else test.fail('the world: the list is only ' + bytes(list) + ' bytes');

  test.subHeading('1. the door search answers one answer, with more');
  const all = await call('stackFrameChecks.doors.search', { text: '' });
  const ab = all.body || {};
  const rows = Array.isArray(ab.items) ? ab.items : [];
  const parsed = rows.map(function (x) { try { return JSON.parse(x.label); } catch (e) { return null; } });
  if (all.status === 200 && bytes(ab) <= appClient.ANSWER_MAX && ab.more === true && rows.length >= 1 && parsed.every(function (d, i) { return d && rows[i].key === d.id && typeof d.gate === 'string'; })) test.check('stackFrameChecks.doors.search {text: ""} answered ' + rows.length + ' doors in ' + bytes(ab) + ' bytes (under ' + appClient.ANSWER_MAX + '), more said, each row a door keyed by its id');
  else test.fail(OWED + 'stackFrameChecks.doors.search answered ' + all.status + ' ' + short(ab) + ' (' + bytes(ab) + ' bytes)');

  test.subHeading('2. the search ranks by text');
  const one = await call('stackFrameChecks.doors.search', { text: 'gateNumber37Of40' });
  const first = ((one.body || {}).items || [])[0];
  if (one.status === 200 && first && first.key === 'd37') test.check('the search for door 37\'s gate puts d37 first');
  else test.fail(OWED + 'the search for gateNumber37Of40 answered ' + one.status + ' ' + short(one.body));

  test.subHeading('3. the read of one door answers it whole, under one answer');
  const door = await call('stackFrameChecks.door', { id: 'd12' });
  const db = door.body || {};
  if (door.status === 200 && db.id === 'd12' && Array.isArray(db.suites) && db.suites.length === SUITES && db.gate === list[11].gate && 'last' in db && bytes(db) <= appClient.ANSWER_MAX) test.check('stackFrameChecks.door {id: "d12"} answered d12 with its ' + SUITES + ' suites and its last run, ' + bytes(db) + ' bytes');
  else test.fail(OWED + 'stackFrameChecks.door answered ' + door.status + ' ' + short(db));
  const none = await call('stackFrameChecks.door', { id: 'd999' });
  if (none.status !== 200) test.check('a door the list does not hold is refused: ' + short((none.body || {}).code));
  else test.fail(OWED + 'stackFrameChecks.door {id: "d999"} answered ' + short(none.body));

  test.subHeading('4. stackFrameChecks.doors is gone');
  const old = await call('stackFrameChecks.doors', {});
  const iface = fs.readFileSync(API, 'utf8');
  const pages = [PLUGIN_UI, DIALOG].filter(function (f) { return /['"]stackFrameChecks\.doors['"]/.test(fs.readFileSync(f, 'utf8')); });
  if ((old.body || {}).code === 'no-such-verb' && !/['"]stackFrameChecks\.doors['"]/.test(iface) && !pages.length) test.check('the desk refuses stackFrameChecks.doors (no-such-verb), its interface does not name it, and no page asks it');
  else test.fail(OWED + 'stackFrameChecks.doors answered ' + short(old.body) + '; named in api.js ' + /['"]stackFrameChecks\.doors['"]/.test(iface) + '; asked by ' + short(pages.map(function (f) { return path.basename(f); })));
}

main().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  try { if (kid && kid.exitCode === null) kid.kill(); } catch (e) { /* gone */ }
  try { if (node) node.close(); } catch (e) { /* closed */ }
  await sleep(400);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
