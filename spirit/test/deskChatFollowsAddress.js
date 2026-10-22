'use strict';

// spirit/test/deskChatFollowsAddress.js
// goal/G27.10: chat posts follow the address, not the newest line. Red on today's tree; claude-windows wrote it and
// builds it (one agent). The item's box (v4) is the requirement:
//   R1. a line of Andy's addressed to an agent gives that agent a standing right to post under that item until it has
//       answered. This already holds in the desk: asserted here as a guard.
//   R2. an agent that holds the item or a phase on it, held a phase on it earlier, or created it, posts its work notes
//       and reports under it at any time.
//   R3. no second answer to a taken line: an agent that is none of these is still refused. A guard.
//   R4. the gate stays mechanical: the address, the take, the holding and the creator on record.
//   R5. deskClient's own chat and box gate (goal/G27.12) allows the same posts R2 allows.
// A real desk and a real deskClient, as deskClientQuiet.js builds them.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G27.10: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const SELF_KEY = 'MCowBQYDK2VwAyEAdeskChatAddressTestSelfAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskChatAddressTestOtherAAAAAAAAAAAAAA=';
const THIRD_KEY = 'MCowBQYDK2VwAyEAdeskChatAddressTestThirdAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskChatAddressTestDeskNodeAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const THIRD_AT_DESK = { key: THIRD_KEY, label: 'levant-local' };
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };

