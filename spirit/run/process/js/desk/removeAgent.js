'use strict';

// spirit/run/process/js/desk/removeAgent.js
// ANDY'S SIDE OF TAKING AN AGENT OUT AGAIN — goal/G4.17.
//
//   Andy, 2026-10-04, to "Your side (desk grant, contact, scope) as a second script you run on your node?": "yes".
//   The agent's side, offboard.js, is deleted (goal/G30.20): agent onboarding comes later, through the "agent" server on Andy's node.
//
// Run by Andy, against his own node (the one that runs the desk):
//
//   node spirit/run/process/js/desk/removeAgent.js <port of Andy's node> <agent key>
//
//   1  the agent's desk grant is revoked (none held is no failure)
//   2  the agent is forgotten from his contact book
//   The profile stays: no verb deletes one (since goal/G21.1 profile.set accepts an empty name, which only clears it). (A third step cleared the agent's
//   scope until goal/G10.8 removed agent scopes, every agent being /.)
// Exits: 0 done; 1 a step failed (the reason printed); 2 usage.

const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node removeAgent.js <port of Andy\'s node> <agent key>';
const NODE_WAIT_MS = 20000;

const port = Number(process.argv[2]);
const agent = String(process.argv[3] || '');
if (!Number.isInteger(port) || port <= 0 || !agent) { console.error(USAGE); process.exit(2); }
const node = 'http://127.0.0.1:' + port;

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function say(text) { console.log('removeAgent: ' + text); }
function ask(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  return Promise.race([kernel.core.ask(verb, args, node), late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'removeAgent: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function ok(r) { return r && r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false; }
function code(r) { return (r && r.body && r.body.code) || ''; }

async function main() {
  // 1. THE DESK GRANT.
  const rev = await ask('auth.revoke', { key: agent, path: 'desk' });
  if (!ok(rev) && code(rev) !== 'not-granted') end(1, 'removeAgent: the desk grant was not revoked: ' + rev.text);
  say(ok(rev) ? 'desk grant revoked' : 'it held no desk grant');

  // 2. THE CONTACT.
  const forgot = await ask('contact.forget', { publicKey: agent });
  if (!ok(forgot) && forgot.status !== 404) end(1, 'removeAgent: the contact was not forgotten: ' + forgot.text);
  say(ok(forgot) ? 'forgotten from the contact book' : 'it was not in the contact book');
  end(0, 'removeAgent: done');
}

main().catch(function (e) { end(1, 'removeAgent: ' + ((e && e.stack) || e)); });
