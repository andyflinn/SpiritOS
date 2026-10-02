'use strict';

// goal/G2.3: the listener tells Desk what it does — listening when it arms, working when it hands over a line.
// Red on today's tree: Desk has no such verb, and deskEar says nothing about itself.
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
//   4. deskEar.js says listening when it arms (before its first changes ask) and working the moment it hands over
//      a line (before it prints and exits under --once). Proven live: a real desk server, a pretend node between
//      it and a real deskEar.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G2.3: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const EAR = path.join(RUN, 'process', 'js', 'agents', 'deskEar.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; for (;;) { const v = fn(); if (v || Date.now() > end) return v; await sleep(100); } }

const CW = { key: 'MCowBQYDK2VwAyEAdeskEarStateTestPeerCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskEarStateTestPeerWSLAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskEarStateTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const CONTROL = 'MCowBQYDK2VwAyEAdeskEarStateControlAAAAAAAAAAAAAAAAA=';

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
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: true }, ANDY);
  try { return JSON.parse(r.body.items[0].label); } catch (e) { return {}; }
};

// The publishes the desk server sends up (its node callback), every object kept.
const published = [];
// The pretend node deskEar talks to: its peer.post goes into the desk server as the agent's own ask, and the
// answer comes back down the event stream by re; the stream also carries any nudge the test sends.
const streams = [];
const words = [];  // every agent.state the desk server was asked, in order: { by, word }
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': open\n\n');
    streams.push(res);
    return;
  }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    if (b.verb === 'jobs.update') {
      if (b.app) published.push(b.app);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }
    if (b.verb !== 'peer.post') { res.writeHead(400); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const desk = (ask && ask.body && ask.body.desk) || {};
    const verb = Object.keys(desk)[0] || '';
    if (verb === 'agent.state') words.push({ by: CW.label, word: desk[verb] && desk[verb].word });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, CW).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: CONTROL, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the ear retries */ });
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

  test.subHeading('4. deskEar says listening when it arms, working when it hands over a line');
  words.length = 0;
  const ear = spawn(process.execPath, [EAR, '--self', 'claude-windows', '--once'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { AGENTS_NODE: nodeUrl, AGENTS_ROOT: scratch, AGENTS_SELF: 'claude-windows', AGENTS_CONTROL: CONTROL, AGENTS_PEERS: '' }),
  });
  kids.push(ear);
  let out = '';
  ear.stdout.on('data', function (c) { out += c; });
  ear.stderr.on('data', function (c) { out += c; });
  const armed = await until(function () { return words.some(function (x) { return x.word === 'listening'; }); }, 15000);
  const armedRow = await goalRow();
  if (armed && (armedRow.working || []).indexOf('claude-windows') === -1) test.check('the ear said listening as it armed, and Desk shows it not working');
  else test.fail(OWED + 'the ear ' + (armed ? 'said listening but Desk still shows it working' : 'never said listening') + '; words ' + JSON.stringify(words) + ' ear: ' + out.slice(0, 300));
  // A line of his for this agent, then a nudge down the stream: the ear hands it over and exits.
  await call('chat.add', { id: 'e/G1.1', text: 'a line for the ear' }, ANDY);
  // Desk's own nudge, as the page sends it (deskDetails.js): an agents packet { kind: 'changed' }; the ear's
  // stream reader passes only agents envelopes on.
  const nudge = packet.encode('agents', { kind: 'changed', from: 'desk', text: '' });
  streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: CONTROL, text: nudge.text }) + '\n\n'); } catch (e) { /* gone */ } });
  const exited = await new Promise(function (resolve) { const t = setTimeout(function () { resolve(false); }, 15000); ear.on('exit', function () { clearTimeout(t); resolve(true); }); });
  const last = words[words.length - 1] || {};
  const workingRow = await goalRow();
  if (exited && /a line for the ear/.test(out) && last.word === 'working' && (workingRow.working || []).indexOf('claude-windows') !== -1) {
    test.check('the ear said working, handed the line over, and exited; Desk shows claude-windows working');
  } else test.fail(OWED + (exited ? 'the ear exited' : 'the ear did not exit') + ', last word ' + JSON.stringify(last.word) + ', Desk working ' + JSON.stringify(workingRow.working) + ', ear: ' + out.slice(0, 300));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
