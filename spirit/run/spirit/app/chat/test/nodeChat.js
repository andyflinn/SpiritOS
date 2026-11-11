'use strict';

// spirit/run/spirit/app/chat/test/nodeChat.js
// The tests of spirit/app/chat/nodeChat.js, and of no other module (spec: ./nodeChat.md; goal/G43.31). The box:
// "nodeChat.js is today's chatClerver.js, working as it does, its verbs as api.js lists them. Its database is chat.db in
// the node's state" (Andy: "how about calling the db chat.db ??????", and "that ruling is replaced."); "The branch name is
// the folder's: chat"; "No old chat data is rescued" (Andy: "don't even THINK of rescuing any old chat data, that an
// ABSOLUTE NO."). Written from reading chatClerver.js. A scratch node of its own (spirit/test/headLessChrome.js), the old
// chatClerver's memory.db planted in the app's state folder with a line in it, the app switched on as he switches it
// on, and every verb asked over HTTP as the owner asks it on loopback. A line written to a key nobody answers is kept and
// stays unsent: one node judges all of it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const FILE = path.join(__dirname, '..', 'nodeChat.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked; '' when it is not there.
function code(f) {
  try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; }
}
function labels(body) { return ((body && body.items) || []).map(function (it) { try { return JSON.parse(it.label); } catch (e) { return null; } }).filter(Boolean); }

