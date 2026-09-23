'use strict';
const rollOf = require('./rollOf');

// spirit/test/labelIsOwned.js
// A PUBLIC LABEL BELONGS TO THE KEY THAT WEARS IT.
//
//   Andy: "after enrollment the public label of an ID is property of the
//   ID, it must persist on the relay. A contract would say, the relay
//   owner will not be allowed to control the public label of any keyed
//   peer."
//
// design/cycles/2026-09-15-labels-are-not-identities.md, D1 and D2.
//
// ── TWO THINGS, AND THEY ARE ONE THING ───────────────────────────────
//
// D1  ONE FIELD. A peer row carried `name` AND `publicLabel`, set to the
//     same string at claim, and `who()` published both. Two spellings of
//     one fact on a public route: every reader had to know which to
//     trust, and none could be told apart.
//
// D2  AND THE KEY MAY MOVE IT. A label the owner chose and nobody could
//     change was not the ID's property; it was the relay's opinion of
//     somebody, published forever.
//
// The first had to land before a stability claim, because it changes the
// roll shape. The second adds no route and no signed format at all —
// it rides the post that already exists (decision 0010's collapse), so
// the protocol register does not move for it.
//
// ── WHAT MUST NOT MOVE ───────────────────────────────────────────────
//
// `claimedAt` is the enrolment ledger's one date. It says when the KEY
// joined, which stays true whatever the label does, and it is the
// human-usable way to tell two johns apart — "the john who joined in
// March" rather than six characters of key. A rename that touched it
// would turn an old member into a new one on every screen.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const world = require('./world');

// Two johns, because duplicate labels are the case every rule here has
// to survive.
const SCENARIO = {
  title: 'An owner and two johns',
  peers: [{ name: 'johnA', label: 'john' }, { name: 'johnB', label: 'john' }],
};

function labels(box) {
  return rollOf(box).map(function (p) { return p.publicLabel; }).sort().join(',');
}

test.startTest('A public label is owned by its key');

// ---------------------------------------------------------------------
test.subHeading('One field, on the row and on the wire');
// ---------------------------------------------------------------------

