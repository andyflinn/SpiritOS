'use strict';

// spirit/test/relayKeys.js
// Trust-on-first-use for a relay's identity, made durable.
//
// The gap this closes, found while answering Grok's review of the device design:
// `answerRelay.js` pinned a relay's `relayPublicKey` in RAM for the
// life of one process, and `relays.json` recorded no key at all. So a
// relay swapped underneath a node between restarts was accepted in
// silence.
//
// What is checked hardest here is the SILENCE, not the happy path: a
// changed key must be reported as changed, and reading must never quietly
// record what it saw.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const relayKeys = require('../run/spirit/relayKeys');
const world = require('./world');

// The pins as they stand on disc, by url, read through a connection of this suite's own. Since goal/G40.11 a relay
// is a row of node.db's one table, seen, flagged relay, and its url a direct route in seen_routes (via empty, at the
// relay's own key): the route is the pin.
function disc(home) {
  const db = new (require('node:sqlite').DatabaseSync)(path.join(home, 'relay-state', 'node.db'), { readOnly: true });
  try {
    const out = {};
    db.prepare("SELECT r.url AS url, s.publicKey AS key, s.firstSeen AS firstSeen, s.relay AS relay FROM seen_routes r JOIN seen s ON s.publicKey = r.publicKey WHERE r.via = '' AND r.at = r.publicKey AND r.url <> ''").all().forEach(function (r) {
      out[r.url] = { publicKey: r.key, firstSeen: r.firstSeen, relay: r.relay === 1 };
    });
    return out;
  } finally { db.close(); }
}
function row(home, key) {
  const db = new (require('node:sqlite').DatabaseSync)(path.join(home, 'relay-state', 'node.db'), { readOnly: true });
  try { return db.prepare('SELECT * FROM seen WHERE publicKey = ?').get(key) || null; } finally { db.close(); }
}

test.startTest('Relay keys — pinned on disk, and a change is never silent');

const URL_A = 'https://spirit.example';
const URL_B = 'https://other.example';
const KEY_1 = 'MCowBQYDK2VwAyEArelayonekeyrelayonekeyrelayonekeyrelayone=';
const KEY_2 = 'MCowBQYDK2VwAyEAtwodifferentkeytwodifferentkeytwodiffer=';