test.startTest('goal/G27.10: chat posts follow the address, the holding and the creator');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-chat-address-'));
const deskState = path.join(scratch, 'desk-state');
const clientState = path.join(scratch, 'client-state');
fs.mkdirSync(deskState, { recursive: true });
fs.mkdirSync(clientState, { recursive: true });
const win = process.platform === 'win32';
const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const clientPipe = win ? appClient.pipePathFor(scratch, 'deskClient', 'win32', 'process') : path.join(scratch, 'deskClient.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
client.register('deskClient', clientPipe);
const kids = [];
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// THE PRETEND NODE deskClient runs on: its peer.post goes into the real desk as the agent's own ask.
const streams = [];
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
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const desk = (ask && ask.body && ask.body.desk) || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
const andySays = function (id, text) { return call('desk', 'chat.add', { id: id, text: text }, ANDY); };
const posts = function (who, id, text) { return call('desk', 'chat.add', { id: id, text: text }, who); };
const throughClient = function (id, text) { return call('deskClient', 'desk', { name: 'chat.add', json: JSON.stringify({ id: id, text: text }) }, OWNER); };
const ok = function (r) { return r && r.status === 200 && (r.body || {}).ok !== false; };
// His fresh line under the item, taken by the other agent: from here a post by anyone else would be a second answer
// unless R1 or R2 lets it.
async function takenByOther(id, text) {
  await andySays(id, text);
  const t = await call('desk', 'line.take', { id: id }, OTHER_AT_DESK);
  return ok(t);
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  const set = await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'a/G1', title: 'Posts' }, items: [{ id: 'a/G1.1', title: 'a code item', blocks: ['a/G1'] }, { id: 'a/G1.2', title: 'a plain item', blocks: ['a/G1'] }] }) }, ANDY);
  if (set.status !== 200) { test.fail('the world: the test desk took no session: ' + short(set.body)); return; }
  await call('desk', 'profile.set', { agent: SELF_KEY, name: 'claude-windows', nick: 'cw' }, ANDY);
  await call('desk', 'profile.set', { agent: OTHER_KEY, name: 'wsl-claude', nick: 'wsl' }, ANDY);
  await call('desk', 'profile.set', { agent: THIRD_KEY, name: 'levant-local', nick: 'lev' }, ANDY);

  // The item this agent creates, under his words (goal/G29.21).
  await call('desk', 'chat.add', { id: 'a/G1', text: 'add item' }, ANDY);
  const added = await call('desk', 'item.add', { goal: 'a/G1', title: 'made by claude-windows', blocks: '' }, SELF_AT_DESK);
  const made = (added.body || {}).id;
  if (!made) { test.fail('the world: item.add answered ' + short(added.body)); return; }
  // The code item this agent held the red of, and let go.
  await call('desk', 'press', { id: 'a/G1.1', what: 'code' }, ANDY);
  await call('desk', 'press', { id: 'a/G1', what: 'end-design' }, ANDY);
  await call('desk', 'press', { id: 'a/G1.1', what: 'go' }, ANDY);
  const took = await call('desk', 'phase.take', { id: 'a/G1.1', phase: 'red' }, SELF_AT_DESK);
  const done = await call('desk', 'phase.done', { id: 'a/G1.1', phase: 'red', pass: true, why: 'red written' }, SELF_AT_DESK);
  const g11 = JSON.parse(((await call('desk', 'item.get', { id: 'a/G1.1' }, ANDY)).body || {}).item || '{}');
  if (!ok(took) || !ok(done) || g11.red !== 'claude-windows' || g11.with) { test.fail('the world: the red of a/G1.1 was not held and let go: ' + short({ took: took.body, done: done.body, red: g11.red, with: g11.with })); return; }

  test.subHeading('R2 at the desk: the creator and an earlier phase holder post at any time');
  if (!await takenByOther(made, 'how is it going?')) { test.fail('the world: the other agent could not take his line on ' + made); return; }
  const byCreator = await posts(SELF_AT_DESK, made, 'creator note');
  if (ok(byCreator)) test.check('the agent that created ' + made + ' posts under it while another agent holds his line');
  else test.fail(OWED + 'the creator was refused under ' + made + ': ' + short(byCreator.body));
  if (!await takenByOther('a/G1.1', 'status of the red?')) { test.fail('the world: the other agent could not take his line on a/G1.1'); return; }
  const byEarlier = await posts(SELF_AT_DESK, 'a/G1.1', 'red holder note');
  if (ok(byEarlier)) test.check('the agent that held the red of a/G1.1 posts under it while another agent holds his line');
  else test.fail(OWED + 'the earlier red holder was refused under a/G1.1: ' + short(byEarlier.body));

  test.subHeading('R3 and R1, guards');
  if (!await takenByOther('a/G1.2', 'who answers this?')) { test.fail('the world: the other agent could not take his line on a/G1.2'); return; }
  const second = await posts(THIRD_AT_DESK, 'a/G1.2', 'a second answer');
  if (!ok(second)) test.check('an agent that neither holds, held, created nor was addressed is still refused: ' + short((second.body || {}).code));
  else test.fail(OWED + 'a second answer to a taken line was accepted');
  await andySays('a/G1.2', 'cw: and you, what do you think?');
  await andySays('a/G1.2', 'a later line of his');
  await call('desk', 'line.take', { id: 'a/G1.2' }, OTHER_AT_DESK);
  const addressed = await posts(SELF_AT_DESK, 'a/G1.2', 'my answer to his cw: line');
  if (ok(addressed)) test.check('his line addressed to cw lets cw answer it after a later line was taken by another');
  else test.fail(OWED + 'the addressed agent was refused: ' + short(addressed.body));

  test.subHeading('R5: deskClient allows the same posts');
  const kid = spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: 400, historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-chat-address-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  });
  kids.push(kid);
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  await takenByOther(made, 'and now?');
  const viaCreator = await throughClient(made, 'creator note through deskClient');
  if (ok(viaCreator)) test.check('through deskClient, the creator posts under ' + made);
  else test.fail(OWED + 'deskClient refused the creator under ' + made + ': ' + short(viaCreator.body));
  await takenByOther('a/G1.1', 'and the red now?');
  const viaEarlier = await throughClient('a/G1.1', 'red holder note through deskClient');
  if (ok(viaEarlier)) test.check('through deskClient, the earlier red holder posts under a/G1.1');
  else test.fail(OWED + 'deskClient refused the earlier red holder under a/G1.1: ' + short(viaEarlier.body));
  await takenByOther('a/G1.2', 'one more for the other');
  const viaNone = await throughClient('a/G1.2', 'not mine to answer');
  if (!ok(viaNone)) test.check('through deskClient, a post where it neither holds, held, created nor took is still refused');
  else test.fail(OWED + 'deskClient let a second answer through under a/G1.2');
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
