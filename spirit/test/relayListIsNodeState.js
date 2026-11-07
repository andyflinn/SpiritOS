'use strict';

// spirit/test/relayListIsNodeState.js
// goal/G16.3: the list of relays a node uses is the NODE'S state, read and written through node verbs, never an
// app's folder (rule 3: no app logic in node or relay). It is node.db's relays, keyed by relay key (goal/G19.15,
// goal/G40.11), seeded with noderoutes.net alone, and a claim that succeeds is what adds a relay.
//
// ANDY'S DECISIONS, which this asserts and does not revisit:
//   - TWO VERBS, AND HE NAMED THEM, 2026-10-10: "Q4: Do you approve two new commands on the node, list relays
//     and remove relay, with a successful claim adding its relay? yes." A third verb for adding a relay is not
//     approved and section 2 asserts its ABSENCE: adding a verb to the node's interface needs peer review and his
//     yes on that verb (AGENT.md), and his sentence already says how a relay gets in — a successful claim puts it
//     there. The relays are listed by contact.search (goal/G40.11), relay.remove removes one.
//   - "there are no (complete) lists, only searches" (puppets/G2), which is why the listing verb is a search.
//   - Ownership is written at install and never travels (goal/G16.8), so a claim only ever adds a MEMBER's relay
//     to this list. Section 6 asserts that reading.
//
// WHAT IS ASSERTED
//   1. THE LIST IS NODE STATE: the node seeds node.db's relays with noderoutes.net alone, writes no relays.json,
//      and a list planted in the app's folder is not read.
//   3. NO NODE FILE REACHES INTO THE APP'S FOLDER for this list.
//   4. THE TWO WIRE TEXTS NAME NO APP PATH, in the register both sides load.
//   5. NO APP OR PAGE CAN REDIRECT THE NODE: the write gate refuses spirit/state/relays.json.
//   6. A CLAIM IS WHAT ADDS A RELAY, and ownership is not: nothing in the claim path writes an owner, and the
//      list is written by the node when a claim succeeds.
//   7. THE PEER COUNTERS ARE NODE STATE TOO: node bookkeeping is not written into the Contacts app's folder.
//   8. ONE RELAY IS A FLOOR: noderoutes.net cannot be removed, the other public relay still can, and a node
//      holding only the floor cannot empty itself.
//
// rule/11: predicates and module reads only; the one disk fixture is a temp rootDir of this suite's own.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');
const errors = require('../run/spirit/spiritErrors.js');
const ownerBadge = require('../run/spirit/ownerBadge.js');

const OWED = 'OWED by goal/G16.3: ';
const RUN = path.join(__dirname, '..', 'run');
const JS = path.join(RUN, 'spirit');
const APP_FILE = path.join('shell', 'natter', 'relays.json');
const STATE_FILE = path.join('spirit', 'state', 'relays.json');
const DB_FILE = path.join('spirit', 'state', 'node.db');
const relayKeys = require('../run/spirit/relayKeys.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function there(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }

// A node root with nothing in it: the fresh-clone case ensureRelays exists for.
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaylist-'));
  fs.mkdirSync(path.join(root, 'shell', 'natter'), { recursive: true });
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  return root;
}

// Every .js the NODE runs, so "does the node read the app's folder" can be asked of the node's own code.
function nodeFiles(into) {
  fs.readdirSync(JS).forEach(function (name) {
    if (!/\.js$/.test(name)) return;
    into.push({ rel: 'spirit/run/spirit/' + name, text: read(path.join(JS, name)) });
  });
  return into;
}

test.startTest('The relay list is the node\'s own state, not an app\'s file (goal/G16.3)');

