'use strict';

// spirit/test/deskStacksDialog.js
// goal/G27.2: the Stacks door opens in a Dialog, runs by itself, owns its item; plugin goals never become current.
// Red on today's tree; claude-windows wrote it and builds it. The item's box (v12):
//   D1. the door detail is a shell dialog, shell/stackFrameCheckDetail (type dialog, hidden), opened with
//       callDialog('shell/stackFrameCheckDetail', {id}) through a callDialog passthrough in the plugin ctx; the inline
//       sfc-dialog is gone.
//   D2. the dialog reads and writes doors only through the plugin's verbs.
//   D3. its chat is the chat of the door's item.
//   D4. the stacks goal owns its door items: remove deletes the door's item; while the door exists the plugin refuses
//       close, done and delete of that item.
//   D5. Run runs that one door at once from the plugin, outside deskVerify's queue, and then hands the verdict to
//       deskVerify as a record only.
//   D6. a plugin goal is never made current (make-current not offered, refused if asked), and only a press on the
//       current goal or its items writes and pushes currentGoal.json.
//   D7. a door is deleted from its dialog alone.
//   D8. every door has its own item in the Stacks goal: an old door naming an item outside it, or sharing one, gets a
//       fresh one, and the list points at it.
//   D9. the Stacks subsystem stands alone: deskVerify declares no door.run or door.state (their suite gone), keeps
//       door.record; oneDoorStacks.js is off the list runAll and deskVerify's full run read as suites; the plugin makes no
//       rerun item, and deletes one left from before when it mounts.
//
// THE SHAPES THIS RED NAMES: the record verb deskVerify door.record {id, verdict}; the dialog's ids sfcd-run,
// sfcd-remove, sfcd-chat. The world is deskPluginsGg.js's: a real desk with the plugin, a scratch list in a scratch work
// tree, a fake node standing for deskVerify and for the goal share's job.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G27.2: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const PLUGIN_UI = path.join(RUN, 'shell', 'desk', 'plugins', 'stackFrameChecks', 'stackFrameChecks.js');
const DIALOG = path.join(RUN, 'shell', 'stackFrameCheckDetail', 'stackFrameCheckDetail.js');
const DIALOG_JSON = path.join(RUN, 'shell', 'stackFrameCheckDetail', 'stackFrameCheckDetail.json');
const VERIFY = path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js');
// The shared elements the pane and the dialog load on demand; a fake page cannot load a script, so the world puts them
// on its window first, as a page that loaded them holds them.
const SHARED = ['deskDoorFields.js', 'deskChat.js'].map(function (f) { return path.join(RUN, 'shell', 'shared', 'js', f); });
function withShared(doc, win) { SHARED.forEach(function (f) { if (fs.existsSync(f)) new Function('document', 'window', fs.readFileSync(f, 'utf8'))(doc, win); }); return win; }
const GOAL = 'plugin/stackFrameChecks';
const GATE = 'spirit/run/js/peerPost.js::post';
const END = 'spirit/run/js/presenceNode.js';
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskStacksDialogOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function settled() { for (let i = 0; i < 8; i++) await sleep(20); }

test.startTest('goal/G27.2: the Stacks door in a Dialog, run by itself, owning its item; plugin goals never current');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-stacks-dialog-'));

