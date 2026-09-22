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
const scenarioGrammar = require('./scenario');
const labWorld = require('./labWorld');

const WORK_RUN = path.join(__dirname, '..', 'run');
const WORK_PORT = 65432;
const WORK_URL = 'http://127.0.0.1:' + WORK_PORT;
const MASTER = require('./labMaster/labPaths').MASTER;
const RELAYS = path.join(WORK_RUN, 'app', 'natter', 'relays.json');
const BACKUP = path.join(WORK_RUN, 'app', 'natter', 'relays.json.before-lab');

// THE FILE THAT SAYS THIS NODE KNOWS WHO IT IS, and it is the one that
// mattered most while being the one nothing protected.
//
// firstRun() is decided by exactly one thing — a label in session.json —
// so without it a node with its identity, its contacts, its relays and
// its mail all intact still opens to Natter alone and behaves like a
// stranger to itself. Andy hit precisely that after a lab cycle:
// "it wont show the shell, it brings me directly to natter, indicating
// to me that I'm not hooked up with my satellite."
//
// It is gitignored, so no commit can bring it back, and it is untracked,
// so anything that clears a home to lay the tracked tree down takes it.
// relays.json got a byte-for-byte backup and this did not — and of the
// two, this is the one whose absence makes the node unusable.
const SESSION = path.join(WORK_RUN, 'app', 'natter', 'session.json');
const SESSION_BACKUP = path.join(WORK_RUN, 'app', 'natter', 'session.json.before-lab');


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

// THROUGH THE SHARED VOCABULARY, the same one world.js reads. Raw, this
// function handed back whatever JSON was on disk, so `peers: ["bert"]` —
// perfectly legal, and what the fast builder accepts — arrived here as a
// string whose `.name` was undefined, and the lab quietly built a peer
// called "lab-undefined".
//
// Normalising here is what makes "we both can use the same scenario"
// true rather than nearly true: everything downstream now sees names,
// labels, relays and flags filled in identically on both sides.
function loadScenario(name) {
  const file = path.join(SCENARIOS, name + '.visual.json');
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }

  // Refused rather than half-built. A lab world is forty seconds and
  // four processes; finding out then is finding out too late.
  const wrong = scenarioGrammar.problems(doc);
  if (wrong.length) {
    console.log('That scenario does not read:');
    wrong.forEach(function (w) { console.log('  - ' + w); });
    return null;
  }
  return scenarioGrammar.normalize(doc);
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

// ── ASKING A RELAY FOR SOMETHING, AS A LOOPBACK CLIENT ───────────────
//
//   Andy: "The browser itself is not crypte-capable but it's considered
//   a safe loop-back client, same for processes."
//
// This script is a process, which makes it exactly the kind of client
// the layer is for: no key, no signing, one POST over loopback and the
// node does the rest. It used to reach /api/hub/invite and
// /api/hub/remove-peer — two of the four post-path doors that closed on
// 2026-09-15 — and both of those built one packet body and handed it to
// router.post, which is what a peerPost IS.
//
// ADDRESSED BY KEY, so the relay's own key has to be fetched first. It
// is public in the census, which is the same place a browser reads it.
//
// The answer comes back inside the envelope the relay replied in, and
// the body is what a caller wants — the same shape api.peerPost hands a
// page (js/client/shell.js), reached the same way a page reaches it.
async function relayKeyOf(relayUrl) {
  try {
    const res = await fetch(relayUrl + '/api/relay/key');
    const parsed = await res.json();
    return (parsed && parsed.relayPublicKey) || '';
  } catch (e) { return ''; }
}

