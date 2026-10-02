'use strict';

// goal/G3.4: deskClient keeps the place and holds what is meant for its agent. Red on today's tree: deskClient
// (goal/G3.3) passes an ask and counts it, and has no verb next.
//   Andy, 2026-10-02 (goal/G3.1): "i am ready to accept completely alternative design, if it achieves what todays
//   deskEar does, and statistics are kept somewhere you can access them easily.", and of the polls that bring
//   nothing: "empty polls can contribute statistically and discarded." His Go on this item is his press in Desk.
// The contract the builder follows (the box of goal/G3.4; the names are the agents', as he left them to us):
//   1. deskClient.json declares two args, as backup.json declares quietMs: pollMs, default 60000, and historyMax,
//      a number. The node hands their values to the server as its first argument (jobs.js), so this suite hands
//      it small ones.
//   2. Verb next {} -> {lines: ['']}, the owner's alone (a member is refused not-owner); before setDesk it is
//      refused no-such-peer, as desk is.
//   3. While its agent waits on next, deskClient asks the desk for changes {n, line} from the place it stopped:
//      at once when the last ask is pollMs old or older, and every pollMs while the wait lasts. With something
//      meant for its agent it answers at once; with nothing it answers {lines: []} within 10 s (a node gives a
//      server 12 s, appClient.js DOOR_WAIT_MS).
//   4. A first run, with no saved place, starts at now: what the desk already holds is not handed over.
//   5. What is meant for its agent, exactly as today's deskEar selects and words it: Andy's records but his seen
//      presses ('DESK andy <verb> <body>'), another agent's chat.add ('DESK <by> chat.add <body>'), and the
//      lines Desk keeps from Andy or an agent ('LINE <from> <kind>: <text>'); never its own records (known by
//      their key, whatever label the desk shows for it: Andy may relabel an agent) or its own lines,
//      and never Andy's direct line to the other agent (the line's peer is not its own key). Who it is, name and
//      key, is what its node hands a server it starts: --node {name, publicKey} (jobs.js), not a file it opens.
//   6. Each thing is handed over once: the place is kept in its own state, so a restart misses nothing written
//      while it was down and repeats nothing handed over before.
//   7. It tells Desk listening (agent.state) when its agent starts to wait, and working when it hands lines over.
//   8. A run of polls that bring nothing is ONE record in history, verb changes, outcome empty, with count, the
//      number of polls in it; never one row each.
//   9. The record of asks is bounded: the newest historyMax rows are kept, the oldest fall off.
// Not asserted, the builder's: how the first run finds "now"; whether a line waits in memory or on disk between
// the ask that brought it and the next that hands it over; the desk's own busy replies (by 'desk'), which this
// suite cannot make the desk write; what the listening and working posts look like in history.

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
const POLL_MS = 400;
const HISTORY_MAX = 8;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// The agent this deskClient serves (the owner of its node), the other agent, a member of the agent's node, and
// Andy at his own desk.
const SELF_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestSelfAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestOtherAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientNextTestDeskNodeAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const MEMBER = { key: 'MCowBQYDK2VwAyEAdeskClientNextTestMemberAAAAAAAAAAAAA=', label: 'somebody' };
// At the desk the agent goes by the label Andy's node holds for its key, which he may change (jobs.authRelabel):
// not the name of its own node. So its own records are known by their key.
const SELF_AT_DESK = { key: SELF_KEY, label: 'renamed-at-the-desk' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'Andy' };

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

