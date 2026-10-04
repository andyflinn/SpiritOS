'use strict';

// spirit/run/process/js/desk/offboard.js
// THE AGENT'S SIDE OF TAKING IT OUT AGAIN — goal/G4.17.
//
//   Andy, 2026-10-04, to "Removal: the agent's script undoes its side (hooks, deskClient, its relay seat). Your side
//   (desk grant, contact, scope) as a second script you run on your node?": "yes". His side is removeAgent.js.
//
// Run in the agent's own clone, with its own node up:
//
//   node spirit/run/process/js/desk/offboard.js <port of the agent's own node>
//
//   1  the commit hooks commitCheck wrote are removed from this clone (others are left alone)
//   2  deskClient goes off the node's include list (it stops at the node's next start)
//   3  the seat on the relay is given up: a post to the relay's own key, {removePeer: {key: <own key>}}, which a
//      member may send for itself alone (relay.js answerSelfInner). The relay drops the member's stream as it
//      forgets it, so no answer comes back; the closed stream is the receipt.
// Exits: 0 done; 1 a step failed (the reason printed); 2 usage.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node offboard.js <port of the agent\'s own node>';
const NODE_WAIT_MS = 20000;

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }
const node = 'http://127.0.0.1:' + port;

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function say(text) { console.log('offboard: ' + text); }
function ask(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  return Promise.race([kernel.core.ask(verb, args, node), late]).then(function (r) { clearTimeout(timer); return r || {}; },
    function (e) { clearTimeout(timer); end(1, 'offboard: the node on port ' + port + ' did not answer ' + verb + ': ' + ((e && e.message) || e)); });
}
function ok(r) { return r && r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false; }

async function main() {
  // 1. THE HOOKS.
  const g = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8', windowsHide: true });
  if (g.status !== 0) end(1, 'offboard: not in a git clone');
  const hooks = path.join(path.resolve(g.stdout.trim()), 'hooks');
  const gone = ['commit-msg', 'post-commit', 'pre-push'].filter(function (h) {
    const file = path.join(hooks, h);
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
    if (!/commitCheck\.js/.test(text)) return false;
    fs.unlinkSync(file);
    return true;
  });
  say(gone.length ? 'commit hooks removed: ' + gone.join(', ') : 'no commit hooks of commitCheck were here');

  // 2. deskClient OFF.
  const off = await ask('config.setModules', { path: 'process/js/deskClient', on: false });
  if (!ok(off)) end(1, 'offboard: deskClient was not switched off: ' + off.text);
  say('deskClient is off the include list (it stops at the node\'s next start)');

  // 3. THE SEAT.
  const card = await ask('node.card', {});
  const me = ok(card) ? String(card.body.publicKey || '') : '';
  if (!me) end(1, 'offboard: the node has no key: ' + card.text);
  const relays = await ask('relay.search', { q: '' });
  const rows = ok(relays) && Array.isArray(relays.body.items) ? relays.body.items : [];
  if (rows.length !== 1) end(1, 'offboard: the node must list exactly one relay; it lists ' + rows.length);
  const url = String(rows[0].key);
  let relayKey = null;
  try { relayKey = await (await fetch(url.replace(/\/+$/, '') + '/api/relay/key')).json(); } catch (e) { relayKey = null; }
  const relay = relayKey && String(relayKey.relayPublicKey || '');
  if (!relay) end(1, 'offboard: the relay at ' + url + ' did not give its key');
  // No answer is expected (see the header): the wait is short and its end is not a failure.
  await kernel.peerPost(relay, '', { removePeer: { key: me } }, { node: node, waitMs: 1500 }).catch(function () { return null; });
  say('the seat on ' + url + ' is given up');
  end(0, 'offboard: done. Andy removes his side with removeAgent.js <port of his node> ' + me);
}

main().catch(function (e) { end(1, 'offboard: ' + ((e && e.stack) || e)); });
