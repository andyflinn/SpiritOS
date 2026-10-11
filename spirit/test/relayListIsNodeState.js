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
//     (hub.relaySearch, searchBucket over relaySummary), so the box reads wrong in calling both new. What that
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
//   1. THE LIST IS NODE STATE: the node reads and seeds relay-state/relays.json, and a list planted in the
//      app's folder is not read. The app's file is gone from the tree.
//   2. THE TWO APPROVED VERBS EXIST AND NO THIRD ONE DOES: server.js claims relay.search and relay.remove, and
//      claims no relay.add.
//   3. NO NODE FILE REACHES INTO THE APP'S FOLDER for this any more.
//   4. THE TWO WIRE TEXTS LOSE THE PATH, in the register both sides load.
//   5. NO APP OR PAGE CAN REDIRECT THE NODE: the write gate refuses relay-state/relays.json.
//   6. A CLAIM IS WHAT ADDS A RELAY, and ownership is not: nothing in the claim path writes an owner, and the
//      list is written by the node when a claim succeeds.
//   7. THE PEER COUNTERS COME HOME TOO (A4, folded by his "place all you can into existing items"): node
//      bookkeeping is no longer written into the Contacts app's folder.
//
// rule/11: predicates and module reads only; the one disk fixture is a temp rootDir of this suite's own.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');
const errors = require('../run/js/spiritErrors.js');
const ownerBadge = require('../run/js/ownerBadge.js');

const OWED = 'OWED by goal/G16.3: ';
const RUN = path.join(__dirname, '..', 'run');
const JS = path.join(RUN, 'js');
const APP_FILE = path.join('shell', 'natter', 'relays.json');
const STATE_FILE = path.join('relay-state', 'relays.json');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function there(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }
function rows(p) { try { return JSON.parse(read(p)); } catch (e) { return null; } }

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
    into.push({ rel: 'spirit/run/js/' + name, text: read(path.join(JS, name)) });
  });
  return into;
}

test.startTest('The relay list is the node\'s own state, not an app\'s file (goal/G16.3)');

// ── 1. THE LIST IS NODE STATE ───────────────────────────────────────────
test.subHeading('1. the node seeds and reads relay-state/relays.json, not the app\'s folder');
{
  const root = freshRoot();
  const seeded = ownerBadge.ensureRelays(root);

  if (there(path.join(root, STATE_FILE))) test.check('a fresh node seeds relay-state/relays.json');
  else test.fail(OWED + 'a fresh node wrote no relay-state/relays.json');

  if (!there(path.join(root, APP_FILE))) test.check('and writes nothing into the Natter app\'s folder');
  else test.fail(OWED + 'a fresh node still wrote ' + APP_FILE + ': the app\'s folder decides where this node talks');

  const got = rows(path.join(root, STATE_FILE));
  if (Array.isArray(got) && got.length === 1 && got[0] && got[0].url) {
    test.check('seeded with exactly one row, as he asked ("initialize with spirit.andyflinn.com only")');
  } else {
    test.fail(OWED + 'the seeded list is not one row: ' + short(got));
  }

  if (Array.isArray(seeded) && seeded.length === 1) test.check('and ensureRelays hands that row back to its caller');
  else test.fail(OWED + 'ensureRelays did not return the seeded row: ' + short(seeded));
}

// A list planted in the app's folder must not steer the node. This is the hole in its own words: an app writes
// that file today, so an app chooses the node's relays.
{
  const root = freshRoot();
  fs.writeFileSync(path.join(root, STATE_FILE), JSON.stringify([{ label: 'mine', url: 'https://127.0.0.1:1' }]));
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

  // A CONTROL: relay.search is already built and must survive the move (its source is section 3's business).
  if (claimed.indexOf('relay.search') !== -1) test.check('relay.search is still claimed, as it already was');
  else test.fail(OWED + 'relay.search went missing: the verb he approved for listing relays must survive');

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
  if (/relay-state['"\s,\/)\]]*.{0,12}relays\.json|'relay-state', 'relays\.json'/.test(hub + read(path.join(JS, 'ownerBadge.js')))) {
    test.check('the node names its own relays.json where the claim and the badge read it');
  } else {
    test.fail(OWED + 'no node file names relay-state/relays.json: nothing writes the node\'s own list');
  }
}

// ── 7. THE PEER COUNTERS COME HOME (A4, folded) ─────────────────────────
test.subHeading('7. node bookkeeping is not written into the Contacts app\'s folder');
{
  const bad = nodeFiles([]).filter(function (f) { return /shell['"\s,\/)\]]*.{0,12}contacts/.test(f.text) && /peerfile|peerStats/.test(f.text); });
  if (!bad.length) test.check('no node file keeps peer counters under the Contacts app');
  else test.fail(OWED + 'peer counters are still written under shell/contacts by: ' + bad.map(function (f) { return f.rel; }).join(', '));
}

test.reportSuccessFailureCount();
