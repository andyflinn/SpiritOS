'use strict';

// goal/G3.5: the desk server nudges deskClient, server to server. Red on today's tree: the desk server posts to
// nobody (the Desk page sends the nudge, after a press, and needs to be open), and deskClient has no verb changed.
//   Andy, 2026-10-02 (goal/G3.1): "so the desk server would nudge the deskClient server?", then "accepted." to
//   the proposal that holds it; "you both chose verb name and all"; "a guarantee that no core modules are touched.
//   this is a agent/user appclication". His Go on this item is his go-all on goal/G3 in Desk.
// The contract the builder follows (the box of goal/G3.5; the names are the agents', as he left them to us):
//   1. deskClient gains the verb changed {} -> {heard}. It is the desk's alone: a caller whose key is not the key
//      setDesk named is refused not-granted. (A node's own door lets the desk's key in only once that node's
//      owner granted it deskClient.changed; that door is the node's, apiDoor.js, and is not this suite's.)
//   2. The desk server posts the nudge itself, through the kernel: one api packet {deskClient: {changed: {}}} to
//      the node of each live agent it is meant for (the keys it already holds, desk.js agentKey), with no page
//      open. Meant for:
//        - a record of Andy's (his press, his chat, any write of his): every live agent. Not his seen presses,
//          which no agent is handed.
//        - an agent's chat line: every OTHER live agent, never the one who wrote it.
//        - a line of Andy's that Desk keeps (log.add, from andy, with the peer it was for): that peer, when it is
//          a live agent's key, and nobody else.
//      Nothing else nudges: not an agent's agent.state (listening, working), which would wake every other agent
//      at every wait.
//   3. The write that caused the nudge is not held by it: it answers as before, whether or not any agent's node
//      answers the nudge.
//   4. A nudge with nobody waiting asks nothing (goal/G3.4: nobody waiting, nothing asked), and is remembered: the
//      next wait on next asks the desk at once, though pollMs has not passed.
//   5. A nudge while its agent waits on next makes deskClient ask the desk at once, and the wait ends with the
//      line: within a second of the write, where pollMs alone would have kept it waiting.
//   6. The desk server still asks through the kernel alone: no fetch, no http in its code.
// Proven live: a real desk server on a pretend node of Andy's, a real deskClient on a pretend node of an agent's,
// the two nodes handing each other's posts over as a relay and the agent node's door would.
// Not asserted, the builder's: whether the desk server waits for the nudge's answer or not, and how long; what a
// nudge looks like in deskClient's history; a nudge to an agent that is no longer live.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G3.5: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
// A poll no wait in this suite can reach: whatever makes deskClient ask after its first run is the nudge.
const POLL_MS = 60000;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Andy's node (it runs the desk), agent B's node (it runs the deskClient under test), and agent A, who has a key
// at the desk and no node here: a post to A is taken and never answered.
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskNudgeTestDeskNodeAAAAAAAAAAAAAAAAA=';
const A_KEY = 'MCowBQYDK2VwAyEAdeskNudgeTestAgentAAAAAAAAAAAAAAAAAAAA=';
const B_KEY = 'MCowBQYDK2VwAyEAdeskNudgeTestAgentBBBBBBBBBBBBBBBBBBBB=';
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };
const A_AT_DESK = { key: A_KEY, label: 'claude-windows' };
const B_AT_DESK = { key: B_KEY, label: 'wsl-claude' };
const B_OWNER = { owner: true, key: B_KEY, label: 'wsl-claude' };
const DESK_AT_B = { key: DESK_KEY, label: 'Andy Flinn' };
const MEMBER_AT_B = { key: 'MCowBQYDK2VwAyEAdeskNudgeTestMemberAAAAAAAAAAAAAAAAAA=', label: 'somebody' };

test.startTest('goal/G3.5: the desk server nudges deskClient, server to server');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desknudge-'));
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

// A PRETEND NODE: an event stream, and peer.post handed to `deliver`, which says what the peer answered (or
// nothing, for a peer that never answers); the answer comes back down the stream by re, as a relay brings it.
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
      if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
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

