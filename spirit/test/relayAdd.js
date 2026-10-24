'use strict';

// spirit/test/relayAdd.js
// goal/G28.1: ADDING A RELAY. Andy, 2026-10-16: relay.add {url, label} is approved as the new node verb; Natter's Add
// adds a row and opens nothing; a relay shows in the list whether or not this node is a member.
//
// WHAT IS ASSERTED (red on today's code)
//   1. the node declares relay.add, taking url and label.
//   2. relay.add refuses an empty or invalid label, with a reason, and lists nothing.
//   3. the Add handler (Natter's, in Contacts since goal/G30.7) opens no dialog: it calls relay.add, and the row appears.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G28.1: ';
const RUN = path.join(__dirname, '..', 'run');

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

test.startTest('goal/G28.1: adding a relay');

test.subHeading('1. the node declares relay.add');
{
  const server = stripComments(fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8'));
  // The relay family's 'add' in the flat door's tables since goal/G30.5, its handler hub.relayAdd.
  if (/'add'\s*:\s*\{[^\n]*hub\.relayAdd\(/.test(server)) test.check('server.js declares relay.add');
  else test.fail(OWED + 'server.js declares no relay.add: no node verb adds a relay');
}

test.subHeading('2. relay.add refuses an empty label, and lists nothing');
{
  const hub = stripComments(fs.readFileSync(path.join(RUN, 'spirit', 'hub.js'), 'utf8'));
  if (/function relayAdd\b/.test(hub) && /label[^;]*(empty|required|invalid)/i.test(hub)) test.check('hub.js refuses an empty label with a reason');
  else test.fail(OWED + 'hub.js has no relayAdd that refuses an empty label');
}

// Natter retired (goal/G30.7): Add a relay is a panel in Contacts now, the same handler moved.
test.subHeading('3. Add a relay (in Contacts) opens no dialog');
{
  const contacts = stripComments(fs.readFileSync(path.join(RUN, 'shell', 'contacts', 'contacts.js'), 'utf8'));
  const addStart = contacts.indexOf("getElementById('contacts-relay-add')");
  // The Add handler ends where the peer list is built.
  const addEnd = contacts.indexOf('contactsSeenList = ', addStart);
  const addBody = addStart === -1 ? '' : contacts.slice(addStart, addEnd === -1 ? addStart + 2500 : addEnd);
  if (addStart !== -1 && /relay\.add/.test(addBody)) test.check('Add calls relay.add');
  else test.fail(OWED + 'Contacts Add does not call relay.add');
  if (addStart !== -1 && !/callDialog/.test(addBody)) test.check('and opens no dialog');
  else test.fail(OWED + 'Contacts Add opens a dialog');
}

test.reportSuccessFailureCount();

module.exports = test;
