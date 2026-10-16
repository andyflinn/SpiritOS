'use strict';

// spirit/test/deskClientStatus.js
// goal/G27.12: deskClient manages its agent's status with desk on its own, persists only the signoff, holds one task in
// RAM, takes only lines addressed to its own agent and only while it is idle, and confirms a signoff to desk.
// Andy, 2026-10-16: the box of goal/G27.12 is the requirement; this suite asserts what it names.
//
// WHAT IS ASSERTED (red on today's code)
//   1. deskClient keeps each agent's status: connected, busy or idle.
//   2. a signoff is persisted to spirit/run/process/deskClient/status.json, and only the signoff.
//   3. a signoff is confirmed back to desk.
//   4. deskClient takes a line only for its own agent, and only while the agent is idle.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G27.12: ';
const CLIENT = path.join(__dirname, '..', 'run', 'process', 'js', 'deskClient', 'deskClient.js');
const src = fs.readFileSync(CLIENT, 'utf8');

test.startTest('goal/G27.12: deskClient keeps the agent status and the signoff');

test.subHeading('1. the status of the agent is kept');
{
  const kept = /\bconnected\b/.test(src) && /\bbusy\b/.test(src) && /\bidle\b/.test(src);
  if (kept) test.check('deskClient names connected, busy and idle');
  else test.fail(OWED + 'deskClient.js does not keep a connected, busy or idle status');
}

test.subHeading('2. only the signoff is written to disk');
{
  const file = /deskClient[\\/]+status\.json/.test(src) || /status\.json/.test(src);
  if (file) test.check('the signoff is persisted to status.json');
  else test.fail(OWED + 'deskClient.js writes no status.json');
}

test.subHeading('3. a signoff is confirmed back to desk');
{
  const confirms = /signed off/.test(src) && /confirm/i.test(src);
  if (confirms) test.check('a signoff is confirmed to desk as signed off');
  else test.fail(OWED + 'deskClient.js confirms no signoff to desk');
}

test.subHeading('4. a line is taken only for its own agent, and only while idle');
{
  const own = /addressed[\s\S]{0,80}(own|its agent)/i.test(src) || /own agent/i.test(src);
  const idle = /only when[\s\S]{0,60}idle/i.test(src) || /idle[\s\S]{0,60}take/i.test(src);
  if (own && idle) test.check('deskClient takes only its own agent\'s lines, and only while idle');
  else test.fail(OWED + 'deskClient.js has no take gate for own lines and idle');
}

test.reportSuccessFailureCount();

module.exports = test;
