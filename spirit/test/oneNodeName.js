'use strict';

// spirit/test/oneNodeName.js
// goal/G28.3: ONE NAME FOR A NODE.
//
// ANDY'S RULINGS (goal/G28.3, 2026-10-16):
//   "there should be only 1 name/label for a node."
//   "The window title should be the nodes damn name, not some stale shit in preferences.json or something"
//   The name is set in Info and propagated from there to every relay the node knows.
//
// WHAT THE TREE DOES TODAY (read at 4a655fef): the node holds two labels. nodeCard.setName writes the node NAME into
// identity.json and nothing else; each relay seat carries its own label in relayKeys (node.db), written only by
// peerPost.keepRename when a relay's answer to a rename parses as yes; Natter mirrors the seat label into
// shell/natter/session.json, and the window title (js/client/shell.js readNodeLabel) reads THAT file and caches it.
// So a rename the relay never confirmed leaves the old name in the title for good, across restarts.
//
// WHAT IS ASSERTED
//   1. Setting the node name moves every seat label with it: after nodeCard.setName, relayKeys.seatLabel on each
//      seated relay answers the new name, and nothing else is needed for the node to call itself that everywhere.
//   2. A refused name changes nothing: identity and seat labels stay as they were.
//   3. The window title reads the node's name, not shell/natter/session.json: shell.js's title code names the node
//      card and no longer loads the Natter session file.
//   4. A relay's yes to a rename writes nothing of its own (goal/G40.11: nothing of a seat is stored, box v24): what
//      every relay calls the node is the node's name, so there is no third label to drift (one label, two readers).

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const relayKeys = require('../run/spirit/relayKeys');
const ownerBadge = require('../run/spirit/ownerBadge');
const nodeCard = require('../run/spirit/nodeCard');

const OWED = 'OWED by goal/G28.3: ';
const RUN = path.join(__dirname, '..', 'run');

function tmpHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-one-node-name-')); }
function show(v) { return JSON.stringify(v); }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

// A node that holds a seat on two relays, under the name it was born with.
function nodeWithSeats(name) {
  const home = tmpHome();
  auth.saveIdentity(home, auth.generateIdentity(name));
  relayKeys.assertSeeds(home, ownerBadge.SEED_RELAYS);
  const A = 'https://a.example', B = 'https://b.example';
  const rA = auth.generateIdentity('relay-a'), rB = auth.generateIdentity('relay-b');
  relayKeys.list(home, A, 'a', rA.publicKey);
  relayKeys.seat(home, A);
  relayKeys.list(home, B, 'b', rB.publicKey);
  relayKeys.seat(home, B);
  return { home: home, A: A, B: B, rA: rA, rB: rB };
}

test.startTest('goal/G28.3: one name for a node');

// ── 1 ───────────────────────────────────────────────────────────────
test.subHeading('1. setting the node name moves every seat label with it');
{
  const n = nodeWithSeats('ollama agent node');
  const said = nodeCard.setName(n.home, 'levant-local');
  const seats = { A: relayKeys.seatLabel(n.home, n.A), B: relayKeys.seatLabel(n.home, n.B) };
  if (said && said.ok && said.name === 'levant-local') test.check('node.setName took the name: ' + said.name);
  else test.fail(OWED + 'node.setName answered ' + show(said));
  if (seats.A === 'levant-local' && seats.B === 'levant-local') test.check('both seats now read levant-local');
  else test.fail(OWED + 'after setName the seats still read ' + show(seats) + ': the node holds two labels');
  const card = nodeCard.read(n.home);
  if (card && card.name === 'levant-local') test.check('and the card says the same');
  else test.fail(OWED + 'the card says ' + show(card && card.name));
}

// ── 2 ───────────────────────────────────────────────────────────────
test.subHeading('2. a refused name changes nothing');
{
  const n = nodeWithSeats('bert');
  const said = nodeCard.setName(n.home, '');
  const seats = { A: relayKeys.seatLabel(n.home, n.A), B: relayKeys.seatLabel(n.home, n.B) };
  if (said && said.ok === false) test.check('an empty name is refused: ' + show(said.error));
  else test.fail(OWED + 'an empty name was taken: ' + show(said));
  if (seats.A === 'bert' && seats.B === 'bert' && nodeCard.read(n.home).name === 'bert') test.check('identity and seats still say bert');
  else test.fail(OWED + 'a refused name moved something: ' + show(seats) + ' / ' + show(nodeCard.read(n.home).name));
}

// ── 3 ───────────────────────────────────────────────────────────────
test.subHeading('3. the window title reads the node\'s name, not the Natter session file');
{
  const src = stripComments(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'shell.js'), 'utf8'));
  const readsSession = /shell\/natter\/session\.json/.test(src);
  const readsCard = /node\.card|nodeCard|\.name\b/.test(src.slice(src.indexOf('function readNodeLabel'), src.indexOf('function readNodeLabel') + 1200));
  if (!readsSession) test.check('shell.js no longer loads shell/natter/session.json for the title');
  else test.fail(OWED + 'shell.js still reads shell/natter/session.json for the window title');
  if (readsCard) test.check('readNodeLabel answers from the node card\'s name');
  else test.fail(OWED + 'readNodeLabel does not read the node card\'s name');
}

// ── 4 ───────────────────────────────────────────────────────────────
test.subHeading('4. a relay\'s yes writes nothing of its own: there is no third name');
{
  const n = nodeWithSeats('mary');
  nodeCard.setName(n.home, 'marianne');
  const name = nodeCard.read(n.home).name;
  const seats = { A: relayKeys.seatLabel(n.home, n.A), B: relayKeys.seatLabel(n.home, n.B) };
  if (name === 'marianne' && seats.A === name && seats.B === name && typeof relayKeys.renameSeat === 'undefined') {
    test.check('name and both seats agree on marianne, and no relay\'s answer has anywhere to write another (renameSeat is gone)');
  } else test.fail(OWED + 'after the rename: name ' + show(name) + ', seats ' + show(seats) + ', renameSeat ' + typeof relayKeys.renameSeat);
}

test.reportSuccessFailureCount();

module.exports = test;
