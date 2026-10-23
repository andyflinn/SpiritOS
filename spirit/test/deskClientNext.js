'use strict';

// goal/G3.4: deskClient keeps the place and holds what is meant for its agent. Red on today's tree: deskClient
// (goal/G3.3) passes an ask and counts it, and has no verb next.
//   Andy, 2026-10-02 (goal/G3.1): "i am ready to accept completely alternative design, if it achieves what todays
//   deskAgentEar does, and statistics are kept somewhere you can access them easily.", and of the polls that bring
//   nothing: "empty polls can contribute statistically and discarded." His Go on this item is his press in Desk.
// SINCE goal/G33.4 THE DESK'S STREAM REPLACES THE POLL (Andy, on `changes`: "isn't that what this item does? implement
// the push/broadcast concept?"): deskClient never asks the desk what changed; the desk streams each changed row to it
// (appServer.publish to its streamListener), and what is meant for its agent is chosen from those rows (box v37: "without
// constantly waking agents to read irrelevant messages"). Desk's kept lines (log.add) went with the same goal. So this
// suite runs the desk on a pretend node of Andy's that hands its posts to deskClient, as deskClientPush.js does.
// The contract the builder follows (the box of goal/G3.4, as goal/G33.4 left it):
//   1. deskClient.json declares historyMax, a number. The node hands its value to the server as its first argument
//      (jobs.js), so this suite hands it a small one.
//   2. Verb next {} -> {lines: ['']}, the owner's alone (a member is refused not-owner); before setDesk it is
//      refused no-such-peer, as desk is.
//   3. With nothing meant for its agent the wait answers {lines: []} within 10 s (a node gives a server 12 s,
//      appClient.js DOOR_WAIT_MS), and no `changes` ask ever leaves it.
//   4. A first run starts at now: what the desk already holds is not handed over.
//   5. What is meant for its agent: Andy's line on the item it holds or on an item nobody holds ('DESK andy chat.add
//      <body>'), another agent's line on the item it holds; never its own line, his seen press, or chat between him
//      and another agent on an item that agent holds.
//   6. Each thing is handed over once, and a restart misses nothing written while it was down.
//   7. It tells Desk listening (agent.state) when its agent starts to wait, and working when it hands lines over.
//   8. No poll is left: its history holds no `changes` record.
//   9. The record of asks is bounded: the newest historyMax rows are kept, the oldest fall off.
// Not asserted, the builder's: whether a line waits in memory or on disk between the row that brought it and the next
// that hands it over; the desk's own busy replies (by 'desk'); what the listening and working posts look like in history.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G3.4: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const MANIFEST = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.json');
const HISTORY_MAX = 8;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// The agent this deskClient serves (the owner of its node), the other agent, a member of the agent's node, and
// Andy at his own desk. Keys of a real key's length: the spirit object checks them (face/spirit.js).
const SELF_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestSelfAAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestOtherAAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestDeskNodeAAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const MEMBER = { key: 'MCowBQYDK2VwAyEAdeskClientNextTestMemberAAAAAAAAAAAAAAAAAAA=', label: 'somebody' };
// At the desk the agent goes by the label Andy's node holds for its key, which he may change (auth.relabel):
// not the name of its own node. So its own lines are known by their key.
const SELF_AT_DESK = { key: SELF_KEY, label: 'renamed-at-the-desk' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };
const DESK_AT_SELF = { key: DESK_KEY, label: 'Andy Flinn' };

test.startTest('goal/G3.4: deskClient keeps the place and holds what is meant for its agent');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclient-next-'));
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