// ── THE FAKE NODE: deskVerify's door verbs, and every job the desk asks to start ──
const verifyAsks = [];
const jobs = [];
let node = null;
async function startNode() {
  node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = flatCall === 'api' ? { desk: {} } : { ok: true };
        if (j && j.verb === 'jobs.create') { jobs.push(j); out = { id: 'job-' + jobs.length, status: 'running' }; }
        if (flatCall && flatCall.deskVerify) {
          const verb = Object.keys(flatCall.deskVerify)[0];
          verifyAsks.push([verb, flatCall.deskVerify[verb] || {}]);
          out = verb === 'door.run' ? { queued: true, already: false } : verb === 'door.record' ? { recorded: true } :
            verb === 'door.state' ? { running: false, queued: false, ran: false } : { ok: false, code: 'no-such-verb', error: 'no such verb' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

let kid = null;
let client = null;
const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, ANDY).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
const why = function (r) { return r && r.ok === false && r.extra ? String(r.extra.why || '') : ''; };
async function factsOf(id) { const r = await call('item.get', { id: id }); try { return JSON.parse(r.item); } catch (e) { return null; } }

async function serverHalf() {
  await startNode();
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  const gitIn = function (cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); };
  const remote = path.join(scratch, 'remote.git');
  const work = path.join(scratch, 'work');
  fs.mkdirSync(work, { recursive: true });
  gitIn(scratch, ['init', '-q', '--bare', remote]);
  gitIn(work, ['init', '-q', '-b', 'master']);
  gitIn(work, ['config', 'user.email', 'sd@example.invalid']);
  gitIn(work, ['config', 'user.name', 'sd']);
  gitIn(work, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(work, 'README.md'), 'scratch work tree of deskStacksDialog.js\n');
  gitIn(work, ['add', 'README.md']);
  gitIn(work, ['commit', '-q', '--no-verify', '-m', 'start']);
  gitIn(work, ['remote', 'add', 'origin', remote]);
  gitIn(work, ['push', '-q', 'origin', 'master:master']);
  const listFile = path.join(work, 'stackFrameList.json');
  // D8's WORLD: two old doors from before the plugin, both naming one item outside the Stacks goal, as d1 and d2 name
  // goal/G19.14 on his tree. or/G1.1 is made by the session below, after the first mount: at that mount this desk does
  // not know it yet, as a suite's scratch desk does not know his items, and must leave the list alone.
  const OLD = [{ id: 'd1', gate: 'spirit/run/js/peerPost.js::holdStreams', endpoint: END, suites: [], item: 'or/G1.1' },
    { id: 'd2', gate: 'spirit/run/js/peerPost.js::sendAttempt', endpoint: END, suites: [], item: 'or/G1.1' }];
  fs.writeFileSync(listFile, JSON.stringify(OLD, null, 2) + '\n');
  gitIn(work, ['add', 'stackFrameList.json']);
  gitIn(work, ['commit', '-q', '--no-verify', '-m', 'two old doors']);
  gitIn(work, ['push', '-q', 'origin', 'master:master']);
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  // The goal share on (goalRepo): its job is what D6 counts.
  const startDesk = async function () {
    kid = spawn(process.execPath, [DESK, JSON.stringify({ stackFrameList: listFile, goalRepo: work }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    return up;
  };
  if (!await startDesk()) { test.fail('the world: the desk did not start'); return; }
  await sleep(500);
  const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'or/G1', title: 'Ordinary' }, items: [{ id: 'or/G1.1', title: 'one', blocks: ['or/G1'] }] }) });
  const set2 = await call('goal.add', { title: 'Another ordinary goal' });
  if (set.ok === false) { test.fail('the world: no ordinary goal: ' + short(set)); return; }

  test.subHeading('D4. the stacks goal owns its door items');
  const made = await call('stackFrameChecks.make', { gate: GATE, endpoint: END, paths: [], suites: [] });
  const item = made.id;
  const doors = ((await call('stackFrameChecks.doors', {})).doors || []);
  const door = doors.filter(function (d) { return d.item === item; })[0];
  if (!item || !door) { test.fail('the world: make answered ' + short(made) + ', doors ' + short(doors)); return; }
  const closeIt = await call('press', { id: item, what: 'close' });
  const doneIt = await call('press', { id: item, what: 'done' });
  const delIt = await call('item.delete', { id: item });
  if (why(closeIt) && why(doneIt) && why(delIt)) test.check('while door ' + door.id + ' exists, close, done and delete of ' + item + ' are refused: ' + why(delIt));
  else test.fail(OWED + 'on the door item, close answered ' + short(closeIt) + ', done ' + short(doneIt) + ', delete ' + short(delIt));

  test.subHeading('D5. Run runs that one door at once, outside the deskVerify queue, then records the verdict there');
  const before = verifyAsks.length;
  const ran = await call('stackFrameChecks.run', { id: door.id });
  let st = {};
  for (let i = 0; i < 100; i++) { st = await call('stackFrameChecks.runState', { id: door.id }); if (st.verdict && st.verdict.ran !== undefined && !st.running && st.endedAt) break; await sleep(200); }
  // The record is handed over just after the verdict is kept, so it may land a moment after runState shows it.
  const recorded = function () { return verifyAsks.slice(before).some(function (x) { return x[0] === 'door.record' && x[1] && x[1].id === door.id; }); };
  for (let i = 0; i < 20 && !recorded(); i++) await sleep(100);
  const asked = verifyAsks.slice(before);
  if (ran.ok !== false && !asked.some(function (x) { return x[0] === 'door.run'; })) test.check('stackFrameChecks.run did not queue the door in deskVerify');
  else test.fail(OWED + 'run answered ' + short(ran) + ' and asked deskVerify ' + short(asked.map(function (x) { return x[0]; })));
  if (st.endedAt && st.verdict && /no suites/i.test(String(st.verdict.why || ''))) test.check('runState holds the door\'s own verdict as it landed: ' + short(st.verdict.why));
  else test.fail(OWED + 'runState answered ' + short(st));
  if (asked.some(function (x) { return x[0] === 'door.record' && x[1] && x[1].id === door.id && x[1].verdict; })) test.check('the verdict was handed to deskVerify as door.record {id, verdict}');
  else test.fail(OWED + 'deskVerify was asked ' + short(asked));
  if (/'door\.record'/.test(fs.readFileSync(VERIFY, 'utf8'))) test.check('deskVerify declares door.record');
  else test.fail(OWED + 'deskVerify.js declares no door.record');

  test.subHeading('D4. removing the door deletes its item');
  // A second door, its item untouched by the presses above, so the delete is the remove's own.
  const made2 = await call('stackFrameChecks.make', { gate: 'spirit/run/js/peerPost.js::postMessage', endpoint: END, paths: [], suites: [] });
  const door2 = ((await call('stackFrameChecks.doors', {})).doors || []).filter(function (d) { return d.item === made2.id; })[0];
  const open2 = await factsOf(made2.id);
  if (!door2 || !open2 || open2.status === 'closed') { test.fail('the world: a second door was not made open: ' + short(made2)); return; }
  const removed = await call('stackFrameChecks.remove', { id: door2.id });
  await sleep(300);
  const after = await factsOf(made2.id);
  if (removed.ok !== false && after && after.status === 'closed') test.check('door ' + door2.id + ' removed: its item ' + made2.id + ' is deleted (closed and left out)');
  else test.fail(OWED + 'after remove (' + short(removed) + ') its item reads ' + short(after && { status: after.status }));

  test.subHeading('D6. a plugin goal is never made current, and only the current goal writes currentGoal.json');
  const pg = await factsOf(GOAL);
  const mc = await call('press', { id: GOAL, what: 'make-current' });
  if (pg && (pg.buttons || []).indexOf('make-current') === -1 && why(mc)) test.check('make-current is not offered on ' + GOAL + ' and is refused: ' + why(mc));
  else test.fail(OWED + GOAL + ' offers ' + short(pg && pg.buttons) + '; make-current answered ' + short(mc));
  const other = (set2 && set2.id) || '';
  const shares = function () { return jobs.filter(function (j) { return JSON.stringify(j).indexOf('goalShare.js') !== -1; }).length; };
  await sleep(300);
  const s0 = shares();
  if (other) await call('press', { id: other, what: 'close' });
  await call('press', { id: GOAL + '.1', what: 'reopen' });
  await sleep(600);
  const s1 = shares();
  await call('press', { id: 'or/G1.1', what: 'close' });
  await sleep(600);
  const s2 = shares();
  if (s1 === s0) test.check('presses on another goal and on the plugin goal start no goal share');
  else test.fail(OWED + (s1 - s0) + ' goal share(s) started by presses outside the current goal');
  if (s2 > s1) test.check('a press on the current goal\'s item still shares it (guard)');
  else test.fail('the world: a press on the current goal shared nothing (current is ' + short(other) + ')');

  test.subHeading('D8. a door naming an item this desk does not know is left alone');
  const firstDoors = ((await call('stackFrameChecks.doors', {})).doors || []).filter(function (d) { return d.id === 'd1' || d.id === 'd2'; });
  if (firstDoors.length === 2 && firstDoors.every(function (d) { return d.item === 'or/G1.1'; })) test.check('at the first mount, before this desk held or/G1.1, the old doors kept it: no scratch desk rewrites his list');
  else test.fail(OWED + 'at the first mount the old doors read ' + short(firstDoors.map(function (d) { return d.id + '->' + d.item; })));

  test.subHeading('D9. the Stacks subsystem stands alone: deskVerify runs no stack check');
  const verifySrc = fs.readFileSync(VERIFY, 'utf8');
  if (!/'door\.run'\s*:/.test(verifySrc) && !/'door\.state'\s*:/.test(verifySrc) && /'door\.record'\s*:/.test(verifySrc)) test.check('deskVerify declares door.record and no door.run or door.state');
  else test.fail(OWED + 'deskVerify.js still declares door.run or door.state');
  if (!fs.existsSync(path.join(__dirname, 'deskVerifyDoorRun.js'))) test.check('deskVerifyDoorRun.js, the suite of those two verbs, is gone');
  else test.fail(OWED + 'deskVerifyDoorRun.js is still there');
  let notSuites = [];
  try { delete require.cache[require.resolve('./notASuite.js')]; notSuites = require('./notASuite.js'); } catch (e) { notSuites = []; }
  if (notSuites.indexOf('oneDoorStacks.js') !== -1) test.check('oneDoorStacks.js is off the list runAll and deskVerify\'s full run read as suites');
  else test.fail(OWED + 'oneDoorStacks.js is still run by runAll and deskVerify');
  const members = async function () {
    const r = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false });
    return (r.items || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(function (x) { return x && x.goal === GOAL; });
  };
  const RERUN = 'Rerun the stack-frame test';
  if (!(await members()).some(function (x) { return x.title === RERUN; })) test.check('a fresh desk makes no rerun item in ' + GOAL);
  else test.fail(OWED + GOAL + ' holds a rerun item: ' + short((await members()).map(function (x) { return x.id + ' ' + x.title; })));
  // One left from before D9, as on his desk: the plugin deletes it when it mounts.
  const left = await call('item.add', { goal: GOAL, title: RERUN, blocks: '' });
  try { kid.kill(); } catch (e) { /* gone */ }
  await sleep(800);
  if (!left.id || !await startDesk()) { test.fail('the world: the left rerun item ' + short(left) + ', or the restart'); return; }
  const leftAfter = await factsOf(left.id);
  if (!(await members()).some(function (x) { return x.title === RERUN; })) test.check('a rerun item left from before is deleted when the plugin mounts: ' + left.id + ' reads ' + short(leftAfter && leftAfter.status));
  else test.fail(OWED + 'after the restart ' + GOAL + ' still holds ' + left.id + ', ' + RERUN);

  test.subHeading('D8. every door has its own item in the Stacks goal');
  // At this second mount the desk knows or/G1.1, an item outside the Stacks goal that both old doors share.
  const allDoors = ((await call('stackFrameChecks.doors', {})).doors || []);
  const olds = allDoors.filter(function (d) { return d.id === 'd1' || d.id === 'd2'; });
  const oldItems = olds.map(function (d) { return d.item; });
  const oldFacts = [];
  for (const id of oldItems) oldFacts.push(await factsOf(id));
  if (olds.length === 2 && oldItems.every(function (id) { return String(id).indexOf(GOAL + '.') === 0; }) && oldItems[0] !== oldItems[1] &&
      oldFacts.every(function (f) { return f && f.goal === GOAL && f.status !== 'closed'; })) test.check('the two old doors got a fresh item each in ' + GOAL + ': ' + oldItems.join(', '));
  else test.fail(OWED + 'the old doors read back ' + short(olds.map(function (d) { return d.id + '->' + d.item; })));
  const items = allDoors.map(function (d) { return d.item; });
  if (items.every(function (id, i) { return items.indexOf(id) === i; })) test.check('no two doors share an item');
  else test.fail(OWED + 'doors share items: ' + short(items));
  let listNow = [];
  try { listNow = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { listNow = []; }
  if (listNow.filter(function (d) { return d.id === 'd1' || d.id === 'd2'; }).every(function (d) { return String(d.item).indexOf(GOAL + '.') === 0; })) test.check('the list itself points the old doors at their new items');
  else test.fail(OWED + 'the list reads ' + short(listNow.map(function (d) { return d.id + '->' + d.item; })));
}

