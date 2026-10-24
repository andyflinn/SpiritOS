'use strict';

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const auth = require('./relayAuth');
// seal.js was required here for the sealed claim; the claim is peerPost's
// since goal/G22.6, and the hub seals nothing.
// invites.js STOOD HERE, required and never used — it is the relay's
// waiting room, on the relay's disc (cycle 3), and nothing on a node reads it.
const ownerBadge = require('./ownerBadge');
const contactBook = require('./contacts');
const relayKeys = require('./relayKeys');
// WHAT A SEARCH LEARNED, kept until it becomes useful. A search answer
// says where each person lives, and that was thrown away — see
// seenPeers.js. Not the contact book: a search result is not a contact,
// and the book never invents rows.
//
// ── ONE PER NODE HOME, OPENED ON FIRST USE (cycle R26) ────────────
//
// This was a module-level singleton built at require time with nothing,
// which was fine while the rows lived in RAM and impossible once they live
// on disc: a store needs a home, and this file learns one only when a
// caller hands it `rootDir`.
//
// Keyed by the resolved root rather than remembered from the first call,
// so nothing depends on which caller happened to arrive first — the same
// rule relayStore and nodeStore already follow, and the reason a suite can
// hold two homes at once without them bleeding into each other.
const shadows = new Map();
function shadow(rootDir) {
  const key = require('path').resolve(rootDir);
  if (!shadows.has(key)) {
    // THE OWNER'S CAP, read once (R31). relay-state/node.json when the
    // owner has written one, the 20 MB default when not — and never
    // written by this code, because an owner's bound is obeyed rather
    // than moved (0015).
    shadows.set(key, require('./seenPeers').createSeenPeers({
      rootDir: rootDir,
      maxBytes: require('./nodeSettings').cacheMaxBytes(rootDir),
    }));
  }
  return shadows.get(key);
}

// ── WHAT A POST'S OUTCOME SAYS ABOUT WHETHER SOMEBODY IS THERE (R30) ──
//
//   Andy: "when a request to stranger gets a reply from stranger, no
//   matter what reply stranger goes green; as soon as stranger cannot be
//   reached in a post stranger goes NOT-green." — "rule: presence is
//   always last-known."
//
// ANY REPLY IS PRESENCE, whatever it says: a refusal from the person
// still proves they were there to refuse.
//
// A FAILURE SAYS WHAT spiritErrors SAYS IT SAYS, and that is the reason
// the catalogue exists. A busy refusal is PRESENT (they are there, and
// occupied); "peer not reachable" is ABSENT (the relay speaking about its
// own member); running out of time, a partner leg failing or this node's
// own patience ending say NOTHING and write nothing (R36). A single rule
// for "failed" would have been wrong two times out of three.
//
// NOT FOR THE NODE'S OWN "not reachable right now". That fail() comes
// from this node reading its own presence picture and finding nobody —
// writing it back into the shadow would be the node repeating itself as
// though it were evidence. Only an answer that crossed the wire teaches.
function learnPresence(rootDir, toKey, answer) {
  var present;
  if (answer && answer.ok) {
    present = true;
  } else {
    var meant = require('./spiritErrors').classifyAnswer(answer);
    present = meant ? meant.presence : null;
  }
  if (present !== true && present !== false) return;
  try { shadow(rootDir).note(toKey, { present: present }); }
  catch (e) { /* a cache that will not take a row is not a reason to fail the post */ }
}
const peerFile = require('./peerFile');
const peerStats = require('./peerStats');
// What this node says about itself — the same two fields a stranger is
// answered with, so the screen that edits them and the wire that sends
// them cannot drift.
const nodeCard = require('./nodeCard');
const limits = require('./limits');
// goal/G29.6: contact.search ranks with the probability modules.
const probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
const createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
const MAX_SEARCHED_PEOPLE = 1000;
// Every label checked at one point (Andy, 2026-10-03, goal/G4.16: "all
// occurrences of label and description must validate at a central
// point"). Empty is not a label here but its absence: clearing your own
// name for somebody, or a pasted key with no label yet.
const fieldRules = require('./fieldRules');
function labelRefusal(text) {
  return fieldRules.normalize(text) ? fieldRules.problem(text) : '';
}

// ── packet.js IS BACK, AND THE DELETION IT LOOKS LIKE UNDOING STANDS ──
//
// `:862-871` below records that `decorateWithPacket` was deleted as "the
// last thing in the node that read an app envelope", under Andy's
// *"nothing in node and relay should know about apps"*, and that it was
// "the only reason hub.js required packet.js at all". That require is
// here again, so the sentence that reconciles them belongs at the line
// rather than in a commit nobody will find:
//
//   **THE NODE MAY BUILD A SYSTEM PACKET WITH THE FACTORY.**
//   **IT MAY NOT DECODE AN APP'S ENVELOPE.**
//
// What was removed was the node PARSING an arriving app payload on
// behalf of the shell — a layer above deciding what its traffic meant.
// Composing a packet addressed to NO app is the node's own business, and
// this file already did it by hand (`systemPayload`, used at the relay
// search and partner-check calls below).
//
// So this replaces a second builder with the one factory rather than
// reopening a closed question. Ruled by Andy, 2026-09-25: *"agreed. go."*
//
// The rule is assertable and wsl-claude holds it: `hub.js` may call
// `packet.encode` and never `packet.decode`.
const packet = require('./client/packet');

// isLoopbackHost, assertRelayUrl and relayRequest MOVED to
// js/relayRequest.js on 2026-09-16. They were the node's outbound socket
// living inside the node's hub, which meant a relay could not reach the
// one interface AGENT.md says everything must use without requiring the
// node's machinery — and the only ways out of that are to reach for `http`
// directly or to go without. Both are the rule being broken.
//
// Re-exported below, unchanged, so every existing caller is untouched.
const wire = require('./relayRequest');
const relayRequest = wire.relayRequest;
// THE ADDRESS CHECK IS NOT THE RELAY LIBRARY. Andy's decision (goal/G22.4):
// "The relay address check (assertRelayUrl) moves out of relayRequest.js
// into a module of its own, since it sends nothing; the relay library then
// means only traffic on the wire." The hub checks an address before it
// hands a claim or a contact to peerPost, and sends nothing itself.
const assertRelayUrl = require('./relayUrl').assertRelayUrl;

// signedClaim AND sealedClaim STOOD HERE: the claim's body, sealed to the
// cipher key this node fetched from the relay's public key route, for the
// relay's public claim route. Both routes are closed (Andy's decision, goal/G22.6),
// and the claim is a post on the relay's one door, built and sealed by
// peerPost (peerPost.claim, which keeps sealedClaim's `known` rule: a
// caller states whether the relay is already pinned or this is first
// contact; omitting it is not a default).

// ── A RELAY'S KEY, AS THE PROBE AND THE STREAMS ASK IT (goal/G22.6) ──────
//
// ownerBadge.probe and presenceNode.start ask each relay who it is with a
// function `ask(url)` answering { status, text }, where `text` is the
// relay's signed key statement. That statement is a card ask on the one
// door now, through peerPost.relayKey, so this turns the router into that
// function. A relay that does not answer rejects, which the probe reads as
// a relay that is down.
function relayKeyAsk(router) {
  return function (url) {
    if (!router || typeof router.relayKey !== 'function') {
      return Promise.reject(new Error('no router to ask the relay with'));
    }
    return router.relayKey(url).then(function (said) {
      return { status: 200, text: JSON.stringify(said) };
    });
  };
}

// signedSend STOOD HERE — the bytes handleSend put on the wire. Its one
// caller went with the door; see there.

// "Is the peer in this claim response us?" — the browser has no key of its
// own, so the node answers it here. A 409 on a name someone else holds is
// not a session; a 409 on our own key is.
function markMine(rootDir, text) {
  var id = auth.loadIdentity(rootDir);
  var parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { return text; }
  if (!parsed || typeof parsed !== 'object') return text;
  var peer = parsed.peer || parsed;
  parsed.mine = !!(peer && peer.publicKey === id.publicKey);
  return JSON.stringify(parsed);
}

// Claim, send and inbox still speak to the first listed relay: one browser,
// one session, one mailbox at a time. Minting is the call that had to stop
// doing that — see handleInvite.
function loadRelayUrl(rootDir) {
  var urls = ownerBadge.configuredUrls(rootDir);
  return urls.length ? urls[0] : null;
}


// How much disk this node is carrying on one peer's behalf.
//
// NOT "chat's log for them". Any per-peer file, whoever wrote it.
// peerFile.js is the single answer to "which file is this peer's" — its
// own header says so — and every name it makes carries the `peerfile-`
// prefix precisely so that a per-peer file is recognisable as one. So a
// walk that looks for that prefix and asks peerFile whose it is stays
// right the day Chess or a contact-card app keeps its own, and needs no
// edit here. That is also why this is not in Contacts: Contacts must not
// know where chat files things (its own comment above says the scope
// stays shut), and a number that meant "chat only" while being labelled
// Storage would be a lie the first time a second app wrote anything.
//
// Counted, never remembered. A stored counter drifts the moment a log
// rings (CHAT_LOG_CAP trims at 500), a file is deleted by hand, or an
// app is uninstalled — and it is the drift, not the count, that people
// then argue with. A size is the file's own answer and cannot disagree.
//
// One walk answers every row: buildPeople calls this once, not per peer.
// Names only — no file is opened, so nothing here can read a message.
var PEER_FILE_ROOT = 'shell';
var PEER_FILE_DEPTH = 4;

function bytesHeldByPeer(rootDir) {
  var totals = Object.create(null);

  function walk(dir, depth) {
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }
    entries.forEach(function (entry) {
      var full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth > 0) walk(full, depth - 1);
        return;
      }
      if (entry.name.slice(0, peerFile.PREFIX.length) !== peerFile.PREFIX) return;
      var key = peerFile.keyFromFileName(entry.name);
      if (!key) return;
      var size = 0;
      try { size = fs.statSync(full).size; } catch (e) { return; }
      totals[key] = (totals[key] || 0) + size;
    });
  }

  walk(path.join(rootDir, PEER_FILE_ROOT), PEER_FILE_DEPTH);
  return totals;
}

// The people list behind Relay Chat's To control (CYCLE-CONTACTS-IMPL).
//
// CONTACTS, not the roll. Everyone who ever claimed on a public
// mailbox is in `who`; that is a fact about the mailbox, not an address
// book, and a To list built from it means "everyone who exists" — which
// is how a friend picks a stranger's john. So the list is contactBook rows
// this node actually acquired: somebody wrote to it, or consumed an
// invite it minted, or a human confirmed the key out of band.
//
// A peer is a KEY. Two johns are two contacts and stay two rows; the
// caption is this node's own (myLabel where it has one) and never
// decides identity.
//
// `peers` and `relayUrl` WERE ARGUMENTS, and a roll list was walked
// here to refresh captions (contactBook.handshake) and to mark each row
// `onRelay` and `owner`. The roll went on 2026-09-18 and the only
// caller had passed [] since, so both marks were always false. Deleted
// 2026-09-19 with the rest of the roster readers — Andy: "nothing is
// allowed to return a roster." What a contact is doing now is the
// presence table's (presenceNode.js), fed by broadcasts and searches;
// who owns a relay is allow.json's, never a row's.
// ── THE BOOK'S LABEL AND ITS SEARCH, PURE (contact.search, puppets/G2) ─
//
// Module level and exported so a suite's fake node answers with exactly
// what the node would, not a copy of it.
//
// THE LABEL IS JSON (goal/G29.6, contact.search changed by Andy's grant: "the changed verb is granted."): {name, owned,
// blocked, held}. The name is the one the Contacts table always showed: the name I gave them or theirs, the key's
// ending where two read alike or there is no name. The states are fields, never words in the name (Andy: "no, just a
// star in the one column, that says it all."); owned is goal/G19.8's: a node whose signed card names this one its owner.
function contactLabel(p) {
  var name = String(p.myLabel || '').trim() || String(p.publicLabel || '').trim();
  // No key's tail is shown anywhere (Andy, 2026-10-24, goal/G40.1): a row with no name says so.
  return JSON.stringify({
    name: name || '(no name)',
    owned: p.owned === true, blocked: p.blocked === true, held: p.held === true,
    // In the book, beside the shadow's and the network's rows in the one Contacts list (goal/G30.19); their own name
    // beside mine, for a caller matching what they call themselves (the desk onboarding).
    book: true, publicLabel: String(p.publicLabel || ''),
  });
}
// RANKED WITH THE PROBABILITY MODULES (goal/G29.6; Andy: "so hub and relay will use probability search from now on."):
// every person scored by probabilityStringObjectMatch against the words, over the names I wrote and they did; no words
// (or '*') is everybody, in the book's order. owned, blocked and held are yes-filters beside q (Andy: "why would owned
// not be a binary filter, owned or not?"). The answer is a probabilityBucket, cut in bytes to one plaintext.
var CONTACT_SEARCH_ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');
function searchPeople(people, q, filters) {
  var words = String(q == null ? '' : q).trim();
  if (/^\*+$/.test(words)) words = '';
  var f = filters || {};
  var bucket = createProbabilityBucket(MAX_SEARCHED_PEOPLE);
  var seen = 0;
  var cut = false;
  for (var i = 0; i < (people || []).length; i += 1) {
    var p = people[i];
    if (f.owned === 'yes' && p.owned !== true) continue;
    if (f.blocked === 'yes' && p.blocked !== true) continue;
    if (f.held === 'yes' && p.held !== true) continue;
    if (seen >= MAX_SEARCHED_PEOPLE) { cut = true; break; }
    seen += 1;
    var score = words ? probabilityStringObjectMatch(words, { name: JSON.parse(contactLabel(p)).name, publicLabel: String(p.publicLabel || ''), myLabel: String(p.myLabel || '') }) : 0;
    if (words && !(score > 0)) continue;
    bucket.seatFor(score, { key: p.publicKey, label: contactLabel(p) });
  }
  var r = bucket.serialize(null, CONTACT_SEARCH_ROOM);
  return { items: r.items, more: r.more || cut };
}

function buildPeople(rootDir) {

  var myKey = auth.loadIdentity(rootDir).publicKey;

  // The address book, not just the people this node listens to: somebody
  // held is waiting to be accepted and somebody blocked has to stay
  // visible to be unblocked. A row you cannot see is a decision you
  // cannot reverse.
  var bytesHeld = bytesHeldByPeer(rootDir);

  var rows = contactBook.addressBook(rootDir)
    // No self row. Claiming a name is not meeting somebody, and a list
    // of people to write to that opens with yourself reads as a mistake.
    .filter(function (row) { return row.publicKey !== myKey; })
    .map(function (row) {
      var stats = peerStats.readSummary(rootDir, row.publicKey);
      return {
        publicKey: row.publicKey,
        publicLabel: row.publicLabel || '',
        caption: contactBook.labelForKey(rootDir, row.publicKey, row.publicLabel || ''),
        // The raw one, beside the resolved caption: an editor has to
        // show what is stored, not what is shown, or clearing the field
        // would look like clearing the name.
        myLabel: row.myLabel || '',
        acquiredVia: contactBook.acquiredVia(row),
        // `memberOf` and `missingSince` STOOD HERE: seats on relays this
        // node owns, and when a key was first found on no roll. Both were
        // read off rosters, which no relay may return (2026-09-19, see the
        // note where reconcileMembers stood). A row says what this node
        // knows about a person, not what a vanished list once said.
        // One question the app asks about every row: may this be written
        // to? Held and blocked both answer no, and they are drawn the
        // same way — a × and no composer — because to the person looking
        // at the list they are the same fact.
        held: !contactBook.listens(row),
        blocked: contactBook.isBlocked(row),
        // Their signed card names this node as owner (goal/G19.8, contacts.setCard through ownerBadge.ownedBy).
        owned: row.owned === true,
        // Bytes this node is carrying for them, across every app that
        // keeps a file per peer. Always a number, 0 for somebody who has
        // cost nothing yet — an absent field would make the app decide
        // between "none" and "not asked", which are not the same answer.
        bytesHeld: bytesHeld[row.publicKey] || 0,
        // What they cost in attention. Computed from the sidecar
        // (peerStats), never from a field on the row: a contactBook row is
        // what a human decided, and a packet counter is not a decision.
        //
        // A missing sidecar summarises as zeros, and zeros are the true
        // answer — the counters start when counting starts. NOT
        // backfilled from chat's log: that ring caps at 500, so a total
        // taken from it stops rising exactly when somebody becomes worth
        // looking at, and it would speak for the node while measuring one
        // app (packet 7).
        unansweredInbound: stats.unansweredInbound,
        inboundPerDay: stats.inboundPerDay,
        outboundPerDay: stats.outboundPerDay,
      };
    });

  // When two rows would read the same — two johns, neither renamed yet —
  // they are marked ambiguous. The caption carries no piece of the key:
  // no key's tail is shown anywhere (Andy, 2026-10-24, goal/G40.1).
  var seenCaption = Object.create(null);
  rows.forEach(function (r) { seenCaption[r.caption] = (seenCaption[r.caption] || 0) + 1; });
  rows.forEach(function (r) {
    if (seenCaption[r.caption] > 1) {
      r.ambiguous = true;
    }
  });

  rows.sort(function (a, b) { return String(a.caption).localeCompare(String(b.caption)); });
  return rows;
}

