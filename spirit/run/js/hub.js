'use strict';

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const auth = require('./relayAuth');
const invites = require('./invites');
const ownerBadge = require('./ownerBadge');
const contactBook = require('./contacts');
const relayKeys = require('./relayKeys');
const peerFile = require('./peerFile');
const peerStats = require('./peerStats');
const deviceAuth = require('./deviceAuth');
// What this node says about itself — the same two fields a stranger is
// answered with, so the screen that edits them and the wire that sends
// them cannot drift.
const nodeCard = require('./nodeCard');

// isLoopbackHost, assertRelayUrl and relayRequest MOVED to
// js/relayRequest.js on 2026-09-16. They were the node's outbound socket
// living inside the node's hub, which meant a relay could not reach the
// one interface AGENT.md says everything must use without requiring the
// node's machinery — and the only ways out of that are to reach for `http`
// directly or to go without. Both are the rule being broken.
//
// Re-exported below, unchanged, so every existing caller is untouched.
const wire = require('./relayRequest');
const assertRelayUrl = wire.assertRelayUrl;
const relayRequest = wire.relayRequest;

// The invite is forwarded, never minted here — a token this node made up
// would not be in the relay's invites.json. Minting is cycle 2.
// `name` is what this node wants to be CALLED. `inviteLabel` is the word
// the relay owner wrote on the invite — spoken down a phone, matched at
// the far end, and never stored (R1,
// design/cycles/2026-09-15-labels-are-not-identities.md).
//
// The signature covers `name` and only `name`, because a signature here
// binds this KEY to that public label. The invite label proves a
// different thing — that this is the person the owner meant — and it
// proves it by being held, the way the token is.
//
// SENT WHENEVER THERE IS A TOKEN, even when it matches `name`. It was
// omitted in that case for a few hours, because the relay fell back —
// and the relay does not fall back any more:
//
//   Andy: "i dislike a relay supporting stale nodes at this point the
//   nodes should break rather than STILL having code on a relay that
//   support old crap"
//
// So the two travel together or the claim is refused, which is also what
// they do in the world: the owner reads a token and a word down the same
// phone call.
function signedClaim(rootDir, name, invite, inviteLabel) {
  const id = auth.ensureIdentity(rootDir, name);
  // AND THE OTHER HALF OF THE CARD, at the one moment a node can have
  // been booted without a key to describe.
  //
  //   Andy: "the node assigns the first name when redeeming an invite.
  //   but on boot: the node should fill the description."
  //
  // Both are true and neither alone is enough. server.js fills the gap on
  // every boot, but `ensureIdentity` above is where a fresh node's key
  // comes into existence — after that boot ran — so a node minted by its
  // first claim would answer a blank card until somebody restarted it.
  // That is exactly the window this whole thing exists to close, and it
  // is the window every NEW node passes through.
  try { nodeCard.ensureDescription(rootDir); }
  catch (e) { /* a caption must never be the reason a claim fails */ }
  const body = {
    name: name,
    publicKey: id.publicKey,
    sig: auth.sign(id.privateKey, auth.claimMessage(name)),
  };
  if (invite) body.invite = invite;
  const onInvite = String(inviteLabel == null ? '' : inviteLabel).trim();
  if (onInvite) body.inviteLabel = onInvite;
  return body;
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
  parsed.mine = !!(id && id.publicKey && peer && peer.publicKey === id.publicKey);
  return JSON.stringify(parsed);
}

