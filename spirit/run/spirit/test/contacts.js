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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A card signed by that key, naming an owner.
function cardOf(id, owner, at) {
  const fields = { name: 'a puppet', description: 'd', publicKey: id.publicKey, sealKey: id.sealPublicKey || 'SEAL', at: at, owner: owner };
  return JSON.stringify({ v: 1, body: Object.assign({ ok: true }, fields, { sig: auth.sign(id.privateKey, nodeCard.signable(fields)) }) });
}

test.startTest('contacts.js: a card sets no star; contact.own does (goal/G41.30)');

(async function () {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contacts-'));
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  // This node, as its identity file holds it (relayAuth.loadIdentity reads it from here).
  const me = auth.generateIdentity('me');
  fs.writeFileSync(path.join(home, 'spirit', 'state', 'identity.json'), JSON.stringify(me));
  const seen = nodeStore.open(home).seen;

  test.subHeading('a signed card naming this node as its owner');
  const puppet = auth.generateIdentity('puppet');
  seen.set(puppet.publicKey, { keep: true });
  const said = contacts.setCard(home, puppet.publicKey, cardOf(puppet, me.publicKey, 1));
  const row = seen.get(puppet.publicKey) || {};
  ok(said.ok === true && !!row.card, 'the card is kept', 'setCard: ' + short(said) + ', card kept ' + !!row.card);
  ok(!row.mine, 'and sets no star: anyone can sign a card naming this node', 'the card set the star: ' + short({ mine: row.mine }));

  test.subHeading('a card naming another owner');
  seen.set(puppet.publicKey, { mine: true });
  const other = auth.generateIdentity('other');
  const said2 = contacts.setCard(home, puppet.publicKey, cardOf(puppet, other.publicKey, 2));
  ok(said2.ok === true && !!(seen.get(puppet.publicKey) || {}).mine, 'takes no star away: only the button does', 'setCard ' + short(said2) + ', mine ' + (seen.get(puppet.publicKey) || {}).mine);
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  test.subHeading('/api/spirit contact.own: the button\'s verb');
  const node = await scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
      const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, body: body, text: text };
    };
    const KEY = auth.generateIdentity('a contact').publicKey;
    const made = await call('contact.block', { publicKey: KEY, publicLabel: 'a contact' });
    await call('contact.unblock', { publicKey: KEY });
    ok(made.status >= 200 && made.status < 300, 'a row is there to star', 'contact.block: ' + made.status + ' ' + short(made.text));
    // The star, as the list reads it: contact.search with its yes-filter, whatever else the row is.
    const mine = async function () { const g = await call('contact.search', { q: '', mine: 'yes' }); return ((g.body && g.body.items) || []).some(function (i) { return i.key === KEY; }); };
    ok(await mine() === false, 'a new row has no star', 'before: ' + (await mine()));
    const on = await call('contact.own', { key: KEY, own: true });
    ok(on.status >= 200 && on.status < 300, 'contact.own {key, own: true} is answered', 'contact.own true: ' + on.status + ' ' + short(on.text));
    ok(await mine() === true, 'and puts the star on', 'after own true: ' + (await mine()));
    const off = await call('contact.own', { key: KEY, own: false });
    ok(off.status >= 200 && off.status < 300 && await mine() === false, 'contact.own {key, own: false} takes it away', 'contact.own false: ' + off.status + ', mine ' + (await mine()));
    const refused = function (r) { return r.status >= 400 && r.status < 500 && !!(r.body && r.body.code) && r.body.code !== 'no-such-verb' && r.body.code !== 'no-such-family'; };
    const unknown = await call('contact.own', { key: auth.generateIdentity('nobody').publicKey, own: true });
    ok(refused(unknown), 'a key with no row is refused with a code', 'unknown key: ' + unknown.status + ' ' + short(unknown.text));
    const notBool = await call('contact.own', { key: KEY, own: 'yes' });
    ok(refused(notBool) && await mine() === false, 'own that is not true or false is refused, and nothing changes', 'own "yes": ' + notBool.status + ' ' + short(notBool.text));
    const badKey = await call('contact.own', { key: 12345, own: true });
    ok(refused(badKey), 'a key of the wrong type is refused', 'key 12345: ' + badKey.status + ' ' + short(badKey.text));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
