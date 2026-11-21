'use strict';

// spirit/run/spirit/app/chat/server/test/server.js
// The tests of spirit/app/chat/server/server.js, and of no other module (spec: ./server/server.md; goal/G43.31). The box:
// "chat/server/server.js is today's chatClerver.js, working as it does, its verbs as api.js lists them. Its database is chat.db in
// the node's state" (Andy: "how about calling the db chat.db ??????", and "that ruling is replaced."); "The branch name is
// the folder's: chat"; "No old chat data is rescued" (Andy: "don't even THINK of rescuing any old chat data, that an
// ABSOLUTE NO."). Written from reading chatClerver.js. A scratch node of its own (spirit/test/headLessChrome.js), the
// app switched on as he switches it on, and every verb asked over HTTP as the owner asks it on loopback. A line written to a key nobody answers is kept and
// stays unsent: one node judges all of it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const FILE = path.join(__dirname, '..', 'server.js');

// A file's code, comments blanked; '' when it is not there.
function code(f) {
  try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; }
}
function labels(body) { return ((body && body.items) || []).map(function (it) { try { return JSON.parse(it.label); } catch (e) { return null; } }).filter(Boolean); }

// What the tests make, for the tests after them.
const X = { src: '', node: null, state: '', call: null, up: false, K: '' };
test.after(function () {
  const node = X.node;
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// ── its code: no held path and no contact.accept (goal/G43.23, the checks of chatClerver-noHeld.js) ──
// Andy, G43.17: "Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
test.run('spirit/app/chat/server/server.js is there, and its code holds line.write', 0.2, function () {
  X.src = code(FILE);
  return (/'line\.write'/).test(X.src) ? true : false;
}, test.limit.quick);
test.run('its code asks nothing held', 0.2, function () {
  if (!X.src) return false;
  return !/\bheld\b/.test(X.src) ? true : false;
}, test.limit.quick);
test.run('its code calls no contact.accept', 0.2, function () {
  if (!X.src) return false;
  return !/contact\.accept\b/.test(X.src) ? true : false;
}, test.limit.quick);

test.run('a scratch node of its own comes up for this suite', 0.2, async function () {
  const node = X.node = await H.scratchNode();
  if (!node.up || !node.root) return false;
  const run = path.join(node.root, 'spirit', 'run');
  const state = X.state = path.join(run, 'spirit', 'state', 'chat', 'data');
  X.call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  return true;
}, test.limit.slow);

// ── switched on, it serves the branch chat ──
test.run('switched on, the server answers chat.chats.search', 0.2, async function () {
  if (!X.call) return false;
  await X.call('app.active', { key: 'chat', active: true });
  X.up = await H.until(function () { return X.call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
  return X.up ? true : false;
}, test.limit.quick);
test.run('its job spirit.app.chat is running', 0.2, async function () {
  if (!X.up) return false;
  const job = await X.call('job.get', { key: 'spirit.app.chat' });
  return !!job.body && !!job.body.job && job.body.job.status === 'running' ? true : false;
}, test.limit.quick);
test.run('no chatClerver verb is a verb of this node, because the branch is chat', 0.2, async function () {
  if (!X.up) return false;
  const old = await X.call('chatClerver.chats.search', {});
  return old.status >= 400 ? true : false;
}, test.limit.quick);

// ── its database is chat.db, started empty ──
test.run('chat.db is in the node\'s state, in spirit/state/chat/data/', 0.2, function () {
  if (!X.up) return false;
  return fs.existsSync(path.join(X.state, 'chat.db')) ? true : false;
}, test.limit.quick);
test.run('chats.search answers no chat at the start', 0.2, async function () {
  if (!X.up) return false;
  const empty = await X.call('chat.chats.search', {});
  return empty.status === 200 && labels(empty.body).length === 0 ? true : false;
}, test.limit.quick);

// ── the owner writes a line to a key nobody answers: kept, numbered, unsent ──
test.run('line.write answers seq 1, refused or pending, because nobody took it', 0.2, async function () {
  if (!X.up) return false;
  X.K = auth.generateIdentity('quiet').publicKey;
  const w1 = await X.call('chat.line.write', { to: X.K, text: 'zz hello there', re: { writer: '', seq: 0 } });
  return w1.status === 200 && !!w1.body && w1.body.seq === 1 && /^(refused|pending)$/.test(String(w1.body.outcome)) ? true : false;
}, test.limit.quick);
test.run('chat.read holds the line as written here, with seq 1 and its text, marked unsent', 0.2, async function () {
  if (!X.K) return false;
  const read = await X.call('chat.chat.read', { peer: X.K, before: 0, after: 0 });
  const lines = labels(read.body);
  return lines.length === 1 && lines[0].sent === 1 && lines[0].seq === 1 && lines[0].text === 'zz hello there' && !!lines[0].refused ? true : false;
}, test.limit.quick);
test.run('chats.search now has that chat, and its newest line is the one written', 0.2, async function () {
  if (!X.K) return false;
  const rows = labels((await X.call('chat.chats.search', {})).body);
  return rows.length === 1 && rows[0].peer === X.K && rows[0].sent === 1 && rows[0].seq === 1 ? true : false;
}, test.limit.quick);
test.run('the next line is seq 2', 0.2, async function () {
  if (!X.K) return false;
  const w2 = await X.call('chat.line.write', { to: X.K, text: 'zz a second one', re: { writer: '', seq: 0 } });
  return w2.status === 200 && !!w2.body && w2.body.seq === 2 ? true : false;
}, test.limit.quick);
test.run('the line is also the grant to answer, so K may call chat.line.receive', 0.2, async function () {
  if (!X.K) return false;
  const grant = await X.call('auth.query', { key: X.K, path: 'chat.line.receive' });
  return grant.status === 200 && !!grant.body && grant.body.allowed === true ? true : false;
}, test.limit.quick);
// A grant under the old name would let K reach what nobody granted it.
test.run('K may never call chatClerver.line.receive', 0.8, async function () {
  if (!X.K) return false;
  const oldGrant = await X.call('auth.query', { key: X.K, path: 'chatClerver.line.receive' });
  return oldGrant.status === 200 && !!oldGrant.body && oldGrant.body.allowed === false ? true : false;
}, test.limit.quick);

// ── chat.search, by text and by who ──
test.run('a search for hello by me finds the line written', 0.2, async function () {
  if (!X.K) return false;
  const me = labels((await X.call('chat.chat.search', { peer: X.K, text: 'hello', who: 'me' })).body);
  return me.length >= 1 && me[0].text === 'zz hello there' ? true : false;
}, test.limit.quick);
test.run('a search by them finds nothing, because nothing was received', 0.2, async function () {
  if (!X.K) return false;
  const them = labels((await X.call('chat.chat.search', { peer: X.K, text: 'hello', who: 'them' })).body);
  return them.length === 0 ? true : false;
}, test.limit.quick);

// ── the attacker: a line with no to, a line too large to travel ──
test.run('a line with no to is refused, as the caller\'s error', 0.2, async function () {
  if (!X.up) return false;
  const noTo = await X.call('chat.line.write', { to: '', text: 'zz to nobody', re: { writer: '', seq: 0 } });
  return noTo.status >= 400 && noTo.status < 500 ? true : false;
}, test.limit.quick);
// Since goal/G48.4 a line's text is a spirit.type.string.paragraph, at most 2048 bytes: a line too large is refused at the door,
// by its type, before the server's own line-too-large check could see it.
test.run('a line too large to travel is refused at the door, by its type, with a code', 0.2, async function () {
  if (!X.K) return false;
  const big = await X.call('chat.line.write', { to: X.K, text: 'x'.repeat(limits.PAYLOAD_MAX), re: { writer: '', seq: 0 } });
  return (big.status >= 400 && big.status < 500 && !!big.body && typeof big.body.code === 'string' && big.body.code !== 'handler-failed') ? true : false;
}, test.limit.quick);
test.run('neither refused line was kept, and the chat holds its two lines', 0.2, async function () {
  if (!X.K) return false;
  const after = labels((await X.call('chat.chat.read', { peer: X.K, before: 0, after: 0 })).body);
  return after.length === 2 ? true : false;
}, test.limit.quick);
// before and after are UTC times, milliseconds since 1970, 0 for none (goal/G48.4, Q5, Andy: "times are fucking numbers").
test.run('chat.read before a line\'s UTC time answers the line before it, and after the first line\'s time the one after', 0.2, async function () {
  if (!X.K) return false;
  const two = labels((await X.call('chat.chat.read', { peer: X.K, before: 0, after: 0 })).body);
  if (two.length !== 2) return false;
  const newer = two[0].seq === 2 ? two[0] : two[1], older = two[0].seq === 2 ? two[1] : two[0];
  const before = labels((await X.call('chat.chat.read', { peer: X.K, before: Date.parse(newer.at), after: 0 })).body);
  const after = labels((await X.call('chat.chat.read', { peer: X.K, before: 0, after: Date.parse(older.at) })).body);
  return (before.length === 1 && before[0].seq === 1 && after.length === 1 && after[0].seq === 2) || false;
}, test.limit.quick);