// The peer search's one ranker, on the probability modules, shared with every relay (goal/G29.17).
var peerRank = require('./peerRank');

// handleMatches STOOD HERE: every roll row whose public label was a handle
// somebody heard, exactly. Its one caller, peer.find, went on 2026-09-17,
// and the suite that still asserted it went too, so it was deleted under
// goal/G19.11. Ranked search (peer.search) answers the same question: an
// exact label scores 1.0 and comes first, and two johns stay two results.

// acquireFromInbox STOOD HERE — somebody wrote to this node, the relay's
// copy of the line carried their key, and that is how a stranger became
// someone you could answer. Deleted with the ring (R8, 2026-09-15).
//
// `remember()` below is the same act on the router's path, and it was
// already there: peerPost calls it with the verdict frontDoor gave, so a
// stranger who writes is still acquired under `acquire` and still held
// under `hold`. The rule was always deliberately weak — anyone who can
// write proves a key exists and is reachable, not that it belongs to the
// person you think — and that has not changed.
//
// ONE DIFFERENCE, NAMED RATHER THAN QUIETLY DROPPED: this captured the
// sender's `publicLabel` off `m.from`, because the relay stored a line
// with a label on it. Nothing stores a line any more, so `remember`
// acquires with an empty label, and the caption comes from what this node
// learns of that key later: peer.acquire, a search result, or the name a
// person types (the roll that once filled it in is gone). A contact
// acquired by being written to is unlabelled until then, where it used to
// be named on arrival.

// What this node does with mail from somebody it has not added.
//
//   silent  — it never happened. Not acquired, and not passed on either,
//             so the app writes no peerfile-*, marks no row and counts
//             nothing. The factory setting.
//   hold    — the same, except the count comes back, so the app can say
//             "N from people you have not added" without saying who.
//   acquire — the old behaviour: writing to this node makes you someone
//             it can answer (contactBook 'message').
//
// This node's policy about its own book, so the hub reads it here rather
// than taking it from whoever asked (packet 5).
//
// It used to arrive as a ?unknown= query parameter, on the argument that
// there should be one copy of the setting owned by the app that draws
// the control. That held while one app both drew it and polled. It does
// not now: Contacts draws the radios and Relay Chat polls the inbox, so
// the policy was travelling through an app that has no say in it, and a
// second poller — or a stale tab — would have been a second answer.
//
// ONE FILE, AND IT IS THE NODE'S. It was app/contacts/prefs.json, which
// was wrong twice over (Andy, of that file: "... is the wrong place for
// that file, it's a node-global").
//
// Wrong as a LOCATION: who this node will hear from is a fact about its
// front door, not about one app. Contacts draws the radios; it does not
// own the door, any more than Relay Chat owns it by polling.
//
// Wrong as a LAYER: api.fs is scoped to app/<name>/, so Contacts can
// write its own prefs — right for a preference and exactly why nothing
// load-bearing may live there. preferences.json is node-global and sits
// in kernel.js's WRITABLE_ROOT_FILES, so a write to it passes the kernel.
//
// The SAFETY FLOOR is not here at all and must not be: it is not a
// setting, so it has no file. See peerPost, where an unknown sender is
// bounded whatever this answers.
//
// Read per request rather than cached: it is one small file, an inbox
// poll is already a network round trip, and a cache would mean a change
// not taking effect until something invalidated it.
var UNKNOWN_POLICIES = ['silent', 'hold', 'acquire'];
var UNKNOWN_PREFS_FILE = ['preferences.json'];
// Where it used to live. Read when the new home says nothing, so a node
// that had chosen `acquire` does not silently fall back to `silent` on
// the day this moved — the same courtesy routingTable.json paid
// mailbox.json. Nothing writes this name again.
// DEPRECATED(D3, expires: alpha) — the policy's old home,
// app/contacts/prefs.json field `unknown`. See design/DEPRECATIONS.md (decision 0014).
var LEGACY_UNKNOWN_PREFS_FILE = ['app', 'contacts', 'prefs.json'];

// SETTING IT IS THE NODE'S JOB, not an app's. Contacts draws the radios
// and posts here; it cannot write the file itself, and that is the point
// — api.fs is scoped to app/<name>/, so a node-global setting written by
// an app would be a setting living inside one of its readers.
//
// The write PRESERVES everything else in the file. preferences.json is
// shared with the shell (defaultHandlers, appOverrides, groups), which
// parses it whole and writes it back whole; a setter that rebuilt the
// object would take the operator's groups with it.
//
// Temp-file and rename, so a crash leaves the old file or the new one and
// never half of either — the same discipline routingTable.json and
// traffic.json use.
function writeUnknownPolicy(rootDir, wanted) {
  if (UNKNOWN_POLICIES.indexOf(wanted) === -1) return false;
  var file = path.join(rootDir, 'preferences.json');
  var doc = {};
  try {
    var parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed;
  } catch (e) {
    // A missing or broken preferences.json is not a reason to refuse a
    // security setting. Starting from {} loses the shell's own keys,
    // which is bad — but it is what the shell itself does with a file it
    // cannot parse, and refusing here would leave the node stuck on
    // `silent` with no way out.
    doc = {};
  }
  doc.unknownSenders = wanted;
  var tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
  fs.renameSync(tmp, file);
  return true;
}

function readUnknown(rootDir, where, field) {
  var raw = null;
  try { raw = fs.readFileSync(path.join.apply(path, [rootDir].concat(where)), 'utf8'); }
  catch (e) { return null; }
  var parsed = null;
  try { parsed = JSON.parse(raw); }
  catch (e) { return null; }
  var wanted = parsed && parsed[field];
  return UNKNOWN_POLICIES.indexOf(wanted) === -1 ? null : wanted;
}

// Missing, empty, unreadable, not JSON, or not one of the three all read
// as `silent` — the tightest setting that still lets two people who
// added each other talk. The safe answer is also the default, so a
// broken file cannot quietly open a node up.
//
// `unknownSenders` rather than `unknown`: at node-global scope a key
// called `unknown` says nothing about what is unknown.
function unknownPolicy(rootDir) {
  var here = readUnknown(rootDir, UNKNOWN_PREFS_FILE, 'unknownSenders');
  if (here) return here;
  var legacy = readUnknown(rootDir, LEGACY_UNKNOWN_PREFS_FILE, 'unknown');
  return legacy || 'silent';
}

// Who this node will listen to: everyone it has actually acquired, plus
// itself — a note to yourself is sent and received, and both halves
// happened.
//
// The mailbox needs no exception here. A relay console answer rides back
// on the send response (relay.js, consoleReply) and is never stored in
// the ring, so it does not arrive through an inbox read and cannot be
// dropped by one.
function listenSet(rootDir) {
  var allowed = Object.create(null);
  contactBook.contacts(rootDir).forEach(function (row) { allowed[row.publicKey] = true; });
  allowed[auth.loadIdentity(rootDir).publicKey] = true;
  return allowed;
}

// ── THE FRONT DOOR, FOR THE ROUTER PATH ──────────────────────────────
//
// listenSet above is the same question, and for a long time it was asked
// on one transport only: hub.js:389, the `inbox` read. peerPost.onRequest
// — where packets actually arrive now — checked that a signature matched
// the sender it claimed and that the packet was addressed here, and
// nothing else. A signature proves possession of a key; it proves nothing
// about whether this node has ever heard of the holder.
//
// Andy: "no node, by protocol, should accept requests from unknown."
//
// THE EXCEPTION THE INBOX DID NOT NEED. listenSet's own comment says "the
// mailbox needs no exception here", which was true of a path relay
// traffic never travelled. This is not that path: a relay may post here
// in its own name, and a relay is not a contact — its key is in no
// contactBook. (The device enrolment it once carried was removed by
// goal/G16.2.) relayKeys.js is what makes that answerable
// without trusting whatever claims to be a relay, because it holds the
// keys this node has actually accepted.
//
// Answers one of four, and the split between the first and the rest is
// what makes the floor work:
//
//   'known'  already in the book — not a stranger, not rationed
//   'admit'  a stranger this node's policy welcomes
//   'hold'   a stranger to file for a human to decide about
//   'drop'   a stranger to ignore
//
// PURE. It writes nothing, and that is a correction of the first version
// of this function, which acquired the row here and returned 'known'. The
// effect was that under `acquire` a stranger became known in the same
// breath — so the floor, which only binds a non-'known' verdict, never
// bound at all. "acquire still acquires, but the cost is bounded" was not
// what the code did. The test found it.
//
// So the book write moved behind the floor (peerPost calls `remember`
// once a stranger is within budget), and an over-budget stranger now gets
// no row either — which is right: a row is a record of somebody worth
// knowing about, and a flood is not.
//
// The FLOOR itself is not here and must not be: how much an unknown
// sender may spend is an invariant in peerPost, with no file and no
// setting behind it.
function frontDoor(rootDir, from) {
  var key = String(from == null ? '' : from).trim();
  if (!key) return 'drop';

  // ── BLOCKED IS TURNED AWAY FIRST, WHATEVER THE POLICY (S12) ─────────
  //
  // This door never asked. Under `acquire` a blocked key therefore fell
  // through to `admit` and its words reached apps and open pages — the one
  // verdict the owner had explicitly refused. Blocking already outranks every
  // way of arriving in the book (contacts.js: "it must outrank every way of
  // arriving, including a key confirmed by phone"); it has to outrank the
  // policy too, or the flag means nothing on the transport that matters.
  // Answered `drop`, which is this door's word for "hear nothing from them".
  try {
    var blockedRow = contactBook.byPublicKey(rootDir, key);
    if (blockedRow && blockedRow.blocked === true) return 'drop';
  } catch (e) { /* a book that cannot be read decides nothing here */ }

  // Itself and everyone it has acquired — the same set the inbox uses,
  // asked here for the first time.
  //
  // "Acquired" is narrower than "on record", deliberately: contactBook's
  // ACQUIRED_LISTENING is ['message', 'invite', 'handle'], so somebody
  // merely SEEN in a relay's roll is not somebody this node agreed to
  // hear. Having noticed a stranger exists is not an introduction.
  if (listenSet(rootDir)[key]) return 'known';

  // A RELAY THIS NODE ACCEPTED is known, and only one it accepted. The
  // pin is what makes this safe: without relayKeys, "is this a relay?"
  // could only be answered by asking the thing that wants in.
  if (relayKeys.acceptedKeys(rootDir)[key]) return 'known';

  var policy = unknownPolicy(rootDir);
  if (policy === 'acquire') return 'admit';
  if (policy === 'hold') return 'hold';
  return 'drop';
}

// WHAT TO WRITE DOWN ABOUT A STRANGER WHO GOT THROUGH THE FLOOR. Called
// by peerPost after the budget allowed it, never before — so a flood
// leaves no rows behind.
//
// `'message'` is the acquisition route, the same one acquireFromInbox
// used for the same event on the old transport: this person wrote. It
// matters because ACQUIRED_LISTENING contains 'message' and not 'roll',
// so writing is what makes somebody heard next time.
//
// `relayUrl` IS WHICH ROAD THEY CAME DOWN, and it is here because R8
// would otherwise have quietly taken it. contactBook's `relays` means
// "mailboxes where you have seen this key" — a fact this node holds
// about how to reach somebody, and the only one it has. acquireFromInbox
// passed it; peerPost has had it all along (it is already on every
// traffic-log row) and simply was not handing it over, which nothing
// noticed while the ring was still acquiring in parallel.
//
// Optional, so a caller with no road to name still writes the row rather
// than refusing to.
//
// NOT THE LABEL, and that one really is gone. acquireFromInbox read
// `publicLabel` off the relay's stored copy of the line; nothing stores a
// line now, and a post carries keys and no captions. The caption comes
// later, from peer.acquire, a search result or the name a person types, so
// a contact acquired by being written to is unlabelled until then, where
// it used to be named on arrival. That is the cost of the relay not reading the payload, which
// is the point rather than a regression.
function remember(rootDir, from, verdict, relayUrl) {
  var key = String(from == null ? '' : from).trim();
  if (!key) return false;
  var road = String(relayUrl == null ? '' : relayUrl).trim();
  var row = { publicKey: key, publicLabel: '', relays: [] };
  if (road) row.relay = road;

  // ── THE ROAD THEY CAME IN ON IS A ROUTE ──────────────────────────────
  //
  //   Andy: "the node must implicitly learn routes at EVERY opportunity."
  //
  // This had the road all along and kept only the URL: `row.relay` lands
  // in `relays`, which holds addresses, while `routes` — which holds
  // relay KEYS and is what a post sends as hints — got nothing. Somebody
  // who wrote to you was auto-added with an address and no route.
  //
  // The key is one lookup away: this node pinned it when it accepted that
  // relay. And if a search already said where they live, that answer is
  // better than the road, because it is about the PERSON rather than
  // about the packet — so the cache is asked first.
  var seen = shadow(rootDir).get(key);
  var at = (seen && seen.at) || (road ? relayKeys.pinned(rootDir, road) : '') || '';

  try {
    // THE ROUTE GOES TO THE SHADOW, NOT THE BOOK (0018, cycle R1). It
    // used to be written to both; the book's copy was the one that went
    // stale, and it was machine data in the one file that is meant to be
    // readable. RANK ARRIVED: a packet demonstrably came from there.
    if (at) {
      try {
        shadow(rootDir).note(key, {
          at: at, url: road || '',
          via: road ? (relayKeys.pinned(rootDir, road) || '') : '',
          rank: require('./seenPeers').ARRIVED,
        });
      } catch (e) { /* a cache that will not take a row is not a reason to refuse somebody */ }
    }
    if (verdict === 'admit') {
      // A FULL MEMORY ADDS NOBODY, and a stranger least of all (0021):
      // "once the memory is full with 'added' statuses no more can be
      // chosen/added". The packet is still heard — the verdict stands —
      // they simply are not added; the owner makes room, or does not.
      if (!shadow(rootDir).roomToAdd(key)) return false;
      contactBook.acquire(rootDir, row, 'message');
      return true;
    }
    if (verdict === 'hold') {
      contactBook.hold(rootDir, row);
      return true;
    }
    // ── IGNORED IS A MARK, NOT A FORGETTING (0021) ────────────────────
    //
    //   Andy: "ignoring means only: mark this row as "ignored"."
    //
    // The row was already remembered (noteSeen, before the floor); this
    // only says what the door did with it. Never over somebody the book
    // has marked: a held or blocked person also gets 'drop' from the
    // door, and what the owner decided outranks what the door did.
    if (verdict === 'drop') {
      var was = shadow(rootDir).get(key);
      if (!was || (!was.choice && !was.blocked)) shadow(rootDir).mark(key, 'ignored', false);
      return true;
    }
  } catch (e) {
    // A book that cannot be written is not a reason to change what
    // happens to the packet. The verdict already stands.
    return false;
  }
  return false;
}

// partitionInbox AND holdFromInbox STOOD HERE — the split between what
// this node asked to hear and what it did not, and the row a waiting
// stranger got under `hold`. Deleted with the ring (R8, 2026-09-15).
//
// Both are answered per packet now, before anything is filed, which is
// the better place for them: frontDoor() above returns known / admit /
// hold / drop from the sender's KEY, and peerPost acts on that verdict
// at the moment of arrival rather than sorting a batch afterwards. A
// held sender still gets a row and nothing else — see `remember`.
//
// One rule of partitionInbox's is worth not losing to the deletion:
// A MESSAGE WITH NO KEY CANNOT BE MATCHED AGAINST AN ADDRESS BOOK. The
// ring let such lines through, because an open or names relay might
// carry no key and a lab node that showed nothing would look broken.
// The router cannot produce one — every post is signed by a key and
// `from` IS that key — so the case is gone rather than handled.

