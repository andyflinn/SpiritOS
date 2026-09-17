'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');
const invites = require('./invites');
// One place decides how big a thing may be, and the browser reads the
// same file (js/limits.js). A cap the client pre-checks must be the cap
// the relay enforces, or the pre-check is a lie.
const limits = require('./limits.js');
const peerSearch = require('./peerSearch');
// parseKeyRow, and nothing else any more: a relay keeps no device key.
// The binding between a device and its node belongs to the node — see
// deviceAuth.js for why, and for the three hazards that deleted.
const deviceAuth = require('./deviceAuth');
const presence = require('./presence');
const routerTable = require('./router');
const relayStatus = require('./relayStatus');
// Once, at load, for the same reason server.js does it: the answer must
// describe the code that is running, not the code on disk.
const RUNNING = require('./buildStamp').resolve(path.join(__dirname, '..'));

// THE RING IS GONE (R8, 2026-09-15), and this is the whole of what it
// was: `send()` into a 200-entry `messages` array persisted inside
// routingTable.json, read back by polling `GET /api/relay/inbox`.
//
//   Andy: "the ring was a lie all along. it was unable to promise
//   reliable delivery anyways, because it dropped entries on overflow."
//
// Store-and-forward is only worth the storing if the store holds. That
// one was 200 entries GLOBAL — one array for every peer on the box,
// filtered per reader at read time — so it was worse than unreliable:
// a peer sending 200 messages TO THEMSELVES silently evicted every other
// peer's undelivered mail, and nothing anywhere was told. It offered a
// guarantee it could not make and could not even notice breaking, which
// is why decision 0006 sentenced it and why the deletion needed no
// migration (design/andy/relayStorage.md: "they are all noise").
//
// The router's answer to the same problem is to make no promise it
// cannot keep: delivered down a held stream, or refused at once. There
// is now one transport on this box and it is that one.
//
// What a routed request may carry — ONE number, shared with the browser
// that pre-checks it (js/limits.js). It used to say 16384 here while
// packet.js said 1024 about the identical string, so an app was refused
// at a sixteenth of what this would have taken.
//
// Still true, and still the reason a limit exists at all: the table caps
// concurrent requests and this caps what each one can push through a
// socket. The pair is what makes the relay's exposure a number rather
// than a hope — neither is meaningful alone, and raising one without the
// other moves the worst case linearly.
var MAX_ROUTED_TEXT = limits.PAYLOAD_MAX;

// How many rows a search answers with. Fixed, not measured — see the
// note at the cap itself.
//
// 32 x 418 worst-case bytes = 13376, inside the 16266 a packet leaves
// after its own envelope. PAYLOAD_MAX is the PACKET — the encoded
// envelope, which is what packet.js and MAX_ROUTED_TEXT both measure.
// `from`, `to` and `sig` sit OUTSIDE it and are covered by
// WIRE_HEADROOM in BODY_MAX, so they must not be subtracted here.
// Doing so once reserved room inside the packet for things that are
// not in it.
// SEARCH_SLOTS MOVED to peerSearch.SLOTS — the cap is part of the
// ranking question, not the relay's, and a second copy here is how
// the two would disagree about what a page is.
// WHAT THE ONE REFUSAL IS CALLED, and how long this relay will hold a
// browser's POST while the node answers.
//
// Both came from deviceHandshake.js, which was the RAM slot and the
// sixty-six seconds that had to outlast a sixty-second poll. There is no
// poll: an answer arrives in a round trip — 365ms through spirit-3 — and
// this is the backstop for a node that stops mid-exchange, not a window
// anybody waits out.
//
// The word stays deliberately incurious. The route says `not now` to a
// bad password, an unknown identity and a flood alike: it faces the
// internet and owes it no detail.
var DEVICE_REFUSAL = 'not now';
var ROUTE_WAIT_MS = 15000;
// Ten a minute per identity, which is what deviceHandshake.js allowed and
// is still the right number: a person pressing a button spends one, and
// the page itself no longer retries except on a 429. It is NAMED in the
// refusal — the one thing this route ever says precisely — because it is
// temporary and a page that knows it is rate-limited waits rather than
// gives up. Everything else gets `not now`.
var DEVICE_PER_MIN = 10;
// ── WHAT A LABEL MAY BE ──────────────────────────────────────────────
//
// The rule moved to js/labelRule.js on 2026-09-15 and this requires it.
//
//   Andy: "an input field should validate before taxing the wire. the
//   reason to have it there is to make it uniformely avalable to all
//   components. hops on wire can be saved etc..."
//
// It lived here, which was right while the relay was the only caller.
// An input field that checks before spending a round trip is a second
// caller, and a rule with two callers written in one of them is a rule
// that will be changed in one of them (ownerBadge.js says the same
// about its own).
//
// THIS FILE IS STILL THE ENFORCER. The browser half is a courtesy that
// saves a hop; the ledger is written here, and every claim and rename
// is checked here whatever any page believed.
var labelRule = require('./labelRule');

var CLAIM_PER_MIN = 10;

// ── POSTING HAD NO LIMIT AT ALL, AND THAT WAS NOT A DECISION ─────────
//
// Measured 2026-09-17: `rateOk` had exactly two call sites, `claim` and
// device enrolment. `routePost` — the thing that actually moves bytes —
// had none, so nothing counted posts per minute and a member could post
// as fast as they could open sockets. The "30 sends per minute per key" a
// few lines below reads like a live rule and is a comment about `send`,
// the ring route R8 deleted.
//
// HALF OF IT WAS ALREADY THERE, which is worth stating so this is not
// mistaken for a box with no defences: `routes.open` caps a requester's
// OUTSTANDING posts (`too many in flight`, DEFAULT_PER_REQUESTER) and the
// table caps the box (DEFAULT_MAX). That is the stock — what is held —
// and it is fair per requester already. What was missing is the FLOW:
// posts that complete promptly cost nothing against a stock limit, so a
// polite, fast, endless conversation was bounded by nothing at all.
//
// The far end was not covering for it either: the node's floor bounds
// only senders it has NEVER HEARD OF (peerPost.js), so between two
// acquainted peers there was no limit anywhere in the system.
//
//   Grok: "put a dumb rateOk on routePost before partner delivery."
//   Andy: "we already have packet delivery, that should be the bootstrap
//   for rate-management, there we get first measurements."
//
// DUMB ON PURPOSE, and temporary. CAPACITY.md's governor divides measured
// headroom and publishes the result; this is the backstop that holds the
// door until there is something in the ring to divide. A number chosen
// to bound a runaway and to be invisible to a person: ten a second is far
// past human, and far below what a loop can do.
//
// NAMED IN THE REFUSAL, like DEVICE_PER_MIN above — a page that knows it
// is rate-limited waits, where `not now` makes it guess.
// ── TWO BUDGETS, BECAUSE A PARTNER'S POST IS A MEMBER'S DEMAND ───────
//
//   Andy: "the budget for posts from partners must be a different POST
//   budget from members. Why? Because even incoming posts from partners
//   satisfy a need from my members. In fact, I need to tax the members to
//   keep my partners operational."
//
// A forward arriving from a partner is not foreign traffic: somebody's
// member is being reached because they want to be reachable. So the
// partner pool is infrastructure for member reach, funded out of the same
// total — and kept SEPARATE so that a partner having a bad day degrades
// reach without starving the members who paid for it.
//
// That separation is also what lets this box stay incurious about who at
// the far end sent anything. The pool IS the isolation, so there is no
// bucket per foreign member and nothing here learns who talks how much
// (CAPACITY.md, decided 0c).
var MEMBER_PER_MIN = 600;

// THE PARTNER POOL'S FLOOR, and the floor is all there is for now.
//
//   Grok: "floor in work, then observedPartnerFraction x total, taxed
//   from the member pool. Idle -> floor, not zero."
//
// IDLE MEANS FLOOR, NEVER ZERO, and that is the half worth not getting
// wrong: a pool of zero is a bootstrap deadlock. An unused partnership
// could never carry the first packet that would make it used, so the
// fraction could never rise, so the pool would stay zero for ever.
//
// The fraction is MEASURED here (meterRead().partnerFraction) and not yet
// ACTED ON: computing the pool from it is the governor's job, and the
// governor divides observed headroom that does not exist until the ring
// has run on a real box. So this is the starting declaration, in force
// until there is something to divide — not a constant anybody chose as
// correct.
var PARTNER_FLOOR_PER_MIN = 60;

var WINDOW_MS = 60 * 1000;
var RATE_KEY_SWEEP_AT = 1000;

// A RELAY IS NOT A MAILBOX, AND THIS FILE IS THE PROOF.
//
// It was called mailbox.json once, and what it holds is `peers` — name to
// public key, when they claimed, and which device keys may speak as
// them. That is a routing table. The relay had taken the name of a thing
// it is not.
//
// There are no mailboxes in the system (Andy). An application may have
// something it chooses to call one; this layer does not, and the word
// belongs nowhere near a box whose whole job is to route and forget.
//
// The name is now true of the contents. The `messages` ring was the one
// thing in this file that was not routing, and R8 deleted it — so a file
// called routingTable.json holds a routing table and nothing else.
function stateFile(rootDir) {
  return path.join(rootDir, 'relay-state', 'routingTable.json');
}

// THE LEGACY READ STOOD HERE, and it is gone.
//
//   Andy: "mailbox.json MUST go. NOW."
//
// When routingTable.json was named, spirit-3 had a live mailbox.json with
// everybody's rows in it — so this read the old name when the new one was
// absent, or an update would have dropped the whole roster with nothing
// on the outside saying so.
//
// It was a READ and never a migration: it re-read the old file on every
// boot, and only the next persist() — a claim or a removal, and in those
// days a send — wrote the new name. So deleting it was only safe once a
// live relay had actually written routingTable.json.
//
// spirit-3 has. Forced on 2026-09-13 with one self-addressed ring message
// (77 messages → 78, which is persist() running), and its census read 10
// rows before and 10 after. Every other relay in existence is a lab box
// built fresh.
//
// The stale file is left on disk rather than deleted by code — removing
// somebody's data on their box is their call, not a side effect of a
// boot. It stays unservable, and servableAssets.js still says so: a full
// roster sitting in relay-state must not become readable just because
// nothing reads it any more.
function loadRoutingTable(rootDir) {
  try {
    var raw = fs.readFileSync(stateFile(rootDir), 'utf8');
    var parsed = JSON.parse(raw);
    var peers = Object.create(null);
    if (parsed && parsed.peers && typeof parsed.peers === 'object') {
      Object.keys(parsed.peers).forEach(function (k) {
        var row = parsed.peers[k];
        if (!row || typeof row !== 'object') return;
        // ONE LABEL, NORMALISED ON THE WAY IN.
        //
        // A row carried `name` AND `publicLabel`, both set to the same
        // string at claim, and `labelOf()` existed only to reconcile
        // them. Residue from before peer-by-key: a label was an address
        // once, and then it stopped being one and nothing collapsed the
        // pair.
        //
        // `publicLabel` wins because it is the one that says what it is.
        // A row written by older code has the same value in both, so
        // this is a rename and not a choice — and `name` is dropped so
        // the next persist() writes one field.
        var one = {};
        Object.keys(row).forEach(function (f) {
          if (f !== 'name') one[f] = row[f];
        });
        one.publicLabel = String(row.publicLabel || row.name || '');
        peers[k] = one;
      });
    }
    // `messages` and `nextId` are READ AND DROPPED, which is the whole of
    // the ring's migration. A relay upgrading in place still has both in
    // its routingTable.json; the first persist() after this writes the
    // file without them, and the mail goes with it. Nothing is copied
    // anywhere first — Andy inspected spirit-3's 77 entries before
    // deciding: "they are all noise" (design/andy/relayStorage.md).
    return { peers: peers };
  } catch (e) {
    return { peers: Object.create(null) };
  }
}

function saveRoutingTable(rootDir, peers) {
  fs.mkdirSync(path.dirname(stateFile(rootDir)), { recursive: true });
  fs.writeFileSync(stateFile(rootDir), JSON.stringify({
    peers: peers,
  }));
}

