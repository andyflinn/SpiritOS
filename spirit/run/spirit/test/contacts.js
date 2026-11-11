'use strict';

// spirit/run/spirit/test/contacts.js
// The tests of spirit/contacts.js, and of the verb that sets a contact's star, contact.own (spec: ./contacts.md). This
// file holds goal/G41.30 (Andy: "NO signature. just the armingButton, with a precise documentation of the risk."; "so this
// button will put the star on relays and puppets. AND take it away."): a card is the other side's own word and sets no
// star; the button's verb, on a scratch node over a raw POST, does.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const contacts = require(path.join(RUN, 'spirit', 'contacts.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));
const nodeCard = require(path.join(RUN, 'spirit', 'nodeCard.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A card signed by that key, naming an owner.
function cardOf(id, owner, at) {
  const fields = { name: 'a puppet', description: 'd', publicKey: id.publicKey, sealKey: id.sealPublicKey || 'SEAL', at: at, owner: owner };
  return JSON.stringify({ v: 1, body: Object.assign({ ok: true }, fields, { sig: auth.sign(id.privateKey, nodeCard.signable(fields)) }) });
}

// What the tests share: the scratch home of the card part, and the scratch node of the verb's part.
const W = {};

// A signed card naming this node as its owner.
test.run('the card is kept', 0.2, function () {
  W.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contacts-'));
  fs.mkdirSync(path.join(W.home, 'spirit', 'state'), { recursive: true });
  // This node, as its identity file holds it (relayAuth.loadIdentity reads it from here).
  W.me = auth.generateIdentity('me');
  fs.writeFileSync(path.join(W.home, 'spirit', 'state', 'identity.json'), JSON.stringify(W.me));
  W.seen = nodeStore.open(W.home).seen;
  W.puppet = auth.generateIdentity('puppet');
  W.seen.set(W.puppet.publicKey, { keep: true });
  const said = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, W.me.publicKey, 1));
  W.row = W.seen.get(W.puppet.publicKey) || {};
  return (said.ok === true && !!W.row.card) || 'setCard: ' + short(said) + ', card kept ' + !!W.row.card;
}, 2000);
test.run('and sets no star: anyone can sign a card naming this node', 0.8, function () {
  if (!W.row) return 'no card set: the test before it failed';
  return !W.row.mine || 'the card set the star: ' + short({ mine: W.row.mine });
}, 1000);
// A card naming another owner.
test.run('takes no star away: only the button does', 0.8, function () {
  if (!W.seen) return 'no store: the first test failed';
  const seen = W.seen;
  seen.set(W.puppet.publicKey, { mine: true });
  const other = auth.generateIdentity('other');
  const said2 = contacts.setCard(W.home, W.puppet.publicKey, cardOf(W.puppet, other.publicKey, 2));
  return (said2.ok === true && !!(seen.get(W.puppet.publicKey) || {}).mine) || 'setCard ' + short(said2) + ', mine ' + (seen.get(W.puppet.publicKey) || {}).mine;
}, 1000);

// /api/spirit contact.own: the button's verb.
const call = async function (name, args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
  const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
// The star, as the list reads it: contact.search with its yes-filter, whatever else the row is.
const mine = async function () { const g = await call('contact.search', { q: '', mine: 'yes' }); return ((g.body && g.body.items) || []).some(function (i) { return i.key === W.KEY; }); };
const refused = function (r) { return r.status >= 400 && r.status < 500 && !!(r.body && r.body.code) && r.body.code !== 'no-such-verb' && r.body.code !== 'no-such-family'; };
function noNode() { return W.node && W.node.up ? null : 'no scratch node: the world failed'; }
test.run('the world: the scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return W.node.up || 'the scratch node did not come up: nothing judged';
}, 5000);
test.after(function () {
  try { if (W.home) fs.rmSync(W.home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
test.run('a row is there to star', 0.2, async function () {
  if (noNode()) return noNode();
  W.KEY = auth.generateIdentity('a contact').publicKey;
  const made = await call('contact.block', { publicKey: W.KEY, publicLabel: 'a contact' });
  await call('contact.unblock', { publicKey: W.KEY });
  return (made.status >= 200 && made.status < 300) || 'contact.block: ' + made.status + ' ' + short(made.text);
}, 1000);
test.run('a new row has no star', 0.2, async function () {
  if (noNode()) return noNode();
  return await mine() === false || 'before: ' + (await mine());
}, 1000);
test.run('contact.own {key, own: true} is answered', 0.2, async function () {
  if (noNode()) return noNode();
  const on = await call('contact.own', { key: W.KEY, own: true });
  return (on.status >= 200 && on.status < 300) || 'contact.own true: ' + on.status + ' ' + short(on.text);
}, 1000);
test.run('and puts the star on', 0.2, async function () {
  if (noNode()) return noNode();
  return await mine() === true || 'after own true: ' + (await mine());
}, 1000);
test.run('contact.own {key, own: false} takes it away', 0.2, async function () {
  if (noNode()) return noNode();
  const off = await call('contact.own', { key: W.KEY, own: false });
  return (off.status >= 200 && off.status < 300 && await mine() === false) || 'contact.own false: ' + off.status + ', mine ' + (await mine());
}, 1000);
test.run('a key with no row is refused with a code', 0.2, async function () {
  if (noNode()) return noNode();
  const unknown = await call('contact.own', { key: auth.generateIdentity('nobody').publicKey, own: true });
  return refused(unknown) || 'unknown key: ' + unknown.status + ' ' + short(unknown.text);
}, 1000);
test.run('own that is not true or false is refused, and nothing changes', 0.2, async function () {
  if (noNode()) return noNode();
  const notBool = await call('contact.own', { key: W.KEY, own: 'yes' });
  return (refused(notBool) && await mine() === false) || 'own "yes": ' + notBool.status + ' ' + short(notBool.text);
}, 1000);
test.run('a key of the wrong type is refused', 0.2, async function () {
  if (noNode()) return noNode();
  const badKey = await call('contact.own', { key: 12345, own: true });
  return refused(badKey) || 'key 12345: ' + badKey.status + ' ' + short(badKey.text);
}, 1000);