// decorateWithPacket STOOD HERE, and it was the last thing in the node
// that read an app envelope.
//
//   Andy: "nothing in node and relay should know about apps."
//
// It parsed an arriving payload and hung `message.packet` on the row so
// a reader could tell its own traffic from another app’s. That reader
// is the shell, which loads packet.js itself — so this was the node
// decoding on behalf of a layer above it, and the only reason hub.js
// required packet.js at all.
//
// The payload travels as signed and is read where it is understood.
// countInbound AND applyInboxBatch STOOD HERE — the per-peer counter for
// a fetched batch, and the one function both the browser's poll and the
// node's 60-second sweep ran so the two could not drift. Deleted with the
// ring (R8, 2026-09-15).
//
// R11 is why this is safe to delete rather than move: peerPost already
// calls peerStats.noteIn on the arrival path, keyed by the REQUEST HASH
// rather than by a relay's message id. The id existed only because a
// non-destructive poll could hand the same line twice; the hash is over
// the exact bytes rather than a number somebody else assigned. Counting
// was the one thing the ring's read half did that the router did not, and
// it was fixed before this deletion, not with it.
//
// Grok's three skips survive in peerPost and contactBook, unchanged: our own
// traffic is not somebody else's, a silent stranger gets no row and so no
// count, and a blocked row's numbers freeze where they are.
//
// WHAT WAS LOST ON PURPOSE: the `hold` count. applyInboxBatch answered
// `{ unknown: N }` so an app could say "N from people you have not added"
// without saying who. Nothing asks that question of the router yet. It is
// not gone from the node — trafficLog keeps held rows, admitted:false —
// only unexposed, and re-exposing it is a read surface to design rather
// than a line to restore.