// Claim, send and inbox still speak to the first Natter row: one browser,
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
var PEER_FILE_ROOT = 'app';
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
// CONTACTS, not the census. Everyone who ever claimed on a public
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
// The census is still walked, because it is what keeps a contact's
// public caption and its routes current — but handshake only ever
// updates, never promotes. Nobody enters the To list by appearing on a
// mailbox.
function buildPeople(rootDir, peers, relayUrl) {
  var census = Object.create(null);
  (Array.isArray(peers) ? peers : [])
    .filter(function (p) { return p && p.publicKey; })
    .forEach(function (p) {
      contactBook.handshake(rootDir, {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || '',
        relay: relayUrl,
      });
      census[p.publicKey] = p;
    });

  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';

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
      var seen = census[row.publicKey];
      var stats = peerStats.readSummary(rootDir, row.publicKey);
      return {
        publicKey: row.publicKey,
        // The end of the key, from the one rule that decides what a tail
        // is (keyTail below) — the same field /api/hub/handle already
        // sends with a match. An app that needs to tell two rows apart
        // must not carve its own out of the key: a fourth copy of "six
        // from the end" is a fourth thing to get wrong.
        tail: keyTail(row.publicKey),
        publicLabel: (seen && seen.publicLabel) || row.publicLabel || '',
        caption: contactBook.labelForKey(rootDir, row.publicKey, row.publicLabel || ''),
        // The raw one, beside the resolved caption: an editor has to
        // show what is stored, not what is shown, or clearing the field
        // would look like clearing the name.
        myLabel: row.myLabel || '',
        acquiredVia: contactBook.acquiredVia(row),
        // ── SEATS ON RELAYS THIS NODE OWNS ─────────────────────────────
        //
        //   Andy: "as user it becomes very confusing to understand my
        //   relationship with this peer (ID)."
        //
        // `acquiredVia` is HISTORY — how this row got here. This is a
        // STANDING fact: they hold a seat on a box I keep, right now. The
        // two are different questions and a screen that showed only the
        // first could not explain why Forget refuses.
        //
        // A list, because one person may be seated on several of my
        // relays, and empty for everybody else — which is every row on a
        // node that owns nothing.
        memberOf: contactBook.memberOf(row),
        // WHEN THIS NODE FIRST FOUND THE KEY ON NO CENSUS, or ''. The
        // warning a screen draws from it must say "first noticed", not
        // "went": nothing watched before the conclusion was possible.
        missingSince: contactBook.missingSince(row),
        // One question the app asks about every row: may this be written
        // to? Held and blocked both answer no, and they are drawn the
        // same way — a × and no composer — because to the person looking
        // at the list they are the same fact.
        held: !contactBook.listens(row),
        blocked: contactBook.isBlocked(row),
        // Whether this contact has a row on the relay this node is pointed at
        // right now. A contact you acquired elsewhere is still a contact;
        // it just has nowhere to be written to from here.
        onRelay: !!seen,
        owner: !!(seen && seen.owner),
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
  // the caption carries a piece of the key. The TAIL: every Ed25519 SPKI
  // key opens with the same ASN.1 header, so a fragment from the front
  // would distinguish nothing.
  var seenCaption = Object.create(null);
  rows.forEach(function (r) { seenCaption[r.caption] = (seenCaption[r.caption] || 0) + 1; });
  rows.forEach(function (r) {
    if (seenCaption[r.caption] > 1) {
      r.caption = r.caption + ' (' + keyTail(r.publicKey) + ')';
      r.ambiguous = true;
    }
  });

  rows.sort(function (a, b) { return String(a.caption).localeCompare(String(b.caption)); });
  return rows;
}

// The end of a key, for a human to read down a telephone. From the END
// on purpose: every Ed25519 SPKI key opens with the same ASN.1 header,
// so a fragment from the front names every peer on every mailbox
// equally. Six characters is what buildPeople already uses to tell two
// johns apart. It said "and relayConsole uses the same rule from its own
// copy" until 2026-09-17; that app is gone and so is the copy, so this
// is the only definition of the rule now.
//
// ── IT IS NOT SPOKEN-SAFE, AND IT IS MEANT TO BE SPOKEN ──────────────
//
//   Andy, reading Contacts' own footer: "Being added yourself? Your key
//   ends …XD+0c= — that is what to tell them."
//
// Six characters of SPKI base64, and the last is ALWAYS `=`: 44 bytes
// does not divide by three, so every Ed25519 key in existence ends in
// padding. Five characters of information wearing six. The rest carries
// `+` and `/` at random, is case-sensitive, and keeps 0/O and 1/l/I as
// distinct symbols — over a telephone, which is the stated use.
//
// This repo already has the bar it misses: `spokenOk`, the invite-label
// rule, is exactly "a string a person will say out loud".
//
// The fix is to take the last 30 bits of the KEY'S BYTES (not of its
// base64, which makes the tail a property of the encoding) and render
// them in Crockford base32 — same collision resistance, no `+` or `/`,
// no case, and I/L/O/U excluded so nothing is mistakable. Not done here:
// it changes every tail anybody has already written down, which is a
// one-time cost worth taking deliberately rather than inside a commit
// about something else.
function keyTail(publicKey) {
  return String(publicKey || '').slice(-6);
}

// Every peer on the mailbox whose PUBLIC LABEL is the handle a human
// heard. Not a search: an exact caption, case-insensitively, because a
// handle is a word somebody said out loud and a substring match would
// hand back strangers who merely contain it.
//
// Two johns are two candidates, and stay two. Nothing here picks one:
// picking is the human's job, done against a key tail on a phone call,
// which is what makes this an acquisition rather than a guess.
// ── NO CALLER IN run/ SINCE peer.find WENT (2026-09-17) ──────────────
//
// `findHandle` was its only one. chatPeople.js still asserts it in six
// places, which is the shape sseClient.js warns about — "a module
// widening its surface for a test's convenience", and "a dead export is
// the same promise made to nobody."
//
// Left standing on purpose, not by omission: it is the only place the
// two-johns rule is written down as code, and whether ranked search has
// genuinely absorbed that — exact-label matching, key tails, and the
// contactBook cross-reference that says "already a contact" — is a question
// for whoever moves the last census reader, not something to settle by
// deleting the tested version first.
function handleMatches(rootDir, peers, handle) {
  var want = String(handle || '').trim().toLowerCase();
  if (!want) return [];
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';

  return (Array.isArray(peers) ? peers : [])
    .filter(function (p) { return p && p.publicKey && p.publicKey !== myKey; })
    .filter(function (p) {
      return String(p.publicLabel || '').trim().toLowerCase() === want;
    })
    .map(function (p) {
      var row = contactBook.byPublicKey(rootDir, p.publicKey);
      return {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || '',
        tail: keyTail(p.publicKey),
        // What this node already thinks of them, so the UI can say
        // "already a contact" instead of offering the same person twice.
        acquiredVia: row ? contactBook.acquiredVia(row) : null,
        owner: !!p.owner,
      };
    });
}

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
// acquires with an empty label and the census
// (`/api/hub/who` → contactBook) is what fills the caption in. A contact
// acquired by being written to is briefly unlabelled where it used to be
// named on arrival.

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
// was wrong twice over (Andy: "app/contacts/prefs.json is the wrong place
// for that file, it's a node-global").
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
  var id = auth.loadIdentity(rootDir);
  if (id && id.publicKey) allowed[id.publicKey] = true;
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
// traffic never travelled. This is not that path: a relay posts here in
// its own name to carry a device enrolment, and a relay is not a contact
// — its key is in no contactBook. relayKeys.js is what makes that answerable
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

  // Itself and everyone it has acquired — the same set the inbox uses,
  // asked here for the first time.
  //
  // "Acquired" is narrower than "on record", deliberately: contactBook's
  // ACQUIRED_LISTENING is ['message', 'invite', 'handle'], so somebody
  // merely SEEN in a relay's census is not somebody this node agreed to
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
// matters because ACQUIRED_LISTENING contains 'message' and not 'census',
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
// line now, and a post carries keys and no captions. The census fills the
// caption in afterwards (`/api/hub/who` → contactBook), so a contact acquired
// by being written to is briefly unlabelled where it used to be named on
// arrival. That is the cost of the relay not reading the payload, which
// is the point rather than a regression.
function remember(rootDir, from, verdict, relayUrl) {
  var key = String(from == null ? '' : from).trim();
  if (!key) return false;
  var road = String(relayUrl == null ? '' : relayUrl).trim();
  var row = { publicKey: key, publicLabel: '', relays: [] };
  if (road) row.relay = road;
  try {
    if (verdict === 'admit') {
      contactBook.acquire(rootDir, row, 'message');
      return true;
    }
    if (verdict === 'hold') {
      contactBook.hold(rootDir, row);
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

  function withRelay(res, fn) {
    var url = loadRelayUrl(rootDir);
    if (!url) {
      fail(res, 503, 'no relay url in app/natter/relays.json');
      return;
    }
    try { assertRelayUrl(url); }
    catch (e) {
      fail(res, 503, String(e.message || e));
      return;
    }
    return guarded(res, url, fn);
  }

  // The mailbox a mint is aimed at. Same scheme check withRelay does, so
  // a plain-http row in Natter is refused here rather than at the socket.
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
    // guarded for the same reason withRelay is: see there.
    return guarded(res, chosen.url, fn);
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
  // decided this for three other doors since invites landed. A url that
  // is on no Natter list is refused there, so a stale tab cannot aim a
  // signed claim at a relay this node does not list. With nothing wanted
  // it still falls back to the only row when there is only one, which is
  // exactly what every existing caller relied on.
  // ── AND A NODE THAT JUST CLAIMED MUST CONNECT ────────────────────────
  //
  //   Andy: "now i have a new 'Jazzy Alexandra' and she's bound to
  //   spirit-3 but she cannot find anybody in contacts" — "her relay
  //   shows green."
  //
  // She had no `relay-presence` job at all. presenceNode.start returns at
  // its first line when the node has no identity, and a brand-new node
  // has none: it boots empty, and the key is minted by THIS function, at
  // the first claim. Nothing ever started presence again, so the node sat
  // there enrolled and unconnected until somebody restarted it.
  //
  // EVERY NEW NODE GOES THROUGH EXACTLY THAT SEQUENCE. Boot, claim,
  // nothing. It could not search, could not be posted to, and could not
  // receive — while looking bound, because the badge is read off the
  // public census and `claimed` means "you have a row here", not "you are
  // connected". Green was telling the truth about a different question.
  //
  // `presence.start` is safe to call again: it creates its job only if it
  // has none and openTo returns early for a url it already holds. So this
  // is "make sure", not "restart".
  function handleClaim(req, res, readJsonBody, deps) {
    var presence = deps && deps.presence;
    var probe = deps && deps.probe;
    readJsonBody(req).then(function (body) {
      withChosenRelay(res, body && body.url, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(
          rootDir,
          body && body.name,
          body && body.invite,
          body && body.inviteLabel
        ))
          .then(function (r) {
            // AFTER THE ANSWER IS WRITTEN, never before: a claim that
            // worked must be reported even if opening a stream does not,
            // and connecting is not what the caller asked about.
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(markMine(rootDir, r.text));

            if (r.status >= 200 && r.status < 300) {
              // ── WRITE THE SEAT DOWN, HERE, WHERE IT IS KNOWN ────────
              //
              // Everything needed is in hand at this instant: the url, the
              // label asked for, and a 2xx saying it was granted. Until
              // 2026-09-18 none of it was recorded, so every subsequent
              // boot re-derived it by fetching the relay's ENTIRE
              // membership and looking for itself (ownerBadge.probe) — the
              // last census read in the tree, and the only one that was
              // not a question about other people.
              //
              //   Andy: "persist necessary information at claim time,
              //   re-use that information on boot."
              //
              // Before the stream, not after: a claim that worked is a
              // seat held whether or not connecting succeeds, and the next
              // boot must know that without asking.
              try { relayKeys.seat(rootDir, url, (body && body.name) || ''); }
              catch (e) { /* the claim stands; a boot can still backfill */ }

              if (presence && probe) {
                try { presence.start(probe); }
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
  function handlePost(req, res, readJsonBody, deps) {
    var router = deps && deps.router;
    var presence = deps && deps.presence;

    // RETURNED, unlike the older handlers beside it, which fire and
    // forget. server.js ignores it; a suite awaits it. A handler whose
    // completion cannot be observed can only be tested by sleeping, and
    // a test that sleeps is a test that will one day be flaky on a
    // slower machine.
    return readJsonBody(req).then(function (body) {
      if (!router || !presence) {
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
      var wanted = String((body && body.via) || '').trim();
      var where = presence.relaysNaming(to).filter(function (url) {
        return !wanted || url === wanted;
      });

      // Posting to a relay itself needs nothing special here. Its own
      // key is in the OWNER's roster and in no peer's (relay.streamRoster),
      // so presence answers for it exactly as for any peer — which is why
      // the per-recipient roster was the right place for this and a
      // lookup table in this function was not.
      if (!where.length) {
        // Truthfully, and at once. Presence is what makes this
        // answerable rather than a guess — and it is why that arc had
        // to come first.
        fail(res, 503, 'that peer is not reachable right now');
        return;
      }
      return sendPacket(router, where[0], to, text).then(function (answer) {
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
  // A NEW DOOR PASSWORD. POST only: this changes something, and a GET
  // that rotated a secret would fire on a page reload.
  //
  // It answers with the new password, because the caller is this node's
  // own loopback browser and the whole point is to put it on somebody's
  // clipboard. Nothing else on this box hands a secret back, and it is
  // worth being explicit that this one does and why.
  //
  // WHAT IT DOES NOT DO is detach a device already attached — that is
  // revocation, a different verb, and this route performs one of the two.
  // The answer says so, so a caller cannot build a "remove my devices"
  // button on top of it by accident.
  function handleRotatePassword(req, res, readJsonBody) {
    readJsonBody(req).then(function () {
      var doc = deviceAuth.rotatePassword(rootDir);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        password: doc.password,
        // Said out loud in the answer rather than left to the caller to
        // know: every request depending on the old password is now
        // refused, and any device already attached is still attached.
        //
        // SO THIS IS NOT THE RED BUTTON, and the field exists to stop
        // anybody believing it is. Rotating shuts the DOOR; it does not
        // touch the devices already inside, on this node or on any relay.
        //
        // Nothing detaches a device today. setDevicePublicKey(root, null)
        // would clear this node's own record and is never called with
        // null; the relays hold the key independently; and relay's
        // installDevice refuses an empty key, so "forget my device" is
        // not expressible as a request. See the note on the one-slot rule
        // in relay.js for the shape the button will need.
        devicesDetached: false,
        devicePublicKey: doc.devicePublicKey || '',
      }));
    }).catch(function () {
      fail(res, 400, 'bad body');
    });
  }

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
  // GET /api/hub/who — the mailbox's peers, captioned by this node.
  // Unsigned, like the relay route it forwards: `who` is public on the
  // mailbox (isRelayPublicPath, server.js), and the captions it comes
  // back with never leave this machine.
  function handleWho(req, res) {
    withRelay(res, function (url) {
      // ── THE ADDRESS BOOK IS LOCAL, AND ALWAYS WAS (2026-09-18) ──────
      //
      //   Andy: "there is absolutely no reason for unbound entities to
      //   conduct surveys of our network." — and on the packet ceiling
      //   blocking the census's demotion: "that's the point, so bound
      //   entities now MUST use alternate interfaces: easy!"
      //
      // This fetched the whole census of the relay to answer a question
      // about THIS NODE'S OWN BOOK. Every field below is on disk:
      //
      //   relay             relays.json
      //   relayPublicKey    the pin (relayKeys), written at stream open
      //   selfPublicKey     this node's identity
      //   people            contactBook.addressBook — buildPeople reads it
      //
      // WHAT THE CENSUS WAS DOING HERE, and neither is worth a request:
      //
      //   1. A fresher `publicLabel` fallback. The caption a person
      //      actually sees comes from contactBook.labelForKey, locally, and
      //      prefers the name they typed. A relay's idea of somebody's
      //      label reaches this node through peer.acquire, search results
      //      and arriving packets — all of which carry it for the one
      //      person concerned.
      //
      //   2. `contactBook.handshake` on EVERY member of the relay, which
      //      recorded each of them here as a `census`-rank row. That is
      //      not a side effect worth keeping: it is this node building a
      //      copy of the membership, on every refresh of its own contact
      //      list, for people it has never spoken to. The rank was
      //      already outside ACQUIRED_LISTENING — "having noticed a
      //      stranger exists is not an introduction" — so nothing was
      //      gained by the rows except bytes.
      //
      // A survey by a bound entity is still a survey.
      var self = auth.loadIdentity(rootDir);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        relay: url,
        // Null before this node has ever opened a stream to that relay.
        // The app already treats null as "no log for this row" rather
        // than inventing a name for it, which is the same handling it
        // needed when a relay had not yet grown a key of its own.
        relayPublicKey: relayKeys.pinned(rootDir, url) || null,
        selfPublicKey: (self && self.publicKey) || null,
        selfTail: self && self.publicKey ? keyTail(self.publicKey) : null,
        // No census rows. `buildPeople` already took an empty list as a
        // legitimate argument — chatPeople.js drives it that way
        // throughout — because the book was never built out of the wire.
        people: buildPeople(rootDir, [], url),
      }));
    });
  }

  // ── peer.find STOOD HERE (handleHandle / findHandle), DELETED ──────
  //     2026-09-17
  //
  //   Andy: "handles are not used in keyed mode by definition."
  //
  // It fetched the whole census from `urls[0]` and filtered it down to
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
  // `handleMatches` above is what this called and is NOT deleted with
  // it — see the note there.

  // POST /api/hub/contact — a human confirmed one of those candidates.
  //
  // The key is checked against the census before it is written: a stale
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
      var id = auth.loadIdentity(rootDir);
      if (id && id.publicKey === publicKey) {
        fail(res, 400, 'that key is this node');
        return;
      }
      // Blocking somebody this node has no row for is a real case: they
      // are in the census, they have been picked in the list, and they
      // have never been acquired. A row is made so the block has
      // somewhere to live and somewhere to be undone from.
      if (action === 'block' && !contactBook.byPublicKey(rootDir, publicKey)) {
        contactBook.hold(rootDir, { publicKey: publicKey, publicLabel: String((body && body.publicLabel) || '') });
      }
      // What YOU call that key. Never uploaded, never seen by the peer,
      // and the reason contactBook keeps publicLabel separate: the mailbox's
      // caption is theirs and can change under you, this one is yours.
      if (action === 'label') {
        var row = contactBook.setMyLabel(rootDir, publicKey, String((body && body.myLabel) || ''));
        if (!row) { fail(res, 404, 'no row for that key'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: row.publicKey,
          myLabel: row.myLabel || '',
          caption: contactBook.labelForKey(rootDir, publicKey, row.publicLabel || ''),
        }));
        return;
      }

      // FORGETTING IS NOT BLOCKING, and answers a different shape: there
      // may be no row left to describe. contactBook keeps a blocked row and
      // only downgrades it — deleting one would readmit the person the
      // moment they wrote, because the row IS the refusal.
      if (action === 'forget') {
        // ── A SEAT ON MY OWN RELAY OUTRANKS A FORGET ──────────────────
        //
        //   Andy: "undeletable until i agree to also remove their relay
        //   slots."
        //
        // Refused, and the refusal NAMES THE RELAYS — the caller cannot
        // offer "remove their seat as well" without knowing which seats.
        //
        // ASKED OF A LOCAL FIELD, never of the network. A permission that
        // probes is a permission that fails when the box is down, and
        // ownerBadge.canRemoveRelay already argues at length why a live
        // fact has no business in one: it would lock the door of the room
        // it just set on fire. `memberOf` is written by the reconcile and
        // read here, so this answers the same whether anything is
        // reachable or not.
        var held = contactBook.byPublicKey(rootDir, publicKey);
        if (held && contactBook.isMember(held)) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: false,
            error: 'they hold a seat on a relay you own',
            memberOf: contactBook.memberOf(held),
          }));
          return;
        }

        var gone = contactBook.forget(rootDir, publicKey);
        if (!gone) { fail(res, 404, 'no row for that key'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: publicKey,
          forgotten: !!gone.forgotten,
          // Said plainly rather than implied: a blocked person is still
          // blocked, and a person on a relay you are on will be findable
          // again, because a census is not yours to edit.
          stillBlocked: !gone.forgotten,
        }));
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
      // ── WHICH CENSUS PROVES IT ───────────────────────────────────────
      //
      //   Andy: "now we need to be able to add foreign peers to contacts,
      //   peer post to foreign peers require that."
      //
      // This asked `withRelay`, which is `urls[0]` — the first row in
      // relays.json, whatever the question was. So a key that is real and
      // enrolled on a PARTNER could never be confirmed: it is not on this
      // relay's census, and 404 was the honest answer to the wrong
      // question.
      //
      // The caller names the relay now. What is checked is exactly what
      // was checked before — the key must be listed on that census, so a
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
      if (!target) { fail(res, 503, 'no relay url in app/natter/relays.json'); return; }
      try { assertRelayUrl(target); }
      catch (e) { fail(res, 503, String(e.message || e)); return; }

      guarded(res, target, function (url) {
        // -- ASKING ABOUT ONE KEY, NOT READING THE WHOLE LEDGER ---------
        //
        // ── IT ASKS THE RELAY NOTHING (2026-09-18) ──────────────────
        //
        //   Andy: "callers of the census have two choices: use other
        //   interfaces or die."
        //
        // It fetched the entire census to answer yes or no about a single
        // key, then narrowed to `?key=` for a day. Both were the census,
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
        //   a human compared key endings out loud; the census only said
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
        var id = auth.loadIdentity(rootDir);
        if (id && id.publicKey === publicKey) {
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
        var row = contactBook.acquire(rootDir, {
          publicKey: publicKey,
          // Empty is a real answer: a pasted key has no label until its
          // holder writes to you or you type one yourself. Inventing one
          // would be worse than an unnamed row.
          publicLabel: String((body && body.publicLabel) || ''),
          relay: url,
        }, via);
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

  // ---- THE POLL AND THE WINDOW ARE GONE --------------------------------
  //
  // Andy: "no backstop, no listening mode on the personal node. the
  // ability to setup one-device-for-all-peers just IS."
  //
  // What stood here was a 60-second timer asking every relay whether
  // anybody was enrolling, and a flag deciding whether it ran at all. It
  // was never a design: device cycle 2 landed 2026-09-10 and presence on
  // the 11th, so when the handshake was built there was no stream to push
  // down and polling was the only mechanism there was.
  //
  // An offer now arrives on the stream this node already holds, and is
  // answered in a round trip — 365ms through spirit-3, against 0-60
  // seconds of waiting for the next pass. answerRelay.js decides; nothing
  // here asks anybody anything.
  //
  // The window went with it. It cost a timer on every node forever and
  // bought thin protection: it never guarded the password, only meant an
  // attacker holding one had to catch a window somebody opened — and
  // somebody who holds the password can wait for the next. One slot
  // remains, so an intrusion displaces the real device and is visible.

  // WHAT THE PANEL NEEDS, and it is now two facts and a list.
  //
  // `listening` and `lastEvent` went with the timer. Both described a
  // poll: whether it was running, and what its last pass did. There is no
  // pass. A node with a password can be enrolled to, always, and there is
  // nothing about that state worth reporting because there is no other
  // state.

  // ── EVERYBODY WITH A SEAT ON A RELAY I OWN IS A CONTACT ──────────────
  //
  //   Andy: "when someone binds to a peer i own, it's because i want them
  //   in my network, so i want a contact auto-generated, and undeletable
  //   until i agree to also remove their relay slots."
  //   "then i have to rummage two different peer lists for everything i
  //   want to do... and simply because as user it becomes very confusing
  //   to understand my relationship with this peer (ID)."
  //
  // Two lists were one subject. A relay owner's census and their address
  // book overlap completely at the owner's end and were kept apart
  // anyway, so Cruella and Jazzmin Thut held seats on Andy's relay and
  // were not people he could write to without going to a second screen.
  //
  // ── IN THE NODE, NOT THE BROWSER ─────────────────────────────────────
  //
  // A contact that only exists while Contacts is open is not a contact.
  // The owner EVENT (relay.js, ownerEvent('claim')) is the fast path and
  // is not enough on its own: it reaches an open browser and nothing
  // persists it, and every member who enrolled before this existed would
  // never be seen at all.
  //
  // ── WHOLE-LIST, SO IT PRUNES ─────────────────────────────────────────
  //
  // `memberOf` is rewritten from what the census just said rather than
  // added to. A key that left a relay must lose that url — an add-only
  // field would keep somebody undeletable for ever on the strength of a
  // seat they no longer hold, which is the same class of bug as a cache
  // that only grows.
  //
  // ONLY RELAYS THIS NODE OWNS. A member of somebody else's relay, or a
  // peer seen across a partnership, is not this node's to adopt — Andy:
  // "a peer who connects with me through a partner node behaves
  // independently as contact, same as non-relay-owners experience all
  // their contacts." A node that owns nothing does nothing here.
  //
  // NEVER THE OWNER'S OWN KEY. A node is on its own census and must not
  // become its own contact.
  function reconcileMembers(summary) {
    var me = auth.loadIdentity(rootDir);
    var myKey = (me && me.publicKey) || '';
    var rows = (summary && summary.rows) || [];

    // key -> [urls of my relays it holds a seat on]
    var seats = Object.create(null);
    var owned = 0;

    rows.forEach(function (row) {
      if (!row || !row.owned) return;
      owned += 1;
      var roster = (row.census && row.census.roster) || [];
      roster.forEach(function (p) {
        var key = (p && p.publicKey) || '';
        if (!key || key === myKey) return;
        (seats[key] = seats[key] || []).push(row.url);
      });
    });

    // NOTHING ANSWERED, NOTHING CONCLUDED. An owned relay that did not
    // reply carries no roster, and treating that as "nobody is enrolled"
    // would empty every memberOf on this node and make a whole address
    // book deletable because a box was rebooting. The same rule
    // natterCheckBinding follows for bindings, for the same reason.
    if (!owned) return { adopted: 0, pruned: 0 };

    var adopted = 0;
    Object.keys(seats).forEach(function (key) {
      var existing = null;
      try { existing = contactBook.byPublicKey(rootDir, key); }
      catch (e) { existing = null; }
      var label = '';
      rows.forEach(function (row) {
        if (!row || !row.owned) return;
        ((row.census && row.census.roster) || []).forEach(function (p) {
          if (p && p.publicKey === key && p.publicLabel) label = p.publicLabel;
        });
      });
      try {
        contactBook.acquire(rootDir, {
          publicKey: key, publicLabel: label, relay: seats[key][0],
        }, contactBook.MEMBER);
        contactBook.setMemberOf(rootDir, key, seats[key]);
        if (!existing || !contactBook.isMember(existing)) adopted += 1;
      } catch (e) { /* one bad row must not stop the sweep */ }
    });

    // AND THE ONES WHO LEFT. Anybody this node still believes holds a
    // seat, who was not on any roster just read, loses it — which is what
    // makes them an ordinary deletable contact again.
    var pruned = 0;
    var book = [];
    try { book = contactBook.load(rootDir); } catch (e) { book = []; }
    book.forEach(function (row) {
      if (!row || !contactBook.isMember(row)) return;
      if (seats[row.publicKey]) return;
      try { contactBook.setMemberOf(rootDir, row.publicKey, []); pruned += 1; }
      catch (e) { /* likewise */ }
    });

    return { adopted: adopted, pruned: pruned };
  }


  // ── AND WHO IS ON NO CENSUS AT ALL ───────────────────────────────────
  //
  //   Andy: "show a warning bubble at the top of contact details if the
  //   contact is an obvious dud... the bubble will show the reason."
  //
  // An obvious dud is a key that EVERY relay this node is on answered
  // about, and none of them listed. Andy's book has three today: bella
  // and carlos, whose only relay was a loopback lab box that no longer
  // exists, and rock, whose seat he removed by hand.
  //
  // ── THE RULE IS natterCheckBinding'S, AND IT HAS TO BE ───────────────
  //
  //   "UNREACHABLE IS STILL NOT THE SAME AS NOT OURS ... `status > 0` is
  //    the test — NOT `!error`, because probe sets `error: 'no row here'`
  //    on a relay that answered perfectly well."
  //
  // A relay that did not answer says NOTHING about anybody. Without that
  // distinction a node whose relay was rebooting would mark its whole
  // address book as dead — and this writes a warning onto a screen, so
  // being wrong is loud.
  //
  // NEVER ACTS, ONLY MARKS. Nothing is deleted here and nothing will be:
  // absence is not death, a node can be off for a month, and a row
  // carries `myLabel` — a name its owner typed, which is on no relay to
  // be recovered from. The mark is what lets a person decide; the
  // deciding stays theirs.
  //
  // A DATE, NOT A FLAG, and the wording that reads it must be careful:
  // this is when this node first CONCLUDED the key was missing, not when
  // it went. Nothing watched before the conclusion was possible.
  function reconcileOrphans(summary, now) {
    var me = auth.loadIdentity(rootDir);
    var myKey = (me && me.publicKey) || '';
    var rows = (summary && summary.rows) || [];

    // ANSWERED, not merely configured. `status > 0` is a reply of some
    // kind; `error: 'no row here'` is a relay answering perfectly well
    // that this node holds no seat, which is still an answer about
    // everybody else on it.
    var answered = rows.filter(function (row) { return row && Number(row.status) > 0; });
    if (!answered.length) return { marked: 0, cleared: 0, asked: 0 };

    var listed = Object.create(null);
    answered.forEach(function (row) {
      ((row.census && row.census.roster) || []).forEach(function (p) {
        if (p && p.publicKey) listed[p.publicKey] = true;
      });
    });

    // A ROSTER IS ONLY AS GOOD AS ITS RELAY. An older relay answers the
    // census without a roster, and reading that as "lists nobody" would
    // mark every contact on it. If not one answering relay produced a
    // roster, this knows nothing and says so by doing nothing.
    var anyRoster = answered.some(function (row) {
      return ((row.census && row.census.roster) || []).length > 0;
    });
    if (!anyRoster) return { marked: 0, cleared: 0, asked: answered.length };

    var stamp = (now instanceof Date ? now : new Date()).toISOString();
    var marked = 0;
    var cleared = 0;
    var book = [];
    try { book = contactBook.addressBook(rootDir); } catch (e) { book = []; }

    book.forEach(function (row) {
      if (!row || !row.publicKey || row.publicKey === myKey) return;

      if (listed[row.publicKey]) {
        // Back on a census, so the warning goes. A row that returned must
        // not keep wearing one.
        if (contactBook.missingSince(row)) {
          try { contactBook.setMissing(rootDir, row.publicKey, ''); cleared += 1; }
          catch (e) { /* one row must not stop the sweep */ }
        }
        return;
      }

      // ALREADY MARKED KEEPS ITS ORIGINAL DATE. The useful number is how
      // long this has been true, and rewriting the stamp on every probe
      // would make every dud look like it appeared minutes ago.
      if (contactBook.missingSince(row)) return;
      try { contactBook.setMissing(rootDir, row.publicKey, stamp); marked += 1; }
      catch (e) { /* likewise */ }
    });

    return { marked: marked, cleared: cleared, asked: answered.length };
  }

  // The probe this node already makes, with the reconcile hung off it.
  // Separate from statusFor so boot can run it without a browser asking,
  // and so a suite can drive it directly.
  function syncMembers() {
    var me = auth.loadIdentity(rootDir);
    if (!me || !me.publicKey) return Promise.resolve({ adopted: 0, pruned: 0 });
    return ownerBadge.probe(rootDir, function (url, method, pathname) {
      return relayRequest(url, method, pathname, null);
    }, me.publicKey)
      .then(function (summary) {
        var seats = reconcileMembers(summary);
        // THE SAME PROBE ANSWERS BOTH QUESTIONS. Who holds a seat on a
        // relay I own, and who is on no census at all, are read from one
        // set of censuses — a second sweep would be a second round of
        // requests to say something about the same rows.
        var orphans = reconcileOrphans(summary);
        return {
          adopted: seats.adopted, pruned: seats.pruned,
          marked: orphans.marked, cleared: orphans.cleared,
        };
      })
      .catch(function () { return { adopted: 0, pruned: 0, marked: 0, cleared: 0 }; });
  }

  function handleDevice(req, res) {
    var doc = deviceAuth.ensurePassword(rootDir);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      password: doc.password,
      // Whose page to open, and it is this node's own public key. Public
      // already — every relay's /api/relay/who hands it to anyone — and
      // the panel needs it to build the per-key link.
      publicKey: (auth.loadIdentity(rootDir) || {}).publicKey || '',
      devicePublicKey: doc.devicePublicKey || '',
    }));
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
  //
  // WHY NOT device.info, which already hands back this node's public key:
  // that verb is about the PASSWORD — what a phone needs to attach. These
  // are about what a stranger is told. Sharing a verb would mean a screen
  // for editing your description had a password in its response body.
  function handleNodeCard(req, res) {
    var card = nodeCard.read(rootDir);
    if (!card) { fail(res, 409, 'this node has no key yet'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ ok: true }, card)));
  }

  // A REFUSAL IS A BODY, NOT A STATUS, for both of these. The app draws
  // `error` under the field that caused it, which is where somebody is
  // looking — and labelRule already told it the same thing before the
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
  // ANYONE. `/api/relay/who` is public and unsigned (0010 calls it "what
  // a node reads before it has anything") and every row carries
  // `publicKey` and `owner`. So eligibility is a fetch and a comparison,
  // with no new wire, no signature and no membership.
  //
  // READ-ONLY, AND THAT IS THE DESIGN. This answers a question; it does
  // not promote anybody. The promotion is an owner verb posted to the
  // relay like every other one, so there is exactly one path that writes
  // a peer row and this is not it.
  //
  // WHY THE NODE DOES THE FETCHING: a relay makes no outbound request of
  // any kind and this does not change that. Nothing is being laundered —
  // the census is public, so a node reporting it hands over nothing the
  // relay could not have read itself.
  //
  // TWO KEYS, TWO JOBS, and conflating them is the likeliest bug in this
  // design: you verify OWNERSHIP against the row marked owner, and you
  // capture the RELAY's own key to pin for a later forward hop. On
  // spirit-3 those are …fXD+0c= and …bCAsCR4=.
  // ── WHO IS OVER THERE ────────────────────────────────────────────────
  //
  //   Andy: "we want to prove that with a partnership more peer id's can
  //   be visible for every node bound to either partner."
  //
  // The census of a relay this node is NOT on. Public, unauthenticated,
  // the same page `handlePartnerCheck` above already reads — this just
  // hands back the roster instead of a verdict about one key.
  //
  // WHY THE NODE AND NOT THE RELAY. Item 8: the node fetches, the relay
  // stores the conclusion. A relay caching its partners' members and
  // answering searches is tier three and needs a cache, a lifetime and a
  // budget. Reading a public page needs none of those, and it is enough
  // to SEE — which is the whole of what this step claims.
  //
  // NOT A PROXY. It fetches one fixed path, returns only what a census
  // carries, and `assertRelayUrl` applies as everywhere else. A caller
  // that wants an arbitrary url has `net.fetch` and its own refusals.
  // ── handleRoster STOOD HERE (`relay.roster`), DELETED 2026-09-17 ───
  //
  // It fetched a named relay's whole public census so natterDetails could
  // tabulate who a partner holds. That panel is gone (see the tombstone
  // in natterDetails.js) and this had no other caller.
  //
  // It was the one census reader that genuinely wanted a LIST, and so the
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
  // Contacts sees ONE relay today: `peer.list` is `withRelay`, which is
  // `urls[0]`. So "people you could add" meant "people on the first row of
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
  //   1. each configured relay's census      public GET
  //   2. ask it who it partners with         signed post, any member may
  //   3. each partner's census               public GET
  //
  // WHAT IS SUBTRACTED is anybody already known — `contactBook.contacts()` is
  // every row that arrived by more than a census sighting. A candidate is
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
  function sendPacket(router, relayUrl, toKey, text) {
    return router.post(relayUrl, toKey, text);
  }

  // ── ASK EACH RELAY, DO NOT DOWNLOAD EACH RELAY ───────────────────────
  //
  //   Andy: "This approach will not be sustainable if there's even just a
  //   thousand people in this list… We want the partner-space
  //   searchable."
  //
  // handleCandidates fetched every census whole and subtracted what this
  // node knows — fine at ten members and absurd at a thousand: 150 KB per
  // relay, per refresh, to build a list nobody can read. It was kept "for
  // the small case" and deleted on 2026-09-17 once the app had moved off
  // it entirely; see the tombstone below. This is what asks instead.
  //
  // One signed post per relay, capped answers, and the relay does the
  // matching over rows it already holds in RAM. When a relay holds its
  // partners' members (tier two) the same request covers partner space and
  // nothing here changes.
  function handleSearch(req, res, readJsonBody, deps) {
    var router = deps && deps.router;
    readJsonBody(req).then(function (body) {
      var q = String((body && body.q) || '').trim();
      // No floor: see relay.js. A short query is a real question with a
      // ranked, capped answer, and refusing it here would put the crutch
      // back one layer out.
      if (!router) { fail(res, 503, 'this node is not connected to a relay'); return; }

      var urls = ownerBadge.configuredUrls(rootDir);
      var me = auth.loadIdentity(rootDir);
      var myKey = (me && me.publicKey) || '';
      var found = Object.create(null);
      var truncated = false;
      // ── A RELAY THAT CANNOT SEARCH IS NOT A RELAY WITH NOBODY ON IT ──
      //
      // A box running code older than this verb answers `no such peer`
      // and contributes nothing. Counting that as "no matches" would make
      // an empty result mean two different things — nobody is called
      // that, or nobody could look — and on a network where relays update
      // on their owners' schedules the second is normal, not exceptional.
      //
      // Seen immediately: spirit.andyflinn.com is pinned to a tag and
      // returned nothing for a name that is plainly on it.
      var silent = [];

      // ── THE NODE ALREADY KNOWS THE KEY ─────────────────────────────
      //
      //   Andy: "sticking to protocol and its interface calls will save
      //   us in the long run... the protocol has cut down response time
      //   for device-login from 30 seconds to a fraction of a second."
      //
      // This fetched the WHOLE census over plain HTTPS to read one field
      // off it — relayPublicKey — so that it could then send the search
      // as a proper packet. A 150 KB download on the path whose entire
      // purpose is to stop downloading censuses.
      //
      // relayKeys.js has held that key since first contact; pinning it is
      // what makes a relay identifiable at all. And the LABEL comes off
      // relays.json, which is what this person called it rather than what
      // the box calls itself — better for a result row either way.
      var labels = Object.create(null);
      ownerBadge.loadRelays(rootDir).forEach(function (r) {
        if (r && r.url) labels[r.url] = r.label || '';
      });

      return Promise.all(urls.map(function (url) {
        var relayKey = relayKeys.pinned(rootDir, url);
        // No pin means this node has never spoken to it. Nothing to do
        // but say so — fetching a key from the box you are asking about
        // is how you get answered by whoever is standing there.
        if (!relayKey) { silent.push(url); return Promise.resolve(null); }
        return sendPacket(router, url, relayKey, systemPayload({ search: { q: q } })).then(function (answer) {
          var said = null;
          try { said = JSON.parse((answer && answer.text) || ''); }
          catch (e) { said = null; }
          var out = (said && said.body) || {};
          if (!out || out.ok !== true) { silent.push(url); return; }
          if (out.more) truncated = true;
          (out.matches || []).forEach(function (p) {
            if (!p || !p.publicKey || p.publicKey === myKey) return;
            if (found[p.publicKey]) return;
            var row = contactBook.byPublicKey(rootDir, p.publicKey);
            found[p.publicKey] = {
              publicKey: p.publicKey,
              publicLabel: p.publicLabel || '',
              tail: keyTail(p.publicKey),
              // WHICH RELAY THIS ROW CAN BE ACQUIRED FROM, which is not
              // always the one that answered. A row carrying `via` came
              // from a PARTNER of this relay, and confirming a key means
              // finding it on a census — so the URL has to be the
              // partner's or the confirm is looked up in the wrong book
              // and answers "no peer at ... with that key".
              //
              // `via` is a relay KEY, because that is what a relay pins
              // and the only thing it can name a partner by without
              // trusting a URL somebody sent it. Resolved to a URL below,
              // by asking the relay that answered who it partners with.
              relay: url,
              relayLabel: labels[url] || '',
              // ── WHETHER THE RELAY THAT ANSWERED SEES THEM CONNECTED ──
              //
              //   Andy: "hmm the search might need a filter argument
              //   (onlineOnly = true)... discuss?"
              //
              // The discussion found the field already existed and was
              // being thrown away here. The relay computes it per row
              // (relay.js, `present: presentNow.isPresent(...)`) and the
              // ranker weighs it at a quarter of an exact match — so
              // presence has been deciding which rows reach the browser
              // all along, while the browser was told nothing about it.
              //
              // NOT THE SAME FACT AS THIS NODE'S OWN PRESENCE TABLE, and
              // that is why it is worth carrying rather than looked up.
              // This node knows who is present on the relays IT holds
              // streams to; a row that came from a PARTNER is somebody it
              // has no stream to and can never answer for. The relay that
              // answered can, and this is it saying so.
              //
              // A FILTER IS NOT BUILT ON IT YET, deliberately: hiding
              // absent people would mean a search for somebody whose
              // laptop is shut answers "nobody found", and acquiring a
              // key has never required the person to be awake.
              present: !!p.present,
              via: p.via || null,
              viaPartner: !!p.via,
              acquiredVia: row ? contactBook.acquiredVia(row) : null,
            };
          });
        }).catch(function () { silent.push(url); });
      })).then(function () {
        // -- A PARTNER'S KEY BECOMES A PARTNER'S URL ------------------
        //
        //   Andy: "it must accompany the found records with the partner ID
        //   supplying that result record ... so the node can associate the
        //   peer with an initial route."
        //
        // Asked ONLY when something actually came from a partner: an
        // ordinary search of this node's own relays costs no extra round
        // trip. `{partners:true}` is a verb any member may ask —
        // handleCandidates asked it from tier one until that verb was
        // deleted (2026-09-17), so this adds no door and is now its only
        // reader.
        var needsRoute = Object.keys(found).some(function (k) { return found[k].via; });
        if (!needsRoute) return null;

        return Promise.all(urls.map(function (url) {
          var relayKey = relayKeys.pinned(rootDir, url);
          if (!relayKey) return Promise.resolve(null);
          return sendPacket(router, url, relayKey, systemPayload({ partners: true }))
            .then(function (answer) {
              var said = null;
              try { said = JSON.parse((answer && answer.text) || ''); }
              catch (e) { said = null; }
              return ((said && said.body && said.body.partners) || []);
            })
            .catch(function () { return []; });
        })).then(function (lists) {
          var byKey = Object.create(null);
          lists.forEach(function (list) {
            (list || []).forEach(function (p) {
              if (p && p.relayKey && p.url) byKey[p.relayKey] = p.url;
            });
          });
          Object.keys(found).forEach(function (k) {
            var row = found[k];
            if (!row.via) return;
            var at = byKey[row.via];
            // A partner this node cannot name is a row it cannot confirm.
            // Left with the answering relay's URL rather than a guess: the
            // confirm then fails honestly, naming a relay, instead of
            // succeeding against the wrong census.
            if (at) { row.relay = at; row.relayLabel = labels[at] || ''; }
          });
        });
      }).then(function () {
        var list = Object.keys(found).map(function (k) { return found[k]; });
        list.sort(function (a, b) {
          return String(a.publicLabel).localeCompare(String(b.publicLabel));
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          q: q, matches: list, more: truncated,
          asked: urls.length,
          // Named, not counted: 'one relay could not answer' is useless
          // without saying which, and the owner of that relay is often
          // the person reading this.
          silent: silent,
        }));
      });
    }).catch(function () { fail(res, 400, 'bad body'); });
  }

  // ── handleCandidates STOOD HERE, AND TOOK THE LAST WHOLE-CENSUS ────
  //     FAN-OUT WITH IT (2026-09-17)
  //
  //   Andy: "we can kill the census getting in the partner
  //   communications. we already are working with search concepts only
  //   there... nothing should break, contacts also uses search now."
  //
  // `peer.candidates` answered "everybody visible from here and not yet
  // known" by fetching EVERY census whole — this node's relays and each
  // of their partners — and subtracting what the contactBook already had.
  // It was the worst census reader in the tree and the only one with no
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

  function handlePartnerCheck(req, res, readJsonBody) {
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
      // This read the whole census of a relay this node has never been on
      // — every member, every label, every join date — to answer one
      // question about ONE key. It narrowed to `?key=` for a day, keeping
      // a whole-census read on the refusal path so it could still name
      // the other owner.
      //
      // BOTH OF THOSE WERE THE CENSUS. `GET /api/relay/key` carries
      // `ownerKey` and `ownerLabel` now — two fields that were already
      // public on the row marked `owner`, asked for without asking for
      // the membership they were buried in. One request, fixed cost, and
      // this verb no longer touches the census on any path.
      //
      // Narrowing would have been the wrong move and is worth saying so:
      // a `?owner=1` parameter answers the same question by making the
      // cheat smaller, and a smaller cheat is a defended one.
      //
      // THE CHECK IS UNCHANGED. "The key marked owner over there is the
      // key of the peer here" — a referral has to be verifiable (Andy),
      // and it still is, off a public page the relay serves about itself.
      relayRequest(url, 'GET', '/api/relay/key', null)
        .then(function (r) {
          var said = null;
          try { said = JSON.parse(r.text); }
          catch (e) { said = null; }
          if (r.status !== 200 || !said) {
            // A relay too old to have the door, or one that is down. Both
            // are "this cannot be checked", and neither is a promotion.
            answer({ ok: false, error: 'that relay did not say who runs it (' + r.status + ')' });
            return;
          }

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
            // Pinned at promotion, used at the hop.
            relayKey: said.relayPublicKey || '',
            relayLabel: said.relayLabel || '',
            ownerLabel: said.ownerLabel || '',
          });
        })
        .catch(function (err) {
          answer({ ok: false, error: String((err && err.message) || err) });
        });
    }).catch(function () {
      fail(res, 400, 'bad body');
    });
  }

  function handleStatus(req, res, readJsonBody, deps) {
    Promise.resolve()
      .then(function () { return readJsonBody(req); })
      .catch(function () { return {}; })
      .then(function (body) { statusFor(res, (body && body.name) || '', deps); });
  }

  function statusFor(res, name, deps) {
    // THE KEY, and since R3 it is the only thing probe asks with.
    //
    // It was once possible to call this WITHOUT a key and still get
    // `owned`, because owning was decided by a signed status 200 and only
    // `claimed` needed a census match. That asymmetry cost a real bug —
    // three arguments here meant `claimed` was never set on any row, and
    // Natter's `owned || claimed` quietly collapsed to `owned`, so every
    // relay this node was merely BOUND to drew no panel at all. The same
    // omission the device timer above carries a comment about: "the whole
    // feature stopped at the owner for want of one word."
    //
    // The asymmetry is gone rather than fixed twice. Both answers come
    // from the census, by key, so a caller without a key gets nothing —
    // which is the truth, and is now unmistakable.
    //
    // `name` no longer travels at all: it was there to sign a LABEL to
    // prove a KEY owned a box (ownerBadge, statusPath). It is still read
    // off the body above, because it is echoed back to the browser as
    // `name` below and Natter uses it as the label to display.
    var me = auth.loadIdentity(rootDir);
    ownerBadge.probe(rootDir, function (url, method, pathname) {
      return relayRequest(url, method, pathname, null);
    }, me && me.publicKey)
      .then(function (summary) {
        // ── THE SWEEP RIDES THIS PROBE ───────────────────────────────
        //
        // It was wired at boot and on a claim event, and the comment on
        // reconcileMembers said "on every probe" — which it was not. The
        // cost of that was exact and Andy hit it: he removed somebody's
        // seat, `memberOf` still named the relay, so the row stayed
        // locked and Forget went on trying to evict a seat that was
        // already gone. Until a restart.
        //
        // THIS probe is the one the browser triggers, and it has already
        // fetched every census — so reconciling here is free, and it
        // happens at exactly the moment a screen is about to draw
        // something from the answer.
        try { reconcileMembers(summary); reconcileOrphans(summary); }
        catch (e) { /* a status must answer even if the book will not */ }

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
          relayStatus: (deps && deps.presence && deps.presence.relayStatus)
            ? deps.presence.relayStatus()
            : {},
        }));
      })
      .catch(function (err) { fail(res, 502, String(err.message || err)); });
  }

  return {
    handleClaim: handleClaim,
    // The transport. handleSend and handleInbox stood beside it while
    // there were two, listed together so that was visible; R8 deleted the
    // other one and this is what a node has.
    handlePost: handlePost,
    handleStatus: handleStatus,
    handlePartnerCheck: handlePartnerCheck,
    handleSearch: handleSearch,
    handleWho: handleWho,
    handleContact: handleContact,
    handlePeer: handlePeer,
    // handleInvite, handleRemovePeer, handleRename and handleRevoke were
    // exported here. Every one of them is a peerPost the browser makes
    // for itself now — see the note where they stood.
    handleUnknownSenders: handleUnknownSenders,
    handleSendersRead: handleSendersRead,
    handleRotatePassword: handleRotatePassword,
    handleDevice: handleDevice,
    handleNodeCard: handleNodeCard,
    syncMembers: syncMembers,
    reconcileMembers: reconcileMembers,
    reconcileOrphans: reconcileOrphans,
    handleNodeName: handleNodeName,
    handleNodeDescription: handleNodeDescription,
  };
}

module.exports = {
  createHub: createHub,
  // This node's outbound request to a relay, with the URL assertion that
  // goes with it. Exported for presenceNode, which needs the same
  // primitive to probe which relays it holds a row on and must not grow
  // a second one that asserts less.
  relayRequest: relayRequest,
  buildPeople: buildPeople,
  // The node's own judgement about who it will hear from, exported for
  // the same reason relayRequest is: peerPost needs it and must not grow
  // a second answer to the same question.
  frontDoor: frontDoor,
  remember: remember,
  // Listed ONCE. It was here twice — same key, same value, one shadowing
  // the other in the same object literal — which is what an export block
  // that grew by accretion does. Spotted while deleting the six ring
  // exports that surrounded it (R8).
  unknownPolicy: unknownPolicy,
  handleMatches: handleMatches,
  keyTail: keyTail,
};