// ── A POST IS ANSWERED ON A STREAM, SO THE STREAM HAS TO BE OPEN ─────
//
// This is retried, and the reason is a real race rather than caution.
// restartWork() above proves the node came back by watching startedAt
// move — but answering HTTP and holding a stream to a relay on another
// continent are seconds apart, and a relay replies to a post on the
// ASKER'S stream. Fire in that window and the mint comes back refused
// with nothing useful in it.
//
// It showed as `mint refused null` for the first live peer and worked
// for the second, in the same run, which is the shape of a race and not
// of a broken verb: the same mint posted by hand a moment later returned
// a token.
//
// Bounded, and it does not retry a REFUSAL — only the empty answer that
// means nobody was listening yet. A relay saying no is an answer and
// gets reported.
async function postToRelay(relayUrl, body, tries) {
  const key = await relayKeyOf(relayUrl);
  if (!key) return { ok: false, status: 0, body: { error: 'relay did not say what its key is' } };

  const attempts = tries == null ? 4 : tries;
  let last = null;

  for (let n = 0; n < attempts; n += 1) {
    /* eslint-disable no-await-in-loop */
    const sent = await post(WORK_URL + '/api/spirit', {
      verb: 'peer.post', to: key, app: 'relay', body: body,
    });
    let answer = null;
    try { answer = JSON.parse((sent.body && sent.body.text) || 'null'); }
    catch (e) { answer = null; }
    const said = (answer && answer.body) || null;

    last = {
      // Both halves, for the reason clientLayer.js spells out: the
      // transport succeeding and the far end agreeing are different facts.
      ok: !!(sent.ok && said && said.ok !== false),
      status: sent.status,
      hash: (sent.body && sent.body.hash) || '',
      body: said,
    };

    // Answered at all — yes or no — so stop. Only silence is retried.
    if (said) return last;
    if (n < attempts - 1) await sleep(1500);
  }
  return last;
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
  // TRAILING NEWLINE KEPT, because relays.json is a TRACKED file and this
  // is the only writer that drops it. Without it every lab build leaves a
  // one-line whitespace diff in git status — noise that has to be
  // unstaged by hand each time, and the kind that eventually gets
  // committed by reflex.
  fs.writeFileSync(RELAYS, JSON.stringify(rows, null, 2) + '\n');
}

// Remove anything named `lab-*` from the live relay.
//
// ── IT SWEPT BY PATTERN, AND CANNOT ANY MORE (2026-09-18) ───────────
//
// This read `GET /api/relay/who` and matched every row whose label began
// `lab-`. The justification was real and is worth keeping: "by PATTERN
// and not from a list, so this still works after a sandbox wipe has taken
// every local trace of what was created — the one case where being unable
// to clean up would leave fixtures on a box that cannot be edited from
// here."
//
// The route is gone. A public, unsigned read of every member was named a
// cheat in decision 0010 and eradicated the next day, and 0012 leaves no
// bounded or owner-only version of it. So the recovery path goes with it:
// an owner's view of its own roster is the relay REPORTING to its owner
// on the owner's own stream (relay.statusToOwner), which does not carry
// one yet — design/relay/SURFACE.md §10, the improvement tier.
//
// What still works is removing from a list this process holds. What does
// not is recovering after that list is lost, and this says so rather than
// reporting a clean sweep of a relay it could not read.
async function clearLive(me, known) {
  let removed = 0;
  const rows = Array.isArray(known) ? known : [];
  if (!rows.length) {
    return {
      removed: 0,
      error: 'no local list of what was created, and a relay no longer publishes ' +
        'its roster to sweep by pattern (decision 0012). Remove them from Natter, ' +
        'or wait for the owner report to carry a roster (SURFACE.md §10).',
    };
  }
  for (const row of rows) {
    const label = row.publicLabel || row.name || '';
    if (label.indexOf('lab-') !== 0 || !row.publicKey) continue;
    // THROUGH THE NODE'S OWN DOOR. /api/relay/remove-peer is gone
    // (decision 0010) and the reply to a post lands on the asker's
    // STREAM — which the work node is already holding. Signing from here
    // would mean opening a second stream with Andy's key and knocking his
    // running node off the relay.
    const done = await postToRelay(LIVE_RELAY, { removePeer: { key: row.publicKey } });
    if (done.ok) removed += 1;
    else console.log('  could not remove ' + label + ': ' + JSON.stringify(done.body));
  }
  return { removed: removed };
}

