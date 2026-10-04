'use strict';

// spirit/run/process/js/desk/onboard.js
// ONE RUN JOINS A NEW AGENT TO DESK — goal/G4.17.
//
//   Andy, 2026-10-04: "onboarding was painful, running form room to room, emailing output between computers etc..";
//   "input argument the relay claim: name:token ?"; to the onboarding script: "if that works, nice!".
//
// Run in the agent's own clone, with its own node up:
//
//   node spirit/run/process/js/desk/onboard.js <port of the agent's own node> <name:token>
//
// name:token is the relay invite Andy gave; name is the seat's name and the invite's label. In order:
//   1  the relay is the one row of the node's relay list; the seat is claimed with the invite, unless this node
//      already holds it (a second run is not refused for its own seat). Andy's node, owning the relay, adopts the
//      agent as a contact by itself (hub.js adoptClaim).
//   2  the relay's owner (GET /api/relay/key, ownerKey) is the desk node: acquired as a contact, and set as deskClient's
//      desk once deskClient is switched on.
//   3  the commit hooks are installed in this clone (commitCheck.js install <port>).
//   4  one desk read. Refused, it says in plain words that Andy's desk grant is missing, and exits 1: the grant is his
//      to give, and the run is made again after it. Answered, every other agent that wrote at the desk is blocked on
//      this node (rule 1: agents do not speak to each other), and it exits 0.
// Every ask goes to the agent's own node; it reads no file of the node's and writes none.
// Exits: 0 joined; 1 a step failed or the grant is missing (the reason printed); 2 usage.

const path = require('path');
const { spawnSync } = require('child_process');
const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node onboard.js <port of the agent\'s own node> <name:token>';
const NODE_WAIT_MS = 20000;
const DESK_CLIENT = 'process/js/deskClient';