// ── 1. THE LIST IS NODE STATE ───────────────────────────────────────────
test.subHeading('1. the node seeds and reads spirit/state/relays.json, not the app\'s folder');
{
  const root = freshRoot();
  const seeded = ownerBadge.ensureRelays(root);

  // The node's own state is node.db, keyed by relay key; relays.json is never written.
  if (there(path.join(root, DB_FILE)) && !there(path.join(root, STATE_FILE))) test.check('a fresh node seeds its relays table in spirit/state/node.db');
  else test.fail(OWED + 'a fresh node has no spirit/state/node.db, or wrote spirit/state/relays.json');

  if (!there(path.join(root, APP_FILE))) test.check('and writes nothing into the Natter app\'s folder');
  else test.fail(OWED + 'a fresh node still wrote ' + APP_FILE + ': the app\'s folder decides where this node talks');

  // ONE ROW (goal/G19.15): "No, now that we have it, we only list noderoutes.net, spirit.andyflinn.com is OURS."
  // (Andy, 2026-10-12).
  const got = ownerBadge.loadRelays(root);
  const urls = Array.isArray(got) ? got.map(function (r) { return String((r && r.url) || ''); }) : [];
  if (urls.length === 1 && /^https:\/\/noderoutes\.net$/.test(urls[0])) {
    test.check('seeded with the one relay he named: ' + short(urls.join(', ')));
  } else {
    test.fail(OWED + 'the seeded list is not noderoutes.net alone: ' + short(got));
  }
  if (!urls.some(function (u) { return /spirit\.andyflinn\.com/.test(u); })) {
    test.check('and spirit.andyflinn.com is not seeded: it is ours, and a node gets it by claiming there');
  } else {
    test.fail(OWED + 'the seed still names spirit.andyflinn.com: ' + short(urls.join(', ')));
  }

  if (Array.isArray(seeded) && seeded.length === 1) test.check('and ensureRelays hands that row back to its caller');
  else test.fail(OWED + 'ensureRelays did not return the seeded row: ' + short(seeded));
}

// A list planted in the app's folder must not steer the node: otherwise an app would choose the node's relays.
{
  const root = freshRoot();
  // The node's own list is a keyed row in node.db (goal/G19.15).
  relayKeys.list(root, 'https://127.0.0.1:1', 'mine', 'RELAYKEY-mine');
  fs.writeFileSync(path.join(root, APP_FILE), JSON.stringify([{ label: 'theirs', url: 'https://127.0.0.2:2' }]));
  const used = ownerBadge.loadRelays(root);
  const urls = (used || []).map(function (r) { return r.url; }).join(',');
  if (/127\.0\.0\.1/.test(urls) && !/127\.0\.0\.2/.test(urls)) {
    test.check('a row planted in the app\'s folder is not read; the node\'s own list is: ' + short(urls));
  } else {
    test.fail(OWED + 'the node read the app\'s folder: ' + short(urls));
  }
}

