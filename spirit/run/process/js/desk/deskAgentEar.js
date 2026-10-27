'use strict';

// spirit/run/process/js/desk/deskAgentEar.js
// THE AGENT'S DESK LISTENER: the few lines that wait — goal/G3.6.
//
//   Andy, 2026-10-01: "ideally agents just listen do desk in a loop. this loop ends only when i close vscode."
//   Andy, 2026-10-02: "you move deskAgentEar to where it belongs, in the deskServer folder. and adapt it for use with
//   your personal node only", and of the design that followed: "i am ready to accept completely alternative
//   design, if it achieves what todays deskAgentEar does, and statistics are kept somewhere you can access them easily."
//
// WHY IT EXITS. An agent thinks only when a turn starts: when Andy types in its window or a background job of its
// own finishes. So the agent runs the wait in the background; it prints what arrived and exits, the exit wakes the
// agent, the agent answers in Desk and starts it again.
//
// EVERYTHING ELSE IS deskClient's (process/js/deskClient), the server on the agent's own node: it reads Desk, keeps
// the place, selects what is the agent's, says listening and working, and counts every ask. This file only asks
// that server, through its own node's flat apiDoor, by the kernel's one mouth. It opens no stream, reads no file and
// takes nothing from the environment.
//
//   node deskAgentEar.js <port>                            wait: ask deskClient.next until lines come, print them, end
//   node deskAgentEar.js <port> --read <key>               the same wait, naming the key of the wake last read
//   node deskAgentEar.js <port> <verb> [json]              one read or write of Desk, through deskClient.desk
//   node deskAgentEar.js <port> deskClient.<verb> [json]   one ask of its own deskClient (setDesk, history.search)
//
// The port is the agent's OWN node's and has no default: Andy's door is never an agent's.
// Exits: 0 lines printed, or the answer printed; 1 refused or not answered (the reason is printed); 2 usage.


// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const USAGE = 'usage: node deskAgentEar.js <port of your own node> [--read <key> | <desk verb> | deskClient.<verb>] [json]';
const NODE_WAIT_MS = 20000;
const PAUSE_MS = 250;

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }
// --read <key> (goal/G41.11): a wait, naming the wake the agent last read; no desk verb.
const READ = process.argv[3] === '--read' ? String(process.argv[4] || '') : null;
if (READ === '') { console.error(USAGE); process.exit(2); }
const verb = READ === null ? String(process.argv[3] || '') : '';
let args = {};
if (READ === null) {
  try { args = JSON.parse(process.argv[4] || '{}'); } catch (e) { args = null; }
  if (!args || typeof args !== 'object' || Array.isArray(args)) { console.error('the json is not an object\n' + USAGE); process.exit(2); }
}

function end(code, text, bad) { (bad ? console.error : console.log)(text); process.exit(code); }

// One ask of this agent's own deskClient: {status, body}, or the end of this process when its node says nothing.
function ask(what, a) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer from the node in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  // Through the one spirit object (goal/G32.3, goal/G40.6): the deskClient verb by its name, as {status, body}, on this
  // checkout's own node (spirit.js: the port of its relay-state/environment.json).
  const asked = spirit.outcome(spirit.require('process/js/deskClient/deskClient.family/api.js').then(function (c) {
    if (typeof c[what] !== 'function') throw Object.assign(new Error('deskClient has no verb ' + what), { code: 'no-such-verb' });
    return c[what](a);
  }));
  return Promise.race([asked, late])
    .then(function (r) { clearTimeout(timer); return r; }, function (e) { end(1, 'deskAgentEar: the node on port ' + port + ' did not answer: ' + ((e && e.message) || e), true); });
}
function refusedBy(r) { return r.status !== 200 || !r.body || r.body.ok === false; }

// A WAKE IS DROPPED ONLY ONCE READ (goal/G41.11; Andy, goal/G41: "The desk ear must not successfully start listening if
// there is a wake waiting", and of the read key: "good idea, make the red assert it"). deskClient answers a wake with
// its key; the ear prints the lines and, last, the arm the agent runs next, naming that key:
// "next: node deskAgentEar.js <port> --read <key>". Armed so, it asks next with { read: key } and deskClient drops that
// wake; armed without it, or with an older key, deskClient hands the unread wake again at once, so no agent listens past
// a wake it has not read. The key lives on the agent's command line, nowhere else.
// A DOOR THAT TIMED OUT IS NO REFUSAL (goal/G41.11): its node's door gave up on a wait (504, app-did-not-answer) while
// deskClient still held it. Nothing was handed, and whatever is unread stays queued under its key, so the ear simply
// waits again instead of ending; only a real refusal ends it.
function timedOut(r) { return !!(r && r.body && r.body.code === 'app-did-not-answer'); }
function wait() {
  ask('next', READ ? { read: READ } : {}).then(function (r) {
    if (timedOut(r)) { setTimeout(wait, PAUSE_MS); return; }
    if (r.body && r.body.code === 'signed-off') end(1, 'deskAgentEar: this agent is signed off; the desk clears it, or your listen does', true);
    if (refusedBy(r) || !Array.isArray(r.body.lines)) end(1, 'deskAgentEar: ' + r.status + ' ' + JSON.stringify(r.body), true);
    const key = typeof r.body.key === 'string' ? r.body.key : '';
    if (r.body.lines.length) end(0, r.body.lines.join('\n') + '\nnext: node deskAgentEar.js ' + port + (key ? ' --read ' + key : ''));
    setTimeout(wait, PAUSE_MS);
  });
}

if (!verb) wait();
else if (verb.indexOf('deskClient.') === 0) {
  // ONE ASK OF ITS OWN deskClient, the answer printed as it came.
  ask(verb.slice('deskClient.'.length), args).then(function (r) { end(refusedBy(r) ? 1 : 0, JSON.stringify(r.body), refusedBy(r)); });
} else {
  // ONE ASK OF THE DESK. Its answer is printed as it came, a refusal of the desk's too (exit 1); deskClient's own
  // refusal (a slow desk: no-answer with the record's id) is the reason. Since goal/G4.19 deskClient hands back the
  // desk's answer itself, not a json string, so a desk refusal arrives as the body: ok false, printed, exit 1.
  ask('desk', { name: verb, json: process.argv[4] || '{}' }).then(function (r) {
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') end(1, 'deskAgentEar: ' + r.status + ' ' + JSON.stringify(r.body), true);
    end(r.body.ok === false ? 1 : 0, JSON.stringify(r.body));
  });
}
