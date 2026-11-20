'use strict';

// spirit/run/spirit/test/contacts.js
// The tests of spirit/contacts.js: where the star comes from, and the verb that sets 😏, contact.faceable (spec:
// ./contacts.md). This file holds goal/G47.4 (box v33: "the star is shown as before on nodes and relays and is set only by
// true ownership (the signed card names this node as owner); no button or verb changes it", "😏 is the row field faceable,
// set by the new verb contact.faceable {key, faceable}, for a relay this node holds a seat on only", "contact.own goes"):
// a card sets the star; no verb does. Its relay half, 😏 on a seated relay, is in ./hub.js.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/contacts/' + name + tempAsked); }
// Its store closed first: on Windows a folder holding an open database cannot be removed, and the suite was red on
// 'it leaves no temp folder behind' for that alone.
test.after(function () { try { if (W.store) W.store.close(); } catch (e) { /* closed */ } try { fs.rmSync(tempFolder.path('spirit/test/contacts'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const contacts = require(path.join(RUN, 'spirit', 'contacts.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));
const nodeCard = require(path.join(RUN, 'spirit', 'nodeCard.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));


// A card signed by that key, naming an owner.
function cardOf(id, owner, at) {
  const fields = { name: 'a puppet', description: 'd', publicKey: id.publicKey, sealKey: id.sealPublicKey || 'SEAL', at: at, owner: owner };
  return JSON.stringify({ v: 1, body: Object.assign({ ok: true }, fields, { sig: auth.sign(id.privateKey, nodeCard.signable(fields)) }) });
}

// What the tests share: the scratch home of the card part, and the scratch node of the verb's part.
const W = {};

// A signed card naming this node as its owner.
test.run('a signed card naming this node as its owner is kept', 0.2, function () {
  W.home = ownTemp('spirit-contacts-');
  fs.mkdirSync(path.join(W.home, 'spirit', 'state'), { recursive: true });
  // This node, as its identity file holds it (relayAuth.loadIdentity reads it from here).
  W.me = auth.generateIdentity('me');
  fs.writeFileSync(path.join(W.home, 'spirit', 'state', 'identity.json'), JSON.stringify(W.me));
  W.store = nodeStore.open(W.home);
  W.seen = W.store.seen;
  W.puppet = auth.generateIdentity('puppet');
  W.seen.set(W.puppet.publicKey, { keep: true });
  const said = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, W.me.publicKey, 1));
  W.row = W.seen.get(W.puppet.publicKey) || {};
  return (said.ok === true && !!W.row.card) || false;
}, test.limit.quick);
test.run('a card naming this node as its owner sets the star', 0.8, function () {
  if (!W.row) return false;
  return W.row.mine === true || false;
}, test.limit.quick);
// A newer card naming another owner.
test.run('a newer card naming another owner takes the star away', 0.8, function () {
  if (!W.seen) return false;
  const other = auth.generateIdentity('other');
  const said2 = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, other.publicKey, 2));
  return (said2.ok === true && (W.seen.get(W.puppet.publicKey) || {}).mine === false) || false;
}, test.limit.quick);
test.run('a newer card naming nobody leaves no star', 0.8, function () {
  if (!W.seen) return false;
  contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, W.me.publicKey, 3));
  const said3 = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, '', 4));
  return (said3.ok === true && (W.seen.get(W.puppet.publicKey) || {}).mine === false) || false;
}, test.limit.quick);

// /api/spirit on a scratch node, over a raw POST.
const call = async function (name, args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
  const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
// The star, as the list reads it: contact.search with its yes-filter, whatever else the row is.
const starred = async function (key) { const g = await call('contact.search', { q: '', mine: true }); return ((g.body && g.body.items) || []).some(function (i) { return i.key === key; }); };
const refused = function (r) { return r.status >= 400 && r.status < 500 && !!(r.body && r.body.code) && r.body.code !== 'no-such-verb' && r.body.code !== 'no-such-family'; };
function noNode() { return !(W.node && W.node.up); }
test.run('the scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return W.node.up || false;
}, test.limit.slow);
test.after(function () {
  try { if (W.home) fs.rmSync(W.home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});
const runOf = function () { return W.node.run || path.join(W.node.root, 'spirit', 'run'); };
// A row of the scratch node's table, its signed card naming that owner.
const rowWithCard = async function (label, owner) {
  const id = auth.generateIdentity(label);
  await call('contact.block', { publicKey: id.publicKey, publicLabel: label });
  await call('contact.unblock', { publicKey: id.publicKey });
  const said = contacts.setCard(runOf(), id.publicKey, cardOf(id, owner, 1));
  return said.ok === true ? id.publicKey : '';
};
test.run('a node whose card names the scratch node is starred, with no verb asked', 0.4, async function () {
  if (noNode()) return false;
  W.KEY = await rowWithCard('ours', auth.loadIdentity(runOf()).publicKey);
  return (!!W.KEY && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('a node whose card names another owner has no star', 0.4, async function () {
  if (noNode()) return false;
  const theirs = await rowWithCard('not ours', auth.generateIdentity('someone else').publicKey);
  return (!!theirs && !(await starred(theirs))) || false;
}, test.limit.quick);
test.run('contact.own is no verb any more', 0.2, async function () {
  if (noNode()) return false;
  const gone = await call('contact.own', { key: W.KEY, own: false });
  return (gone.status >= 400 && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('contact.faceable refuses a node with a code, and its star stays', 0.2, async function () {
  if (noNode()) return false;
  const onNode = await call('contact.faceable', { key: W.KEY, faceable: true });
  return (refused(onNode) && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('contact.faceable taking 😏 off changes no star', 0.2, async function () {
  if (noNode()) return false;
  const off = await call('contact.faceable', { key: W.KEY, faceable: false });
  return (off.status === 200 && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('a key with no row is refused with a code', 0.2, async function () {
  if (noNode()) return false;
  const unknown = await call('contact.faceable', { key: auth.generateIdentity('nobody').publicKey, faceable: true });
  return refused(unknown) || false;
}, test.limit.quick);
test.run('faceable that is not true or false is refused', 0.2, async function () {
  if (noNode()) return false;
  const notBool = await call('contact.faceable', { key: W.KEY, faceable: 'yes' });
  return refused(notBool) || false;
}, test.limit.quick);
test.run('a key of the wrong type is refused', 0.2, async function () {
  if (noNode()) return false;
  const badKey = await call('contact.faceable', { key: 12345, faceable: true });
  return refused(badKey) || false;
}, test.limit.quick);
