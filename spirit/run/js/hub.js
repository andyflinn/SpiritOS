'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const auth = require('./relayAuth');
const invites = require('./invites');
const ownerBadge = require('./ownerBadge');
const whoBook = require('./whoBook');
const relayKeys = require('./relayKeys');
const packet = require('./packet');
const peerFile = require('./peerFile');
const peerStats = require('./peerStats');
const deviceAuth = require('./deviceAuth');

function isLoopbackHost(hostname) {
  var h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function assertRelayUrl(relayUrl) {
  var target;
  try { target = new URL(relayUrl); }
  catch (e) { throw new Error('bad relay url'); }
  if (target.protocol === 'https:') return target;
  if (target.protocol === 'http:' && isLoopbackHost(target.hostname)) return target;
  throw new Error('relay url must be https (loopback http is allowed for lab relays)');
}

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

function relayRequest(relayUrl, method, pathname, bodyObj, extraHeaders) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = assertRelayUrl(relayUrl + pathname); }
    catch (e) { reject(e); return; }
    var payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    var lib = target.protocol === 'https:' ? https : http;
    var req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: method,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Host': target.host
      }, extraHeaders || {})
    }, function (res) {
      var chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, text: chunks });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
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
// is how a friend picks a stranger's john. So the list is whoBook rows
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
      whoBook.handshake(rootDir, {
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

  var rows = whoBook.addressBook(rootDir)
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
        caption: whoBook.labelForKey(rootDir, row.publicKey, row.publicLabel || ''),
        // The raw one, beside the resolved caption: an editor has to
        // show what is stored, not what is shown, or clearing the field
        // would look like clearing the name.
        myLabel: row.myLabel || '',
        acquiredVia: whoBook.acquiredVia(row),
        // One question the app asks about every row: may this be written
        // to? Held and blocked both answer no, and they are drawn the
        // same way — a × and no composer — because to the person looking
        // at the list they are the same fact.
        held: !whoBook.listens(row),
        blocked: whoBook.isBlocked(row),
        // Whether this contact is on the mailbox this node is pointed at
        // right now. A contact you acquired elsewhere is still a contact;
        // it just has nowhere to be written to from here.
        onMailbox: !!seen,
        owner: !!(seen && seen.owner),
        // Bytes this node is carrying for them, across every app that
        // keeps a file per peer. Always a number, 0 for somebody who has
        // cost nothing yet — an absent field would make the app decide
        // between "none" and "not asked", which are not the same answer.
        bytesHeld: bytesHeld[row.publicKey] || 0,
        // What they cost in attention. Computed from the sidecar
        // (peerStats), never from a field on the row: a whoBook row is
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
// johns apart, and relayConsole uses the same rule from its own copy.
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
      var row = whoBook.byPublicKey(rootDir, p.publicKey);
      return {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || '',
        tail: keyTail(p.publicKey),
        // What this node already thinks of them, so the UI can say
        // "already a contact" instead of offering the same person twice.
        acquiredVia: row ? whoBook.acquiredVia(row) : null,
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
// (`/api/hub/who` → whoBook) is what fills the caption in. A contact
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
//             it can answer (whoBook 'message').
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
  whoBook.contacts(rootDir).forEach(function (row) { allowed[row.publicKey] = true; });
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
// — its key is in no whoBook. relayKeys.js is what makes that answerable
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
  // "Acquired" is narrower than "on record", deliberately: whoBook's
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
// would otherwise have quietly taken it. whoBook's `relays` means
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
// caption in afterwards (`/api/hub/who` → whoBook), so a contact acquired
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
      whoBook.acquire(rootDir, row, 'message');
      return true;
    }
    if (verdict === 'hold') {
      whoBook.hold(rootDir, row);
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

// Every message comes back with what its text turned out to be: anything
// that IS an envelope arrives named, so the reader can tell its own
// traffic from another app's without parsing anything itself, and a bare
// string decodes as legacy.
//
// The message is copied rather than edited: `text` stays exactly the
// bytes that were signed.
//
// Moved into packet.js on 2026-09-13 and kept here as the name
// spirit/test/packet.js already calls. It had two callers then — the ring
// and the router — and one place building `message.packet` was what kept
// an app from seeing two shapes depending on which road a line travelled.
// The ring is gone (R8) and arrivals.js is the only road left, so this is
// now a name rather than a junction.
function decorateWithPacket(message) {
  return packet.decorate(message);
}

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
// Grok's three skips survive in peerPost and whoBook, unchanged: our own
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
  function handleClaim(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withChosenRelay(res, body && body.url, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(
          rootDir,
          body && body.name,
          body && body.invite,
          body && body.inviteLabel
        ))
          .then(function (r) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(markMine(rootDir, r.text));
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
  function outgoingText(body) {
    if (body && body.app !== undefined) {
      // `re` rides through untouched: the node does not know what the
      // caller is regarding and has no business checking. It is a hash
      // over bytes somebody else holds, so the only party who can verify
      // it is the one who holds them.
      return packet.encode(body.app, body.body === undefined ? '' : body.body, {
        re: body.re,
      });
    }
    // Legacy caller: a bare string, wired as it always was.
    return { ok: true, text: String((body && body.text) || '') };
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

      // THE SAME ENVELOPE THE RING ALREADY SPOKE. An app says which app
      // a message is for and what is in it; wrapping that into
      // {app, v, body} is the node's job on either transport, and
      // outgoingText is the one place that decides how — so a packet sent
      // by the router is byte-identical to one the ring would have sent.
      //
      // A bare `text` still works: the router carried raw strings before
      // apps could reach it, and routerPost.js drives it that way.
      var wrapped = outgoingText(body);
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
      return router.post(where[0], to, text).then(function (answer) {
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

  function handleUnknownSenders(req, res, readJsonBody) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, policy: unknownPolicy(rootDir) }));
      return;
    }
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
      relayRequest(url, 'GET', '/api/relay/who', null)
        .then(function (r) {
          if (r.status !== 200) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }
          // The relay route answers { peers: [...] } (server.js
          // handleRelayWho), not a bare array. Both shapes are accepted
          // because a stub that guessed wrong is exactly how this got
          // shipped once already: the harness passed against a fake that
          // returned the array, and the live mailbox returned an object.
          var parsed = null;
          try { parsed = JSON.parse(r.text); }
          catch (e) { parsed = null; }
          var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
          // Null from a mailbox that has not been restarted since it grew
          // a key of its own. The app treats that as "no log for this
          // row" rather than inventing a name for it.
          var relayKey = (parsed && parsed.relayPublicKey) || null;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          // `reservedName: auth.RESERVED_NAME` TRAVELLED HERE, described
          // as "a destination the app must offer". Nothing on the page
          // ever read it, and the reservation itself is gone (2026-09-15,
          // relayAuth.js): the relay is addressed by key and always was.
          // This node's own key travels with the list, because being
          // added is the other half of adding: the person confirming a
          // tail has to hear it from somebody, and until now the only
          // way to read your own was to type `whoami` at the mailbox.
          var self = auth.loadIdentity(rootDir);
          res.end(JSON.stringify({
            relay: url,
            relayPublicKey: relayKey,
            selfPublicKey: (self && self.publicKey) || null,
            selfTail: self && self.publicKey ? keyTail(self.publicKey) : null,
            people: buildPeople(rootDir, peers, url),
          }));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // GET /api/hub/handle?handle=bert — the candidates behind a handle.
  //
  // The filtering happens HERE, and only the matches go back. The node
  // has to fetch the census to answer at all, but the browser holding a
  // copy of it is how `To` gets refilled from `who` by accident six
  // weeks from now. Downloading is not acquiring.
  function handleHandle(req, res, urlObj) {
    var handle = urlObj.searchParams.get('handle') || '';
    withRelay(res, function (url) {
      relayRequest(url, 'GET', '/api/relay/who', null)
        .then(function (r) {
          if (r.status !== 200) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }
          var parsed = null;
          try { parsed = JSON.parse(r.text); }
          catch (e) { parsed = null; }
          var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            handle: handle,
            matches: handleMatches(rootDir, peers, handle),
          }));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

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
  function handlePeer(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var publicKey = String((body && body.publicKey) || '').trim();
      var action = String((body && body.action) || '');
      if (!publicKey) { fail(res, 400, 'publicKey required'); return; }
      // Three, and they are not two: `accept` says listen to this person
      // and `unblock` only takes the block off. Somebody who was blocked
      // while still waiting goes back to waiting, not into the address
      // book — undoing a no is not the same as saying yes.
      if (['block', 'unblock', 'accept', 'label'].indexOf(action) === -1) {
        fail(res, 400, 'action must be block, unblock, accept or label');
        return;
      }
      var id = auth.loadIdentity(rootDir);
      if (id && id.publicKey === publicKey) {
        fail(res, 400, 'that key is this node');
        return;
      }
      // Blocking somebody this node has no row for is a real case: they
      // are in the census, they have been picked in the list, and they
      // have never been acquired. A row is made so the block has
      // somewhere to live and somewhere to be undone from.
      if (action === 'block' && !whoBook.byPublicKey(rootDir, publicKey)) {
        whoBook.hold(rootDir, { publicKey: publicKey, publicLabel: String((body && body.publicLabel) || '') });
      }
      // What YOU call that key. Never uploaded, never seen by the peer,
      // and the reason whoBook keeps publicLabel separate: the mailbox's
      // caption is theirs and can change under you, this one is yours.
      if (action === 'label') {
        var row = whoBook.setMyLabel(rootDir, publicKey, String((body && body.myLabel) || ''));
        if (!row) { fail(res, 404, 'no row for that key'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          publicKey: row.publicKey,
          myLabel: row.myLabel || '',
          caption: whoBook.labelForKey(rootDir, publicKey, row.publicLabel || ''),
        }));
        return;
      }

      var row;
      if (action === 'block') row = whoBook.setBlocked(rootDir, publicKey, true);
      else if (action === 'unblock') row = whoBook.setBlocked(rootDir, publicKey, false);
      else row = whoBook.accept(rootDir, publicKey);
      if (!row) { fail(res, 404, 'no row for that key'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        publicKey: row.publicKey,
        acquiredVia: whoBook.acquiredVia(row),
        blocked: whoBook.isBlocked(row),
        held: !whoBook.listens(row),
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
      withRelay(res, function (url) {
        relayRequest(url, 'GET', '/api/relay/who', null)
          .then(function (r) {
            var parsed = null;
            try { parsed = JSON.parse(r.text); }
            catch (e) { parsed = null; }
            var peers = Array.isArray(parsed) ? parsed : ((parsed && parsed.peers) || []);
            var found = peers.filter(function (p) { return p && p.publicKey === publicKey; })[0];
            if (!found) {
              fail(res, 404, 'no peer on this mailbox with that key');
              return;
            }
            var id = auth.loadIdentity(rootDir);
            if (id && id.publicKey === publicKey) {
              fail(res, 400, 'that key is this node');
              return;
            }
            // How the key was confirmed. `handle` is a human comparing
            // key endings out loud (cut 2). `invite` is the owner
            // recognising a label they minted, now claimed on their own
            // mailbox — the census is what proves the two are the same
            // key, and only the owner can read one. Nothing else is
            // accepted here: a page cannot promote a stranger by asking
            // nicely.
            var wanted = String((body && body.via) || 'handle');
            var via = (wanted === 'invite') ? 'invite' : 'handle';
            var row = whoBook.acquire(rootDir, {
              publicKey: publicKey,
              publicLabel: found.publicLabel || '',
              relay: url,
            }, via);
            res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              publicKey: row.publicKey,
              publicLabel: row.publicLabel,
              acquiredVia: whoBook.acquiredVia(row),
            }));
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
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
    handleWho: handleWho,
    handleHandle: handleHandle,
    handleContact: handleContact,
    handlePeer: handlePeer,
    // handleInvite, handleRemovePeer, handleRename and handleRevoke were
    // exported here. Every one of them is a peerPost the browser makes
    // for itself now — see the note where they stood.
    handleUnknownSenders: handleUnknownSenders,
    handleRotatePassword: handleRotatePassword,
    handleDevice: handleDevice,
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
  decorateWithPacket: decorateWithPacket,
};