// What the tests make, for the tests after them.
const X = { src: '', node: null, state: '', call: null, OLD: '', OLDPEER: '', oldBytes: null, oldTime: 0, up: false, K: '' };
const NO_NODE = 'no scratch node of its own: the world failed';
const NOT_UP = 'the chat server never answered';
test.after(function () {
  const node = X.node;
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// ── its code: no held path and no contact.accept (goal/G43.23, the checks of chatClerver-noHeld.js) ──
// Andy, G43.17: "Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
test.run('the world: spirit/app/chat/nodeChat.js is there, its code holding line.write', 0.2, function () {
  X.src = code(FILE);
  return (/'line\.write'/).test(X.src) ? true : 'spirit/app/chat/nodeChat.js is not there, or holds no line.write: nothing judged';
}, test.limit.quick);
test.run('its code asks nothing held', 0.2, function () {
  if (!X.src) return 'spirit/app/chat/nodeChat.js is not there';
  return !/\bheld\b/.test(X.src) ? true : 'nodeChat.js still asks held';
}, test.limit.quick);
test.run('and it calls no contact.accept', 0.2, function () {
  if (!X.src) return 'spirit/app/chat/nodeChat.js is not there';
  return !/contact\.accept\b/.test(X.src) ? true : 'nodeChat.js still calls contact.accept';
}, test.limit.quick);

test.run('the world: a scratch node of its own, the old chatClerver\'s memory.db planted in the app\'s state folder', 0.2, async function () {
  const node = X.node = await H.scratchNode();
  if (!node.up || !node.root) return 'no scratch node of its own: nothing judged';
  const run = path.join(node.root, 'spirit', 'run');
  const state = X.state = path.join(run, 'spirit', 'state', 'chat', 'data');
  X.call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  // THE OLD RECORD, PLANTED: the old chatClerver's memory.db in the app's state folder, one chat of one line in it.
  fs.mkdirSync(state, { recursive: true });
  const OLD = X.OLD = path.join(state, 'memory.db');
  const OLDPEER = X.OLDPEER = auth.generateIdentity('oldpeer').publicKey;
  {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(OLD);
    db.exec("CREATE TABLE lines (peer TEXT NOT NULL, sent INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, text TEXT NOT NULL, receivedAt TEXT NOT NULL DEFAULT '', reWriter TEXT NOT NULL DEFAULT '', reSeq INTEGER NOT NULL DEFAULT 0, refused TEXT NOT NULL DEFAULT '', refusedAt TEXT NOT NULL DEFAULT '', PRIMARY KEY (peer, sent, seq));" +
      'CREATE TABLE peers (peer TEXT PRIMARY KEY, highestSent INTEGER NOT NULL DEFAULT 0, highestReceived INTEGER NOT NULL DEFAULT 0, bornAt TEXT NOT NULL);');
    db.prepare("INSERT INTO lines (peer, sent, seq, at, text) VALUES (?, 0, 1, '2026-10-01T10:00:00.000Z', 'zz an old line')").run(OLDPEER);
    db.prepare("INSERT INTO peers (peer, highestReceived, bornAt) VALUES (?, 1, '2026-10-01T10:00:00.000Z')").run(OLDPEER);
    db.close();
  }
  X.oldBytes = fs.readFileSync(OLD);
  X.oldTime = fs.statSync(OLD).mtimeMs;
  return true;
}, test.limit.slow);

// ── switched on, it serves the branch chat ──
test.run('switched on, the server answers chat.chats.search', 0.2, async function () {
  if (!X.call) return NO_NODE;
  await X.call('app.active', { key: 'chat', active: true });
  X.up = await H.until(function () { return X.call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
  return X.up ? true : 'chat.chats.search: ' + short((await X.call('chat.chats.search', {})).text);
}, test.limit.quick);
test.run('its job spirit.app.chat is running', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const job = await X.call('job.get', { key: 'spirit.app.chat' });
  return !!job.body && !!job.body.job && job.body.job.status === 'running' ? true : 'job.get spirit.app.chat: ' + short(job.body);
}, test.limit.quick);
test.run('chatClerver.<verb> is no verb of this node: the branch is chat', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const old = await X.call('chatClerver.chats.search', {});
  return old.status >= 400 ? true : 'chatClerver.chats.search answered ' + old.status + ' ' + short(old.body);
}, test.limit.quick);

// ── its database is chat.db, started empty; the old memory.db is neither read nor touched ──
test.run('chat.db is in the node\'s state, spirit/state/chat/data/', 0.2, function () {
  if (!X.up) return NOT_UP;
  return fs.existsSync(path.join(X.state, 'chat.db')) ? true : 'no chat.db in spirit/state/chat/data/: ' + short(fs.readdirSync(X.state));
}, test.limit.quick);
test.run('chats.search answers no chat: the old one is not rescued', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const empty = await X.call('chat.chats.search', {});
  return empty.status === 200 && labels(empty.body).length === 0 ? true : 'chats.search at the start: ' + short(empty.body);
}, test.limit.quick);
test.run('chat.read of the old chat\'s peer answers no line', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const oldRead = await X.call('chat.chat.read', { peer: X.OLDPEER, before: '', after: '' });
  return oldRead.status === 200 && labels(oldRead.body).length === 0 ? true : 'chat.read of the old peer: ' + short(oldRead.body);
}, test.limit.quick);
test.run('memory.db is as it was planted, byte for byte', 0.2, function () {
  if (!X.up) return NOT_UP;
  return Buffer.compare(fs.readFileSync(X.OLD), X.oldBytes) === 0 && fs.statSync(X.OLD).mtimeMs === X.oldTime ? true : 'memory.db changed under the new server';
}, test.limit.quick);
test.run('and nothing opened it: no memory.db-wal and no memory.db-shm', 0.2, function () {
  if (!X.up) return NOT_UP;
  return !fs.existsSync(X.OLD + '-wal') && !fs.existsSync(X.OLD + '-shm') ? true : 'memory.db was opened: ' + short(fs.readdirSync(X.state));
}, test.limit.quick);

