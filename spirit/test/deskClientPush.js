'use strict';

// spirit/test/deskClientPush.js
// goal/G33.4 (box v36): `changes` is deleted and the desk's push replaces it. Andy, on `changes`: "isn't that what this
// item does? implement the push/broadcast concept?" Red on today's tree; claude-windows writes it and builds it.
//
// WHAT IS ASSERTED, by outcome:
//   1. deskClient hands its agent a new line of Andy's in the current goal, and never asks the desk `changes` for it:
//      the agent's wait on next ends with the line within a few seconds of his write, and the asks deskClient posted
//      to the desk hold no `changes`.
//   2. After the desk restarts, the same: his next line reaches the agent, still with no `changes` ask (the desk pushes
//      the current goal whole when it is back, and its updates after).
//   3-6 (box v37, the item's purpose): an idle deskClient asks the desk nothing; reads of current-goal rows are answered
//      from what the push brought, with no desk ask; chat between Andy and another agent on an item this agent does not
//      hold does not end its wait; deskClient reaches the desk through the family interface, and neither it nor the
//      translator builds desk packets by hand or keeps a cache beside spirit.data.
// NOT ASSERTED, the build's: how the desk's push reaches deskClient (the verb it calls on deskClient's node), what
// deskClient keeps, and its history records.
// Proven live: a real desk server on a pretend node of Andy's, a real deskClient on a pretend
// node of an agent's, the two nodes handing each other's posts over as a relay and the agent node's door would.
// rule/11: through testSupport only; its own folders, pipes and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G33.4 (push): ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
// A poll no wait in this suite can reach: what brings a line within seconds is the push, not a poll.
const POLL_MS = 60000;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientPushTestDeskNodeAAAAAAAAAAAAAAAAA=';
const B_KEY = 'MCowBQYDK2VwAyEAdeskClientPushTestAgentBBBBBBBBBBBBBBBBAAAA=';
const A_KEY = 'MCowBQYDK2VwAyEAdeskClientPushTestAgentAAAAAAAAAAAAAAAAAAAA=';
const A_AT_DESK = { key: A_KEY, label: 'claude-windows' };
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };
const B_AT_DESK = { key: B_KEY, label: 'wsl-claude' };
const B_OWNER = { owner: true, key: B_KEY, label: 'wsl-claude' };
const DESK_AT_B = { key: DESK_KEY, label: 'Andy Flinn' };

test.startTest('goal/G33.4: deskClient hands its agent his lines from the desk\'s push, never asking changes');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclientpush-'));
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
let deskKid = null;
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// A PRETEND NODE: an event stream, and peer.post handed to `deliver`.
function pretendNode(deliver, onPage) {
  const streams = [];
  const server = http.createServer(function (req, res) {
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
      { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
      // RULE 1 (goal/G3.9): each agent's node blocks the other agent, as deskClientQuiet.js has it.
      if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
      if (b.verb === 'jobs.update') { if (onPage && b.app) onPage(b.app); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
      if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
      const hash = 'H' + Date.now() + Math.random();
      let ask = null;
      try { ask = packet.decode(b.text); } catch (e) { ask = null; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hash: hash }));
      Promise.resolve(deliver(String(b.to || ''), ask || {})).then(function (answer) {
        if (!answer) return;
        const made = packet.encode('api', answer.body, { re: hash });
        streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: answer.from, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
      }, function () { /* the asker waits it out */ });
    });
  });
  return { server: server, streams: streams };
}
// ANDY'S NODE: what the desk posts to B's node goes in at B's deskClient as the desk's call. What the desk publishes
// for the node's pages (jobs.update) and what it sends B's deskClient's streamListener are both written down (box v43).
const toPages = [];
const toB = [];
const andysNode = pretendNode(function (to, ask) {
  if (to !== B_KEY) return null;
  const sl = ask.body && ask.body.deskClient && ask.body.deskClient.streamListener;
  if (sl) { try { toB.push(JSON.parse(sl.json)); } catch (e) { /* not a row */ } }
  return test.peerAnswer(client, ask.body, DESK_AT_B).then(function (r) { return { from: B_KEY, body: r && r.body }; });
}, function (app) { toPages.push(app); });
// AGENT B'S NODE: what its deskClient posts goes into the desk as B's own ask, counted by verb.
const asks = [];
const agentsNode = pretendNode(function (to, ask) {
  const desk = (ask.body && ask.body.desk) || {};
  asks.push(Object.keys(desk)[0] || '');
  return test.peerAnswer(client, ask && ask.body, B_AT_DESK).then(function (r) { return { from: DESK_KEY, body: r && r.body }; });
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function startDesk(andysUrl) {
  deskKid = spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: andysUrl + '/' }),
  });
  kids.push(deskKid);
  return up('desk');
}
function stopDesk() { return new Promise(function (r) { const k = deskKid; deskKid = null; if (!k || k.exitCode !== null) return r(); k.once('exit', r); k.kill(); setTimeout(r, 4000); }); }
// The agent's wait, cut off after ms: the lines it ended with, or null.
async function waitFor(ms) {
  const r = await Promise.race([call('deskClient', 'next', {}, B_OWNER), sleep(ms).then(function () { return null; })]);
  return r && r.body && Array.isArray(r.body.lines) ? r.body.lines : null;
}
const changesAsked = function () { return asks.filter(function (v) { return v === 'changes'; }).length; };

