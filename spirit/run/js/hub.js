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
function signedClaim(rootDir, name, invite) {
  const id = auth.ensureIdentity(rootDir, name);
  const body = {
    name: name,
    publicKey: id.publicKey,
    sig: auth.sign(id.privateKey, auth.claimMessage(name)),
  };
  if (invite) body.invite = invite;
  return body;
}

function signedSend(rootDir, from, to, text) {
  const id = auth.ensureIdentity(rootDir, from);
  const body = { from: from, to: to, text: text };
  if (id && id.privateKey) {
    body.sig = auth.sign(id.privateKey, auth.sendMessage(from, to, text));
  }
  return body;
}

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
        publicLabel: p.publicLabel || p.name || '',
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
        publicLabel: (seen && (seen.publicLabel || seen.name)) || row.publicLabel || '',
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
      return String(p.publicLabel || p.name || '').trim().toLowerCase() === want;
    })
    .map(function (p) {
      var row = whoBook.byPublicKey(rootDir, p.publicKey);
      return {
        publicKey: p.publicKey,
        publicLabel: p.publicLabel || p.name || '',
        tail: keyTail(p.publicKey),
        // What this node already thinks of them, so the UI can say
        // "already a contact" instead of offering the same person twice.
        acquiredVia: row ? whoBook.acquiredVia(row) : null,
        owner: !!p.owner,
      };
    });
}

// Somebody wrote to this node, and the mailbox carried their key. That
// is how a stranger becomes someone you can answer.
//
// Weak on purpose: anyone the mailbox admits can write, so this proves a
// key exists and is reachable, not that it belongs to the person you
// think. It is enough to reply to, and Add-by-handle (cut 2) upgrades
// the same row rather than making a second one. It never downgrades a
// row acquired more strongly, and it never files this node's own key.
function acquireFromInbox(rootDir, messages, relayUrl) {
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';
  (Array.isArray(messages) ? messages : []).forEach(function (m) {
    if (!m || !m.fromKey || m.fromKey === myKey) return;
    whoBook.acquire(rootDir, {
      publicKey: m.fromKey,
      publicLabel: m.from || '',
      relay: relayUrl,
    }, 'message');
  });
}

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
// uses for the same event on the old transport: this person wrote. It
// matters because ACQUIRED_LISTENING contains 'message' and not 'census',
// so writing is what makes somebody heard next time.
function remember(rootDir, from, verdict) {
  var key = String(from == null ? '' : from).trim();
  if (!key) return false;
  try {
    if (verdict === 'admit') {
      whoBook.acquire(rootDir, { publicKey: key, publicLabel: '', relays: [] }, 'message');
      return true;
    }
    if (verdict === 'hold') {
      whoBook.hold(rootDir, { publicKey: key, publicLabel: '', relays: [] });
      return true;
    }
  } catch (e) {
    // A book that cannot be written is not a reason to change what
    // happens to the packet. The verdict already stands.
    return false;
  }
  return false;
}

// Splits an inbox into what this node asked to hear and what it did not.
function partitionInbox(rootDir, messages) {
  var allowed = listenSet(rootDir);
  var known = [];
  var unknownKeys = Object.create(null);
  (Array.isArray(messages) ? messages : []).forEach(function (m) {
    if (!m) return;
    // The mailbox always gets through. `relay` is a reserved name no
    // peer can claim, so it cannot be worn by a stranger, and a node
    // that stopped hearing its own mailbox would have a relay console
    // that answered into silence. Live mailboxes hold such lines with no
    // fromKey at all — they predate the mailbox having a key — so the
    // name is what is checked, not the key.
    if (m.from === auth.RESERVED_NAME) { known.push(m); return; }
    // A message with no key cannot be matched against an address book.
    // In keys mode there is always one; in open or names mode there may
    // not be, and refusing to show mail because the mailbox is lax would
    // make a lab node look broken.
    if (!m.fromKey || allowed[m.fromKey]) known.push(m);
    else unknownKeys[m.fromKey] = true;
  });
  return { known: known, unknown: Object.keys(unknownKeys).length };
}