{
  const home = world.tmpHome('relaykeys');

  test.subHeading('Nothing on record is not the same as a match');

  if (relayKeys.check(home, URL_A, KEY_1) === 'new') {
    test.check('a relay never seen before reads as new');
  } else {
    test.fail('first contact: ' + relayKeys.check(home, URL_A, KEY_1));
  }

  // THE READ MUST NOT WRITE. A check that recorded what it saw would turn
  // every substitution into an accepted one, which is the whole failure
  // this module exists to prevent.
  if (relayKeys.check(home, URL_A, KEY_1) === 'new' && relayKeys.pinned(home, URL_A) === '') {
    test.check('and asking twice still says new — reading records nothing');
  } else {
    test.fail('check() wrote: pinned=' + relayKeys.pinned(home, URL_A));
  }

  // A relay that hands back no key is refused rather than pinned as
  // empty. Recording an absence would make the next real key a "change".
  if (relayKeys.check(home, URL_A, '') === 'nokey' &&
      relayKeys.check(home, URL_A, null) === 'nokey') {
    test.check('a relay that says nothing is `nokey`, and nothing is written down');
  } else {
    test.fail('empty key: ' + relayKeys.check(home, URL_A, ''));
  }

  test.subHeading('Accepting is deliberate, and it survives a restart');

  relayKeys.accept(home, URL_A, KEY_1);
  if (relayKeys.check(home, URL_A, KEY_1) === 'match') {
    test.check('an accepted relay matches next time');
  } else {
    test.fail('after accept: ' + relayKeys.check(home, URL_A, KEY_1));
  }

  // The point of the whole module: this is on disc, not a variable. Read
  // through a connection of this test's own, so a passing check cannot be
  // a cache answering. Since goal/G40.11 the disc is the one table: the relay's row, its url a direct route.
  const onDisk = disc(home);
  if (onDisk[URL_A] && onDisk[URL_A].publicKey === KEY_1 && onDisk[URL_A].relay === true) {
    test.check('and it is on disk: a row flagged relay, its url a direct route');
  } else {
    test.fail('relays table: ' + JSON.stringify(onDisk));
  }

  test.subHeading('A different key at the same address is never silent');

  // THE CHECK THIS FILE EXISTS FOR.
  if (relayKeys.check(home, URL_A, KEY_2) === 'changed') {
    test.check('a substituted relay reads as changed, not as new and not as a match');
  } else {
    test.fail('substitution: ' + relayKeys.check(home, URL_A, KEY_2));
  }

  // And it stays changed. Nothing about asking resolves it — only an
  // explicit accept does, which is a decision somebody has to make.
  relayKeys.check(home, URL_A, KEY_2);
  relayKeys.check(home, URL_A, KEY_2);
  if (relayKeys.pinned(home, URL_A) === KEY_1) {
    test.check('and asking repeatedly does not wear the pin down');
  } else {
    test.fail('the pin moved on its own: ' + relayKeys.pinned(home, URL_A).slice(-12));
  }

  test.subHeading('An explicit accept resolves it, and the old key keeps its row');

  relayKeys.accept(home, URL_A, KEY_2);
  const after = disc(home)[URL_A];

  if (relayKeys.check(home, URL_A, KEY_2) === 'match' && after.publicKey === KEY_2) {
    test.check('accepting the new key makes it the pin');
  } else {
    test.fail('after re-accept: ' + JSON.stringify(after));
  }

  // WHO THE OLD KEY WAS DOES NOT CHANGE because a box was replaced (goal/G40.11): its row stays, and only the address
  // it answered at moves to the new key. ("replaced" and "acceptedAt" went with the relays table, box v24.)
  const oldRow = row(home, KEY_1);
  if (oldRow && oldRow.relay === 1 && !Object.keys(disc(home)).some(function (u) { return disc(home)[u].publicKey === KEY_1; })) {
    test.check('and the displaced key keeps its row, with no address of its own any more');
  } else {
    test.fail('the displaced key: ' + JSON.stringify({ row: oldRow, disc: disc(home) }));
  }

  test.subHeading('One relay is not another');

  if (relayKeys.check(home, URL_B, KEY_1) === 'new') {
    test.check('a second address is its own question');
  } else {
    test.fail('URL_B: ' + relayKeys.check(home, URL_B, KEY_1));
  }

  // Two spellings of one address must not become two pins, or a trailing
  // slash would silently make a known relay look new.
  if (relayKeys.check(home, URL_A + '/', KEY_2) === 'match' &&
      relayKeys.check(home, URL_A + '///', KEY_2) === 'match') {
    test.check('and a trailing slash is the same relay, not a new one');
  } else {
    test.fail('slash: ' + relayKeys.check(home, URL_A + '/', KEY_2));
  }

  test.subHeading('The set the front door needs');

  relayKeys.accept(home, URL_B, KEY_1);
  const keys = relayKeys.acceptedKeys(home);

  // WHY THIS EXISTS: a relay posts to a node in its own name for a device
  // enrolment, and a relay is not a contact — its key is in no contactBook.
  // Without this set, applying listenSet to the router path would refuse
  // the enrolment it is supposed to carry.
  if (keys[KEY_2] === URL_A && keys[KEY_1] === URL_B) {
    test.check('every accepted relay key, and which address it answers at');
  } else {
    test.fail('acceptedKeys: ' + JSON.stringify(keys));
  }

  if (Object.keys(keys).length === 2) {
    test.check('and nothing else — a displaced key is not still trusted');
  } else {
    test.fail('set holds ' + Object.keys(keys).length + ': ' + JSON.stringify(Object.keys(keys).map(function (k) { return k.slice(-8); })));
  }

  test.subHeading('A file that cannot be read');

  // relayKeys.forget STOOD HERE until goal/G40.11; nothing in run/ called it, and a relay's row is the table's now.
  //
  // FAILS SAFE, and in the one direction that matters: a stray old file reads as nothing pinned, so every relay looks
  // new and has to be accepted again. The other direction — reading as a match — would trust a stranger because a file
  // went bad. Since goal/G40.11 relayKeys.json is not read at all.
  const broken = world.tmpHome('relaykeys-broken');
  fs.mkdirSync(path.join(broken, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(broken, 'relay-state', 'relayKeys.json'), '{ not json');
  if (relayKeys.check(broken, URL_A, KEY_1) === 'new' &&
      Object.keys(relayKeys.acceptedKeys(broken)).length === 0) {
    test.check('an unreadable file reads as nothing pinned, never as a match');
  } else {
    test.fail('broken file: ' + relayKeys.check(broken, URL_A, KEY_1));
  }

  // A JSON array is valid JSON and is not a book. Shape is checked, not
  // just parseability.
  const wrong = world.tmpHome('relaykeys-wrong');
  fs.mkdirSync(path.join(wrong, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(wrong, 'relay-state', 'relayKeys.json'), '["a","b"]');
  if (relayKeys.check(wrong, URL_A, KEY_1) === 'new') {
    test.check('and so does a file that parses but is the wrong shape');
  } else {
    test.fail('array file: ' + relayKeys.check(wrong, URL_A, KEY_1));
  }

  test.reportSuccessFailureCount();
}
