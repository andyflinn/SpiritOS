'use strict';

// spirit/test/memberBroadcast.js
// EVERY MEMBER HEARS WHAT IS NEW, AND HEARS ALL OF IT (R28, cycle 7).
//
//   Andy: "we ride route with the full row." — "if a sent a note, i may as
//   well put a hundred-dollar-bill in the enveloppe, too" — and "we let
//   relay broadcast all new info all the time." (0019, widened)
//
// A rename and a claim go out on the `route` event every node already
// merges, carrying the whole row; they stop at the partnership, and never
// go back to the member they are about.

const test = require('./testSupport.js');
const { sealFor } = require('./openReply');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const world = require('./world');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

function open(box, id, bag) {
  return box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor(bag));
}

function routesAbout(bag, key) {
  return bag.filter(function (m) { return m.event === 'route' && m.data && m.data.key === key; });
}

test.startTest('Every member hears what is new, whole');

const L = world.build({ title: 'three members and a partner', peers: ['bert', 'john', 'mary'] });
if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); process.exit(1); }
const box = L.box;
const relayKey = box.relayPublicKey();
const bert = L.peer('bert');
const john = L.peer('john');

// A partner on the roll. It used to hold a stream here, and the broadcast
// had to skip it; since R13 (cycle 8) a partner holds none, so "it stops at
// the partnership" is true by construction — checked below as a refusal.
const partner = auth.generateIdentity('relay-partner');
relayStore.open(L.home).partners.put({
  relayKey: partner.publicKey, url: 'http://partner.example', ownerKey: 'o', status: 'partnered', since: 'x',
});

const bertBag = [];
const johnBag = [];
const partnerBag = [];
open(box, bert, bertBag);
open(box, john, johnBag);
const partnerOpen = open(box, partner, partnerBag);

test.subHeading('A rename reaches every member, whole');

if (partnerOpen && partnerOpen.ok === false && partnerOpen.status === 403) {
  test.check('the partner cannot hold a stream here (R13), so no broadcast has a way to reach it');
} else {
  test.fail('a partner stream was admitted: ' + JSON.stringify(partnerOpen));
}

{
  const text = JSON.stringify({ v: 1, body: { rename: { label: 'johnny' } } });
  // Sealed, like every post to a relay (cycle 10, R9).
  const sending = sealFor(john, box, text);
  const r = box.routePost(john.publicKey, relayKey, sending,
    auth.sign(john.privateKey, auth.postMessage(john.publicKey, relayKey, sending)));
  const heard = routesAbout(bertBag, john.publicKey).pop();
  if (r && r.ok !== false && heard && heard.data.label === 'johnny' && heard.data.at === relayKey &&
      heard.data.present === true && typeof heard.data.seen === 'string') {
    test.check('bert hears it on route: john\'s key, the new label, this relay as where he is, present, and when');
  } else {
    test.fail('rename: ' + JSON.stringify(r) + ' / heard ' + JSON.stringify(heard));
  }
  if (routesAbout(johnBag, john.publicKey).length === 0) {
    test.check('and john is not told about himself');
  } else {
    test.fail('john was told his own rename');
  }
  if (routesAbout(partnerBag, john.publicKey).length === 0) {
    test.check('and it stops at the partnership — nothing reached the partner');
  } else {
    test.fail('a partner heard a member\'s rename');
  }
}

test.subHeading('A claim reaches every member, and says present only when true');

{
  const newbie = auth.generateIdentity('newbie');
  const minted = box.mint(L.ownerName, 'newbie', 7, '');
  const joined = box.claim('newbie', auth.sign(newbie.privateKey, auth.claimMessage('newbie')),
    newbie.publicKey, 'fx-newbie', minted.invite.token, 'newbie');
  const heard = routesAbout(bertBag, newbie.publicKey).pop();
  if (joined.ok && heard && heard.data.label === 'newbie' && heard.data.at === relayKey) {
    test.check('a new member is announced to bert on route — "a member is added, broadcast it" (0012)');
  } else {
    test.fail('claim: ' + JSON.stringify(joined) + ' / heard ' + JSON.stringify(heard));
  }
  if (heard && heard.data.present === undefined) {
    test.check('and not as present: the claim lands before its stream opens, and the relay says only what is true');
  } else {
    test.fail('a member not yet connected was announced present: ' + JSON.stringify(heard && heard.data));
  }
}

test.reportSuccessFailureCount();