// Hold: the sender gets a row and nothing else. Their line is still
// dropped, nothing is filed under them and no count moves — the row
// exists so a human can see somebody is waiting and say yes.
function holdFromInbox(rootDir, messages, relayUrl) {
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';
  (Array.isArray(messages) ? messages : []).forEach(function (m) {
    if (!m || !m.fromKey || m.fromKey === myKey) return;
    var existing = whoBook.byPublicKey(rootDir, m.fromKey);
    // Never touch somebody already decided about: a blocked row must not
    // climb back out of the block by writing again.
    if (existing && whoBook.acquiredVia(existing) !== whoBook.CENSUS) return;
    whoBook.hold(rootDir, {
      publicKey: m.fromKey,
      publicLabel: m.from || '',
      relay: relayUrl,
    });
  });
}

// Every message comes back with what its text turned out to be. A line
// written before packets existed decodes as legacy, which is how a live
// mailbox full of plain strings keeps painting as chat; anything that IS
// an envelope arrives named, so the reader can tell its own traffic from
// another app's without parsing anything itself.
//
// The message is copied rather than edited: `text` stays exactly what the
// mailbox stored, because that is what was signed.
// Moved into packet.js on 2026-09-13 and kept here as the name the inbox
// path and spirit/test/packet.js already call. The router's arrival seam
// (arrivals.js) needs the identical shape, and two transports each
// building `message.packet` would be one edit away from handing apps two
// different shapes depending on which road a line travelled.
function decorateWithPacket(message) {
  return packet.decorate(message);
}

// A LOG ROW, AS A CLIENT SEES A PACKET. The same shape arrivals.js pushes
// down the live stream, built from the stored row — so a page merging its
// catch-up with what arrived while it was reading has one shape, not two.
//
// The STORE stays payload-agnostic: trafficLog never parses anything. The
// decode happens here, on the way out, which is what keeps that property
// true while still handing a client a body rather than a string.

// One delivered batch, counted. Packet 7, and the rules are Grok's:
//
//   no fromKey, or our own          skip — not somebody else's traffic
//   no whoBook row                  skip — a silent stranger gets no row,
//                                   and a sidecar without a row would be
//                                   a hidden second book
//   row.blocked                     skip — refused at the door is
//                                   refused; the numbers freeze where
//                                   they are and the sidecar stays,
//                                   because bytesHeld is still true
//
// Called AFTER policy has run, which is the whole reason it is a separate
// pass rather than folded into partitionInbox: under `hold` the row for a
// waiting stranger is created by holdFromInbox in this same batch, and
// that line is exactly the one worth counting. The hourglass is
// consideration, and a line you dropped was still a demand on your
// attention — the count is the only trace hold is allowed to keep. The
// body is never written anywhere.
function countInbound(rootDir, messages) {
  var id = auth.loadIdentity(rootDir);
  var myKey = (id && id.publicKey) || '';
  (Array.isArray(messages) ? messages : []).forEach(function (m) {
    if (!m || !m.fromKey || m.fromKey === myKey) return;
    var row = whoBook.byPublicKey(rootDir, m.fromKey);
    if (!row) return;
    if (whoBook.isBlocked(row)) return;
    // The id goes with it so a mailbox that does NOT consume on read
    // cannot count one line twice. peerStats keeps a bounded list of
    // them — a cap, not a transcript.
    peerStats.noteIn(rootDir, m.fromKey, m.id);
  });
}