// ── 3. THE NODE DOES NOT REACH INTO THE APP'S FOLDER ────────────────────
test.subHeading('3. no node file reads the Natter app\'s folder for this list');
{
  const bad = nodeFiles([]).filter(function (f) { return /shell['"\s,\/)\]]*.{0,12}natter.{0,16}relays\.json/.test(f.text) || /'natter', 'relays\.json'/.test(f.text); });
  if (!bad.length) test.check('nothing under spirit/run/js names the app\'s relays.json');
  else test.fail(OWED + 'the app\'s relays.json is still read by: ' + bad.map(function (f) { return f.rel; }).join(', '));
}

// ── 4. THE TWO WIRE TEXTS LOSE THE PATH ─────────────────────────────────
//
// Both are matched on the wire and the register is loaded by node and relay alike, so the text is interface, not
// prose: it must not name a file that no longer exists.
test.subHeading('4. the refusals name no app path');
{
  ['no-relay-url', 'url-not-listed'].forEach(function (code) {
    const row = errors.byCode ? errors.byCode(code) : null;
    const texts = row && row.texts ? row.texts.join(' | ') : '';
    if (!texts) {
      test.fail(OWED + 'the register has no texts for ' + code + ': ' + short(row));
    } else if (!/shell\/natter/.test(texts)) {
      test.check(code + ' no longer names the app\'s folder: ' + short(texts));
    } else {
      test.fail(OWED + code + ' still says ' + short(texts));
    }
  });
}

// ── 5. NO APP OR PAGE CAN REDIRECT THE NODE ─────────────────────────────
//
// If the node's list were writable through fs, an app could point the node anywhere. Predicate only — nothing here
// writes (pathCanonicalization.js's rule).
test.subHeading('5. the write gate refuses the node\'s relay list');
{
  const writable = spirit.core.fs.fileWritable;
  ['spirit/state/relays.json', './spirit/state/relays.json'].forEach(function (p) {
    if (writable(p) === false) test.check('fs refuses to write ' + p);
    else test.fail(OWED + 'fs would write ' + p + ': an app could point this node anywhere');
  });
}

// ── 6. A CLAIM ADDS A RELAY; OWNERSHIP DOES NOT TRAVEL ──────────────────
//
// There is one way onto the list: ownership is written at install and never over the wire (goal/G16.8), so the
// list is only ever grown by a claim that succeeded.
test.subHeading('6. the claim path writes the list, and no owner');
{
  const hub = read(path.join(JS, 'hub.js'));
  if (!/becomeOwner|isOwnerInvite|owner invite/.test(hub)) {
    test.check('hub.js knows nothing of an owner invite: ownership is not reachable from a claim');
  } else {
    test.fail(OWED + 'hub.js still names the owner-invite path that goal/G16.8 deleted');
  }

  // The node's own list writer is what a successful claim calls, so seeding alone cannot pass section 1.
  // The node's own list is the relays kept in node.db's one table, seen (goal/G40.11): the claim lists through
  // ownerBadge.addRelay, and ownerBadge writes through relayKeys, which keeps a relay's row there.
  if (/ownerBadge\.addRelay\(/.test(hub) && /relayKeys\.list\(/.test(read(path.join(JS, 'ownerBadge.js'))) &&
      /keep: true/.test(read(path.join(JS, 'relayKeys.js'))) && /CREATE TABLE IF NOT EXISTS seen \(/.test(read(path.join(JS, 'nodeStore.js'))) &&
      !/CREATE TABLE IF NOT EXISTS relays \(/.test(read(path.join(JS, 'nodeStore.js')))) {
    test.check('the claim lists its relay through ownerBadge.addRelay, as a kept row of node.db\'s one table');
  } else {
    test.fail(OWED + 'the claim does not reach the node\'s own relays table: nothing writes the node\'s own list');
  }
}

// ── 7. THE PEER COUNTERS ARE NODE STATE ─────────────────────────────────
test.subHeading('7. node bookkeeping is not written into the Contacts app\'s folder');
{
  const bad = nodeFiles([]).filter(function (f) { return /shell['"\s,\/)\]]*.{0,12}contacts/.test(f.text) && /peerfile|peerStats/.test(f.text); });
  if (!bad.length) test.check('no node file keeps peer counters under the Contacts app');
  else test.fail(OWED + 'peer counters are still written under shell/contacts by: ' + bad.map(function (f) { return f.rel; }).join(', '));
}

// ── 8. ONE RELAY CANNOT BE DELETED, AND IT IS THE FLOOR ─────────────
//
// Andy, 2026-10-11, closing the question of what seeding a second relay costs: "we'll remove the option to
// delete noderoutes.net". A relay that cannot go is a floor, so the rule that stops somebody deleting their last
// relay needs no notion of which relay has ever answered — there is always one left by construction.
//
// Asserted on ownerBadge.removalRefusal, the rule the screens ask, rather than on a screen: that is where the floor
// has to hold, whatever screen offers Remove (today the contact selector's relayPanel).
test.subHeading('8. noderoutes.net cannot be removed, so a node always keeps one way in');
{
  const pinned = 'https://noderoutes.net';
  const other = 'https://spirit.andyflinn.com';
  const both = [{ label: 'noderoutes', url: pinned }, { label: 'spirit', url: other }];

  if (ownerBadge.removalRefusal(both, pinned) !== '') {
    test.check('the floor holds: noderoutes.net cannot be removed even with another public relay beside it');
  } else {
    test.fail(OWED + 'noderoutes.net can still be removed, so a node can be left with no floor at all');
  }

  // AND THE OTHER ONE STILL GOES. A floor that froze the whole list would be a different bug: somebody who
  // joins their own relay must still be able to drop a public one they do not want.
  if (ownerBadge.removalRefusal(both, other) === '') {
    test.check('and the other public relay can still be removed, so the floor is one row, not the list');
  } else {
    test.fail(OWED + 'no public relay can be removed any more: the floor froze the whole list');
  }

  // A LIST OF ONLY THE FLOOR: nothing to remove, and nothing to be left with.
  if (ownerBadge.removalRefusal([{ label: 'noderoutes', url: pinned }], pinned) !== '') {
    test.check('and a node holding only the floor cannot empty itself');
  } else {
    test.fail(OWED + 'a node holding only noderoutes.net could remove it and keep nothing');
  }
}

test.reportSuccessFailureCount();
