'use strict';

// spirit/test/labPopulate.js
// A world to look at, rebuilt in one command.
//
// Andy: "I'd love a populated peer environment for visual testing, so I
// don't have to painfully redo my little buddy network through the shell
// every time my sandbox gets wiped."
//
//   node spirit/test/labPopulate.js                   build the default
//   node spirit/test/labPopulate.js presence-colours  build a named one
//   node spirit/test/labPopulate.js --list            what is available
//   node spirit/test/labPopulate.js --down            take it away again
//
// THE SUITE EXPLORES. THE SCENARIO EXHIBITS. What to build is data now,
// in spirit/test/visual/*.visual.json, so a world worth looking at can be
// described without touching this file — and so the fast suites can keep
// running hundreds of worlds in milliseconds while this one builds a
// single one in real processes.
//
// What it makes: a lab relay that YOUR node owns, two or three peers with
// rows on it, each running and connected so presence shows them, each in
// your contacts, and a message or two so chat is not an empty screen.
//
// ── THE ONE RULE THIS FILE MUST NEVER BREAK ───────────────────────────
// Your identity is READ and never written. The key in
// spirit/run/relay-state/identity.json is the key that owns
// spirit.andyflinn.com; generating a new one here would silently cost you
// the relay you already have, and you would not find out until the next
// time you asked it for a census. Every call below takes the key it
// finds. Nothing calls saveIdentity on the work node, ever.
// ──────────────────────────────────────────────────────────────────────
//
// Everything else it touches is reversible: relays.json is backed up
// before the lab row goes in front, and --down puts it back byte for
// byte and deletes the lab nodes.

const fs = require('fs');
const path = require('path');
const auth = require('../run/js/relayAuth');
const labWorld = require('./labWorld');

const WORK_RUN = path.join(__dirname, '..', 'run');
const WORK_PORT = 65432;
const WORK_URL = 'http://127.0.0.1:' + WORK_PORT;
const MASTER = 'http://127.0.0.1:65420';
const RELAYS = path.join(WORK_RUN, 'app', 'natter', 'relays.json');
const BACKUP = path.join(WORK_RUN, 'app', 'natter', 'relays.json.before-lab');

const invites = require('../run/js/invites');

// THE `lab-` PREFIX IS A SAFETY FEATURE, not a style. These identities
// also get rows on the live relay, and `--down` removes them from there
// by MATCHING THE NAME — not from a local list, which a sandbox wipe
// would take with it and leave the fixtures behind forever on a box you
// cannot edit from here.
//
// A disposable thing should say so in its own name.
const NAME_PREFIX = 'lab-';

const LIVE_RELAY = 'https://spirit.andyflinn.com';
const SCENARIOS = path.join(__dirname, 'visual');
const DEFAULT_SCENARIO = 'buddies';

function listScenarios() {
  try {
    return fs.readdirSync(SCENARIOS)
      .filter(function (f) { return /\.visual\.json$/.test(f); })
      .map(function (f) { return f.replace('.visual.json', ''); })
      .sort();
  } catch (e) { return []; }
}

function loadScenario(name) {
  const file = path.join(SCENARIOS, name + '.visual.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    let parsed = null;
    try { parsed = await res.json(); } catch (e) { parsed = null; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: { error: String(e.message || e) } };
  }
}

// WHEN did this process start — not "is something answering". Those are
// different questions and this tool asked the wrong one first: labMaster
// cannot kill a node it did not spawn, so the OLD process kept answering,
// the check passed, and the world was built around a node that had never
// re-read its configuration.
//
// Third time today that a symptom stood in for a fact. /api/version
// exists precisely so it does not have to.
async function startedAt() {
  try {
    const res = await fetch(WORK_URL + '/api/version');
    if (!res.ok) return null;
    const v = await res.json();
    return v.startedAt || null;
  } catch (e) { return null; }
}

// Stop and start through labMaster, which owns the `work` row — and then
// prove it happened by watching startedAt move.
async function restartWork() {
  const before = await startedAt();
  await post(MASTER + '/api/nodes/work/stop');
  await sleep(1200);
  await post(MASTER + '/api/nodes/work/start');

  for (let n = 0; n < 40; n += 1) {
    await sleep(250);
    const now = await startedAt();
    if (now && now !== before) return true;
  }
  // It may well be answering. That is not the same as having restarted,
  // and saying so would be the lie this function was written to stop.
  return false;
}

function readRelays() {
  try { return JSON.parse(fs.readFileSync(RELAYS, 'utf8')); }
  catch (e) { return []; }
}

function writeRelays(rows) {
  fs.mkdirSync(path.dirname(RELAYS), { recursive: true });
  fs.writeFileSync(RELAYS, JSON.stringify(rows, null, 2));
}

