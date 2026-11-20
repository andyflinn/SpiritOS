'use strict';

// spirit/run/spirit/app/chat/test/api.js
// The tests of spirit/app/chat/api.js, and of no other module (spec: ./api.md; goal/G43.31). The box: "chat/server/server.js ...
// its verbs as api.js lists them", and "The branch name is the folder's: chat ... the verbs are chat.<verb>". Read from
// the disc; then on a scratch node of its own with the app switched on, the node's own answer for the branch and every
// verb it lists asked as the owner asks it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

// What the tests make, for the tests after them.
const X = { verbs: null, node: null, call: null };
test.after(function () {
  const node = X.node;
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// ── the interface: verbs and their rules, and no code ──
test.run('it lists its verbs', 0.2, function () {
  try { X.verbs = require(FILE).verbs; } catch (e) { X.verbs = null; }
  return !!X.verbs && typeof X.verbs === 'object' && Object.keys(X.verbs).length > 0 ? true : false;
}, test.limit.quick);
// AN INTERFACE AND ITS COMPANION DATA, NOTHING ELSE (goal/G47.1; Andy's rule, newer than this check's "requires no code": "every
// api.js requires it's companion data.js, and is the only script to require that data.js"): every require it makes names
// spirit.js or spirit/app/chat/data.js, and nothing else.
test.run('it requires nothing but spirit.js and its companion data.js: it is an interface', 0.2, function () {
  const src = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const names = (src.match(/require\s*\(\s*['"][^'"]+['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\s*\(\s*['"]|['"]\s*\)$/g, ''); });
  return names.length > 0 && names.every(function (n) { return /(^|\/)spirit\.js$/.test(n) || n === 'spirit/app/chat/data.js'; }) ? true : false;
}, test.limit.quick);
test.run('it lists line.write, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['line.write'] ? true : false;
}, test.limit.quick);
test.run('it lists line.receive, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['line.receive'] ? true : false;
}, test.limit.quick);
test.run('it lists chat.read, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chat.read'] ? true : false;
}, test.limit.quick);
test.run('it lists chat.search, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chat.search'] ? true : false;
}, test.limit.quick);
test.run('it lists chats.search, which the server serves', 0.2, function () {
  return X.verbs && X.verbs['chats.search'] ? true : false;
}, test.limit.quick);

test.run('on a scratch node with the chat app switched on, the chat server answers', 0.2, async function () {
  const node = X.node = await H.scratchNode();
  if (!node.up) return false;
  X.call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  await X.call('app.active', { key: 'chat', active: true });
  const up = await H.until(function () { return X.call('chat.chats.search', {}).then(function (r) { return r.status === 200; }); }, 40000);
  return up ? true : false;
}, test.limit.slow);

// ── the node finds it as the branch chat, the folder's name ──
test.run('asked for the interface of the family chat, the node answers spirit/app/chat/api.js word for word', 0.2, async function () {
  if (!X.call) return false;
  const fam = await X.call('api', { family: 'chat' });
  return fam.status === 200 && !!fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8') ? true : false;
}, test.limit.quick);
test.run('asked for the interface of the old family chatClerver, the node answers none', 0.2, async function () {
  if (!X.call) return false;
  const old = await X.call('api', { family: 'chatClerver' });
  return !(old.status === 200 && old.body && old.body.interface) ? true : false;
}, test.limit.quick);

// ── every verb it lists is served as chat.<verb> ──
// Each verb its interface lists, written out so that each check has a plain title of its own.
const served = async function (v) {
  if (!X.call) return false;
  const r = await X.call('chat.' + v, {});
  return r.status !== 404 && !/no.such.verb/i.test(r.text) ? true : false;
};
test.run('chat.chat.read is a verb of the node', 0.2, function () { return served('chat.read'); }, test.limit.quick);
test.run('chat.chat.search is a verb of the node', 0.2, function () { return served('chat.search'); }, test.limit.quick);
test.run('chat.chats.search is a verb of the node', 0.2, function () { return served('chats.search'); }, test.limit.quick);
test.run('chat.line.receive is a verb of the node', 0.2, function () { return served('line.receive'); }, test.limit.quick);
test.run('chat.line.write is a verb of the node', 0.2, function () { return served('line.write'); }, test.limit.quick);

// ── the attacker: arguments its rules refuse, before the server hears them ──
test.run('chat.read without the peer it requires is refused 400', 0.2, async function () {
  if (!X.call) return false;
  const noPeer = await X.call('chat.chat.read', { before: 0, after: 0 });
  return noPeer.status === 400 ? true : false;
}, test.limit.quick);
test.run('line.write without the to it requires is refused 400', 0.2, async function () {
  if (!X.call) return false;
  const noTo = await X.call('chat.line.write', { text: 'zz to nobody' });
  return noTo.status === 400 ? true : false;
}, test.limit.quick);
test.run('an argument it does not list is refused 400', 0.2, async function () {
  if (!X.call) return false;
  const stray = await X.call('chat.chats.search', { zz: 1 });
  return stray.status === 400 ? true : false;
}, test.limit.quick);