// Everything that happens to a fetched inbox batch, in one function,
// because there are two callers and they must not drift: Relay Chat's
// poll and the personal node's own 60-second sweep.
//
// The sweep exists because counters that only advance while a chat window
// is open would make Contacts lie every time Andy closes it — and lie in
// the direction that matters, reading "quiet" for somebody who has been
// writing all afternoon. What the numbers mean, exactly, is "arrived at
// this node": the relay stores and this node pulls, so a machine that was
// off counts when it next pulls, and nothing on spirit-3 counts anything.
//
// Returns the response body /api/hub/inbox sends. The sweep throws it
// away and keeps only the side effects, which is the point.
function applyInboxBatch(rootDir, messages, relayUrl) {
  // Off the file, never off the request. A client still sending ?unknown=
  // is not consulted — see unknownPolicy (packet 5).
  var policy = unknownPolicy(rootDir);

  // Reading your mail is also how you come to know who wrote it — when
  // that is what you asked for. Done here rather than in the app either
  // way: it is a fact about this node's address book, and the browser is
  // a view of it.
  if (policy === 'acquire') {
    acquireFromInbox(rootDir, messages, relayUrl);
  } else if (policy === 'hold') {
    holdFromInbox(rootDir, messages, relayUrl);
  }

  // After policy, so a row created a few lines above is a row this pass
  // can see. Before the drop, because a held line is dropped and still
  // counts.
  countInbound(rootDir, messages);

  // The drop happens here, not in the app. A message the browser never
  // receives cannot be written to a peerfile, marked on a row or counted
  // in a title by some later change that forgot about this one.
  var split = partitionInbox(rootDir, messages);
  var kept = policy === 'acquire' ? messages : split.known;
  var body = { messages: kept.map(decorateWithPacket) };
  // Hold says how many, never who: a name would be the thing the setting
  // exists to withhold.
  if (policy === 'hold') body.unknown = split.unknown;
  return body;
}

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

  function handleClaim(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/claim', signedClaim(
          rootDir,
          body && body.name,
          body && body.invite
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

  function handleSend(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      var wrapped = outgoingText(body);
      if (!wrapped.ok) {
        // Refused here, not at the mailbox: an oversize packet is the
        // app's mistake, and spending a rate-limited send to be told so
        // would be this node's.
        fail(res, 400, wrapped.error);
        return;
      }
      withRelay(res, function (url) {
        relayRequest(url, 'POST', '/api/relay/send', signedSend(
          rootDir,
          body && body.from,
          body && body.to,
          wrapped.text
        ))
          .then(function (r) {
            // Counted only when the mailbox took it (201). A refused send
            // is not a reply, and what unansweredInbound measures is
            // whether Andy answered — so a 403 must leave the count where
            // it stood rather than clearing it (packet 7).
            //
            // `to` has to be in the book before a sidecar is written for
            // it. The send hands `to` straight to the relay, and a legacy
            // caller may still pass a caption; a caption would name a
            // peerfile under a key nobody holds, which bytesHeld would
            // then count against nobody. Blocked is not checked: if a send
            // to them was allowed at all, it happened.
            if (r.status === 201 && body && body.to &&
                whoBook.byPublicKey(rootDir, body.to)) {
              peerStats.noteOut(rootDir, body.to);
            }
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
          })
          .catch(function (err) { fail(res, 502, String(err.message || err)); });
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

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

  // ASKING A RELAY THIS NODE OWNS TO DO SOMETHING, in one place.
  //
  // Two doors need the identical five steps — choose the relay, look up
  // its pinned key, post the packet, unwrap the answer, and tell the two
  // kinds of failure apart. The last of those is why this is shared
  // rather than copied: it is the step the first door got wrong, and a
  // second hand-written copy would have been a second chance to.
  //
  // THESE DOORS ARE NOT THE PROTOCOL. Decision 0010 is about ways of
  // speaking on the WAN; `/api/hub/*` is this node's own front, reachable
  // only from this machine, and a node may shape it however suits the
  // browser. What it may not do is invent a word to say over the wire —
  // and neither of these does. Both send an ordinary post.
  //
  // ONE PRECONDITION, honest rather than incidental: the answer arrives
  // on this node's stream to that relay, so both doors work only on a
  // relay this node is actually connected to. That is already the
  // precondition for owning one — presenceNode opens a stream to every
  // relay this node holds a row on — so what it excludes is a request
  // made in the seconds before presence has started, which fails as a
  // timeout saying so rather than as a wrong answer.
  function askRelay(res, deps, wantedUrl, bodyFor, onOk) {
    var router = deps && deps.router;
    var relayKeyFor = deps && deps.relayKey;
    if (!router || !relayKeyFor) {
      fail(res, 503, 'this node is not connected to a relay');
      return undefined;
    }
    return withChosenRelay(res, wantedUrl, function (url) {
      // The url→key pin, not a fresh ask: answerRelay.relayKey is where
      // trust-on-first-use lives, so a relay swapped underneath this node
      // refuses here rather than being acted on.
      return Promise.resolve(relayKeyFor(url)).then(function (key) {
        if (!key) {
          fail(res, 502, 'this node does not know that relay by key');
          return;
        }
        var text = JSON.stringify({ app: 'relay', v: 1, body: bodyFor() });
        return router.post(url, key, text).then(function (answer) {
          var said = null;
          try { said = JSON.parse(answer && answer.text); }
          catch (e) { said = null; }
          var out = (said && said.body) || null;

          // THE POST FAILED — never got there, or nothing answered.
          // answer.status is the TRANSPORT's, and it is the right one to
          // report only here.
          if (!answer || !answer.ok) {
            fail(res, (answer && answer.status) || 502,
              (answer && answer.error) || 'the relay did not answer');
            return;
          }

          // THE POST ARRIVED AND THE RELAY SAID NO, which is a different
          // thing and was reported as the first one for exactly one live
          // request: a relay running older code answered `unknown
          // request`, and this node handed the browser HTTP 200 with an
          // error in the body — because it reached past the relay's
          // verdict to the transport's 200 behind it.
          //
          // A delivered refusal is 502 unless the relay named a status
          // itself. The transport's number is not in the chain at all.
          if (!out || !out.ok) {
            fail(res, (out && out.status) || 502,
              (out && out.error) || 'the relay refused');
            return;
          }
          onOk(out);
        });
      });
    });
  }

  // MINTING AN INVITE ON A RELAY THIS NODE OWNS.
  //
  // This door is unchanged — the browser still names a url and still gets
  // 201 and the invite back — and everything under it moved. There is no
  // `/api/relay/invite` any more and no mint signature.
  //
  // The spoken token rides inside the packet, which postMessage signs
  // whole, so it is still part of what was signed: the property A2 built
  // mintMessage's third field for, now had for free.
  function handleInvite(req, res, readJsonBody, deps) {
    return readJsonBody(req).then(function (body) {
      return askRelay(res, deps, body && body.url, function () {
        return {
          invite: {
            label: (body && body.label) || '',
            days: body && body.days,
            token: invites.normalizeToken(body && body.token),
          },
        };
      }, function (out) {
        // 201 and the invite itself, exactly as the relay route answered
        // before it was deleted: this is what Natter's mint form reads.
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(out.invite));
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // FORGETTING SOMEBODY — THE DOOR THIS VERB NEVER HAD.
  //
  //   Andy: "api/hub/remove-peer must be the interface"
  //
  // relay.removePeer has worked, been signed and been thorough since it
  // shipped, and NOTHING under run/ could reach it — no route here, no app
  // that asked. A person had no way to remove anybody from their own
  // relay. That is the impurity, and it is not a wrong protocol: it is an
  // absent one, which is harder to see because nothing about it is wrong
  // where you can read it.
  //
  // BY KEY.
  //
  //   Andy: "removePeer MUST be by ID"
  //
  // Labels duplicate by design — spirit-3 has two rows called `jazz`
  // today — so a removal naming one would delete whichever the relay
  // found first. The browser shows a label and sends the key, which is
  // how the census hands it over.
  function handleRemovePeer(req, res, readJsonBody, deps) {
    return readJsonBody(req).then(function (body) {
      var key = String((body && body.key) || '').trim();
      if (!key) {
        fail(res, 400, 'peer key required');
        return;
      }
      return askRelay(res, deps, body && body.url, function () {
        return { removePeer: { key: key } };
      }, function (out) {
        // What actually happened, whole: who went, how much of their mail
        // went with them, and how many invites were revoked so the name
        // is not a lie. An owner removing somebody should see the size of
        // what they did.
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(out));
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  // The request half of an inbox read, extracted so the browser's poll
  // and the node's own sweep ask the mailbox the same question. The apply
  // half is applyInboxBatch, above and outside this closure.
  function inboxRequest(url, name) {
    // Signed for the same reason claim and send are: in keys mode the
    // relay proves who is READING a mailbox, not just who is writing to
    // one. Unsigned when this node has no identity yet, which the relay
    // still accepts in open and names mode.
    var id = auth.loadIdentity(rootDir);
    var query = '?name=' + encodeURIComponent(name);
    // In a header, never on the URL: the relay refuses a query `sig`
    // outright, because a signature that has been in a URL is already
    // in an access log. Signed for this minute — the relay accepts the
    // one either side of its own clock and nothing further out.
    var headers = {};
    if (id && id.privateKey) {
      headers['X-Spirit-Sig'] = auth.sign(id.privateKey, auth.inboxMessage(name, Date.now()));
    }
    return relayRequest(url, 'GET', '/api/relay/inbox' + query, null, headers);
  }

  function handleInbox(req, res, urlObj) {
    withRelay(res, function (url) {
      var name = urlObj.searchParams.get('name') || '';
      inboxRequest(url, name)
        .then(function (r) {
          if (r.status !== 200) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }
          var parsed = null;
          try { parsed = JSON.parse(r.text); }
          catch (e) { parsed = null; }
          if (!parsed || !Array.isArray(parsed.messages)) {
            res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(r.text);
            return;
          }

          var body = applyInboxBatch(rootDir, parsed.messages, url);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(body));
        })
        .catch(function (err) { fail(res, 502, String(err.message || err)); });
    });
  }

  // The personal node reading its own mail with nobody watching.
  //
  // Called on a timer by server.js when this is NOT a --relay (packet 7).
  // No HTTP, no app involved, and it answers to nothing: the caller keeps
  // the side effects — rows for people who wrote, and the counters — and
  // throws the body away.
  //
  // Silent by design. A node with no identity has no mailbox to read and
  // no name to sign with; a node with no relay row has nowhere to ask. In
  // both cases there is nothing wrong, so there is nothing to say, and a
  // sweep that logged every minute would bury the console it shares with
  // the jobs it is meant to make visible.
  function sweepInbox() {
    var url = loadRelayUrl(rootDir);
    if (!url) return Promise.resolve(null);
    try { assertRelayUrl(url); }
    catch (e) { return Promise.resolve(null); }
    var id = auth.loadIdentity(rootDir);
    if (!id || !id.name) return Promise.resolve(null);
    return inboxRequest(url, id.name).then(function (r) {
      if (r.status !== 200) return null;
      var parsed = null;
      try { parsed = JSON.parse(r.text); }
      catch (e) { return null; }
      if (!parsed || !Array.isArray(parsed.messages)) return null;
      return applyInboxBatch(rootDir, parsed.messages, url);
    });
  }

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
          var mailboxKey = (parsed && parsed.mailboxPublicKey) || null;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          // The reserved name travels with the people, because it is a
          // destination the app must offer and never a peer it could
          // discover: `relay` cannot be claimed, so it is in no `who`.
          // Naming it here keeps the constant on the node beside the
          // relay that honours it (relayAuth.RESERVED_NAME).
          // This node's own key travels with the list, because being
          // added is the other half of adding: the person confirming a
          // tail has to hear it from somebody, and until now the only
          // way to read your own was to type `whoami` at the mailbox.
          var self = auth.loadIdentity(rootDir);
          res.end(JSON.stringify({
            relay: url,
            reservedName: auth.RESERVED_NAME,
            mailboxPublicKey: mailboxKey,
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
              publicLabel: found.publicLabel || found.name || '',
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

  function handleStatus(req, res, urlObj, deps) {
    var name = urlObj.searchParams.get('name') || '';
    // THE KEY, or every row comes back saying nothing about whether this
    // node is ON that relay.
    //
    // probe() computes `claimed` only when it is given a key to look for
    // in the census — `if (badge.owned || !myKey) return badge` — so
    // three arguments meant `claimed` was never set on any row, and
    // Natter's `owned || claimed` quietly collapsed to `owned`. Every
    // mailbox this node is merely BOUND to drew no panel at all.
    //
    // This is the same omission the device timer above already carries a
    // comment about: "the whole feature stopped at the owner for want of
    // one word." It was fixed there and missed here, which is what a
    // default parameter that means "answer less" will do.
    var me = auth.loadIdentity(rootDir);
    ownerBadge.probe(rootDir, name, function (url, method, pathname) {
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
    // The router. handleSend/handleInbox below are the ring it replaces —
    // listed next to each other on purpose, so the two transports are
    // visible as two transports until one of them goes.
    handlePost: handlePost,
    // The other half of the same concept: the live push carries what
    // arrives now, this carries what arrived while nobody was looking.
    handleSend: handleSend,
    handleInbox: handleInbox,
    // The same read, with nobody watching. server.js calls it on a timer
    // in personal mode only — see the comment on sweepInbox.
    sweepInbox: sweepInbox,
    handleStatus: handleStatus,
    handleWho: handleWho,
    handleHandle: handleHandle,
    handleContact: handleContact,
    handlePeer: handlePeer,
    handleInvite: handleInvite,
    handleRemovePeer: handleRemovePeer,
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
  unknownPolicy: unknownPolicy,
  acquireFromInbox: acquireFromInbox,
  handleMatches: handleMatches,
  keyTail: keyTail,
  partitionInbox: partitionInbox,
  holdFromInbox: holdFromInbox,
  applyInboxBatch: applyInboxBatch,
  countInbound: countInbound,
  unknownPolicy: unknownPolicy,
  decorateWithPacket: decorateWithPacket,
};
