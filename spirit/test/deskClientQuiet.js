'use strict';

// spirit/test/deskClientQuiet.js
// goal/G27.12, reopened 2026-10-17. Red on today's tree; claude-windows wrote it and builds it (one agent).
//   Andy, 2026-10-17, reopening the item because Levant started chattering again: "No agent should hear when i take
//   the box", "when an agent's deskClient takes a chat line for him, all other deskClients should be refused a take,
//   and thus NOT notify their agent.", "it's the deskClient that should manage that, we leave desk alone.", and to
//   gating box.take and box.write in deskClient as chat is gated: "yes, add that". To silencing his box.release as
//   well: "Do it."
//
// WHAT IS ASSERTED (the box of goal/G27.12, REOPENED)
//   1. Andy's box.take and box.release reach no agent; his box.write still does.
//   2. deskClient takes Andy's chat line for its agent before handing it over:
//      a. a line another agent took first is not handed over;
//      b. a line addressed to another agent is not handed over;
//      c. a line it hands over stands taken by its own agent at the desk.
//   3. deskClient gates box.take and box.write as it gates chat: refused not-taken where its agent neither holds
//      the item nor took Andy's line; allowed where it took his line.
// NOT ASSERTED: the words of a refusal; the desk itself, which is left alone.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');
const packet = require('../run/spirit/client/packet.js');

const OWED = 'OWED by goal/G27.12: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const POLL_MS = 400;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const SELF_KEY = 'MCowBQYDK2VwAyEAdeskClientQuietTestSelfAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskClientQuietTestOtherAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientQuietTestDeskNodeAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };

test.startTest('goal/G27.12 reopened: deskClient keeps its agent quiet');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclient-quiet-'));
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