const port = Number(process.argv[2]);
const invite = String(process.argv[3] || '');
const colon = invite.indexOf(':');
if (!Number.isInteger(port) || port <= 0 || colon <= 0 || colon === invite.length - 1) { console.error(USAGE); process.exit(2); }
const name = invite.slice(0, colon);
const token = invite.slice(colon + 1);
const node = 'http://127.0.0.1:' + port;

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function say(text) { console.log('onboard: ' + text); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// One verb of the agent's own node: {status, body, text}; a node that says nothing ends the run.
function ask(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  return Promise.race([kernel.core.ask(verb, args, node), late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'onboard: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function ok(r) { return r && r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false; }
function deskClient(what, args) { const one = {}; one[what] = args; return ask('jobs.api', { ask: { deskClient: one } }); }

async function main() {
  // 1. THE SEAT. A fresh node has no key until its first claim makes one, so the key is read after it.
  const relays = await ask('relay.search', { q: '' });
  const rows = ok(relays) && Array.isArray(relays.body.items) ? relays.body.items : [];
  if (rows.length !== 1) end(1, 'onboard: the node must list exactly one relay (shell/natter/relays.json); it lists ' + rows.length);
  const url = String(rows[0].key);
  const got = await ask('relay.get', { key: url });
  const row = (ok(got) && got.body.relay) || {};
  if (row.claimed || row.owned) say('this node already holds its seat on ' + url);
  else {
    const claim = await ask('relay.claim', { url: url, name: name, invite: token, inviteLabel: name });
    if (claim.status >= 200 && claim.status < 300) say('seat claimed on ' + url + ' as ' + name);
    else {
      // relay.get answers from the node's relay probe, cached 3 s (hub.js PROBE_FRESH_MS): a run right after the
      // first still reads "not joined", and its claim is refused because the invite is spent. Asked again past the
      // cache, a seat this node already holds shows, and the run goes on (found by wsl-claude).
      await sleep(3500);
      const again = await ask('relay.get', { key: url });
      const now = (ok(again) && again.body.relay) || {};
      if (!(now.claimed || now.owned)) end(1, 'onboard: the relay refused the invite: ' + claim.status + ' ' + claim.text);
      say('this node already holds its seat on ' + url);
    }
  }
  const card = await ask('node.card', {});
  const me = ok(card) ? String(card.body.publicKey || '') : '';
  if (!me) end(1, 'onboard: the node has no key even after its claim: ' + card.text);

  // 2. THE DESK NODE: the relay's owner.
  let relayKey = null;
  try { relayKey = await (await fetch(url.replace(/\/+$/, '') + '/api/relay/key')).json(); } catch (e) { relayKey = null; }
  const desk = relayKey && String(relayKey.ownerKey || '');
  if (!desk) end(1, 'onboard: the relay at ' + url + ' names no owner, so there is no desk node to join');
  const known = await ask('contact.get', { key: desk });
  if (!(ok(known) && known.body.person)) {
    const acq = await ask('peer.acquire', { publicKey: desk, publicLabel: String(relayKey.ownerLabel || 'desk'), url: url });
    if (!ok(acq)) end(1, 'onboard: the desk node (' + desk.slice(0, 24) + '...) was not acquired: ' + acq.text);
  }
  say('the desk node is a contact: ' + (relayKey.ownerLabel || desk.slice(0, 24)));
  const on = await ask('config.setModules', { path: DESK_CLIENT, on: true });
  if (!ok(on)) end(1, 'onboard: deskClient was not switched on: ' + on.text);
  let set = null;
  for (let i = 0; i < 40; i++) {
    set = await deskClient('setDesk', { key: desk });
    if (ok(set)) break;
    await sleep(500);
  }
  if (!ok(set)) end(1, 'onboard: deskClient did not take the desk node: ' + (set && set.text));
  say('deskClient is on, asking the desk node');

  // 3. THE COMMIT HOOKS, in this clone.
  const hooks = spawnSync(process.execPath, [path.join(__dirname, 'commitCheck.js'), 'install', String(port)], { cwd: process.cwd(), encoding: 'utf8' });
  if (hooks.status !== 0) end(1, 'onboard: the commit hooks were not installed: ' + String(hooks.stderr || hooks.stdout).trim());
  say('commit hooks installed');

  // 4. ONE DESK READ, which also names every agent that wrote at the desk.
  const writers = Object.create(null);
  let n = 0;
  let line = 0;
  for (;;) {
    const r = await deskClient('desk', { verb: 'changes', json: JSON.stringify({ n: n, line: line }) });
    if (!ok(r)) {
      end(1, 'onboard: NOT YET JOINED: the desk did not answer this agent (' + ((r.body && (r.body.code || r.body.error)) || r.status) + ').\n' +
        'Andy grants it on his node: jobs.authGrant {key: "' + me + '", path: "desk"} (the desk grant), then this is run again.');
    }
    (r.body.records || []).forEach(function (rec) { if (rec.key) writers[rec.key] = String(rec.by || ''); });
    n = r.body.n; line = r.body.line;
    if (!r.body.more) break;
  }
  say('the desk answered');
  const others = Object.keys(writers).filter(function (k) { return k !== me && k !== desk; });
  for (const k of others) {
    const b = await ask('contact.block', { publicKey: k, publicLabel: writers[k] });
    if (!ok(b)) end(1, 'onboard: ' + (writers[k] || k) + ' was not blocked: ' + b.text);
  }
  // RULE 1 (process/js/desk/AGENTS.md): "Agents will NOT speak to each other behind the users back."
  say(others.length + ' other agent(s) blocked on this node' + (others.length ? ': ' + others.map(function (k) { return writers[k] || k.slice(0, 16); }).join(', ') : ''));
  end(0, 'onboard: joined. Listen with: node spirit/run/process/js/desk/deskEar.js ' + port);
}

main().catch(function (e) { end(1, 'onboard: ' + ((e && e.stack) || e)); });
