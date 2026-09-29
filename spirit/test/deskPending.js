'use strict';

// spirit/test/deskPending.js
// WHAT WAITS ON WHOM — desk/G1.5, written FIRST, red on today's code.
//
//   Andy, 2026-09-29 (D1): "ah, it can visualize job-queues for agents and
//   me. yes." A desk verb answers what waits on one party; Desk draws it.
//
// THE CONTRACT the desk server is held to (claude-windows, for wsl-claude's
// build). One verb, a search by party:
//   pending.get {who} -> {items: [json]}, each item JSON text
//     {id, title, why}, newest first; 'who' is 'andy' or an agent's name.
// Worked out from the log in desk.db alone: the newest session line gives
// the items, the other lines what happened to them. What waits:
//   on andy   why 'go'     an agent asked under the item, and he has not
//                          answered since (go. / no.);
//             why 'done'   two agents claimed READY TO CLOSE and he has
//                          not said done. since;
//             why 'answer' the item is an open point (open: true) that is
//                          not done.
//   on agent  why 'claim'  he said go. on the item, and that agent has not
//                          claimed READY TO CLOSE since.
// An item a session marks done waits on nobody.
//
// Desk drawing each queue (T4) reads the desk server, so it lands with
// desk/G1.4, when Desk switches over; until then it is owed there.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

test.startTest('desk/G1.5: pending {who}, what waits on each party');

const OWED = 'OWED by desk/G1.5: ';
const SCRIPT = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskpending-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');

let n = 0;
function line(dir, from, kind, text, todo) {
  n += 1;
  return JSON.stringify({ key: 'p' + n, at: new Date(Date.UTC(2026, 8, 29, 6, 0, n)).toISOString(), dir: dir, peer: 'K',
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo });
}
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: [
  { id: 't/G1.1', title: 'Asks Andy for a go' },
  { id: 't/G1.2', title: 'Claimed by both' },
  { id: 't/G1.O1', title: 'An open point', open: true },
  { id: 't/G1.3', title: 'Go given, one claim' },
  { id: 't/G1.4', title: 'Already done', done: true },
] });
const LOG = [
  line('in', 'claude-windows', 'session', SESSION, 'team/chat'),
  line('in', 'claude-windows', 'ask', 'ready: go?', 't/G1.1'),
  line('in', 'claude-windows', 'note', 'READY TO CLOSE', 't/G1.2'),
  line('in', 'wsl-claude', 'note', 'READY TO CLOSE', 't/G1.2'),
  line('in', 'claude-windows', 'ask', 'ready: go?', 't/G1.3'),
  line('out', 'andy', 'answer', 'go.', 't/G1.3'),
  line('in', 'wsl-claude', 'note', 'READY TO CLOSE', 't/G1.3'),
  line('in', 'claude-windows', 'ask', 'ready: go?', 't/G1.4'),
];

const ids = function (r) { return ((r && r.items) || []).map(function (i) { const j = i.label; try { return JSON.parse(j).id; } catch (e) { return '?'; } }).sort().join(','); };
const whys = function (r) { const o = {}; ((r && r.items) || []).forEach(function (i) { const j = i.label; try { const x = JSON.parse(j); o[x.id] = x.why; } catch (e) { /* skip */ } }); return o; };