// THE PRETEND NODE deskClient runs on, as deskClientAsk.js builds it: its peer.post goes into the real desk server
// as the agent's own ask, and the answer comes back down the event stream by re, as a relay would bring it.
const streams = [];
const posts = [];   // every peer.post it was handed: { to, app, verb, args }
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
    const verb = Object.keys(desk)[0] || '';
    posts.push({ to: b.to, app: ask && ask.app, verb: verb, args: desk[verb] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

function startClient(nodeUrl) {
  const kid = spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: HISTORY_MAX }), '--pipe', clientPipe, '--state', clientState,
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
const andySays = function (text) { return call('desk', 'chat.add', { id: 'a/G1.1', text: text }, ANDY); };
const keeps = function (key, from, peer, text) {
  return call('desk', 'log.add', { json: JSON.stringify({ key: key, at: new Date().toISOString(), from: from, kind: 'note', peer: peer, text: text }) }, ANDY);
};

async function main() {
  test.subHeading('1. the manifest declares pollMs and historyMax');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  const argOf = function (name) { return ((manifest && manifest.args) || []).filter(function (a) { return a && a.name === name; })[0]; };
  const pollArg = argOf('pollMs');
  const maxArg = argOf('historyMax');
  if (pollArg && pollArg.default === 60000 && maxArg && typeof maxArg.default === 'number' && maxArg.default > 0) test.check('deskClient.json: pollMs defaults to 60000, historyMax to ' + maxArg.default);
  else test.fail(OWED + 'deskClient.json declares args ' + JSON.stringify(manifest && manifest.args));

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  const set = await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'a/G1', title: 'Heard' }, items: [{ id: 'a/G1.1', title: 'A', blocks: ['a/G1'] }] }) }, SELF_AT_DESK);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  // What the desk holds before deskClient ever asks: a first run must not hand these over.
  await andySays('old chat, before the first run');
  await keeps('old-1', 'andy', SELF_KEY, 'old line, before the first run');
  let kid = startClient(nodeUrl);

  test.subHeading('2. the verb next, the owner\'s alone');
  const tree = await up('deskClient') || {};
  if (JSON.stringify(tree.next || null) !== JSON.stringify({ request: {}, reply: { lines: [''] } })) {
    test.fail(OWED + 'the api answered next ' + JSON.stringify(tree.next || null) + ', where {request: {}, reply: {lines: [\'\']}} is owed');
    ['3. a wait that brings nothing', '4. a first run starts at now', '5. what is meant for its agent', '6. once, across a restart',
      '7. listening and working', '8. empty polls are one record', '9. the record is bounded'].forEach(function (what) { test.fail(OWED + what + ': deskClient has no verb next to ask'); });
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
  const asked = posts.filter(function (p) { return p.verb === 'changes'; });
  if (first.status === 200 && first.lines && first.lines.length === 0 && first.ms >= 5000 && first.ms < 11500 && asked.length >= 5 && asked.every(function (p) { return p.to === DESK_KEY && p.app === 'api'; })) {
    test.check('with nothing new, next answered {lines: []} after ' + first.ms + ' ms, having asked the desk for changes ' + asked.length + ' times');
  } else test.fail(OWED + 'the first next answered ' + first.status + ' ' + JSON.stringify(first.body).slice(0, 200) + ' after ' + first.ms + ' ms and ' + asked.length + ' changes asks');
  if (first.lines && !first.lines.some(said('before the first run'))) test.check('what the desk held before the first run was not handed over');
  else test.fail(OWED + 'the first next handed over ' + JSON.stringify(first.lines).slice(0, 240));

  test.subHeading('8. a run of polls that bring nothing is one record');
  const h1 = await history();
  const top = (h1[0] || {}).row || {};
  const twins = h1.filter(function (x, i) { return i > 0 && x.row.outcome === 'empty' && h1[i - 1].row.outcome === 'empty'; });
  if (top.verb === 'changes' && top.outcome === 'empty' && typeof top.count === 'number' && top.count >= 5 && !twins.length) {
    test.check('the newest record reads changes, empty, count ' + top.count + '; no two empty records stand side by side');
  } else test.fail(OWED + 'after the empty wait history opened with ' + JSON.stringify(h1.slice(0, 3)).slice(0, 320) + ' and held ' + twins.length + ' empty record(s) beside another');

  test.subHeading('7. listening when its agent waits, working when it hands lines over');
  const wordsSoFar = posts.filter(function (p) { return p.verb === 'agent.state'; }).map(function (p) { return p.args && p.args.word; });
  await andySays('new chat one');
  await sleep(POLL_MS + 100);
  posts.length = 0;
  const one = await next();
  const wordsAtHandOver = posts.filter(function (p) { return p.verb === 'agent.state'; }).map(function (p) { return p.args && p.args.word; });
  if (wordsSoFar[0] === 'listening' && wordsSoFar.indexOf('working') === -1 && wordsAtHandOver.indexOf('working') !== -1) test.check('it said listening as the wait began, and working as it handed a line over');
  else test.fail(OWED + 'agent.state went ' + JSON.stringify(wordsSoFar) + ' during the empty wait and ' + JSON.stringify(wordsAtHandOver) + ' at the hand-over');

  test.subHeading('5. what is meant for its agent, as today\'s deskEar words it');
  if (one.lines && one.lines.length === 1 && one.lines[0].indexOf('DESK andy chat.add ') === 0 && said('new chat one')(one.lines[0]) && one.ms < 5000) {
    test.check('Andy\'s chat came out of next after ' + one.ms + ' ms: ' + one.lines[0].slice(0, 60));
  } else test.fail(OWED + 'after Andy\'s chat next answered ' + JSON.stringify(one.body).slice(0, 240) + ' after ' + one.ms + ' ms');
  await call('desk', 'press', { id: 'a/G1.1', what: 'seen' }, ANDY);
  await call('desk', 'press', { id: 'a/G1', what: 'end-design' }, ANDY);
  await call('desk', 'press', { id: 'a/G1.1', what: 'go' }, ANDY);
  await call('desk', 'chat.add', { id: 'a/G1.1', text: 'chat of the other agent' }, OTHER_AT_DESK);
  await call('desk', 'chat.add', { id: 'a/G1.1', text: 'chat of my own' }, SELF_AT_DESK);
  await keeps('l-1', 'andy', SELF_KEY, 'line of andy for me');
  await keeps('l-2', 'andy', OTHER_KEY, 'line of andy for the other agent');
  await keeps('l-3', 'claude-windows', DESK_KEY, 'line of my own');
  await keeps('l-4', 'wsl-claude', DESK_KEY, 'line of the other agent');
  await sleep(POLL_MS + 100);
  const many = await next();
  const got = many.lines || [];
  const wanted = [
    function (l) { return l.indexOf('DESK andy press ') === 0 && said('end-design')(l); },
    function (l) { return l.indexOf('DESK andy press ') === 0 && said('"go"')(l); },
    function (l) { return l.indexOf('DESK wsl-claude chat.add ') === 0 && said('chat of the other agent')(l); },
    function (l) { return l.indexOf('LINE andy note') === 0 && /: line of andy for me$/.test(l); },
    function (l) { return l.indexOf('LINE wsl-claude note') === 0 && /: line of the other agent$/.test(l); },
  ];
  const missing = wanted.filter(function (fits) { return !got.some(fits); }).length;
  const unwanted = ['"seen"', 'chat of my own', 'line of andy for the other agent', 'line of my own', 'new chat one'].filter(function (t) { return got.some(said(t)); });
  if (got.length === 5 && !missing && !unwanted.length) test.check('two presses of Andy\'s, the other agent\'s chat and two kept lines came out; his seen press, my own chat and line, and his line to the other agent did not');
  else test.fail(OWED + 'next handed over ' + got.length + ' line(s), ' + missing + ' wanted missing, unwanted ' + JSON.stringify(unwanted) + ': ' + JSON.stringify(got).slice(0, 400));

  test.subHeading('6. once, across a restart: nothing missed, nothing repeated');
  kid.kill();
  await sleep(500);
  await andySays('chat while it was down');
  kid = startClient(nodeUrl);
  await up('deskClient');
  const back = await next();
  await andySays('chat after the restart');
  await sleep(POLL_MS + 100);
  const later = await next();
  if (back.lines && back.lines.length === 1 && said('chat while it was down')(back.lines[0]) && later.lines && later.lines.length === 1 && said('chat after the restart')(later.lines[0])) {
    test.check('after a restart next handed over what was written while it was down, once, and nothing from before');
  } else test.fail(OWED + 'after the restart next answered ' + JSON.stringify(back.lines).slice(0, 200) + ', then ' + JSON.stringify(later.lines).slice(0, 200));

  test.subHeading('9. the record of asks is bounded');
  for (let i = 0; i < HISTORY_MAX + 3; i++) await call('deskClient', 'desk', { verb: 'item.get', json: JSON.stringify({ id: 'a/G1.1' }) }, OWNER);
  const h2 = await history();
  if (h2.length === HISTORY_MAX && h2[0].row.verb === 'item.get' && h2[0].row.outcome === 'answered') test.check('after more asks than historyMax, history holds the newest ' + HISTORY_MAX);
  else test.fail(OWED + 'history holds ' + h2.length + ' record(s) where historyMax is ' + HISTORY_MAX + ', the newest ' + JSON.stringify(h2[0] || null));

  test.subHeading('who it is comes from its node, and it still asks through the kernel alone');
  const code = fs.readFileSync(CLIENT, 'utf8').split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const reaches = [/\bfetch\s*\(/, /require\(\s*['"](node:)?https?['"]\s*\)/, /AGENTS_[A-Z]+/, /identity\.json/].filter(function (re) { return re.test(code); });
  if (/'--node'/.test(code) && /peerPost/.test(code) && !reaches.length) test.check('deskClient.js reads --node, calls peerPost, and holds no fetch, no http, no AGENTS_ variable, no identity.json');
  else test.fail(OWED + 'deskClient.js ' + (/'--node'/.test(code) ? 'reads --node' : 'does not read --node') + ' and holds ' + reaches.map(String).join(', '));
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
