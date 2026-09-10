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
const packet = require('./packet');
const peerFile = require('./peerFile');
const peerStats = require('./peerStats');
const deviceAuth = require('./deviceAuth');
const deviceTick = require('./deviceTick');

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
// One file: app/contacts/prefs.json. Contacts writes it, the hub reads
// it, Relay Chat polls and says nothing about it.
//
// Read per request rather than cached: it is one small file, an inbox
// poll is already a network round trip, and a cache would mean a change
// in Contacts not taking effect until something invalidated it.
var UNKNOWN_POLICIES = ['silent', 'hold', 'acquire'];
var UNKNOWN_PREFS_FILE = ['app', 'contacts', 'prefs.json'];

// Missing, empty, unreadable, not JSON, or not one of the three all read
// as `silent` — the tightest setting that still lets two people who
// added each other talk. The safe answer is also the default, so a
// broken file cannot quietly open a node up.
function unknownPolicy(rootDir) {
  var raw = null;
  try { raw = fs.readFileSync(path.join.apply(path, [rootDir].concat(UNKNOWN_PREFS_FILE)), 'utf8'); }
  catch (e) { return 'silent'; }
  var parsed = null;
  try { parsed = JSON.parse(raw); }
  catch (e) { return 'silent'; }
  var wanted = parsed && parsed.unknown;
  return UNKNOWN_POLICIES.indexOf(wanted) === -1 ? 'silent' : wanted;
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
function decorateWithPacket(message) {
  var decoded = packet.decode(message && message.text);
  var out = {};
  Object.keys(message || {}).forEach(function (key) { out[key] = message[key]; });
  out.packet = {
    legacy: !!decoded.legacy,
    app: decoded.app,
    id: decoded.id || null,
    body: decoded.body,
  };
  return out;
}

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
    fn(url);
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
    fn(chosen.url);
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
      return packet.encode(body.app, body.body === undefined ? '' : body.body);
    }
    // Legacy caller: a bare string, wired as it always was.
    return { ok: true, text: String((body && body.text) || '') };
  }

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
  function handleInvite(req, res, readJsonBody) {
    readJsonBody(req).then(function (body) {
      withChosenRelay(res, body && body.url, function (url) {
        var id = auth.loadIdentity(rootDir);
        if (!id || !id.privateKey) {
          fail(res, 403, 'no identity on this node');
          return;
        }
        var label = (body && body.label) || '';
        var days = body && body.days;
        // The spoken token, when Andy typed one, is part of what is
        // signed — not a field bolted on beside the signature. Empty
        // still means the relay picks the hex, and signs as it did
        // before A2.
        var token = invites.normalizeToken(body && body.token);
        relayRequest(url, 'POST', '/api/relay/invite', {
          name: (body && body.name) || id.name,
          label: label,
          days: days,
          token: token,
          sig: auth.sign(id.privateKey, invites.mintMessage(label, days, token)),
        })
          .then(function (r) {
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

  // ---- the listening window ------------------------------------------
  //
  // The timer exists ONLY while the window is open, and that is the
  // security control rather than a nicety: with it closed nothing on this
  // node asks any mailbox what is pending, so a stolen password buys a
  // held POST that expires unanswered.
  var DEVICE_TICK_MS = 2000;
  var deviceTimer = null;
  var deviceUrls = [];

  function stopDeviceTimer() {
    if (deviceTimer) {
      clearInterval(deviceTimer);
      deviceTimer = null;
    }
    deviceUrls = [];
  }

  // deviceTick wants parsed JSON or {ok:false}; relayRequest answers
  // {status, text}. The adapter lives here because that module is
  // deliberately socket-free — its own header says so — which is what
  // lets a test drive the whole handshake with no network at all.
  function deviceRequest(url, method, pathname, bodyObj) {
    return relayRequest(url, method, pathname, bodyObj)
      .then(function (r) {
        try { return JSON.parse(r.text); }
        catch (e) { return { ok: false }; }
      })
      .catch(function () { return { ok: false }; });
  }

  function startDeviceTimer() {
    stopDeviceTimer();
    var id = auth.loadIdentity(rootDir);
    var name = (id && id.name) || '';
    // Probed once, as the window opens, rather than on every tick. A
    // two-second poll that also asked every mailbox who owns it would be
    // three requests where one was wanted, and which relays this node
    // owns does not change inside a window somebody is standing at.
    return ownerBadge.probe(rootDir, name, function (url, method, pathname) {
      return relayRequest(url, method, pathname, null);
    })
      .then(function (summary) {
        deviceUrls = (summary && summary.ownedUrls) || [];
        deviceTimer = setInterval(function () {
          Promise.resolve()
            .then(function () { return deviceTick.tick(rootDir, deviceUrls, deviceRequest); })
            .catch(function () {});
        }, DEVICE_TICK_MS);
        if (deviceTimer.unref) deviceTimer.unref();
        return deviceUrls;
      })
      .catch(function () {
        deviceUrls = [];
        return [];
      });
  }

  // The password, so the shell can offer to copy it, and whether the
  // window is open.
  //
  // `listening` is the TIMER, not the file. They agree except across a
  // restart, where the file can say open while nothing is polling — and
  // a Natter row reading "Listening on" beside a form answering "not now"
  // is the one confusing state this whole design can produce. So the
  // answer is the live one: after a restart the window is shut, and
  // pressing the button opens it again.
  function handleDevice(req, res) {
    var doc = deviceAuth.ensurePassword(rootDir);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      password: doc.password,
      listening: !!deviceTimer,
    }));
  }

  function handleDeviceListen(req, res, readBody) {
    readBody(req).then(function (body) {
      var on = !!(body && body.on);
      deviceAuth.setListening(rootDir, on);
      if (!on) {
        stopDeviceTimer();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ listening: false, ownedUrls: [] }));
        return;
      }
      startDeviceTimer().then(function (urls) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ listening: !!deviceTimer, ownedUrls: urls }));
      });
    }).catch(function () {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid JSON body');
    });
  }

  function handleStatus(req, res, urlObj) {
    var name = urlObj.searchParams.get('name') || '';
    ownerBadge.probe(rootDir, name, function (url, method, pathname) {
      return relayRequest(url, method, pathname, null);
    })
      .then(function (summary) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          name: name,
          rows: summary.rows,
          ownedUrls: summary.ownedUrls,
          mustPick: summary.mustPick,
        }));
      })
      .catch(function (err) { fail(res, 502, String(err.message || err)); });
  }

  return {
    handleClaim: handleClaim,
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
    handleDevice: handleDevice,
    handleDeviceListen: handleDeviceListen,
  };
}

module.exports = {
  createHub: createHub,
  buildPeople: buildPeople,
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