(async function () {
  const kid = spawn(process.execPath, [SCRIPT, '{}', '--pipe', pipe, '--state', state], { stdio: 'ignore' });
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r.body || {}; }); };
  const until = Date.now() + 8000;
  let up = false;
  while (Date.now() < until && !up) {
    up = await client.ask('api').then(function (r) { return !!(r.body && r.body.desk && r.body.desk.ok !== false); }, function () { return false; });
    if (!up) await new Promise(function (r) { setTimeout(r, 150); });
  }
  for (const l of LOG) await call('log.add', { json: l });

  test.subHeading("T1: an item waiting on Andy is in pending(andy) and in no agent's");
  const andy = await call('pending.get', { who: 'andy' });
  const w = whys(andy);
  if (ids(andy) === 't/G1.1,t/G1.2,t/G1.O1' && w['t/G1.1'] === 'go' && w['t/G1.2'] === 'done' && w['t/G1.O1'] === 'answer') {
    test.check('andy waits on: G1.1 (go), G1.2 (done), G1.O1 (answer); G1.3 answered, G1.4 done');
  } else test.fail(OWED + 'pending(andy) answered ' + JSON.stringify(andy));

  test.subHeading("T2: an item waiting on an agent's claim is in that agent's queue only");
  const cw = await call('pending.get', { who: 'claude-windows' });
  const wsl = await call('pending.get', { who: 'wsl-claude' });
  if (ids(cw) === 't/G1.3' && whys(cw)['t/G1.3'] === 'claim' && ids(wsl) === '' && ids(andy).indexOf('t/G1.3') === -1) {
    test.check('G1.3 waits on claude-windows\'s claim alone: wsl-claude has claimed, and Andy has answered');
  } else test.fail(OWED + 'claude-windows ' + JSON.stringify(cw) + ', wsl-claude ' + JSON.stringify(wsl));

  test.subHeading('T3: once answered, it leaves the queue');
  await call('log.add', { json: line('out', 'andy', 'answer', 'go.', 't/G1.1') });
  await call('log.add', { json: line('out', 'andy', 'answer', 'done.', 't/G1.2') });
  await call('log.add', { json: line('in', 'claude-windows', 'note', 'READY TO CLOSE', 't/G1.3') });
  const andy2 = await call('pending.get', { who: 'andy' });
  const cw2 = await call('pending.get', { who: 'claude-windows' });
  if (ids(andy2) === 't/G1.3,t/G1.O1' && whys(andy2)['t/G1.3'] === 'done' && ids(cw2) === 't/G1.1' && whys(cw2)['t/G1.1'] === 'claim') {
    test.check('go and done answered leave Andy\'s queue; G1.3, now claimed by both, waits on his done; G1.1, now on go, waits on the claims');
  } else test.fail(OWED + 'after answers: andy ' + JSON.stringify(andy2) + ', claude-windows ' + JSON.stringify(cw2));

  // THE GOAL IS A ROW TOO (found claiming G1.5): once both agents claim the
  // goal itself, it waits on his done like any item.
  test.subHeading('T5: the goal row waits on Andy once both agents claim it');
  await call('log.add', { json: line('in', 'claude-windows', 'note', 'READY TO CLOSE', 't/G1') });
  await call('log.add', { json: line('in', 'wsl-claude', 'note', 'READY TO CLOSE', 't/G1') });
  const andy3 = await call('pending.get', { who: 'andy' });
  if (whys(andy3)['t/G1'] === 'done') test.check('t/G1, claimed by both, is in pending(andy) as done');
  else test.fail(OWED + 'with the goal claimed by both, pending(andy) answered ' + JSON.stringify(andy3).slice(0, 200));

  // A SEARCH SAYS WHEN IT WAS CUT (the list rule: "bounded, ranked and
  // truthful about being partial"), as log.search does.
  test.subHeading('T6: pending.get says more when its answer was cut');
  const many = [];
  for (let i = 0; i < 40; i++) many.push({ id: 't/G1.O' + (10 + i), title: 'An open point with a long title ' + 'x'.repeat(260), open: true });
  // Planted straight into desk.db: since slim/G1.2 log.add refuses a line
  // this big, but pending.get reads every stored line, and one planted
  // behind the server's back is exactly what its cut must still hold.
  const big = JSON.parse(line('in', 'claude-windows', 'session', JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: many }), 'team/chat'));
  const db = new (require('node:sqlite').DatabaseSync)(path.join(state, 'desk.db'));
  db.prepare('INSERT INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)').run(big.key, big.at, big.todo, big.from, big.kind, big.text, JSON.stringify(big));
  db.close();
  const cut = await call('pending.get', { who: 'andy' });
  const small = await call('pending.get', { who: 'wsl-claude' });
  if (cut.more === true && (cut.items || []).length > 0 && (cut.items || []).length < 40 && small.more === false) {
    test.check('40 long open points: ' + cut.items.length + ' fit, and more is true; a short queue says more false');
  } else test.fail(OWED + 'pending(andy) over 40 long items: ' + (cut.items || []).length + ' items, more ' + JSON.stringify(cut.more) + '; a short queue more ' + JSON.stringify(small.more));

  kid.kill();
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
