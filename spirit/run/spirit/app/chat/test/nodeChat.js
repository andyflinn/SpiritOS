'use strict';

// spirit/run/spirit/app/chat/test/nodeChat.js
// The tests of spirit/app/chat/nodeChat.js, and of no other module (spec: ./nodeChat.md; goal/G43.31). The box:
// "nodeChat.js is today's chatClerver.js, working as it does, its verbs as api.js lists them. Its database is chat.db in
// the node's state" (Andy: "how about calling the db chat.db ??????", and "that ruling is replaced."); "The branch name is
// the folder's: chat"; "No old chat data is rescued" (Andy: "don't even THINK of rescuing any old chat data, that an
// ABSOLUTE NO."). Written from reading chatClerver.js. A scratch node of its own (test/headLessChrome.js), the old
// chatClerver's memory.db planted in the app's state folder with a line in it, the app switched on as he switches it
// on, and every verb asked over HTTP as the owner asks it on loopback. A line written to a key nobody answers is kept and
// stays unsent: one node judges all of it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const FILE = path.join(__dirname, '..', 'nodeChat.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked; '' when it is not there.
function code(f) {
  try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; }
}
function labels(body) { return ((body && body.items) || []).map(function (it) { try { return JSON.parse(it.label); } catch (e) { return null; } }).filter(Boolean); }

test.startTest('nodeChat.js: the chat server, the branch chat, its chat.db started empty (goal/G43.31)');

