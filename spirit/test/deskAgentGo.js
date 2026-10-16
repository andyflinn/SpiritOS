'use strict';

// spirit/test/deskAgentGo.js
// goal/G27.6: deskAgent is the agent's door. Andy's rulings, goal/G27.6 box, as built now:
//   R1  the buffer of nudges and new lines is held in deskAgent, handed to the model only when something is owed.
//   R3  deskAgent reads the goal's design flag when it takes a task, and sets the tool set then (no push).
//   R5  in design mode the model gets no write tool (deskAgent's rule; a Claude in VSCode has its own).
//   clearSignoff  an owner-only verb on deskClient that lifts a signoff, approved by Andy, with a Clear signoff button.
//   ear  deskAgentEar ends cleanly on the signed-off refusal from next.
//
// WHAT IS ASSERTED (red on today's code)

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G27.6: ';
const RUN = path.join(__dirname, '..', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskAgent', 'deskAgent.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const EAR = path.join(RUN, 'process', 'js', 'desk', 'deskAgentEar.js');
const SHELL = path.join(RUN, 'shell');

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|html)$/.test(e.name)) out.push(p);
  });
  return out;
}

test.startTest('goal/G27.6: deskAgent is the agent\'s door, with its buffer, design read and clear verb');

test.subHeading('1. the buffer of nudges and new lines is held in deskAgent (R1)');
{
  const src = fs.readFileSync(AGENT, 'utf8');
  if (/buffer/i.test(src) && /nudge/i.test(src)) test.check('deskAgent.js holds a buffer of nudges and new lines');
  else test.fail(OWED + 'deskAgent.js holds no buffer of nudges and new lines');
}

test.subHeading('2. deskAgent reads the goal design flag when it takes a task (R3)');
{
  const src = fs.readFileSync(AGENT, 'utf8');
  if (/design/.test(src) && /take/i.test(src) && /tool/i.test(src)) test.check('deskAgent reads the design flag at take and sets the tool set');
  else test.fail(OWED + 'deskAgent.js does not read the design flag at take to set the tool set');
}

test.subHeading('3. the model gets no write tool in design mode (R5)');
{
  const src = fs.readFileSync(AGENT, 'utf8');
  if (/write/i.test(src) && /design/i.test(src) && /no write|withhold|not given/i.test(src)) test.check('deskAgent withholds write tools in design mode');
  else test.fail(OWED + 'deskAgent.js withholds no write tool in design mode');
}

test.subHeading('4. clearSignoff is an owner-only verb on deskClient, with a Clear signoff button');
{
  const src = fs.readFileSync(CLIENT, 'utf8');
  const verb = /'clearSignoff'\s*:\s*\{/.test(src);
  const shell = walk(SHELL, []).some(function (f) { return /Clear signoff/.test(fs.readFileSync(f, 'utf8')); });
  if (verb && shell) test.check('deskClient declares clearSignoff and a Clear signoff button draws in the shell');
  else test.fail(OWED + 'clearSignoff verb ' + verb + ', Clear signoff button ' + shell);
}

test.subHeading('5. deskAgentEar ends cleanly on the signed-off refusal');
{
  const src = fs.readFileSync(EAR, 'utf8');
  if (/signed[- ]off/i.test(src)) test.check('deskAgentEar names the signed-off refusal and ends on it');
  else test.fail(OWED + 'deskAgentEar.js does not handle the signed-off refusal');
}

test.reportSuccessFailureCount();

module.exports = test;
