'use strict';

// goal/G2.3: the listener tells Desk what it does — listening when it arms, working when it hands over a line.
// This suite holds the desk server's half (1 to 3). The listener's half (4) ran agents/deskEar.js, which went with
// the agents app (goal/G3.2); the listener that replaces it is held to its words by its own suite (goal/G3.4).
//   Andy (goal/G2.2 note 3, broken out): "every agents tab has a blinking border while it's working. it starts,
//   when the agent stops listening to do a task, and it stops when the agent goes back to listening. the
//   listening script can toggle those two?"
// The contract the builder follows (the shape argued in goal/G2.3):
//   1. The desk server takes agent.state { word }, word 'listening' or 'working', from the caller it is handed
//      (the agent by its key, apiAuth/G1.13); any other word is refused bad-request; the agent itself remembers
//      nothing: the ear says the word, every time.
//   2. The current goal's facts carry working: the labels of the agents whose last word is working AND who are
//      live (a write in the last 10 minutes, the same rule as live); a stale working clears with liveness.
//   3. The change is published: the write that takes the word publishes the goal row with its new working list,
//      so a page paints it from the publish and pulls nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.3: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const CW = { key: 'MCowBQYDK2VwAyEAdeskEarStateTestPeerCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskEarStateTestPeerWSLAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskEarStateTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };

test.startTest('goal/G2.3: the listener tells Desk listening or working');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-earstate-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
const kids = [];
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
const goalRow = async function () {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }, ANDY);
  try { return JSON.parse(r.body.items[0].label); } catch (e) { return {}; }
};

// The publishes the desk server sends up (its node callback), every object kept.
const published = [];
// The pretend node the desk server reports to: it keeps what the server publishes.
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    if (b.verb === 'jobs.update') {
      if (b.app) published.push(b.app);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }
    res.writeHead(400); res.end('{"ok":false}');
  });
});

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  }));
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
  const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'e/G1', title: 'Ears' }, items: [{ id: 'e/G1.1', title: 'A', blocks: ['e/G1'] }] }) }, CW);
  if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }

  test.subHeading('1. agent.state takes listening or working from the caller, nothing else');
  const w = await call('agent.state', { word: 'working' }, CW);
  const odd = await call('agent.state', { word: 'asleep' }, CW);
  if (w.status === 200 && typeof (w.body || {}).change === 'number' && odd.status !== 200 && (odd.body || {}).code === 'bad-request') {
    test.check('working is taken and answers its change; asleep is refused bad-request');
  } else test.fail(OWED + 'agent.state working answered ' + w.status + ' ' + JSON.stringify(w.body) + ', asleep ' + odd.status + ' ' + JSON.stringify((odd.body || {}).code));

  test.subHeading('2. the goal row says who is working, by the agent\'s last word, live agents only');
  await call('agent.state', { word: 'listening' }, WSL);
  const both = await goalRow();
  await call('agent.state', { word: 'listening' }, CW);
  const none = await goalRow();
  if (Array.isArray(both.working) && both.working.join() === 'claude-windows' && Array.isArray(none.working) && none.working.length === 0
    && (both.live || []).indexOf('claude-windows') !== -1) {
    test.check('working lists claude-windows after its working, and nobody after its listening; both stay live');
  } else test.fail(OWED + 'the goal row said working ' + JSON.stringify(both.working) + ' then ' + JSON.stringify(none.working) + ', live ' + JSON.stringify(both.live));

  test.subHeading('3. the change is published as the goal row');
  published.length = 0;
  await call('agent.state', { word: 'working' }, WSL);
  await sleep(400);
  const rowOf = function (p) { return (p.rows || []).concat(p.item && typeof p.item === 'object' ? [p.item] : []).filter(function (r) { return r && r.id === 'e/G1'; })[0]; };
  const pub = published.map(rowOf).filter(Boolean).pop();
  if (pub && Array.isArray(pub.working) && pub.working.join() === 'wsl-claude') test.check('a publish carried the goal row with working: [wsl-claude]');
  else test.fail(OWED + 'no publish carried the goal row with the new working list: ' + JSON.stringify(published.slice(-2)).slice(0, 300));
  await call('agent.state', { word: 'listening' }, WSL);
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
