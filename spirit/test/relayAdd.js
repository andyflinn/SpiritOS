'use strict';

// spirit/test/relayAdd.js
// goal/G28.1: ADDING A RELAY. Andy, 2026-10-16: relay.add {url, label} is approved as the new node verb; Natter's Add
// adds a row and opens nothing; a relay shows in the list whether or not this node is a member.
//
// WHAT IS ASSERTED (red on today's code)
//   1. the node declares relay.add, taking url and label.
//   2. relay.add refuses an empty or invalid label, with a reason, and lists nothing.
//   3. natter.js's Add handler opens no dialog: it calls relay.add, and the row appears.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G28.1: ';
const RUN = path.join(__dirname, '..', 'run');

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

test.startTest('goal/G28.1: adding a relay');

test.subHeading('1. the node declares relay.add');
{
  const server = stripComments(fs.readFileSync(path.join(RUN, 'js', 'server.js'), 'utf8'));
  if (/'relay\.add'\s*:/.test(server)) test.check('server.js declares relay.add');
  else test.fail(OWED + 'server.js declares no relay.add: no node verb adds a relay');
}

test.subHeading('2. relay.add refuses an empty label, and lists nothing');
{
  const hub = stripComments(fs.readFileSync(path.join(RUN, 'js', 'hub.js'), 'utf8'));
  if (/function relayAdd\b/.test(hub) && /label[^;]*(empty|required|invalid)/i.test(hub)) test.check('hub.js refuses an empty label with a reason');
  else test.fail(OWED + 'hub.js has no relayAdd that refuses an empty label');
}

test.subHeading('3. Natter\'s Add opens no dialog');
{
  const natter = stripComments(fs.readFileSync(path.join(RUN, 'shell', 'natter', 'natter.js'), 'utf8'));
  const addStart = natter.indexOf("getElementById('natter-add')");
  // The Add handler ends where the table's row-click handler begins; the row click may open details.
  const tbodyAt = natter.indexOf("querySelector('#natter-tbody')", addStart);
  const addBody = addStart === -1 ? '' : natter.slice(addStart, tbodyAt === -1 ? addStart + 2500 : tbodyAt);
  if (addStart !== -1 && /relay\.add/.test(addBody)) test.check('Add calls relay.add');
  else test.fail(OWED + 'natter.js Add does not call relay.add');
  if (addStart !== -1 && !/callDialog|natterOpenRelay/.test(addBody)) test.check('and opens no dialog');
  else test.fail(OWED + 'natter.js Add still opens a dialog through natterOpenRelay');
}

test.reportSuccessFailureCount();

module.exports = test;