// ── THE FACE ────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, focus: function () {},
    appendChild: function () {}, replaceChild: function () {}, removeChild: function () {}, firstChild: null, parentNode: null,
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function clickOn(attrs) { return { target: { id: attrs.id || '', getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, closest: function (sel) { const m = /\[([\w-]+)\]/.exec(sel || ''); return m && attrs[m[1]] !== undefined ? { getAttribute: function (n) { return n in attrs ? attrs[n] : null; } } : null; }, parentNode: null }, preventDefault: function () {}, stopPropagation: function () {} }; }
const DOOR = { id: 'd1', gate: GATE, endpoint: END, suites: [], item: GOAL + '.2' };

async function paneHalf() {
  test.subHeading('D1. the pane opens a door with callDialog, and draws no inline detail');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); }, body: fakeElement('body') };
  const win = withShared(doc, test.withSpirit({ 'spirit.fieldRules': require('../run/js/fieldRules.js'), 'spirit.deskPlugins': {} }));
  new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
  const ui = win.spirit.deskPlugins.stackFrameChecks;
  const dialogs = [];
  const asked = [];
  const box = fakeElement('pane');
  ui.open(box, {
    goal: GOAL,
    ask: function (verb, a) { asked.push([verb, a]); if (verb === 'stackFrameChecks.doors') return Promise.resolve({ doors: [DOOR] }); return Promise.resolve({ change: 1, items: [], more: false }); },
    onPublished: function () { return function () {}; }, chat: function () {},
    callDialog: function (app, params) { dialogs.push([app, params]); return new Promise(function () {}); },
  });
  await settled();
  const all = function () { return box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  if (!/id="sfc-dialog"/.test(all())) test.check('the pane has no inline sfc-dialog');
  else test.fail(OWED + 'the pane still draws the inline sfc-dialog');
  if (!/sfc-d-remove|data-remove/.test(all())) test.check('the pane list has no delete (D7)');
  else test.fail(OWED + 'the pane offers a delete');
  [box].concat(Object.keys(byId).map(function (k) { return byId[k]; })).forEach(function (el) { el.fire('click', clickOn({ 'data-open': 'd1' })); });
  await settled();
  if (dialogs.some(function (d) { return d[0] === 'shell/stackFrameCheckDetail' && d[1] && d[1].id === 'd1'; })) test.check('Open calls callDialog("shell/stackFrameCheckDetail", {id: d1})');
  else test.fail(OWED + 'Open opened ' + short(dialogs));
  const ctxText = (fs.readFileSync(FACE, 'utf8').split('ui.open(el,')[1] || '').split('});')[0];
  if (/callDialog/.test(ctxText)) test.check('the Desk face hands the plugin a callDialog');
  else test.fail(OWED + 'the Desk face\'s plugin ctx carries no callDialog');
}