// ── the owner writes a line to a key nobody answers: kept, numbered, unsent ──
test.run('line.write answers seq 1, refused or pending: nobody took it', 0.2, async function () {
  if (!X.up) return NOT_UP;
  X.K = auth.generateIdentity('quiet').publicKey;
  const w1 = await X.call('chat.line.write', { to: X.K, text: 'zz hello there', re: { writer: '', seq: 0 } });
  return w1.status === 200 && !!w1.body && w1.body.seq === 1 && /^(refused|pending)$/.test(String(w1.body.outcome)) ? true : 'line.write: ' + w1.status + ' ' + short(w1.body);
}, test.limit.quick);
test.run('chat.read holds it: written here, seq 1, its text, marked unsent', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const read = await X.call('chat.chat.read', { peer: X.K, before: '', after: '' });
  const lines = labels(read.body);
  return lines.length === 1 && lines[0].sent === 1 && lines[0].seq === 1 && lines[0].text === 'zz hello there' && !!lines[0].refused ? true : 'chat.read: ' + short(read.body);
}, test.limit.quick);
test.run('chats.search now has that chat, its newest line the one written', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const rows = labels((await X.call('chat.chats.search', {})).body);
  return rows.length === 1 && rows[0].peer === X.K && rows[0].sent === 1 && rows[0].seq === 1 ? true : 'chats.search: ' + short(rows);
}, test.limit.quick);
test.run('the next line is seq 2', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const w2 = await X.call('chat.line.write', { to: X.K, text: 'zz a second one', re: { writer: '', seq: 0 } });
  return w2.status === 200 && !!w2.body && w2.body.seq === 2 ? true : 'the second line.write: ' + short(w2.body);
}, test.limit.quick);
test.run('the line is also the grant to answer: K may chat.line.receive', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const grant = await X.call('auth.query', { key: X.K, path: 'chat.line.receive' });
  return grant.status === 200 && !!grant.body && grant.body.allowed === true ? true : 'auth.query chat.line.receive: ' + grant.status + ' ' + short(grant.body);
}, test.limit.quick);
// A grant under the old name would let K reach what nobody granted it.
test.run('and never chatClerver.line.receive', 0.8, async function () {
  if (!X.K) return NOT_UP;
  const oldGrant = await X.call('auth.query', { key: X.K, path: 'chatClerver.line.receive' });
  return oldGrant.status === 200 && !!oldGrant.body && oldGrant.body.allowed === false ? true : 'K was granted chatClerver.line.receive: ' + short(oldGrant.body);
}, test.limit.quick);

// ── chat.search, by text and by who ──
test.run('hello, who me: the line written', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const me = labels((await X.call('chat.chat.search', { peer: X.K, text: 'hello', who: 'me' })).body);
  return me.length >= 1 && me[0].text === 'zz hello there' ? true : 'chat.search hello me: ' + short(me);
}, test.limit.quick);
test.run('who them: none, nothing was received', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const them = labels((await X.call('chat.chat.search', { peer: X.K, text: 'hello', who: 'them' })).body);
  return them.length === 0 ? true : 'chat.search hello them: ' + short(them);
}, test.limit.quick);

// ── the attacker: a line with no to, a line too large to travel ──
test.run('a line with no to is refused, as the caller\'s error', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const noTo = await X.call('chat.line.write', { to: '', text: 'zz to nobody', re: { writer: '', seq: 0 } });
  return noTo.status >= 400 && noTo.status < 500 ? true : 'no to: ' + noTo.status + ' ' + short(noTo.body);
}, test.limit.quick);
test.run('a line too large to travel is refused line-too-large', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const big = await X.call('chat.line.write', { to: X.K, text: 'x'.repeat(limits.PAYLOAD_MAX), re: { writer: '', seq: 0 } });
  return big.status >= 400 && /line-too-large/.test(big.text) ? true : 'too large: ' + big.status + ' ' + short(big.body);
}, test.limit.quick);
test.run('and neither was kept: the chat holds its two lines', 0.2, async function () {
  if (!X.K) return NOT_UP;
  const after = labels((await X.call('chat.chat.read', { peer: X.K, before: '', after: '' })).body);
  return after.length === 2 ? true : 'the chat after the refusals: ' + short(after);
}, test.limit.quick);