// Remove anything named `lab-*` from the live relay. By PATTERN and not
// from a list, so this still works after a sandbox wipe has taken every
// local trace of what was created — the one case where being unable to
// clean up would leave fixtures on a box that cannot be edited from here.
async function clearLive(me) {
  let removed = 0;
  let census = null;
  try {
    const res = await fetch(LIVE_RELAY + '/api/relay/who');
    census = await res.json();
  } catch (e) { return { removed: 0, error: String(e.message || e) }; }

  const rows = (census && census.peers) || [];
  for (const row of rows) {
    const label = row.publicLabel || row.name || '';
    if (label.indexOf('lab-') !== 0 || !row.publicKey) continue;
    const done = await post(LIVE_RELAY + '/api/relay/remove-peer', {
      name: me.name,
      key: row.publicKey,
      sig: auth.sign(me.privateKey, auth.removePeerMessage(row.publicKey)),
    });
    if (done.ok) removed += 1;
    else console.log('  could not remove ' + label + ': ' + JSON.stringify(done.body));
  }
  return { removed: removed };
}

// GAP — NOTHING MAKES A NODE FORGET A PERSON.
//
// whoBook offers block, unblock, accept and label. None of them removes a
// row, and there is no route that does — so a contact, once acquired, is
// in your address book for good.
//
// That is why this reaches into relay-state/who.json directly, which is
// exactly the kind of cheat labWorld's GAPS list exists to record. It
// matters more than it looks: every build mints NEW KEYS for the same
// names, so without this a third run leaves you with three lab-bellas,
// two of them dead, and the colour beside each is an honest answer to a
// question about somebody who no longer exists.
//
// The verb this wants is the sibling of remove-peer: owner-signed, by
// key, on your own node. Once it exists, this function becomes one call.
function forgetLabContacts() {
  const file = path.join(WORK_RUN, 'relay-state', 'who.json');
  let rows;
  try { rows = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return 0; }
  if (!Array.isArray(rows)) return 0;
  const kept = rows.filter(function (r) {
    const label = (r && (r.publicLabel || r.myLabel)) || '';
    return String(label).indexOf(NAME_PREFIX) !== 0;
  });
  const gone = rows.length - kept.length;
  if (gone) fs.writeFileSync(file, JSON.stringify(kept, null, 2));
  return gone;
}

async function down() {
  console.log('taking the lab world away');

  const me = auth.loadIdentity(WORK_RUN);
  if (me && me.privateKey) {
    const cleared = await clearLive(me);
    console.log('  live relay: ' + cleared.removed + ' lab-* peer(s) removed from spirit-3' +
      (cleared.error ? ' (' + cleared.error + ')' : ''));
  } else {
    console.log('  live relay: skipped, no identity to sign a removal with');
  }

  if (fs.existsSync(BACKUP)) {
    // Byte for byte, so nothing about the real relay row can drift
    // through a build-and-teardown cycle.
    fs.copyFileSync(BACKUP, RELAYS);
    fs.unlinkSync(BACKUP);
    console.log('  relays.json restored from before-lab backup');
  } else {
    const kept = readRelays().filter(function (r) {
      return String(r && r.url || '').indexOf('127.0.0.1:654') === -1;
    });
    writeRelays(kept);
    console.log('  no backup found — lab rows filtered out of relays.json');
  }

  // destroy() clears every lw-* node labMaster knows about, so a teardown
  // works in a fresh process that remembers nothing — which is the only
  // kind of teardown that survives the sandbox wipe this tool exists for.
  const world = labWorld.createWorld({});
  await world.destroy();
  console.log('  lab nodes deleted (every lw-* row labMaster holds)');

  // STOPPED FIRST, because the node must be down before its address book
  // is edited under it. It holds no lock, but it does hold the file's
  // contents in memory and would write them back over this on its next
  // inbox sweep — an edit that undoes itself a second later is worse
  // than no edit, because it looks like it worked.
  await post(MASTER + '/api/nodes/work/stop');
  await sleep(1200);
  const forgotten = forgetLabContacts();
  console.log('  contacts: ' + forgotten + ' lab-* row(s) removed from your address book');

  if (await restartWork()) console.log('  work node restarted');
  else console.log('  NOTE: restart your work node by hand — labMaster could not');
  console.log('done');
}