async function main() {
  await new Promise(function (r) { andysNode.server.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { agentsNode.server.listen(0, '127.0.0.1', r); });
  const andysUrl = 'http://127.0.0.1:' + andysNode.server.address().port;
  const agentsUrl = 'http://127.0.0.1:' + agentsNode.server.address().port;
  // The world (goal/G33.7: session.set went): seeded before the desk starts, which takes it in at start.
  test.seedDesk(deskState, { goal: { id: 'goal/G100', title: 'Pushed' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }] });
  if (!await startDesk(andysUrl)) { test.fail('the world: the desk did not start'); return; }
  kids.push(spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'wsl-claude', publicKey: B_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: agentsUrl + '/' }),
  }));
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, B_OWNER);
  // Its first wait makes the agent known at the desk; whatever it ends with, it is not what is asserted.
  await waitFor(15000);

  test.subHeading('1. his new line reaches the agent, with no changes ask');
  const waiting = waitFor(15000);
  await sleep(500);
  await call('desk', 'chat.add', { id: 'goal/G100.1', text: 'andy push one' }, ANDY);
  const got1 = await waiting;
  if (got1 && got1.some(function (l) { return String(l).indexOf('andy push one') !== -1; }) && changesAsked() === 0) test.check('the wait ended with his line, and deskClient asked the desk no changes');
  else test.fail(OWED + 'the wait ended with ' + short(got1) + '; deskClient asked ' + short(asks));

  // ── THE PURPOSE (box v37): "the underlying data-sharing 1) puts less of a load on the desk server and 2) puts
  // up-to-date information at the agents/deskClients fingertips, without constantly waking agents to read irrelevant
  // messages, or to just keep up with what's going on".
  test.subHeading('3. load: an idle deskClient whose agent waits asks the desk nothing');
  await sleep(1000);
  const quietFrom = asks.length;
  const quiet = await waitFor(15000);
  // Its word that it listens again (agent.state, goal/G2.3: said on the change only) is the one write a wait after a
  // hand-over makes; it is what the List shows of the agent, not a read, so it is not counted as load.
  const quietAsks = asks.slice(quietFrom).filter(function (v) { return v !== 'agent.state'; });
  if ((quiet === null || !quiet.length) && quietAsks.length === 0) test.check('a whole quiet wait of its agent: it ended with nothing, and no ask reached the desk');
  else test.fail(OWED + 'over a quiet wait deskClient asked the desk ' + short(quietAsks) + ' (the wait ended with ' + short(quiet) + ')');

  // goal/G33.4 (box v46). Andy: "maybe a new deskClient connect should start a stream-push of the goal, and the items, the
  // box and other parts will come when needed and stay". So the push brings the goal and its items' facts; an item's
  // box and chat are each read from the desk once, when first needed, and then answered from what deskClient keeps,
  // which the push keeps current.
  test.subHeading('4. fingertips: the facts come with the push; a part is read once when needed, then kept and kept current');
  const added = await test.deskSession(function (v, a, c) { return call('desk', v, a, c); }, { goal: { id: 'goal/G100', title: 'Pushed' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Others', blocks: ['goal/G100'] }] }, ANDY);
  if (!added.ok) { test.fail('the world: ' + added.why); return; }
  await call('desk', 'box.write', { id: 'goal/G100.2', text: 'THE FIRST BOX', version: 0 }, ANDY);
  await sleep(1500);
  const readOf = function (v) { return call('deskClient', 'desk', { name: v, json: JSON.stringify({ id: 'goal/G100.2' }) }, B_OWNER); };
  const getFrom = asks.length;
  const facts = await readOf('item.get');
  const getAsks = asks.slice(getFrom);
  if (facts.status === 200 && getAsks.length === 0) test.check('item.get of a current-goal item it does not hold: the facts the push brought, no desk ask');
  else test.fail(OWED + 'item.get answered ' + facts.status + ' and asked the desk ' + short(getAsks));
  const firstFrom = asks.length;
  const box1 = await readOf('item.box');
  const chat1 = await readOf('item.chat');
  const firstAsks = asks.slice(firstFrom);
  const againFrom = asks.length;
  const box2 = await readOf('item.box');
  const chat2 = await readOf('item.chat');
  const againAsks = asks.slice(againFrom);
  if (box1.status === 200 && (box1.body || {}).box === 'THE FIRST BOX' && chat1.status === 200 && firstAsks.join() === 'item.box,item.chat' && (box2.body || {}).box === 'THE FIRST BOX' && chat2.status === 200 && againAsks.length === 0) test.check('its box and chat were each read from the desk once, when first needed, and answered from what it keeps after');
  else test.fail(OWED + 'the first reads asked the desk ' + short(firstAsks) + ' (box ' + short(box1.body) + '), the second ' + short(againAsks) + ' (box ' + short(box2.body) + ')');
  await call('desk', 'box.write', { id: 'goal/G100.2', text: 'THE SECOND BOX', version: 1 }, ANDY);
  await sleep(1500);
  const pushedFrom = asks.length;
  const box3 = await readOf('item.box');
  if ((box3.body || {}).box === 'THE SECOND BOX' && asks.length === pushedFrom) test.check('his box write since came with the push: the kept box reads the new text, no desk ask');
  else test.fail(OWED + 'after his box write the read answered ' + short(box3.body) + ' and asked ' + short(asks.slice(pushedFrom)));

  // goal/G33.7 (box v9, found live at G33.7's Go: "the agent was not woken"): a Go, a job offered to an agent, is meant
  // for that agent and wakes it like a line addressed to it.
  test.subHeading('4b. his Go on a code item wakes the waiting agent with the job');
  const jobItem = await call('desk', 'item.add', { goal: 'goal/G100', title: 'A job' }, ANDY);
  const jobId = String((jobItem.body || {}).id || '');
  // A new item is a code item already; code is a toggle, so it is not pressed here.
  await call('desk', 'press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  await waitFor(15000);
  const jobWait = waitFor(15000);
  await sleep(1000);
  const goAt = Date.now();
  const go = await call('desk', 'press', { id: jobId, what: 'go' }, ANDY);
  const jobLines = await jobWait;
  const jobMs = Date.now() - goAt;
  if (go.status === 200 && jobLines && jobLines.some(function (l) { return String(l).indexOf('JOB ' + jobId) === 0; }) && jobMs < 8000) test.check('his Go on ' + jobId + ' ended the agent\'s wait with its job, ' + jobMs + ' ms after');
  else test.fail(OWED + 'his Go on ' + short(jobId) + ' answered ' + go.status + ' ' + short(go.body) + '; the wait ended with ' + short(jobLines) + ' after ' + jobMs + ' ms');
  // A third agent takes the red phase, so no job is open to this one and its next waits start quiet again.
  await call('desk', 'phase.take', { id: jobId, phase: 'red' }, { key: 'MCowBQYDK2VwAyEAdeskClientPushTestAgentCCCCCCCCCCCCCCCCCCCC=', label: 'third' });

  test.subHeading('5. no needless waking: chat between Andy and another agent on its item does not end the wait');
  await call('desk', 'item.take', { id: 'goal/G100.2' }, A_AT_DESK);
  const notMine = waitFor(15000);
  await sleep(500);
  await call('desk', 'chat.add', { id: 'goal/G100.2', text: 'andy to the one holding it' }, ANDY);
  await call('desk', 'chat.add', { id: 'goal/G100.2', text: 'the other agent answers' }, A_AT_DESK);
  const woke = await notMine;
  if (woke === null || !woke.length) test.check('his line and the other agent\'s answer on an item it does not hold left its wait running');
  else test.fail(OWED + 'its wait ended with ' + short(woke));

  test.subHeading('6. deskClient calls the desk through the family interface');
  const code = fs.readFileSync(CLIENT, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const handRolled = /\{\s*desk\s*:\s*\{/.test(code);
  const family = /forNode|family\s*:\s*['"]desk['"]/.test(code);
  if (!handRolled && family) test.check('no hand-built {desk: {verb: args}} in deskClient.js, and it reaches the desk family by its interface');
  else test.fail(OWED + 'deskClient.js ' + (handRolled ? 'builds {desk: {...}} by hand' : 'builds no desk packet') + (family ? '' : ', and names no family interface'));
  const translator = fs.readFileSync(path.join(RUN, 'shell', 'js', 'desk', 'data.js'), 'utf8');
  if (!/\{\s*desk\s*:\s*\{/.test(translator) && !/new Map\(|Object\.create\(null\)/.test(translator)) test.check('the translator (shell/js/desk/data.js) builds no packet and keeps no cache of its own beside spirit.data');
  else test.fail(OWED + 'shell/js/desk/data.js builds a desk packet or keeps a cache of its own');

  // ── ONE PUBLISH (box v43, Andy: "the desk server publishes its changes to the browser with the same function that it
  // publishes its changes to the deskClients").
  test.subHeading('7. one publish per changed row reaches the node\'s pages and the following deskClient alike');
  await sleep(1000);
  const pagesFrom = toPages.length;
  const bFrom = toB.length;
  await call('desk', 'chat.add', { id: 'goal/G100.1', text: 'andy one publish' }, ANDY);
  await sleep(2500);
  const isIt = function (o) { return o && o.table === 'chat' && o.row && String(o.row.text).indexOf('andy one publish') !== -1; };
  const onPages = toPages.slice(pagesFrom).filter(isIt);
  const onB = toB.slice(bFrom).filter(isIt);
  if (onPages.length === 1 && onB.length === 1 && JSON.stringify(onPages[0]) === JSON.stringify(onB[0])) test.check('his line\'s chat row went once to the pages and once to B\'s deskClient, the same object');
  else test.fail(OWED + 'the chat row went ' + onPages.length + ' time(s) to the pages and ' + onB.length + ' to B\'s deskClient: ' + short(onPages.concat(onB)));
  const deskCode = fs.readFileSync(DESK, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const second = ['jobs.publish(', 'peerPost(', 'forPeer(', 'streamListener'].filter(function (w) { return deskCode.indexOf(w) !== -1; });
  if (/appServer\.publish\(/.test(deskCode) && !second.length) test.check('desk.js publishes through appServer.publish alone: no jobs.publish, peerPost or forPeer of its own');
  else test.fail(OWED + 'desk.js has a second send path: ' + short(second));
  // His line is the agent's; the next wait hands it over at once, so section 2 starts with nothing waiting.
  await waitFor(15000);

  // ── THE DESK FOLLOWS NO STREAM (box v42, Andy: "no stream listening on the desk server!").
  test.subHeading('8. the desk follows no stream and refuses a streamListener row');
  const sent = await call('desk', 'streamListener', { json: JSON.stringify({ change: 1, table: 'chat', id: 'goal/G100.1', row: { text: 'x' } }) }, B_AT_DESK);
  const deskApi = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'api.js'), 'utf8');
  const follows = /\bstream\s*:/.test(deskCode) || /\.follow\(/.test(deskCode) || /streamListener/.test(deskApi);
  if (sent.status !== 200 && !follows) test.check('a streamListener row sent to the desk is refused (' + sent.status + '), and the desk names no stream to follow');
  else test.fail(OWED + 'the desk answered a streamListener row ' + sent.status + (follows ? ', and desk.js or its interface names a stream to follow' : ''));

  test.subHeading('2. after the desk restarts, the same');
  await stopDesk();
  const restartFrom = toB.length;
  if (!await startDesk(andysUrl)) { test.fail('the world: the desk did not start again'); return; }
  await sleep(1500);
  // goal/G33.4 (box v46): what a desk start pushes is the goal and its items' facts, never their parts.
  const restartRows = toB.slice(restartFrom);
  const parts = restartRows.filter(function (o) { return o && o.table; });
  if (restartRows.some(function (o) { return o && o.verb === 'goal.whole'; }) && !parts.length) test.check('the desk\'s start pushed the current goal\'s facts (' + restartRows.length + ' rows) and no box, chat, check or file row');
  else test.fail(OWED + 'the desk\'s start pushed ' + restartRows.length + ' rows, ' + parts.length + ' of them parts: ' + short(parts.map(function (o) { return o.table + ' ' + o.id; })));
  const waiting2 = waitFor(15000);
  await sleep(500);
  await call('desk', 'chat.add', { id: 'goal/G100.1', text: 'andy push two' }, ANDY);
  const got2 = await waiting2;
  if (got2 && got2.some(function (l) { return String(l).indexOf('andy push two') !== -1; }) && changesAsked() === 0) test.check('after the restart his next line reached the agent too, with no changes ask');
  else test.fail(OWED + 'after the restart the wait ended with ' + short(got2) + '; deskClient asked ' + short(asks));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { if (k.exitCode === null) k.kill(); } catch (e) { /* gone */ } });
  [andysNode, agentsNode].forEach(function (n) {
    n.streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
    try { n.server.close(); } catch (e) { /* closed */ }
  });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
