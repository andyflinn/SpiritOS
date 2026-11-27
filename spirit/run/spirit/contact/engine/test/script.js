'use strict';

// spirit/run/spirit/contact/engine/test/script.js
// The tests of spirit/contact/engine/script.js: where the star comes from, and the verb that sets 😏, contact.faceable (spec:
// ./contacts.md). This file holds goal/G47.4 (box v33: "the star is shown as before on nodes and relays and is set only by
// true ownership (the signed card names this node as owner); no button or verb changes it", "😏 is the row field faceable,
// set by the new verb contact.faceable {key, faceable}, for a relay this node holds a seat on only", "contact.own goes"):
// a card sets the star; no verb does. Its relay half, 😏 on a seated relay, is in ./hub.js.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/contact/engine/test/script/' + name + tempAsked); }
// Its store closed first: on Windows a folder holding an open database cannot be removed, and the suite was red on
// 'it leaves no temp folder behind' for that alone.
test.after(function () { try { if (W.store) W.store.close(); } catch (e) { /* closed */ } try { fs.rmSync(tempFolder.path('spirit/contact/engine/test/script'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
// A file not there yet is no crash at load: each check below finds nothing and is red (goal/G49.4, the move).
let contacts = {};
try { contacts = LOADER.requireScript('spirit/contact/engine/script.js'); } catch (e) { contacts = {}; }
const nodeStore = LOADER.requireScript('spirit/nodeStore/script.js');
const nodeCard = LOADER.requireScript('spirit/nodeCard/script.js');
const auth = LOADER.requireScript('spirit/relayAuth/script.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');


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

// /spirit on a scratch node, over a raw POST. goal/G49.22: the branch's calls are spirit.contact.<verb> (were contact.<verb>).
const call = async function (name, args) {
  const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
  const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
// The star, as the list reads it: contact.search with its yes-filter, whatever else the row is.
const starred = async function (key) { const g = await call('spirit.contact.search', { q: '', mine: true }); return ((g.body && g.body.items) || []).some(function (i) { return i.key === key; }); };
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
  try { if (node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});
const runOf = function () { return W.node.run || path.join(W.node.root, 'spirit', 'run'); };
// A row of the scratch node's table, its signed card naming that owner.
const rowWithCard = async function (label, owner) {
  const id = auth.generateIdentity(label);
  await call('spirit.contact.block', { publicKey: id.publicKey, publicLabel: label });
  await call('spirit.contact.unblock', { publicKey: id.publicKey });
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
test.run('spirit.contact.own is no verb', 0.2, async function () {
  if (noNode()) return false;
  const gone = await call('spirit.contact.own', { key: W.KEY, own: false });
  return (gone.status >= 400 && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('spirit.contact.faceable refuses a node with a code, and its star stays', 0.2, async function () {
  if (noNode()) return false;
  const onNode = await call('spirit.contact.faceable', { key: W.KEY, faceable: true });
  return (refused(onNode) && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('spirit.contact.faceable taking 😏 off changes no star', 0.2, async function () {
  if (noNode()) return false;
  const off = await call('spirit.contact.faceable', { key: W.KEY, faceable: false });
  return (off.status === 200 && await starred(W.KEY)) || false;
}, test.limit.quick);
test.run('a key with no row is refused with a code', 0.2, async function () {
  if (noNode()) return false;
  const unknown = await call('spirit.contact.faceable', { key: auth.generateIdentity('nobody').publicKey, faceable: true });
  return refused(unknown) || false;
}, test.limit.quick);
test.run('faceable that is not true or false is refused', 0.2, async function () {
  if (noNode()) return false;
  const notBool = await call('spirit.contact.faceable', { key: W.KEY, faceable: 'yes' });
  return refused(notBool) || false;
}, test.limit.quick);
test.run('a key of the wrong type is refused', 0.2, async function () {
  if (noNode()) return false;
  const badKey = await call('spirit.contact.faceable', { key: 12345, faceable: true });
  return refused(badKey) || false;
}, test.limit.quick);