// THE PRETEND NODE deskClient runs on, as deskClientNext.js builds it: its peer.post goes into the real desk as the
// agent's own ask, and the answer comes back down the event stream.
const streams = [];
const posts = [];
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
    // goal/G33.4: the desk runs on this node too, and what it posts to this agent's key (its stream, deskClient's
    // streamListener) goes into deskClient as the desk's call; everything else is deskClient's ask of the desk.
    const fromDesk = b.to === SELF_KEY;
    const desk = (ask && ask.body && ask.body.desk) || {};
    const verb = Object.keys(desk)[0] || '';
    if (!fromDesk) posts.push({ verb: verb, args: desk[verb] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    test.peerAnswer(client, ask && ask.body, fromDesk ? { key: DESK_KEY, label: 'Andy' } : SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: fromDesk ? SELF_KEY : DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

function startClient(nodeUrl) {
  const kid = spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-quiet-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  });
  kids.push(kid);
  return kid;
}
async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
async function next() {
  const r = await call('deskClient', 'next', {}, OWNER);
  return (r.body && Array.isArray(r.body.lines)) ? r.body.lines : [];
}
// Everything next hands over until a line holding `marker` comes, or the tries run out.
async function nextUntil(marker) {
  const all = [];
  for (let i = 0; i < 4; i++) {
    const lines = await next();
    lines.forEach(function (l) { all.push(l); });
    if (lines.some(function (l) { return l.indexOf(marker) !== -1; })) break;
  }
  return all;
}
const has = function (lines, text) { return lines.some(function (l) { return l.indexOf(text) !== -1; }); };
const andySays = function (id, text) { return call('desk', 'chat.add', { id: id, text: text }, ANDY); };
const throughClient = function (verb, args) { return call('deskClient', 'desk', { name: verb, json: JSON.stringify(args) }, OWNER); };
async function lineOf(id, text) {
  const r = await call('desk', 'item.chat', { id: id }, ANDY);
  const chat = (r.body && Array.isArray(r.body.chat)) ? r.body.chat : [];
  return chat.filter(function (l) { return l && l.by === 'andy' && l.text === text; })[0] || null;
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; seeded before the desk starts
  // (goal/G33.7: session.set went).
  const items = ['goal/G100.1', 'goal/G100.2', 'goal/G100.3', 'goal/G100.4', 'goal/G100.5'].map(function (id, i) { return { id: id, title: 'item ' + (i + 1), blocks: ['goal/G100'] }; });
  test.seedDesk(deskState, { goal: { id: 'goal/G100', title: 'Quiet' }, items: items });
  // goal/G33.4: the desk on the pretend node, so its stream reaches deskClient (no `changes` to poll any more).
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-quiet-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }) }));
  await up('desk');
  const set = await call('desk', 'item.get', { id: 'goal/G100.5' }, ANDY);
  if (set.status !== 200) { test.fail('the world: the seeded desk has no goal/G100.5: ' + short(set.body)); return; }
  // Both agents known to the desk by key, name and nick, as Andy's profiles hold them, so his "wsl:" line is addressed.
  await call('desk', 'profile.set', { agent: SELF_KEY, name: 'claude-windows', nick: 'cw' }, ANDY);
  await call('desk', 'profile.set', { agent: OTHER_KEY, name: 'wsl-claude', nick: 'wsl' }, ANDY);
  await call('desk', 'item.take', { id: 'goal/G100.5' }, OTHER_AT_DESK);
  await call('desk', 'chat.add', { id: 'goal/G100.5', text: 'the other agent is known' }, OTHER_AT_DESK);
  await call('desk', 'item.release', { id: 'goal/G100.5' }, OTHER_AT_DESK);
  startClient(nodeUrl);
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  await next();   // the first run starts at now

  test.subHeading('1. his box.take and box.release reach no agent');
  await call('desk', 'box.take', { id: 'goal/G100.1' }, ANDY);
  await call('desk', 'box.release', { id: 'goal/G100.1' }, ANDY);
  await andySays('goal/G100.2', 'after the box');
  await sleep(POLL_MS + 100);
  const one = await nextUntil('after the box');
  if (!has(one, 'box.take') && !has(one, 'box.release')) test.check('neither his box.take nor his box.release was handed over');
  else test.fail(OWED + 'next handed over ' + short(one.filter(function (l) { return /box\.(take|release)/.test(l); })));
  if (has(one, 'after the box')) test.check('his chat line after it was handed over');
  else test.fail(OWED + 'his chat line never came: ' + short(one));

  test.subHeading('2. the line is taken before it is handed over');
  const mine = await lineOf('goal/G100.2', 'after the box');
  if (mine && mine.taken === 'claude-windows') test.check('the line handed over stands taken by its own agent at the desk');
  else test.fail(OWED + 'the line handed over reads at the desk ' + short(mine));
  await andySays('goal/G100.3', 'for whoever is first');
  const otherTook = await call('desk', 'line.take', { id: 'goal/G100.3' }, OTHER_AT_DESK);
  if (otherTook.status !== 200) { test.fail('the world: the other agent could not take the line: ' + short(otherTook.body)); return; }
  const addressed = await andySays('goal/G100.4', 'wsl: this one is for the other agent');
  const held = await lineOf('goal/G100.4', 'wsl: this one is for the other agent');
  if (!held || held.taken !== 'wsl-claude') { test.fail('the world: his "wsl:" line is not addressed to the other agent at the desk: ' + short(addressed.body) + ' ' + short(held)); return; }
  await andySays('goal/G100.4', 'marker for anyone');
  await sleep(POLL_MS + 100);
  const two = await nextUntil('marker for anyone');
  // goal/G33.8 (box v16): the wake hands all the news of the goal (NEWS lines); a line the other agent took is never
  // handed as this agent's own to answer (DESK).
  if (!has(two.filter(function (l) { return String(l).indexOf('DESK ') === 0; }), 'for whoever is first')) test.check('a line the other agent took first was not handed over as its own');
  else test.fail(OWED + 'next handed over a line the other agent had taken: ' + short(two));
  if (!has(two, "this one is for the other agent")) test.check('a line addressed to the other agent was not handed over');
  else test.fail(OWED + 'next handed over a line addressed to the other agent: ' + short(two));
  if (has(two, 'marker for anyone')) test.check('a free line under the same item still was');
  else test.fail(OWED + 'the free line never came: ' + short(two));

  test.subHeading('3. box.take and box.write are gated like chat');
  const refusedTake = await throughClient('box.take', { id: 'goal/G100.3' });
  const box = await call('desk', 'item.box', { id: 'goal/G100.3' }, ANDY);
  const refusedWrite = await throughClient('box.write', { id: 'goal/G100.3', text: 'not mine to write', version: (box.body && box.body.version) || 0 });
  if ((refusedTake.body || {}).code === 'not-taken' && (refusedWrite.body || {}).code === 'not-taken') test.check('box.take and box.write are refused not-taken where the agent neither holds the item nor took his line');
  else test.fail(OWED + 'on goal/G100.3 box.take answered ' + short(refusedTake.body) + ', box.write ' + short(refusedWrite.body));
  const allowed = await throughClient('box.take', { id: 'goal/G100.2' });
  if (allowed.status === 200 && (allowed.body || {}).ok !== false) test.check('box.take is allowed where the agent took his line');
  else test.fail(OWED + 'box.take on goal/G100.2, where it took his line, answered ' + short(allowed.body));
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