async function dialogHalf() {
  test.subHeading('D1, D2, D3, D5, D7. the door dialog');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(DIALOG_JSON, 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.type === 'dialog' && manifest.hidden === true) test.check('shell/stackFrameCheckDetail is a hidden dialog app');
  else { test.fail(OWED + 'no shell/stackFrameCheckDetail manifest of type dialog, hidden: ' + short(manifest)); return; }
  if (!fs.existsSync(DIALOG)) { test.fail(OWED + 'no stackFrameCheckDetail.js'); return; }
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let app = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DIALOG, 'utf8'))({ shell: { activateApp: function (x) { app = x; } }, core: kernel.core }, doc, withShared(doc, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/js/fieldRules.js') })));
  const box = fakeElement('dlg');
  app.mount(box, {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      calls.push([v, ask && ask[v]]);
      if (v === 'stackFrameChecks.doors') return Promise.resolve({ status: 200, body: { doors: [DOOR] } });
      if (v === 'stackFrameChecks.runState') return Promise.resolve({ status: 200, body: { id: 'd1', running: false, queued: false, verdict: { ran: true, green: false, around: 1, of: 3, paths: ['a path around'], why: '' } } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [{ by: 'andy', at: '', text: 'about this door', taken: '', key: '' }], chatMore: false } });
      return Promise.resolve({ status: 200, body: { change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
  });
  if (typeof app.open === 'function') app.open({ id: 'd1' });
  await settled();
  const page = function () { return box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  if (calls.some(function (c) { return c[0] === 'stackFrameChecks.runState' && c[1] && c[1].id === 'd1'; }) && /a path around/.test(page())) test.check('it reads the door through the plugin\'s verbs and shows its verdict');
  else test.fail(OWED + 'the dialog asked ' + short(calls.map(function (c) { return c[0]; })) + ' and shows ' + short(page().slice(0, 300)));
  if (calls.some(function (c) { return c[0] === 'item.chat' && c[1] && c[1].id === DOOR.item; }) && /about this door/.test(page())) test.check('its chat is the chat of the door\'s item ' + DOOR.item);
  else test.fail(OWED + 'the dialog\'s chat: ' + short(calls.filter(function (c) { return c[0] === 'item.chat'; })));
  const target = function (id) { return { target: { id: id, getAttribute: function () { return null; }, closest: function () { return null; } } }; };
  const n0 = calls.length;
  [box].concat(Object.keys(byId).map(function (k) { return byId[k]; })).forEach(function (el) { el.fire('click', target('sfcd-run')); });
  await settled();
  if (calls.slice(n0).some(function (c) { return c[0] === 'stackFrameChecks.run' && c[1] && c[1].id === 'd1'; })) test.check('#sfcd-run sends stackFrameChecks.run {id: d1}');
  else test.fail(OWED + 'Run sent ' + short(calls.slice(n0)));
  const n1 = calls.length;
  [box].concat(Object.keys(byId).map(function (k) { return byId[k]; })).forEach(function (el) { el.fire('click', target('sfcd-remove')); el.fire('click', target('sfcd-remove')); });
  await settled();
  if (calls.slice(n1).some(function (c) { return c[0] === 'stackFrameChecks.remove' && c[1] && c[1].id === 'd1'; })) test.check('#sfcd-remove (armed, pressed twice) sends stackFrameChecks.remove {id: d1}');
  else test.fail(OWED + 'Remove sent ' + short(calls.slice(n1)));
}

(async function () { await serverHalf(); await paneHalf(); await dialogHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  try { node && node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