{
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const row = rollOf(L.box)[0];
  if (row.publicLabel && row.name === undefined) {
    test.check('a roll row says a peer’s label once, under publicLabel');
  } else {
    test.fail('roll row: ' + JSON.stringify(row));
  }

  // ON DISK TOO, or the collapse is cosmetic: a file still carrying both
  // is a file the next reader has to reconcile.
  // Read off the relay's disc (relay.db since cycle 3), not asked of it.
  const stored = rollOf(L.box);
  if (stored.every(function (p) { return p.publicLabel && p.name === undefined; })) {
    test.check('and so does the row it was written from');
  } else {
    test.fail('stored: ' + JSON.stringify(stored));
  }

  // EVERY ROW IS KEYED BY ITS KEY. The map was `publicKey || n`, so a
  // keyless claim filed a row under a LABEL — which is what made
  // `findByLabel` need a keyless branch and kept `name` alive.
  // Since cycle 3 the key IS the members table's primary key, so a row
  // filed under anything else cannot exist; what is left to check is that
  // every row has one.
  if (stored.length && stored.every(function (p) { return typeof p.publicKey === 'string' && p.publicKey; })) {
    test.check('and every row is filed under its key, never its label');
  } else {
    test.fail('keys: ' + JSON.stringify(stored.map(function (p) { return p.publicKey; })));
  }

  // WHICH MEANS A CLAIM NEEDS ONE. The only path that ever admitted a
  // keyless claim was `open` mode with peers already present — reachable
  // only by deleting allow.json by hand. A row that cannot open a
  // stream, post, be posted to, or be told apart from another wearing
  // the same label is worse than no row.
  const keyless = L.box.claim('ghost', null, null, '10.0.0.9');
  if (!keyless.ok && keyless.status === 400) {
    test.check('a claim with no key is refused, so there is no second kind of row');
  } else {
    test.fail('keyless claim: ' + JSON.stringify(keyless));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A row written by older code is read, not reconciled');
// ---------------------------------------------------------------------

{
  // A relay upgrading in place has rows carrying the old field. Since
  // cycle 3 the one-time import (D8, design/DEPRECATIONS.md) is what reads
  // them, folding `name` into `publicLabel` on the way into relay.db —
  // so this writes an old-style routingTable.json into a relay home that
  // has never opened its store, and lets the import find it.
  const oldHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-oldrows-'));
  fs.mkdirSync(path.join(oldHome, 'relay-state'), { recursive: true });
  const olds = { andy: auth.generateIdentity('andy'), bert: auth.generateIdentity('bert') };
  const doc = { peers: {} };
  Object.keys(olds).forEach(function (label) {
    const k = olds[label].publicKey;
    doc.peers[k] = { publicKey: k, name: label, claimedAt: new Date().toISOString(), owner: label === 'andy' };
  });
  fs.writeFileSync(path.join(oldHome, 'relay-state', 'routingTable.json'), JSON.stringify(doc));

  const reopened = require('../run/js/relay').createRelay(oldHome);
  const seen = rollOf(reopened).map(function (p) { return p.publicLabel; }).sort();
  if (seen.join(',') === 'andy,bert') {
    test.check('a row carrying only `name` comes back with its label intact');
  } else {
    test.fail('after reopen: ' + JSON.stringify(seen));
  }

  if (rollOf(reopened).every(function (p) { return p.name === undefined; })) {
    test.check('and `name` does not survive the read');
  } else {
    test.fail('name survived: ' + JSON.stringify(rollOf(reopened)));
  }
}

// ---------------------------------------------------------------------
test.subHeading('The key may move its label; nobody else may');
// ---------------------------------------------------------------------

{
  const L = world.build(SCENARIO);
  const johnA = L.peer('johnA');

  const renamed = world.ask(L.box, johnA, { rename: { label: 'johnny' } });
  if (renamed.answer && renamed.answer.ok && renamed.answer.was === 'john' &&
      renamed.answer.label === 'johnny') {
    test.check('a peer renames itself, and is told what it was and what it is');
  } else {
    test.fail('rename: ' + JSON.stringify(renamed.answer));
  }

  if (labels(L.box) === 'andy,john,johnny') {
    test.check('and the roll says so — one john moved, the other did not');
  } else {
    test.fail('roll: ' + labels(L.box));
  }

  // THE CONTRACT. There is no key field on the verb at all, so the owner
  // cannot name somebody else's row — not refused, unexpressible. That
  // is the difference from removePeer, which deliberately DOES have an
  // owner path: evicting somebody is the owner's business, renaming them
  // is not.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
  const verb = src.split('body.rename')[1] || '';
  if (verb.slice(0, 200).indexOf('.key') === -1 && /renameSelf\(who,/.test(verb)) {
    test.check('the verb takes no key — the owner cannot rename a peer, it is not expressible');
  } else {
    test.fail('rename verb reads a key: ' + verb.slice(0, 200));
  }

  // And the owner renaming ITSELF is fine, because that is its own row.
  const ownerMoved = world.ask(L.box, L.owner, { rename: { label: 'chief' } });
  if (ownerMoved.answer && ownerMoved.answer.ok) {
    test.check('while the owner may rename its own row, which is the same permission');
  } else {
    test.fail('owner rename: ' + JSON.stringify(ownerMoved.answer));
  }
}

// ---------------------------------------------------------------------
test.subHeading('What a rename must not break');
// ---------------------------------------------------------------------

{
  const L = world.build(SCENARIO);
  const johnA = L.peer('johnA');
  const before = rollOf(L.box)
    .filter(function (p) { return p.publicKey === johnA.publicKey; })[0];

  world.ask(L.box, johnA, { rename: { label: 'johnny' } });
  const after = rollOf(L.box)
    .filter(function (p) { return p.publicKey === johnA.publicKey; })[0];

  // THE LEDGER'S ONE DATE. It says when the KEY enrolled — the fact that
  // tells two johns apart — and a rename that moved it would make an old
  // member look new on every screen that reads it.
  if (after.claimedAt === before.claimedAt && after.claimedAt) {
    test.check('claimedAt does not move — the ledger records the key, not the name');
  } else {
    test.fail('claimedAt: ' + before.claimedAt + ' -> ' + after.claimedAt);
  }

  if (after.publicKey === before.publicKey && after.owner === before.owner) {
    test.check('and neither does the key, nor whether they own the box');
  } else {
    test.fail('row drifted: ' + JSON.stringify(after));
  }

  // DUPLICATES ARE ALLOWED, so renaming INTO one is allowed. Two johns
  // are two keys and always were; refusing here would invent a scarcity
  // the rest of the box does not have.
  const back = world.ask(L.box, johnA, { rename: { label: 'john' } });
  if (back.answer && back.answer.ok && labels(L.box) === 'andy,john,john') {
    test.check('renaming into a label somebody else wears is allowed — two johns are two keys');
  } else {
    test.fail('duplicate rename: ' + JSON.stringify(back.answer) + ' ' + labels(L.box));
  }

  // A LIVE INVITE IS THE ONE REFUSAL, and the reason is a third party
  // who is not in this conversation: renaming into a reserved label
  // leaves a token nobody can ever redeem, because the claim it unlocks
  // would collide with the row that just took the name.
  L.box.mint('andy', 'saint', 7, 'tok');
  const onInvite = world.ask(L.box, johnA, { rename: { label: 'saint' } });
  if (onInvite.answer && onInvite.answer.ok === false &&
      onInvite.answer.status === 409) {
    test.check('but not onto a label a live invite is holding — that would strand the invitee');
  } else {
    test.fail('invite clash: ' + JSON.stringify(onInvite.answer));
  }

  // AN EXPIRED ONE MUST NOT BLOCK A LIVING PERSON. Swept first, the same
  // "any attempt tidies up" rule redeem follows.
  const rows = invites.load(L.home);
  rows.push({
    token: 'dead', label: 'ghosted', invitedBy: 'andy',
    expiresAt: new Date(Date.now() - 60000).toISOString(),
  });
  fs.writeFileSync(path.join(L.home, 'relay-state', 'invites.json'), JSON.stringify(rows));
  const overDead = world.ask(L.box, johnA, { rename: { label: 'ghosted' } });
  if (overDead.answer && overDead.answer.ok) {
    test.check('and an expired one is swept rather than obeyed');
  } else {
    test.fail('expired invite blocked a rename: ' + JSON.stringify(overDead.answer));
  }

  // THE RESERVED NAME IS STILL RESERVED. A namespace rule, and a rename
  // is another way in that has to obey it.
  const grab = world.ask(L.box, johnA, { rename: { label: auth.RESERVED_NAME } });
  if (grab.answer && grab.answer.ok === false) {
    test.check('and the reserved name cannot be taken by renaming into it either');
  } else {
    test.fail('reserved name taken: ' + JSON.stringify(grab.answer));
  }
}

// ---------------------------------------------------------------------
test.subHeading('The owner’s label lives in two places, and they move together');
// ---------------------------------------------------------------------

{
  // `allow.json` identifies the owner by NAME — `ownerName()` is its
  // first key, and every owner check resolves through it. An owner whose
  // peer row said `chief` while allow.json still said `andy` would be
  // locked out of its own relay: not refused, simply not recognised.
  const L = world.build({ title: 'owner and a member', peers: ['bert'] });

  const moved = world.ask(L.box, L.owner, { rename: { label: 'chief' } });
  if (moved.answer && moved.answer.ok &&
      auth.ownerName(auth.loadAllow(L.home)) === 'chief') {
    test.check('renaming the owner moves allow.json in the same act');
  } else {
    test.fail('allow.json: ' + auth.ownerName(auth.loadAllow(L.home)) +
      ' answer=' + JSON.stringify(moved.answer));
  }

  // PROVED BY USE, not by reading the file. Every owner verb, after the
  // rename — because "locked out of its own box" is the failure this
  // guards, and it would look exactly like a quiet relay.
  const mint = world.ask(L.box, L.owner, { invite: { label: 'guest', days: 7, token: 'tok' } });
  const mon = world.ask(L.box, L.owner, { monitor: { on: true } });
  const rm = world.ask(L.box, L.owner, { removePeer: { key: L.peer('bert').publicKey } });
  if (mint.answer && mint.answer.ok && mon.answer && mon.answer.ok &&
      rm.answer && rm.answer.ok) {
    test.check('and the owner still mints, monitors and removes under its new name');
  } else {
    test.fail('after rename: mint=' + JSON.stringify(mint.answer) +
      ' monitor=' + JSON.stringify(mon.answer) + ' remove=' + JSON.stringify(rm.answer));
  }

  // AND THERE IS ONE AUTHORITY. This asserted "one owner row in the
  // roll" — a row flag that could disagree with allow.json. Since
  // 2026-09-19 no row carries one (Andy: "a row in the roll doesn't know
  // who the owner is"), so the relay's own answer is asserted instead.
  const named = L.box.ownerPublic();
  const ownRow = rollOf(L.box).filter(function (p) { return p.publicKey === L.owner.publicKey; })[0];
  if (named.ownerKey === L.owner.publicKey && named.ownerLabel === 'chief' &&
      ownRow && ownRow.publicLabel === 'chief' && !('owner' in ownRow)) {
    test.check('the relay names the owner under the new label, and no row claims to');
  } else {
    test.fail('ownerPublic ' + JSON.stringify(named) + ' row ' + JSON.stringify(ownRow));
  }
}

// ---------------------------------------------------------------------
test.subHeading('And the owner hears about it');
// ---------------------------------------------------------------------

{
  // R2's category: a member changing what they are called is a
  // membership fact. An owner watching a new name appear in the roll
  // with no record of how it got there is the gap that category exists
  // to close.
  const L = world.build(SCENARIO);
  const sink = { lines: [], write: function (c) { this.lines.push(String(c)); }, close: function () {} };
  L.box.streamOpen(L.owner.publicKey,
    auth.sign(L.owner.privateKey, auth.streamMessage(L.owner.publicKey)), sink);

  const before = sink.lines.length;
  world.ask(L.box, L.peer('johnA'), { rename: { label: 'johnny' } });
  const said = sink.lines.slice(before)
    .filter(function (c) { return /event: owner-event/.test(c); })
    .map(function (c) { try { return JSON.parse(/data: (.*)/.exec(c)[1]); } catch (e) { return {}; } });

  const one = said.filter(function (e) { return e.kind === 'peer-renamed'; })[0];
  if (one && one.was === 'john' && one.label === 'johnny' &&
      one.key === L.peer('johnA').publicKey) {
    test.check('a rename reaches the owner’s log, naming what it was, what it is, and whose');
  } else {
    test.fail('owner events: ' + JSON.stringify(said));
  }
}

// ---------------------------------------------------------------------
test.subHeading('It adds nothing to the protocol');
// ---------------------------------------------------------------------

{
  // The point of decision 0010's collapse: a relay is addressable by its
  // members, so a new capability is a new BODY on an existing post — not
  // a route and not a signed format. The register does not move for
  // this, and protocolSurface.js would go red if it had.
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'server.js'), 'utf8');
  if (src.indexOf('/api/relay/rename') === -1) {
    test.check('no route was added for it');
  } else {
    test.fail('a rename route exists');
  }

  const authSrc = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'relayAuth.js'), 'utf8');
  if (!/function renameMessage/.test(authSrc)) {
    test.check('and no signed format — it rides the post that was already there');
  } else {
    test.fail('a renameMessage format exists');
  }
}

test.reportSuccessFailureCount();
