'use strict';

// spirit/run/spirit/test/contacts.js
// The tests of spirit/contacts.js, and of the verb that sets a contact's star, contact.own (spec: ./contacts.md). This
// file holds goal/G41.30 (Andy: "NO signature. just the armingButton, with a precise documentation of the risk."; "so this
// button will put the star on relays and puppets. AND take it away."): a card is the other side's own word and sets no
// star; the button's verb, on a scratch node over a raw POST, does.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/contacts/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/contacts'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
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
  W.seen = nodeStore.open(W.home).seen;
  W.puppet = auth.generateIdentity('puppet');
  W.seen.set(W.puppet.publicKey, { keep: true });
  const said = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, W.me.publicKey, 1));
  W.row = W.seen.get(W.puppet.publicKey) || {};
  return (said.ok === true && !!W.row.card) || false;
}, test.limit.quick);
test.run('a card naming this node as its owner sets no star, because anyone can sign such a card', 0.8, function () {
  if (!W.row) return false;
  return !W.row.mine || false;
}, test.limit.quick);
// A card naming another owner.
test.run('a card naming another owner takes no star away, because only the button does that', 0.8, function () {
  if (!W.seen) return false;
  const seen = W.seen;
  seen.set(W.puppet.publicKey, { mine: true });
  const other = auth.generateIdentity('other');
  const said2 = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, other.publicKey, 2));
  return (said2.ok === true && !!(seen.get(W.puppet.publicKey) || {}).mine) || false;
}, test.limit.quick);

// /api/spirit contact.own: the button's verb.
const call = async function (name, args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
  const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
// The star, as the list reads it: contact.search with its yes-filter, whatever else the row is.
const mine = async function () { const g = await call('contact.search', { q: '', mine: 'yes' }); return ((g.body && g.body.items) || []).some(function (i) { return i.key === W.KEY; }); };
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
test.run('a row is there to star', 0.2, async function () {
  if (noNode()) return false;
  W.KEY = auth.generateIdentity('a contact').publicKey;
  const made = await call('contact.block', { publicKey: W.KEY, publicLabel: 'a contact' });
  await call('contact.unblock', { publicKey: W.KEY });
  return (made.status >= 200 && made.status < 300) || false;
}, test.limit.quick);
test.run('a new row has no star', 0.2, async function () {
  if (noNode()) return false;
  return await mine() === false || false;
}, test.limit.quick);
test.run('contact.own with a key and own set to true is answered', 0.2, async function () {
  if (noNode()) return false;
  const on = await call('contact.own', { key: W.KEY, own: true });
  return (on.status >= 200 && on.status < 300) || false;
}, test.limit.quick);
test.run('contact.own with own set to true puts the star on', 0.2, async function () {
  if (noNode()) return false;
  return await mine() === true || false;
}, test.limit.quick);
test.run('contact.own with own set to false takes the star away', 0.2, async function () {
  if (noNode()) return false;
  const off = await call('contact.own', { key: W.KEY, own: false });
  return (off.status >= 200 && off.status < 300 && await mine() === false) || false;
}, test.limit.quick);
test.run('a key with no row is refused with a code', 0.2, async function () {
  if (noNode()) return false;
  const unknown = await call('contact.own', { key: auth.generateIdentity('nobody').publicKey, own: true });
  return refused(unknown) || false;
}, test.limit.quick);
test.run('own that is not true or false is refused, and nothing changes', 0.2, async function () {
  if (noNode()) return false;
  const notBool = await call('contact.own', { key: W.KEY, own: 'yes' });
  return (refused(notBool) && await mine() === false) || false;
}, test.limit.quick);
test.run('a key of the wrong type is refused', 0.2, async function () {
  if (noNode()) return false;
  const badKey = await call('contact.own', { key: 12345, own: true });
  return refused(badKey) || false;
}, test.limit.quick);