// A PRETEND NODE: an event stream, the family interfaces, and every peer.post handed to `deliver`, its answer coming
// back down the event stream by re, as a relay would bring it.
function pretendNode(deliver) {
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
      { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
      if (b.verb === 'jobs.update' || b.verb === 'auth.grant') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
      // goal/G3.9 (rule 1): deskClient asks its node whether every other agent is blocked here; this node blocks all.
      if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
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
// THE AGENT'S NODE: what its deskClient posts goes into the real desk as the agent's own ask, each one written down.
const posts = [];   // every peer.post it was handed: { to, app, verb, args }
const agentsNode = pretendNode(function (to, ask) {
  const desk = (ask.body && ask.body.desk) || {};
  const verb = Object.keys(desk)[0] || '';
  posts.push({ to: to, app: ask.app, verb: verb, args: desk[verb] });
  return test.peerAnswer(client, ask.body, SELF_AT_DESK).then(function (r) { return { from: DESK_KEY, body: r && r.body }; });
});
// ANDY'S NODE: what the desk posts to the agent's node (its stream) goes in at deskClient as the desk's call; a post to
// any other node (the other agent's) reaches nobody.
const andysNode = pretendNode(function (to, ask) {
  if (to !== SELF_KEY) return null;
  return test.peerAnswer(client, ask.body, DESK_AT_SELF).then(function (r) { return { from: SELF_KEY, body: r && r.body }; });
});

function startClient(nodeUrl) {
  const kid = spawn(process.execPath, [CLIENT, JSON.stringify({ historyMax: HISTORY_MAX }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
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
async function history() {
  const r = await call('deskClient', 'history.search', { text: '' }, OWNER);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  return items.map(function (p) { let l = {}; try { l = JSON.parse(p.label); } catch (e) { l = {}; } return { key: p.key, row: l }; });
}
// One next, timed: { status, code, lines, ms }.
async function next(caller) {
  const t0 = Date.now();
  const r = await call('deskClient', 'next', {}, caller || OWNER);
  const lines = (r.body && Array.isArray(r.body.lines)) ? r.body.lines : null;
  return { status: r.status, code: (r.body || {}).code, lines: lines, ms: Date.now() - t0, body: r.body };
}
const said = function (text) { return function (l) { return String(l).indexOf(text) !== -1; }; };
const andySays = function (text, id) { return call('desk', 'chat.add', { id: id || 'goal/G100.1', text: text }, ANDY); };
const changesAsked = function () { return posts.filter(function (p) { return p.verb === 'changes'; }).length; };

async function main() {
  test.subHeading('1. the manifest declares historyMax');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  const argOf = function (name) { return ((manifest && manifest.args) || []).filter(function (a) { return a && a.name === name; })[0]; };
  const maxArg = argOf('historyMax');
  if (maxArg && typeof maxArg.default === 'number' && maxArg.default > 0) test.check('deskClient.json: historyMax defaults to ' + maxArg.default);
  else test.fail(OWED + 'deskClient.json declares args ' + JSON.stringify(manifest && manifest.args));

  await new Promise(function (r) { agentsNode.server.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { andysNode.server.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + agentsNode.server.address().port;
  const andysUrl = 'http://127.0.0.1:' + andysNode.server.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: andysUrl + '/' }),
  }));
  await up('desk');
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  const set = await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Heard' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'B', blocks: ['goal/G100'] }] }) }, ANDY);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  // What the desk holds before deskClient ever runs: a first run must not hand it over.
  await andySays('old chat, before the first run');
  let kid = startClient(nodeUrl);

  test.subHeading('2. the verb next, the owner\'s alone');
  const tree = await up('deskClient') || {};
  if (JSON.stringify(tree.next || null) !== JSON.stringify({ request: {}, reply: { lines: [''] } })) {
    test.fail(OWED + 'the api answered next ' + JSON.stringify(tree.next || null) + ', where {request: {}, reply: {lines: [\'\']}} is owed');
    return;
  }
  const early = await next(OWNER);
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  const theirs = await next(MEMBER);
  if (early.code === 'no-such-peer' && theirs.code === 'not-owner') test.check('next {} -> {lines}; refused no-such-peer before setDesk, and not-owner to a member');
  else test.fail(OWED + 'next answered ' + JSON.stringify(early.body) + ' before setDesk and ' + JSON.stringify(theirs.body) + ' to a member');

  test.subHeading('3. a wait that brings nothing ends within 10 s; 4. a first run starts at now');
  posts.length = 0;
  const first = await next();
  // A first wait that handed something over (4 says it should not) is followed by one more, so 3 is judged on its own.
  let quietFrom = 0;
  const second = first.lines && first.lines.length ? (quietFrom = posts.length, await next()) : first;
  if (second.status === 200 && second.lines && second.lines.length === 0 && second.ms >= 5000 && second.ms < 11500 && changesAsked() === 0) {
    test.check('with nothing new, next answered {lines: []} after ' + second.ms + ' ms, and asked the desk no changes');
  } else test.fail(OWED + 'a wait with nothing new answered ' + second.status + ' ' + JSON.stringify(second.body).slice(0, 200) + ' after ' + second.ms + ' ms; changes asked ' + changesAsked());
  const handedOld = [first, second].some(function (w) { return w.lines && w.lines.some(said('before the first run')); });
  if (!handedOld) test.check('what the desk held before the first run was not handed over');
  else test.fail(OWED + 'the first run handed over what the desk held before it: ' + JSON.stringify(first.lines).slice(0, 240));

  test.subHeading('7. listening when its agent waits, working when it hands lines over');
  const wordsSoFar = posts.slice(quietFrom).filter(function (p) { return p.verb === 'agent.state'; }).map(function (p) { return p.args && p.args.word; });
  const waiting = next();
  await sleep(500);
  posts.length = 0;
  // Under goal/G100.2, which nobody holds: his line is meant for every agent, taken first (goal/G27.12, reopened).
  await andySays('new chat one', 'goal/G100.2');
  const one = await waiting;
  await sleep(300);
  const wordsAtHandOver = posts.filter(function (p) { return p.verb === 'agent.state'; }).map(function (p) { return p.args && p.args.word; });
  if (wordsSoFar.indexOf('listening') !== -1 && wordsSoFar.indexOf('working') === -1 && wordsAtHandOver.indexOf('working') !== -1) test.check('it said listening as the wait began, and working as it handed a line over');
  else test.fail(OWED + 'agent.state went ' + JSON.stringify(wordsSoFar) + ' during the empty wait and ' + JSON.stringify(wordsAtHandOver) + ' at the hand-over');

  test.subHeading('5. what is meant for its agent');
  if (one.lines && one.lines.length === 1 && one.lines[0].indexOf('DESK andy chat.add ') === 0 && said('new chat one')(one.lines[0]) && one.ms < 5000) {
    test.check('Andy\'s line on an item nobody holds came out of next after ' + one.ms + ' ms: ' + one.lines[0].slice(0, 60));
  } else test.fail(OWED + 'after Andy\'s line next answered ' + JSON.stringify(one.body).slice(0, 240) + ' after ' + one.ms + ' ms');
  // Not meant for it: his seen press, chat between him and the other agent on the item that agent holds, its own line.
  await call('desk', 'press', { id: 'goal/G100.1', what: 'seen' }, ANDY);
  await call('desk', 'item.take', { id: 'goal/G100.2' }, OTHER_AT_DESK);
  await andySays('andy to the holder', 'goal/G100.2');
  await call('desk', 'chat.add', { id: 'goal/G100.2', text: 'chat of the other agent' }, OTHER_AT_DESK);
  await call('desk', 'item.release', { id: 'goal/G100.2' }, OTHER_AT_DESK);
  // Meant for it: on the item it holds, his line and the other agent's.
  await call('desk', 'item.take', { id: 'goal/G100.1' }, SELF_AT_DESK);
  await call('desk', 'chat.add', { id: 'goal/G100.1', text: 'chat of my own' }, SELF_AT_DESK);
  await andySays('andy on my item', 'goal/G100.1');
  await sleep(1500);
  const many = await next();
  const got = many.lines || [];
  const wanted = [function (l) { return l.indexOf('DESK andy chat.add ') === 0 && said('andy on my item')(l); }];
  const missing = wanted.filter(function (fits) { return !got.some(fits); }).length;
  const unwanted = ['"seen"', 'andy to the holder', 'chat of the other agent', 'chat of my own', 'new chat one'].filter(function (t) { return got.some(said(t)); });
  if (got.length === 1 && !missing && !unwanted.length) test.check('his line on the item it holds came out; his seen press, chat on the item the other agent held, and its own line did not');
  else test.fail(OWED + 'next handed over ' + got.length + ' line(s), ' + missing + ' wanted missing, unwanted ' + JSON.stringify(unwanted) + ': ' + JSON.stringify(got).slice(0, 400));

  test.subHeading('6. once, across a restart: nothing missed, nothing repeated');
  kid.kill();
  await sleep(500);
  await andySays('chat while it was down', 'goal/G100.1');
  kid = startClient(nodeUrl);
  await up('deskClient');
  const back = await next();
  const backLines = (back.lines || []).concat(back.lines && back.lines.length ? [] : ((await next()).lines || []));
  const waitingLater = next();
  await sleep(500);
  await andySays('chat after the restart', 'goal/G100.1');
  const later = await waitingLater;
  const before = ['andy on my item', 'new chat one', 'before the first run'].filter(function (t) { return backLines.concat(later.lines || []).some(said(t)); });
  if (backLines.filter(said('chat while it was down')).length === 1 && later.lines && later.lines.length === 1 && said('chat after the restart')(later.lines[0]) && !before.length) {
    test.check('after a restart next handed over what was written while it was down, once, and nothing from before');
  } else test.fail(OWED + 'after the restart next answered ' + JSON.stringify(backLines).slice(0, 300) + ', then ' + JSON.stringify(later.lines).slice(0, 200));

  test.subHeading('8. no poll is left');
  const h1 = await history();
  if (h1.length && !h1.some(function (x) { return x.row.verb === 'changes'; }) && changesAsked() === 0) test.check('history holds ' + h1.length + ' record(s), none of them changes, and no changes ask left deskClient');
  else test.fail(OWED + 'goal/G33.4: history ' + JSON.stringify(h1.slice(0, 3)).slice(0, 320) + '; changes asked ' + changesAsked());

  test.subHeading('9. the record of asks is bounded');
  for (let i = 0; i < HISTORY_MAX + 3; i++) await call('deskClient', 'desk', { name: 'items.search', json: JSON.stringify({ text: 'x' + i, currentGoalOnly: false, goalsOnly: false, includeClosed: false }) }, OWNER);
  const h2 = await history();
  if (h2.length === HISTORY_MAX && h2[0].row.verb === 'items.search' && h2[0].row.outcome === 'answered') test.check('after more asks than historyMax, history holds the newest ' + HISTORY_MAX);
  else test.fail(OWED + 'history holds ' + h2.length + ' record(s) where historyMax is ' + HISTORY_MAX + ', the newest ' + JSON.stringify(h2[0] || null));

  test.subHeading('who it is comes from its node, and it still asks through the kernel alone');
  const code = fs.readFileSync(CLIENT, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const reaches = [/\bfetch\s*\(/, /require\(\s*['"](node:)?https?['"]\s*\)/, /AGENTS_[A-Z]+/, /identity\.json/].filter(function (re) { return re.test(code); });
  if (/'--node'/.test(code) && /peerPost/.test(code) && !reaches.length) test.check('deskClient.js reads --node, calls peerPost, and holds no fetch, no http, no AGENTS_ variable, no identity.json');
  else test.fail(OWED + 'deskClient.js ' + (/'--node'/.test(code) ? 'reads --node' : 'does not read --node') + ' and holds ' + reaches.map(String).join(', '));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  [agentsNode, andysNode].forEach(function (n) {
    n.streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
    try { n.server.close(); } catch (e) { /* closed */ }
  });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
