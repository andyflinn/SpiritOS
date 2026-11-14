'use strict';

// spirit/run/spirit/app/chat/test/api.js
// The tests of spirit/app/chat/api.js, and of no other module (spec: ./api.md; goal/G43.31). The box: "nodeChat.js ...
// its verbs as api.js lists them", and "The branch name is the folder's: chat ... the verbs are chat.<verb>". Read from
// the disc; then on a scratch node of its own with the app switched on, the node's own answer for the branch and every
// verb it lists asked as the owner asks it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// What the tests make, for the tests after them.
const X = { verbs: null, node: null, call: null };
const NO_NODE = 'no scratch node: the world failed';
test.after(function () {
  const node = X.node;
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// ── the interface: verbs and their rules, and no code ──
test.run('it lists its verbs', 0.2, function () {
  try { X.verbs = require(FILE).verbs; } catch (e) { X.verbs = null; }
  return !!X.verbs && typeof X.verbs === 'object' && Object.keys(X.verbs).length > 0 ? true : 'api.js lists no verbs';
}, test.limit.quick);
test.run('it requires no code: it is an interface only', 0.2, function () {
  return !/require\s*\(/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')) ? true : 'api.js requires code';
}, test.limit.quick);
test.run('it lists line.write, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['line.write'] ? true : 'api.js lists no line.write';
}, test.limit.quick);
test.run('it lists line.receive, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['line.receive'] ? true : 'api.js lists no line.receive';
}, test.limit.quick);
test.run('it lists chat.read, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chat.read'] ? true : 'api.js lists no chat.read';
}, test.limit.quick);
test.run('it lists chat.search, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chat.search'] ? true : 'api.js lists no chat.search';
}, test.limit.quick);
test.run('it lists chats.search, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chats.search'] ? true : 'api.js lists no chats.search';
}, test.limit.quick);

test.run('the world: switched on, the server answers', 0.2, async function () {
  const node = X.node = await H.scratchNode();
  if (!node.up) return 'no scratch node: nothing judged';
  X.call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  await X.call('app.active', { key: 'chat', active: true });
  const up = await H.until(function () { return X.call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
  return up ? true : 'chat.chats.search never answered 200: ' + short((await X.call('chat.chats.search', {})).text);
}, test.limit.slow);

// ── the node finds it as the branch chat, the folder's name ──
test.run('api {family: chat} answers spirit/app/chat/api.js, word for word', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const fam = await X.call('api', { family: 'chat' });
  return fam.status === 200 && !!fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8') ? true : 'api {family: chat}: ' + fam.status + ' ' + short(fam.text);
}, test.limit.quick);
test.run('and api {family: chatClerver} answers none', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const old = await X.call('api', { family: 'chatClerver' });
  return !(old.status === 200 && old.body && old.body.interface) ? true : 'api {family: chatClerver} still answers: ' + short(old.text);
}, test.limit.quick);

// ── every verb it lists is served as chat.<verb> ──
// Each verb its interface lists, written out so that each check has a plain title of its own.
const served = async function (v) {
  if (!X.call) return NO_NODE;
  const r = await X.call('chat.' + v, {});
  return r.status !== 404 && !/no.such.verb/i.test(r.text) ? true : 'chat.' + v + ' answered ' + r.status + ', no-such-verb: ' + short(r.text);
};
test.run('chat.chat.read is a verb of the node', 0.2, function () { return served('chat.read'); }, test.limit.quick);
test.run('chat.chat.search is a verb of the node', 0.2, function () { return served('chat.search'); }, test.limit.quick);
test.run('chat.chats.search is a verb of the node', 0.2, function () { return served('chats.search'); }, test.limit.quick);
test.run('chat.line.receive is a verb of the node', 0.2, function () { return served('line.receive'); }, test.limit.quick);
test.run('chat.line.write is a verb of the node', 0.2, function () { return served('line.write'); }, test.limit.quick);

// ── the attacker: arguments its rules refuse, before the server hears them ──
test.run('chat.read without the peer it requires is refused 400', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const noPeer = await X.call('chat.chat.read', { before: '', after: '' });
  return noPeer.status === 400 ? true : 'chat.read with no peer: ' + noPeer.status + ' ' + short(noPeer.body);
}, test.limit.quick);
test.run('line.write without the to it requires is refused 400', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const noTo = await X.call('chat.line.write', { text: 'zz to nobody' });
  return noTo.status === 400 ? true : 'line.write with no to: ' + noTo.status + ' ' + short(noTo.body);
}, test.limit.quick);
test.run('an argument it does not list is refused 400', 0.2, async function () {
  if (!X.call) return NO_NODE;
  const stray = await X.call('chat.chats.search', { zz: 1 });
  return stray.status === 400 ? true : 'chats.search {zz: 1}: ' + stray.status + ' ' + short(stray.body);
}, test.limit.quick);