function createHub(rootDir) {
  // A kept rename of a contact, on its way to every open page (server.js
  // writes it on /api/events as contact.rename). The same seam shape as
  // arrivals: the hub notes, the stream fans out, neither knows the other.
  var contactRenames = require('./arrivals').createFanOut();
  function fail(res, status, msg) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: msg }));
  }

  // A THROW IN HERE IS AN ANSWER, NEVER A DEAD NODE.
  //
  // Found by serverSurface.js's hub sweep on 2026-09-13, which is the
  // first thing that ever called these routes against a booted process:
  // `GET /api/hub/inbox` took the whole node down. The identity on that
  // fixture has a malformed private key, so signing the inbox request
  // threw ERR_OSSL_ASN1_NOT_ENOUGH_DATA out of a synchronous handler,
  // where nothing was waiting to catch it.
  //
  // A real node writes its own identity.json, so a malformed one means a
  // torn write rather than an attack — but the difference between a node
  // that says "I cannot sign" and a node that vanishes is the whole
  // difference between a person seeing the problem and a person seeing
  // the shell stop responding.
  //
  // 500, not 503: 503 here means "no relay configured", which is a thing
  // a person can fix in Natter. This is not that, and must not read as it.
  function guarded(res, url, fn) {
    try { return fn(url); }
    catch (e) {
      fail(res, 500, 'this node could not make the request: ' + String(e.message || e));
      return undefined;
    }
  }

  // withRelay STOOD HERE: the first row of the relay list, whatever the
  // caller meant. handleWho was its last caller; both went under
  // goal/G19.11.

  // The mailbox a mint is aimed at. The scheme is checked (assertRelayUrl),
  // so a plain-http row in Natter is refused here rather than at the socket.
  function withChosenRelay(res, wanted, fn) {
    var chosen = ownerBadge.chooseUrl(ownerBadge.configuredUrls(rootDir), wanted);
    if (!chosen.ok) {
      fail(res, chosen.status, chosen.error);
      return;
    }
    try { assertRelayUrl(chosen.url); }
    catch (e) {
      fail(res, 503, String(e.message || e));
      return;
    }
    // RETURNED, so a caller can await the whole of it — every other
    // caller ignores the value, as they did when there was none. And
    // guarded: see `guarded` above.
    return guarded(res, chosen.url, fn);
  }

  // ── A CLAIM IS HOW A RELAY GETS ONTO THE LIST (goal/G16.3) ──────────
  //
  //   Andy, 2026-10-10: "Q4: Do you approve two new commands on the node,
  //   list relays and remove relay, with a successful claim adding its
  //   relay? yes."
  //
  // So a NAMED url is aimed at even when this node does not list it yet —
  // the claim is what lists it. Refusing an unlisted url here, as the mint
  // doors still do through chooseUrl, would leave no way onto the list at
  // all, because there is no verb that adds one. The url still has to pass
  // assertRelayUrl, and relay.claim is a loopback verb, so the only caller
  // that can aim it is this node's own browser. With no url named, the old
  // fallback stands: the only listed relay, or a refusal.
  function withClaimRelay(res, wanted, fn) {
    var named = ownerBadge.normalizeUrl(wanted);
    if (!named) return withChosenRelay(res, '', fn);
    try { assertRelayUrl(named); }
    catch (e) {
      fail(res, 503, String(e.message || e));
      return;
    }
    return guarded(res, named, fn);
  }

  // CLAIMING HAPPENS ON ONE RELAY, AND NOW IT SAYS WHICH.
  //
  // This used `withRelay` — relays.json[0], whatever the caller meant —
  // while invite, rename and remove-peer had all moved to
  // `withChosenRelay`. Claim was the last route that could not be aimed,
  // and Natter's claim form carried a comment admitting it: the heading
  // named relays[0] because "a URL box would be a control whose every
  // other value is silently ignored."
  //
  // That is why the claim form could not live on a relay's own screen. A
  // Claim button on spirit-3's panel that quietly claimed on the lab row
  // is worse than no button. With the form moving to natterDetails
  // (2026-09-15) the aim has to be real.
  //
  // Not a new switch — the switch is `ownerBadge.chooseUrl`, which has
  // decided this for three other doors since invites landed. Since
  // goal/G16.3 a NAMED url is the one exception (withClaimRelay above):
  // the claim is what lists a relay, so it cannot require one. With nothing wanted
  // it still falls back to the only row when there is only one, which is
  // exactly what every existing caller relied on.
  // ── AND A NODE THAT JUST CLAIMED MUST CONNECT ────────────────────────
  //
  //   Andy: "now i have a new 'Jazzy Alexandra' and she's bound to
  //   spirit-3 but she cannot find anybody in contacts" — "her relay
  //   shows green."
  //
  // She had no `relay-presence` job at all: nothing started one for the
  // seat this function had just taken, so the node sat there enrolled and
  // unconnected until somebody restarted it. (Since goal/G22.5 a node's
  // identity exists from its first boot, before it listens; what a claim
  // adds is the seat, and the seat needs its stream.)
  //
  // EVERY NEW SEAT GOES THROUGH EXACTLY THAT SEQUENCE. Boot, claim,
  // nothing. It could not search, could not be posted to, and could not
  // receive — while looking bound, because the badge is read off the
  // public roll and `claimed` means "you have a row here", not "you are
  // connected". Green was telling the truth about a different question.
  //
  // `router.startStreams` is safe to call again: presence creates its job
  // only if it has none and openTo returns early for a url it already
  // holds. So this is "make sure", not "restart". The streams are the
  // router's since goal/G19.14; this file never holds them.
  function handleClaim(req, res, readJsonBody, deps) {
    var router = deps && deps.router;
    var probe = deps && deps.probe;
    readJsonBody(req).then(function (body) {
      withClaimRelay(res, body && body.url, function (url) {
        var learnedKey = '';
        if (!router || typeof router.claim !== 'function') {
          fail(res, 503, 'this node has no router to claim with');
          return;
        }
        // FIRST CONTACT, STATED. This is the node's own claim: it has no
        // pin for this relay — the claim is how it gets one — so the
        // ask-and-trust path is correct here and says so rather than
        // arriving by omission. Through peerPost, on the relay's one door
        // (goal/G22.6: "the hub asks peerPost for a relay's key and for a
        // claim").
        router.claim(url, body && body.name, body && body.invite, body && body.inviteLabel,
          'first-contact')
          .then(function (said) {
            learnedKey = (said && said.relayPublicKey) || '';
            // The relay's answer, in the shape the closed route gave the
            // browser: the peer on success, { error, peer? } otherwise,
            // under the claim's own status.
            var payload = said.ok ? (said.peer || {})
              : (said.peer ? { error: said.error, peer: said.peer } : { error: said.error });
            return { status: said.status, text: JSON.stringify(payload) };
          })
          .then(function (r) {
            // AFTER THE ANSWER IS WRITTEN, never before: a claim that
            // worked must be reported even if opening a stream does not,
            // and connecting is not what the caller asked about.
            var marked = markMine(rootDir, r.text);
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(marked);

            // A SEAT HELD IS A RELAY USED (goal/G16.3): a new seat, or a 409
            // that is this node's own key already sitting there, which is
            // the answer Natter also reads as success. Either way the relay
            // goes on the node's own list, which the next relay.search reads.
            var mineAlready = false;
            try { mineAlready = r.status === 409 && !!JSON.parse(marked).mine; }
            catch (e) { mineAlready = false; }
            if ((r.status >= 200 && r.status < 300) || mineAlready) {
              try { ownerBadge.addRelay(rootDir, url, '', learnedKey); }
              catch (e) { /* the claim stands; the list is written on the next claim */ }
              // The seat is held again, so a refusal recorded on this relay's
              // row no longer stands: the new invite brought it back (goal/G19.1).
              try { relayKeys.clearRefusal(rootDir, learnedKey || url); }
              catch (e) { /* the claim stands; the row is read again on the next probe */ }

              // A 409 FOR THIS NODE'S OWN KEY IS A SEAT HELD, and is written
              // down exactly as a 2xx is (goal/G19.1), under the label the
              // relay says this key already wears there.
              var seatLabel = (body && body.name) || '';
              if (mineAlready) {
                try {
                  var held = JSON.parse(marked);
                  seatLabel = String((held.peer && held.peer.publicLabel) || '') || seatLabel;
                } catch (e) { /* the asked-for label stands */ }
              }

              // ── WRITE THE SEAT DOWN, HERE, WHERE IT IS KNOWN ────────
              //
              // Everything needed is in hand at this instant: the url, the
              // label asked for, and a 2xx saying it was granted. Until
              // 2026-09-18 none of it was recorded, so every subsequent
              // boot re-derived it by fetching the relay's ENTIRE
              // membership and looking for itself (ownerBadge.probe) — the
              // last roll read in the tree, and the only one that was
              // not a question about other people.
              //
              //   Andy: "persist necessary information at claim time,
              //   re-use that information on boot."
              //
              // Before the stream, not after: a claim that worked is a
              // seat held whether or not connecting succeeds, and the next
              // boot must know that without asking.
              try { relayKeys.seat(rootDir, url, seatLabel); }
              catch (e) { /* the claim stands; a boot can still backfill */ }

              if (router && probe) {
                try { router.startStreams(probe); }
                catch (e) { /* the claim stands; the next boot connects */ }
              }
            }
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // What the app hands in, and what the mailbox gets.
  //
  // An app says { app, body }; a caller that has not moved yet says
  // { text } and is sent exactly as before. The envelope is built here
  // rather than in the browser so that one place decides what a packet
  // looks like, and so the size limit is enforced before anything leaves
  // the machine.
  // ── THE NODE CARRIES A PAYLOAD, IT DOES NOT COMPOSE ONE ──────────────
  //
  //   Andy: "that's the shell's point of view, and it has to hand an
  //   app-containing package to the node as one single payload."
  //
  // This had two branches: one that called `packet.encode(body.app, …)`
  // and one described as the "legacy caller: a bare string". They were
  // the wrong way round. The bare string is the CORRECT layering — the
  // shell composes the envelope, because the shell is what routes an
  // arriving packet by `app` and what knows which app is speaking — and
  // the branch calling packet.encode was the node reaching a layer up.
  //
  // What it cost, beyond tidiness: `hub.js` needed `packet.js`, so a
  // module about apps sat in the node's dependency set and, through
  // server.js, on a relay.
  //
  // One branch now. `text` arrives whole and leaves whole, and the only
  // thing the node asks of it is how long it is.
  function outgoingPayload(body) {
    return { ok: true, text: String((body && body.text) || '') };
  }

  // ── AND WHAT THE NODE SENDS ON ITS OWN BEHALF ───────────────────────
  //
  // A system call to a relay — `search`, `partners` — originates HERE,
  // so there is no shell above it to compose anything. It is not an app
  // packet and must not look like one: no `app`, and no `id`, because a
  // reply is matched by hash and an id would be a field nobody reads.
  //
  // Built directly rather than through packet.js, which is the point: the
  // node does not use an app-envelope builder for something that is not
  // an app packet.
  function systemPayload(body) {
    return JSON.stringify({ v: 1, body: body });
  }

  // POST TO A PEER, AND WAIT FOR THE ANSWER. The router's half of the
  // boundary, and the one verb an app should ever need.
  //
  // ── WHY IT MOVED HERE ──────────────────────────────────────────────
  //
  // Until 2026-09-13 this was the only /api/hub/* route written out
  // INSIDE server.js's route table — every other one named a handler in
  // this file. That was backwards twice over: the compliant path was the
  // one without a home, and the lines in the switchboard were not
  // plumbing. They decide whether this node is attached to a relay at
  // all, WHICH RELAY to send through, and what "unreachable" means to a
  // caller. A routing rule living in the web server could only ever be
  // exercised by making an HTTP request, which is why its behaviour was
  // only ever seen live.
  //
  // `deps` rather than a closure: peerRouter and presence are built at
  // the foot of server.js, long after createHub runs, and a setter would
  // make this file hold state it has no business holding. Handed in at
  // call time, they are also what lets a suite drive this as a function.
  // ── WHERE A POST GOES, DECIDED ONCE (puppets/G4) ─────────────────────
  //
  //   Andy, 2026-09-26, approving the extraction: "yes, we want that ortho-
  //   thinggie."
  //
  // THIS WAS INSIDE handlePost AND THE CHOICE WAS INTERLEAVED WITH THE SEND,
  // so a second caller could not reach it without re-deciding. And a second
  // opinion about reachability is exactly what serverSurface.js:848 refuses:
  // "peer.post is the only way onto the wire. A second caller is a second
  // door." An owner command needs a relay for the same reasons a post does —
  // the same presence, the same `via` rule, the same hints — so it must ask
  // this rather than guess.
  //
  // PURE, AND THAT IS THE WHOLE OF THE CHANGE. It decides and returns; it does
  // not send, does not touch the response and does not log. Everything it
  // knows it knew before, in the same order, with the same fallbacks.
  //
  // THE ORDER IS LOAD-BEARING and is preserved exactly:
  //   1. a relay that NAMES the recipient, narrowed by `via` if one was asked
  //      for. Present means reachable, and presence is what makes this
  //      answerable rather than a guess.
  //   2. otherwise, and ONLY when no `via` was named: the first connected
  //      relay, carrying route hints off the shadow roll. A named `via` that
  //      does not name the peer is a refusal rather than a fallback, because
  //      the caller asked to measure one path.
  //   3. otherwise unreachable, which the caller reports.
  //
  // ASKED OF THE ROUTER, which holds the streams (goal/G19.14): nobody but
  // peerPost has a path to presenceNode.
  function chooseRoute(router, to, via) {
    var wanted = String(via || '').trim();
    var where = router.relaysNaming(to).filter(function (url) {
      return !wanted || url === wanted;
    });
    // Posting to a relay itself needs nothing special here. Its own key is in
    // the OWNER's roster and in no peer's (relay.streamRoster), so presence
    // answers for it exactly as for any peer.
    if (where.length) return { relayUrl: where[0], hints: undefined };
    if (wanted) return { unreachable: true };

    // ── THE HINTS COME FROM THE SHADOW (0018, cycle R1) ─────────────
    //
    //   Andy: "the hints are removed from the users contacts. (let's admit
    //   it: they [are] not human-readable, in reality)"
    //
    // Best-ranked first, which the book could not do: its list was
    // newest-first and had no idea who had said what.
    var hints = shadow(rootDir).routes(to)
      .map(function (r) { return r.at; })
      .filter(function (at, i, all) { return at && all.indexOf(at) === i; });
    var connected = router.relaysHeld();
    if (!connected.length) return { unreachable: true };
    // The partner-availability reorder (R42) STOOD HERE; partnering is gone
    // (goal/G22.6), and a relay no longer reads route hints at all.
    return { relayUrl: connected[0], hints: hints.length ? hints : undefined };
  }

  function handlePost(req, res, readJsonBody, deps) {
    var router = deps && deps.router;

    // RETURNED, unlike the older handlers beside it, which fire and
    // forget. server.js ignores it; a suite awaits it. A handler whose
    // completion cannot be observed can only be tested by sleeping, and
    // a test that sleeps is a test that will one day be flaky on a
    // slower machine.
    return readJsonBody(req).then(function (body) {
      if (!router) {
        fail(res, 503, 'this node is not connected to a relay');
        return;
      }
      var to = String((body && body.to) || '').trim();

      // ── OPAQUE, AND THAT INCLUDES ITS SHAPE ──────────────────────────
      //
      //   Andy: "it might be a hex encoded favicon.ico"
      //
      // This said wrapping a body into `{app, v, body}` was "the node's
      // job". It never was — the shell composes the envelope and hands
      // this one string (see outgoingPayload). And the payload is not
      // text in any sense the node may rely on: it is whatever the sender
      // put there, which may be an envelope, a chat line, or a picture in
      // hex. The wire field is called `text` for historical reasons and
      // the name promises nothing.
      //
      // The only question asked of it below is how long it is.
      var wrapped = outgoingPayload(body);
      if (!wrapped.ok) {
        // Refused here rather than at the relay: an oversize packet is
        // the app's mistake, and spending a post to be told so would be
        // this node's. The same call handleSend makes, for the same
        // reason.
        fail(res, 400, wrapped.error);
        return;
      }
      var text = wrapped.text;
      // Which relay to go through. Normally none of an app's business —
      // a peer reachable two ways is reachable — but a caller may name
      // one, which is how the cost of each path gets measured rather
      // than assumed. An unreachable choice is refused like any other.
      // WHERE IT GOES IS chooseRoute's, NOT THIS FUNCTION'S ANY MORE. The
      // choice used to be interleaved with the send here, so an owner command
      // could not reach it without re-deciding — and a second opinion about
      // reachability is what serverSurface.js:848 refuses. Same presence, same
      // `via` rule, same hints, decided in one place.
      var route = chooseRoute(router, to, (body && body.via));
      if (route.unreachable) {
        // Truthfully, and at once. Presence is what makes this answerable
        // rather than a guess — and it is why that arc had to come first.
        fail(res, 503, 'that peer is not reachable right now');
        return;
      }
      // ── PATIENCE, ASKED FOR BY THE PAGE (puppets/G2) ──────────────
      //
      //   Andy, 2026-09-27, "go." on: "peer.post takes an optional
      //   patienceMs (capped at 10 minutes, memory only), so a busy agent
      //   gets retried instead of your line coming back undelivered."
      //
      // Absent, a post gets one attempt, exactly as before. Given, the
      // scheduler retries a BUSY target with backoff until it is delivered
      // or the patience is spent; an unreachable one still fails at once
      // (peerPost's own rule). Capped here, because the queue is in memory
      // and a page must not park a post for days.
      var patience = Number(body && body.patienceMs);
      var how = patience > 0 ? { patienceMs: Math.min(Math.floor(patience), PATIENCE_MAX_MS) } : undefined;
      // ── THE NO-RUSH WORD (fileTransfer goal/G1.3) ─────────────────
      //
      //   Andy, on the scheme in G1.2: "agreed. scheme approved." and
      //   "same for responses."
      //
      // 'background' is the only value and it only demotes: without it a
      // post stays deliberate, exactly as before, and any other word is
      // refused here, before anything is posted. The queue already ranks
      // the two classes (postQueue.js); this is the word reaching it.
      var kind = body && body.kind;
      if (kind !== undefined) {
        if (kind !== 'background') {
          fail(res, 400, "kind takes 'background' or nothing");
          return;
        }
        how = Object.assign({ kind: 'background' }, how);
      }
      return sendPacket(router, route.relayUrl, to, text, route.hints, how).then(function (answer) {
        learnPresence(rootDir, to, answer);
        // DELIVERED MEANS THERE (goal/G2.9): an answer that crossed the wire is the relay carrying that peer now,
        // so the live table hears it at the relay the post went through. A refusal teaches the shadow (above) and
        // the live table nothing here: its red comes from the relay's own broadcast.
        if (answer && answer.ok && typeof router.heard === 'function') {
          try { router.heard(route.relayUrl, to); } catch (e) { /* a witness, never a reason to fail the post */ }
        }
        res.writeHead(answer.ok ? 200 : (answer.status || 502),
          { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(answer));
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // THE LOG, READ AS A TABLE. What arrived, oldest first, from a
  // position — so a page that was shut can catch up with the same rows a
  // live page was pushed.
  //
  //   Andy: "The node will provide client(s) with an api block that
  //   treats the log like a database file with the primary keys being
  //   hash, arrival-date."
  //
  // DELIBERATELY CONTAINED. `since` and `limit`, or one row by `hash`,
  // and nothing else — no filter on `packet.app`, ever:
  //
  //   Andy: "only an entity that knows the internal package structure
  //   (shell) can fan out based on the internal package structure, so the
  //   read-log-interface the node provides should be fairly contained."
  //
  // The node keys on public keys and hashes. Routing by app is the
  // shell's reading, and doing it here would be this layer reaching up.
  //
  // Rows come back in the shape the live push sends, decoded envelope
  // included — one shape to merge rather than two, which is the whole
  // problem a catching-up client has.
  // handleArrivals STOOD HERE, and GET /api/hub/arrivals with it.
  //
  //   Andy: "api/hub/arrivals must be removed"
  //
  // It was the catch-up half of "post to a peer, find out what arrived" —
  // and it had NO CALLER. Not the shell, not an app, nothing but a test
  // written against it. The reason is that catch-up was already solved,
  // better, one layer down: createArrivals.subscribe() asks the log for
  // un-taken rows the moment a page opens, marks them, and pushes them
  // down the SAME live channel a new packet arrives on. A page that was
  // closed gets what it missed without asking a second door a different
  // question.
  //
  // So this was a parallel answer to a question that already had a good
  // one, and the weaker of the two: it needed the client to remember
  // where it got to, and to have a clock that agreed with the node's.
  // `since`, the parameter that made it a table rather than a feed, never
  // had a caller either.
  //
  // rowAsMessage went with it. arrivals.js keeps its own asMessage for
  // the live path, which is the one shape a client ever sees now.

  // handleMonitor STOOD HERE, proxying a signed verb to the relay
  // because the browser holds no key.
  //
  // Nothing replaced it, which is the shape of a collapse done right. The
  // panel posts to the relay the way it posts to any peer —
  // sendMessagePacket('relay', <relay key>, { monitor: … }) — through
  // handlePost, which already signs with this node's identity for every
  // other destination. The relay's answer comes back as that post's own
  // reply, correlated by hash.
  //
  // A verb here would have been a third place to shape one request, and
  // the only thing it added was a second door on the relay to receive it.

  // handleSend STOOD HERE, and POST /api/hub/send with it.
  //
  //   Andy: "the ring was a lie all along. it was unable to promise
  //   reliable delivery anyways, because it dropped entries on overflow."
  //
  // This was the node's door onto that ring, and it had NO CALLER — not
  // the shell, not an app, not device.html. hubPost.js had already been
  // asserting that for a while: "nothing above the boundary names
  // /api/hub/send". Relay Chat sends through /api/hub/post, the router.
  //
  // So this is the door half of R8, taken early because it costs nothing
  // and because a door nobody knocks on is the same impurity as a verb
  // nobody can reach.
  //
  // What is left of the ring goes together, because splitting it leaves a
  // signed format guarding an unreachable function: relay.send,
  // /api/relay/send (which the lab and live harness scripts still use to
  // make traffic), sendMessage, checkSend, the `messages` array and
  // inbox. That waits on Relay Chat's receive path moving off its poll.

  // The token is the relay's to generate, never this node's: a token
  // invented here would not be in the relay's invites.json and would
  // refuse the very claim it was made for. All the hub contributes is the
  // owner's name and a signature over the label and duration it is asking
  // for. The relay is what mints.
  //
  // Which mailbox is the caller's to say, not relays.json[0]'s to assume.
  // A node may own several; minting on the first one listed would put the
  // token on a mailbox the friend was never being invited to, and the
  // owner would not find out until the claim failed somewhere else.
  // What this node will do about somebody it has never heard of.
  //
  // GET answers what is set; POST changes it. Both are about the
  // PREFERENCE and neither can reach the floor — an unknown sender is
  // bounded, and reaches no app before a decision, whatever this says.
  // That is in code, in peerPost, and there is deliberately no route to
  // it.
  // ── READ AND WRITE ARE TWO FUNCTIONS NOW ────────────────────────────
  //
  // This was one handler that branched on `req.method`, because one path
  // served GET and POST. Under the one loopback door every call is a
  // POST, so the method carries nothing and that branch had become a
  // silent coin-toss: a caller that forgot to say POST would have READ
  // the policy and been answered 200 with the old value, which looks
  // exactly like a write that did nothing.
  //
  // Two verbs, two functions. `contact.senders` asks, `contact.setSenders`
  // decides, and neither can be mistaken for the other.
  function handleSendersRead(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, policy: unknownPolicy(rootDir) }));
  }

  function handleUnknownSenders(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var wanted = body && body.policy;
      if (UNKNOWN_POLICIES.indexOf(wanted) === -1) {
        // Named, unlike most refusals on this box: the caller is this
        // node's own browser, it is ours to fix, and a typo in a radio
        // value should say which values exist.
        fail(res, 400, 'policy must be one of: ' + UNKNOWN_POLICIES.join(', '));
        return;
      }
      if (!writeUnknownPolicy(rootDir, wanted)) {
        fail(res, 500, 'could not write preferences.json');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      // Answered from a fresh READ rather than from what was asked for,
      // so the caller is told what the node will actually do rather than
      // what it requested.
      res.end(JSON.stringify({ ok: true, policy: unknownPolicy(rootDir) }));
    }).catch(function () {
      fail(res, 400, 'bad body');
    });
  }



  // ── EVERY POST-PATH HANDLER STOOD HERE. ALL FOUR ARE GONE. ────────
  //
  //   Andy: "I am aiming to close all post-path doors on node"
  //
  // handleInvite, handleRename, handleRemovePeer and handleRevoke. Each
  // read a JSON body, built one packet body, and handed it to askRelay
  // -> router.post. That is what a peerPost IS, so each was this node
  // translating a thing the browser could say for itself.
  //
  // WHAT WENT WITH THEM is the part worth noticing: label checks, url
  // choosing, status codes, response shaping. None of it protocol. All
  // of it opinions that had to be kept consistent with the relay by
  // hand — and were not always. handleRename spent a day answering 503
  // to every call because it had been handed the wrong deps, and nothing
  // could see it, because a door is easy to wire wrongly and a packet is
  // not.
  //
  // askRelay went with the last of them. It existed to be the shared
  // half of four near-identical doors; with no doors there is nothing to
  // share, and `withChosenRelay` keeps its other caller.
  //
  // The browser addresses a relay by KEY through handlePost now. A new
  // relay verb needs no function here at all.
  // handleWho STOOD HERE (goal/G19.11): the node's own book, its pinned
  // relay key and its own key, answered for the first relay of the list.
  // No route served it once contact.search and contact.get took its job.
  // THE ADDRESS BOOK IS LOCAL, AND ALWAYS WAS (2026-09-18), and that stands:
  //
  //   Andy: "there is absolutely no reason for unbound entities to
  //   conduct surveys of our network." — and on the packet ceiling
  //   blocking the roll's demotion: "that's the point, so bound
  //   entities now MUST use alternate interfaces: easy!"
  //
  // A node never builds its book out of a relay's membership; a caption
  // comes from contactBook.labelForKey, locally, preferring the name the
  // person typed. A survey by a bound entity is still a survey.

  // ── contact.search / contact.get: THE BOOK, SEARCHED (puppets/G2) ──
  //
  //   Andy, 2026-09-27: "the verb changes changing list fetches to a
  //   search(labe) and geKey(key) pair are approved"; for the marks, "go."
  //   on putting the state in the label ('Bert — blocked'); and "the
  //   search box below searches all available relays. the box on top,
  //   should not."
  //
  // peer.list answered the whole book at once. contact.search walks the
  // same book (buildPeople, sorted by caption, which is the scan order)
  // and answers key/label pairs; it never asks a relay. Since goal/G29.6
  // the label is json {name, owned, blocked, held} (contactLabel), the
  // words are ranked by the probability modules, and owned, blocked and
  // held are yes-filters beside q (searchPeople).
  //
  // ONE SEARCH IN TWO TIERS (goal/G30.19, the node interface change Andy approved: "interface change/reduction
  // approved."). Tier one, at once: the book's matches and the shadow's (the peers this node has heard of, seenPeers),
  // one row shape, a row's `book` saying which. Tier two: the same call starts the network search (walkRelays), whose
  // rows stream as the 'peer-search' job and land in the shadow, so the next search starts from what this one learned.
  // ONE NETWORK SEARCH AT A TIME (Andy: "the node also only triggers a peer search if none is in flight."): a search
  // while one is out is answered from the book and the shadow and starts nothing; nothing waits for it to return.
  var networkOut = false;
  var networkJob = null;
  function contactSearch(body, deps) {
    var d = deps || {};
    var q = String((body && body.q) || '').trim();
    var people = buildPeople(rootDir);
    var r = searchPeople(people, q, body);
    var self = auth.loadIdentity(rootDir);
    var items = r.items;
    var more = r.more;
    var filtered = body && (body.owned === 'yes' || body.blocked === 'yes' || body.held === 'yes');
    if (!filtered) {
      var inBook = Object.create(null);
      people.forEach(function (p) { inBook[p.publicKey] = true; });
      // The shadow's strangers, matched and capped as a relay's members are (fromMemory, R39); the absent left out.
      var memory = fromMemory(/^\*+$/.test(q) ? '' : q, inBook, self.publicKey, relayLabels());
      if (memory.more) more = true;
      items = items.concat(memory.rows
        .filter(function (row) { return !inBook[row.publicKey]; })
        .map(function (row) { return { key: row.publicKey, label: strangerLabel(row) }; }));
    }
    if (!networkOut && d.jobs) networkSearch(q, d);
    // No selfTail beside the rows: no key's tail is shown anywhere (Andy, 2026-10-24, goal/G40.1: "drop selfTail and
    // tail from contact.search's answer.").
    return { ok: true, status: 200, items: items, more: more };
  }

  // A row the book does not hold, from the shadow or a relay: what the list shows and what Add needs (its relay).
  // Its name is what it calls itself, and no key's tail (Andy, 2026-10-24, goal/G40.1: "we don't show the fucking tail
  // anywhere anymore.").
  function strangerLabel(row) {
    var said = String(row.publicLabel || '').trim();
    return JSON.stringify({
      name: said || '(no name)',
      owned: false, blocked: false, held: false, book: false,
      publicLabel: String(row.publicLabel || ''), present: row.present === true ? true : row.present === false ? false : undefined,
      relay: row.relay || '', kind: row.kind || 'node',
      // When the shadow last heard of them (0020); a row the network just found has none, being news.
      seenAt: row.seenAt || undefined,
    });
  }
  function relayLabels() {
    var labels = Object.create(null);
    ownerBadge.loadRelays(rootDir).forEach(function (x) { if (x && x.url) labels[x.url] = x.label || ''; });
    return labels;
  }

  // TIER TWO: the walk, each row noted in the shadow and sent as one update of the 'peer-search' job, a contact as its
  // book row. d.walk stands in for the relays in a suite; d.router is the live one.
  function networkSearch(q, d) {
    networkOut = true;
    if (!networkJob) networkJob = d.jobs.createJob('permanent', 'peer-search', {});
    var ranks = require('./seenPeers');
    var onRow = function (row) {
      shadow(rootDir).note(row.publicKey, {
        at: row.atKey, url: row.relay, label: row.publicLabel,
        present: true,
        rank: row.viaPartner ? ranks.HEARSAY : ranks.HOST,
      });
      var b = contactBook.byPublicKey(rootDir, row.publicKey);
      var label = b
        ? JSON.stringify(Object.assign(JSON.parse(contactLabel({ publicKey: b.publicKey, publicLabel: b.publicLabel || '',
          myLabel: b.myLabel || '', held: !contactBook.listens(b), blocked: contactBook.isBlocked(b), owned: b.owned === true })), { present: true }))
        : strangerLabel(row);
      d.jobs.updateJob(networkJob.id, { data: { q: q, item: { key: row.publicKey, label: label } } });
    };
    var walk = typeof d.walk === 'function' ? d.walk : function (words, each) { return walkRelays(d.router, words, each); };
    var going = null;
    try { going = walk(q, onRow); } catch (e) { going = null; }
    Promise.resolve(going)
      .catch(function () { /* a walk that failed found nobody; the next search starts another */ })
      .then(function () { networkOut = false; });
  }

  function contactGet(body) {
    var key = String((body && body.key) || '');
    if (!key) return { ok: false, status: 400, error: 'key required' };
    var person = buildPeople(rootDir).filter(function (p) { return p.publicKey === key; })[0];
    if (!person) return { ok: false, status: 404, error: 'not in the book' };
    return require('./limits').boundedGet({ ok: true, status: 200, key: key, person: person });
  }

  // ── peer.find STOOD HERE (handleHandle / findHandle), DELETED ──────
  //     2026-09-17
  //
  //   Andy: "handles are not used in keyed mode by definition."
  //
  // It fetched the whole roll from `urls[0]` and filtered it down to
  // rows whose label matched a word exactly — the "is the john I was
  // told about here" question.
  //
  // THE TREE ASKED FOR THIS DECISION and had been waiting on it.
  // contacts.js, where the caller used to be: "The verb survives it.
  // `peer.find` is still served by the node and now has no caller in the
  // tree, which is a thing to decide rather than a thing to leave: it
  // asks `urls[0]`, so it cannot see a second relay or a partner's
  // members, and anything that wanted it should want peer.search
  // instead."
  //
  // Superseded rather than merely unused, which is why this is a
  // deletion and not a retrofit: ranked search answers the same question
  // strictly better. "An exact handle scores 1.0 and comes first out of
  // a million, so typing the name you were told IS the handle lookup,
  // and typing part of it is the other question. One box answers both."
  // It also crossed relays and partnerships, which this never could.
  //
  // `handleMatches`, which this called, outlived it until goal/G19.11.

  // POST /api/hub/contact — a human confirmed one of those candidates.
  //
  // The key is checked against the roll before it is written: a stale
  // page, or a mistyped paste, must not put a contact in the book for
  // somebody who is not there. The label comes from the mailbox rather
  // than from the browser, for the same reason.
  // Yes or no about a person. No mailbox call: whether this node listens
  // is its own business — the mailbox has no opinion and is not asked
  // for one.
  //
  // Any key can be blocked, not only a contact. An ordinary personal
  // node can become a nuisance, and being on somebody's list is not what
  // makes them one; a row this node has never acquired is blocked just
  // the same, which is why block does not require a rank.
  //
  // Block is deliberately not a delete. The row stays, marked, because a
  // list you can be removed from silently is a list nobody can undo a
  // mistake in.
  // ── THE ACTION FIELD IS THE VERB, AND NOW IT IS SPELLED THAT WAY ────
  //
  // `{ action: 'block' | 'unblock' | 'accept' | 'label' }` was a verb
  // inside a body, under a route that was also a verb — a dispatch this
  // file did by hand, one `indexOf` and one if-chain, beside a dispatch
  // the door already does for everything else.
  //
  // So `contact.block`, `contact.unblock`, `contact.accept` and
  // `contact.label` are four claims on the table, and the check that
  // `action` is one of four is gone: an unknown verb is refused at the
  // door by a table that knows every verb this node answers, rather than
  // by a string list here that only knows these.
  //
  // WHAT DOES NOT CHANGE, and is the reason these are four and not two:
  // `accept` says listen to this person, `unblock` only takes the block
  // off. Somebody blocked while still waiting goes back to waiting, not
  // into the address book — undoing a no is not the same as saying yes.
  function handlePeer(req, res, readJsonBody, action) {
    readJsonBody(req).then(function (body) {
      var publicKey = String((body && body.publicKey) || '').trim();
      if (!publicKey) { fail(res, 400, 'publicKey required'); return; }
      if (auth.loadIdentity(rootDir).publicKey === publicKey) {
        fail(res, 400, 'that key is this node');
        return;
      }
      // Blocking somebody this node has no row for is a real case: they
      // are in the roll, they have been picked in the list, and they
      // have never been acquired. A row is made so the block has
      // somewhere to live and somewhere to be undone from.
      if (action === 'block' && !contactBook.byPublicKey(rootDir, publicKey)) {
        var heldLabel = String((body && body.publicLabel) || '');
        var heldBad = labelRefusal(heldLabel);
        if (heldBad) { fail(res, 400, heldBad); return; }
        contactBook.hold(rootDir, { publicKey: publicKey, publicLabel: fieldRules.normalize(heldLabel) });
      }
      // What YOU call that key. Never uploaded, never seen by the peer,
      // and the reason contactBook keeps publicLabel separate: the mailbox's
      // caption is theirs and can change under you, this one is yours.
      if (action === 'label') {
        var mine = String((body && body.myLabel) || '');
        var mineBad = labelRefusal(mine);
        if (mineBad) { fail(res, 400, mineBad); return; }
        var row = contactBook.setMyLabel(rootDir, publicKey, fieldRules.normalize(mine));
        if (!row) { fail(res, 404, 'no row for that key'); return; }
        var caption = contactBook.labelForKey(rootDir, publicKey, row.publicLabel || '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: row.publicKey,
          myLabel: row.myLabel || '',
          caption: caption,
        }));
        // Every label showing this contact redraws (goal/G4.13). The
        // node's own event, named contact.rename: Andy, 2026-10-03,
        // "peer labels belong to node." / "so node owns contact.rename".
        contactRenames.note({ key: row.publicKey, caption: caption });
        return;
      }

      // FORGETTING IS NOT BLOCKING, and answers a different shape: there
      // may be no row left to describe. contactBook keeps a blocked row and
      // only downgrades it — deleting one would readmit the person the
      // moment they wrote, because the row IS the refusal.
      if (action === 'forget') {
        // A REFUSAL STOOD HERE: Forget answered 409 while `memberOf` named a
        // relay this node owns. `memberOf` is gone (2026-09-19), and Forget
        // no longer asks whether a seat exists: contactsDetails removes the
        // key from every relay this node owns first, and "no such peer" is
        // simply the answer. We act on what we find (Andy).
        var gone = contactBook.forget(rootDir, publicKey);
        if (!gone) { fail(res, 404, 'no row for that key'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: publicKey,
          forgotten: !!gone.forgotten,
          // Said plainly rather than implied: a blocked person is still
          // blocked, and a person on a relay you are on will be findable
          // again, because a roll is not yours to edit.
          stillBlocked: !gone.forgotten,
        }));
        return;
      }

      // A FULL MEMORY TAKES NOBODY NEW (0021). Accepting is adding, and so
      // is unblocking somebody who had been added: both put a row back
      // under protection. Blocking never needs room — it gives some back.
      var before = contactBook.byPublicKey(rootDir, publicKey);
      var adds = action === 'accept' ||
        (action === 'unblock' && before && contactBook.markOf(before).choice === 'added');
      if (adds && !shadow(rootDir).roomToAdd(publicKey)) {
        fail(res, 507, 'memory is full of the people you added');
        return;
      }

      var row;
      if (action === 'block') row = contactBook.setBlocked(rootDir, publicKey, true);
      else if (action === 'unblock') row = contactBook.setBlocked(rootDir, publicKey, false);
      else row = contactBook.accept(rootDir, publicKey);
      if (!row) { fail(res, 404, 'no row for that key'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        publicKey: row.publicKey,
        acquiredVia: contactBook.acquiredVia(row),
        blocked: contactBook.isBlocked(row),
        held: !contactBook.listens(row),
      }));
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleContact(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var publicKey = String((body && body.publicKey) || '').trim();
      if (!publicKey) {
        fail(res, 400, 'publicKey required');
        return;
      }
      // A label given by hand is checked before anything is asked or
      // written (goal/G4.16); none at all is still allowed.
      var givenBad = labelRefusal((body && body.publicLabel) || '');
      if (givenBad) { fail(res, 400, givenBad); return; }
      // ── WHICH ROLL PROVES IT ───────────────────────────────────────
      //
      //   Andy: "now we need to be able to add foreign peers to contacts,
      //   peer post to foreign peers require that."
      //
      // This asked `withRelay`, which is `urls[0]` — the first row in
      // relays.json, whatever the question was. So a key that is real and
      // enrolled on a PARTNER could never be confirmed: it is not on this
      // relay's roll, and 404 was the honest answer to the wrong
      // question.
      //
      // The caller names the relay now. What is checked is exactly what
      // was checked before — the key must be listed on that roll, so a
      // stale page or a mistyped paste still cannot write a row for
      // somebody who is not there. Only the source moves, from "the first
      // relay in the file" to "the one the caller was looking at".
      //
      // NOT A WIDENING, and this is why it needs no gate: a person could
      // already add any relay to relays.json and acquire from it. All
      // this removes is the requirement to JOIN a relay in order to
      // confirm a key that is on it.
      //
      // `relay: url` is written on the row below, so where a contact was
      // found is recorded rather than inferred later.
      var wantedUrl = String((body && body.url) || '').trim().replace(/\/+$/, '');
      var target = wantedUrl || loadRelayUrl(rootDir);
      if (!target) { fail(res, 503, 'no relay url in the relay list of this node'); return; }
      try { assertRelayUrl(target); }
      catch (e) { fail(res, 503, String(e.message || e)); return; }

      guarded(res, target, function (url) {
        // -- ASKING ABOUT ONE KEY, NOT READING THE WHOLE LEDGER ---------
        //
        // ── IT ASKS THE RELAY NOTHING (2026-09-18) ──────────────────
        //
        //   Andy: "callers of the roll have two choices: use other
        //   interfaces or die."
        //
        // It fetched the entire roll to answer yes or no about a single
        // key, then narrowed to `?key=` for a day. Both were the roll,
        // and this was the last caller holding the route open.
        //
        // The read did two jobs: it CONFIRMED the key was on that relay,
        // and it lifted `publicLabel` off the row.
        //
        // The label travels with the row now. A key reaches this verb
        // because somebody clicked a thing the relay had already
        // described — a search result carries `publicLabel`, and Contacts
        // puts it on the button. Asking the relay to repeat what it just
        // said is a node spending its own request budget on nothing
        // (design/principles/THE-REQUESTER-IS-RESPONSIBLE.md).
        //
        // THE CONFIRMATION IS GONE, deliberately, and it bought less than
        // it looked:
        //
        // - It never checked the thing that matters. `via: 'handle'` means
        //   a human compared key endings out loud; the roll only said
        //   "that key is enrolled here", which a typo landing on a real
        //   key passes just as well.
        // - A contacts row is this node's OWN PERCEPTION, in a local file.
        //   A wrong one is a contact that never answers — honest, visible
        //   and deletable — which is a small thing against keeping a cheat
        //   alive to prevent it.
        // - And posting is the real test: 0006 has the relay deliver or
        //   refuse instantly, so writing to somebody proves reachability,
        //   which is more than enrolment ever proved.
        //
        // What it still refuses is acquiring THIS NODE, a local check that
        // needs nobody.
        if (auth.loadIdentity(rootDir).publicKey === publicKey) {
          fail(res, 400, 'that key is this node');
          return;
        }

        // How the key was confirmed. `handle` is a human comparing key
        // endings out loud (cut 2). `invite` is the owner recognising a
        // label they minted, now claimed on their own mailbox. Nothing
        // else is accepted here: a page cannot promote a stranger by
        // asking nicely.
        var wanted = String((body && body.via) || 'handle');
        var via = (wanted === 'invite') ? 'invite' : 'handle';
        // The same refusal as accept (0021): adding needs room.
        if (!shadow(rootDir).roomToAdd(publicKey)) {
          fail(res, 507, 'memory is full of the people you added');
          return;
        }
        var row = contactBook.acquire(rootDir, {
          publicKey: publicKey,
          // Empty is a real answer: a pasted key has no label until its
          // holder writes to you or you type one yourself. Inventing one
          // would be worse than an unnamed row.
          publicLabel: fieldRules.normalize((body && body.publicLabel) || ''),
          relay: url,
        }, via);

        // ── THE ROUTE THE SEARCH ALREADY KNEW ────────────────────────
        //
        //   Andy: "in a search request, it is the node who already knows
        //   the via field at request time." — "so all search returns
        //   could be cached outside of contacts, and wait until they
        //   become applicable."
        //
        // This is the moment it becomes applicable. Until now a contact
        // acquired from a search arrived with an address in `relays` and
        // nothing in `routes`, so the first post to them had no hint to
        // send and the relay had to find them with none.
        //
        // AFTER `acquire`, NEVER BEFORE, because the book matched an
        // existing row and never creates one — which is the rule that
        // stops a relay writing into somebody's address book, and it
        // holds here too: no search result becomes a route until a person
        // has decided to keep the person.
        //   Andy: "Any peer a node could possibly connect to, the route
        //   to it can be known to the node."
        //
        // TWO SOURCES, IN THAT ORDER. What a search found is about the
        // PERSON — where they live — and is preferred. Failing that, the
        // caller named a relay to acquire from, and this node pinned that
        // relay's key when it accepted it, so the route is one lookup
        // away and was being thrown out. That is the invite and
        // pasted-key path, which had no cache entry to fall back on and
        // therefore produced a contact nobody could route to.
        var seen = shadow(rootDir).get(publicKey);
        var at = (seen && seen.at) || relayKeys.pinned(rootDir, url) || '';
        // HEARSAY: the caller named this relay — an invite, a pasted key —
        // and nobody has proved anything yet. Kept anyway, because it is
        // the only thing anybody knows about where this person lives, and
        // a better-sourced route will outrank it the moment one arrives.
        if (at) {
          try {
            shadow(rootDir).note(publicKey, {
              at: at, url: url || '', via: relayKeys.pinned(rootDir, url) || '',
              rank: require('./seenPeers').HEARSAY,
            });
          } catch (e) { /* a cache that will not take a row is not a reason to refuse the contact */ }
        }

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: row.publicKey,
          publicLabel: row.publicLabel,
          acquiredVia: contactBook.acquiredVia(row),
        }));
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // THE DEVICE POLL, ITS WINDOW AND ITS PANEL HANDLERS STOOD HERE. The
  // device enrolment they served was removed by goal/G16.2.

  // ── THE ROSTER SWEEP STOOD HERE, AND IS GONE (2026-09-19) ────────────
  //
  // reconcileMembers, reconcileOrphans and syncMembers read every owned
  // relay's roll roster: whoever was on it became a contact with
  // `memberOf`, whoever was on no roster lost it, and a key on no roll
  // at all was marked `missingSince`. The roll went on 2026-09-18 and a
  // roster may never be returned again — it is a member list, which 0012
  // widened forbids, and it breaks PAYLOAD_MAX — so the sweep read []
  // forever, and pruned every member contact on every probe until a guard
  // stopped it.
  //
  // Andy's rule, which is why it is deleted rather than guarded: "relays
  // only provide one way to find nodes or relays: SEARCH. What is not found
  // cannot influence decisions. We design to do the best with what we
  // find; we won't be bothered with what we can't find or know." And:
  // "email addresses change, contacts go stale. Deal with it."
  //
  // What remains: a new member becomes a contact on the claim event itself
  // (server.js, onOwnerEvent), from the key and label it names. Forget no longer asks whether a seat exists — it acts
  // (contactsDetails removes the key from every relay this node owns, and
  // "no such peer" is simply the answer) and then forgets.

  // ── A NEW MEMBER OF A RELAY I OWN BECOMES A CONTACT ────────────────
  //
  //   Andy: "when someone binds to a peer i own, it's because i want
  //   them as a contact."
  //
  // On the claim event itself, with what it names: the key, the label they
  // chose, the relay it happened on. A broadcast the node receives
  // passively — Andy: "nodes have two sources of knowledge, search
  // (active) and broadcasts (passive)". Owner events reach only the owner
  // of the relay they happened on, so every claim seen here is on a relay
  // this node owns. The rank records HOW they came, which is history; it
  // is not a claim that they still hold a seat. Never this node's own
  // claim. Called by server.js on every owner event.
  function adoptClaim(ev) {
    if (!ev || ev.kind !== 'claim' || !ev.key || ev.owner) return null;
    if (auth.loadIdentity(rootDir).publicKey === String(ev.key)) return null;
    try {
      // Not added when there is no room (0021) — the claim still happened,
      // and the memory still has them as a stranger.
      if (!shadow(rootDir).roomToAdd(String(ev.key))) return null;
      return contactBook.acquire(rootDir, {
        publicKey: String(ev.key), publicLabel: String(ev.label || ''), relay: ev.relay || '',
      }, contactBook.MEMBER);
    } catch (e) { return null; }
  }

  // ── WHAT THIS NODE SAYS ABOUT ITSELF, AT HOME ────────────────────────
  //
  //   Andy: "i want an intrinsic app info, in which, for now the user can
  //   maintain both fields in this file, more to come."
  //
  // Read and write of the two fields nodeCard answers to strangers. The
  // logic is all in nodeCard — these three exist because a loopback verb
  // needs a req/res pair and that module must not learn what one is: it is
  // required by peerPost, which is the wire path, and a file that answers
  // both sides of a question should not also be holding an HTTP response.
  function handleNodeCard(req, res) {
    var card = nodeCard.read(rootDir);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ ok: true }, card)));
  }

  // A REFUSAL IS A BODY, NOT A STATUS, for both of these. The app draws
  // `error` under the field that caused it, which is where somebody is
  // looking — and fieldRules already told it the same thing before the
  // request left, so arriving here means the browser was out of date or
  // was not the one asking.
  function handleNodeName(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var said = nodeCard.setName(rootDir, body && body.name);
      res.writeHead(said.ok ? 200 : said.status,
        { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(said));
    }).catch(function () { fail(res, 400, 'Invalid JSON body'); });
  }

  function handleNodeDescription(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var said = nodeCard.setDescription(rootDir, body && body.description);
      res.writeHead(said.ok ? 200 : said.status,
        { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(said));
    }).catch(function () { fail(res, 400, 'Invalid JSON body'); });
  }

  // THE NAME ARRIVES IN THE BODY, not on a query string, since the relay
  // namespace folded onto /api/spirit. What this buys is that every
  // loopback verb is now the same shape — a POST with a JSON body — so
  // there is nothing left for a caller to remember about this one in
  // particular. `readJsonBody` is memoised on the request, so reading it
  // here costs nothing even though the door has already peeked at it for
  // the verb.
  //
  // A BODY THAT WILL NOT PARSE IS NOT A REFUSAL HERE, and that is
  // deliberate. `name` is echoed back, never used to decide anything
  // (see below), so a missing one degrades to the empty string exactly
  // as a missing query parameter did. Failing the whole probe over a
  // caption would take Natter's relay list down for a reason that has
  // nothing to do with the relays.
  // ── IS THIS PEER ELIGIBLE TO BE A PARTNER? ──────────────────────────
  //
  //   Andy: "can peers get the public key of a relay's owner from the
  //   relay, if they are on its ledger? this would make handshake on
  //   partnership a breeze, because partnership eligibility would be
  //   easier to determine."
  //
  // They can, and better than asked: not just peers on the ledger —
  // ANYONE. The relay's card — the answer to a card ask on its one door,
  // since goal/G22.6 closed `GET /api/relay/key` — carries the relay's own
  // key beside `ownerKey` and `ownerLabel` (it took that job from the roll,
  // deleted 2026-09-18). So eligibility is one ask and a comparison, with
  // no membership.
  //
  // READ-ONLY, AND THAT IS THE DESIGN. This answers a question; it does
  // not promote anybody. The promotion is an owner verb posted to the
  // relay like every other one, so there is exactly one path that writes
  // a peer row and this is not it.
  //
  // WHY THE NODE DOES THE FETCHING: a relay makes no outbound request of
  // any kind and this does not change that. Nothing is being laundered —
  // the key door is public, so a node reporting it hands over nothing the
  // relay could not have read itself.
  //
  // TWO KEYS, TWO JOBS, and conflating them is the likeliest bug in this
  // design: you verify OWNERSHIP against `ownerKey`, and you
  // capture the RELAY's own key to pin for a later forward hop. On
  // spirit-3 those are …fXD+0c= and …bCAsCR4=.
  // ── WHO IS OVER THERE ────────────────────────────────────────────────
  //
  //   Andy: "we want to prove that with a partnership more peer id's can
  //   be visible for every node bound to either partner."
  //
  // The roll of a relay this node is NOT on. Public, unauthenticated,
  // the same page `handlePartnerCheck` above already reads — this just
  // hands back the roster instead of a verdict about one key.
  //
  // WHY THE NODE AND NOT THE RELAY. Item 8: the node fetches, the relay
  // stores the conclusion. A relay caching its partners' members and
  // answering searches is tier three and needs a cache, a lifetime and a
  // budget. Reading a public page needs none of those, and it is enough
  // to SEE — which is the whole of what this step claims.
  //
  // NOT A PROXY. It fetches one fixed path, returns only what a roll
  // carries, and `assertRelayUrl` applies as everywhere else. A caller
  // that wants an arbitrary url has `net.fetch` and its own refusals.
  // ── handleRoster STOOD HERE (`relay.roster`), DELETED 2026-09-17 ───
  //
  // It fetched a named relay's whole public roll so natterDetails could
  // tabulate who a partner holds. That panel is gone (see the tombstone
  // in natterDetails.js) and this had no other caller.
  //
  // It was the one roll reader that genuinely wanted a LIST, and so the
  // one that would have needed paging designed for it. It turned out to
  // want a list for a screen nobody needed — which is worth remembering
  // the next time a caller looks like it needs a bigger answer.

  // ── EVERYBODY THIS NODE CAN SEE AND DOES NOT YET KNOW ────────────────
  //
  //   Andy: "Natter, of course, will not be the place to add contacts,
  //   this must fit seamlessly into contacts itself, and the list there
  //   must present peers that are not yet in the contacts list from our
  //   bound relay or other relays."
  //
  // Contacts saw ONE relay when this was written: `peer.list` was
  // `withRelay`, which was `urls[0]`. So "people you could add" meant "people on the first row of
  // relays.json", and everybody on the second relay — let alone on a
  // partner — was invisible in the place a person actually goes looking.
  //
  // THE FAN-OUT BELONGS HERE, not in the app. The browser would need one
  // request per relay plus one per partner, and natterDetails would grow a
  // second copy of the same arithmetic. Later this becomes one `search` to
  // each relay (PARTNERS.md, tier three) and the app does not change: it
  // asks this verb either way.
  //
  // Three hops, and only the middle one needs a signature:
  //
  //   1. each configured relay's roll      public GET
  //   2. ask it who it partners with         signed post, any member may
  //   3. each partner's roll               public GET
  //
  // WHAT IS SUBTRACTED is anybody already known — `contactBook.contacts()` is
  // every row that arrived by more than a roll sighting. A candidate is
  // precisely somebody visible and not yet known, which is the list the
  // question asks for and nothing more.
  // ── THE ONE DOOR ONTO THE WIRE ───────────────────────────────────────
  //
  // `router.post` is called here and nowhere else in this file, and
  // serverSurface asserts it by counting:
  //
  //   "Every post-path door was deleted on 2026-09-15 so that peer.post is
  //   the only way onto the wire. A second caller is a second door,
  //   whether or not a route has been wired to it yet."
  //
  // Which it caught immediately when handleCandidates grew its own call
  // (that verb is gone, but the rule it proved is not).
  // The rule is about paths, not about verbs — so a second CALLER shares
  // this function rather than reaching past it, and everything that
  // decides how a packet is shaped stays in one place.
  function sendPacket(router, relayUrl, toKey, text, hints, how) {
    return router.post(relayUrl, toKey, text, hints, how);
  }
  var PATIENCE_MAX_MS = 10 * 60 * 1000;

  // ── peerOwnerPost — THE OWNER COMMANDS A PUPPET HE OWNS ──────────────
  //
  //   Andy, 2026-09-25: "so node only a peerProxy() function that proxies
  //   the entire node api to manipulate the configuration, contactList
  //   maybe even relayList for the app" — and, naming it: "the interface
  //   might better be call peerOwnerPost()", "it's more true."
  //
  // NAMED FOR WHAT IT IS, NOT FOR WHAT IT DOES. `proxy` already means one
  // thing here — the outbound web fetcher, `net.fetch` at
  // `server.js:1563`, marked `{ wire: true }` with "it reaches the
  // internet, so being offline fails it", and `relay-state/proxy.json`
  // for which key may go to which website. That proxy points AT the
  // internet; this one points at a puppet. `peerOwnerPost` names by
  // family instead: it is `peerPost`, from the owner.
  //
  // ── AND THE COMMAND IS RULED, NOT ASSUMED ────────────────────────────
  //
  //   Andy, 2026-09-25: "The owner of the pupped can command anything,
  //   others by default nothing."
  //
  // `design/principles/PUPPETS.md` G8. The line `nodeCard.js:13` records
  // — a relay answers about itself and a node answers nothing — was
  // already crossed by `nodeCard` itself, whose `:208` returns name,
  // description, publicKey and sealKey for every node. So there was no
  // line left to cross, only the question of commands, which is now
  // answered.
  //
  // ── A SYSTEM PACKET, AND WHAT THAT DOES AND DOES NOT BUY ─────────────
  //
  // `packet.js:152-154`: "A system packet is now the one with NO app,
  // which nothing claiming to be an app can forge."
  //
  // THAT IS ABOUT DISPATCH, NOT ABOUT SENDERS, and it must not be quoted
  // as though it meant only an owner can send one (wsl-claude's
  // correction, 2026-09-25). A hostile peer composes a no-app packet
  // perfectly well. What it cannot do is be an app AND a system packet at
  // once — so NO PUPPET CAN INTERCEPT OWNER TRAFFIC, which is the
  // property this needs. Every puppet filters on its own name
  // (`fixList.js:131`, `appFaceApp.js:143`) and therefore ignores this
  // automatically.
  //
  // **THE OWNER-KEY COMPARISON AT THE RECEIVER IS THE WHOLE BOUNDARY.**
  // Nothing here authenticates anybody; `peerPost` signs every post with
  // this node's identity and the puppet decides whether that key is its
  // master's.
  //
  // ── BUILT WITH `systemPayload`, AND THE REASON IS A DELETION ─────────
  //
  // A first draft used `packet.encode('', …)` — the factory — and that
  // would have re-required `packet.js` here. It was DELIBERATELY REMOVED
  // from this file: `hub.js:862-871` records that `decorateWithPacket`
  // was "the last thing in the node that read an app envelope", deleted
  // under Andy's *"nothing in node and relay should know about apps"*,
  // and that it "was the only reason hub.js required packet.js at all".
  //
  // A SYSTEM PACKET IS NOT AN APP OBJECT — it is the one with no app —
  // so building one is arguably not what that deletion forbade. But the
  // require would reappear, and the next reader would see the deletion
  // undone without the sentence explaining why it was not. So this uses
  // the builder the file already has.
  //
  // THAT LEAVES A REAL QUESTION OPEN AND IT IS NOT MINE: `systemPayload`
  // is a one-line hand-built `{v, body}` with no `id`, no bound and no
  // refusal, where `packet.encode` validates and refuses — and Andy
  // ruled this afternoon that anything posted comes from a factory that
  // validates and (de)serialises. Either `systemPayload` becomes that
  // factory for system packets, or system packets come from `packet.js`
  // and the deletion above gets a second sentence. Both are defensible
  // and neither is a thing to settle inside this function.
  //
  // SENDS ONLY. The stored owner key, the switch and the loopback shim
  // are three separate requirements and none of them exists yet, so
  // nothing receives this. That is correct rather than incomplete — a
  // sender built against a receiver written the same hour is two halves
  // agreeing with each other instead of with the design.
  function peerOwnerPost(rootDir, router, relayUrl, toKey, verb, body) {
    const named = String(verb || '');
    if (!named) return Promise.resolve({ ok: false, status: 400, error: 'verb required' });
    if (!toKey) return Promise.resolve({ ok: false, status: 400, error: 'to required' });

    // ── THE OWNER SIGNS THE COMMAND, AND THAT IS WHAT THE PUPPET CHECKS ──
    //
    //   Andy, 2026-09-26: "the puppet is uable to sign any request with the
    //   owners signature. and that signature must exist before the puppet
    //   routes the request to loopback." — "the second half counts." — "so we
    //   must make sure in code, that the signature is verified in the pupped,
    //   else request is refused."
    //
    // WHY THE TRANSPORT SIGNATURE WILL NOT DO. peerPost.js:756 signs every
    // outgoing post with this node's identity key and no caller can withhold
    // it, so a puppet posting through its own node gets it for free — and to a
    // SIBLING puppet under the same owner, that node key IS the owner key. The
    // forger never signs anything; the router signs for it.
    //
    // THE SHAPE IS forwardToMine's, ONE LAYER IN (relay.js:2711-2728): a
    // signed string travels beside its signature and the receiver verifies
    // rather than trusting the carrier. Here the signed string is `cmd` and it
    // is carried verbatim, so the verifier signs over the same bytes without
    // canonicalising anything.
    //
    // THE ID IS MINTED FIRST, because it is inside the signed message and
    // `encode` would otherwise mint it afterwards — binding the signature to
    // this envelope and no other.
    const id = packet.randomId();
    const cmd = JSON.stringify({ verb: named, body: body || {} });
    const me = auth.loadIdentity(rootDir);
    const sig = auth.sign(me.privateKey, auth.commandMessage(me.publicKey, toKey, id, cmd));
    const made = packet.encode('', { cmd: cmd, sig: sig }, { id: id });
    // A REFUSAL IS A VALUE, NOT A THROW, and the sentence is the
    // factory's rather than a second wording of it. THE BOUND IS NOT
    // CHECKED HERE: `encode` bounds what it builds, which is the whole
    // reason for using it — an earlier draft carried its own length test
    // because `systemPayload` bounds nothing, and that was the limit
    // written down in a second place.
    // THE FACTORY'S SENTENCE, NOT A SECOND ONE. An earlier draft wrapped
    // this as "owner command too long: <the factory's words>" and read
    // "too long: packet too long" — two statements of one refusal, which
    // is the thing this file spent the day removing elsewhere. The
    // composer refused; that is the answer.
    if (!made || !made.ok) {
      return Promise.resolve({ ok: false, status: 413, error: (made && made.error) || 'packet too long' });
    }
    // Through the one door. `serverSurface.js:848`: "peer.post is the only
    // way onto the wire. A second caller is a second door, whether or not
    // a route has been wired to it yet."
    return sendPacket(router, relayUrl, toKey, made.text);
  }

  // ── MEMORY IS ONE MORE SOURCE IN THE FAN-OUT (R39, 0021) ─────────────
  //
  //   Andy: "in fact if search fans out to all bound relays first, why not
  //   to the memory also?" — "the relays result will take precedence until
  //   timeout()" — "When the wait times out, memory fills in the people no
  //   relay answered for, filtered exactly and prioritized exactly like
  //   search results." — "chosen ones should always be included. it kind
  //   of would look dumb if contacts couldn't list-search it's chosen
  //   ones..."
  //
  // Called after the relays: a key any relay answered for is skipped, so a
  // live row always wins and memory only fills in.
  //
  // THE SAME RANKING, NOT A SECOND ONE. Strangers go through peerRank —
  // the match every relay runs (goal/G29.17), with its slot count — and the same
  // absent drop the relay rows get above (`present === false`). "Exactly"
  // was ruled with its cost in view: "everything could hide someone your
  // looking for...."
  //
  // THE CHOSEN ARE NOT RATIONED. Anybody the book holds — added, held or
  // blocked — who matches is returned whatever the slots and whatever
  // their last-known presence, because they are the owner's own people.
  // They are matched by the same function with room for all of them.
  function fromMemory(q, found, myKey, labels) {
    var S = shadow(rootDir);
    var chosen = [];
    var strangers = [];
    var rows;
    try { rows = S.recall(require('./nodeSettings').searchMemoryRows(rootDir)); } catch (e) { return { rows: [], more: false }; }
    // THE BOOK, READ ONCE. byPublicKey reads and parses the file on every
    // call, and this asks about every chosen row and every row returned —
    // thousands of reads a search for a large book.
    var bookRows = Object.create(null);
    contactBook.load(rootDir).forEach(function (b) { if (b && b.publicKey) bookRows[b.publicKey] = b; });
    rows.forEach(function (r) {
      if (!r.publicKey || r.publicKey === myKey || found[r.publicKey]) return;
      var book = (r.choice === 'added' || r.choice === 'held' || r.blocked)
        ? (bookRows[r.publicKey] || null) : null;
      // The book's public label first: it is what the owner's list shows,
      // and a contact added by key may have a name only there.
      var candidate = {
        publicKey: r.publicKey,
        publicLabel: (book && book.publicLabel) || r.label || '',
        present: r.present, seen: r.seen,
        via: null,
      };
      if (book) chosen.push(candidate);
      else if (r.present !== false) strangers.push(candidate);
    });

    var mine = chosen.length ? peerRank.rank(chosen, q, chosen.length).rows : [];
    var theirs = peerRank.rank(strangers, q, peerRank.SLOTS);

    function shaped(c) {
      var best = S.get(c.publicKey) || {};
      // A RELAY'S OWN ADDRESS (goal/G30.7): its row's route is its url, the one route whose door is itself. A relay's
      // key heard arriving through another relay has that route too, and the best-ranked one may be it.
      if (best.kind === 'relay') {
        var own = S.routes(c.publicKey).filter(function (r) { return r && r.at && r.at === r.url; })[0];
        if (own) best = Object.assign({}, best, { at: own.at, url: own.url });
      }
      var row = bookRows[c.publicKey] || null;
      return {
        publicKey: c.publicKey,
        publicLabel: c.publicLabel,
        // A node or a relay (goal/G30.7, relays are peers): the Contacts list filters on it.
        kind: best.kind || 'node',
        atKey: best.at || '',
        relay: best.url || '',
        relayLabel: (best.url && labels[best.url]) || '',
        // LAST-KNOWN, and said to be: null when nobody has said (0019).
        present: c.present,
        via: null,
        viaPartner: false,
        acquiredVia: row ? contactBook.acquiredVia(row) : null,
        fromMemory: true,
        seenAt: c.seen ? new Date(c.seen).toISOString() : null,
      };
    }
    return {
      rows: mine.map(shaped).concat(theirs.rows.map(shaped)),
      more: theirs.more,
    };
  }

  // THE NETWORK SEARCH (goal/G30.19: tier two of contact.search; it was the verb peer.search, deleted with Andy's
  // approval of the interface reduction). Every configured relay asked once; onRow(row) for each peer found, as it
  // comes; resolves when every relay has answered or failed. Online only: a relay answers its connected members.
  function walkRelays(router, q, onRow) {
    if (!router) return Promise.resolve();
    var myKey = auth.loadIdentity(rootDir).publicKey;
    var found = Object.create(null);
    var labels = relayLabels();
    return Promise.all(ownerBadge.configuredUrls(rootDir).map(function (url) {
      // No pin means this node has never spoken to it; fetching a key from the box asked is how you get answered by
      // whoever is standing there.
      var relayKey = relayKeys.pinned(rootDir, url);
      if (!relayKey) return Promise.resolve(null);
      return sendPacket(router, url, relayKey, systemPayload({ search: { q: q } })).then(function (answer) {
        var said = null;
        try { said = JSON.parse((answer && answer.text) || ''); } catch (e) { said = null; }
        var out = (said && said.body) || {};
        if (!out || out.ok !== true) return;
        (out.matches || []).forEach(function (p) {
          if (!p || !p.publicKey || p.publicKey === myKey || found[p.publicKey]) return;
          if (p.present === false) return;
          // THE DOT LEARNS FROM THE ANSWER (goal/G2.9): the relay asked has just carried this row.
          if (typeof router.heard === 'function') {
            try { router.heard(url, p.publicKey); } catch (e) { /* a witness to the search, never a reason to fail it */ }
          }
          found[p.publicKey] = true;
          onRow({
            publicKey: p.publicKey,
            publicLabel: p.publicLabel || '',
            // The relay's key is the route: a row with no via is a member of the relay that answered.
            atKey: p.via || relayKey || '',
            relay: url,
            relayLabel: labels[url] || '',
            present: true,
            viaPartner: !!p.via,
          });
        });
      }).catch(function () { /* a relay that could not answer adds nobody */ });
    }));
  }


  // ── handleCandidates STOOD HERE, AND TOOK THE LAST WHOLE-ROLL ────
  //     FAN-OUT WITH IT (2026-09-17)
  //
  //   Andy: "we can kill the roll getting in the partner
  //   communications. we already are working with search concepts only
  //   there... nothing should break, contacts also uses search now."
  //
  // `peer.candidates` answered "everybody visible from here and not yet
  // known" by fetching EVERY roll whole — this node's relays and each
  // of their partners — and subtracting what the contactBook already had.
  // It was the worst roll reader in the tree and the only one with no
  // narrow form, because not knowing the keys was the entire point of
  // it: at a thousand members across five partners, six times 147 KB in
  // one call.
  //
  // IT HAD NO CALLER. The note that used to stand above it said it
  // "stays for the small case and for the 'who is here' question, and
  // [peer.search] is what the app should use once a relay is real" — and
  // the app moved. Contacts paints that panel from `peer.search`
  // (contacts.js, contactsAsk('peer.search')), and says so itself
  // twenty lines earlier: "anything that wanted it should want
  // peer.search instead." What remained was a route, an export, a
  // surface assertion and one stale comment, which between them made a
  // dead verb look alive.
  //
  // Nothing replaces it. `peer.search` asks each relay who matches
  // rather than downloading each relay, which is the same question with
  // a bound on the answer.

  // PARTNERING AS A PERMISSION IS GONE (Andy's decision, goal/G22.6): no
  // relay keeps a partner roll any more, so what this answers promotes
  // nothing. The verb stays until Andy rules on it — a node verb is not
  // removed without his yes — and answers the same question it always did,
  // who runs the relay at that url, now off the relay's card through
  // peerPost (goal/G22.4's "the hub asks peerPost for a relay's key").
  function handlePartnerCheck(req, res, readJsonBody, deps) {
    var router = deps && deps.router;
    readJsonBody(req).then(function (body) {
      var peerKey = String((body && body.publicKey) || '').trim();
      var url = String((body && body.url) || '').trim().replace(/\/+$/, '');
      if (!peerKey || !url) { fail(res, 400, 'publicKey and url required'); return; }

      var answer = function (obj) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(obj));
      };

      // ── IT ASKS WHO RUNS THE BOX, AND NOTHING ELSE (2026-09-18) ────
      //
      //   Andy: "when a cheat is identified, it must be eradicated."
      //
      // This read the whole roll of a relay this node has never been on
      // — every member, every label, every join date — to answer one
      // question about ONE key. It narrowed to `?key=` for a day, keeping
      // a whole-roll read on the refusal path so it could still name
      // the other owner.
      //
      // BOTH OF THOSE WERE THE ROLL. The relay's card carries `ownerKey`
      // and `ownerLabel` — asked for without asking for any membership.
      // One request, fixed cost, and this verb touches no roll on any path.
      //
      // THE CHECK IS UNCHANGED. "The key marked owner over there is the
      // key of the peer here" — a referral has to be verifiable (Andy),
      // and it still is, off the card the relay signs about itself.
      if (!router || typeof router.relayKey !== 'function') {
        answer({ ok: false, error: 'this node has no router to ask that relay with' });
        return;
      }
      router.relayKey(url)
        .then(function (said) {

          var ownerKey = String(said.ownerKey || '');
          if (!ownerKey) {
            answer({ ok: false, error: 'that relay has no owner yet — nobody has claimed it' });
            return;
          }
          if (ownerKey !== peerKey) {
            answer({
              ok: false,
              error: 'that relay is owned by somebody else (' +
                (said.ownerLabel || 'unlabelled') + ')',
            });
            return;
          }

          answer({
            ok: true,
            url: url,
            relayKey: said.relayPublicKey || '',
            relayLabel: said.relayLabel || '',
            ownerLabel: said.ownerLabel || '',
          });
        })
        .catch(function (err) {
          // A relay too old to answer the card ask, or one that is down.
          // Both are "this cannot be checked".
          answer({ ok: false, error: 'that relay did not say who runs it: ' + String((err && err.message) || err) });
        });
    }).catch(function () {
      fail(res, 400, 'bad body');
    });
  }

  // ── THE OWNER'S RELAY RECORD, READ (cycle 11's R6) ─────────────────
  //
  // `relay.status` above answers what a relay says about itself RIGHT
  // NOW. This answers what it has said over time, which is the thing
  // decision 0015 left open: "a monitor draws the current report; the
  // analysis Andy describes needs a SERIES."
  //
  // NOT KEY-GATED, exactly like `relay.status` beside it: this door is
  // loopback and everything behind it is the owner's own box. Whether it
  // should ALSO be gated by key is an open question in the cycle document
  // and is Andy's, not settled here by being built one way.
  //
  // `from` and `limit` are the caller's window. The default is a day,
  // because a monitor drawing a curve wants a day and a caller that wants
  // a year should say so — an unbounded default is how a read verb turns
  // into a table dump by accident.
  function handleRecord(req, res, readJsonBody, deps) {
    Promise.resolve()
      .then(function () { return readJsonBody(req); })
      .catch(function () { return {}; })
      .then(function (body) {
        const rootDir = (deps && deps.rootDir) || '';
        const relay = String((body && body.relay) || '');
        // ── A WINDOW, NEWEST FIRST, CUT IN BYTES (puppets/G2) ─────────
        //
        //   Andy, 2026-09-27: "the verb changes changing list fetches to a
        //   search(labe) and geKey(key) pair are approved", including:
        //   relay.record's list of relays folds into relay.search, and its
        //   series (from + limit) stops paging.
        //
        // So a relay must be named (relay.search finds them), and the
        // question is a window: from, to. The answer is the NEWEST rows in
        // it that fit one answer, in time order, and `more` says older
        // rows in the window were left out. The caller narrows the window;
        // nothing hands out a cursor.
        const from = Number(body && body.from) || (Date.now() - 24 * 60 * 60 * 1000);
        const to = Number(body && body.to) || Date.now();
        if (!relay) return fail(res, 400, 'relay required');
        let store = null;
        try { store = require('./nodeStore').open(rootDir); }
        catch (e) { return fail(res, 503, 'no record on this node'); }

        const WINDOW_ROWS = 5000;
        const newest = store.record.window(relay, from, to, WINDOW_ROWS);
        const cap = require('./limits').PLAINTEXT_MAX;
        const frame = Buffer.byteLength(JSON.stringify({ ok: true, relay: relay, from: from, to: to, series: [], more: false }), 'utf8');
        let used = frame;
        const kept = [];
        let cut = false;
        for (let i = 0; i < newest.length; i += 1) {
          const cost = Buffer.byteLength(JSON.stringify(newest[i]), 'utf8') + (kept.length ? 1 : 0);
          if (used + cost > cap) { cut = true; break; }
          used += cost;
          kept.push(newest[i]);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          ok: true, relay: relay, from: from, to: to,
          series: kept.reverse(),
          more: cut || newest.length === WINDOW_ROWS,
        }));
      })
      .catch(function (err) { fail(res, 500, String((err && err.message) || err)); });
  }

  function handleStatus(req, res, readJsonBody, deps) {
    Promise.resolve()
      .then(function () { return readJsonBody(req); })
      .catch(function () { return {}; })
      .then(function (body) { statusFor(res, (body && body.name) || '', deps); });
  }

  // ── relay.search / relay.get: HIS RELAYS, SEARCHED (puppets/G2) ──────
  //
  //   Andy, 2026-09-27, "go." on: "key = the relay's url, label = its name
  //   plus what's true of it, e.g. 'spirit-3 — yours, online', 'lab —
  //   member, offline'", and relay.get {url} answering one relay's full
  //   status.
  //
  // ── THE LIST ASKS NO RELAY (goal/G22.4) ─────────────────────────────
  //
  // Andy's decision: "The relay list (relay.get, relay.search) is a search
  // over the relays peerPost already knows, from its streams, with no call
  // to any relay. A relay peerPost has never met shows as not joined." And
  // peerPost owns every contact with a relay; the hub never touches one.
  //
  // It asked every listed relay for its card on each search (the probe,
  // through peerPost.relayKey, cached 3 s). Now each row is built from
  // what this node already holds, and nothing is fetched:
  //
  //   the row, its label, a refusal   the node's list (relayKeys.listed, node.db)
  //   online (status 200)             peerPost holds a stream to it (router.relaysHeld)
  //   owned                           it sent this node the report a relay sends
  //                                   only to its owner's key, which it does the
  //                                   moment the owner's stream opens (router.relayStatus)
  //   claimed                         owned, or a seat recorded at claim (relayKeys)
  //   roll.relayKey                   the key pinned for it (relayKeys.pinned)
  //   roll.myLabel, claimedLabel      the seat label recorded at claim
  //   roll.ownerKey, roll.owner       this node's key and seat label when owned
  //
  // The relay's own label (roll.relayLabel) is what its last card said, kept
  // by peerPost beside its services (labelOf, goal/G30.7), never fetched
  // here. Who owns a relay this node does not own (roll.ownerKey,
  // roll.owner) is not known here and is left empty.
  function relaySummary(router) {
    var me = auth.loadIdentity(rootDir);
    var held = Object.create(null);
    var reports = {};
    if (router && typeof router.relaysHeld === 'function') {
      router.relaysHeld().forEach(function (u) { held[ownerBadge.normalizeUrl(u)] = true; });
    }
    if (router && typeof router.relayStatus === 'function') reports = router.relayStatus() || {};
    var seated = Object.create(null);
    relayKeys.seatedUrls(rootDir).forEach(function (u) { seated[ownerBadge.normalizeUrl(u)] = true; });
    var rows = ownerBadge.loadRelays(rootDir).map(function (relay) {
      var url = relay.url;
      var row = { url: url, label: relay.label, status: held[url] ? 200 : 0, owned: !!reports[url] };
      // WHAT THE RELAY OFFERS (goal/G30.2), as its last card said, on every row, seated or not: Natter's claim screen
      // shows the email field only where services.sendMail is true. Read from what peerPost already knows, never
      // asked here (goal/G22.4: the relay list asks no relay).
      row.services = router && typeof router.servicesOf === 'function' ? router.servicesOf(url) : { sendMail: false, face: false };
      row.claimed = row.owned || !!seated[url];
      // A relay that refused this node holds no seat for it (goal/G19.1).
      if (relay.refused) {
        row.refused = relay.refused;
        row.claimed = false;
        row.owned = false;
      }
      if (row.claimed) {
        var seatLabel = relayKeys.seatLabel(rootDir, url);
        row.roll = {
          owner: row.owned ? seatLabel : '',
          ownerKey: row.owned ? me.publicKey : '',
          relayKey: relayKeys.pinned(rootDir, url),
          // The relay's own public label, as its card said (goal/G30.7).
          relayLabel: router && typeof router.labelOf === 'function' ? router.labelOf(url) : '',
          myLabel: seatLabel,
        };
        row.claimedLabel = seatLabel;
        // THE FACE THIS NODE HOLDS ON THAT RELAY (goal/G30.1), read from its row, so the info app shows it again after
        // a restart (Andy, 2026-10-19). Empty when none was confirmed.
        var face = relayKeys.faceOf(rootDir, url);
        row.face = face ? { name: face.name, email: face.email } : { name: '', email: '' };
      } else {
        row.error = 'no row here';
      }
      return row;
    });
    return Promise.resolve(ownerBadge.summarize(rows));
  }
  // ONE RELAY AS A ROW, JSON, as every shared search answers (goal/G30.7): the list search (listSearch.js) parses each
  // label as the row it paints. name is the list's label, or the host when it has none, never the whole url.
  // text keeps the label as ruled (Andy, 2026-09-27: "label = its name plus what's true of it, e.g. 'spirit-3 — yours,
  // online', 'lab — member, offline'"), inside the row now rather than as the whole label.
  function relayRow(row) {
    var who = row.refused ? 'refused this node' : (row.owned ? 'yours' : (row.claimed ? 'member' : 'not joined'));
    var name = row.label || String(row.url || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
    var up = row.status === 200 ? 'online' : 'offline';
    return { url: String(row.url || ''), name: name, text: name + ' — ' + who + ', ' + up, who: who, online: row.status === 200, owned: !!row.owned,
      claimed: !!row.claimed, refused: !!row.refused, relayLabel: (row.roll && row.roll.relayLabel) || '',
      // The relay's key, pinned at first contact (goal/G30.7): what the contact list matches a book row against.
      relayKey: relayKeys.pinned(rootDir, row.url) || '' };
  }

  // ── RANKED, NOT FILTERED (goal/G19.17) ──────────────────────────────
  //
  //   Andy, in the item: "we should have put in the new search thinggie for
  //   relay's" ; "add it."
  //
  // It matched its own way, where a '*'
  // never spans a '/': a relay whose label is its url, as a claim lists
  // one, was left out of Natter's list although relay.get found it. Now
  // it ranks as the desk's items.search does (desk.js, ranked(), goal/G18.5):
  // every listed relay is weighed with probabilityStringObjectMatch and
  // seated in a probabilityBucket, which orders them and cuts the answer
  // in bytes. No text (or only '*', what the page kernel asks) weighs
  // every relay 0, and the bucket keeps the node's list order.
  var probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
  var createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
  var RELAY_SEARCH_SCANNED = 1000;
  var RELAY_SEARCH_ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');

  function relaySearch(body, deps) {
    return relaySummary(deps && deps.router).then(function (summary) {
      var q = String((body && body.q) || '').trim();
      var text = /^\*+$/.test(q) ? '' : q;
      var bucket = createProbabilityBucket(RELAY_SEARCH_SCANNED);
      var more = false;
      for (var i = 0; i < summary.rows.length; i += 1) {
        if (i >= RELAY_SEARCH_SCANNED) { more = true; break; }
        var row = summary.rows[i];
        var shown = relayRow(row);
        var pair = { key: String(row.url), label: JSON.stringify(shown) };
        // One pair too big for the answer alone is skipped and said by more.
        if (Buffer.byteLength(JSON.stringify([pair]), 'utf8') > RELAY_SEARCH_ROOM) { more = true; continue; }
        bucket.seatFor(text ? probabilityStringObjectMatch(text, { label: shown.name, url: pair.key }) : 0, pair);
      }
      var r = bucket.serialize(null, RELAY_SEARCH_ROOM);
      // One fact about this node, never a row: it owns more than one relay
      // and has to pick which one it is known by.
      return { ok: true, status: 200, items: r.items, more: !!(r.more || more), mustPick: !!summary.mustPick,
        name: String((body && body.name) || '') };
    });
  }

  // ── relay.remove: ONE RELAY OFF THIS NODE'S LIST (goal/G16.3) ────────
  //
  //   Andy, 2026-10-10: "Q4: Do you approve two new commands on the node,
  //   list relays and remove relay, with a successful claim adding its
  //   relay? yes."
  //
  // The key is the url, the same key relay.search hands out. Refused when
  // it would leave no public relay (ownerBadge.canRemoveRelay), the rule
  // Natter's screen already obeyed.
  //
  // AND IT GIVES UP THE SEAT (goal/G19.1). Andy, 2026-10-12: "only the
  // node's user removes a relay, never the last one". The pin stays, so a
  // later claim there still knows who that relay is.
  // Owned is what the relay's owner report says, as relaySummary reads it (goal/G30.7: an owned relay stays listed).
  function relayRemove(body, deps) {
    var url = ownerBadge.normalizeUrl(String((body && body.key) || ''));
    var router = deps && deps.router;
    var reports = router && typeof router.relayStatus === 'function' ? (router.relayStatus() || {}) : {};
    var out = ownerBadge.removeRelay(rootDir, url, { owned: !!reports[url] });
    if (out.ok) {
      try { relayKeys.unseat(rootDir, out.key); }
      catch (e) { /* the relay is off the list; a seat left on disk is never probed */ }
    }
    return out;
  }

  // ── relay.add: ONE RELAY ONTO THIS NODE'S LIST (goal/G28.1) ──────────
  //
  //   Andy, 2026-10-16: "relay.add is approved." and "a relay shows in the list whether or not the node is a member;
  //   the green dot shows the connection status." A relay goes on the list when its card answers over peerPost, and
  //   nothing else lists it. Refused with a reason: an address that is not https (or loopback http), an empty or
  //   invalid private label, and a relay that gives no card.
  function relayAdd(body, deps) {
    var url = String((body && body.url) || '').trim().replace(/\/+$/, '');
    var label = String((body && body.label) || '').trim();
    if (!label) return Promise.resolve({ ok: false, status: 400, error: 'a label is required' });
    var labelBad = fieldRules.problem(label);
    if (labelBad) return Promise.resolve({ ok: false, status: 400, error: labelBad });
    try { assertRelayUrl(url); }
    catch (e) { return Promise.resolve({ ok: false, status: 400, error: e.message }); }
    if (!deps || !deps.router || typeof deps.router.relayKey !== 'function') {
      return Promise.resolve({ ok: false, status: 503, error: 'no router to ask the relay with' });
    }
    return deps.router.relayKey(url).then(function (card) {
      if (!relayKeys.list(rootDir, url, label, card.relayPublicKey)) {
        return { ok: false, status: 409, error: 'that relay could not be listed under its key' };
      }
      return { ok: true, status: 200, url: url, relayKey: card.relayPublicKey };
    }, function (e) {
      return { ok: false, status: 502, error: 'no card from that relay: ' + ((e && e.message) || 'no answer') };
    });
  }

  // ── relay.join: THIS NODE JOINS A RELAY BY ITS USER'S EMAIL (goal/G30.2) ──
  //
  //   Andy, 2026-10-19, confirmed: relay.join {url, email, code}, owner only, beside relay.add. With an email it
  //   sends join (the relay mails a link to this node's port); with a code, from that link, it sends joinConfirm and
  //   the seat is taken at once. The shell calls it with the email on first start, and with the code when it is
  //   opened at http://127.0.0.1:<port>?join=<code>.
  // The relay asked last is remembered in memory, so the link's code needs no url; a restart forgets it, and the
  // code then needs the url again. A seat taken is written down as a claim's is (relay list, seat, streams).
  var joinAskedOf = '';
  function relayJoin(body, deps) {
    var url = String((body && body.url) || '').trim().replace(/\/+$/, '') || (body && body.code ? joinAskedOf : '');
    var email = String((body && body.email) || '').trim();
    var code = String((body && body.code) || '').trim();
    var router = deps && deps.router;
    if (!url) return Promise.resolve({ ok: false, status: 400, error: 'which relay? give its url' });
    if (!email && !code) return Promise.resolve({ ok: false, status: 400, error: 'an email to ask with, or the code from the mail' });
    if (!router || typeof router.join !== 'function') return Promise.resolve({ ok: false, status: 503, error: 'this node has no router to join with' });
    var port = Number(deps && deps.port) || 0;
    // A router that throws before it answers (no route to the relay) is the same refusal as one that never answers.
    return Promise.resolve().then(function () { return router.join(url, email, port, code); }).then(function (said) {
      if (!code) {
        if (said.ok) joinAskedOf = url;
        return said.ok ? { ok: true, status: 200, url: url } : { ok: false, status: said.status || 502, error: said.error || 'the relay refused' };
      }
      if (!said.ok) return { ok: false, status: said.status || 502, error: said.error || 'the relay refused' };
      var label = String((said.peer && said.peer.publicLabel) || '');
      try { ownerBadge.addRelay(rootDir, url, '', said.relayPublicKey || ''); } catch (e) { /* the seat stands; listed on the next join */ }
      try { relayKeys.clearRefusal(rootDir, said.relayPublicKey || url); } catch (e) { /* read again on the next probe */ }
      try { relayKeys.seat(rootDir, url, label); } catch (e) { /* a boot can still backfill */ }
      // THE VERIFIED EMAIL (goal/G30.1, box v28): what the relay's confirm answered, kept on that relay's row, where
      // natterDetails reads "Add" or "Change email address" from.
      if (said.email) { try { relayKeys.keepEmail(rootDir, url, said.email, said.emailVerified === true); } catch (e) { /* the relay holds it; the next change writes it here */ } }
      if (deps.probe) { try { router.startStreams(deps.probe); } catch (e) { /* the next boot connects */ } }
      joinAskedOf = '';
      // The relay's 200 is an email change on a seat already held, its 201 a new seat (goal/G30.1, box v31): passed
      // on, so the page says Email address verified or Joined.
      return { ok: true, status: said.status === 200 ? 200 : 201, url: url, label: label };
    }, function (e) {
      return { ok: false, status: 502, error: 'no answer from that relay: ' + ((e && e.message) || 'no answer') };
    });
  }

  // ── THE JOIN AT START: node spirit/server.js --email <address> (goal/G30.2) ──
  //
  // The box: while the node holds no seat it asks its kept relay to join with that email and the port it listens on;
  // with a seat, --email does nothing. An email is never required (invites stay a way in). It answers the lines
  // server.js prints before its listening line: that a mail will arrive shortly, or why the join did not start, in a
  // message that names the relay, what went wrong and what to do next (Andy: "i prefer high-quality error messages").
  // It asks by relayJoin, the path relay.join takes, so the link's code finishes the join as it does from Natter.
  var JOIN_NEXT = {
    400: 'Correct the address and start the node again with --email <address>.',
    409: 'This node already holds a seat there; start it without --email.',
    429: 'Wait a minute, then start the node again.',
    502: 'Check the network, then start the node again.',
    503: 'This relay takes no join by email: ask its owner for an invite and claim a seat with it in Natter.',
    507: 'Ask its owner for room, or join another relay from Natter.',
  };
  function joinAtStart(email, deps) {
    var mail = String(email || '').trim();
    if (!mail) return Promise.resolve({ lines: [] });
    var seated = [];
    try { seated = relayKeys.seatedUrls(rootDir); } catch (e) { seated = []; }
    if (seated.length) return Promise.resolve({ lines: [] });
    var url = String((deps && deps.keptUrl) || ownerBadge.KEPT_RELAY.url).replace(/\/+$/, '');
    var host = url.replace(/^https?:\/\//, '');
    function refusedLine(status, why) { return { lines: [host + ' did not start the join: ' + why + '. ' + (JOIN_NEXT[status] || 'Start the node again, or join a relay from Natter.')] }; }
    // THE CARD FIRST (goal/G30.2): a relay whose card does not say services.sendMail takes no join by email, so the
    // node says so without asking it to join.
    var router = deps && deps.router;
    var card = router && typeof router.relayKey === 'function'
      ? Promise.resolve().then(function () { return router.relayKey(url); })
      : Promise.resolve(null);
    return card.then(function (c) {
      if (c && !(c.services && c.services.sendMail === true)) return refusedLine(503, 'this relay sends no mail, so it takes no join');
      return askJoin();
    }, function (e) {
      return refusedLine(502, 'no answer from that relay: ' + ((e && e.message) || 'no answer'));
    });
    function askJoin() {
      return relayJoin({ url: url, email: mail }, deps).then(function (said) {
        if (said.ok) {
          return { lines: ['A mail to ' + mail + ' will arrive shortly from ' + host + '. Open its link on this computer within 10 minutes to connect this node to the network.'] };
        }
        return refusedLine(said.status, said.error || 'it refused');
      });
    }
  }

  // ── relay.face: THIS NODE APPLIES TO ONE RELAY FOR A FACE NAME (goal/G30.1) ──
  //
  //   Andy, 2026-10-19: "the node, already connected as member on a relay, applies to the relay for a
  //   DNS-segment-name, with a call that includes the asked-for face-name and an email, this is a normal peerPost
  //   to the relay itself, and it succeeds or not." and "i agree to the node side verb as well."
  // The post leaves by the one door (sendPacket). The relay's answer is kept whole on that relay's row by
  // peerPost.js (keepFaceAnswer) before it comes back here, so this only reports it. Asking again replaces the pair.
  function relayFace(body, deps) {
    var url = String((body && body.url) || '').trim().replace(/\/+$/, '');
    var name = String((body && body.name) || '').trim();
    // NO EMAIL IN THE ASK (goal/G30.1, box v30, Andy: "the email must be dropped from the verb relay.face"): the
    // relay pairs the name with the verified email it holds for this node's key, and answers the pair.
    if (!url || !name) return Promise.resolve({ ok: false, status: 400, error: 'a relay url and a face name are required' });
    if (!deps || !deps.router) return Promise.resolve({ ok: false, status: 503, error: 'no router to ask the relay with' });
    var row = relayKeys.byUrl(rootDir, url);
    if (!row) return Promise.resolve({ ok: false, status: 404, error: 'that relay is not on this node\'s list' });
    var made = packet.encode('relay', { face: { name: name } });
    if (!made || !made.ok) return Promise.resolve({ ok: false, status: 500, error: 'the application could not be encoded' });
    return sendPacket(deps.router, row.url, row.key, made.text).then(function (answer) {
      if (!answer || !answer.ok) return { ok: false, status: (answer && answer.status) || 502, error: (answer && answer.error) || 'the relay did not answer' };
      var said = null;
      try { said = (packet.decode(answer.text) || {}).body; } catch (e) { said = null; }
      if (!said || typeof said !== 'object') return { ok: false, status: 502, error: 'the relay answered something this node cannot read' };
      if (said.ok !== true) return { ok: false, status: said.status || 400, error: said.error || 'the relay refused' };
      return { ok: true, status: 200, url: row.url, name: said.name, email: said.email };
    }, function (e) {
      return { ok: false, status: 502, error: 'no answer from that relay: ' + ((e && e.message) || 'no answer') };
    });
  }

  function relayGet(body, deps) {
    var key = String((body && body.key) || '');
    if (!key) return Promise.resolve({ ok: false, status: 400, error: 'key required' });
    return relaySummary(deps && deps.router).then(function (summary) {
      var row = summary.rows.filter(function (r) { return r.url === key; })[0];
      if (!row) return { ok: false, status: 404, error: 'no such relay' };
      // The email this node's join confirmed there (goal/G30.1), for natterDetails' email form.
      var held = relayKeys.emailOf(rootDir, key);
      row = Object.assign({}, row, { email: held.email, emailVerified: held.verified });
      var reports = (deps && deps.router && deps.router.relayStatus) ? deps.router.relayStatus() : {};
      return require('./limits').boundedGet({ ok: true, status: 200, key: key, relay: row,
        report: reports[key] || null });
    });
  }

  function statusFor(res, name, deps) {
    // THE KEY, and since R3 it is the only thing probe asks with.
    //
    // It was once possible to call this WITHOUT a key and still get
    // `owned`, because owning was decided by a signed status 200 and only
    // `claimed` needed a roll match. That asymmetry cost a real bug —
    // three arguments here meant `claimed` was never set on any row, and
    // Natter's `owned || claimed` quietly collapsed to `owned`, so every
    // relay this node was merely BOUND to drew no panel at all. The same
    // omission the device timer above carries a comment about: "the whole
    // feature stopped at the owner for want of one word."
    //
    // The asymmetry is gone rather than fixed twice. Both answers come
    // from the roll, by key, so a caller without a key gets nothing —
    // which is the truth, and is now unmistakable.
    //
    // `name` no longer travels at all: it was there to sign a LABEL to
    // prove a KEY owned a box (ownerBadge, statusPath). It is still read
    // off the body above, because it is echoed back to the browser as
    // `name` below and Natter uses it as the label to display.
    var me = auth.loadIdentity(rootDir);
    ownerBadge.probe(rootDir, relayKeyAsk(deps && deps.router), me.publicKey)
      .then(function (summary) {
        // The roster sweep that rode this probe is gone (2026-09-19) — see
        // the note where reconcileMembers stood.

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          name: name,
          rows: summary.rows,
          ownedUrls: summary.ownedUrls,
          // The rows this node HAS, owned or not — the set Natter opens a
          // panel for. Already computed by summarize() and simply never
          // sent, so the browser had to infer it and could not.
          claimedUrls: summary.claimedUrls,
          mustPick: summary.mustPick,
          // WHAT EACH OWNED RELAY LAST SAID ABOUT ITSELF, pushed down
          // the stream rather than asked for. Everything else on this
          // response was fetched by probe() making requests; this was
          // already here when the question arrived.
          //
          // Keyed by relay url, and ABSENT rather than empty for a relay
          // that has not reported. The two look identical to a careless
          // reader and mean very different things — "not told yet"
          // versus "told me nothing" — so a monitor must not draw zeros
          // for a relay that has simply not spoken.
          relayStatus: (deps && deps.router && deps.router.relayStatus)
            ? deps.router.relayStatus()
            : {},
        }));
      })
      .catch(function (err) { fail(res, 502, String(err.message || err)); });
  }

  return {
    // THE OWNER'S COMMAND PATH. Sends only; nothing receives it until the
    // stored owner key, the switch and the shim exist. PUPPETS.md G4.
    peerOwnerPost: peerOwnerPost,
    handleClaim: handleClaim,
    // The transport. handleSend and handleInbox stood beside it while
    // there were two, listed together so that was visible; R8 deleted the
    // other one and this is what a node has.
    handlePost: handlePost,
    // The one place that decides where a post goes, shared with
    // peerOwnerPost (ownerPost.js) rather than decided twice.
    chooseRoute: chooseRoute,
    handleStatus: handleStatus,
    relaySearch: relaySearch,
    relayRemove: relayRemove,
    relayAdd: relayAdd,
    relayFace: relayFace,
    relayJoin: relayJoin,
    joinAtStart: joinAtStart,
    relayGet: relayGet,
    handleRecord: handleRecord,
    handlePartnerCheck: handlePartnerCheck,
    contactSearch: contactSearch,
    contactGet: contactGet,
    handleContact: handleContact,
    handlePeer: handlePeer,
    // handleInvite, handleRemovePeer, handleRename and handleRevoke were
    // exported here. Every one of them is a peerPost the browser makes
    // for itself now — see the note where they stood.
    handleUnknownSenders: handleUnknownSenders,
    handleSendersRead: handleSendersRead,
    handleNodeCard: handleNodeCard,
    adoptClaim: adoptClaim,
    handleNodeName: handleNodeName,
    handleNodeDescription: handleNodeDescription,
    contactRenames: contactRenames,
  };
}