async function up(scenarioName) {
  const scenario = loadScenario(scenarioName);
  if (!scenario) {
    console.log('No scenario called "' + scenarioName + '".');
    console.log('Available: ' + (listScenarios().join(', ') || 'none'));
    return;
  }
  const PEOPLE = (scenario.peers || []).map(function (p) { return NAME_PREFIX + p.name; });
  const byName = Object.create(null);
  (scenario.peers || []).forEach(function (p) { byName[NAME_PREFIX + p.name] = p; });
  console.log('scenario  : ' + scenario.title);
  console.log('            ' + scenario.why);

  // READ ONLY. See the rule at the top of this file.
  const me = auth.loadIdentity(WORK_RUN);
  if (!me || !me.publicKey || !me.privateKey) {
    console.log('Your node has no identity yet — claim a name on a relay first.');
    console.log('Nothing was changed.');
    return;
  }
  console.log('you are   : ' + me.name + '  ...' + me.publicKey.slice(-12));

  const world = labWorld.createWorld({
    peers: PEOPLE.length,
    peerNames: PEOPLE,
    owner: me,
  });

  console.log('building  : a lab relay you own, plus ' + PEOPLE.length + ' peers');
  const built = await world.build();
  if (!built.ok) {
    console.log('failed    : ' + built.error);
    return;
  }
  const relayUrl = world.relay().url;
  console.log('relay     : ' + relayUrl + '  (owned by you)');

  // The lab relay goes FIRST, because hub.loadRelayUrl uses relays.json[0]
  // for adding contacts and reading an inbox. Your real relay stays in the
  // list, one row down, and --down puts the order back.
  if (!fs.existsSync(BACKUP) && fs.existsSync(RELAYS)) {
    fs.copyFileSync(RELAYS, BACKUP);
  }
  const rows = readRelays().filter(function (r) {
    return String(r && r.url || '') !== relayUrl;
  });
  writeRelays([{ label: 'lab', url: relayUrl }].concat(rows));
  console.log('relays    : lab row placed first, ' + rows.length + ' kept behind it');

  if (!await restartWork()) {
    console.log('');
    console.log('STOPPED   : the work node did not restart, so it has not re-read');
    console.log('            relays.json and would show you a world it cannot see.');
    console.log('            labMaster can only restart a node it started itself.');
    console.log('            Restart it and run this again — everything else is done.');
    return;
  }
  console.log('work node : restarted (verified by startedAt, not by a ping)');

  // Through the real route a person uses, so this exercises the same path
  // rather than writing whoBook by hand.
  let added = 0;
  for (const peer of world.peers()) {
    const done = await post(WORK_URL + '/api/hub/contact', { publicKey: peer.id.publicKey });
    if (done.ok) added += 1;
    else console.log('  contact ' + peer.name + ': ' + JSON.stringify(done.body));
  }
  console.log('contacts  : ' + added + ' of ' + world.peers().length + ' added');

  // ── The real relay ────────────────────────────────────────────────
  // Possible at all only because remove-peer exists. Before GAP 2 closed,
  // a fixture put on a live relay was a resident forever — which is why
  // this tool was lab-only when it was written an hour ago.
  const live = [];
  for (const peer of world.peers()) {
    const wants = byName[peer.name] || {};
    if ((wants.on || []).indexOf('live') === -1) continue;
    const minted = await post(LIVE_RELAY + '/api/relay/invite', {
      name: me.name,
      label: peer.name,
      days: 1,
      sig: auth.sign(me.privateKey, invites.mintMessage(peer.name, 1)),
    });
    const token = minted.body && minted.body.token;
    if (!token) {
      console.log('  ' + peer.name + ' on live: mint refused ' + JSON.stringify(minted.body));
      continue;
    }
    const joined = await post(LIVE_RELAY + '/api/relay/claim', {
      name: peer.name,
      publicKey: peer.id.publicKey,
      sig: auth.sign(peer.id.privateKey, auth.claimMessage(peer.name)),
      invite: token,
    });
    if (!joined.ok && !(joined.body && joined.body.error === 'name taken')) {
      console.log('  ' + peer.name + ' on live: claim refused ' + JSON.stringify(joined.body));
      continue;
    }

    // And their node learns about it, so it holds a stream there too and
    // shows up in everyone's presence rather than only in a roster.
    const theirRelays = path.join(peer.node.home, 'app', 'natter', 'relays.json');
    let rows = [];
    try { rows = JSON.parse(fs.readFileSync(theirRelays, 'utf8')); } catch (e) { rows = []; }
    if (!rows.some(function (r) { return r && r.url === LIVE_RELAY; })) {
      rows.push({ label: 'spirit', url: LIVE_RELAY });
      fs.writeFileSync(theirRelays, JSON.stringify(rows, null, 2));
    }
    await post(MASTER + '/api/nodes/' + peer.node.id + '/stop');
    await post(MASTER + '/api/nodes/' + peer.node.id + '/start');
    live.push(peer.name);
  }
  console.log('live relay: ' + (live.length ? live.join(', ') + ' now have rows on spirit-3'
    : 'nobody added'));

  // ── They know each other ──────────────────────────────────────────
  // Added through each peer's OWN node, on the loopback port labMaster
  // gave it — the same route a person uses, so this exercises the real
  // path rather than writing whoBook by hand.
  await sleep(2500);
  let friendships = 0;
  for (const pair of (scenario.knows || [])) {
    const one = world.peer(NAME_PREFIX + pair[0]);
    const two = world.peer(NAME_PREFIX + pair[1]);
    if (!one || !two) continue;
    const there = await post(one.url + '/api/hub/contact', { publicKey: two.id.publicKey });
    const back = await post(two.url + '/api/hub/contact', { publicKey: one.id.publicKey });
    if (there.ok && back.ok) friendships += 1;
    else console.log('  ' + one.name + ' <-> ' + two.name + ': ' +
      JSON.stringify((there.ok ? back : there).body));
  }
  console.log('friends   : ' + friendships + ' pair(s) know each other');

  // A little mail, so Relay Chat is not an empty screen. Sent by the
  // peers, to you, signed by them — the ordinary path.
  let sent = 0;
  for (const note of (scenario.messages || [])) {
    const peer = world.peer(NAME_PREFIX + note.from);
    if (!peer) continue;
    const text = note.text;
    const out = await post(relayUrl + '/api/relay/send', {
      from: peer.name,
      to: me.name,
      text: text,
      sig: auth.sign(peer.id.privateKey, auth.sendMessage(peer.name, me.name, text)),
    });
    if (out.ok) sent += 1;
  }
  console.log('messages  : ' + sent + ' waiting for you');

  // ── Nodes the scenario wants DOWN ─────────────────────────────────
  // A peer with a row whose node is not running is the only way red
  // appears: a relay SAYS he is absent, which is what makes red different
  // from white. Stopped last, so everything above could be set up through
  // his node first.
  const stopped = [];
  for (const peer of world.peers()) {
    const wants = byName[peer.name] || {};
    if (wants.running === false) {
      await post(MASTER + '/api/nodes/' + peer.node.id + '/stop');
      stopped.push(peer.name);
    }
  }
  if (stopped.length) console.log('stopped   : ' + stopped.join(', ') + '  (so red is visible)');

  // ── What happens AFTER the world exists ───────────────────────────
  // Removing somebody from a relay while they stay in your contacts is
  // how white appears — known to you, named by no relay you are
  // connected to. Possible at all only because remove-peer exists.
  let left = 0;
  for (const step of (scenario.then || [])) {
    const peer = world.peer(NAME_PREFIX + step.remove);
    if (!peer) continue;
    const relayUrlFor = step.from === 'live' ? LIVE_RELAY : world.relay().url;
    const done = await post(relayUrlFor + '/api/relay/remove-peer', {
      name: me.name,
      key: peer.id.publicKey,
      sig: auth.sign(me.privateKey, auth.removePeerMessage(peer.id.publicKey)),
    });
    if (done.ok) left += 1;
    else console.log('  remove ' + step.remove + ': ' + JSON.stringify(done.body));
  }
  if (left) console.log('left      : ' + left + ' peer(s) removed from a relay but kept in your contacts');

  console.log('');
  if (Array.isArray(scenario.look) && scenario.look.length) {
    console.log('Look at:');
    scenario.look.forEach(function (l) { console.log('  ' + l); });
    console.log('');
  }
  (scenario.peers || []).forEach(function (p) {
    if (p.expect) console.log('  ' + NAME_PREFIX + p.name + ' — ' + p.expect);
  });
  console.log('');
  console.log('Open the shell at ' + WORK_URL);
  console.log('  and the lab panel at ' + MASTER);
  console.log('');
  console.log('node spirit/test/labPopulate.js --down   to put it all back');
}

const args = process.argv.slice(2);

if (args.indexOf('--list') !== -1) {
  const all = listScenarios();
  if (!all.length) console.log('no scenarios in spirit/test/visual');
  all.forEach(function (name) {
    const doc = loadScenario(name) || {};
    console.log(name.padEnd(20) + (doc.title || ''));
    if (doc.why) console.log(' '.repeat(20) + doc.why);
  });
} else if (args.indexOf('--down') !== -1) {
  down().catch(function (e) { console.log('failed: ' + (e && e.stack ? e.stack : e)); });
} else {
  const named = args.filter(function (a) { return a.indexOf('--') !== 0; })[0];
  up(named || DEFAULT_SCENARIO).catch(function (e) {
    console.log('failed: ' + (e && e.stack ? e.stack : e));
  });
}
