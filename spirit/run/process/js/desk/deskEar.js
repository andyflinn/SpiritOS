'use strict';

// spirit/run/process/js/desk/deskEar.js
// THE AGENT'S DESK LISTENER: the few lines that wait — goal/G3.6.
//
//   Andy, 2026-10-01: "ideally agents just listen do desk in a loop. this loop ends only when i close vscode."
//   Andy, 2026-10-02: "you move deskEar to where it belongs, in the deskServer folder. and adapt it for use with
//   your personal node only", and of the design that followed: "i am ready to accept completely alternative
//   design, if it achieves what todays deskEar does, and statistics are kept somewhere you can access them easily."
//
// WHY IT EXITS. An agent thinks only when a turn starts: when Andy types in its window or a background job of its
// own finishes. So the agent runs the wait in the background; it prints what arrived and exits, the exit wakes the
// agent, the agent answers in Desk and starts it again.
//
// EVERYTHING ELSE IS deskClient's (process/js/deskClient), the server on the agent's own node: it reads Desk, keeps
// the place, selects what is the agent's, says listening and working, and counts every ask. This file only asks
// that server, through its own node's jobs.api, by the kernel's one mouth. It opens no stream, reads no file and
// takes nothing from the environment.
//
//   node deskEar.js <port>                            wait: ask deskClient.next until lines come, print them, end
//   node deskEar.js <port> <verb> [json]              one read or write of Desk, through deskClient.desk
//   node deskEar.js <port> deskClient.<verb> [json]   one ask of its own deskClient (setDesk, history.search)
//
// The port is the agent's OWN node's and has no default: Andy's door is never an agent's.
// Exits: 0 lines printed, or the answer printed; 1 refused or not answered (the reason is printed); 2 usage.

const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node deskEar.js <port of your own node> [<desk verb> | deskClient.<verb>] [json]';
const NODE_WAIT_MS = 20000;
const PAUSE_MS = 250;

const port = Number(process.argv[2]);
const verb = String(process.argv[3] || '');
if (!Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }
let args = {};
try { args = JSON.parse(process.argv[4] || '{}'); } catch (e) { args = null; }
if (!args || typeof args !== 'object' || Array.isArray(args)) { console.error('the json is not an object\n' + USAGE); process.exit(2); }

function end(code, text, bad) { (bad ? console.error : console.log)(text); process.exit(code); }

// One ask of this agent's own deskClient: {status, body}, or the end of this process when its node says nothing.
function ask(what, a) {
  const one = {};
  one[what] = a;
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer from the node in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  return Promise.race([kernel.core.ask('jobs.api', { ask: { deskClient: one } }, 'http://127.0.0.1:' + port), late])
    .then(function (r) { clearTimeout(timer); return r; }, function (e) { end(1, 'deskEar: the node on port ' + port + ' did not answer: ' + ((e && e.message) || e), true); });
}
function refusedBy(r) { return r.status !== 200 || !r.body || r.body.ok === false; }

// THE WAIT. An answer with lines is printed and ends it; one without is asked again; a refusal ends it.
function wait() {
  ask('next', {}).then(function (r) {
    if (refusedBy(r) || !Array.isArray(r.body.lines)) end(1, 'deskEar: ' + r.text, true);
    if (r.body.lines.length) end(0, r.body.lines.join('\n'));
    setTimeout(wait, PAUSE_MS);
  });
}

if (!verb) wait();
else if (verb.indexOf('deskClient.') === 0) {
  // ONE ASK OF ITS OWN deskClient, the answer printed as it came.
  ask(verb.slice('deskClient.'.length), args).then(function (r) { end(refusedBy(r) ? 1 : 0, r.text, refusedBy(r)); });
} else {
  // ONE ASK OF THE DESK. Its answer is printed as it came, a refusal of the desk's too (exit 1); deskClient's own
  // refusal (a slow desk: no-answer with the record's id) is the reason. Since goal/G4.19 deskClient hands back the
  // desk's answer itself, not a json string, so a desk refusal arrives as the body: ok false, printed, exit 1.
  ask('desk', { verb: verb, json: process.argv[4] || '{}' }).then(function (r) {
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') end(1, 'deskEar: ' + r.text, true);
    end(r.body.ok === false ? 1 : 0, JSON.stringify(r.body));
  });
}