(async function () {
  test.subHeading('its code: no held path and no contact.accept (goal/G43.23, the checks of chatClerver-noHeld.js)');
  // Andy, G43.17: "Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
  const src = code(FILE);
  ok(/'line\.write'/.test(src), 'the world: spirit/app/chat/nodeChat.js is there, its code holding line.write', 'spirit/app/chat/nodeChat.js is not there, or holds no line.write: nothing judged');
  if (src) {
    ok(!/\bheld\b/.test(src), 'its code asks nothing held', 'nodeChat.js still asks held');
    ok(!/contact\.accept\b/.test(src), 'and it calls no contact.accept', 'nodeChat.js still calls contact.accept');
  }

  const node = await H.scratchNode();
  try {
    if (!node.up || !node.root) { test.fail('no scratch node of its own: nothing judged'); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const state = path.join(run, 'spirit', 'state', 'chat', 'data');
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };

    // THE OLD RECORD, PLANTED: the old chatClerver's memory.db in the app's state folder, one chat of one line in it.
    fs.mkdirSync(state, { recursive: true });
    const OLD = path.join(state, 'memory.db');
    const OLDPEER = auth.generateIdentity('oldpeer').publicKey;
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(OLD);
      db.exec("CREATE TABLE lines (peer TEXT NOT NULL, sent INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, text TEXT NOT NULL, receivedAt TEXT NOT NULL DEFAULT '', reWriter TEXT NOT NULL DEFAULT '', reSeq INTEGER NOT NULL DEFAULT 0, refused TEXT NOT NULL DEFAULT '', refusedAt TEXT NOT NULL DEFAULT '', PRIMARY KEY (peer, sent, seq));" +
        'CREATE TABLE peers (peer TEXT PRIMARY KEY, highestSent INTEGER NOT NULL DEFAULT 0, highestReceived INTEGER NOT NULL DEFAULT 0, bornAt TEXT NOT NULL);');
      db.prepare("INSERT INTO lines (peer, sent, seq, at, text) VALUES (?, 0, 1, '2026-10-01T10:00:00.000Z', 'zz an old line')").run(OLDPEER);
      db.prepare("INSERT INTO peers (peer, highestReceived, bornAt) VALUES (?, 1, '2026-10-01T10:00:00.000Z')").run(OLDPEER);
      db.close();
    }
    const oldBytes = fs.readFileSync(OLD);
    const oldTime = fs.statSync(OLD).mtimeMs;

    test.subHeading('switched on, it serves the branch chat');
    await call('app.active', { key: 'chat', active: true });
    const up = await H.until(function () { return call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
    ok(up, 'switched on, the server answers chat.chats.search', 'chat.chats.search: ' + short((await call('chat.chats.search', {})).text));
    if (!up) return;
    const job = await call('jobs.get', { key: 'spirit.app.chat' });
    ok(!!job.body && !!job.body.job && job.body.job.status === 'running', 'its job spirit.app.chat is running', 'jobs.get spirit.app.chat: ' + short(job.body));
    const old = await call('chatClerver.chats.search', {});
    ok(old.status >= 400, 'chatClerver.<verb> is no verb of this node: the branch is chat', 'chatClerver.chats.search answered ' + old.status + ' ' + short(old.body));

    test.subHeading('its database is chat.db, started empty; the old memory.db is neither read nor touched');
    ok(fs.existsSync(path.join(state, 'chat.db')), 'chat.db is in the node\'s state, spirit/state/chat/data/', 'no chat.db in spirit/state/chat/data/: ' + short(fs.readdirSync(state)));
    const empty = await call('chat.chats.search', {});
    ok(empty.status === 200 && labels(empty.body).length === 0, 'chats.search answers no chat: the old one is not rescued', 'chats.search at the start: ' + short(empty.body));
    const oldRead = await call('chat.chat.read', { peer: OLDPEER, before: '', after: '' });
    ok(oldRead.status === 200 && labels(oldRead.body).length === 0, 'chat.read of the old chat\'s peer answers no line', 'chat.read of the old peer: ' + short(oldRead.body));
    ok(Buffer.compare(fs.readFileSync(OLD), oldBytes) === 0 && fs.statSync(OLD).mtimeMs === oldTime, 'memory.db is as it was planted, byte for byte', 'memory.db changed under the new server');
    ok(!fs.existsSync(OLD + '-wal') && !fs.existsSync(OLD + '-shm'), 'and nothing opened it: no memory.db-wal and no memory.db-shm', 'memory.db was opened: ' + short(fs.readdirSync(state)));

    test.subHeading('the owner writes a line to a key nobody answers: kept, numbered, unsent');
    const K = auth.generateIdentity('quiet').publicKey;
    const w1 = await call('chat.line.write', { to: K, text: 'zz hello there', re: { writer: '', seq: 0 } });
    ok(w1.status === 200 && !!w1.body && w1.body.seq === 1 && /^(refused|pending)$/.test(String(w1.body.outcome)), 'line.write answers seq 1, refused or pending: nobody took it', 'line.write: ' + w1.status + ' ' + short(w1.body));
    const read = await call('chat.chat.read', { peer: K, before: '', after: '' });
    const lines = labels(read.body);
    ok(lines.length === 1 && lines[0].sent === 1 && lines[0].seq === 1 && lines[0].text === 'zz hello there' && !!lines[0].refused, 'chat.read holds it: written here, seq 1, its text, marked unsent', 'chat.read: ' + short(read.body));
    const rows = labels((await call('chat.chats.search', {})).body);
    ok(rows.length === 1 && rows[0].peer === K && rows[0].sent === 1 && rows[0].seq === 1, 'chats.search now has that chat, its newest line the one written', 'chats.search: ' + short(rows));
    const w2 = await call('chat.line.write', { to: K, text: 'zz a second one', re: { writer: '', seq: 0 } });
    ok(w2.status === 200 && !!w2.body && w2.body.seq === 2, 'the next line is seq 2', 'the second line.write: ' + short(w2.body));
    const grant = await call('auth.query', { key: K, path: 'chat.line.receive' });
    ok(grant.status === 200 && !!grant.body && grant.body.allowed === true, 'the line is also the grant to answer: K may chat.line.receive', 'auth.query chat.line.receive: ' + grant.status + ' ' + short(grant.body));
    const oldGrant = await call('auth.query', { key: K, path: 'chatClerver.line.receive' });
    ok(oldGrant.status === 200 && !!oldGrant.body && oldGrant.body.allowed === false, 'and never chatClerver.line.receive', 'K was granted chatClerver.line.receive: ' + short(oldGrant.body));

    test.subHeading('chat.search, by text and by who');
    const me = labels((await call('chat.chat.search', { peer: K, text: 'hello', who: 'me' })).body);
    ok(me.length >= 1 && me[0].text === 'zz hello there', 'hello, who me: the line written', 'chat.search hello me: ' + short(me));
    const them = labels((await call('chat.chat.search', { peer: K, text: 'hello', who: 'them' })).body);
    ok(them.length === 0, 'who them: none, nothing was received', 'chat.search hello them: ' + short(them));

    test.subHeading('the attacker: a line with no to, a line too large to travel');
    const noTo = await call('chat.line.write', { to: '', text: 'zz to nobody', re: { writer: '', seq: 0 } });
    ok(noTo.status >= 400 && noTo.status < 500, 'a line with no to is refused, as the caller\'s error', 'no to: ' + noTo.status + ' ' + short(noTo.body));
    const big = await call('chat.line.write', { to: K, text: 'x'.repeat(limits.PAYLOAD_MAX), re: { writer: '', seq: 0 } });
    ok(big.status >= 400 && /line-too-large/.test(big.text), 'a line too large to travel is refused line-too-large', 'too large: ' + big.status + ' ' + short(big.body));
    const after = labels((await call('chat.chat.read', { peer: K, before: '', after: '' })).body);
    ok(after.length === 2, 'and neither was kept: the chat holds its two lines', 'the chat after the refusals: ' + short(after));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