module.exports = {
  createHub: createHub,
  // This node's outbound request to a relay, with the URL assertion that
  // goes with it. Exported for presenceNode, which needs the same
  // primitive to probe which relays it holds a row on and must not grow
  // a second one that asserts less.
  relayRequest: relayRequest,
  // THE SEALED CLAIM (sealedClaim) was exported here; it is peerPost.claim
  // since goal/G22.6, on the relay's one door.
  // A relay's key, asked through the node's router (peerPost.relayKey), in
  // the { status, text } shape ownerBadge.probe and presenceNode.start ask
  // with (goal/G22.6).
  relayKeyAsk: relayKeyAsk,
  buildPeople: buildPeople,
  contactLabel: contactLabel,
  searchPeople: searchPeople,
  // The node's own judgement about who it will hear from, exported for
  // the same reason relayRequest is: peerPost needs it and must not grow
  // a second answer to the same question.
  frontDoor: frontDoor,
  remember: remember,
  // ONE CACHE, for the reason `remember` and `frontDoor` are here: a
  // second instance would be a second answer to the same question, and
  // the half that learned something would not be the half that is asked.
  // server.js feeds it from route announcements.
  shadow: shadow,
  learnPresence: learnPresence,
  // Listed ONCE. It was here twice — same key, same value, one shadowing
  // the other in the same object literal — which is what an export block
  // that grew by accretion does. Spotted while deleting the six ring
  // exports that surrounded it (R8).
  unknownPolicy: unknownPolicy,
};