// ANDY'S NODE. What the desk server posts: every nudge is kept; one for B goes in at B's deskClient as the desk's
// call, as B's node would hand it over once granted; one for A is taken and never answered.
const nudges = [];   // { to, app, body, at }
const andysNode = pretendNode(function (to, ask) {
  nudges.push({ to: to, app: ask.app, body: ask.body, at: Date.now() });
  if (to !== B_KEY) return null;
  return client.ask(ask.body, DESK_AT_B).then(function (r) { return { from: B_KEY, body: r && r.body }; });
});
// AGENT B'S NODE. What its deskClient posts goes into the desk server as B's own ask.
const asks = [];     // { verb, at }
const agentsNode = pretendNode(function (to, ask) {
  const desk = (ask.body && ask.body.desk) || {};
  asks.push({ verb: Object.keys(desk)[0] || '', at: Date.now() });
  return client.ask({ desk: desk }, B_AT_DESK).then(function (r) { return { from: DESK_KEY, body: r && r.body }; });
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
async function next() {
  const t0 = Date.now();
  const r = await call('deskClient', 'next', {}, B_OWNER);
  return { lines: (r.body && Array.isArray(r.body.lines)) ? r.body.lines : null, ms: Date.now() - t0, body: r.body, endedAt: Date.now() };
}
const said = function (text) { return function (l) { return String(l).indexOf(text) !== -1; }; };
const isNudge = function (p) { return p.app === 'api' && JSON.stringify(p.body) === JSON.stringify({ deskClient: { changed: {} } }); };
const to = function (key) { return nudges.filter(function (p) { return p.to === key && isNudge(p); }).length; };
// One write at the desk, timed, then a moment for its nudges to leave: { status, ms, a, b } — the nudges it sent
// to A and to B.
async function writes(app, verb, args, caller) {
  nudges.length = 0;
  const t0 = Date.now();
  const r = await call(app, verb, args, caller);
  const ms = Date.now() - t0;
  await sleep(700);
  return { status: r.status, ms: ms, a: to(A_KEY), b: to(B_KEY), odd: nudges.filter(function (p) { return !isNudge(p); }).length, body: r.body };
}

async function main() {
  await new Promise(function (r) { andysNode.server.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { agentsNode.server.listen(0, '127.0.0.1', r); });
  const andysUrl = 'http://127.0.0.1:' + andysNode.server.address().port;
  const agentsUrl = 'http://127.0.0.1:' + agentsNode.server.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: andysUrl + '/' }),
  }));
  await up('desk');
  const set = await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'n/G1', title: 'Nudged' }, items: [{ id: 'n/G1.1', title: 'A', blocks: ['n/G1'] }] }) }, A_AT_DESK);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  kids.push(spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'wsl-claude', publicKey: B_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: agentsUrl + '/' }),
  }));

  test.subHeading('1. deskClient hears changed, from the desk alone');
  const tree = await up('deskClient') || {};
  if (JSON.stringify(tree.changed || null) !== JSON.stringify({ request: {}, reply: { heard: true } })) {
    test.fail(OWED + 'the api answered changed ' + JSON.stringify(tree.changed || null) + ', where {request: {}, reply: {heard: true}} is owed');
    ['2. the desk server posts the nudge, to whom it is meant for', '3. the write is not held by its nudge', '4. a nudge with nobody waiting is remembered',
      '5. a nudge while its agent waits ends the wait', '6. the desk server asks through the kernel alone'].forEach(function (what) { test.fail(OWED + what + ': deskClient has no verb changed to nudge'); });
    return;
  }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, B_OWNER);
  const theirs = await call('deskClient', 'changed', {}, MEMBER_AT_B);
  const desks = await call('deskClient', 'changed', {}, DESK_AT_B);
  if ((theirs.body || {}).code === 'not-granted' && desks.status === 200 && (desks.body || {}).heard === true) test.check('changed {} -> {heard}: taken from the desk\'s key, refused not-granted to another member');
  else test.fail(OWED + 'changed answered a member ' + JSON.stringify(theirs.body) + ', the desk ' + desks.status + ' ' + JSON.stringify(desks.body));

  // Both agents become live at the desk: A by a write of its own, B by its deskClient's first wait, which finds
  // "now" and says listening. Nothing new is at the desk, so that wait ends empty.
  await call('desk', 'agent.state', { word: 'listening' }, A_AT_DESK);
  const first = await next();
  if (!first.lines || first.lines.length) { test.fail(OWED + 'the first wait should end empty and answered ' + JSON.stringify(first.body).slice(0, 200)); return; }

  test.subHeading('2. the desk server posts the nudge, to whom it is meant for; 3. the write is not held by it');
  asks.length = 0;
  const chat = await writes('desk', 'chat.add', { id: 'n/G1.1', text: 'andy chat one' }, ANDY);
  const askedMeanwhile = asks.filter(function (x) { return x.verb === 'changes'; }).length;
  if (chat.status === 200 && chat.a === 1 && chat.b === 1 && !chat.odd) test.check('Andy\'s chat: one nudge to each live agent\'s node, {deskClient: {changed: {}}} in an api packet');
  else test.fail(OWED + 'Andy\'s chat sent ' + chat.a + ' nudge(s) to A and ' + chat.b + ' to B, ' + chat.odd + ' other post(s): ' + JSON.stringify(nudges).slice(0, 240));
  if (chat.status === 200 && chat.ms < 1500) test.check('the write answered in ' + chat.ms + ' ms, though A\'s node never answers its nudge');
  else test.fail(OWED + 'the write answered ' + chat.status + ' after ' + chat.ms + ' ms');

  test.subHeading('4. a nudge with nobody waiting asks nothing, and is remembered');
  const held = await next();
  if (chat.b === 1 && askedMeanwhile === 0 && held.lines && held.lines.length === 1 && said('andy chat one')(held.lines[0]) && held.ms < 1500) {
    test.check('nobody waited, so nothing was asked; the next wait asked at once and handed the chat over after ' + held.ms + ' ms');
  } else test.fail(OWED + 'with nobody waiting deskClient asked ' + askedMeanwhile + ' time(s); the next wait answered ' + JSON.stringify(held.body).slice(0, 200) + ' after ' + held.ms + ' ms');

  test.subHeading('5. a nudge while its agent waits ends the wait');
  const waiting = next();
  await sleep(600);
  const wroteAt = Date.now();
  await call('desk', 'chat.add', { id: 'n/G1.1', text: 'andy chat two' }, ANDY);
  const woke = await waiting;
  const after = woke.endedAt - wroteAt;
  if (woke.lines && woke.lines.length === 1 && said('andy chat two')(woke.lines[0]) && after < 1500) test.check('the wait ended ' + after + ' ms after the write, with the chat');
  else test.fail(OWED + 'the wait answered ' + JSON.stringify(woke.body).slice(0, 200) + ', ' + after + ' ms after the write');

  test.subHeading('2 again: who is nudged for what');
  const others = await writes('desk', 'chat.add', { id: 'n/G1.1', text: 'chat of agent A' }, A_AT_DESK);
  if (others.status === 200 && others.b === 1 && others.a === 0) test.check('an agent\'s chat nudges the other live agent, never the one who wrote it');
  else test.fail(OWED + 'A\'s chat sent ' + others.a + ' nudge(s) to A and ' + others.b + ' to B');
  const seen = await writes('desk', 'press', { id: 'n/G1.1', what: 'seen' }, ANDY);
  const word = await writes('desk', 'agent.state', { word: 'working' }, A_AT_DESK);
  if (seen.status === 200 && word.status === 200 && seen.a + seen.b + word.a + word.b === 0) test.check('his seen press nudges nobody, and neither does an agent\'s listening or working');
  else test.fail(OWED + 'his seen press sent ' + (seen.a + seen.b) + ' nudge(s), an agent\'s working ' + (word.a + word.b));
  const press = await writes('desk', 'press', { id: 'n/G1', what: 'end-design' }, ANDY);
  if (press.status === 200 && press.a === 1 && press.b === 1) test.check('a press of Andy\'s nudges every live agent');
  else test.fail(OWED + 'his end-design press sent ' + press.a + ' nudge(s) to A and ' + press.b + ' to B');
  const line = await writes('desk', 'log.add', { json: JSON.stringify({ key: 'n-1', at: new Date().toISOString(), dir: 'out', from: 'andy', kind: 'note', peer: B_KEY, text: 'line of andy for B' }) }, ANDY);
  if (line.status === 200 && line.b === 1 && line.a === 0) test.check('a line of Andy\'s that Desk keeps nudges the agent it was for, and nobody else');
  else test.fail(OWED + 'his line for B sent ' + line.a + ' nudge(s) to A and ' + line.b + ' to B: ' + JSON.stringify(line.body).slice(0, 120));

  test.subHeading('6. the desk server asks through the kernel alone');
  const code = fs.readFileSync(DESK, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const reaches = [/\bfetch\s*\(/, /require\(\s*['"](node:)?https?['"]\s*\)/].filter(function (re) { return re.test(code); });
  if (/kernel\.js/.test(code) && /peerPost|peer\.post/.test(code) && !reaches.length) test.check('desk.js posts through the kernel; no fetch, no http');
  else test.fail(OWED + 'desk.js ' + (/peerPost|peer\.post/.test(code) ? 'posts through the kernel' : 'does not post through the kernel') + ' and holds ' + reaches.map(String).join(', '));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
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
