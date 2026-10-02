'use strict';

// goal/G3.3: deskClient, a server on an agent's own node, passes one ask to Andy's desk and counts it.
// Red on today's tree: there is no such server.
//   Andy, 2026-10-02 (goal/G3.1): "i am ready to accept completely alternative design, if it achieves what todays
//   deskEar does, and statistics are kept somewhere you can access them easily.", then "accepted." to the proposal
//   of a deskClient server, "you both chose verb name and all", and "a guarantee that no core modules are touched.
//   this is a agent/user appclication". His Go on this item is his press in Desk.
// The contract the builder follows (the box of goal/G3.3; the names are the agents', as he left them to us):
//   1. process/js/deskClient/deskClient.js and its manifest deskClient.json, kind server, operated by the node,
//      as desk.json is: a node that includes it starts it.
//   2. Its verbs: desk {verb, json} -> {json}; setDesk {key} -> {set}; history.search {text} -> the standard
//      search answer {items: [{key, label}], more}.
//   3. setDesk tells it the key of the node that runs Andy's desk. Only the node's owner may: a member is refused
//      not-owner. Until it is set, desk is refused no-such-peer and nothing is posted.
//   4. desk sends that ONE ask to the desk's node through the kernel (peerPost: one peer.post on its own node,
//      app api, body {desk: {verb: args}}) and answers {json}: what came back, as JSON text. A refusal of the
//      desk's ({ok: false, code}) comes back the same way: it is the desk's answer.
//   5. Every ask is recorded in its own state, <state>/deskClient.db, and history.search answers the records
//      newest first, each label the JSON of {at, verb, ms, outcome, bytes, port}: when, the desk verb, the
//      milliseconds it took, how it ended (answered: the desk said yes; refused: the desk said no), the bytes
//      of the answer, and the port of the node it went through.
//   6. A slow desk: the node gives a server 12 s (appClient.js DOOR_WAIT_MS), so desk answers within 10 s. An
//      ask not answered by then is refused no-answer ("no answer yet") with extra.id, the key of its record,
//      whose outcome is pending; deskClient keeps waiting, sends nothing twice, and the record says how it ended.
//   7. Its state outlives it: after a restart the desk's key is still set and the records are still there.
//   8. It asks through the kernel and nothing else: no fetch, no http, no AGENTS_ environment variable in its code.
// Every refusal above is a code the catalogue already has (spiritErrors.js), so no core module changes.
// Not asserted, the builder's: what a record says when the desk never answers at all; what history.search does
// with a text (the walk and the cut are searchBucket's); whether a refused-before-posting ask is recorded.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G3.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const MANIFEST = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.json');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// The agent's node's owner (the agent itself, on loopback), a member of that node, and Andy's node.
const OWNER = { owner: true, key: 'MCowBQYDK2VwAyEAdeskClientAskTestOwnerAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const MEMBER = { key: 'MCowBQYDK2VwAyEAdeskClientAskTestMemberAAAAAAAAAAAAAA=', label: 'somebody' };
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientAskTestDeskNodeAAAAAAAAAAAA=';
// Who Andy's desk sees asking: the agent, by its node's key.
const AGENT = { key: OWNER.key, label: 'wsl-claude' };

test.startTest('goal/G3.3: deskClient passes one ask to Andy\'s desk and counts it');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclient-'));
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

// THE PRETEND NODE deskClient runs on. Its peer.post goes into the real desk server as the agent's own ask, and
// the answer comes back down the event stream by re, as a relay would bring it; holdMs keeps the next answer back.
const streams = [];
const posts = [];   // every peer.post it was handed: { to, app, verb }
let holdMs = 0;
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
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const desk = (ask && ask.body && ask.body.desk) || {};
    posts.push({ to: b.to, app: ask && ask.app, verb: Object.keys(desk)[0] || '' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    const wait = holdMs;
    holdMs = 0;
    client.ask({ desk: desk }, AGENT).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      setTimeout(function () {
        streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
      }, wait);
    }, function () { /* the asker waits it out */ });
  });
});