// `deps.askPartner(url, relayKey, text)` answers a promise of the partner's
// reply text, or null. INJECTED, never reached for: it is this relay's own
// peerPost over relayRequest, wired in server.js, which is the one
// interface everything speaks through (AGENT.md, Comms). A relay built
// without it simply does not propagate — which is every existing test, and
// is why they did not have to change.
function createRelay(rootDir, deps) {
  deps = deps || {};
  var askPartner = typeof deps.askPartner === 'function' ? deps.askPartner : null;
  rootDir = rootDir || path.join(__dirname, '..');
  var loaded = loadRoutingTable(rootDir);
  var peers = loaded.peers;
  var allow = auth.loadAllow(rootDir);
  var claimHits = Object.create(null);
  // Enrolment attempts, per identity being enrolled. The limit lived in
  // deviceHandshake.js and came back here when that file went, because
  // the thing it bounds did not go anywhere: /api/relay/device is a
  // public POST carrying a password guess, and now every one of them
  // costs a post to the node as well. Keyed by TARGET rather than by
  // caller — the caller is whoever the internet sent, and what needs a
  // ceiling is how often one person's node can be made to answer.
  var deviceHits = Object.create(null);
  // Posts routed, per sender key. The sender is the identity that was
  // RESOLVED, never a name they chose — the reasoning is in the note on
  // `rateOk` below, and it is why the old per-name limit was worthless.
  // TWO POOLS, TWO BUCKETS. Keyed on the resolved sender either way — a
  // member key, a device key, or a partner's relay key — never on
  // anything the sender chose.
  var memberHits = Object.create(null);
  var partnerHits = Object.create(null);

  // What a partner may spend right now. A function rather than a constant
  // because the governor will compute it; today it answers the floor, and
  // the call site should not have to change when that stops being true.
  function partnerPerMin() {
    return PARTNER_FLOOR_PER_MIN;
  }

  // ── THE METER, WHICH MATTERS MORE THAN THE GATE ──────────────────────
  //
  //   Andy: "a relay's capacity is primarily governed by its own RAM and
  //   by its network bandwidth" — and "there we get first measurements".
  //
  // A fixed ring of what this box actually moved. It exists so the
  // governor in CAPACITY.md can be built against observation instead of
  // against a guess, and it starts filling from ordinary member-to-member
  // traffic today, long before any partner delivery exists.
  //
  // AGGREGATE ONLY, NEVER PER-PEER. The same ring kept per member would be
  // a record of who talks how much and when — what this system refuses to
  // hold — arriving by the side door as a performance feature, in a file
  // nobody thinks of as a ledger. The precedent is the route-usage note in
  // PARTNERS.md: "in memory is the whole point: it resets on restart, it
  // is never served, and it describes the relay's own work rather than
  // anybody's traffic."
  //
  // FIXED SIZE, because the resource it reports on is the one it spends.
  // A ring that grew under load would be the instrument consuming what it
  // was built to measure.
  //
  // ── AND IT HAS A FLOOR, IN BOTH DIRECTIONS ─────────────────────────
  //
  //   Grok: "measurement ring has a floor in slots and in time span;
  //   never slower than 5s samples."
  //
  // The governor shrinks its own instrumentation under memory pressure —
  // which degrades measurement quality at exactly the moment the
  // decisions are hardest. Both bounds are needed and neither implies the
  // other: ten slots of sixty seconds is ten minutes of mush, ten slots
  // of one second is ten seconds of detail, and neither is usable. So the
  // ring keeps a minimum number of slots AND a minimum span, and a sample
  // may never be coarser than five seconds — past that a burst is
  // invisible, which is the one thing it is watching for.
  var METER_SLOTS = 120;
  var METER_SLOTS_MIN = 20;
  var METER_SPAN_MIN_S = 120;
  var METER_SAMPLE_MAX_S = 5;
  var meter = { at: 0, slots: [], sampleS: 1 };

  // What the ring may be shrunk to, and the answer is never "as small as
  // you like". Exported as a function so the governor has one place to
  // ask rather than three constants to respect.
  function meterFloor(wantSlots, wantSampleS) {
    var sampleS = Math.min(Math.max(1, wantSampleS || 1), METER_SAMPLE_MAX_S);
    var slots = Math.max(METER_SLOTS_MIN, wantSlots || METER_SLOTS);
    // The span floor can force more slots back than the slot floor did:
    // a coarse sample with few slots still has to cover the minimum
    // window, which is what stops "smaller and slower" becoming "blind".
    var neededForSpan = Math.ceil(METER_SPAN_MIN_S / sampleS);
    return { slots: Math.max(slots, neededForSpan), sampleS: sampleS };
  }

  // One slot per second of wall clock, overwriting the oldest. `bytes` is
  // what crossed in that second; `posts` is how many; `peak` is the most
  // outstanding routes seen — the RAM meter beside the bandwidth one,
  // since CAPACITY.md's governor reads several and not a fixed pair.
  //
  // `fromPartner` is counted as a COUNT, not as an identity: two integers
  // per slot, so the relay can say what share of its work crossed a
  // partnership without holding anything about who did it. That share is
  // the input Grok's formula wants — "observedPartnerFraction x total" —
  // and measuring it is this file's job where dividing by it is the
  // governor's.
  function meterNote(bytes, fromPartner) {
    var second = Math.floor(Date.now() / 1000);
    var head = meter.slots[meter.slots.length - 1];
    if (!head || head.second !== second) {
      head = { second: second, bytes: 0, posts: 0, peak: 0, partnerPosts: 0 };
      meter.slots.push(head);
      if (meter.slots.length > METER_SLOTS) meter.slots.shift();
    }
    head.bytes += bytes;
    head.posts += 1;
    if (fromPartner) head.partnerPosts += 1;
    // `size()` rather than a counter of our own, and it sweeps expired
    // entries on the way past — so the peak is live routes, never a
    // backlog of ones that timed out.
    var open = routes.size();
    if (open > head.peak) head.peak = open;
  }

  // What the ring says, for the owner's report and for the governor when
  // it exists. Derived on the way out rather than kept: a running total
  // would be a second thing to get wrong.
  function meterRead() {
    var cut = Math.floor(Date.now() / 1000) - METER_SLOTS;
    var live = meter.slots.filter(function (s) { return s.second > cut; });
    var bytes = 0, posts = 0, peak = 0, partnerPosts = 0;
    live.forEach(function (s) {
      bytes += s.bytes; posts += s.posts;
      partnerPosts += (s.partnerPosts || 0);
      if (s.peak > peak) peak = s.peak;
    });
    return {
      seconds: live.length,
      bytes: bytes,
      posts: posts,
      peakRoutes: peak,
      // THE INPUT THE PARTNER POOL IS WAITING FOR. Measured now, acted on
      // by the governor later — today the pool answers its floor. Zero
      // when nothing has crossed a partnership, which is the common case
      // on a relay with no partners and is why the floor exists.
      partnerPosts: partnerPosts,
      partnerFraction: posts ? (partnerPosts / posts) : 0,
      // The one figure a governor would divide. Honest about the window
      // rather than extrapolated from a short one.
      bytesPerSec: live.length ? Math.round(bytes / live.length) : 0,
    };
  }

  // THE RAM SLOT IS GONE, and so is the poll that read it. An offer is
  // no longer parked for a node to come and find: it is posted to the
  // node on the stream it already holds, and answered in a round trip.
  // What waits now is the browser's own POST, held in `awaitingReply`
  // below and keyed by the hash of the request made on its behalf.
  // Who is holding a stream open right now. In RAM, never persisted —
  // presence is true only while a socket is open (PRESENCE.md §4).
  var presentNow = presence.createRegistry();
  // Pending requests: hash -> who asked, who was asked. No bodies, never
  // disk. `open()` performs the delivery itself, so nothing here can
  // forward a request it could not match the reply to (ROUTER.md §4b).
  var routes = routerTable.createRouter();

  function persist() {
    saveRoutingTable(rootDir, peers);
  }

  function reloadAllow() {
    allow = auth.loadAllow(rootDir);
  }

  // Drops every key whose window has fully expired. Without this the
  // buckets only ever grew: one entry per distinct key, kept forever, on a
  // box with about a gigabyte of RAM.
  function sweep(bucket) {
    var now = Date.now();
    Object.keys(bucket).forEach(function (k) {
      var kept = bucket[k].filter(function (t) { return now - t < WINDOW_MS; });
      if (kept.length === 0) delete bucket[k];
      else bucket[k] = kept;
    });
  }

  // `key` is the CALLER, not the name the caller claims to be. Keying on
  // the claimed name made the limit meaningless: 30 sends per minute per
  // name, with the name chosen by the sender, is 30 per minute per made-up
  // string — rotate it and the budget resets, which is exactly what an
  // abuser does and never what a real client does. Peer-by-key moved the
  // send limit back onto `from`; it belongs on the socket. An unidentified
  // caller (a direct in-process call, no socket) shares one bucket rather
  // than getting a free pass.
  function rateOk(bucket, key, limit) {
    if (Object.keys(bucket).length > RATE_KEY_SWEEP_AT) sweep(bucket);
    var now = Date.now();
    var k = key || '(unidentified)';
    var list = (bucket[k] || []).filter(function (t) { return now - t < WINDOW_MS; });
    if (list.length >= limit) {
      bucket[k] = list;
      return false;
    }
    list.push(now);
    bucket[k] = list;
    return true;
  }

  // Thin wrappers, so the twelve call sites below read as they always
  // have. The rule itself is labelRule.js — see the note at the head of
  // this file about why it left.
  function normalizeName(name) { return labelRule.normalize(name); }
  function labelProblem(n) { return labelRule.problem(n); }
  function spokenOk(n) { return labelRule.spokenOk(n); }

  // A PEER IS ITS KEY. A `|| peer.name` fallback stood here for rows
  // filed under a label, and went with them — every row has a key now,
  // so an id that was ever a name could only belong to a row predating
  // the rule, which cannot be addressed anyway.
  function peerId(peer) {
    return (peer && peer.publicKey) || '';
  }

  // ONE FIELD. It read `publicLabel || name` while a row carried both,
  // which is what this function existed for. loadRoutingTable collapses
  // the pair on the way in, so there is nothing left to reconcile and
  // this is only a guard against a missing row.
  function labelOf(peer) {
    return (peer && peer.publicLabel) || '';
  }

  function listPeers() {
    return Object.keys(peers).map(function (k) { return peers[k]; });
  }

  function findByKey(publicKey) {
    if (!publicKey) return null;
    if (peers[publicKey]) return peers[publicKey];
    var list = listPeers();
    for (var i = 0; i < list.length; i++) {
      if (list[i].publicKey === publicKey) return list[i];
    }
    return null;
  }

  // ONE HIT OR NOBODY. Two peers may wear one label by design, so a
  // label that two rows answer to identifies neither — and this returns
  // null rather than picking, which is the rule that stops "whichever
  // john this box found first" being an answer anywhere.
  //
  // A KEYLESS FALLBACK STOOD HERE — `peers[n] && !peers[n].publicKey` —
  // for rows keyed by name rather than by key. Gone with the pair: every
  // claim needs a key now, so every row has one and the map is keyed by
  // it. A row from older code that has no key is not addressable on this
  // wire by any means, so finding it by label bought nothing.
  function findByLabel(label) {
    var n = normalizeName(label);
    var hits = listPeers().filter(function (p) { return labelOf(p) === n; });
    return hits.length === 1 ? hits[0] : null;
  }

  // resolveParty STOOD HERE — token to party, with an `ambiguous` answer
  // for the two-johns case. Its only callers were `send` and `inbox`, and
  // it went with them (R8).
  //
  // The router never needed it. `deviceIdentity` resolves a row by KEY,
  // which is what an address is on this wire, so the ambiguity a LABEL
  // creates cannot arise: two johns are two keys and always were. The
  // ring is what made labels addressable, and that is the half of the
  // old transport that is not worth rebuilding.

  function who() {
    return listPeers().map(function (p) {
      return {
        // `name` STOOD BESIDE THIS, carrying the identical value. Two
        // spellings of one fact on a public route, so every reader had
        // to know which to trust and none could be told apart. Gone
        // 2026-09-15 — a census row says a peer's label once.
        publicLabel: labelOf(p),
        publicKey: p.publicKey || null,
        // WHEN THIS KEY ENROLLED, published here all along with nothing
        // reading it. It is the human-usable way to tell two johns
        // apart — "the john who joined in March" rather than six
        // characters of key — and it must never be rewritten, or the
        // ledger stops being one.
        claimedAt: p.claimedAt,
        owner: !!p.owner,
      };
    }).sort(function (a, b) {
      return String(a.publicLabel).localeCompare(String(b.publicLabel));
    });
  }

  // THIS RELAY'S OWN KEY, not the owner's. The keypair is made once, on
  // the first --relay boot (server.js), and lives in this process's own
  // relay-state like any other identity.
  //
  // Public, deliberately: it names the relay the way a peer's key names
  // a peer, and it is the half that may be handed out.
  //
  // ── IT WAS CALLED mailboxPublicKey UNTIL 2026-09-15 ────────────────
  //
  // The ring went in R8 and the word was retired in DICTIONARY.md,
  // but it survived here — in a field name, on the wire, read by
  // answerRelay to pin a relay's identity on first use.
  //
  // The old note here justified RESERVED_NAME: "a node that keeps one
  // file per peer cannot file the relay anywhere without one". That was
  // true when it was written and stopped being true when relayKeys.js
  // arrived to file relays by key. Both are gone now; see relayAuth.js.
  //
  // A STALE NODE BREAKS ON THIS, and aimed: it pins `undefined`,
  // answerRelay refuses the relay, and that node's calls fail while
  // everything not keyed on this field keeps working. Note that
  // protocolSurface.js CANNOT see this change — the register counts
  // doors, not the shape of what comes back through them.
  function relayPublicKey() {
    var id = auth.loadIdentity(rootDir);
    return (id && id.publicKey) || null;
  }

  // ── AND WHAT THIS RELAY CALLS ITSELF ────────────────────────────────
  //
  //   Andy: "the owner should be able to change the public label of his
  //   relay... it lives in the json file on the relay that holds the
  //   relay's key: key and label are a pair, in keyed mode."
  //
  // WHICH IS WHY IT IS HERE AND NOT IN routingTable.json. That file is
  // `peers` and nothing else — decision 0006, a relay stores nothing on
  // anyone's BEHALF, and spirit/test/labPersistence.js now asserts the
  // shape. A relay's own name is not held on anyone's behalf; it is the
  // other half of its own identity, and identity.json has carried a
  // `name` field since the day keys existed. It was simply never
  // published.
  //
  // So this adds no file and no persist shape. It publishes a pair that
  // was already written down.
  //
  // EMPTY IS A REAL ANSWER and reads as "this relay has not been named".
  // A box that ships without one must not invent a caption for itself —
  // the list is the reader's to name until the owner says otherwise,
  // which is what natterDetails' own relayLabel has always done locally.
// globMatches AND matchRank MOVED to js/peerSearch.js, 2026-09-16.
//
// They were the only judgement in this file about what a person meant by
// a search, which is a question with no settled answer — Andy: "quality-
// of-result measurements etc. are up in the air." A relay is the wrong
// place for anything that is going to keep changing: it is the part of
// the system that must be dull.

  function relayLabel() {
    var id = auth.loadIdentity(rootDir);
    var name = String((id && id.name) || '').trim();
    // The relay's identity is minted with the name `relay` (labWorld,
    // install). That is a type, not a caption, and publishing it would
    // put the word on every unnamed box as though somebody chose it.
    return name === 'relay' ? '' : name;
  }

  // ── PARTNERSHIP, TIER ONE: THE FLAG AND NOTHING ELSE ────────────────
  //
  //   Andy: "every relay can promote a peer to 'partner' status in the
  //   peer-ledger… a non-owner peer possesses his own relay somewhere."
  //
  // After this, a relay KNOWS who its partners are and nothing routes
  // differently. That is the whole of the tier, and it is useful alone:
  // the flag is what everything after it depends on, and until the route
  // table exists a relay simply refuses a stranger exactly as before.
  //
  // WHAT IS STORED IS THIS RELAY'S OWN RELATIONSHIP, never their members
  // (design/relay/PARTNERS.md):
  //
  //   partner: { url, relayKey, since }
  //
  // Three facts about a peer's row here. `url` because A KEY IS NOT AN
  // ADDRESS — nothing on this wire maps one to the other, which is why
  // the owner supplies it. `relayKey` because the forward hop in a later
  // tier must verify the partner signing as itself, and the moment to
  // capture that is while somebody is looking at the census that proves
  // the partnership.
  //
  // 0006 IS UNTOUCHED. Their ledger is not here and never will be — the
  // hard rule is that a relay never persists one — so routingTable.json
  // keeps its shape, `peers` and nothing else, which labPersistence
  // asserts.
  //
  // THE RECIPROCITY CHECK IS NOT HERE, and that is deliberate. The proof
  // is a public census: anybody may read `/api/relay/who` and see which
  // key is marked owner (0010 — it is the bootstrap). So the owner's NODE
  // fetches it and this stores the conclusion, and a relay still never
  // makes an outbound request. A node reporting a public page is not
  // laundering privilege; it saw nothing this box could not have seen.
  function setPartner(who, key, url, relayKey, hash) {
    var peerKey = String(key == null ? '' : key).trim();
    if (!peerKey) return { ok: false, status: 400, error: 'peer key required' };

    var row = findByKey(peerKey);
    if (!row) return { ok: false, status: 404, error: 'no such peer' };

    var at = String(url == null ? '' : url).trim().replace(/\/+$/, '');
    if (!at) return { ok: false, status: 400, error: 'partner relay url required' };
    var theirKey = String(relayKey == null ? '' : relayKey).trim();
    if (!theirKey) return { ok: false, status: 400, error: 'partner relay key required' };
    // Their relay's key, not their own. Two keys, two jobs — you verify
    // ownership against the OWNER row and you pin the RELAY key for the
    // hop, and conflating them is the likeliest bug in this design.
    if (theirKey === peerKey) {
      return { ok: false, status: 400, error: 'that is the peer’s own key, not their relay’s' };
    }

    // ── A RELAY IS NOT ITS OWN PARTNER ─────────────────────────────────
    //
    //   Andy: "the relays need to be different, the owners? why?"
    //
    // This read `if (row.owner)` and refused, with the reason "the
    // owner's own row is this box, and partnering with yourself would be
    // a route to where you already are". That is the same sentence as
    // "not this box" only while ONE KEY OWNS ONE RELAY. Own twenty and
    // your key is `owner: true` on all twenty, while A and B are
    // genuinely different machines — so the check refused the thing it
    // was never about.
    //
    // "Not the owner" was shorthand. Only "not this box" was ever the
    // invariant, and the vocabulary to say it exactly was already here:
    // the line above insists the RELAY key differs from the PEER key —
    // two keys, two jobs — and then the old gate conflated them anyway,
    // one line later, by testing whose key sits in allow.json.
    //
    // It is also STRICTER than what it replaced. The old check would
    // happily partner this box with itself through any non-owner peer
    // who named this relay's own url; this one cannot, because the
    // identity compared is the box's.
    //
    // Nothing else weakens. The reciprocity proof (decided 2 and 4) is
    // the far census showing that key marked owner — with one owner it
    // proves "one key owns both", which is true, public, and checkable
    // by key. No third party's consent is bypassed: partnering only
    // creates routes between the two relays' own members, and the other
    // relay's owner must promote this one in turn.
    if (theirKey === relayPublicKey()) {
      return { ok: false, status: 400, error: 'that is this relay' };
    }

    if (row.partner && row.partner.url === at && row.partner.relayKey === theirKey) {
      return { ok: true, status: 200, unchanged: true, partner: row.partner };
    }

    row.partner = {
      url: at,
      relayKey: theirKey,
      // Written once, like claimedAt: it says when this partnership
      // began, and a re-promotion to the same relay does not reach here.
      since: (row.partner && row.partner.since) || new Date().toISOString(),
    };
    persist();

    ownerEvent('partner-added', {
      key: peerKey, label: row.publicLabel || '', relayAt: at, cause: hash,
    });
    return { ok: true, status: 200, partner: row.partner };
  }

  // BREAKING IS ONE SIDE'S DECISION, and needs no protocol. A partnership
  // is two unilateral choices that happen to agree (PARTNERS.md) — so
  // this clears the flag here and the other relay finds out, if it ever
  // matters, by being refused.
  function clearPartner(who, key, hash) {
    var peerKey = String(key == null ? '' : key).trim();
    if (!peerKey) return { ok: false, status: 400, error: 'peer key required' };

    var row = findByKey(peerKey);
    if (!row) return { ok: false, status: 404, error: 'no such peer' };
    if (!row.partner) return { ok: true, status: 200, unchanged: true };

    var was = row.partner;
    delete row.partner;
    persist();

    ownerEvent('partner-removed', {
      key: peerKey, label: row.publicLabel || '', relayAt: was.url, cause: hash,
    });
    return { ok: true, status: 200, removed: was };
  }

  // Everything this relay partners with, for the owner's own report. Not
  // in `who()`: a partnership is a public statement of association
  // between two relays, and there is no reason yet for a stranger to read
  // one. Owner-only until somebody needs otherwise.
  // ── A PARTNER RELAY, RECOGNISED BY THE KEY IT SIGNS WITH ───────────
  //
  // A partner is NOT a member and must never become one. Its relay key is
  // not a row in `peers`, is not in the census, and cannot claim a label —
  // so `deviceIdentity` answers null for it, which is correct and is why
  // this exists separately rather than as a branch inside that.
  //
  // THE PINNED KEY IS THE WHOLE PROOF. It was written down at promotion,
  // by the owner, against a relay they had verified (PARTNERS.md item 2).
  // Nothing here trusts a URL, a label, or anything the caller says about
  // itself: the signature verifies against the pinned key or the caller is
  // a stranger.
  function partnerByRelayKey(key) {
    var k = String(key == null ? '' : key).trim();
    if (!k) return null;
    var rows = listPeers();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row && row.partner && row.partner.relayKey === k) return row;
    }
    return null;
  }

  // The identity a partner gets. Deliberately NOT shaped like a member's:
  // no `peer`, no label, and `partner: true` so every gate downstream has
  // to have thought about it rather than inheriting a member's standing by
  // having the same fields.
  function partnerIdentity(token) {
    var row = partnerByRelayKey(token);
    if (!row) return null;
    return {
      id: String(token).trim(),
      publicKey: String(token).trim(),
      owner: false,
      partner: true,
      // Whose relay it is — recorded for the log, never for a decision.
      // Andy: "i might ban a peer, but still want his relays to help
      // mine." Partnership is between relays; the owner's row is evidence
      // of how it was made, not a standing condition.
      ownerKey: row.publicKey,
    };
  }

  function partners() {
    return listPeers()
      .filter(function (p) { return p && p.partner; })
      .map(function (p) {
        return {
          key: p.publicKey,
          label: p.publicLabel || '',
          url: p.partner.url,
          relayKey: p.partner.relayKey,
          since: p.partner.since,
        };
      });
  }

  // Owner-only, and enforced by the caller: this is reached from
  // answerSelf's `owner` branch, which has already verified the post
  // against the row marked owner in allow.json.
  //
  // THE SAME RULE AS ANY OTHER PUBLIC LABEL (js/labelRule.js). A relay's
  // caption goes in the same lists, next to the same peers, and an
  // invisible character is the same impersonation here as anywhere.
  function setRelayLabel(next, hash) {
    var id = auth.loadIdentity(rootDir);
    if (!id) return { ok: false, status: 409, error: 'this relay has no key yet' };

    var wanted = normalizeName(next);
    var bad = labelProblem(wanted);
    if (bad) return { ok: false, status: 400, error: bad };

    var was = relayLabel();
    id.name = wanted;
    try { auth.saveIdentity(rootDir, id); }
    catch (e) { return { ok: false, status: 500, error: 'could not write identity.json' }; }

    ownerEvent('relay-renamed', { was: was, label: wanted, cause: hash });
    return { ok: true, status: 200, label: wanted };
  }

  function snapshot() {
    return {
      owner: auth.ownerName(allow),
      mode: allow.mode,
      // `reserved: auth.RESERVED_NAME` STOOD HERE, justified as a fact a
      // browser building a claim form needed. No browser ever read it —
      // hub forwarded it to the page as `reservedName` and nothing on the
      // other side looked. Gone with the reservation itself.
      relayPublicKey: relayPublicKey(),
      // The other half of the pair (Andy: "key and label are a pair, in
      // keyed mode").
      relayLabel: relayLabel(),
      peers: who(),
      // `messages: messages.length` STOOD HERE and went with the ring.
      // A relay stores nothing on anyone's behalf (0006), so there is no
      // count to report — the honest number is not zero, it is that the
      // question no longer applies. relayStatus.js and natterDetails
      // read the absence rather than a 0.
    };
  }

  function becomeOwner(name, publicKey) {
    auth.writeAllowKeys(rootDir, [{ name: name, publicKey: publicKey }]);
    reloadAllow();
  }

  // EVERY ATTEMPT TIDIES UP AFTER ITSELF.
  //
  //   Andy: "when an invite is redeemed, the success should depend on an
  //   expiry check, after any attempt to redeem token the invite list
  //   should be cleaned up."
  //
  // The expiry check was always there — invites.match refuses a row past
  // its expiresAt, and that is what decides the claim. What was missing is
  // the second half: nothing swept. sweepExpired ran only when somebody
  // was removed, so a relay nobody administers kept dead invites for ever.
  //
  // AFTER, not before, and whatever the attempt decided: a good token, a
  // wrong label, an expired row, a token that was never real. The point is
  // that somebody touched the file, not that they were entitled to.
  //
  // Cheap on a refusal too, which is what makes it safe to do on the
  // unauthenticated path: sweepExpired writes only when a row actually
  // went, so a stranger hammering bad tokens costs one write and then
  // none. And it cannot take the row this attempt just matched — match
  // already refused anything expired.
  function redeem(token, label) {
    var found = invites.match(rootDir, token, label);
    invites.sweepExpired(rootDir);
    return found;
  }

  // `name` IS WHAT THE CLAIMER WILL BE CALLED. `inviteLabel` is the word
  // the owner wrote on the invite, and they are two different things —
  // which is the whole of R1 (design/cycles/2026-09-15-labels-are-not-
  // identities.md).
  //
  //   Andy: "after enrollment the public label of an ID is property of
  //   the ID... the relay owner will not be allowed to control the public
  //   label of any keyed peer."
  //
  // They were ONE argument until 2026-09-15, because `match` demanded the
  // claim's name equal the invite's label. That made the owner's word the
  // peer's permanent name — and since `who()` publishes it unsigned, it
  // published whatever the owner used to identify the invitee. An invite
  // labelled with a phone number put that number in a public census.
  //
  // THE LABEL STILL PROVES. It is not merely a caption: an invite is
  // KEYLESS, so the token is the entire credential, and a SPOKEN token is
  // held only to SPOKEN_RE — no length floor, no entropy floor. `dog` is a
  // legal token. On that path the invite label is the second factor, and
  // an earlier draft of this change that dropped it was wrong for exactly
  // that reason (Andy: "invites are keyless, i don't understand how we
  // can drop the label out of the match() call?").
  //
  // So: matched, never stored. `inviteLabel` reaches `redeem` and nothing
  // else; the row below is written with `n`.
  //
  // NO FALLBACK. A claim carrying a token must carry the invite label
  // too; one that sends a single name is refused.
  //
  //   Andy: "i dislike a relay supporting stale nodes at this point the
  //   nodes should break rather than STILL having code on a relay that
  //   support old crap"
  //
  // This DID fall back to `n` for a few hours after R1 landed, on the
  // reasoning that a node not yet updated should keep working. That is a
  // relay carrying a node's obsolescence, and the relay is the worst
  // place to put it: it is the thing every node depends on, so a shim
  // here is one nobody is ever forced to remove. A node that breaks gets
  // fixed. A relay that forgives does not.
  //
  // And it is the SECOND FACTOR. A second factor that can be silently
  // defaulted from the first is not a second factor.
  //
  // `seen` is how the wrapper below learns whether this attempt got past
  // the rate gate, and under what words. Out-parameter rather than a
  // richer return, so every one of the eleven refusals below stays the
  // single line it is.
  function claimAttempt(name, sig, publicKey, clientKey, inviteToken, inviteLabel, seen) {
    var inviteRow = null;
    // ── SIGNED AS SENT, STORED AS NORMALISED ─────────────────────────
    //
    // `n` is the canonical form and it is what the ledger keeps. The
    // SIGNATURE is checked against `asSent` — the bytes that actually
    // arrived — because that is what the claimer signed: hub.signedClaim
    // signs `claimMessage(name)` with the same `name` it puts in the
    // body, so the wire value is the only string both ends can agree on.
    //
    // Verifying the normalised form instead would break every claim that
    // normalisation touches: type two spaces, the node signs two, the
    // relay collapses to one and rejects the signature it just changed.
    // That reads as `bad claim signature` and would be maddening.
    //
    // The signature still proves the key asked for this claim.
    // Normalising afterwards canonicalises WHAT it asked for; it does not
    // let anybody claim anything they did not sign for.
    var asSent = typeof name === 'string' ? name : '';
    var n = normalizeName(name);
    var onInvite = normalizeName(inviteLabel);
    seen.label = n;
    seen.invite = onInvite;
    // The PUBLIC label the claimer picks for itself — permissive.
    var badLabel = labelProblem(n);
    if (badLabel) return { ok: false, status: 400, error: badLabel };
    // A `name reserved` refusal stood here, for the caption `relay`. It
    // went with RESERVED_NAME — see relayAuth.js. A label is a caption,
    // the relay is a key, and nothing a claimer can type reaches it.
    if (!rateOk(claimHits, clientKey, CLAIM_PER_MIN)) {
      return { ok: false, status: 429, error: 'too many claims' };
    }
    // PAST THE GATE, and this line is what bounds the owner's stream.
    // Everything above is reachable by anyone on the internet without
    // limit — /api/relay/claim is a public POST — so an event fired
    // before here would let a stranger drive the owner's notifications
    // as fast as they can send. That is the B1 hazard in a new dress: a
    // thing keyed by caller-chosen input grows when a stranger reaches
    // it, so a stranger must not reach it.
    //
    // After here, an attempt has already spent one of ten a minute, so
    // the existing limit caps the notices too. No second mechanism.
    seen.gate = true;

    // pending-owner only means anything while the relay is empty: it
    // names who may take the FIRST claim. If peers are already on the box
    // there is no first claim left to reserve, so the file is stale — drop
    // it rather than leaving a relay where no name but the pending one
    // can ever be claimed again.
    var pending = auth.loadPendingOwner(rootDir);
    var empty = listPeers().length === 0;
    if (pending && !empty) {
      auth.clearPendingOwner(rootDir);
      pending = null;
    }
    var firstOwner = empty && !!(pending || allow.mode === 'open');
    if (pending && n !== pending) {
      return { ok: false, status: 403, error: 'name not allowed' };
    }

    if (firstOwner) {
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'first claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(asSent), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      becomeOwner(n, publicKey);
      auth.clearPendingOwner(rootDir);
    // A NAMES-MODE BRANCH STOOD HERE and went with the mode on
    // 2026-09-15 (see relayAuth.loadAllow for why the mode went). It was
    // the invite's original home: a guest list of bare labels, with a
    // token as the escape hatch so an owner could let somebody in without
    // SSH-editing allow.json.
    //
    // The escape hatch is now the front door. Keys mode has its own
    // invite lock below — cycle 4 landed, whatever the comment that stood
    // here said about it not having — so deleting this removes a second
    // place where a token was consumed, not the feature.
    } else if (allow.mode === 'keys') {
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(asSent), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      // This is the lock 0003 promised: after first-claim-is-owner, a new
      // key gets on the box only with a live invite the owner minted for
      // that exact label. It is NOT the first owner's path — firstOwner
      // is handled above and needs no invite, because there is nobody to
      // invite them yet.
      //
      // Two johns is still two keys; it is now also two invites. The
      // label is not what is scarce, the token is.
      //
      // REDEEMED ON `onInvite`, WRITTEN AS `n`. The invite's label is
      // proof — the second factor on a token that may be a spoken word —
      // and the claimer's own `n` is what the row and the census get.
      // They were the same string until 2026-09-15; see the note on this
      // function for why that published the owner's word for somebody.
      //
      // A key already in allow.json is not a NEW key — it is the owner,
      // and the owner is never someone the box has to be invited into.
      // Without this, a relay whose allow.json outlived its routing table
      // (a restore, a lost peer record) locks its own owner out: no peer,
      // so no first-owner path, and no invite, because the only account
      // that can mint one is the one being refused.
      var allowed = allow.byName[n];
      if (!allowed || allowed !== publicKey) {
        if (!inviteToken) {
          return { ok: false, status: 403, error: 'invite required' };
        }
        // THE OTHER HALF OF THE INVITE, and a 400 rather than a 403: this
        // is a malformed request, not a refused one. A caller that sends
        // a token and no label is a node that predates R1, and saying so
        // plainly is the whole point of not falling back — it names what
        // is wrong instead of quietly enrolling somebody under the
        // owner's word for them.
        if (!onInvite) {
          return { ok: false, status: 400, error: 'invite label required' };
        }
        var keysInvite = redeem(inviteToken, onInvite);
        if (!keysInvite.ok) return keysInvite;
        inviteRow = keysInvite.invite;
      }
    } else {
      var gate = auth.checkClaim(allow, n, sig);
      if (!gate.ok) return gate;
    }

    // EVERY ROW HAS A KEY, and this is where that becomes true rather
    // than merely usual.
    //
    // `open` mode could admit a claim with no key at all — the only path
    // that ever could — and the row was then filed under its NAME. That
    // is what made `peers` a map of two kinds of thing, what
    // `findByLabel` needed a keyless branch for, and what kept `name`
    // alive beside `publicLabel`.
    //
    // It was unreachable in practice anyway: the first claim on an open
    // box takes the owner path, which demands a key and writes
    // allow.json — so `open` with peers already on it requires somebody
    // to have deleted allow.json by hand. A recovery state, not a way in.
    //
    // Refused rather than migrated. A keyless row cannot open a stream,
    // cannot post, cannot be posted to, and cannot be told apart from
    // another wearing the same label. A row that exists and can do
    // nothing is worse than no row.
    if (!publicKey) {
      return { ok: false, status: 400, error: 'claim needs publicKey' };
    }
    if (findByKey(publicKey)) {
      return { ok: false, status: 409, error: 'key already claimed', peer: findByKey(publicKey) };
    }

    // Consume BEFORE the write, and only write if the row actually
    // burned. The other order — persist the peer, then consume — leaves a
    // claimed name behind a still-live token whenever the write to
    // invites.json fails, which is the one failure a one-shot token
    // cannot survive. Everything that can refuse this claim has already
    // run, so a burn here is not spent on a claim that then 409s.
    if (inviteRow) {
      var burned = invites.consume(rootDir, inviteRow.token);
      if (!burned) {
        return { ok: false, status: 403, error: 'invite already used' };
      }
    }

    var peer = {
      // ONE LABEL. `name` stood here carrying the same string, and went
      // on 2026-09-15 — see loadRoutingTable for the migration and
      // `who()` for what a census row says now.
      publicLabel: n,
      publicKey: publicKey,
      // THE ENROLMENT LEDGER'S ONE DATE. Written once, never rewritten:
      // it says when this KEY joined, which stays true whatever the
      // label does later.
      claimedAt: new Date().toISOString(),
      owner: firstOwner,
    };
    // KEYED BY KEY, always, because a claim without one is refused
    // above. The map used to be `publicKey || n`, which is how a row
    // could be filed under a label.
    peers[publicKey] = peer;
    persist();
    return { ok: true, status: 201, peer: peer, owner: firstOwner };
  }

  // A SLOT WAS TAKEN, OR SOMEBODY TRIED. The owner hears about both.
  //
  //   Andy: "failed AND successful attempts should send a notification
  //   down the owners SSE stream... the notice must mention the label,
  //   both in failed and in succesful claims."
  //
  // BOTH LABELS RIDE, because they answer different questions and R1 has
  // just made them two words rather than one:
  //
  //   invite  — WHO this was for, in the owner's own terms. The word the
  //             two of them used on the phone; possibly a phone number.
  //             This is what makes a notice readable.
  //   label   — WHAT THEY WILL BE CALLED, which the claimer chose and the
  //             owner has never seen before this moment.
  //
  // An owner who minted `bella` and sees `bel` appear should not read
  // that as a bug, which is a line for the panel's copy — but they can
  // only NOT read it as a bug if the notice carries both.
  //
  // `key` is the claimer's, because a purge is by key and always was
  // (Andy: "removePeer MUST be by ID"). A notice that named only labels
  // would be a notice you cannot act on.
  //
  // WHY A WRAPPER. The refusals inside are eleven early returns, and
  // threading a notification through each one is eleven chances to miss
  // the twelfth somebody adds later. One place, one rule: if the attempt
  // got past the rate gate, the owner hears how it ended.
  function claim(name, sig, publicKey, clientKey, inviteToken, inviteLabel) {
    var seen = { gate: false, label: '', invite: '' };
    var out = claimAttempt(name, sig, publicKey, clientKey, inviteToken, inviteLabel, seen);
    if (seen.gate) {
      ownerEvent(out && out.ok ? 'claim' : 'claim-refused', {
        label: seen.label,
        invite: seen.invite,
        key: (out && out.ok && out.peer && out.peer.publicKey) || publicKey || '',
        owner: !!(out && out.ok && out.owner),
        why: (out && out.ok) ? '' : String((out && out.error) || ''),
      });
    }
    return out;
  }

  // Minting is not checkOwner(): that verifies auth.statusMessage(name),
  // which says nothing about WHICH invite is being made. A signature that
  // could be replayed from a status request into "mint me a token for any
  // label, for any number of days" would not be a mint gate at all. The
  // owner signs the label and the duration, and that is what is verified.
  //
  // THE TWO HALVES MEET. This note read "the shape this leaves until
  // cycle 4: mint needs an owner key, so it only works in keys mode,
  // while an invite is only CONSUMED in names mode. The two halves do
  // not meet yet." Cycle 4 landed — keys mode has its own invite lock in
  // claim() above — and names mode was deleted on 2026-09-15, so minting
  // and consuming now happen in the one mode a live relay has.
  //
  // Cycle A2 adds the spoken token. It is optional and it is SIGNED: an
  // empty field still means "the relay picks the hex", and a signature
  // made over the two-argument message mints nothing but that hex. The
  // token is held to the same rules as a name because it is typed by one
  // human and read aloud to another, and because a token that could be
  // any string could be a path, a header, or a megabyte.
  // NO SIGNATURE ARGUMENT, and that is decision 0010's second collapse.
  //
  // This is reached from answerSelf and from nowhere else. answerSelf is
  // reached from a post this relay already verified was signed by the
  // owner, over bytes that bind sender, recipient and this exact text —
  // so the label, the day count and the spoken token are all inside what
  // was signed, which is every property mintMessage was hand-rolling.
  //
  // AND IT CLOSES A REAL HOLE rather than merely tidying one. The mint
  // signature carried no clock and no relay identity: it never expired,
  // it worked on every relay where the signer was owner, and each replay
  // minted a fresh token. A post cannot be replayed at all — the hash is
  // registered before anything is sent, and a second arrival of the same
  // bytes is `already in flight` and then nothing.
  function mint(ownerName, label, days, token, cause) {
    var owner = normalizeName(ownerName);
    var lbl = normalizeName(label);
    var tok = invites.normalizeToken(token);
    if (allow.mode !== 'keys') {
      return { ok: false, status: 403, error: 'no owner key on this relay' };
    }
    // BOTH HALVES OF AN INVITE ARE SPOKEN, so both keep the tight rule.
    // The label here is not the peer's public caption — it is the word
    // the owner reads down the phone and the claimer types back, and it
    // is the second factor a token with no entropy floor depends on.
    if (!spokenOk(lbl)) return { ok: false, status: 400, error: 'bad label' };
    if (tok && !spokenOk(tok)) return { ok: false, status: 400, error: 'bad token' };
    // NOT A GATE — the caller's identity was settled before this ran.
    // This asks whether the name is on this relay at all, because it is
    // written into the row as `invitedBy` and a row cannot truthfully
    // name an inviter who is not here.
    if (!owner || !allow.byName[owner]) {
      return { ok: false, status: 403, error: 'not the owner' };
    }
    var row = invites.add(rootDir, {
      label: lbl,
      days: days,
      token: tok,
      invitedBy: owner,
    });
    // A SEAT WAS RESERVED (R2). The first half of the pair a claim notice
    // completes: an owner reading their log should see a reservation made
    // and later spent, and by whom.
    //
    // NEVER THE TOKEN. It is the credential, and the one thing on that row
    // the owner already holds by having just made it. A log carrying live
    // tokens would be a log worth stealing.
    ownerEvent('invite-minted', { invite: row.label, expiresAt: row.expiresAt, cause: cause });
    return {
      ok: true,
      status: 201,
      invite: {
        token: row.token,
        label: row.label,
        expiresAt: row.expiresAt,
        invitedBy: row.invitedBy,
      },
    };
  }

  // send() AND inbox() STOOD HERE — 193 lines, and they were the ring.
  //
  //   send()   signed by LABEL (auth.sendMessage), pushed into a 200-entry
  //            global `messages` array, persisted into routingTable.json,
  //            answered 201 whether or not the far end existed
  //   inbox()  polled that array back out, filtered per reader, marking
  //            nothing and deleting nothing
  //
  // Deleted by R8 on 2026-09-15. What replaces them is already here and
  // is 198 lines to their 193: routePost / routeReply below, the router
  // table in router.js, and the held stream. The difference is not size,
  // it is that the router DELIVERS OR REFUSES (decision 0006) instead of
  // promising a store that could not hold.
  //
  // Nothing was migrated. Andy inspected what spirit-3's ring was holding
  // first — 77 entries, 15 of them telemetry from a console that no
  // longer exists — and ruled: "they are all noise"
  // (design/andy/relayStorage.md). loadRoutingTable reads `messages` and
  // drops it, so a relay upgrading in place sheds its mail on the first
  // persist().
  //
  // consoleExchange went before them, on 2026-09-13: 56 lines reached
  // THROUGH send(), and not peer transport at all. See relayStatus.js for
  // what replaced what it told an owner, and decision 0007 for why that
  // is more than the console ever managed.
  //
  // THIS IS NOT A GAP TO FILL. An app that wants store-and-forward wants
  // it on a NODE, which keeps its own traffic log and is entitled to; a
  // relay that kept one would be holding everybody's messages — the
  // content, not metadata — which is a far worse thing than the ring,
  // not a better one (trafficLog.js).

  // status() STOOD HERE — the owner-only report, pulled with a signature
  // over a NAME. Deleted 2026-09-15 (R3).
  //
  // It existed for one caller, the owner badge, and the badge is gone:
  // `owner: true|false` is on every census row already, so a node asks by
  // KEY and signs nothing (ownerBadge.ownedFrom).
  //
  // THE REPORT DID NOT GO ANYWHERE. statusToOwner pushes it down the
  // owner's own stream on every open and every presence change, to one
  // key and no other, carrying MORE than this returned — live invite
  // labels among it. A pull was always the weaker of the two: it needed a
  // credential, and that credential was `status\n<name>` with no minute
  // in it, travelling on a query string. The only signature on this wire
  // that could not expire.
  //
  // AND IT ANSWERS DECISION 0010'S LAST QUESTION. `GET /api/relay/status`
  // was the one route neither the protocol nor bootstrap had claimed —
  // "it owes an argument rather than a classification". It owes nothing
  // now; it is not there.

  // Install (or replace) this owner's device key on the owner record.
  //
  // Signed by the HOUSE key, never by the current device: a device that
  // could name its successor would only have to be borrowed once. The
  // house key is the one thing that stays at home.
  //
  // The bytes are their own message (deviceAuth.setDeviceMessage), so a
  // captured `status` signature — which the owner makes constantly, for
  // every census — cannot be replayed as "install this key". That is
  // asserted in deviceInbox.js rather than left to reading.
  //
  // No peer row is written and no label is claimed. A second row wearing
  // `andy` made the ring's label resolution ambiguous and stopped the
  // owner's own inbox resolving at all
  // (design/reviews/2026-09-10-owner-devices.md). The ring is gone and
  // this wire addresses keys, so the hazard is historical — the rule it
  // produced is not, and B2 below is why.
  // B2: any identity installs its OWN device, proved with its OWN row
  // key. The owner still lands in allow.json; a peer lands on its row in
  // the routing table. Two rooms, one rule — nobody installs a key on a row
  // they cannot sign for.
  function deviceIdentity(token) {
    var t = String(token == null ? '' : token).trim();

    // The owner first, by label, because allow.json is the authority on
    // who the owner is and holds exactly one row.
    var ownerLabel = auth.ownerName(allow);
    if (ownerLabel) {
      var ownerKey = allow.byName && allow.byName[ownerLabel];
      if (ownerKey && (t === ownerKey || normalizeName(t) === ownerLabel)) {
        return { id: ownerKey, label: ownerLabel, publicKey: ownerKey, owner: true };
      }
    }
    if (!t) return null;

    var peer = findByKey(t) || findByLabel(t);
    if (!peer || !peer.publicKey) return null;
    return {
      id: peer.publicKey,
      label: labelOf(peer),
      publicKey: peer.publicKey,
      owner: false,
      peer: peer,
    };
  }

  // AN OMITTED TOKEN IS NOBODY. B1 resolved it to the owner so the bare
  // /device page kept working; B3 gave every page a key in its address
  // and Andy retired that page, which leaves this a way to enrol without
  // naming anyone — an implicit identity in a design whose whole point is
  // that identity is explicit. So it refuses, like any other token that
  // resolves to no row.
  function deviceIdentityOr(token) {
    return deviceIdentity(token);
  }

  // installDevice() STOOD HERE, and `body.setDevice` with it.
  //
  // A relay does not keep a device key any more. The binding between a
  // device and its node is the NODE's — its relay-state/device.json — and
  // the copy a relay used to hold was read in exactly two places, both
  // inside the ring, neither of which any client ever exercised.
  //
  // So enrolment is now what it always described itself as: the relay
  // carries the browser's offer to the owning node (deviceOffer, below),
  // the node compares the password it alone holds, and the node writes
  // the binding down. The relay learns whether it was accepted and
  // nothing else.
  //
  // See deviceAuth.js for the whole reasoning, including the three
  // hazards this deletes rather than fixes.

  function deviceOffer(token, password, devicePublicKey) {
    var who = deviceIdentityOr(token);
    if (!who) {
      return Promise.resolve({
        ok: false, status: 403, error: DEVICE_REFUSAL,
      });
    }

    // THE FLOOD GATE, and it comes before the post rather than after: the
    // whole point is that a caller cannot make this relay spend a post on
    // somebody's node by asking often enough.
    //
    // After the identity check, and that order is load-bearing for the
    // same reason it is at the claim path — a bucket keyed by
    // caller-chosen input grows when a stranger reaches it, so a stranger
    // must not reach it.
    if (!rateOk(deviceHits, who.id, DEVICE_PER_MIN)) {
      return Promise.resolve({
        ok: false, status: 429, error: 'too many device attempts',
      });
    }
    // A DEVICE ENROLMENT IS AN ORDINARY POST, and the relay is the one
    // making it. Everything specific to devices is these few lines;
    // everything else is `post` below, the same act this relay performs
    // for any peer.
    //
    // NOT AN APP PACKET, and that is a rule rather than a shortcut. The
    // app envelope lives inside `text` precisely so a relay never learns
    // it: change the envelope and no relay in the world needs updating.
    // A relay that could parse one would have made the envelope part of
    // the relay protocol.
    //
    // This is not app-to-app traffic anyway. It is the relay speaking to
    // a node about the node's own enrolment — protocol, like the answer
    // `device-pending` has always given — so it gets the relay's own
    // shape, which the relay is entitled to read because it wrote the
    // question. Reading the answer to your own question is not learning
    // somebody else's format.
    var wrapped = JSON.stringify({
      relay: 'device-offer',
      password: password,
      devicePublicKey: devicePublicKey,
    });

    // WHOSE ENROLMENT THIS WAS, carried back with the yes.
    //
    // The page has to sign as somebody once it is enrolled, and it was
    // being told the wrong somebody: the answer named
    // `snapshot().owner` — this RELAY's owner — so every device page on
    // the box came back "signed in as andy", including bella's. Andy saw
    // it the first time two enrolments ran back to back.
    //
    // True when it was written, and quietly false since B2. The bare
    // /device page enrolled the owner and nobody else, so the owner's
    // label was the only answer there was. B2 gave every identity with a
    // row its own page and its own slot, and this line did not follow.
    //
    // It is the label of the identity that was ENROLLED, which is the
    // one `who` has been holding since the first line of this function.
    function named(answer) {
      if (!answer || !answer.ok) return answer;
      answer.name = who.label;
      return answer;
    }

    // DELIVER OR REFUSE, with nothing behind it any more. post() draws
    // that line for every post this relay makes, and an enrolment is one:
    // a node holding no stream cannot answer, and saying so at once is
    // the whole of decision 0006. The poll that used to catch this case
    // is gone, and with it the only thing on this box that still waited.
    return post(who.id, wrapped).then(deviceAnswerFrom).then(named);
  }

  // THE RELAY POSTING AS ITSELF.
  //
  // Andy: "the relay already had a spirit style post with reply
  // implemented, in the relaying... you could have a generic function on
  // the relay that presents the exact same interface as the personal
  // node side."
  //
  // That is this, and it is deliberately the same shape as
  // peerPost.post() on a node — sign, hash, register, deliver, wait —
  // because it is the same act. What the relay does when it proxies
  // somebody else's post (routePost, below) and what it does when it
  // makes one of its own differ in exactly two places: who signed it,
  // and where the answer goes.
  //
  // The relay signs with its own key. Not ceremony: for a device
  // enrolment there IS no end-to-end signature to carry, because the
  // browser has no identity yet — that being the thing it is enrolling —
  // so the relay vouching for it is the only attestation there can be.
  // A hop is not an origin, and TLS can only speak to the hop.
  function post(toKey, text) {
    var mine = auth.loadIdentity(rootDir);
    if (!mine || !mine.privateKey) {
      return Promise.resolve({ ok: false, status: 503, error: 'this relay has no identity' });
    }
    if (typeof text !== 'string' || !text) {
      return Promise.resolve({ ok: false, status: 400, error: 'text required' });
    }
    if (text.length > MAX_ROUTED_TEXT) {
      return Promise.resolve({ ok: false, status: 413, error: 'too big' });
    }

    // DELIVER OR REFUSE, AND REFUSE INSTANTLY (0006). The same line
    // routePost draws, for the same reason, and drawn here rather than
    // in the caller so that every post this relay makes obeys it.
    if (!presentNow.isPresent(toKey)) {
      return Promise.resolve({ ok: false, status: 503, error: 'peer not reachable' });
    }

    var signed = auth.postMessage(mine.publicKey, toKey, text);
    var sig = auth.sign(mine.privateKey, signed);
    var hash = auth.requestHash(signed);

    // REGISTERED BEFORE IT IS SENT, the rule the whole router turns on:
    // nothing leaves until the thing that will match its answer exists.
    var waiting = new Promise(function (resolve) {
      awaitingReply[hash] = {
        resolve: resolve,
        timer: setTimeout(function () {
          if (!awaitingReply[hash]) return;
          delete awaitingReply[hash];
          // Named, because cancel() refuses a hash that is not this
          // requester's — the same rule that stops one node cancelling
          // another's route.
          routes.cancel(hash, mine.publicKey);
          resolve({ ok: false, status: 504, hash: hash, error: 'no answer yet' });
        }, ROUTE_WAIT_MS),
      };
    });

    var opened = routes.open(hash, mine.publicKey, toKey, function () {
      // NO HASH IS SENT, exactly as in routePost: the target derives it
      // from the bytes it holds, which is what makes it evidence rather
      // than an echo.
      return presentNow.send(toKey, 'request', {
        from: mine.publicKey,
        to: toKey,
        text: text,
        sig: sig,
      });
    });
    if (!opened.ok) {
      settleHere(hash, {
        ok: false, status: opened.status || 503,
        error: opened.error || 'could not be sent',
      });
    }

    return waiting;
  }

  // Answers this relay is waiting for, by the hash of the request it
  // made. Not a second router table — the router's own table holds the
  // route; this holds only what is waiting at the near end of it, which
  // for a relay is never a socket.
  var awaitingReply = Object.create(null);

  function settleHere(hash, answer) {
    var slot = awaitingReply[hash];
    if (!slot) return false;
    delete awaitingReply[hash];
    if (slot.timer) clearTimeout(slot.timer);
    slot.resolve(answer);
    return true;
  }

  // WHAT THE NODE SAID, TURNED BACK INTO WHAT THE BROWSER ASKED.
  //
  // The node answers with a packet, because that is what an answer is on
  // this wire. This is the relay reading a reply to a request it made
  // itself — which is the one payload it is entitled to open, having
  // written the question.
  //
  // Anything it cannot read is a no. A page that gets `not now` tries
  // again; a page told yes on the strength of an answer nobody could
  // parse would be enrolled against a node that never agreed.
  function deviceAnswerFrom(answer) {
    if (!answer || !answer.ok) {
      return { ok: false, status: answer && answer.status, error: DEVICE_REFUSAL };
    }
    var said = null;
    try { said = JSON.parse(answer.text); } catch (e) { said = null; }
    // THE SHAPE IS PART OF THE CHECK. The bare receipt every node sends
    // for every request is an empty string, and an empty string must not
    // read as consent — a browser told yes on the strength of an answer
    // nobody composed would be enrolled against a node that never
    // agreed.
    if (!said || said.relay !== 'device-answer' || said.accepted !== true) {
      return { ok: false, status: 403, error: DEVICE_REFUSAL };
    }
    return { ok: true, status: 200, devicePublicKey: said.devicePublicKey || '' };
  }
  // A PEER RENAMES ITSELF, and nobody else can do it for them.
  //
  //   Andy: "after enrollment the public label of an ID is property of
  //   the ID, it must persist on the relay."
  //
  // `who` is the row the post proved, so there is no key argument and no
  // way to name somebody else's. That is the same shape self-removal
  // has, and for the same reason — it is not a lesser permission, it is
  // a different one.
  //
  // ── WHAT IT DOES NOT TOUCH ───────────────────────────────────────────
  //
  // `claimedAt` is NOT rewritten. It says when this KEY enrolled, and
  // that stays true whatever the label does — it is the enrolment
  // ledger's one date, and the human-usable way to tell two johns apart.
  // A rename that moved it would turn an old member into a new one on
  // every screen that reads it.
  //
  // `publicKey` is not touched either, obviously, and `owner` is not:
  // renaming is not a way to become or stop being the owner.
  //
  // ── THE TWO COLLISIONS, AND THEY ARE REAL ────────────────────────────
  //
  // DUPLICATE LABELS ARE ALLOWED, so renaming INTO one is allowed too.
  // Two johns are two keys and always were, `findByLabel` answers null
  // rather than picking, and every census row carries `claimedAt` and a
  // key. Refusing a duplicate here would invent a scarcity the rest of
  // the box does not have.
  //
  // A LIVE INVITE FOR THAT LABEL IS THE ONE REFUSAL. An unclaimed invite
  // is a reservation held for somebody who is not here yet; renaming
  // into it would leave a token that can never be redeemed, because the
  // claim it unlocks would collide with the row that just took the name.
  // That is a silent breakage for a third party who is not in this
  // conversation — the invitee — so it is refused rather than allowed.
  //
  // Swept first, so an EXPIRED reservation does not block a living
  // person: the same "any attempt tidies up" rule redeem follows.
  function renameSelf(who, wanted, cause) {
    if (!who || !who.publicKey) {
      return { ok: false, status: 403, error: 'no such peer' };
    }
    var next = normalizeName(wanted);
    // The key renaming its own caption — the same permissive rule a
    // claim uses, because it is the same field.
    var badNext = labelProblem(next);
    if (badNext) return { ok: false, status: 400, error: badNext };

    var row = findByKey(who.publicKey);
    if (!row) return { ok: false, status: 404, error: 'no such peer' };
    if (labelOf(row) === next) {
      // Nothing to do, and said so rather than persisting a no-op.
      return { ok: true, status: 200, label: next, unchanged: true };
    }

    invites.sweepExpired(rootDir);
    var reserved = invites.load(rootDir).some(function (r) {
      return r && normalizeName(r.label) === next;
    });
    if (reserved) {
      return { ok: false, status: 409, error: 'name reserved by a live invite' };
    }

    // THE OWNER'S LABEL LIVES IN TWO PLACES, and this is the whole of
    // why that matters.
    //
    // `allow.json` identifies the owner by NAME — `ownerName()` is its
    // first key, and every owner check on this box resolves through it.
    // An owner whose peer row said `bob` while allow.json still said
    // `andy` would be locked out of its own relay: not refused, simply
    // not recognised.
    //
    // So the two move together or neither does. Written FIRST, because a
    // failed write to allow.json must not leave a renamed row behind —
    // the other order strands the owner, and this order costs at worst a
    // rename that did not happen.
    if (isOwner(who)) {
      try {
        auth.writeAllowKeys(rootDir, [{ name: next, publicKey: who.publicKey }]);
        reloadAllow();
      } catch (e) {
        return { ok: false, status: 500, error: 'could not move the owner record' };
      }
    }

    var was = labelOf(row);
    row.publicLabel = next;
    persist();

    // THE OWNER HEARS ABOUT IT (R2). A member changing what they are
    // called is a membership fact, and an owner watching a name appear
    // in the census with no record of how it got there is exactly the
    // gap that category exists to close.
    ownerEvent('peer-renamed', { key: who.publicKey, was: was, label: next, cause: cause });

    return { ok: true, status: 200, label: next, was: was };
  }

  // FORGETTING SOMEBODY — the act, with no opinion about who asked.
  //
  // Split out of removePeer so the two ways in can prove themselves
  // differently and then do the identical thing. The public route still
  // checks a signature (see removePeer below); a post from the owner was
  // already proved by the post's own signature before it reached here,
  // and a second check there would be a second place to decide who the
  // owner is.
  //
  // BY KEY, and only ever by key.
  //
  //   Andy: "removePeer MUST be by ID"
  //
  // Labels duplicate by design, so a removal naming one would delete
  // whichever john this box happened to find first.
  function forgetPeer(peerKey, cause) {
    var key = String(peerKey == null ? '' : peerKey).trim();
    if (!key) return { ok: false, status: 400, error: 'peer key required' };

    var target = findByKey(key);
    if (!target) return { ok: false, status: 404, error: 'no such peer' };

    var owner = auth.ownerName(allow);
    var ownerKey = owner && allow.byName && allow.byName[owner];

    // The owner's own row is not removable. NOT an auth check — it is a
    // safety invariant, which is why it lives with the act rather than
    // with either gate: no way in may reach past it. It is the only row allow.json
    // holds, ownerName() reads it, and a relay that forgot its owner
    // could never be administered again — first-claim would hand the box
    // to whoever asked next.
    if (ownerKey && key === ownerKey) {
      return { ok: false, status: 403, error: 'the owner cannot be removed' };
    }

    var label = labelOf(target);
    delete peers[key];
    // Some older rows are keyed by name rather than by key.
    Object.keys(peers).forEach(function (k) {
      if (peers[k] && peers[k].publicKey === key) delete peers[k];
    });

    // A RING PURGE STOOD HERE — "their mail goes with them", because a
    // forget that leaves the letters behind is not forgetting. The
    // argument was right and is now answered by there being no letters:
    // a relay holds nothing on anyone's behalf, so removing the row IS
    // removing everything this box had of them.
    persist();

    // And the invite, or the name is a lie: a live token for that label
    // walks them straight back in.
    var revoked = invites.revokeInvite(rootDir, label);
    invites.sweepExpired(rootDir);

    // If they are holding a stream, it ends now. A removed peer that
    // keeps receiving the roster is still a member in every way that
    // matters.
    if (presentNow.isPresent(key)) {
      presentNow.disconnect(key, null);
    }

    // GONE, NOT ABSENT — and the difference is a colour on somebody's
    // screen. `present: false` is a statement ABOUT A MEMBER: this person
    // has a row here and is not connected. A removed peer has no row, so
    // the only true thing left to say is "I no longer know this key" —
    // and a node that heard `present: false` would keep showing them red,
    // which claims knowledge the relay no longer has.
    //
    // Broadcast unconditionally, not only when they were connected:
    // somebody removed while away would otherwise stay absent-and-known
    // in every peer's table for ever, because nothing would ever correct
    // it.
    presentNow.broadcast('presence', { key: key, present: false, gone: true });

    // AND THE OWNER'S LOG GETS IT (R2). Somebody leaving the box is the
    // same category as somebody joining it, and an owner reviewing how
    // their relay came to hold who it holds needs both halves or the
    // record reads as a list of arrivals.
    //
    // Fired for a self-removal too. The owner is not the actor there, but
    // it is still their box and still their membership changing — and a
    // peer that leaves and is never noticed is how a roster drifts.
    ownerEvent('peer-removed', {
      label: label,
      key: key,
      invitesRevoked: revoked,
    });

    return {
      ok: true,
      status: 200,
      removed: { key: key, label: label },
      // `messagesDropped` went with the ring. An owner removing somebody
      // should still see the size of what they did, and `invitesRevoked`
      // is now the whole of it — because the row and its live tokens are
      // the whole of what this box was holding.
      invitesRevoked: revoked,
    };
  }

  // removePeer() STOOD HERE — the public route's gate, with byOwner and
  // bySelf both proving possession of a house key over removePeerMessage.
  //
  // Both halves are posts now. The owner's went first: it only ever
  // needed the relay to be addressable. The peer's followed the moment
  // the destination opened to peers at all, because leaving is a verb
  // about your OWN ROW and the post's signature already proves the row.
  // See answerSelf, and decision 0010.

  // A PEER DROPS A PACKET ON A PEER. Nothing is held open: this returns
  // at once, the body rides the target's already-open stream, and the
  // answer comes back the same way (design/relay/ROUTER.md).
  //
  // The relay reads the body but can neither forge nor alter it
  // undetectably: the hash is taken over exactly the bytes that were
  // signed, so a tampered forward cannot match what either end computes.
  // ADDRESSED TO THE RELAY ITSELF — and that is the whole question here
  // now. Who may ask for WHAT is answerSelf's, one verb at a time.
  //
  //   Andy: "if `who` discloses the relay's key, why does the protocol
  //   forbid non-owner peers to obtain it as a destination?"
  //
  // It did, and there was no protocol reason. The key is published
  // unsigned in /api/relay/who — a node needs it to pin this box and to
  // post THROUGH it — so the old refusal hid nothing. What it was really
  // doing was gating four owner verbs that check nothing themselves, all
  // in one undifferentiated `is this the owner`.
  //
  // Splitting the gate per verb is what let the destination open, and
  // opening it is what let set-device and self-removal stop being cheats.
  // See decision 0010.
  function postedToSelf(toToken) {
    var mine = relayPublicKey();
    return !!mine && String(toToken || '') === mine;
  }

  // IS THIS THE HOUSE KEY. The one question the owner verbs ask, asked
  // in one place.
  function isOwner(who) {
    var ownerLabel = auth.ownerName(allow);
    var ownerKey = ownerLabel && allow.byName && allow.byName[ownerLabel];
    return !!ownerKey && !!who && who.publicKey === ownerKey;
  }

  // WHAT A RELAY DOES WITH A PACKET ADDRESSED TO IT.
  //
  // The reply travels the ordinary way — routeReply, correlated by the
  // same hash, signed by this relay — so a caller cannot tell the shape
  // of this exchange from any other. That is the point of making the
  // relay a peer rather than giving it a second kind of door.
  //
  // Everything it can be asked is an owner verb, and the owner's identity
  // was proved by the post's own signature before this ran. There is no
  // second gate here and there must not be: two places deciding who the
  // owner is, is one place to get it wrong.
  // WHO MAY ASK FOR WHAT, and it is per verb now.
  //
  // Every verb below is reached by the same door — a post addressed to
  // this relay's own key — and they do not all want the same proof. Two
  // kinds:
  //
  //   OWNER VERBS      monitor, invite, revoke, removing SOMEBODY ELSE
  //                    the house key, and nothing else
  //   OWN-ROW VERBS    setDevice, removing YOURSELF
  //                    any identity with a row, acting on that row
  //
  // The proof in both cases is the same signature — the post's — checked
  // once in routePost before this ran. What differs is which row it has
  // to be, and that is what these two lines decide.
  //
  // ONE REFUSAL FOR BOTH, deliberately: `no such peer`. An owner verb
  // asked by a peer and a verb nobody has heard of get the same answer,
  // so the set of things this box will do for somebody else is not
  // enumerable by asking.
  // ── THE FORWARD'S HALF-FINISHED BUSINESS ─────────────────────────────
  //
  // inner hash -> the function that answers the PARTNER who asked. A
  // forward cannot be answered when it arrives: this relay has to ask one
  // of its members and wait. So the partner's answer is parked here and
  // fired by `routeReply` when the member speaks.
  //
  // In RAM and keyed by a hash nobody chose — it is derived from the
  // bytes — so it is not a record of anything. It empties as replies
  // arrive, and a request whose member never answers is swept with its
  // route by the router's own ttl.
  var forwarding = Object.create(null);

  // WHAT A PARTNER'S FORWARD ACTUALLY DOES HERE.
  //
  // Returns an answer object to send back at once, or `null` when the
  // packet is on its way to a member and the partner must wait.
  function forwardToMine(packet, answerPartner) {
    var from = packet && packet.from;
    var to = packet && packet.to;
    var body = packet && packet.text;
    var sig = packet && packet.sig;
    if (!from || !to || typeof body !== 'string' || !body || !sig) {
      return { ok: false, status: 400, error: 'forward needs from, to, text and sig' };
    }
    if (body.length > MAX_ROUTED_TEXT) {
      return { ok: false, status: 413, error: 'too big' };
    }

    // THE INNER SIGNATURE, VERIFIED HERE AND NOT TAKEN ON TRUST. The
    // partner vouches by carrying it; this proves the sender it names
    // actually signed these bytes, so a partner cannot put words in a
    // real peer's mouth even if it wanted to.
    var signed = auth.postSignatureFor(from, from, to, body, sig);
    if (!signed) return { ok: false, status: 403, error: 'bad inner signature' };

    // MY MEMBER, OR NOBODY. A forward is never re-forwarded: if this key
    // is not on this box, the hunt ends here rather than going another
    // hop. That is the one-hop rule as an absence of code.
    var target = deviceIdentity(to);
    if (!target) return { ok: false, status: 404, error: 'no such peer' };
    if (!presentNow.isPresent(target.id)) {
      return { ok: false, status: 503, error: 'peer not reachable' };
    }

    // THE HASH IS THE INNER ONE, derived from the bytes exactly as N1 and
    // N2 each derive it (0011). Nobody sent it, and this relay arrives at
    // the same number by holding the same packet — which is what lets the
    // member's reply match a request it was never told the name of.
    var innerHash = auth.requestHash(signed);
    var opened = routes.open(innerHash, mineKey(), target.id, function () {
      return presentNow.send(target.id, 'request', {
        from: from, to: to, text: body, sig: sig,
      });
    });
    if (!opened || !opened.ok) return opened;

    monitorEvent('post', from, target.id, { bytes: body.length, hash: innerHash, via: 'partner' });
    forwarding[innerHash] = answerPartner;
    return null;
  }

  // ── WRAPPING A MEMBER'S PACKET FOR A PARTNER ─────────────────────────
  //
  // The member's post is enclosed WHOLE — its own from, to, text and
  // signature — as the text of an ordinary post from this relay to the
  // partner. Same function, same signed shape, one level up: this relay
  // is a client of the protocol here exactly as a node is, through the
  // peerPost it already uses to ask partners to search.
  //
  // ── AND IT NEEDS TO BE TOLD WHERE TO SEND IT ─────────────────────────
  //
  // THE FIRST VERSION BROADCAST, AND WAS WRONG THREE TIMES OVER. It posted
  // the wrapper to every partner in parallel and let the ones that do not
  // hold the key refuse it. Andy, on each count:
  //
  //   — **Disclosure.** Every uninvolved partner receives a full copy of
  //     a packet addressed to somebody else's member: from, to, text and
  //     signature. A relay carries rather than reads, and that handed
  //     N−1 relays something none of them had any business seeing.
  //   — **Waste.** N posts for one delivery.
  //   — *"and you burn your quota on all partners in parallel"* — and
  //     this is the one that makes it FAIL rather than merely offend.
  //     Each post lands in a different relay's PARTNER POOL, so nineteen
  //     partners means nineteen pool units per forward, eighteen of them
  //     spent on relays that can only answer `no such peer`. That is
  //     `partners × members` returning as traffic after 0012 deleted it
  //     as memory — and it is self-defeating, because a busy relay would
  //     have its forwards throttled by partners it had been filling with
  //     packets they could not use.
  //
  // SO THIS FAILS CLOSED. A forward goes to ONE named partner or nowhere,
  // and nothing on the wire can name one yet: a post carries `from`, `to`,
  // `text` and `sig`, and has no field for where the target lives.
  //
  // 0012 already said where the answer comes from — *"which partner comes
  // from the node, which already has it: a search row carries the
  // partner's URL"* — and that hint has nowhere to ride. Carrying it is a
  // change to what a post is, which is a team-review line, so the door is
  // left shut rather than propped open with a broadcast.
  //
  // Returns an answer to give the member now, or null when there is
  // nothing to try — in which case the caller falls through to its own
  // `no such peer`.
  function carryToPartner(who, toToken, text, sig, atRelayKey) {
    if (!askPartner || !atRelayKey) return null;
    var list = (partners() || []).filter(function (p) {
      return p.relayKey === atRelayKey;
    });
    // ONE, OR NONE. A named partner this box has actually promoted, or
    // the caller falls through to `no such peer` as it always did.
    if (list.length !== 1) return null;

    var signed = auth.postSignatureFor(who.publicKey, who.id, String(toToken), text, sig);
    if (!signed) return { ok: false, status: 403, error: 'bad post signature' };
    var innerHash = auth.requestHash(signed);

    // REGISTERED BEFORE IT LEAVES, exactly as a local post is: nothing
    // goes out until the thing that will match its answer exists. The
    // route's target is the far member, so when the reply comes back up
    // the tunnel `routes.answer` checks it against the key the member
    // actually replied with.
    var opened = routes.open(innerHash, who.id, String(toToken), function () {
      var wrapper = JSON.stringify({
        v: 1,
        body: { forward: { from: who.id, to: String(toToken), text: text, sig: sig } },
      });
      var p = list[0];
      askPartner(p.url, p.relayKey, wrapper)
        .then(function (answer) {
          var said = null;
          try { said = JSON.parse((answer && answer.text) || ''); }
          catch (e) { said = null; }
          var out = (said && said.body) || null;
          if (!out || out.ok !== true || !out.forwarded) return;
          deliverForwardedReply(innerHash, out.forwarded);
        })
        .catch(function () { /* a partner that cannot help is not an error */ });
      // It is on its way. Whether that partner holds the key is its
      // answer to give, and saying `false` here would cancel the route
      // the answer needs.
    });
    if (!opened || !opened.ok) return opened;

    monitorEvent('post', who.id, String(toToken), {
      bytes: text.length, hash: innerHash, via: 'partner',
    });
    meterNote(text.length, false);
    return withStatus(opened, innerHash);
  }

  // The far member's reply, arriving as the answer to this relay's own
  // post to a partner. NOT through routeReply, for the reason sendAnswer
  // gives: that door begins with deviceIdentity, and the replier is not a
  // member here. Everything else is identical — same table, same check
  // that the replier is the route's target, same event on the requester's
  // stream.
  function deliverForwardedReply(innerHash, reply) {
    var matched = routes.answer(innerHash, reply.from);
    if (!matched.ok) return false;
    monitorEvent('reply', reply.from, matched.requester || '', {
      bytes: (reply.text || '').length, hash: innerHash, via: 'partner',
    });
    return !!presentNow.send(matched.requester, 'reply', {
      hash: innerHash,
      from: reply.from,
      text: reply.text || '',
      sig: reply.sig,
    });
  }

  function mineKey() {
    var mine = auth.loadIdentity(rootDir);
    return (mine && mine.publicKey) || '';
  }

  // -- THE WIRE'S CEILING, WHICH IS THIS FILE'S ONLY OPINION ABOUT SIZE -
  //
  //   Andy: "the relay-side search function should still collect the same
  //   amount of slots, but measure and truncate before returning results."
  //   Andy: "bucket.serialize should take a byte maximum."
  //
  // `peerSearch.SLOTS` is a RANKING device -- how many candidates are worth
  // offering -- and it was also, by accident, the size limit: a row was a
  // fixed handful of short fields, so 32 of them always fitted. `vias`
  // ended that, and 32 slots is now anywhere from ~4 KB to ~26 KB.
  //
  // THE CUT ITSELF IS NOT HERE. It belongs with the ordering, because
  // deciding how far down a ranked list to read is a question about the
  // ranking -- and because an item's size is only known after `merge` has
  // finished adding sources to it. So this file supplies the one number it
  // actually knows (what fits in the envelope it is about to send) and the
  // ranker does the rest. Same rule as "the ranking is not this file's".
  var MATCH_BUDGET = limits.PAYLOAD_MAX - 512;

  function answerSelf(hash, text, who) {
    var asked = null;
    try { asked = JSON.parse(text); }
    catch (e) { asked = null; }
    var body = (asked && asked.body) || null;
    var out = { ok: false, status: 404, error: 'no such peer' };
    var owner = isOwner(who);
    var fromPartner = !!(who && who.partner);
    // Set by the search branch when this relay must also ask its partners.
    // Null for every other verb and for a partner-asked search, which is
    // how the one-hop rule is carried from the gate to the send.
    var pendingSearch = null;

    // ── WHAT A PARTNER MAY ASK, WHICH IS ONE THING ────────────────────
    //
    // Only `search`, and the answer is this relay's own members. Every
    // other verb falls through to the same `no such peer` a stranger
    // gets, so the set of things this box will do for a partner is not
    // enumerable by asking — the same rule that already governs an
    // ordinary member asking an owner verb.
    // Dropping `body` rather than returning early, so the refusal leaves
    // by the same door every other answer does — one send, at the foot of
    // this function, with `out` still the default `no such peer`. An early
    // return here would be a second exit that silently answered nothing.
    // ── WHAT A PARTNER MAY ASK, AND IT IS A LIST OF TWO ──────────────
    //
    // `search` — a question about this relay's own members, answered by
    // this relay. `forward` — carry an enclosed packet to one of this
    // relay's members and bring back what they say.
    //
    // THERE IS NO THIRD, AND NO "GIVE ME YOUR MEMBERS"
    // (decisions/0012). Everything else falls through to the same
    // `no such peer` a stranger gets, so the set of things this box will
    // do for a partner is not enumerable by asking.
    if (fromPartner && !(body && (body.search || body.forward))) body = null;

    // ── WHO THIS RELAY PARTNERS WITH — ANY MEMBER MAY ASK ──────────────
    //
    //   Andy: "we want to prove that with a partnership more peer id's
    //   can be visible for every node bound to either partner."
    //
    // EVERY node bound here, which is why this is not owner-gated. The
    // partner list already reaches the owner inside `relayStatus`; an
    // ordinary member could see nothing, so "more identities visible"
    // was true for exactly one person per relay.
    //
    // WHAT A MEMBER GETS, and it is less than the owner's view: where the
    // partner is and which key it signs with. Not `ownerKey`, not the
    // label this relay's owner filed it under, and none of the running
    // stats — those are the owner's reading of a relationship they
    // entered. A member needs the address to go and look, and the key to
    // know what it is looking at.
    //
    // NOT ON THE PUBLIC CENSUS, deliberately. A member learns the reach
    // they were given by joining; a stranger reading /api/relay/who
    // learns nothing about who this box talks to. Publishing the mesh is
    // a different decision and nobody has taken it.
    // ── SEARCH, BECAUSE A LIST DOES NOT SCALE ──────────────────────────
    //
    //   Andy: "This approach will not be sustainable if there's even just
    //   a thousand people in this list… We want the partner-space
    //   searchable."
    //
    // The node used to fetch every census WHOLE and subtract what it
    // knew. At ten members that is a list; at a thousand it is 150 KB per
    // relay to render something nobody can read. So the relay answers the
    // question instead of shipping the material to answer it with.
    //
    // ANY MEMBER MAY ASK, like `partners` above. The census is already
    // public in full, so a search over it gives away nothing new — what it
    // saves is the transfer, and that saving is the entire point.
    //
    // A FLOOR ON THE QUERY, because substring matching with no floor is
    // the census again with extra steps: `a` would return everybody.
    //
    // CANDIDATES, NEVER AN ANSWER (R1). Three johns come back as three
    // rows and the caller confirms by key, exactly as contacts does for a
    // local handle. A search that implied "this is the john you meant"
    // would be the thing R1 exists to prevent.
    //
    // Own members only, for now. Partner space becomes searchable when
    // this relay holds its partners' members — tier two, the stream — and
    // the shape of this answer does not change when it does.
    // ── CARRYING A PACKET TO ONE OF MY OWN MEMBERS ───────────────────
    //
    //   Andy: "the A↔B protocol is an exact duplicate of the N1→A
    //   protocol, but in both directions. AND the A↔B protocol simply
    //   tunnels the N1→A and the N2→B protocol to the other partner."
    //
    // The enclosed packet is N1's, untouched: its own `from`, `to`, text
    // and signature, exactly as N1 signed them. This relay verifies that
    // signature and then behaves as though N1 had posted here directly —
    // because, in every way that matters to the member receiving it, N1
    // did.
    //
    // WHY THERE IS NO CERT (Andy: "the tunnel is the cheap implementation
    // of the cheap cert"). Two signatures are already on the wire and
    // between them they carry what a membership certificate was proposed
    // to carry: the INNER proves N1 authored this and that the partner
    // cannot have forged it, and the OUTER — checked before this function
    // was reached, against the key pinned at promotion — proves a partner
    // this box chose is vouching by carrying it. A self-signed claim of
    // membership would add nothing, because only the partner's agreement
    // makes such a claim true and the outer signature IS that agreement.
    //
    // ONE HOP, STRUCTURALLY. A forward is only accepted FROM a partner,
    // and a forward is only ever delivered to one of this relay's OWN
    // members — it is never re-forwarded. There is no second hop to
    // refuse because there is no code that could take one.
    if (body && body.forward && fromPartner) {
      out = forwardToMine(body.forward, sendAnswer);
      if (out === null) return;   // delivered; the answer comes when N2 replies
    } else if (body && body.search) {
      var q = String((body.search.q) || '').trim().toLowerCase();

      // ── ONE HOP, FULL STOP — ENFORCED, NOT DOCUMENTED ───────────────
      //
      // A member asking is answered from this relay's members AND from
      // its partners. A PARTNER asking is answered from this relay's
      // members alone, and never asks anyone else.
      //
      // That is the whole of no-transitivity, and it is enforceable here
      // precisely because the two askers are distinguishable: without the
      // partner gate above, a forwarded search would be indistinguishable
      // from a member's and would fan out again, which is
      // `partners x partners x members` and the arithmetic that kills a
      // 1 GB box (PARTNERS.md).
      var propagate = !fromPartner;

      // ── NO FLOOR. "a" IS A QUESTION AND IT HAS AN ANSWER ───────────
      //
      //   Andy: "Searches for 'a' must be successful, even if there’s a
      //   million potential peers..."
      //
      // There was a two-character floor here and it was a crutch for not
      // having ranking. Refusing a short query refuses a legitimate
      // question — and with matches ordered by quality and capped by
      // what a packet holds, "a" answers perfectly well: the exact `a`
      // first if somebody claimed it, then everyone starting with it,
      // present before absent, as many as fit, and `more`.
      //
      // An EMPTY query is not an error either. It matches everyone, so
      // ordering puts the present first and the cap takes the top of
      // that — which is "who is around", answered by the same verb
      // rather than by a second one.
      {
        // ── THE RANKING IS NOT THIS FILE'S ───────────────────────────
        //
        //   Andy: "i want the graded search logic and that stuff isolated
        //   from relay or other core components, since quality-of-result
        //   measurements etc. are up in the air and we need to have this
        //   block separately tested and verified, and give it an
        //   independent evolution path."
        //
        // So this maps `peers` into the plain rows peerSearch takes and
        // does nothing else. Presence is resolved HERE, into a field,
        // because `presentNow` is a relay concept with a live socket
        // behind it and peerSearch must stay drivable from a test with
        // nothing running.
        //
        // What this file is no longer entitled to an opinion about: what
        // a good match is, what beats what, and how many fit.
        var rows = listPeers()
          .filter(function (p) { return p && p.publicKey; })
          .map(function (p) {
            return {
              publicKey: p.publicKey,
              publicLabel: labelOf(p),
              claimedAt: p.claimedAt,
              owner: !!p.owner,
              // Off the public census, but a search reaches this line only
              // from a member over a signed post — the authenticated
              // channel that was always allowed to carry it.
              present: presentNow.isPresent(p.publicKey),
              via: null,
            };
          });

        // ONE BUCKET, offered every row. Never a list of everyone — this
        // relay may hold a million members and `q` may be one letter.
        var found = peerSearch.search(rows, q, peerSearch.SLOTS);
        var matches = found.matches.map(function (row) {
          // `via` is the merger's field and means nothing in a reply that
          // had one source. It goes back on at the point a reply carries
          // several (tier three), not here.
          return {
            publicKey: row.publicKey,
            publicLabel: row.publicLabel,
            claimedAt: row.claimedAt,
            owner: row.owner,
            present: row.present,
          };
        });
        var more = found.more;

        // A MEMBER'S SEARCH IS NOT FINISHED YET. `propagate` is false for
        // a partner asking, so their answer leaves immediately below and
        // goes no further — one hop. For a member, this hands the send the
        // rows this relay found and the query they were found with, and
        // the answer waits for the partners.
        if (propagate) {
          pendingSearch = { q: q, mine: found.matches, more: more };
        }

        // `more` rather than a page: a caller who sees it types another
        // letter, which is cheaper for everybody than a cursor — and with
        // results ordered by quality, the ones that did not fit are the
        // ones they wanted least. That now covers two kinds of "did not
        // fit": too many for the slots, and too many for the wire.
        // The local answer has no `vias` -- nothing merged, so no row
        // grew -- and its size is the ordinary one that always fitted.
        // Checked anyway, because "it has always fitted" is what was true
        // of the merged answer too.
        var localFit = [];
        var localCut = false;
        for (var mi = 0; mi < matches.length; mi += 1) {
          var tryRow = localFit.concat([matches[mi]]);
          if (JSON.stringify(tryRow).length > MATCH_BUDGET) { localCut = true; break; }
          localFit = tryRow;
        }
        out = {
          ok: true,
          status: 200,
          more: more || localCut,
          matches: localFit,
        };
      }
    }
    if (body && body.partners) {
      out = {
        ok: true,
        status: 200,
        partners: partners().map(function (p) {
          return { url: p.url, relayKey: p.relayKey, since: p.since };
        }),
      };
    }

    if (body && body.monitor && owner) {
      // Already proved: this arrived signed by the owner, over bytes that
      // bind sender, recipient and this exact text. So a captured `on`
      // cannot be replayed as an `off` — the flag is inside what was
      // signed, which is what monitorMessage hand-rolled before the post
      // covered it for free.
      monitoring = !!body.monitor.on;
      monitorFilter = monitoring ? readMonitorFilter(body.monitor.filter) : null;
      if (monitoring) statusToOwner();
      out = { ok: true, monitoring: monitoring, filter: monitorFilter };
    }

    // FORGETTING SOMEBODY, by key — and the one verb that is BOTH kinds.
    //
    // The owner may name anybody. Anybody else may name only themselves,
    // which is not a lesser version of the same permission but a
    // different one: leaving is not a favour you have to ask for. That
    // was `byOwner || bySelf` on the public route, and it is the same
    // rule here, decided by who signed rather than by a second signature.
    //
    // THE ANSWER TO A SELF-REMOVAL IS USUALLY LOST, and that is correct
    // rather than a gap: forgetPeer drops the caller's stream, so the
    // reply below has nowhere to go and the caller times out. The stream
    // closing IS the receipt — a peer that has been forgotten cannot be
    // told anything, and a relay that could still reach them would not
    // have forgotten them. False negative, never false positive
    // (ROUTER.md §4).
    if (body && body.removePeer) {
      var target = String(body.removePeer.key || '');
      if (owner || (who && target === who.publicKey)) {
        out = forgetPeer(target, hash);
      }
    }

    // CHANGING YOUR OWN PUBLIC LABEL. An OWN-ROW verb, and the strictest
    // one: there is no owner path at all.
    //
    //   Andy: "after enrollment the public label of an ID is property of
    //   the ID, it must persist on the relay. A contract would say, the
    //   relay owner will not be allowed to control the public label of
    //   any keyed peer."
    //
    // So `owner ||` is deliberately absent, where removePeer has it. The
    // owner may evict somebody — that is their box — but may not rename
    // them, because the label belongs to the key. Those are different
    // powers and this is the line between them.
    //
    // NO NEW ROUTE AND NO NEW SIGNED FORMAT. It rides the post that is
    // already here, proved by the signature that already ran, which is
    // decision 0010's collapse paying off: a capability without a
    // protocol surface. The register does not move for this.
    //
    // WHY A PERSON WANTS IT (Andy): add-by-handle matches on an exact,
    // case-folded `publicLabel`, so the label is a word somebody has to
    // be able to say out loud — and until now it was chosen by whoever
    // minted their invite, permanently.
    if (body && body.rename) {
      out = renameSelf(who, String(body.rename.label || ''), hash);
    }

    // TAKING ONE BACK, by label — the only handle an unclaimed invite
    // has, and the only one the owner's report gives them.
    //
    // NO SELF PATH, unlike remove-peer: an unclaimed invitee has no
    // identity on this relay and can sign nothing. So this is purely an
    // owner verb about the owner's own box, which is why it could be born
    // as a packet and never needs a door of its own (decision 0010).
    // ── WHAT THIS BOX CALLS ITSELF ──────────────────────────────────
    //
    //   Andy: "the owner should be able to change the public label of
    //   his relay."
    //
    // OWNER ONLY, and it is the one verb here whose subject is the relay
    // rather than a row on it. `rename` above moves a PEER's own row and
    // every member holds it; this moves the box's own caption and only
    // the key in allow.json may.
    //
    // A packet, like everything else, and it needs no door for the
    // reason 0010 gives: the relay is a peer with a key, so the browser
    // addresses it the way it addresses anybody.
    if (body && body.relayLabel && owner) {
      out = setRelayLabel(String(body.relayLabel.label || ''), hash);
    }

    // ── PARTNERSHIP, AND THE PROOF WAS READ BEFORE IT GOT HERE ──────
    //
    // Owner-only: who this relay partners with is the owner's decision
    // about their own box, the same class as naming it.
    //
    // The reciprocity — that this peer really owns the relay at that url
    // — was checked against a PUBLIC census by the owner's node before
    // this post was signed. It is not re-checked here because a relay
    // makes no outbound request, and because nothing about the check
    // needs privilege: `/api/relay/who` is readable by anyone, which is
    // what makes the node's report trustworthy rather than merely
    // trusted.
    if (body && body.partner && owner) {
      out = setPartner(
        who,
        String(body.partner.key || ''),
        String(body.partner.url || ''),
        String(body.partner.relayKey || ''),
        hash
      );
    }

    if (body && body.unpartner && owner) {
      out = clearPartner(who, String(body.unpartner.key || ''), hash);
    }

    if (body && body.revoke && owner) {
      var revokedLabel = String(body.revoke.label || '');
      var gone = invites.revokeInvite(rootDir, revokedLabel);
      invites.sweepExpired(rootDir);
      // The owner's own act, logged on the owner's own box (R2). Taking a
      // reservation back is a membership decision as much as granting one
      // — and it is the one most worth a record, because it is what an
      // owner does when something has gone wrong.
      ownerEvent('invite-revoked', { invite: revokedLabel, revoked: gone, cause: hash });
      out = { ok: true, revoked: gone };
    }

    // MINTING AN INVITE, asked for the same way. The owner's name is not
    // taken from the packet: it is read from allow.json here, because the
    // only sender who reaches this line is the owner and a name the
    // caller supplied would be a second opinion about that.
    if (body && body.invite && owner) {
      var ask = body.invite;
      out = mint(auth.ownerName(allow), ask.label, ask.days, ask.token, hash);
    }

    // `body.setDevice` STOOD HERE. It was the verb that proved a relay
    // should answer more than its owner — and then the same reasoning
    // carried one step further showed a relay should not hold a device
    // key at all. The door it opened stays open: removing yourself is
    // still an own-row verb, and that is what keeps the gate honest.

    // ── SENDING IS A FUNCTION NOW, because an answer can arrive late ──
    //
    // Everything answerSelf does is immediate except one thing: a search
    // asked BY A MEMBER is also asked of this relay's partners, and their
    // replies come back on held streams whenever they come back. So the
    // reply is sent by calling this rather than by falling off the end.
    //
    // Every other verb calls it at once and behaves exactly as before.
    function sendAnswer(answer) {
      var mine = auth.loadIdentity(rootDir);
      if (!mine || !mine.privateKey) return;
    // NO APP. This wrote an app name into every answer — the box
    // naming an app, in bytes the box never reads. Andy: "nothing in node
    // and relay should know about apps." A packet addressed to a relay
    // has no app on any node to be for, and the absence is now what marks
    // it as a system packet to whoever decodes one. Which is not this
    // file, and not any file next to it — the decoder lives in js/client/.
      var reply = JSON.stringify({ v: 1, body: answer });

    // NOT THROUGH routeReply, and the reason is the same asymmetry that
    // made this requirement necessary in the first place: routeReply
    // begins with deviceIdentity, which resolves the owner and peer rows
    // and NOT this relay's own key. Sending its own answer through the
    // public door would have it refuse itself.
    //
    // Everything else is identical to what routeReply does, and
    // deliberately so — same table, same `answer` check that the replier
    // is the route's target, same event on the requester's stream. Only
    // the identity lookup is skipped, because the identity is this
    // process.
      var matched = routes.answer(hash, mine.publicKey);
      if (!matched.ok) return;
      presentNow.send(matched.requester, 'reply', {
        hash: hash,
        from: mine.publicKey,
        text: reply,
        sig: auth.sign(mine.privateKey, auth.receiptMessage(hash)),
      });
    }

    // ── ASK THE PARTNERS, AND MERGE WHAT COMES BACK ──────────────────
    //
    //   Andy: "search must be member gated. on propagated search is
    //   partner gated."
    //
    // A MEMBER asking is answered from this relay AND its partners. A
    // PARTNER asking is answered from this relay alone and asks nobody —
    // `propagate` is false for them, which is the one-hop rule enforced
    // rather than documented.
    //
    // THE MERGER DOES NOT TRUST ORDER. Each partner ranked its own reply
    // with its own copy of peerSearch, at whatever version it is running,
    // and concatenating sorted lists gives a list sorted by nothing. Every
    // row is graded again here, which is also the only way a cap across
    // the merged set means anything.
    //
    // A partner that is slow, down, or refuses contributes nothing and is
    // not an error. The member gets this relay's own answer either way,
    // which is what it would have got yesterday.
    if (pendingSearch) {
      var partnerList = askPartner ? (partners() || []) : [];
      if (!partnerList.length) {
        sendAnswer(out);
        return;
      }

      var asked = partnerList.map(function (p) {
        var text = JSON.stringify({ v: 1, body: { search: { q: pendingSearch.q } } });
        return askPartner(p.url, p.relayKey, text)
          .then(function (answer) {
            var said = null;
            try { said = JSON.parse((answer && answer.text) || ''); }
            catch (e) { said = null; }
            var body = (said && said.body) || {};
            if (!body || body.ok !== true) return null;
            return { via: p.relayKey, rows: body.matches || [] };
          })
          .catch(function () { return null; });
      });

      Promise.all(asked).then(function (answers) {
        var sources = [{ via: null, rows: pendingSearch.mine }];
        var more = pendingSearch.more;
        answers.forEach(function (a) {
          if (!a) return;
          sources.push(a);
        });
        // THE BUDGET GOES IN, AND WHAT COMES BACK FITS. peerSearch knows
        // what a row is on the wire -- it is the module that puts `via`
        // and `vias` on one -- so it is the module that can measure one.
        var merged = peerSearch.merge(
          sources, pendingSearch.q, peerSearch.SLOTS, MATCH_BUDGET);

        sendAnswer({
          ok: true,
          status: 200,
          more: more || merged.more,
          matches: merged.matches.map(function (row) {
            return {
              publicKey: row.publicKey,
              publicLabel: row.publicLabel,
              claimedAt: row.claimedAt,
              owner: row.owner,
              present: row.present,
              // WHICH PARTNER SUPPLIED IT. Andy: "it must accompany the
              // found records with the partner ID supplying that result
              // record" -- the thread a node follows to record a route.
              via: row.via || undefined,
              // AND EVERY OTHER RELAY IT WAS FOUND ON. Andy: "if you pay
              // the price for search, may as well get valuable, cachable
              // routing info with it." The fan-out already asked every
              // partner and every answer already arrived; the merger used
              // to keep the best row and discard the knowledge that three
              // other relays hold the same peer.
              //
              // Absent when there is only one, so an ordinary answer is
              // the same bytes it always was. `null` inside it means THIS
              // relay, which a node already knows the identity of.
              vias: (row.vias && row.vias.length > 1) ? row.vias : undefined,
            };
          }),
        });
      });
      return;
    }

    sendAnswer(out);
  }

  // `atRelayKey` is the one thing this function takes that NOTHING ON THE
  // WIRE SUPPLIES. It names which partner holds the target, and it exists
  // as a parameter so the forwarding path is drivable and provable while
  // the question of how a node tells a relay that stays open (0012 says
  // the node has the answer; a post has no field for it).
  //
  // So: the public route calls this with four arguments, `atRelayKey` is
  // undefined, and `carryToPartner` returns null. **Forwarding is inert
  // from the wire and cannot be triggered by anybody**, which is the
  // correct state for a path whose target selection is undecided.
  function routePost(fromToken, toToken, text, sig, atRelayKey) {
    // A MEMBER, OR A PARTNER RELAY. In that order, because a member is the
    // ordinary case and a partner key can never also be a member row.
    //
    //   Andy: "search must be member gated. on propagated search is
    //   partner gated."
    //
    // Two gates, two authorities. Everything below still verifies the
    // signature against whichever key was resolved, so admitting a partner
    // here widens WHO may speak and nothing about what they may say —
    // answerSelf decides that, per verb.
    var who = deviceIdentity(fromToken) || partnerIdentity(fromToken);
    if (!who) return { ok: false, status: 403, error: 'no such identity' };

    // A PARTNER MAY ONLY ADDRESS THIS BOX. It is not a member, so it has
    // no business routing to this relay's members: that would be the
    // second hop PARTNERS.md forbids, arriving by the side door. One hop
    // means a partner talks to the RELAY and the relay talks to its own.
    if (who.partner && !postedToSelf(toToken)) {
      return { ok: false, status: 403, error: 'no such peer' };
    }

    // ── ONE LIMIT, FOR EVERY POST THIS BOX CARRIES ───────────────────
    //
    //   Andy: "the relay-to-relay hop is just normal protocol-compliant
    //   traffic, like all other traffic... measurable, throttleable."
    //
    // ABOVE THE postedToSelf BRANCH ON PURPOSE. It sat below it for an
    // hour and that was a special case arriving by accident: a partner's
    // search and a member's verb both address the BOX, take the early
    // return, and were neither counted nor capped. A relay that meters
    // packets to its members and not packets to itself is measuring the
    // half of its work that is easiest to measure.
    //
    // So this is the first thing after the sender is known, which is also
    // the cheap-to-expensive order the rest of this function keeps: a
    // flood must not be able to make this box verify signatures.
    //
    // KEYED ON THE RESOLVED SENDER — a member key, a device key or a
    // partner's relay key — never on anything the sender chose. The note
    // on the old send limit is the reason, and is worth not relearning:
    // "30 sends per minute per name, with the name chosen by the sender,
    // is 30 per minute per made-up string — rotate it and the budget
    // resets, which is exactly what an abuser does and never what a real
    // client does."
    //
    // 429, and it NAMES THE NUMBER. Everything else this route says is
    // deliberately incurious; this is the exception, for the same reason
    // DEVICE_PER_MIN is — it is temporary, and a client that knows the cap
    // waits instead of guessing.
    var fromPartner = !!who.partner;
    var pool = fromPartner ? partnerHits : memberHits;
    var perMin = fromPartner ? partnerPerMin() : MEMBER_PER_MIN;
    if (!rateOk(pool, who.id, perMin)) {
      monitorEvent('refused', who.id, String(toToken), {
        why: 'rate', pool: fromPartner ? 'partner' : 'member',
      });
      return {
        ok: false, status: 429,
        error: 'too many posts — limit is ' + perMin + ' a minute',
        perMin: perMin,
        pool: fromPartner ? 'partner' : 'member',
      };
    }

    // AM I THE TARGET? — asked first, and asked alone.
    //
    //   Andy: "wouldn't it be the smartest move for the relay to check
    //   first if it is the target of a request, then depending if the
    //   requestor is the owner, succeed or fail?"
    //
    // That is this line and answerSelf, in that order. It used to be one
    // question — `postedToSelf(who, toToken)` asked "am I the target AND
    // is this the owner" in a breath — so a peer was told `no such peer`
    // as though the relay were not the target at all. Now the two are
    // separate: here, whether this box is being addressed; there, one
    // verb at a time, whether this caller may ask for it.
    //
    // Checked before deviceIdentity is asked about the target, because
    // the relay's own key is deliberately not a row and never will be —
    // publishing it as one would put it in every census.
    if (postedToSelf(toToken)) {
      var selfSigned = auth.postSignatureFor(who.publicKey, who.id, String(toToken), text, sig);
      if (!selfSigned) return { ok: false, status: 403, error: 'bad post signature' };
      if (typeof text !== 'string' || !text) {
        return { ok: false, status: 400, error: 'text required' };
      }
      if (text.length > MAX_ROUTED_TEXT) {
        return { ok: false, status: 413, error: 'too big' };
      }
      var selfHash = auth.requestHash(selfSigned);
      // Registered before it is answered, exactly as a peer-to-peer post
      // is: nothing leaves until the thing that will match its answer
      // exists.
      var opened = routes.open(selfHash, who.id, String(toToken), function () { return true; });
      if (!opened || !opened.ok) return opened;
      // METERED LIKE ANY OTHER POST. A search a partner asks costs this
      // box real work and real bytes; leaving it out of the ring would
      // make the governor blind to exactly the traffic partnering adds.
      meterNote(text.length, fromPartner);
      answerSelf(selfHash, text, who);
      return withStatus(opened, selfHash);
    }

    var target = deviceIdentity(toToken);

    // ── NOT MINE: ASK THE PARTNERS TO CARRY IT ───────────────────────
    //
    // `no such peer` was the whole answer until now, and it was the right
    // answer while this box was the only one that could deliver. With
    // partners it is premature: the key may be a member of somebody this
    // relay has verified and been verified by.
    //
    // ONLY FOR A MEMBER'S POST. A partner's post is never re-forwarded —
    // that is the second hop, and the check is `!fromPartner` rather than
    // a counter, so there is no arithmetic anybody can get wrong.
    if (!target && !who.partner) {
      var carried = carryToPartner(who, toToken, text, sig, atRelayKey);
      if (carried) return carried;
    }

    if (!target) return { ok: false, status: 404, error: 'no such peer' };

    if (typeof text !== 'string' || !text) {
      return { ok: false, status: 400, error: 'text required' };
    }
    if (text.length > MAX_ROUTED_TEXT) {
      return { ok: false, status: 413, error: 'too big' };
    }

    // The message that VERIFIED, not a yes/no — the ±1 minute window
    // means three strings could have made this signature and the hash
    // must be over whichever one did. Recovering it is what lets the
    // minute stay off the wire entirely.
    var signed = auth.postSignatureFor(who.publicKey, who.id, target.id, text, sig);
    if (!signed) return { ok: false, status: 403, error: 'bad post signature' };

    // DELIVER OR REFUSE, and refuse instantly (decision 0006). Presence
    // is what makes this answerable at all, and it is why that arc came
    // first.
    if (!presentNow.isPresent(target.id)) {
      monitorEvent('refused', who.id, target.id, { why: 'peer not reachable' });
      return { ok: false, status: 503, error: 'peer not reachable' };
    }

    var hash = auth.requestHash(signed);

    // NO HASH IS SENT. The target derives it from the bytes it holds,
    // which is what makes it evidence rather than an echo (ROUTER.md §2).
    // WATCHED, IF ANYBODY IS. Facts only — who, to whom, how big, which
    // hash — and never the text: a monitor carrying payloads would make
    // the owner's screen a place everybody else's words pass through,
    // which is what 0006 just emptied off this box.
    monitorEvent('post', who.id, target.id, { bytes: text.length, hash: hash });
    // AND THE METER, counted where the bytes are known and the decision to
    // carry them has been made. Aggregate: `who` is not passed, and there
    // is nowhere in `meterNote` to put it if it were — only whether it
    // crossed a partnership, which is a count and not an identity.
    meterNote(text.length, fromPartner);
    return withStatus(routes.open(hash, who.id, target.id, function () {
      return presentNow.send(target.id, 'request', {
        from: who.id,
        to: target.id,
        text: text,
        sig: sig,
      });
    }), hash);
  }

  function withStatus(result, hash) {
    if (!result || !result.ok) return result;
    return { ok: true, status: 202, hash: hash };
  }

  // The answer, coming back. The hash finds the request; being its
  // target is the permission — anyone who saw the bytes could compute
  // the hash, so the two are never the same check.
  function routeReply(fromToken, hash, text, sig) {
    var who = deviceIdentity(fromToken);
    if (!who) return { ok: false, status: 403, error: 'no such identity' };
    if (!hash) return { ok: false, status: 400, error: 'hash required' };
    if (typeof text === 'string' && text.length > MAX_ROUTED_TEXT) {
      return { ok: false, status: 413, error: 'too big' };
    }

    // Signed over the hash, so the relay cannot manufacture a receipt
    // for a request nobody answered.
    if (!auth.receiptSignatureOk(who.publicKey, hash, sig)) {
      return { ok: false, status: 403, error: 'bad receipt signature' };
    }

    var matched = routes.answer(hash, who.id);
    if (!matched.ok) {
      monitorEvent('refused', who.id, '', { why: matched.error || 'no such route', hash: hash });
      return matched;
    }
    monitorEvent('reply', who.id, matched.requester || '', {
      bytes: typeof text === 'string' ? text.length : 0, hash: hash,
    });

    // THE ONE ASYMMETRY IN THE WHOLE ARRANGEMENT.
    //
    // Every other requester is a node holding a stream, and the answer
    // is pushed down it. When the requester is THIS RELAY — which it is
    // for a device enrolment, where the relay posts on a browser's
    // behalf — there is no stream to push to, because a relay does not
    // hold one to itself. Its far end is a browser holding a POST open.
    //
    // So the answer resolves that instead. Same hash, same table, same
    // `answer()` check that the replier is the target; only the last
    // hop differs, and it differs because the thing waiting is a
    // connection rather than a socket.
    // ── A REPLY TO SOMETHING A PARTNER ASKED FOR ─────────────────────
    //
    // The member answered a packet that arrived through a partner, so the
    // reply does not go down a stream — it goes back up the tunnel, as
    // the answer to the partner's own post. Same asymmetry as the device
    // case below, and for the same reason: the requester here is this
    // relay, which holds no stream to itself.
    //
    // THE MEMBER'S REPLY TRAVELS WHOLE. Its text and its signature over
    // the inner hash are passed through untouched, so N1 verifies N2's
    // receipt itself and neither relay can alter what was said without
    // breaking it.
    if (forwarding[hash]) {
      var answerPartner = forwarding[hash];
      delete forwarding[hash];
      answerPartner({
        ok: true, status: 200,
        forwarded: {
          from: who.id,
          text: typeof text === 'string' ? text : '',
          sig: sig,
        },
      });
      return { ok: true, status: 200, delivered: true };
    }

    if (awaitingReply[hash]) {
      settleHere(hash, {
        ok: true, status: 200, hash: hash,
        from: who.id,
        text: typeof text === 'string' ? text : '',
        sig: sig,
      });
      return { ok: true, status: 200, delivered: true };
    }

    // The request is over either way. If the requester has gone, the
    // answer is dropped — 0006, unchanged — but the TARGET is told, so
    // it knows its work did not land rather than assuming it did.
    var landed = presentNow.send(matched.requester, 'reply', {
      hash: hash,
      from: who.id,
      text: typeof text === 'string' ? text : '',
      sig: sig,
    });
    return { ok: true, status: 200, delivered: !!landed };
  }

  // THE ROSTER WITH STATES, and never the list of the connected. If this
  // sent only who is here, a key a node did not hear about would be
  // ambiguous between a member who is away and somebody this relay has
  // never heard of — and the first is red while the second is white
  // (PRESENCE.md §4). Both halves are already here: who() is the roster,
  // the registry is the subset.
  //
  // Nothing secret: /api/relay/who hands the same labels and keys to
  // anyone who asks. What is new is liveness, which is disclosure and is
  // intended.
  // THE RELAY'S OWN CONDITION, TO ITS OWNER AND TO NOBODY ELSE.
  //
  // The delivery rule lives here rather than in relayStatus.js because
  // this is the only place that knows who the owner is, and because
  // getting it wrong is the whole risk: this report carries live invite
  // labels, which are in no census and on no public route.
  //
  // `presentNow.send(id, ...)` addresses ONE sink. The mistake to avoid
  // is broadcast(), which walks every sink and cannot express a
  // recipient at all — it is how every other event on this stream
  // travels, so reaching for the familiar one would publish an owner's
  // invites to every connected peer. spirit/test/relayStatus.js asserts
  // the negative half for exactly that reason.
  //
  // Silent when the owner is not connected. A relay does not queue and
  // does not retry (0006); the next report is along shortly, and one the
  // owner was not there for is not worth keeping.
  // IS ANYBODY WATCHING. RAM, transient, and nothing is stored on
  // anyone's behalf — the same shape as presence, and 0006 is untouched.
  //
  // A relay does not push activity nobody reads. R9 shipped with a ten
  // second timer that ran for ever, watched or not, and a box that must
  // survive and earn its keep (0007) has no business spending cycles on
  // telemetry for an empty room.
  var monitoring = false;

  // WHAT THIS WATCHER ASKED TO SEE.
  //
  //   Andy: "The monitoring api has filtering-at-the-source options, so
  //   the noise of the stream can be controlled and targeted."
  //
  // At the SOURCE, which is the whole point: a relay that pushed
  // everything and let a panel throw most of it away would spend the
  // work anyway, on a box that has to earn its keep. A filtered-out
  // event costs nothing here — it is not built, not serialised, and
  // never touches a socket.
  //
  // NOT IN THE SIGNED BYTES, deliberately, and it is worth saying why
  // rather than leaving it to look like an oversight: the signature
  // proves the OWNER asked to watch, and the filter can only ever
  // NARROW what that same owner's own sink receives. There is nothing to
  // escalate to — a forged filter shows its forger less.
  var monitorFilter = null;

  function monitorWants(kind, from, to) {
    if (!monitorFilter) return true;
    if (monitorFilter.kinds && monitorFilter.kinds.indexOf(kind) === -1) return false;
    if (monitorFilter.peer && monitorFilter.peer !== from && monitorFilter.peer !== to) return false;
    return true;
  }

  // The shapes a caller may ask for, read defensively: a filter this does
  // not understand is no filter, never an empty one. Refusing everything
  // because a field was misspelled would look exactly like a quiet relay.
  function readMonitorFilter(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var out = {};
    if (Array.isArray(raw.kinds) && raw.kinds.length) {
      out.kinds = raw.kinds.map(String).filter(function (k) {
        return k === 'post' || k === 'reply' || k === 'refused';
      });
      if (!out.kinds.length) delete out.kinds;
    }
    if (typeof raw.peer === 'string' && raw.peer) out.peer = raw.peer;
    return Object.keys(out).length ? out : null;
  }

  // setMonitor STOOD HERE, with its own signed message and its own
  // public route, and it was the worked example in decision 0010: a verb
  // added by hand because the protocol had no way to say the thing, on a
  // morning when the relay was not yet a peer.
  //
  // It is said as a packet now (answerSelf), so the gate went with the
  // door. Four things went and nothing replaced them: the route, the
  // signed format, the node's proxy verb, and this.
  //
  // WHERE THE GATE WENT, since a reader will look for it: into the post's
  // own signature, which proved the owner before answerSelf ever ran. A
  // second check here would be a second place to decide who the owner is.

  // ── WHAT THE BOX DID ABOUT WHO BELONGS ON IT ─────────────────────────
  //
  //   Andy: "There is a category of events on the relay that the owner
  //   should have a log of."
  //
  // R2, design/cycles/2026-09-15-labels-are-not-identities.md. This is
  // that category, and it is NOT the monitor below.
  //
  // THE TWO ARE OPPOSITES, and until 2026-09-15 only one of them existed.
  // Every `relay-event` this file could send was TRAFFIC — post, reply,
  // two refusals — which is the one thing decision 0006 says a relay must
  // not keep. Nothing at all fired for membership, which is the thing an
  // owner is entitled to keep. Inverted, exactly.
  //
  //   monitorEvent   traffic       opt-in (`monitoring`), live, forgotten
  //   ownerEvent     membership    always on, and the owner's node LOGS it
  //
  // Always on is the point. The monitor is a screen you open; this is a
  // record you keep, and the owner is usually not watching when somebody
  // claims a slot. A category that only fired while a tab was open would
  // be the same nothing it replaces.
  //
  // ── THE RELAY STILL KEEPS NOTHING ────────────────────────────────────
  //
  // It EMITS; the owner's node keeps (trafficLog). No event file here, no
  // ring, no history — 0006 is untouched, and the durability sits on the
  // owner's own hardware, which is that decision's whole argument.
  //
  // So it is SILENT WHEN THE OWNER IS AWAY. A relay does not queue and
  // does not retry. Nothing is lost that matters: the roster, the invite
  // list and `claimedAt` carry the fact, and the next `statusToOwner` on
  // stream-open hands them over.
  //
  // ── TO ONE SINK, AND THIS IS THE HAZARD ──────────────────────────────
  //
  //   Andy: "They should go to the log... of the owner only."
  //
  // `presentNow.send(ownerKey, …)` addresses ONE sink. `broadcast()`
  // walks every sink and cannot express a recipient at all — and it is
  // how every other event on this wire travels, so reaching for the
  // familiar one is the mistake available here.
  //
  // Worse here than for the status report that warning was first written
  // about, because a claim notice carries TWO things no other peer may
  // see: a third party's key, and the owner's out-of-band handle for them
  // — which may be a phone number (R1). Broadcasting it would publish
  // that to everybody holding a stream.
  //
  // FACTS, NEVER PAYLOADS. Same rule as the monitor and for the same
  // reason: a relay that put anybody's words on the owner's screen would
  // be the ring in a new file.
  function ownerEvent(kind, extra) {
    var ownerLabel = auth.ownerName(allow);
    var ownerKey = ownerLabel && allow.byName && allow.byName[ownerLabel];
    if (!ownerKey) return false;
    if (!presentNow.isPresent(ownerKey)) return false;
    var row = { at: new Date().toISOString(), kind: String(kind || '') };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });

    // ── `cause`: WHICH POST CAUSED THIS ──────────────────────────────
    //
    //   Andy: "the reply from the server must come with a hash,
    //   generally, so it can reconcile the request in the log with the
    //   reply from the relay."
    //
    // One press of Revoke writes three rows on the owner's node: the
    // request it posted, the reply that came back — joined by a hash —
    // and the owner-event the relay pushed, which shared no key with
    // either. The same act, in three rows, two of which were a story and
    // one of which was an orphan.
    //
    // The relay knew all along: `answerSelf(hash, text, who)` receives
    // the hash of the post it is answering, and every post-driven verb
    // fires from inside it. So the hash is threaded through mint,
    // renameSelf and forgetPeer and arrives here as `cause`.
    //
    // ABSENT ON A CLAIM, and that is honest rather than a hole: a claim
    // arrives on an HTTP route, not as a post, so there is no hash in
    // existence to name. Which gives the rule this file should be read
    // by — THE HASH IS THE JOIN KEY FOR ACTS SOMEBODY POSTED, not a key
    // for the log as a whole. An event this relay merely witnessed has
    // no hash and never will; its handle is the peer key and the time.
    if (!row.cause) delete row.cause;
    var sent = !!presentNow.send(ownerKey, 'owner-event', row);

    // ── AND THE REPORT THAT FOLLOWS FROM IT ──────────────────────────
    //
    //   Andy: "while trying to revoke all adam invites one by one, but
    //   the panel kept showing all, not behaving in an understandable
    //   way?"
    //
    // It was understandable and it was this. `statusToOwner` fired on
    // three occasions — a stream opening, a stream closing, and monitor
    // being switched on — and on no MEMBERSHIP CHANGE at all. So an
    // owner who minted, revoked, renamed or removed somebody kept the
    // report from whenever a socket last moved, and the invite panel
    // redrew four invites that had been gone for three minutes.
    //
    // The node's own log said so plainly and the screen did not:
    //
    //   06:59:52  invite-revoked  adam  revoked=4
    //   06:59:55  invite-revoked  adam  revoked=0
    //   07:02:39  invite-revoked  adam  revoked=0
    //
    // The first press took all four — revoking by label takes every
    // invite under it — and the next two found nothing, exactly as they
    // should have. Only the picture was wrong.
    //
    // SO THE TWO TRAVEL TOGETHER. Every caller of this function is a
    // moment the relay's membership changed, which is the same set of
    // moments the report goes stale. Putting the push here rather than
    // at the five call sites means the next verb to arrive cannot forget
    // it, which is how this one came to be missing.
    //
    // A refused claim re-sends an unchanged report. That is bounded — the
    // claim event only fires past the rate gate (see `seen.gate`) — and
    // cheap, and the alternative is a flag threaded through five call
    // sites to save a message nobody would notice.
    statusToOwner();
    return sent;
  }

  // ONE ROUTED THING HAPPENED. Sent only while somebody is watching, only
  // to the owner's sink, and never stored.
  //
  // Facts, not payloads: who, which direction, what came of it. A monitor
  // that carried the text would make an owner's screen a place everybody
  // else's words pass through, which is the thing 0006 just emptied off
  // the relay.
  function monitorEvent(kind, from, to, extra) {
    if (!monitoring) return false;
    // Before anything is built. A filtered event must cost nothing, or
    // the filter is a courtesy rather than a control.
    if (!monitorWants(kind, from, to)) return false;
    var ownerLabel = auth.ownerName(allow);
    var ownerKey = ownerLabel && allow.byName && allow.byName[ownerLabel];
    if (!ownerKey || !presentNow.isPresent(ownerKey)) return false;
    var row = {
      at: new Date().toISOString(),
      kind: kind,
      from: from || '',
      to: to || '',
    };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return !!presentNow.send(ownerKey, 'relay-event', row);
  }

  function statusToOwner() {
    var ownerLabel = auth.ownerName(allow);
    var ownerKey = ownerLabel && allow.byName && allow.byName[ownerLabel];
    if (!ownerKey) return false;
    if (!presentNow.isPresent(ownerKey)) return false;

    var mem = {};
    try { mem = process.memoryUsage(); } catch (e) { mem = {}; }

    return !!presentNow.send(ownerKey, 'relay-status', relayStatus.report({
      partners: partners(),
      snapshot: snapshot(),
      present: presentNow.present(),
      routes: routes.size(),
      // WHAT THIS BOX ACTUALLY MOVED, so the governor in CAPACITY.md can
      // be built against observation. Aggregate and derived on the way
      // out; the ring itself never leaves this process.
      meter: meterRead(),
      // AND WHAT IT IS CURRENTLY ALLOWING. Grok: "starting cap is
      // published, not a silent backstop." Published to the owner here,
      // which is the party that has a channel for it today; publishing to
      // members is the governor's announcement, capped at two minutes and
      // not built. Partners are told on the reply, per the one-bus rule,
      // and so need no announcement at all.
      caps: { memberPerMin: MEMBER_PER_MIN, partnerPerMin: partnerPerMin() },
      // SWEPT BEFORE IT IS READ.
      //
      //   Andy: "anytime the UI askes for a list of pending invites, the
      //   list should be cleaned up before its returned."
      //
      // This report is the only place an owner ever sees invites, so this
      // is that moment. relayStatus.liveInvites already filters expired
      // rows out of the DISPLAY — what this fixes is the FILE, which was
      // the half nothing was doing.
      invites: (function () {
        invites.sweepExpired(rootDir);
        return invites.load(rootDir);
      }()),
      version: require('./kernel').core.const.VERSION + ' ' + RUNNING.commit +
        (RUNNING.dirty ? '+dirty' : ''),
      proc: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        uptime: (function () { try { return process.uptime(); } catch (e) { return 0; } })(),
      },
    }));
  }

  // THE ROSTER IS PER RECIPIENT, which is the shape agreed when the
  // census had to show a device to its owner and to nobody else. This is
  // the same rule reaching its second user:
  //
  //   Andy: "We discussed this topic when we discussed how the peer-list
  //   can be customized for peers or owners."
  //
  // The OWNER's roster carries this relay itself; a peer's does not. That
  // is how the owner's node learns it can address the box — through the
  // ordinary presence mechanism, rather than through a special case in
  // whoever wants to post. `relaysNaming` then answers for the relay's
  // own key exactly as it does for any peer, and nothing above it needs
  // to know this row is different.
  //
  // Still out of `who()`, so the public census is unchanged: addressable
  // is not published. A relay that listed itself would put its key in
  // every peer's roster and in every census any stranger can fetch.
  // NO LONGER PER-RECIPIENT, and the parameter went with the rule. It
  // took `forKey` so it could decide whether to include the relay row,
  // and every member gets that row now — so the roster this relay sends
  // is the same roster for everybody, and a parameter implying otherwise
  // would be the kind of lie a later reader builds on.
  function streamRoster() {
    var members = who().map(function (p) {
      return {
        key: p.publicKey || '',
        label: p.publicLabel || '',
        present: presentNow.isPresent(p.publicKey || ''),
      };
    });

    // ── A RELAY IS A PEER TO EVERY MEMBER, NOT ONLY TO ITS OWNER ─────
    //
    // This row went to the owner alone, and that was true enough while
    // everything answerSelf could be asked was an owner verb. It is not
    // true any more: `rename` is an own-row verb — a peer renaming
    // ITSELF — and so is removing your own seat. Both are things a member
    // must be able to ask the relay directly.
    //
    // They work today only because hub.askRelay names a URL and posts to
    // it, going around presence entirely. The moment the post-path doors
    // close and a member addresses the relay by KEY like any other peer,
    // `presence.relaysNaming(relayKey)` is what answers — and it answers
    // from this roster. Owner-only here would have meant a member could
    // not rename itself, which is a gate nobody decided.
    //
    // Nothing is given away by widening it: the key is already public at
    // /api/relay/who to anybody who asks. What the roster adds is that a
    // member holding a stream can now SEE the relay on the other end of
    // it, which was always the case and was simply unsaid.
    //
    // Always present: a relay answering the question is a relay that is
    // up, and a stream cannot be open to it otherwise.
    //
    // MARKED BY KEY, NOT NAMED. This carried `label: 'relay'` — the
    // reserved caption — which meant a list told a relay from a peer by
    // reading a string any peer could have worn. `relay: true` is a flag
    // on the row beside its key, the same shape as `owner` on a census
    // row, and the caption is left empty because a relay does not have
    // one. presenceNode reads `key` and `present` and has never looked at
    // the label.
    // ONE ROW PER KEY. A roster is read into a map keyed by `key`
    // (presenceNode.onRoster), so a second row for the same key does not
    // appear twice — it OVERWRITES, silently, and the last one wins.
    //
    // That is not hypothetical: a relay whose identity.json holds the same
    // keypair its owner claimed with is one key wearing two hats, and this
    // row would have replaced that member's real presence with `true`.
    // Nothing in the protocol forbids the arrangement, so this does not
    // either — it just refuses to say the same key twice.
    var mine = relayPublicKey();
    var already = mine && members.some(function (m) { return m.key === mine; });
    if (mine && !already) {
      members.push({ key: mine, label: '', relay: true, present: true });
    }
    return { members: members };
  }

  // The gate. Order is load-bearing at every step.
  function streamOpen(token, sig, sink) {
    // 1. Unknown identity first, before any bucket and before any crypto.
    //    B1's rule: a registry keyed by caller-chosen input grows when a
    //    stranger reaches it, so a stranger must not reach it.
    //    A PARTNER RELAY MAY HOLD ONE TOO, and must: a reply leaves this
    //    box through `presentNow.send`, so a partner with no stream can be
    //    asked a question it is unable to answer into. That is tier two's
    //    "request by post, reply by stream, in both directions" — the
    //    partner is structurally in the position of a node here, and every
    //    line below treats it as one because it resolves to an identity
    //    with a key and a signature like any other.
    var who_ = deviceIdentity(token) || partnerIdentity(token);
    if (!who_) return { ok: false, status: 403, error: 'no such identity' };

    // 2. The signature, against THAT identity's own row key. Never the
    //    owner's house key — owning the relay is not owning a row — and
    //    never a device key, for the reason deviceGate gives: a borrowed
    //    phone must not open the wire its owner is on.
    if (!auth.streamSignatureOk(who_.publicKey, who_.id, sig)) {
      return { ok: false, status: 403, error: 'bad stream signature' };
    }

    // 3. AUTHENTICATE, THEN TOSS. connect() evicts any live connection
    //    for this identity, so it must be unreachable until the caller
    //    has proved they are that identity — otherwise anybody could
    //    knock any peer offline by connecting badly in their name.
    var opened = presentNow.connect(who_.id, sink);
    if (!opened.ok) return opened;

    // 4. The roster, then the fact that this one arrived. Order matters
    //    for the newcomer too: it must see itself present in its own
    //    first snapshot rather than learn it from a change it will never
    //    be sent.
    presentNow.send(who_.id, 'roster', streamRoster());
    presentNow.broadcast('presence', { key: who_.id, present: true });

    // 5. And the owner learns what its box now looks like. Sent after the
    //    roster so an owner opening its own stream gets the membership
    //    first and the condition second, and sent on every arrival
    //    because "who is connected" is half of what the report says.
    //    Silent when the owner is not here — see statusToOwner.
    statusToOwner();
    return { ok: true, status: 200, id: who_.id, label: who_.label };
  }

  // Idempotent, because both `close` and `error` fire on a dying socket
  // and both call this. The broadcast happens only if this sink was
  // actually the live one — a teardown arriving after the same identity
  // reconnected must not announce an absence that is not true.
  function streamClose(token, sink) {
    var who_ = deviceIdentity(token);
    if (!who_) return false;
    if (!presentNow.disconnect(who_.id, sink)) return false;

    // A MONITOR DIES WITH THE STREAM IT WAS WATCHING ON. A browser that
    // crashed must not leave this relay pushing into nothing, and a timer
    // to notice would be a second thing to get wrong: the socket closing
    // IS the notice.
    var ownerLabel = auth.ownerName(allow);
    var ownerKey = ownerLabel && allow.byName && allow.byName[ownerLabel];
    if (monitoring && ownerKey && who_.id === ownerKey) monitoring = false;

    presentNow.broadcast('presence', { key: who_.id, present: false });
    // Somebody leaving changes the report as much as somebody arriving.
    // A no-op when the leaver IS the owner, which is correct: there is
    // nobody left to tell.
    statusToOwner();
    return true;
  }

  return {
    claim: claim,
    forgetPeer: forgetPeer,
    who: who,
    relayPublicKey: relayPublicKey,
    // The other half of the pair. Read by server.js for the public
    // census; set through the `relayLabel` verb in answerSelf.
    relayLabel: relayLabel,
    // Exported for the suite that drives it directly (ownerLog). The
    // browser reaches it through the `relayLabel` verb, like any peer.
    setRelayLabel: setRelayLabel,
    // Who this relay partners with. Owner-only by where it is used —
    // relayStatus puts it in the report, which reaches the owner alone.
    partners: partners,
    setPartner: setPartner,
    clearPartner: clearPartner,
    // `status` STOOD HERE and went with its route (R3). What an owner
    // learns about its relay arrives on the owner's stream —
    // statusToOwner, below — and is not something anybody asks for.
    mint: mint,
    snapshot: snapshot,
    // Pushed on every presence change from inside this file; server.js
    // also calls it on a timer, because memory and uptime move when
    // nothing else does — and a monitor that only updates when a peer
    // connects would look frozen on a quiet relay.
    statusToOwner: statusToOwner,
    // Watching, on demand — asked for as a packet (answerSelf), never as
    // a verb of its own. Read-only from out here, and it dies with the
    // owner's stream.
    monitoring: function () { return monitoring; },
    monitorFilter: function () { return monitorFilter; },
    // The whole device surface, now that the slot and its two verbs are
    // gone: one call, which posts the offer to the node and resolves when
    // the node answers. Nothing here reads the password — it is a string
    // this relay carries and does not compare.
    deviceOffer: deviceOffer,
    // The presence wire. streamOpen is the gated entry a route may call;
    // the registry below is in-process and ungated, for tests that drive
    // it directly.
    routePost: routePost,
    routeReply: routeReply,
    routes: routes,
    streamOpen: streamOpen,
    streamClose: streamClose,
    streamRoster: streamRoster,
    presence: presentNow,
    // WHAT THE RING MAY BE SHRUNK TO. Exposed so the governor has one
    // place to ask rather than three constants to respect, and so a suite
    // can check the floor without driving a box out of memory.
    meterFloor: meterFloor,
    // The byte budget a search answer is cut to. Exposed so a suite can
    // drive the cut rather than recompute it — the number and the rule
    // have to be the same ones the wire gets.
    matchBudget: function () { return MATCH_BUDGET; },
    // Does anybody here hold this key or label? Answers a LABEL, never a
    // key and never a device key — the routing layer needs to know an
    // identity exists and what to call it, and nothing more. Everything
    // it could return is already public at /api/relay/who.
    deviceIdentityPublic: function (token) {
      var who = deviceIdentity(token);
      return who ? { label: who.label, owner: !!who.owner } : null;
    },
  };
}