// ~~GAP — NOTHING MAKES A NODE FORGET A PERSON.~~ — STRUCK 2026-09-21.
//
// It said: "contactBook offers block, unblock, accept and label. None of
// them removes a row, and there is no route that does — so a contact,
// once acquired, is in your address book for good."
//
// **All three clauses are now false.** `contactBook.forget` exists
// (contacts.js:442), `hub.handlePeer` answers the `forget` action
// (hub.js:1354), and it is a verb a client calls — `contact.forget`
// (server.js:1379), which contactsDetails already uses.
//
// SO THE CHEAT BELOW IS NO LONGER NECESSARY and should become the one
// call this note predicted. It is left standing only because a teardown
// runs with the work node STOPPED, and the verb needs it running — which
// is an ordering problem, not a missing feature.
//
// That is why this reaches into the contact book directly, which is
// exactly the kind of cheat labWorld's GAPS list exists to record. It
// matters more than it looks: every build mints NEW KEYS for the same
// names, so without this a third run leaves you with three lab-bellas,
// two of them dead, and the colour beside each is an honest answer to a
// question about somebody who no longer exists.
//
// The verb this wants is the sibling of remove-peer: owner-signed, by
// key, on your own node. Once it exists, this function becomes one call.
//
// ── IT READ who.json UNTIL 2026-09-21, AND SO REMOVED NOTHING ────────
//
// The store was renamed on Andy's own instruction — "who.json should be
// contacts.json" (contacts.js:146) — and this was not moved with it. The
// read threw ENOENT, the catch answered 0, and every teardown since has
// reported a count it never earned. A cheat that reaches past the API is
// exactly the code that a rename cannot reach, which is the cost this
// GAP note was already describing and the reason the verb is wanted.
//
// WHAT IT STILL CANNOT DO, said plainly rather than left to be
// rediscovered: it matches on the `lab-` prefix, and a row that arrived
// with NO LABEL AT ALL cannot be matched by a rule about labels. Those
// are the rows that read as a key tail on screen — 19 of 33 on the work
// node when this was found. Clearing them means matching on the lab
// relay's address instead, which is deleting rows by inference from an
// address book, and nobody has asked for that.
function forgetLabContacts() {
  const file = path.join(WORK_RUN, 'relay-state', 'contacts.json');
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

  // THE BINDING FIRST, because it is the one that decides whether the
  // shell opens at all. Restored whether or not it is currently missing:
  // a session.json that was replaced is as wrong as one that was removed.
  if (fs.existsSync(SESSION_BACKUP)) {
    fs.copyFileSync(SESSION_BACKUP, SESSION);
    fs.unlinkSync(SESSION_BACKUP);
    console.log('  session.json restored — this node knows its own name again');
  } else if (!fs.existsSync(SESSION)) {
    // No backup and no file: say so rather than leaving somebody to
    // discover it by being dropped into Natter. Not written from the
    // identity, deliberately — binding is a decision a person makes in
    // Natter, and inventing one here would be this tool deciding who
    // somebody is.
    console.log('  session.json is MISSING and there was no backup —');
    console.log('    the shell will open on Natter until you bind a name there.');
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

  // STALE LAB ROWS GO FIRST, on the live relay as well as locally.
  //
  // labMaster recycles a lab NODE before laying its tree down (GAP 5), so
  // a second build starts from an empty home. The live relay had no such
  // courtesy: every build mints new invites and claims with NEW KEYS, and
  // spirit-3's routing table only grows — so building twice without a
  // --down in between left `lab-bella` on it twice, wearing one label with
  // two keys.
  //
  // That is not a hypothetical. It happened three times in one afternoon
  // to the person who wrote the warning about it, which is the tell that
  // the answer is code rather than discipline. And the duplicates are not
  // merely untidy: a duplicate label resolves to NOBODY (findByLabel), so
  // the second build silently breaks enrolment, inbox reads by label and
  // the device page on the very identities it just created.
  //
  // Possible at all only because remove-peer exists — before GAP 2 closed,
  // this could only have been a warning.
  const swept = await clearLive(me);
  if (swept.removed) {
    console.log('live relay: ' + swept.removed + ' stale lab-* row(s) cleared before building');
  }
  // AND THE ADDRESS BOOK, for the same reason and by the function that
  // already predicted this: "without this a third run leaves you with
  // three lab-bellas, two of them dead, and the colour beside each is an
  // honest answer to a question about somebody who no longer exists."
  //
  // It was written and then only ever called from --down, so the failure
  // it describes happened anyway. A sweep that runs on the way down but
  // not on the way up protects a teardown and not a rebuild, and a
  // rebuild is the common case.
  const forgotten = forgetLabContacts();
  if (forgotten) {
    console.log('contacts  : ' + forgotten + ' stale lab-* row(s) forgotten before building');
  }

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
  // And the binding, for the same reason and with more at stake. This
  // tool does not write session.json — but it restarts and rebuilds
  // around a home whose untracked files nothing else is keeping, and a
  // backup that is never needed costs one copy.
  if (!fs.existsSync(SESSION_BACKUP) && fs.existsSync(SESSION)) {
    fs.copyFileSync(SESSION, SESSION_BACKUP);
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
  // rather than writing contactBook by hand.
  let added = 0;
  for (const peer of world.peers()) {
    const done = await post(WORK_URL + '/api/spirit', { verb: 'peer.acquire', publicKey: peer.id.publicKey });
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
    // THROUGH THE WORK NODE'S OWN DOOR, not the relay's. There is no
    // /api/relay/invite any more (decision 0010): a mint is a post to the
    // relay, and the relay answers on the asker's STREAM — which the work
    // node is already holding. Opening a second stream with Andy's key
    // from here would displace the first and knock his running node off
    // the relay it is bound to.
    //
    // So this asks the node to mint, which is what Natter's own button
    // does. Andy's rule, and the reason this reads better than the two
    // lines it replaces: production code must go through the API.
    const minted = await postToRelay(LIVE_RELAY, {
      invite: { label: peer.name, days: 1, token: '' },
    });
    const token = minted.body && minted.body.invite && minted.body.invite.token;
    if (!token) {
      console.log('  ' + peer.name + ' on live: mint refused ' + JSON.stringify(minted.body));
      continue;
    }
    // THE TOKEN AND THE WORD TRAVEL TOGETHER since R1, or the claim is
    // refused — "invite label required". The relay stopped falling back
    // for stale nodes on purpose:
    //
    //   Andy: "i dislike a relay supporting stale nodes at this point
    //   the nodes should break rather than STILL having code on a relay
    //   that support old crap"
    //
    // The mint above wrote `label: peer.name`, so the word IS the name
    // here. Sent explicitly all the same: they are two different things
    // that happen to coincide in a lab, and writing the name twice is
    // what says so.
    const joined = await post(LIVE_RELAY + '/api/relay/claim', {
      name: peer.name,
      publicKey: peer.id.publicKey,
      sig: auth.sign(peer.id.privateKey, auth.claimMessage(peer.name)),
      invite: token,
      inviteLabel: peer.name,
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
  // path rather than writing contactBook by hand.
  await sleep(2500);
  let friendships = 0;
  for (const pair of (scenario.knows || [])) {
    const one = world.peer(NAME_PREFIX + pair[0]);
    const two = world.peer(NAME_PREFIX + pair[1]);
    if (!one || !two) continue;
    const there = await post(one.url + '/api/spirit', { verb: 'peer.acquire', publicKey: two.id.publicKey });
    const back = await post(two.url + '/api/spirit', { verb: 'peer.acquire', publicKey: one.id.publicKey });
    if (there.ok && back.ok) friendships += 1;
    else console.log('  ' + one.name + ' <-> ' + two.name + ': ' +
      JSON.stringify((there.ok ? back : there).body));
  }
  console.log('friends   : ' + friendships + ' pair(s) know each other');

  // A LITTLE MAIL WAS SENT HERE, so Relay Chat was not an empty screen:
  // each peer posted to you through /api/relay/send, signed by them.
  //
  // Both halves of that are gone as of 2026-09-15 (R8). There is no
  // `send` and no store behind it, so nothing can be waiting when you
  // arrive — a packet exists only while somebody is connected to receive
  // it. The `messages` field a scenario used to declare is refused by
  // name now; see scenario.js for the reasoning and for what would bring
  // it back (seeding the receiving NODE's traffic log, which is where a
  // node's own record of what arrived actually lives).
  //
  // Relay Chat is an empty screen for a second reason anyway: its receive
  // path was the ring's, and it has not been retrofitted. That is a known
  // breakage and Andy's call — "I'd rather see apps breaking than apps
  // faking."
  console.log('messages  : none — a relay keeps no mail (R8)');

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
    const done = await postToRelay(relayUrlFor, { removePeer: { key: peer.id.publicKey } });
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
