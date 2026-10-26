'use strict';

// spirit/test/relayListIsNodeState.js
// goal/G16.3: the list of relays a node uses is the NODE'S state, read and written through node verbs, and it
// leaves the Natter app's folder (A1 of the review of 2026-10-10, rule 3: no app logic in node or relay).
// Written first, red on today's code, by wsl-claude; the build is the other agent's.
//
// WHY. Today the node reads shell/natter/relays.json — an app's folder, writable through fs by any shell app and
// seeded at every boot by ownerBadge.ensureRelays (server.js calls it). So where this node claims, acquires,
// shows presence and searches peers is decided by a file an app owns, and a node whose Natter folder is renamed
// or emptied quietly points at Andy's relay again. The node's own business belongs in the node's own state.
//
// ANDY'S DECISIONS, which this asserts and does not revisit:
//   - The item exists at his word, 2026-10-10: "Q3: Add it? yes".
//   - TWO VERBS, AND HE NAMED THEM, 2026-10-10: "Q4: Do you approve two new commands on the node, list relays
//     and remove relay, with a successful claim adding its relay? yes." So relay.search and relay.remove, and
//     NOTHING ELSE. A third verb for adding a relay is not approved and section 2 asserts its ABSENCE: adding a
//     verb to the node's interface needs peer review and his yes on that verb (AGENT.md), and his sentence
//     already says how a relay gets in — a successful claim puts it there.
//     AND ONLY ONE OF THE TWO IS NEW. Verified at 9d0426bb: server.js:2070 already claims relay.search
//     (hub.relaySearch, the old graded search over relaySummary), so the box reads wrong in calling both new. What that
//     verb lacks is not existence but its source: it searches the APP's file today. So its check below is a
//     CONTROL — it must keep working — and the requirement on it is section 3's, that it read the node's list.
//     relay.remove is the one verb this item actually adds.
//   - "there are no (complete) lists, only searches" (puppets/G2), which is why the verb he approved is a search.
//
// THE BOX OF THIS ITEM IS STALE ON ONE POINT, recorded here so the next session does not build from it. Its
// SHAPE still says "a relay with no owner yet takes the first claim, with the owner invite its install printed,
// as its owner", and answers his question of 2026-10-10 ("adding a relay happens one of two ways: via
// invite/claim OR via ownership? where does that distinction happen?") with that mechanism. goal/G16.8 deleted
// it tonight, verified at 9d0426bb: there is no owner invite, no install.js, and a relay with no owner refuses
// every claim. So the distinction is simpler than the box has it — ownership is written at install and never
// travels, and a claim only ever adds a MEMBER's relay to this list. Section 6 asserts that reading.
//
// WHAT IS ASSERTED
//   1. THE LIST IS NODE STATE: the node reads and seeds relay-state/relays.json with the TWO relays he named,
//      and a list planted in the app's folder is not read. The app's file is gone from the tree. Since
//      goal/G19.15 the node's state is node.db's relays table, keyed by relay key, not relays.json, and the seed
//      is noderoutes.net alone.
//   2. THE TWO APPROVED VERBS EXIST AND NO THIRD ONE DOES: server.js claims relay.search and relay.remove, and
//      claims no relay.add.
//   3. NO NODE FILE REACHES INTO THE APP'S FOLDER for this any more.
//   4. THE TWO WIRE TEXTS LOSE THE PATH, in the register both sides load.
//   5. NO APP OR PAGE CAN REDIRECT THE NODE: the write gate refuses relay-state/relays.json.
//   6. A CLAIM IS WHAT ADDS A RELAY, and ownership is not: nothing in the claim path writes an owner, and the
//      list is written by the node when a claim succeeds.
//   7. THE PEER COUNTERS COME HOME TOO (A4, folded by his "place all you can into existing items"): node
//      bookkeeping is no longer written into the Contacts app's folder.
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
const STATE_FILE = path.join('relay-state', 'relays.json');
const DB_FILE = path.join('relay-state', 'node.db');
const relayKeys = require('../run/spirit/relayKeys.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function there(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }

// A node root with nothing in it: the fresh-clone case ensureRelays exists for.
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaylist-'));
  fs.mkdirSync(path.join(root, 'shell', 'natter'), { recursive: true });
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
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
test.subHeading('1. the node seeds and reads relay-state/relays.json, not the app\'s folder');
{
  const root = freshRoot();
  const seeded = ownerBadge.ensureRelays(root);

  // Since goal/G19.15 the node's own state is node.db's relays table, keyed by relay key, and relays.json is
  // never written: it is read once, moved in and deleted.
  if (there(path.join(root, DB_FILE)) && !there(path.join(root, STATE_FILE))) test.check('a fresh node seeds its relays table in relay-state/node.db');
  else test.fail(OWED + 'a fresh node has no relay-state/node.db, or wrote relay-state/relays.json');

  if (!there(path.join(root, APP_FILE))) test.check('and writes nothing into the Natter app\'s folder');
  else test.fail(OWED + 'a fresh node still wrote ' + APP_FILE + ': the app\'s folder decides where this node talks');

  // TWO ROWS, BY HIS DECISION OF 2026-10-11 — he reversed his own earlier "initialize with
  // spirit.andyflinn.com only" after proposing it himself: "why don't we just hard-code initialize it with two
  // relays spirit.andyflinn.com and noderoutes.net, one of them will always work, so the node on first start
  // will write that file, then it is initialized with at least one valid relay ?", with the reason
  // "noderoutes.net will not update as often as spirit" — a steadier box is the better fallback. Asked whether
  // one or two, he answered: "i say two."
  //
  // Since goal/G19.15 ONE ROW, superseding the two: "No, now that we have it, we only list noderoutes.net,
  // spirit.andyflinn.com is OURS." (Andy, 2026-10-12).
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

// A list planted in the app's folder must not steer the node. This is the hole in its own words: an app writes
// that file today, so an app chooses the node's relays.
{
  const root = freshRoot();
  // Since goal/G19.15: the node's own list is a keyed row in node.db.
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

// ── 2. THE TWO VERBS HE APPROVED, AND NO THIRD ──────────────────────────
//
// Read from server.js's claim blocks with everyVerb.js's own regex, so this says what the node really offers
// rather than what a hand list remembers.
test.subHeading('2. relay.search and relay.remove are claimed, and no relay.add is');
{
  const serverSrc = read(path.join(JS, 'server.js'));
  const claimed = [...serverSrc.matchAll(/^ {4}'([a-z]+\.[a-zA-Z]+)':/gm)].map(function (m) { return m[1]; });

  if (claimed.length >= 30) test.check(claimed.length + ' verbs read from server.js\'s claim blocks');
  else test.fail(OWED + 'only ' + claimed.length + ' verbs parsed: the claim shape moved and the checks below mean nothing');

  // A CONTROL: the relays are listed by contact.search since goal/G40.11 (Andy: "yes. those names."), and relay.search
  // went; contact.search must be claimed and relay.search must not.
  if (claimed.indexOf('contact.search') !== -1 && claimed.indexOf('relay.search') === -1) test.check('contact.search is claimed, the verb that lists relays, and relay.search is gone');
  else test.fail(OWED + 'the verb that lists relays is missing, or relay.search survived goal/G40.11');

  // THE ONE VERB THIS ITEM ADDS.
  if (claimed.indexOf('relay.remove') !== -1) test.check('the node claims relay.remove, which he approved by name');
  else test.fail(OWED + 'the node claims no relay.remove');

  // HIS APPROVAL COVERED TWO VERBS. A third is a boundary crossing, not a convenience, so its absence is a
  // requirement of this item and not an omission in it.
  if (claimed.indexOf('relay.add') === -1) {
    test.check('and no relay.add: he approved two verbs, and a successful claim is what adds a relay');
  } else {
    test.fail(OWED + 'the node claims relay.add, a verb he did not approve — the interface needs peer review AND his yes');
  }

  // A SEARCH, NOT A LIST (puppets/G2, "there are no (complete) lists, only searches"), which is why the verb is
  // named search. A relay.list would be the wrong shape whatever it answered.
  if (claimed.indexOf('relay.list') === -1) test.check('and no relay.list: the shape is a search');
  else test.fail(OWED + 'the node claims relay.list, and there are no complete lists, only searches');
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
// The whole point of the move. If the new file were writable through fs the hole would simply have changed
// address. Predicate only — nothing here writes (pathCanonicalization.js's rule).
test.subHeading('5. the write gate refuses the node\'s relay list');
{
  const writable = spirit.core.fs.fileWritable;
  ['relay-state/relays.json', './relay-state/relays.json'].forEach(function (p) {
    if (writable(p) === false) test.check('fs refuses to write ' + p);
    else test.fail(OWED + 'fs would write ' + p + ': an app could point this node anywhere');
  });
}

// ── 6. A CLAIM ADDS A RELAY; OWNERSHIP DOES NOT TRAVEL ──────────────────
//
// His question of 2026-10-10 was where the distinction between joining by claim and joining by ownership
// happens. Since goal/G16.8 there is no second way: ownership is written at install and never over the wire, so
// the list is only ever grown by a claim that succeeded.
test.subHeading('6. the claim path writes the list, and no owner');
{
  const hub = read(path.join(JS, 'hub.js'));
  if (!/becomeOwner|isOwnerInvite|owner invite/.test(hub)) {
    test.check('hub.js knows nothing of an owner invite: ownership is not reachable from a claim');
  } else {
    test.fail(OWED + 'hub.js still names the owner-invite path that goal/G16.8 deleted');
  }

  // The node's own list writer is what a successful claim calls. Named here so a build that leaves Natter
  // writing the file through fs cannot pass section 1 by seeding alone.
  // Since goal/G40.11 the node's own list is the relays kept in node.db's one table, seen: the claim lists through
  // ownerBadge.addRelay, and ownerBadge writes through relayKeys, which keeps a relay's row there.
  if (/ownerBadge\.addRelay\(/.test(hub) && /relayKeys\.list\(/.test(read(path.join(JS, 'ownerBadge.js'))) &&
      /keep: true/.test(read(path.join(JS, 'relayKeys.js'))) && /CREATE TABLE IF NOT EXISTS seen \(/.test(read(path.join(JS, 'nodeStore.js'))) &&
      !/CREATE TABLE IF NOT EXISTS relays \(/.test(read(path.join(JS, 'nodeStore.js')))) {
    test.check('the claim lists its relay through ownerBadge.addRelay, as a kept row of node.db\'s one table');
  } else {
    test.fail(OWED + 'the claim does not reach the node\'s own relays table: nothing writes the node\'s own list');
  }
}

// ── 7. THE PEER COUNTERS COME HOME (A4, folded) ─────────────────────────
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
// Asserted on removalRefusal (canRemoveRelay until goal/G30.7), the rule the screens ask, rather than on a screen: that is where the floor has to
// hold, whatever Natter grows later. (No screen offers remove today, so a check on the button would assert
// nothing.)
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