function startClient(nodeUrl) {
  const kid = spawn(process.execPath, [CLIENT, '{}', '--pipe', clientPipe, '--state', clientState], {
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

async function main() {
  test.subHeading('1. the server and its manifest');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  if (fs.existsSync(CLIENT) && manifest && manifest.kind === 'server' && manifest.operated === 'node') {
    test.check('deskClient.js is there, and deskClient.json says kind server, operated by the node');
  } else {
    test.fail(OWED + 'process/js/deskClient/deskClient.js ' + (fs.existsSync(CLIENT) ? 'exists' : 'does not exist') + '; its manifest reads ' + JSON.stringify(manifest));
  }
  if (!fs.existsSync(CLIENT)) {
    ['2. its verbs', '3. setDesk, by the owner alone', '4. one ask, passed on and answered', '5. every ask is recorded',
      '6. a slow desk is answered within 10 s and never asked twice', '7. its state outlives it', '8. it asks through the kernel alone']
      .forEach(function (what) { test.fail(OWED + what + ': there is no deskClient server to ask'); });
    return;
  }

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const port = node.address().port;
  const nodeUrl = 'http://127.0.0.1:' + port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  const set = await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'a/G1', title: 'Asked' }, items: [{ id: 'a/G1.1', title: 'A', blocks: ['a/G1'] }] }) }, AGENT);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  let kid = startClient(nodeUrl);

  test.subHeading('2. its verbs');
  const tree = await up('deskClient') || {};
  const shapeOf = function (v) { return JSON.stringify(tree[v] || null); };
  if (shapeOf('desk') === JSON.stringify({ request: { verb: '', json: '' }, reply: { json: '' } })
    && shapeOf('setDesk') === JSON.stringify({ request: { key: '' }, reply: { set: true } })
    && shapeOf('history.search') === JSON.stringify({ request: { text: '' }, reply: { items: [{ key: '', label: '' }], more: false } })) {
    test.check('desk {verb, json} -> {json}; setDesk {key} -> {set}; history.search {text} -> {items, more}');
  } else test.fail(OWED + 'the api answered desk ' + shapeOf('desk') + ', setDesk ' + shapeOf('setDesk') + ', history.search ' + shapeOf('history.search'));

  test.subHeading('3. setDesk, by the owner alone; no desk, no ask');
  const SEARCH = JSON.stringify({ text: '', currentGoalOnly: true, goalsOnly: false });
  const early = await call('deskClient', 'desk', { verb: 'items.search', json: SEARCH }, OWNER);
  if (early.status !== 200 && (early.body || {}).code === 'no-such-peer' && posts.length === 0) test.check('before setDesk an ask is refused no-such-peer, and nothing is posted');
  else test.fail(OWED + 'an ask before setDesk answered ' + early.status + ' ' + JSON.stringify(early.body).slice(0, 160) + ' after ' + posts.length + ' post(s)');
  const theirs = await call('deskClient', 'setDesk', { key: DESK_KEY }, MEMBER);
  const mine = await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  if ((theirs.body || {}).code === 'not-owner' && mine.status === 200 && (mine.body || {}).set === true) test.check('a member is refused not-owner; the owner sets the desk\'s key');
  else test.fail(OWED + 'setDesk answered a member ' + JSON.stringify(theirs.body) + ', the owner ' + mine.status + ' ' + JSON.stringify(mine.body));

  test.subHeading('4. one ask, passed on and answered');
  posts.length = 0;
  const yes = await call('deskClient', 'desk', { verb: 'items.search', json: SEARCH }, OWNER);
  let got = null;
  try { got = JSON.parse((yes.body || {}).json); } catch (e) { got = null; }
  const goalSeen = got && Array.isArray(got.items) && got.items.some(function (p) { return p.key === 'a/G1'; });
  if (yes.status === 200 && goalSeen && posts.length === 1 && posts[0].to === DESK_KEY && posts[0].app === 'api' && posts[0].verb === 'items.search') {
    test.check('items.search went as one api post to the desk\'s key, and its answer came back as {json}');
  } else test.fail(OWED + 'the ask answered ' + yes.status + ' ' + JSON.stringify(yes.body).slice(0, 200) + '; posts ' + JSON.stringify(posts));
  const no = await call('deskClient', 'desk', { verb: 'item.get', json: JSON.stringify({ id: 'nope/G9' }) }, OWNER);
  let refusedBody = null;
  try { refusedBody = JSON.parse((no.body || {}).json); } catch (e) { refusedBody = null; }
  if (no.status === 200 && refusedBody && refusedBody.ok === false && refusedBody.code === 'no-such-item') test.check('the desk\'s refusal comes back as its answer: no-such-item inside {json}');
  else test.fail(OWED + 'a refused ask answered ' + no.status + ' ' + JSON.stringify(no.body).slice(0, 200));

  test.subHeading('5. every ask is recorded, newest first');
  const h = await history();
  const a = (h[0] || {}).row || {};
  const b = (h[1] || {}).row || {};
  const whole = function (r) { return typeof r.at === 'string' && !isNaN(Date.parse(r.at)) && typeof r.ms === 'number' && r.ms >= 0 && typeof r.bytes === 'number' && r.bytes > 0 && r.port === port; };
  if (a.verb === 'item.get' && a.outcome === 'refused' && b.verb === 'items.search' && b.outcome === 'answered' && whole(a) && whole(b) && fs.existsSync(path.join(clientState, 'deskClient.db'))) {
    test.check('history.search answers item.get (refused) then items.search (answered), each with at, ms, bytes and port ' + port + '; kept in deskClient.db');
  } else test.fail(OWED + 'history answered ' + JSON.stringify(h.slice(0, 3)).slice(0, 320) + '; deskClient.db ' + (fs.existsSync(path.join(clientState, 'deskClient.db')) ? 'exists' : 'does not exist'));

  test.subHeading('6. a slow desk is answered within 10 s and never asked twice');
  posts.length = 0;
  holdMs = 13000;
  const t0 = Date.now();
  const slow = await call('deskClient', 'desk', { verb: 'item.get', json: JSON.stringify({ id: 'a/G1.1' }) }, OWNER);
  const took = Date.now() - t0;
  const id = (((slow.body || {}).extra) || {}).id;
  const pendingRow = (await history()).filter(function (x) { return x.key === id; })[0];
  if ((slow.body || {}).code === 'no-answer' && typeof id === 'string' && id && took < 11500 && pendingRow && pendingRow.row.outcome === 'pending') {
    test.check('after ' + took + ' ms: refused no-answer with the id of its record, which says pending');
  } else test.fail(OWED + 'the slow ask answered after ' + took + ' ms: ' + slow.status + ' ' + JSON.stringify(slow.body).slice(0, 200) + '; its record ' + JSON.stringify(pendingRow));
  await sleep(Math.max(0, 14500 - (Date.now() - t0)));
  const ended = (await history()).filter(function (x) { return x.key === id; })[0];
  if (ended && ended.row.outcome === 'answered' && ended.row.ms >= 12000 && posts.length === 1) test.check('the late answer ended that record: answered after ' + ended.row.ms + ' ms, one post in all');
  else test.fail(OWED + 'after the late answer the record read ' + JSON.stringify(ended) + ' and ' + posts.length + ' post(s) had gone');

  test.subHeading('7. its state outlives it');
  const before = (await history()).length;
  kid.kill();
  await sleep(500);
  kid = startClient(nodeUrl);
  await up('deskClient');
  posts.length = 0;
  const after = await history();
  const again = await call('deskClient', 'desk', { verb: 'items.search', json: SEARCH }, OWNER);
  if (before > 0 && after.length === before && again.status === 200 && posts.length === 1 && posts[0].to === DESK_KEY) test.check('after a restart: the same ' + before + ' record(s), and an ask goes to the desk\'s key without setting it again');
  else test.fail(OWED + 'after a restart: ' + after.length + ' record(s) where there were ' + before + ', an ask answered ' + again.status + ' ' + JSON.stringify(again.body).slice(0, 120));

  test.subHeading('8. it asks through the kernel alone');
  const code = fs.readFileSync(CLIENT, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const reaches = [/\bfetch\s*\(/, /require\(\s*['"](node:)?https?['"]\s*\)/, /AGENTS_[A-Z]+/].filter(function (re) { return re.test(code); });
  if (/kernel\.js/.test(code) && /peerPost/.test(code) && !reaches.length) test.check('deskClient.js requires the kernel and calls peerPost; no fetch, no http, no AGENTS_ variable');
  else test.fail(OWED + 'deskClient.js ' + (/peerPost/.test(code) ? 'calls peerPost' : 'does not call peerPost') + ' and still holds ' + reaches.map(String).join(', '));
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