// Where the proof of a read is allowed to travel.
//
// A query string is written to every access log the request passes
// through — Caddy's on this box, and whatever sits in front of it — so a
// signature there is a read credential sitting in a log file. The signed
// bytes carry a minute (relayAuth.streamMessage), which makes a captured
// one expire; this is what stops it being written down at all.
//
// A request that still puts `sig` on the query is refused even when the
// header is perfectly good. Accepting it "just this once" is how a caller
// stays unfixed, and a signature that has been in a URL is already in a
// log whatever happens next. `key` may stay on the query: it is the
// identity being asked for, not the permission to be it.
//
// NAMED FOR THE STREAM NOW, and it was `inboxSignatureFrom`. The rule was
// written for `GET /api/relay/inbox` and outlived it by one commit: R8
// deleted that route and this is the last GET on the relay that carries a
// signature at all. Renamed rather than deleted, because the rule never
// belonged to the ring — it belongs to the shape of a GET.
//
// A function rather than four lines in the route, so a test can drive
// the decision itself instead of reading the source and hoping.
function streamSignatureFrom(querySig, headers) {
  if (querySig) {
    return { ok: false, status: 403, error: 'stream signature must be a header' };
  }
  var h = headers || {};
  return { ok: true, sig: h['x-spirit-sig'] || h['X-Spirit-Sig'] || '' };
}

module.exports = { createRelay: createRelay, streamSignatureFrom: streamSignatureFrom };
