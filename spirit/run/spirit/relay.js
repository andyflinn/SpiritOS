'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./relayAuth');
const invites = require('./invites');
// One place decides how big a thing may be, and the browser reads the
// same file (js/limits.js). A cap the client pre-checks must be the cap
// the relay enforces, or the pre-check is a lie.
const limits = require('./limits.js');
// The peer search's one ranker, on the probability modules (goal/G29.17), shared with the node.
const peerRank = require('./peerRank');
const presence = require('./presence');
const routerTable = require('./router');
const relayStatus = require('./relayStatus');
// The relay's data on disc (cycle 3): members and invites.
const relayStore = require('./relayStore');
const faceRoute = require('./faceRoute');
// The same validation the file gets at boot, so the owner's `config` verb
// (reconfigure) cannot accept a figure a restart would then refuse.
const relayConfig = require('./relayConfig');
// A relay is a peer with a key (0010), so posts addressed to it are
// sealed like any other and it opens them with its own (cycle 10, R9).
const seal = require('./seal');
// And it keeps its members' cards, verifying each one on every read
// against the key its row is filed under (cycle 10, R5 and R13).
const nodeCard = require('./nodeCard');
// The ceilings the owner's read reports — what this box could give — from
// the same module the installer and first start use.
const relayLimits = require('./relayLimits');
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
// AND IT IS COUNTED IN BYTES (the byte-counting finding of the review of
// 2026-10-10, goal/G16.6). Cited by what it says rather than by its number:
// that review is not a cycle, and a bare requirement number names a
// different thing in each of them (test/cycleCitations.js).
// Andy, 2026-10-10: "in a max_BYTE environment, BYTES must be copied.
// BYTES must be counted. that's a rule." Every check against this cap used
// `text.length`, which counts UTF-16 units, so a text of accents or kanji
// passed a cap it was over and was refused later by the HTTP body cap
// instead — at a different number, under a different name. The five checks
// compare `Buffer.byteLength(text, 'utf8')` now, which is the unit
// PAYLOAD_MAX is written in (limits.js, "the payload cap is BYTES").
var MAX_ROUTED_TEXT = limits.PAYLOAD_MAX;

// How many members one turn of a search walk offers before handing the
// event loop back (walkRoll). Measured 2026-09-19 on the workstation at
// ~5.5 µs a row off disc, when the walk read the roll; the walk is over
// the connected members' rows in RAM now, so a page costs less than
// that. ~5 ms at most: short enough that nothing waits
// behind it, long enough that the turns are not all overhead. A guess to
// be measured on the relay itself, like the timeout floor
// (NODE-AND-RELAY §10).
var SEARCH_PAGE = 1000;

// How many rows a search answers with. Fixed, not measured — see the
// note at the cap itself.
//
// 32 x 418 worst-case bytes = 13376, inside the 16266 a packet leaves
// after its own envelope. PAYLOAD_MAX is the PACKET — the encoded
// envelope, which is what packet.js and MAX_ROUTED_TEXT both measure, in
// bytes at both ends since goal/G16.6.
// `from`, `to` and `sig` sit OUTSIDE it and are covered by
// WIRE_HEADROOM in BODY_MAX, so they must not be subtracted here.
// Doing so once reserved room inside the packet for things that are
// not in it.
// SEARCH_SLOTS MOVED to peerRank.SLOTS (peerSearch.SLOTS until goal/G29.17) — the cap is part of the
// ranking question, not the relay's, and a second copy here is how
// the two would disagree about what a page is.
// DEVICE ENROLMENT WAS REMOVED by goal/G16.2 (Andy: "device WILL be
// KILLED. that's a decision."), and with it the relay posting as itself.
// ── WHAT A LABEL MAY BE ──────────────────────────────────────────────
//
// The rule moved to js/fieldRules.js on 2026-09-15 and this requires it.
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
var fieldRules = require('./fieldRules');
var lever = require('./lever');

// ── HOW MANY STREAMS THE OWNER'S RAM ALLOWS (cycle 8) ────────────────────
//
// The Governor's ceiling, kept as the whole rule now that nothing moves it:
// streams per megabyte of the RAM the owner configured. 16 was declared as
// a placeholder in cycle 1; R15 then measured ~58-63 KB a stream on Windows
// and ~42 KB on Linux in the process alone, i.e. 16-24 a megabyte — so 16
// holds, on the careful side, and README/CAPACITY.md is where it is argued.
var STREAMS_PER_MB = 16;

// A SEAT IS THREE STREAMS (goal/G30.15, Andy: "we want to be as sure as possible that we can serve all our members
// simultaneouly."): a member with an open face holds its home node's stream, its face's stream and its home node's
// upload feeding that face, so a seat reserves three of the allowance's streams.
var SEAT_STREAMS = 3;

// THE RAM LEFT AFTER THE RELAY ITSELF (goal/G30.15): the owner's figure less the relay's own memory at rest, measured
// at the end of boot (atRest, below) and kept until the next start. Before boot ends, and in every in-process suite
// that never sets it, it is zero.
function allowanceFor(ramLimitMB, atRestMB) {
  var mb = Number(ramLimitMB);
  if (!(mb > 0)) return null;
  var rest = Number(atRestMB) > 0 ? Number(atRestMB) : 0;
  return Math.max(1, Math.floor((mb - rest) * STREAMS_PER_MB));
}

// ── STRANGERS ARE HELD BY ONE TABLE OF REQUESTING ADDRESSES (goal/G22.6) ──
//
// Andy's decision (goal/G22.6, 2026-10-13): "Strangers are held by one table
// of requesting addresses, as many entries as the relay has members, each
// entry: request count, time of last request, originating address, ban time
// (starting at 1000 ms). An address that asks again before its ban time is
// over has its ban time doubled. A new address takes the first expired slot
// ... The table lives in memory only; nothing about a stranger is written to
// disk. An address that comes back after its ban ended starts again at 1 s.
// An IPv6 address is counted by its /64 block. It replaces the per-address
// claim limit." And, 2026-10-14: the first request from an unknown address is
// answered and puts the address into the table; when the table is full with
// nothing expired, that request is rejected with the error "busy".
//
// So an address NOT in the table is answered and entered at the first free
// or expired slot, or refused busy when there is none; an address already in
// the table is held to its ban. The per-address claim limit is gone.
var STRANGER_BAN_START_MS = 1000;

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
// OUTSTANDING posts (`too many in flight`: DEFAULT_PER_MEMBER, one, for a
// member since 2026-10-02) and the
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
// NAMED IN THE REFUSAL — a page that knows it
// is rate-limited waits, where `not now` makes it guess.
//
// ONE BUDGET, THE MEMBERS'. A second pool for posts a partner relay
// forwarded stood beside it; partnering as a permission is gone (Andy's
// decision, goal/G22.6), and with it the partner roll and the partner
// budget. A stranger is held by the address table instead.
var MEMBER_PER_MIN = 600;

var WINDOW_MS = 60 * 1000;
var RATE_KEY_SWEEP_AT = 1000;

// ── THE ROLL IS ON DISC (cycle 3) ─────────────────────────────────────
//
//   Andy: "storage is actually moved from RAM to DISC, and RAM must become
//   a DISC-client."
//
// routingTable.json STOOD HERE — read whole at boot into a map, rewritten
// whole on every claim, rename and removal. The roll and the invites are
// tables in relay-state/relay.db now (relayStore.js), and
// every question about them is a query. A relay that still holds the old
// file imports it once and keeps it as routingTable.json.imported (D8, see
// design/DEPRECATIONS.md); its legacy handling (D1) went with the reader.
//
// Before that, mailbox.json was this file's name, and the read of the old
// name was deleted once spirit-3 had written the new one (2026-09-13). The
// same discipline holds: data on somebody's box is renamed and kept, never
// deleted by a boot.

// A HOP'S SHARE OF THE BUDGET (HOP_MARGIN_MS), the partner liveness window
// (PARTNER_QUIET_MS) and the injected `deps.askPartner` STOOD HERE. This relay
// no longer carries anything onward to a partner relay: partnering as a
// permission is gone (Andy's decision, goal/G22.6), and a relay carries
// posts to its OWN members from any sender instead.
function createRelay(rootDir, deps) {
  deps = deps || {};
  // The clock the stranger address table reads (goal/G22.6), injectable so
  // a suite can pass a ban without waiting it.
  var clock = typeof deps.now === 'function' ? deps.now : Date.now;
  rootDir = rootDir || path.join(__dirname, '..');
  // THE ROLL AND THE INVITES — on disc, asked by query (cycle 3,
  // relayStore.js). Nothing of them is resident here.
  //
  // Fetched per use rather than held: open() is a cached lookup, so this
  // costs nothing, and a handle closed underneath the relay (a test
  // releasing the file to delete its directory) is simply reopened.
  var store = {
    get members() { return relayStore.open(rootDir).members; },
    get invites() { return relayStore.open(rootDir).invites; },
    transaction: function (fn) { return relayStore.open(rootDir).transaction(fn); },
    // What the roll occupies on disc — the figure `discLimitMB` bounds
    // (cycle 9). Fetched the same way as the rest: through open().
    bytes: function () { return relayStore.open(rootDir).bytes(); },
  };

  // ── THE ACTIVE MEMBERS, IN RAM (cycle 3) ─────────────────────────────
  //
  //   Andy: "why doesn't a member row on the relay db cache on relayed,
  //   incoming requests?"
  //
  // Because it should, deliberately — and the spec already says which
  // rows: RAM holds the ACTIVE members (NODE-AND-RELAY §8). A member's row
  // is cached when their stream opens and dropped when it closes, so every
  // request from or to a connected member is answered here without a disc
  // read. Bounded by the connection allowance — the lever the Governor
  // moves — so the RAM spent on rows follows connections and is governed.
  // A member posting without a stream costs one indexed read, behind the
  // rate gate. Writes go to disc first, then refresh the cached copy.
  var activeRows = Object.create(null);
  function rememberActive(key) {
    var row = store.members.get(key);
    if (row) activeRows[key] = row;
    return row;
  }
  function forgetActive(key) { delete activeRows[key]; }
  function refreshActive(key) {
    if (activeRows[key]) rememberActive(key);
  }
  var ownerKey = auth.loadOwner(rootDir);
  // THE OWNER HAS A SEAT FROM BOOT (goal/G30.7; Andy, 2026-10-20: "if the owner has no seat/row yet at boot time,
  // create a seat: label: owner"). A relay owned by owner.json but never claimed on showed Peers 0 and Owner (none),
  // and refused its owner's rename with no such peer. The row starts with the key and the label owner; his node renames
  // it like any seat, and his claim on it is taken (claimAttempt).
  if (ownerKey) {
    try {
      if (!store.members.get(ownerKey)) store.members.put({ publicKey: ownerKey, publicLabel: 'owner', claimedAt: new Date().toISOString(), card: '' });
    } catch (e) { /* a store that cannot be written is said by every verb that needs it */ }
  }
  // Posts routed, per sender key. The sender is the identity that was
  // RESOLVED, never a name they chose — the reasoning is in the note on
  // `rateOk` below, and it is why the old per-name limit was worthless.
  var memberHits = Object.create(null);

  // ── THE STRANGERS' TABLE (goal/G22.6, Andy's decision; see the note on
  // STRANGER_BAN_START_MS) ───────────────────────────────────────────────
  //
  // In RAM only, and keyed by ADDRESS, never by key: a key is free to mint,
  // an address is not. Nothing about a stranger is written to disk. Its
  // length is the number of members this relay holds (at least one, so an
  // owner's first claim on an empty roll has a slot to take).
  //
  // Each entry: { address, count, last, ban }. An entry is EXPIRED once
  // `last + ban` has passed; an expired entry's slot is the first a new
  // address takes, and the same address coming back to an expired entry
  // starts again at STRANGER_BAN_START_MS.
  var strangers = [];

  // AN IPv6 ADDRESS IS COUNTED BY ITS /64 (Andy's decision): one host owns
  // a whole /64, so counting single addresses would hand it 2^64 slots. An
  // IPv4 address mapped into IPv6 (::ffff:a.b.c.d) is the IPv4 address.
  function addressKey(address) {
    var a = String(address == null ? '' : address).trim().toLowerCase();
    var mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return mapped[1];
    if (a.indexOf(':') === -1) return a;
    var zone = a.indexOf('%');
    if (zone !== -1) a = a.slice(0, zone);
    var halves = a.split('::');
    var head = halves[0] ? halves[0].split(':') : [];
    var tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    var groups = halves.length > 1
      ? head.concat(new Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), tail)
      : head;
    return groups.slice(0, 4).map(function (g) { return (parseInt(g, 16) || 0).toString(16); })
      .join(':') + '::/64';
  }

  function strangerSlots() {
    var members = 0;
    try { members = store.members.count(); } catch (e) { members = 0; }
    return Math.max(1, members);
  }

  // One request from a stranger at `address`: { ok: true } to go on, or the
  // refusal. Asked before the signature is checked: an address cannot be
  // forged at this socket, so a flood is turned away before it costs this
  // box a verification.
  function strangerAdmit(address) {
    var key = addressKey(address);
    var now = clock();
    var size = strangerSlots();
    if (strangers.length > size) strangers.length = size;
    var at = -1;
    for (var i = 0; i < strangers.length; i += 1) {
      if (strangers[i] && strangers[i].address === key) { at = i; break; }
    }
    if (at !== -1) {
      var e = strangers[at];
      if (now < e.last + e.ban) {
        // TOO EARLY: the ban doubles, counted from this request.
        e.ban *= 2;
        e.last = now;
        e.count += 1;
        return {
          ok: false, status: 429, error: 'too early — wait ' + e.ban + ' ms',
          code: 'address-too-early', retryAfterMs: e.ban,
        };
      }
      // BACK AFTER ITS BAN: answered, and it starts again at one second.
      strangers[at] = { address: key, count: e.count + 1, last: now, ban: STRANGER_BAN_START_MS };
      return { ok: true };
    }
    // A NEW ADDRESS takes the first free or expired slot, or is refused busy.
    var slot = -1;
    for (var j = 0; j < size; j += 1) {
      var s = strangers[j];
      if (!s || now >= s.last + s.ban) { slot = j; break; }
    }
    if (slot === -1) {
      var soonest = null;
      strangers.forEach(function (s) {
        var left = s.last + s.ban - now;
        if (soonest === null || left < soonest) soonest = left;
      });
      return {
        ok: false, status: 503, error: 'busy', busy: true, code: 'address-busy',
        retryAfterMs: Math.max(0, soonest || 0),
      };
    }
    strangers[slot] = { address: key, count: 1, last: now, ban: STRANGER_BAN_START_MS };
    return { ok: true };
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
  // A PARTNER COUNT stood beside these (the share of work that crossed a
  // partnership); it went with the partner budget (goal/G22.6).
  function meterNote(bytes) {
    var second = Math.floor(Date.now() / 1000);
    var head = meter.slots[meter.slots.length - 1];
    if (!head || head.second !== second) {
      head = { second: second, bytes: 0, posts: 0, peak: 0 };
      meter.slots.push(head);
      if (meter.slots.length > METER_SLOTS) meter.slots.shift();
    }
    head.bytes += bytes;
    head.posts += 1;
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
    var bytes = 0, posts = 0, peak = 0;
    live.forEach(function (s) {
      bytes += s.bytes; posts += s.posts;
      if (s.peak > peak) peak = s.peak;
    });
    return {
      seconds: live.length,
      bytes: bytes,
      posts: posts,
      peakRoutes: peak,
      // The one figure a governor would divide. Honest about the window
      // rather than extrapolated from a short one.
      bytesPerSec: live.length ? Math.round(bytes / live.length) : 0,
    };
  }

  // Who is holding a stream open right now. In RAM, never persisted —
  // presence is true only while a socket is open (PRESENCE.md §4).
  // The face streams (faceOpen, below) count in this one allowance (goal/G30.12).
  // goal/G30.15: and the home nodes' feed uploads into them, the third connection of a member with an open face.
  var presentNow = presence.createRegistry({ others: function () { return (faceStreams ? faceStreams.size : 0) + (faceFeeds ? faceFeeds.size : 0); } });
  // Pending requests: hash -> who asked, who was asked. No bodies, never
  // disk. `open()` performs the delivery itself, so nothing here can
  // forward a request it could not match the reply to (ROUTER.md §4b).
  //
  // ONE REQUEST MAY BE AIMED AT A MEMBER AT A TIME, and that number is
  // router.js's, not this file's and not the owner's. It was briefly read
  // from relay-state/config.json; a limit an owner can widen is not a
  // limit (2026-09-21), and it bounds what a STRANGER may aim at a member,
  // so it protects parties other than the owner. Counted per sender
  // (goal/G22.6, M5 of the review of 2026-10-10): one sender holding a
  // member's slot does not make that member busy for anybody else.
  // ITS OWN KEY GOES IN (goal/G16.2): a question to the relay itself is not
  // counted against the per-target slot a member gets (router.js, selfKey).
  var routes = routerTable.createRouter({ selfKey: relayPublicKey() || '' });

  // ── A FIXED ALLOWANCE, AND A GAUGE THAT READS IT (cycle 8) ──────────
  //
  //   Andy: "relay will self-manage within fixed/constant limits. i agree."
  //   Grok (review): "delete the whole thing … Levers kept 'for later' grow
  //   a governor back." — Andy: "grok confirms my prediction. delete it is."
  //
  // THE GOVERNOR STOOD HERE: it moved the connection allowance every five
  // seconds by heap readings, inside a ceiling derived from the owner's
  // configured RAM. Nothing is left for it to govern — the owner's RAM is a
  // constant (0015), R15 measured what a stream costs, and R35 cuts the one
  // runtime hazard, a member that stops reading, at a fixed bound. So the
  // ceiling IS the allowance, fixed at boot, and nothing moves it after.
  //
  // THE LEVER STAYS AS A PATTERN, READ-ONLY. Andy: "as design pattern
  // relay-internally, they still make sense to me." A gauge is described
  // once — label, floor, ceiling, value — and the owner's monitor draws it
  // generically, as metering. It has no setter (lever.js), so no governor
  // can grow back from it.
  //
  // Present only when the startup module handed this relay a
  // configuration (relayServer.js reads relay-state/config.json); a relay
  // built without one — every in-process suite — has no allowance.
  var config = deps.config || null;
  var atRestMB = 0;
  var allowance = config ? allowanceFor(config.ramLimitMB, atRestMB) : null;
  var gauges = null;
  function setAllowance() {
    gauges = allowance ? {
      connections1: lever.make('connections1', {
        floor: 1, ceiling: allowance, value: allowance, worseAt: 'floor',
      }),
    } : null;
    if (allowance) presentNow.setAllowed(allowance);
  }
  setAllowance();
  // The relay's own memory at rest, in MB, measured by relayServer at the end of boot (goal/G30.15); the allowance is
  // computed again from it once, and holds until the next start.
  function atRest(mb) {
    var n = Number(mb);
    if (!(n > 0)) return atRestMB;
    atRestMB = Math.round(n * 10) / 10;
    if (config) { allowance = allowanceFor(config.ramLimitMB, atRestMB); setAllowance(); }
    return atRestMB;
  }

  // ── THE SECOND BOUND: WHAT THE ROLL MAY OCCUPY (cycle 9) ───────────
  //
  // `ramLimitMB` says how many may be connected; `discLimitMB` says how
  // much disc this relay's state may take, and therefore how many members
  // it will ever hold. One object so the claim path, the status report
  // and the boot line all read the same arithmetic.
  //
  // MEASURED FROM THE FILE, NOT COUNTED IN ROWS. What an owner bounded is
  // disc, and `relayStore.bytes()` is the disc. A per-member estimate
  // would be a constant that drifts away from the schema silently.
  //
  // A relay built with no configuration — every in-process suite — has no
  // disc bound, the same way it has no allowance. `full()` is then always
  // false, so nothing in a suite is refused by a limit it never set.
  var discLimit = (function () {
    var limitMB = config && typeof config.discLimitMB === 'number' ? config.discLimitMB : null;
    var limitBytes = limitMB === null ? null : limitMB * 1024 * 1024;
    function used() {
      try { return store.bytes ? store.bytes() : 0; } catch (e) { return 0; }
    }
    return {
      limitMB: function () { return limitMB; },
      // Raised while running (goal/G30.15): more room applies at once.
      setLimitMB: function (mb) { limitMB = mb; limitBytes = mb * 1024 * 1024; },
      usedBytes: used,
      full: function () { return limitBytes !== null && used() >= limitBytes; },
    };
  }());

  // ── SEATS: A MEMBER IS ADMITTED ONLY IF THIS RELAY CAN SERVE THEM ──
  //
  //   Andy, 2026-09-23: "why admit a member when we cannot guarantee
  //   service for that member? that'd be horrible" — and, ruling what the
  //   bound is: "a relay could hold a few million CARDs on disk, members
  //   are strictly limited by RAM allotment."
  //
  // THE DISC BOUND ABOVE IS NOT THIS AND DOES NOT REPLACE IT. Disc says
  // how many rows may EXIST; this says how many people can be SERVED, and
  // serving is what membership is for. They were never in conflict — the
  // RAM half was simply absent, so a relay configured at 256 MB admitted
  // members up to its ~111,000-row disc ceiling while only 4,096 could
  // ever hold a stream. Member 4,097 got a row, got a card, and then a
  // 503 for ever. Nothing was mis-gated; the second gate did not exist.
  //
  // AND IT IS WORSE WITHOUT A QUEUE. A relay does not store traffic
  // (relay.js, `sendSelfAnswer`), so a member who cannot connect does not
  // collect messages to read later — they receive nothing at all. In a
  // queueing system over-admission is a delay; here it is an exclusion
  // dressed as a membership.
  //
  // AN OUTSTANDING INVITE HOLDS A SEAT. Minting past capacity is the same
  // broken promise made earlier and in writing: the owner hands somebody
  // a token that cannot be redeemed. So free seats are the allowance less
  // the members held AND the invites still live. Expired ones hold
  // nothing — they are already spent by the clock.
  //
  // NOBODY IS EVICTED, ever. Andy, design/principles/LIMITED-RESOURCES.md:
  // "it's like member slots, you must evict before adding new ones." Full
  // means no new claims and no new invites; it never means a row is
  // dropped.
  //
  // A RELAY WITH NO CONFIGURATION HAS NO ALLOWANCE and therefore no seat
  // bound — every in-process suite is in that state, and a gate that
  // refused there would refuse the whole harness rather than the thing it
  // is aimed at.
  var seats = (function () {
    function live(nowMs) {
      var at = nowMs == null ? Date.now() : nowMs;
      var rows;
      try { rows = invites.load(rootDir) || []; } catch (e) { return 0; }
      // EXPIRY IS THE ONLY TEST, because a redeemed invite is DELETED
      // rather than marked (invites.consume). There is no spent-but-
      // present state to filter out, and a filter on a field that never
      // exists would imply one.
      return rows.filter(function (row) {
        if (!row) return false;
        var ends = Date.parse(row.expiresAt || '');
        return !(ends > 0) || ends > at;
      }).length;
    }
    function held() {
      try { return store.members.count(); } catch (e) { return 0; }
    }
    // The members the allowance serves, three streams a seat (goal/G30.15).
    function members() { return allowance ? Math.floor(allowance / SEAT_STREAMS) : null; }
    return {
      allowance: function () { return allowance; },
      members: members,
      held: held,
      outstanding: live,
      // Seats left for somebody NOT yet holding one. Never negative: a
      // relay whose limit was lowered under it reports zero free rather
      // than a negative number that arithmetic elsewhere would carry.
      free: function (nowMs) {
        if (!allowance) return null;
        return Math.max(0, members() - held() - live(nowMs));
      },
      // Admission asks only about MEMBERS, not invites: a claim redeeming
      // an invite is taking the seat that invite was already holding, so
      // counting both would refuse the very token the relay issued.
      fullForMembers: function () {
        return allowance !== null && held() >= members();
      },
    };
  }());

  // ── RESIZING THE BOX, AND THE ONE THING IT WILL NOT DO (cycle 9) ───
  //
  //   Andy, 2026-09-22: "the owner must evict before shrinkage."
  //
  // A shrink that would leave existing members outside the new figure is
  // REFUSED — no confirmation field, no override
  // (design/principles/LIMITED-RESOURCES.md, which also forbids adding
  // one later). The answer names the gap; the owner removes members with
  // the verbs that exist for it
  // (`removePeer`, `revoke`) and asks again. Eviction is never a side
  // effect of a number changing: membership moves only by a signed grant
  // aimed at a person.
  //
  // The IO is injected. This decides — owner, ceiling, shrink — and
  // `relayServer.js` writes the file and restarts the process, because a
  // relay built in a suite has neither and must still be able to answer.
  function reconfigure(ask) {
    var measure = typeof deps.measure === 'function' ? deps.measure : null;
    var writeConfig = typeof deps.writeConfig === 'function' ? deps.writeConfig : null;
    var restart = typeof deps.restart === 'function' ? deps.restart : null;
    if (!config || !writeConfig) {
      return { ok: false, status: 501, error: 'this relay has no configuration file to write' };
    }

    var held = store.members.count();
    var usedBytes = 0;
    try { usedBytes = store.bytes(); } catch (e) { usedBytes = 0; }

    // ── ASKING WITHOUT TELLING: `{ config: {} }` READS (cycle 9) ─────
    //
    //   Andy, 2026-09-22: "so the API must be able to read the config,
    //   and so we can assess how to correct the somewhat unpredictable
    //   outcome of a tag-push, and then set the config to our liking."
    //
    // A relay that only accepted figures would make the owner guess what
    // he was changing FROM — and after an update the figures may not be
    // the ones he last typed: a fresh box writes what it measured, and a
    // boot on a busy box runs on a clamped figure while the file keeps
    // what was asked (relayConfig.asked).
    //
    // So an empty ask reads and writes nothing: what the file says, what
    // this process is actually running on, what the box could give, and
    // what is on the roll. Everything needed to choose the next figure.
    var reading = ask.ramLimitMB === undefined && ask.discLimitMB === undefined;
    // RESTART ALONE (goal/G30.15): a restart asked with no figures writes nothing. The screen's Restart once sent the
    // figures the relay booted with, and wrote them back over the owner's Save.
    if (reading && ask.restart) {
      var alone = restart ? restart() : { will: false, why: 'this relay cannot restart itself' };
      return { ok: true, status: 200, restarting: !!(alone && alone.will), restartRefused: alone && alone.will ? undefined : ((alone && alone.why) || 'no restarter') };
    }
    if (reading) {
      var box = measure ? measure() : null;
      var room = box ? relayLimits.ceilings(box) : {};
      // WHAT THE FILE SAYS, read from the file (goal/G30.15): what the relay booted with is `running`; a Save shows here
      // at once. deps.readConfig is the file as it stands; without one, what was asked at boot.
      var readConfig = typeof deps.readConfig === 'function' ? deps.readConfig : null;
      var fileNow = null;
      try { fileNow = readConfig ? readConfig() : null; } catch (e) { fileNow = null; }
      var onFile = fileNow && typeof fileNow.ramLimitMB === 'number' ? fileNow : relayConfig.asked(config);
      return {
        ok: true,
        status: 200,
        source: config.source,
        // WHAT THE FILE ASKS FOR, and what this process got. They differ
        // only when the box could not give what was written, and an
        // owner who cannot see both cannot tell a shrunken relay from a
        // misconfigured one.
        onFile: { ramLimitMB: onFile.ramLimitMB, discLimitMB: onFile.discLimitMB },
        running: {
          ramLimitMB: config.ramLimitMB,
          discLimitMB: config.discLimitMB,
          allowance: allowance,
          // goal/G30.15: the members that serves, three streams a seat, after the relay's own memory at rest.
          members: seats.members(),
          atRestMB: atRestMB,
          seatStreams: SEAT_STREAMS,
          streamsPerMB: STREAMS_PER_MB,
          clamped: !!config.overflow,
        },
        // ── THE MEASUREMENT ITSELF, NOT JUST ITS CONCLUSION ────────
        //
        //   Andy, 2026-09-22: "the read interface should also return the
        //   results from the current freeMemory() calls... and
        //   availableDisc() calls so we can predict the outcome of our
        //   set-calls better."
        //
        // TAKEN NOW, not at boot: this is what the box can give at the
        // moment the owner is deciding, which is the number his next
        // figure will be judged against. A ceiling alone would make him
        // guess how it was reached; with the raw figures and the margins
        // he can do the arithmetic himself and predict the answer before
        // he sends it.
        //
        //   ramMaxMB  = availableMB − ramMarginMB
        //   discMaxMB = discFreeMB  − discMarginMB
        room: {
          ramMaxMB: room.ramMaxMB,
          discMaxMB: room.discMaxMB,
          totalMB: box ? Math.floor(box.totalMB) : undefined,
          availableMB: box && box.availableMB !== undefined ? Math.floor(box.availableMB) : undefined,
          discTotalMB: box && box.discTotalMB !== undefined ? Math.floor(box.discTotalMB) : undefined,
          discFreeMB: box && box.discFreeMB !== undefined ? Math.floor(box.discFreeMB) : undefined,
          ramMarginMB: relayLimits.RAM_MARGIN_MB,
          discMarginMB: box && box.discFreeMB !== undefined
            ? Math.floor(Math.max(relayLimits.DISC_MARGIN_MB, box.discFreeMB * relayLimits.DISC_MARGIN_SHARE))
            : undefined,
          // WHAT THE DEFAULTS WOULD BE on this box today — half of it,
          // clamped — so "put it back to standard" needs no arithmetic
          // at all.
          wouldDefaultTo: box ? relayLimits.defaults(box) : undefined,
        },
        // AND WHAT IS ALREADY HERE, which is what a shrink is refused
        // against: the two numbers that decide whether the figure he has
        // in mind would strand anybody.
        roll: {
          members: held,
          discUsedMB: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
        },
      };
    }

    var wantRam = ask.ramLimitMB === undefined ? config.ramLimitMB : ask.ramLimitMB;
    var wantDisc = ask.discLimitMB === undefined ? config.discLimitMB : ask.discLimitMB;

    // The same validation the file gets at boot, against the same
    // measurement — one arithmetic, three doors (installer, first start,
    // here). A figure the box cannot give is refused now rather than
    // discovered as a relay that will not come back up.
    var checked = relayConfig.parse(
      JSON.stringify({ ramLimitMB: wantRam, discLimitMB: wantDisc }),
      measure ? measure() : null,
      { runningRamMB: config.ramLimitMB }
    );
    if (!checked.ok) return { ok: false, status: 400, error: checked.error };

    // STRANDED BY DISC: the roll already occupies more than the new
    // figure allows.
    if (usedBytes > checked.config.discLimitMB * 1024 * 1024) {
      return {
        ok: false,
        status: 409,
        error: 'that disc figure is smaller than the roll: ' + held + ' member(s) occupy ' +
          Math.round((usedBytes / (1024 * 1024)) * 100) / 100 + ' MB, and you asked for ' +
          checked.config.discLimitMB + ' MB. Remove members first — nobody is evicted by a number.',
      };
    }
    // STRANDED BY RAM: the new allowance serves fewer members (three
    // streams a seat, goal/G30.15) than are on the roll, so somebody could
    // not be served. Measured against this boot's at-rest memory.
    var after = allowanceFor(checked.config.ramLimitMB, atRestMB);
    var afterMembers = after === null ? null : Math.floor(after / SEAT_STREAMS);
    if (afterMembers !== null && held > afterMembers) {
      return {
        ok: false,
        status: 409,
        error: 'that RAM figure serves ' + afterMembers + ' member(s) at ' + SEAT_STREAMS + ' streams each, and this relay has ' + held +
          ' member(s), so ' + (held - afterMembers) + ' could not be served. Remove members first — ' +
          'nobody is evicted by a number.',
      };
    }

    var wrote = writeConfig(checked.config);
    if (!wrote) {
      return { ok: false, status: 500, error: 'could not write relay-state/config.json' };
    }

    // THE RELAY MOVES ITS OWN SERVICE CAP (goal/G40.4), to twice the limit just written, on every change of it. Andy,
    // 2026-10-24: "the relay raises its own service cap to exactly twice the amount of RAM it uses for itself." The call
    // is injected (relayServer.js, systemd); a relay with no service cap has none.
    var capMoved = null;
    if (checked.config.ramLimitMB !== config.ramLimitMB && typeof deps.setServiceCap === 'function') {
      try { capMoved = deps.setServiceCap(2 * checked.config.ramLimitMB); } catch (e) { capMoved = false; }
    }

    // RAISING APPLIES AT ONCE, LOWERING AT THE NEXT START (goal/G30.15; Andy: "enlarging the memory limit would NOT
    // require a restart, only reducing the memory limit would do that"). More room cuts nobody off, so a raised figure
    // is taken now: the allowance and the seats for memory, the bound for disc. A lowered one waits for the restart.
    var ramNow = checked.config.ramLimitMB >= config.ramLimitMB;
    var discNow = checked.config.discLimitMB >= config.discLimitMB;
    var nowBefore = { ramLimitMB: config.ramLimitMB, discLimitMB: config.discLimitMB, allowance: allowance };
    if (ramNow && checked.config.ramLimitMB !== config.ramLimitMB) {
      config.ramLimitMB = checked.config.ramLimitMB;
      allowance = allowanceFor(config.ramLimitMB, atRestMB);
      setAllowance();
    }
    if (discNow && checked.config.discLimitMB !== config.discLimitMB) {
      config.discLimitMB = checked.config.discLimitMB;
      discLimit.setLimitMB(config.discLimitMB);
    }
    var applies = ramNow && discNow ? 'now' : (!ramNow && !discNow ? 'next start' : 'memory ' + (ramNow ? 'now' : 'at the next start') + ', disc ' + (discNow ? 'now' : 'at the next start'));

    var answer = {
      ok: true,
      status: 200,
      applies: applies,
      ram: ramNow ? 'now' : 'next start',
      disc: discNow ? 'now' : 'next start',
      // The cap it moved to, false when the move failed; absent when the limit did not change or there is no cap.
      serviceCapMB: capMoved === null ? undefined : (capMoved ? 2 * checked.config.ramLimitMB : false),
      now: {
        ramLimitMB: nowBefore.ramLimitMB,
        discLimitMB: nowBefore.discLimitMB,
        allowance: nowBefore.allowance,
        members: held,
        discUsedMB: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
      },
      after: {
        ramLimitMB: checked.config.ramLimitMB,
        discLimitMB: checked.config.discLimitMB,
        allowance: after,
        members: afterMembers,
      },
    };

    // THE RESTART IS ASKED FOR, NOT ASSUMED. A written figure that only
    // applies when somebody happens to reboot is a configuration nobody
    // can trust; a relay that restarted itself on every edit would drop
    // every stream on the box to change a number. So the owner says.
    //
    // HONEST ABOUT THE RESTARTER. A relay under systemd comes back; one
    // started by hand does not, and saying "restarting" to an owner whose
    // box will simply stop is the worst answer available.
    if (ask.restart) {
      var plan = restart ? restart() : { will: false, why: 'this relay cannot restart itself' };
      answer.restarting = !!(plan && plan.will);
      if (!answer.restarting) answer.restartRefused = (plan && plan.why) || 'no restarter';
    }
    return answer;
  }

  // reloadOwner STOOD HERE. Its one caller was the owner writer, which wrote the
  // owner from a claim; that went with goal/G16.8, and the owner is now
  // read once, at createRelay, from the file the install wrote.

  function ownerLabel() {
    return ownerKey ? labelOf(findByKey(ownerKey)) : '';
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
  // have. The rule itself is fieldRules.js — see the note at the head of
  // this file about why it left.
  function normalizeName(name) { return fieldRules.normalize(name); }
  function labelProblem(n) { return fieldRules.problem(n); }
  function spokenOk(n) { return fieldRules.spokenOk(n); }

  // A PEER IS ITS KEY. A `|| peer.name` fallback stood here for rows
  // filed under a label, and went with them — every row has a key now,
  // so an id that was ever a name could only belong to a row predating
  // the rule, which cannot be addressed anyway.
  function peerId(peer) {
    return (peer && peer.publicKey) || '';
  }

  // ONE FIELD. It read `publicLabel || name` while a row carried both,
  // which is what this function existed for. The one-time import (D8)
  // collapsed the pair, so there is nothing left to reconcile and this is
  // only a guard against a missing row.
  function labelOf(peer) {
    return (peer && peer.publicLabel) || '';
  }

  // listPeers() STOOD HERE — the whole roll as an array, allocated on
  // every call, by seven callers. It is gone with the resident roll (cycle
  // 3): each caller asks the store the one question it has.

  // ONE READ, SUCCESS OR FAIL (cycle 3). The primary key, so an unknown
  // sender costs one index seek however large the roll — it used to cost a
  // scan of the whole membership, before the rate gate, for anybody who
  // cared to send junk (NODE-AND-RELAY §9b).
  function findByKey(publicKey) {
    if (!publicKey) return null;
    return activeRows[publicKey] || store.members.get(publicKey);
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
    // SEARCH AND DISPLAY ONLY (cycle 3): nothing resolves an identity by
    // label any more — every operation is by key. The index answers the
    // first two holders, which is all "exactly one" needs to know.
    var hits = store.members.byLabel(normalizeName(label), 2);
    return hits.length === 1 ? hits[0] : null;
  }

  // resolveParty STOOD HERE — token to party, with an `ambiguous` answer
  // for the two-johns case. Its only callers were `send` and `inbox`, and
  // it went with them (R8).
  //
  // The router never needed it. `senderIdentity` resolves a row by KEY,
  // which is what an address is on this wire, so the ambiguity a LABEL
  // creates cannot arise: two johns are two keys and always were. The
  // ring is what made labels addressable, and that is the half of the
  // old transport that is not worth rebuilding.

  // who(keys) STOOD HERE: the roll, narrowed to the keys somebody named,
  // left behind when its public route went on 2026-09-18. Nothing in the
  // product called it after that, only two suites, so it was deleted
  // (goal/G19.11). A suite that wants the roll reads it off the disc
  // (test/rollOf.js); store.members.byKeys is what it read.

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

  // ── AND THE KEY POSTS TO IT ARE SEALED TO (cycle 10, R9) ────────────
  //
  //   Andy: "relay needs a cypher key too, because it has answerSelf()."
  //
  // A relay is a peer with a key, so the rule gets no exception: every
  // peer post is sealed, including the owner verbs addressed to the box
  // itself, and it opens them with this key to act on them.
  //
  // Sealing to the relay hides nothing FROM the relay — it must read a
  // verb to obey it. What it hides is everything BETWEEN: TLS ends at
  // Caddy on this host, so an invite token — a credential, spoken down a
  // phone — is plaintext in that process and in anything it writes.
  function relaySealKey() {
    var id = auth.loadIdentity(rootDir);
    return (id && id.sealPublicKey) || null;
  }

  // The statement a node pins, signed by the identity key it names. A key
  // handed over unsigned is a key whoever handed it over chose — and this
  // answer is now the one that says what to seal to.
  function relayKeyStatement() {
    var id = auth.loadIdentity(rootDir);
    if (!id || !id.privateKey || !id.sealPublicKey) return null;
    var label = relayLabel();
    return auth.sign(id.privateKey, auth.relayKeyMessage(id.publicKey, id.sealPublicKey, label));
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
// globMatches AND matchRank MOVED to js/peerSearch.js, 2026-09-16; the ranking is js/peerRank.js since goal/G29.17.
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

  // ── WHO RUNS THIS BOX ────────────────────────────────────────────
  //
  // Two fields, both public: the owner's key and label, from allow.json —
  // the one place ownership lives. They were once also on every roll row
  // as `owner: true`; the roll went, and on 2026-09-19 so did the mark on
  // the row ("a row in the roll doesn't know who the owner is"). This is
  // how they are ASKED FOR, without asking for any membership.
  //
  // Part of the relay's card: what a card ask is answered with (goal/G22.6).
  //
  // Empty on a relay nobody owns, which is a real answer: that box has no
  // owner yet.
  function ownerPublic() {
    return { ownerKey: ownerKey || '', ownerLabel: ownerLabel() };
  }

  // ── THE PARTNER ROLL STOOD HERE (setPartner, clearPartner, partners, the
  // partner identity at the door and the partner liveness bench). Removed
  // by Andy's decision (goal/G22.6, 2026-10-13): "Partnering as a permission
  // goes ... a relay carries posts to its members from any relay ... the
  // partner roll and the partner budget are removed". A relay.db that still
  // holds a partners table opens as before; nothing reads it.


  // Owner-only, and enforced by the caller: this is reached from
  // answerSelf's `owner` branch, which has already verified the post
  // against the row marked owner in allow.json.
  //
  // THE SAME RULE AS ANY OTHER PUBLIC LABEL (js/fieldRules.js). A relay's
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
      owner: ownerLabel() || null,
      mode: ownerKey ? 'keys' : 'unclaimed',
      // `reserved: auth.RESERVED_NAME` STOOD HERE, justified as a fact a
      // browser building a claim form needed. No browser ever read it —
      // hub forwarded it to the page as `reservedName` and nothing on the
      // other side looked. Gone with the reservation itself.
      relayPublicKey: relayPublicKey(),
      // The other half of the pair (Andy: "key and label are a pair, in
      // keyed mode").
      relayLabel: relayLabel(),
      // A COUNT, not the roll (cycle 3): the report says how many, which
      // is one query; the rows never leave the store to be counted.
      peers: store.members.count(),

      // ── THE SEAT COUNT, SO A FULL RELAY IS SEEN COMING ─────────────
      //
      //   Andy, 2026-09-23: "that's why our alpha shape needs to monitor
      //   member count so, that RAM capacity can guarantee service."
      //
      // The refusal at the boundary is the guarantee; THIS is what stops
      // the guarantee arriving as a surprise. An owner who can only learn
      // the relay is full by watching somebody fail to join has no lever
      // left — every tightening measure worth using (shorten expiry, stop
      // minting, raise the limit, get a bigger box) needs warning.
      //
      // ALL THREE NUMBERS, because two of them cannot be derived from the
      // others. `held` is the roll, `outstanding` is seats already
      // promised in unredeemed invites, and `seats` is what the RAM
      // allotment permits. Publishing only "3,900 of 4,096" would hide
      // that 200 invites are out and the relay is actually full.
      //
      // ABSENT, not zeroed, on a relay with no configuration — the same
      // rule the rest of this report follows: "no bound" and "a bound
      // with room left" must not be drawn the same.
      seats: seats.allowance() === null ? undefined : {
        held: seats.held(),
        outstanding: seats.outstanding(),
        allowance: seats.allowance(),
        // The seats themselves, three streams each (goal/G30.15); allowance stays the streams.
        members: seats.members(),
        free: seats.free(),
      },
      // `messages: messages.length` STOOD HERE and went with the ring.
      // A relay stores nothing on anyone's behalf (0006), so there is no
      // count to report — the honest number is not zero, it is that the
      // question no longer applies. relayStatus.js and natterDetails
      // read the absence rather than a 0.
    };
  }

  // THE RELAY'S OWNER WRITER STOOD HERE: relay-state/owner.json written on
  // the strength of a claim. goal/G16.8 removed it, and nothing in the
  // relay writes the owner file any more — bash/install-units does, before
  // the relay ever serves. Andy, 2026-10-10: "the relays should do
  // first-claim, it should happen at install time. that's the only \"safe\"
  // way." and 2026-10-11: "the invite path to ownership MUST be gone. it is
  // a security gap, from the time of install until the time of first
  // claim."

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
  // peer's permanent name — and since the public roll of the day published
  // it unsigned, it published whatever the owner used to identify the
  // invitee. An invite labelled with a phone number put that number in a
  // public roll.
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
  // A card is kept only if it is THEIRS. Self-signed, so one lifted from
  // anybody else verifies as that person and is discarded here rather
  // than filed under the wrong key (cycle 10, R5).
  function cardFor(publicKey, cardText) {
    if (!cardText) return '';
    var card = nodeCard.verify(cardText);
    return (card && card.publicKey === publicKey) ? String(cardText) : '';
  }

  function seatsFull() {
    return {
      ok: false,
      status: 507,
      error: 'this relay is full: ' + seats.held() + ' of ' + seats.members() +
        ' members, which is what ' + (config && config.ramLimitMB) +
        ' MB of RAM can serve at once, three streams each. Its owner must raise ramLimitMB or remove members.',
    };
  }

  function discFull() {
    return {
      ok: false,
      status: 507,
      error: 'this relay is full: its state is at the configured disc limit of ' +
        discLimit.limitMB() + ' MB. Its owner must raise discLimitMB or remove members.',
    };
  }

  function claimAttempt(name, sig, publicKey, clientKey, inviteToken, inviteLabel, seen, claimedCard, joined) {
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
    // ── FULL FIRST, THEN PROVEN, THEN COUNTED (goal/G16.2, S13 of the
    // review of 2026-10-10) ──────────────────────────────────────────────
    //
    // The bound on how many claimers there can be is the relay's member
    // capacity. Andy: "by design there can be no claimer if the capacity for
    // members is exhausted. a member then must be ejected, before a new
    // claim can be satisfied." So a full relay refuses before anything else.
    //
    // STRANGERS ARE COUNTED BY ADDRESS, AT THE DOOR (goal/G22.6), never
    // per key here: a key is free, so counting per key would not slow
    // anybody. The owner is never turned away, as below.
    //
    // ── AN UNOWNED RELAY TAKES NO CLAIM AT ALL (goal/G16.8) ─────────────
    //
    // A relay gets its owner at install time and in no other way: the
    // install writes relay-state/owner.json from the OWNER_KEY it is given
    // (bash/install-units). There is no claim, token or invite that makes an
    // owner over the wire. Andy: "the invite path to ownership MUST be gone.
    // it is a security gap, from the time of install until the time of first
    // claim." So a relay with no owner file refuses every claim, with
    // members or without; the recovery is SSH, never the wire. Do not add a
    // way in here.
    if (!ownerKey) {
      return { ok: false, status: 503, error: store.members.count() > 0
        ? 'relay has members but no owner — restore owner.json over SSH'
        : 'relay has no owner — the owner is written at install, not claimed' };
    }
    // THE OWNER, named in the owner file, claims his own box without an
    // invite and is never turned away by a full relay: the one account that
    // can raise the limit must always be able to get on. The key is only
    // what the claim says here; the signature just below proves it.
    var ownerClaim = publicKey === ownerKey;
    if (!ownerClaim && seats.fullForMembers()) return seatsFull();
    if (!ownerClaim && discLimit.full()) return discFull();
    // A JOIN (goal/G30.2) comes with no claim signature: the key signed the post on the door, and the mailed code
    // came back under that same key, which together are its proof. Everything else below holds for it as for a claim.
    if (!publicKey || (!sig && !joined)) {
      return { ok: false, status: 400, error: 'claim needs publicKey and sig' };
    }
    if (!joined && !auth.verify(publicKey, auth.claimMessage(asSent), sig)) {
      return { ok: false, status: 403, error: 'bad claim signature' };
    }
    // THE PER-ADDRESS CLAIM LIMIT (ten a minute) STOOD HERE. Andy's
    // decision (goal/G22.6): the strangers' address table at the door
    // "replaces the per-address claim limit". `clientKey` is no longer read.
    //
    // PAST THE GATE, and this line is what bounds the owner's stream. A
    // claim arrives on the one door from anybody, so an event fired before
    // the signature would let a stranger drive the owner's notifications.
    // After here the claim is proven, and a stranger reached it through the
    // address table, which caps the notices too. No second mechanism.
    seen.gate = true;

    // ── THE OWNER-INVITE BRANCH STOOD HERE (cycle 3, Part B) ────────────
    //
    // An unclaimed relay used to take one claim, the one presenting a token
    // install.js minted, and that claim became the owner. goal/G16.8
    // removed the branch, that kind of invite and install.js together: an
    // unowned relay is refused at the gate above, so every claim that gets
    // here is on a relay that already has its owner.
    //
    // This is the lock 0003 promised: a new key gets on the box only with
    // a live invite the owner minted for that exact label. The owner
    // himself needs none — he was named at install (goal/G16.8).
    //
    // Two johns is still two keys; it is now also two invites. The
    // label is not what is scarce, the token is.
    //
    // REDEEMED ON `onInvite`, WRITTEN AS `n`. The invite's label is
    // proof — the second factor on a token that may be a spoken word —
    // and the claimer's own `n` is what the row and the roll get.
    // They were the same string until 2026-09-15; see the note on this
    // function for why that published the owner's word for somebody.
    //
    // A key already in owner.json is not a NEW key — it is the owner,
    // and the owner is never someone the box has to be invited into.
    // Since goal/G16.8 this is how EVERY owner first gets on his box:
    // the install named him, and no invite exists that could. It also
    // keeps a relay whose owner.json outlived its roll (a restore, a lost
    // peer record) from locking its own owner out.
    // A JOIN NEEDS NO INVITE (goal/G30.2): the email loop stands in for it.
    if (!ownerClaim && !joined) {
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
    // AN `else` STOOD HERE for `open` mode (auth.checkClaim). There is one
    // state now — owned — and it is handled above.

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
    // The owner's seat made at boot (goal/G30.7) is his to claim: the claim fills it with his name and card.
    var held = findByKey(publicKey);
    if (held && !(ownerClaim && held.publicLabel === 'owner' && !held.card)) {
      return { ok: false, status: 409, error: 'key already claimed', peer: held };
    }

    // ── THE DISC BOUND BITES HERE (cycle 9) ──────────────────────────
    //
    //   Andy, 2026-09-22: "disc bound must be in place for completeness."
    //
    // RAM bounds how many members may be CONNECTED at once (allowanceFor);
    // this bounds how many there may BE. A relay writes no traffic and no
    // payloads, so the only thing that grows with use is the roll — and
    // the roll is what the owner's disc figure is about.
    //
    // REFUSED BEFORE THE INVITE BURNS, like every other refusal above: a
    // token spent on a claim the box cannot honour would be a seat lost
    // to nobody.
    //
    // THE OWNER IS NEVER TURNED AWAY. The owner's claim goes through
    // whatever the figure says — a relay that locked out the one account
    // that could raise its own limit would need SSH to undo a number.
    //
    // NOBODY IS EVICTED. Full means no new claims; it never means a row
    // is dropped — design/principles/LIMITED-RESOURCES.md, Andy: "it's
    // like member slots, you must evict before adding new ones."
    // ── AND THE RAM BOUND BITES HERE TOO (cycle 9, amended) ──────────
    //
    //   Andy, 2026-09-23: "why admit a member when we cannot guarantee
    //   service for that member? that'd be horrible"
    //
    // FIRST, because it is the bound that decides whether this person can
    // ever be SERVED. The disc refusal below is about the box filling up;
    // this one is about the promise. An owner told "your disc is full"
    // when the real answer is "you have as many members as you can talk
    // to" would raise the wrong figure and change nothing.
    //
    // THE OWNER IS NEVER TURNED AWAY, for the same reason as below: the
    // one account that can raise the limit must always be able to get on.
    // Both refusals moved to the gate (goal/G16.2): a full relay has no
    // claimers, so it says so before a claim is proven or counted.
    if (!ownerClaim && seats.fullForMembers()) return seatsFull();
    if (!ownerClaim && discLimit.full()) return discFull();

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
    // THE OWNER WAS WRITTEN HERE, from a burned token, until goal/G16.8:
    // the owner is written at install, never by a claim.

    var peer = {
      // ONE LABEL. `name` stood here carrying the same string, and went
      // on 2026-09-15 — see loadRoutingTable for the migration and
      // relayStore.js for what a member row holds now.
      publicLabel: n,
      publicKey: publicKey,
      // THE ENROLMENT LEDGER'S ONE DATE. Written once, never rewritten:
      // it says when this KEY joined, which stays true whatever the
      // label does later.
      claimedAt: new Date().toISOString(),
      // AN OWNER MARK STOOD HERE. A row does not know who owns the
      // relay (relayStore.js, 2026-09-19): owner.json, written at install,
      // names the one key that does. The claim's ANSWER still says so.
      //
      // ── AND THE CARD THEY ENROLLED WITH (cycle 10, R5 and R13) ────
      //
      //   Andy: "so the relay is the keeper of cards, in the database,
      //   on disc. got it."
      //
      // It is what the relay seals its answers to this member with
      // (memberSealKey). VERIFIED HERE, against
      // the key that just signed the claim: a card is self-signed, so one
      // belonging to anybody else verifies as that person and fails this
      // check. Nothing else about the claim needs to change — the claim
      // signature does not cover the card, and does not need to, because
      // the card covers itself.
      //
      // A claim carrying no card is taken, and the member simply has no
      // cipher key here until they send one. That is the flag day, not a
      // fallback: what it costs them is an answer they cannot be sent,
      // with a reason, rather than an answer sent in the clear.
      card: cardFor(publicKey, claimedCard),
    };
    // KEYED BY KEY, always, because a claim without one is refused
    // above. The map used to be `publicKey || n`, which is how a row
    // could be filed under a label.
    store.members.put(peer);
    return { ok: true, status: 201, peer: peer, owner: ownerClaim };
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
  // ── A DISC THAT WILL NOT TAKE A WRITE MUST NOT KILL THE RELAY ──────
  //
  //   Andy, 2026-09-22, reading the cycle record: "does the harness test
  //   disc overflow?"
  //
  // It tested a relay over its CONFIGURED figure and not a disc that has
  // actually run out. Measured the same hour: `node:sqlite` throws
  // "attempt to write a readonly database" straight out of `mint`, and
  // the claim route calls into here inside a `.then()`, where a throw is
  // an unhandled rejection — which on this Node takes the PROCESS down.
  // So a full disc did not refuse a member, it ended the relay, and
  // every connected member with it.
  //
  // WRITES REFUSE; READS AND ROUTING CARRY ON. A relay that cannot write
  // can still forward posts, answer searches and hold streams — none of
  // that touches the store — so the box stays useful while its owner is
  // told what is wrong, in a sentence naming the disc.
  //
  // NARROW ON PURPOSE. Only the failures a full or read-only disc
  // actually produces are converted; anything else is re-thrown, because
  // a bug that becomes a polite refusal is a bug nobody ever finds.
  //
  // WHICH FAILURES THOSE ARE IS THE STORE'S TO SAY (relayStore
  // isDiscFailure), and it reads SQLite's error CODE rather than its
  // English — the first version of this guard matched on the message and
  // missed a real full disc, whose sentence is "database or disk is
  // full". Found by wsl-claude on a 1 MB tmpfs.
  function guardWrite(what, fn) {
    try {
      return fn();
    } catch (e) {
      var said = String((e && e.message) || e);
      if (relayStore.isDiscFailure(e)) {
        try { console.error('relay: cannot write its own state (' + what + '): ' + said); } catch (e2) { /* nowhere to say it */ }
        return {
          ok: false,
          status: 507,
          error: 'this relay cannot write its own state — its disc may be full or read-only. ' +
            'It is still forwarding, but it can take nobody new until its owner frees space.',
        };
      }
      throw e;
    }
  }

  function claim(name, sig, publicKey, clientKey, inviteToken, inviteLabel, card, joined) {
    var seen = { gate: false, label: '', invite: '' };
    var out = guardWrite('claim', function () {
      return claimAttempt(name, sig, publicKey, clientKey, inviteToken, inviteLabel, seen, card, joined === true);
    });
    if (seen.gate) {
      ownerEvent(out && out.ok ? 'claim' : 'claim-refused', {
        label: seen.label,
        invite: seen.invite,
        key: (out && out.ok && out.peer && out.peer.publicKey) || publicKey || '',
        owner: !!(out && out.ok && out.owner),
        why: (out && out.ok) ? '' : String((out && out.error) || ''),
      });
    }
    // A MEMBER IS ADDED — BROADCAST IT (0012, 2026-09-18; built in R28).
    if (out && out.ok && out.peer && out.peer.publicKey) {
      // ALREADY CONNECTED, THEN ACTIVE NOW. The owner holds a stream before
      // he holds a row (senderIdentity resolves him by owner.json), and since
      // goal/G22.6 his claim arrives on the one door while that stream is
      // open: his row joins the active members here, or a search over the
      // connected (walkRoll) would not find him until he reconnected.
      if (presentNow.isPresent(out.peer.publicKey)) rememberActive(out.peer.publicKey);
      announceMember(out.peer.publicKey, seen.label || out.peer.publicLabel || '');
    }
    return out;
  }

  // ── EVERY MEMBER HEARS WHAT IS NEW, AND HEARS ALL OF IT (R28, 0019) ────
  //
  //   Andy: "we ride route with the full row." — "They may not know yet
  //   that that member even exists. … we don't throw info away (on the node
  //   side) just because we don't know what it's good for yet. And: what
  //   use is a special message: name updated, when the nodes shadow roll
  //   has no route yet." — and: "if a sent a note, i may as well put a
  //   hundred-dollar-bill in the enveloppe, too"
  //
  // So a rename or a claim goes out on the `route` event every node already
  // merges (server.js, onRoute): the member's key, their label, THIS relay's
  // key as the place they are reached, whether they are connected right
  // now, and when. A node that never heard of them learns all of it at
  // once; one that did merges what is new, and the rest costs nothing.
  //
  // Grok's review asked for a new event instead, fearing a route would read
  // as a reconnect; Andy ruled route, and onRoute only merges (2026-09-22).
  //
  // Every member's stream but the member themself (0019). Only members hold
  // a stream here.
  function announceMember(key, label) {
    var k = String(key || '').trim();
    if (!k) return 0;
    var row = { key: k, at: mineKey(), label: String(label || ''), seen: new Date().toISOString() };
    // Present only when it is true. A claim lands before its stream opens,
    // and a relay that said "present" of somebody it cannot see would be
    // the one lie this design cannot afford.
    if (presentNow.isPresent(k)) row.present = true;
    return presentNow.broadcast('route', row, function (id) {
      return id !== k;
    });
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
    if (!ownerKey) {
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
    if (!owner) {
      return { ok: false, status: 403, error: 'not the owner' };
    }

    // ── A SEAT IS RESERVED WHEN THE INVITE IS MINTED, NOT WHEN IT IS
    //    CLAIMED ──────────────────────────────────────────────────────
    //
    // Minting past capacity is the same broken promise as admitting past
    // it, made earlier and in writing: the owner hands somebody a token,
    // that person installs a node, types it in, and is refused by a relay
    // that was already full when the token was written.
    //
    // MEASURED BEFORE THIS EXISTED: mint had no capacity check of any
    // kind. An owner could mint a thousand invites on a relay with three
    // free seats and every one of them read as valid.
    //
    // COUNTED AT MINT TIME, NEVER CACHED. A relay restarted with a lower
    // ramLimitMB would otherwise keep minting against the figure it had
    // when it came up. `seats.free()` reads the roll and the live invites
    // each time it is asked, which costs a count and a file read on an
    // owner verb that runs rarely.
    //
    // AN EXPIRED INVITE RETURNS ITS SEAT, which is why unclaimed invites
    // are not a permanent tax on a relay's capacity, and why shortening
    // expiry is one of the listed tightening levers rather than a new
    // mechanism.
    var room = seats.free();
    if (room !== null && room <= 0) {
      return {
        ok: false,
        status: 507,
        error: 'this relay is full: ' + seats.held() + ' members and ' +
          seats.outstanding() + ' invites outstanding, against ' + seats.members() +
          ' seats. Minting now would promise a seat that does not exist — ' +
          'raise ramLimitMB, remove members, or let invites expire.',
      };
    }
    // THE WRITE, and the one place in this function that can meet a full
    // disc (guardWrite). A refusal comes back as an answer, not as a
    // throw through the route that called it.
    var written = guardWrite('mint', function () {
      return invites.add(rootDir, {
        label: lbl,
        days: days,
        token: tok,
        invitedBy: owner,
      });
    });
    if (written && written.ok === false) return written;
    var row = written;
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
  // It existed for one caller, the owner badge, which now asks by KEY and
  // signs nothing: the relay's card (the answer to a card ask, goal/G22.6)
  // names the owner's key, and the node compares it with its own
  // (ownerBadge.probe).
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

  // WHO A TOKEN IS: the owner, or a member with a row. The general identity
  // lookup every route uses; the name is older than the device enrolment
  // that goal/G16.2 removed, and has nothing to do with it any more.
  function senderIdentity(token) {
    var t = String(token == null ? '' : token).trim();

    // A TOKEN IS A KEY (cycle 3). This resolved the owner by label too, and
    // then fell back to findByLabel for everybody — residue from before
    // identity was a key, and the label scan in the unknown-sender flood
    // (NODE-AND-RELAY §9b). Every operation is by key now; labels serve
    // search and display only (Andy). One read, success or fail.
    if (ownerKey && t === ownerKey) {
      return { id: ownerKey, label: ownerLabel(), publicKey: ownerKey, owner: true };
    }
    if (!t) return null;

    var peer = findByKey(t);
    if (!peer || !peer.publicKey) return null;
    return {
      id: peer.publicKey,
      label: labelOf(peer),
      publicKey: peer.publicKey,
      owner: false,
      peer: peer,
    };
  }

  // AN OMITTED TOKEN IS NOBODY: it refuses, like any other token that
  // resolves to no row.
  function senderIdentityOr(token) {
    return senderIdentity(token);
  }

  // deviceOffer, and the relay's own post() that carried it, were removed
  // by goal/G16.2 with the device enrolment they served.

  // A POST HELD OPEN FOR ITS ANSWER (R13; goal/G22.6). By hash: what waits
  // at this end is a connection, not a socket. A stranger holds no stream
  // here, so its card ask, its claim and its post to a member are answered
  // on the post itself; and the card ask and the claim are answered that way
  // for everybody, so learning a relay's key or claiming a seat never needs
  // a stream. Settles with the reply packet a stream would have carried —
  // {hash, from, text, sig} — or, when the time this relay granted runs out,
  // with the refusal the asker would otherwise have learnt from its own
  // timer.
  var heldOnPost = Object.create(null);

  function holdOnPost(hash, grantedMs) {
    return new Promise(function (resolve) {
      var slot = { resolve: resolve, timer: null };
      heldOnPost[hash] = slot;
      var wait = typeof grantedMs === 'number' && grantedMs > 0 ? grantedMs : routerTable.DEFAULT_TTL_MS;
      slot.timer = setTimeout(function () {
        if (heldOnPost[hash] !== slot) return;
        delete heldOnPost[hash];
        resolve({ ok: false, status: 504, hash: hash, error: 'no answer yet' });
      }, wait);
      if (slot.timer && typeof slot.timer.unref === 'function') slot.timer.unref();
    });
  }

  function settleOnPost(hash, packet) {
    var slot = heldOnPost[hash];
    if (!slot) return false;
    delete heldOnPost[hash];
    if (slot.timer) clearTimeout(slot.timer);
    slot.resolve(Object.assign({ ok: true, status: 200 }, packet));
    return true;
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
  // rather than picking, and every roll row carries `claimedAt` and a
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

    var was = labelOf(row);
    store.members.put({
      publicKey: row.publicKey, publicLabel: next, claimedAt: row.claimedAt,
    });
    refreshActive(row.publicKey);

    // THE OWNER HEARS ABOUT IT (R2). A member changing what they are
    // called is a membership fact, and an owner watching a name appear
    // in the roll with no record of how it got there is exactly the
    // gap that category exists to close.
    ownerEvent('peer-renamed', { key: who.publicKey, was: was, label: next, cause: cause });
    // AND EVERY MEMBER HEARS IT (R28), whole — see announceMember.
    announceMember(who.publicKey, next);

    return { ok: true, status: 200, label: next, was: was };
  }

  // A MEMBER APPLIES FOR A FACE NAME AND AN EMAIL (goal/G30.1). Andy, 2026-10-19: "the node, already connected as
  // member on a relay, applies to the relay for a DNS-segment-name, with a call that includes the asked-for
  // face-name and an email, this is a normal peerPost to the relay itself, and it succeeds or not." Like rename,
  // an own-row verb with no owner path: the name belongs to the key that asked. It succeeds with the pair, which
  // routeReply signs with the rest of the answer ("the success-reply is a confirmation of the face-email pair"),
  // or it is refused: 400 for a name that is not one DNS label (faceRoute.faceLabel, the rule the Host parser
  // uses) or a member with no verified email, 409 for a name another member holds. The name is lowercased, so
  // andy and Andy are one. Asking again replaces the pair. The name is freed when the member leaves, because it is a column of the member's row (forgetPeer).
  //
  // THE EMAIL IS THE ONE ON FILE (goal/G30.1, box v30; Andy, 2026-10-20: "the relay already knows, which email
  // address is verified for the calling id", and "the email must be dropped from the verb relay.face"). The pair is
  // the face name and the verified email a confirmed join wrote on this member's row; an email sent along is not
  // read. A member with none is refused until a join confirms one.
  function faceSelf(who, wanted) {
    if (!who || !who.publicKey) return { ok: false, status: 403, error: 'no such peer' };
    var name = faceRoute.faceLabel(wanted);
    if (!name) return { ok: false, status: 400, error: 'a face name is one label of letters, digits and hyphens' };
    var mine = store.members.get(who.publicKey);
    if (!mine) return { ok: false, status: 404, error: 'no such peer' };
    var email = mine.emailVerified ? mine.email : '';
    if (!email) return { ok: false, status: 400, error: 'no verified email on file for this member: add an email address in Natter first' };
    var holder = store.members.byFace(name);
    if (holder && holder.publicKey !== who.publicKey) return { ok: false, status: 409, error: 'that face name is held by another member' };
    var wrote = guardWrite('face name', function () { return store.members.setFace(who.publicKey, name, email); });
    if (wrote && wrote.ok === false) return wrote;
    if (!wrote) return { ok: false, status: 409, error: 'that face name is held by another member' };
    refreshActive(who.publicKey);
    return { ok: true, status: 200, name: name, email: email };
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
    store.members.remove(key);

    // A RING PURGE STOOD HERE — "their mail goes with them", because a
    // forget that leaves the letters behind is not forgetting. The
    // argument was right and is now answered by there being no letters:
    // a relay holds nothing on anyone's behalf, so removing the row IS
    // removing everything this box had of them.

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
    forgetActive(key);

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
  // It did, and there was no protocol reason. The key is published to
  // anybody who asks — a card ask on the one door since goal/G22.6 — since
  // a node needs it to pin this box and to post THROUGH it, so the old
  // refusal hid nothing. What it was really
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
  //   OWN-ROW VERBS    removing YOURSELF
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
  // ── THE PARTNER FORWARD AND THE CARRY ONWARD STOOD HERE ───────────────
  //
  // forwardToMine (a partner's `forward` verb, delivered to a member here),
  // carryToPartner (a member's post wrapped and carried to a partner named
  // by the sender's route hints), announceRoute, relayErrorToAsker and
  // deliverForwardedReply. All of it rested on the partner roll — the only
  // place a relay key had an address — and the roll is gone by Andy's
  // decision (goal/G22.6, 2026-10-13): "Partnering as a permission goes ...
  // a relay carries posts to its members from any relay". A post for one of
  // this relay's members now arrives from its sender directly, on the one
  // door, whoever the sender is (routePost); a relay carries nothing onward.

  // ── THE RELAY'S OWN WORD FOR A ROUTE IT CLOSED ─────────────────────────
  //
  // NO NEW WORD ON THE WIRE. It goes as an ordinary `reply` for the same
  // hash — but signed by THIS RELAY, `from` its own key, never the
  // target's. A relay cannot manufacture the target's receipt and does not
  // try: the asker's node sees a reply signed by somebody other than the
  // target and knows it is the relay speaking (peerPost.onReply marks it
  // `relayed`). Registered in 0010. Used by the stalled-reader cut (R35):
  // this relay knows the answer will not come, and says so for the hash
  // the asker is holding.
  function replyAsRelay(innerHash, requester, status, error) {
    var mine = auth.loadIdentity(rootDir);
    if (!mine || !mine.privateKey) return false;
    var errorText = JSON.stringify({ v: 1, body: { ok: false, status: status, error: String(error), relayed: true } });
    return !!presentNow.send(requester, 'reply', {
      hash: innerHash,
      from: mine.publicKey,
      text: errorText,
      // The receipt covers the text it carries (S1, goal/G16.1), so even the
      // relay's own error cannot be swapped for another on the way.
      sig: auth.sign(mine.privateKey, auth.receiptMessage(innerHash, errorText)),
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
  // `peerRank.SLOTS` (peerSearch.SLOTS until goal/G29.17) is a RANKING device -- how many candidates are worth
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
  // PLAINTEXT_MAX, not PAYLOAD_MAX: this budget sizes a reply the relay
  // is about to COMPOSE, and `sendSelfAnswer` seals it afterwards. Against
  // the wire figure it would build a 22 KB reply, seal it to ~29 KB, and
  // have the wire refuse a packet this relay wrote itself (cycle 10's R6).
  var MATCH_BUDGET = limits.PLAINTEXT_MAX - 512;

  // Every owner verb that writes — minting, renaming, forgetting,
  // partnering, reconfiguring — goes through here, so the disc guard sits
  // on the outside once rather than on each of them. A relay whose disc
  // is full still answers its owner, and the answer says why.
  // ── A POST TO THE RELAY IS SEALED TOO (cycle 10, R5 and R9) ─────────
  //
  //   Andy: "relay needs a cypher key too, because it has answerSelf()."
  //
  // Opened here, at the one door every verb addressed to this box comes
  // through, so no verb can be added later that forgot to.
  //
  // SEALING TO THE RELAY HIDES NOTHING FROM THE RELAY — it must read a
  // verb to obey it. What it hides is everything BETWEEN: TLS ends at
  // Caddy on this host, so an invite token — a credential somebody reads
  // down a phone — is plaintext in that process and in whatever it logs.
  // Sealed, Caddy carries bytes it cannot read.
  //
  // AND IT REMOVES THE CARVE-OUT, which is worth as much: "everything is
  // sealed except the card" is a rule you can enforce by counting, while
  // "everything except the card and posts to the relay" needs a judgement
  // about every destination.
  // The partner wrapper's plaintext exception (fromPartnerBox) STOOD HERE:
  // with partnering gone (goal/G22.6) nothing addressed to this box travels
  // plain but the card ask.

  // OPENED ONCE, IN routePost (goal/G16.2). The question is opened there so
  // the one-verb rule below can refuse it before a route is opened, and the
  // opened text is handed here rather than opened a second time. `asked` is
  // { plain } or { refusal }; a refusal still leaves as an answer, as it
  // always did. A stranger's sealed claim opens the same way: sealed by the
  // key that signed the post, to this relay's key.
  function openSelfAsk(text, who) {
    if (seal.isSealed(text)) {
      var mine = auth.loadIdentity(rootDir);
      var got = mine && seal.open(mine.sealPrivateKey, who && who.id, mine.publicKey, text);
      if (!got) return { refusal: { ok: false, status: 400, error: 'this did not open for me' } };
      return { plain: got.text };
    }
    if (isCardAsk(text)) return { plain: text };
    // The receiver's half of the strict rule, on the relay's own door.
    // A sender-only check is bypassed by not being the sender, and
    // "the relay is the one box everybody can reach" is precisely the
    // door where that matters.
    return { refusal: {
      ok: false, status: 400,
      // No apostrophe: spiritErrors.js scans these literals out of the
      // source, and an escaped quote truncates what it reads.
      error: 'unsealed posts are refused — seal to the cipher key this relay publishes',
    } };
  }

  // ── ONE VERB PER REQUEST (goal/G16.2: the several-verbs and the card findings of the review of
  // 2026-10-10) ──────────────────────────────────────────────────────────
  //
  // answerSelfInner is a sequence of independent `if (body && body.x)`
  // blocks, so a body carrying several verbs ran all of them, and a truthy
  // `card` (the one ask allowed unsealed) let an invite travel in plaintext
  // beside it. Every own key of a request body is a verb, so a body is one
  // key or it is refused. Counted here, on the opened text, so the refusal
  // comes before anything runs.
  function selfAskVerbCount(plain) {
    var parsed = null;
    try { parsed = JSON.parse(String(plain || '')); }
    catch (e) { return 0; }
    var body = parsed && parsed.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 0;
    return Object.keys(body).length;
  }

  function answerSelf(hash, asked, who) {
    if (asked.refusal) return sendSelfAnswer(hash, who, asked.refusal);
    return guardWrite('owner verb', function () {
      return answerSelfInner(hash, asked.plain, who);
    });
  }

  // ── AND THE RELAY'S OWN ANSWER GOES BACK SEALED ─────────────────────
  //
  // Both directions, or it is half a rule. A relay's answers are not
  // nothing: a mint carries an invite TOKEN, a status carries this box's
  // figures, a search carries who matched. Sealed to whoever asked, with
  // the parties the other way round in the associated data.
  //
  // WHAT IT NEEDS is the asker's cipher key, and the relay has it for the
  // same reason a node does — from the roll, where a member's card is
  // kept (cycle 10's R13). No key, no answer text: never a plain one, and
  // the receipt still goes so the asker learns it arrived.
  // ── WHAT A MEMBER'S ANSWERS ARE SEALED TO ───────────────────────────
  //
  // Off the card on their roll row, VERIFIED EVERY TIME against the key
  // the row is filed under — which is what makes the relay the keeper of
  // cards without being trusted with them.
  //
  //   Andy: "and the relay can't falsify the record in the member roll?"
  //
  // It cannot. A card it altered stops verifying, and a card it swapped
  // for another member's verifies as that member and so fails the key
  // check here. The worst it can do is lose one, and a lost card means
  // an answer it cannot seal — a refusal, never a plaintext answer.
  //
  // FROM RAM WHEN THEY ARE CONNECTED, which is every asker this is used
  // for: a relay answers the member who just posted, and a member who
  // posted is holding a stream. `findByKey` is the existing one-read
  // lookup and prefers `activeRows` — using anything else here would put
  // a disc seek on every single answer, which `diskClient.js` catches by
  // counting reads and is right to.
  function memberSealKey(publicKey) {
    var row = findByKey(publicKey);
    if (!row || !row.card) return '';
    var card = nodeCard.verify(row.card);
    if (!card || card.publicKey !== publicKey) return '';
    return card.sealKey || '';
  }

  // `how.plain`: the card ask's answer, the one plaintext exception (Andy's
  // decision, goal/G22.6: "One plaintext exception stays, the card ask").
  // `how.sealKey`: the cipher key off the card a claim carried, verified
  // against the key that signed it — a stranger has no row, so the claim's
  // own card is the only place its key can come from.
  function sealBack(mine, toKey, text, how) {
    if (how && how.plain) return text;
    var to = (how && how.sealKey) || (toKey && memberSealKey(toKey));
    var wrapped = to ? seal.seal(to, mine.publicKey, toKey, text) : null;
    return wrapped ? JSON.stringify(wrapped) : '';
  }

  // THE ONE WAY THIS BOX ANSWERS A POST ADDRESSED TO ITSELF. Lifted out
  // of `answerSelfInner` so that the refusals `answerSelf` makes BEFORE
  // it — an unsealed post, one that will not open — leave by the same
  // door as every verb's answer, with the same sealing and the same
  // receipt. A second exit would be a second protocol, and would be the
  // exit that quietly forgot to seal.
  function sendSelfAnswer(hash, who, answer, how) {
    var mine = auth.loadIdentity(rootDir);
    if (!mine || !mine.privateKey) return;
    // NO APP. A packet addressed to a relay has no app on any node to be
    // for, and the absence is what marks it as a system packet to
    // whoever decodes one. Andy: "nothing in node and relay should know
    // about apps."
    var reply = sealBack(mine, who && who.id, JSON.stringify({ v: 1, body: answer }), how);

    // ── A REFUSAL IS HEARD EVEN WHEN IT CANNOT BE SEALED ─────────────
    //
    // Sealing needs the asker's card, and the one asker who may not have
    // sent one is a node from before this cycle — which is exactly the
    // node that needs to be told. Silence there would make the flag day
    // indistinguishable from a broken relay: "old nodes MUST update to
    // stay in the game" is only true if an old node can find out.
    //
    // SO A REFUSAL TRAVELS PLAIN, and nothing else ever does. An ANSWER
    // that cannot be sealed is not sent at all.
    //
    // ── AND IT IS ONE FIXED SENTENCE, NOT THE VERB'S ─────────────────
    //
    // This used to forward `answer.status` and `answer.error`, with a
    // comment claiming no verb could leak its figures through the branch.
    // wsl-claude, reviewing: the status was rebuilt, the SENTENCE was
    // not. `String(answer.error)` IS the verb's own text. An unsealed
    // asker never reaches a verb so that half was safe — but a SEALED
    // asker the relay holds no card for does reach one, and its refusal
    // sentence then travelled in clear.
    //
    // Refusal sentences here carry the relay's CONDITION: the disc guard
    // says it cannot write its own state, the compaction refusal names
    // megabytes free and needed, a full relay names the obstruction.
    // Decision 0006 makes that the owner's business, not the asker's.
    //
    // THE STATUS IS FIXED TOO, which goes one step past the finding: a
    // status is the verb's information as much as its prose is, and this
    // branch is not reporting a verb. It is reporting that the relay
    // cannot answer privately. The asker is owed exactly one fact,
    // because it has exactly one move — hand over a card (cycle 10, R20).
    if (!reply && answer && answer.ok === false) {
      reply = JSON.stringify({ v: 1, body: {
        ok: false,
        status: 428,
        error: 'this relay holds no card for you, so it cannot seal a reply',
      } });
    }

    // NOT THROUGH routeReply, and the reason is the asymmetry that made
    // this necessary in the first place: routeReply begins with
    // senderIdentity, which resolves the owner and peer rows and NOT this
    // relay's own key. Sending its own answer through the public door
    // would have it refuse itself. Everything else is identical — same
    // table, same check that the replier is the route's target, same
    // event on the requester's stream.
    var matched = routes.answer(hash, mine.publicKey);
    if (!matched.ok) return;
    var packet = {
      hash: hash,
      from: mine.publicKey,
      text: reply,
      sig: auth.sign(mine.privateKey, auth.receiptMessage(hash, reply)),
    };
    // A POST HELD FOR ITS ANSWER (holdOnPost) gets it as the reply to the
    // post it asked with, which is still open, waiting; everybody else on
    // their stream.
    if (settleOnPost(hash, packet)) return;
    presentNow.send(matched.requester, 'reply', packet);
  }

  // ── THE RELAY'S CARD: WHAT A CARD ASK IS ANSWERED WITH (goal/G22.6) ────
  //
  // Andy's decision (goal/G22.6, 2026-10-13): the door answers a card ask
  // from a key it does not know "with the relay's key", and "there is no
  // separate key request". So this is what the closed public key route answered,
  // moved onto the one door: the identity key, the cipher key posts to it
  // are sealed to, the signature over both and the label, its owner, and
  // what it will carry. Self-signed, so it settles tampering and not
  // introduction; a node pins it (answerRelay.js, relayKeys.js).
  //
  // `payloadMax` lets a sender tell "too big for me" from "too big for THAT
  // box". It can only make a sender send less, so it needs no signature.
  function relayCard() {
    var own = ownerPublic();
    return {
      ok: true,
      status: 200,
      relayPublicKey: relayPublicKey(),
      relaySealKey: relaySealKey(),
      keySig: relayKeyStatement(),
      relayLabel: relayLabel(),
      ownerKey: own.ownerKey,
      ownerLabel: own.ownerLabel,
      payloadMax: limits.PAYLOAD_MAX,
      // WHAT THIS RELAY OFFERS (goal/G30.2): an object of switches, so the next one is a key and not a new card field.
      // sendMail: a mail driver loaded, so it takes a join by email; face: it answers the face verb. Unsigned, as
      // payloadMax is: a forged true earns only the join's refusal, a forged false only hides a field. A node
      // ignores a key it does not know, and reads a missing one as false.
      services: { sendMail: !!sendMail, face: true },
    };
  }

  // A CLAIM AND NOTHING ELSE: one verb, `claim` (goal/G16.2's one-verb rule
  // already refused anything riding beside it).
  function isClaimAsk(plain) {
    var parsed = null;
    try { parsed = JSON.parse(String(plain || '')); }
    catch (e) { return false; }
    var body = parsed && parsed.body;
    return !!(body && typeof body === 'object' && body.claim && typeof body.claim === 'object' &&
      Object.keys(body).length === 1);
  }

  // THE RELAY'S PUBLIC SERVICES: its card and a claim (Andy's decision,
  // goal/G22.6). The only things a key this relay does not hold may ask it.
  function isPublicAsk(plain) {
    return isCardAsk(plain) || isClaimAsk(plain) || isJoinAsk(plain);
  }

  // A JOIN OR ITS CONFIRM AND NOTHING ELSE (goal/G30.2): one verb, as a claim is.
  function isJoinAsk(plain) {
    var parsed = null;
    try { parsed = JSON.parse(String(plain || '')); }
    catch (e) { return false; }
    var body = parsed && parsed.body;
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1) return false;
    return !!((body.join && typeof body.join === 'object') || (body.joinConfirm && typeof body.joinConfirm === 'object'));
  }

  // ── A PUBLIC SERVICE, ANSWERED ON ITS OWN POST (goal/G22.6) ────────────
  //
  // For anybody — a stranger, the owner before he holds a row, a member
  // claiming again — and always on the post that asked (holdOnPost), so
  // neither learning the relay's key nor claiming a seat needs a stream.
  //
  // THE CLAIM KEEPS ITS INNER SIGNATURE (Andy's decision): `relay.claim`
  // still verifies claimMessage(name) against the key it names, exactly as
  // the closed public claim route did. And THE KEY THAT SIGNED THE POST IS THE KEY
  // THAT CLAIMS — the check that route made on the sealing key — so nobody
  // can carry a claim on behalf of a key they do not hold.
  function answerPublic(hash, plain, who) {
    if (isCardAsk(plain)) return sendSelfAnswer(hash, who, relayCard(), { plain: true });
    // JOIN AND ITS CONFIRM (goal/G30.2): the key that signed the post is the key that joins. Sealed, like a claim's
    // answer, to the card the post carried.
    if (isJoinAsk(plain)) {
      var jb = null;
      try { jb = JSON.parse(plain).body; } catch (e) { jb = {}; }
      var asked = jb.join || jb.joinConfirm || {};
      var jout = jb.join
        ? join(who.id, asked.email, asked.port, asked.card)
        : joinConfirm(who.id, asked.code, asked.card);
      var jcard = typeof asked.card === 'string' ? nodeCard.verify(asked.card) : null;
      var jseal = jcard && jcard.publicKey === who.id ? jcard.sealKey : '';
      return sendSelfAnswer(hash, who, {
        ok: !!(jout && jout.ok), status: (jout && jout.status) || 500,
        peer: (jout && jout.peer) || undefined, error: jout && !jout.ok ? jout.error : undefined,
        email: (jout && jout.email) || undefined, emailVerified: (jout && jout.emailVerified) || undefined,
      }, { sealKey: jseal });
    }
    var claimed = null;
    try { claimed = JSON.parse(plain).body.claim; } catch (e) { claimed = null; }
    var c = claimed || {};
    var out;
    if (String(c.publicKey || '') !== who.id) {
      out = { ok: false, status: 403, error: 'the claim names a different key than the one that signed it' };
    } else {
      // The invite label rides beside the name: `name` is what this key
      // wants to be called, `inviteLabel` the word the owner wrote on the
      // invite (R1, 2026-09-15). The address the claim came from is no
      // longer read: the address table held it at the door.
      var result = claim(c.name, c.sig, c.publicKey, '', c.invite, c.inviteLabel, c.card);
      out = {
        ok: !!(result && result.ok),
        status: (result && result.status) || 500,
        // A 409 carries the peer already there, so the caller can tell
        // "that key is mine already" from a refusal. The key is public.
        peer: (result && result.peer) || undefined,
        error: result && !result.ok ? result.error : undefined,
      };
    }
    // Sealed to the card the claim carried, verified against the key that
    // signed it; a member re-claiming without one is sealed to its row's.
    var offered = typeof c.card === 'string' ? nodeCard.verify(c.card) : null;
    var sealKey = offered && offered.publicKey === who.id ? offered.sealKey : '';
    return sendSelfAnswer(hash, who, out, { sealKey: sealKey });
  }

  // A card request is the one plain packet there is. A relay answers it
  // with its own card (relayCard, goal/G22.6), on the post that asked.
  function isCardAsk(text) {
    var parsed = null;
    try { parsed = JSON.parse(String(text || '')); }
    catch (e) { return false; }
    // A card ask carries NOTHING ELSE (goal/G16.2, the card finding): it is the one ask
    // allowed unsealed, so anything riding beside it would travel in clear.
    return !!(parsed && !parsed.app && parsed.body && parsed.body.card &&
      typeof parsed.body === 'object' && Object.keys(parsed.body).length === 1);
  }

  // ── WHAT A CALLER MAY ASK THIS RELAY, AND ITS INTROSPECTION (goal/G30.3) ──
  //
  //   Andy, 2026-10-19: "The only new component relay needs is introSpector", and "no grants per member. only one
  //   switch owner | member". The verbs know nothing of callers; this one table does. The owner may call every verb
  //   below, a member the member verbs. Nothing is stored per member, and an asker learns nothing of why its answer
  //   is the one it gets ("for the relay the category question is 100% internal").
  //
  // The relay's folder js/relaySelf/ (AGENTS.md and one description file per verb) is read through introSpector's FS
  // verbs (goal/G30.4: the AGENTS verbs are gone). FS is an owner verb like the others below; members get nothing of
  // it (Andy, 2026-10-20: "don't build shit nobody asked for.").
  var MEMBER_VERBS = ['card', 'face', 'removePeer', 'rename', 'search'];
  var OWNER_VERBS = ['config', 'debug', 'invite', 'monitor', 'relayLabel', 'revoke'];
  // A REFUSAL SAYS WHY ONLY IN DEBUG (Andy, 2026-10-20: "give good information in DEBUG mode, otherwise just
  // refuse"). Off, a member asking an owner verb gets the plain refusal a verb nobody declared gets; on, the owner
  // diagnosing his relay sees the reason. The verbs themselves are public (the repository), so this hides nothing.
  function notGranted() {
    return require('./kernel').core.util.debug()
      ? { ok: false, status: 403, code: 'not-granted', error: 'that verb is not open to you on this relay' }
      : { ok: false, status: 404, error: 'no such peer' };
  }
  var selfFamily = null;
  function relaySelfFamily() {
    if (!selfFamily) {
      try { selfFamily = require('./introSpector').family(path.join(__dirname, 'relaySelf'), { declared: MEMBER_VERBS.concat(OWNER_VERBS) }).verbs; }
      catch (e) { selfFamily = {}; }
    }
    return selfFamily;
  }
  function answerFs(name, args) {
    var family = relaySelfFamily();
    if (!Object.prototype.hasOwnProperty.call(family, name)) return { ok: false, status: 404, error: 'no such verb' };
    try { return family[name].handler(args || {}); }
    catch (e) { return { ok: false, status: e && e.refusal ? 400 : 500, error: (e && e.refusal) || 'the folder could not be read' }; }
  }

  // ── THE RELAY'S API, FOR EVERY MEMBER (goal/G30.5) ────────────────────
  //
  //   Andy, 2026-10-20: "the relay will reply to api queries for ALL members, not just the owner", in the same shape
  //   as the node's api ("why would i do that, if not to give the relay-api the same shape as the nodes api?").
  //
  // The body 'api' answers { relay: { <verb>: { description, request, reply } } }, cut to the caller's category: a
  // member the member verbs, the owner every verb and the FS verbs. Each entry is read from the verb's file in
  // js/relaySelf/; a file declares no reply, so reply is {}. FS itself stays the owner's (the gate below).
  function relayApi(owner) {
    var family = relaySelfFamily();
    var out = {};
    (owner ? MEMBER_VERBS.concat(OWNER_VERBS) : MEMBER_VERBS).forEach(function (v) {
      var read = answerFs('FS.loadJsonValue', { path: v + '.json' });
      var file = read && read.value && typeof read.value === 'object' ? read.value : {};
      out[v] = {
        description: typeof file.description === 'string' ? file.description : '',
        request: file.request && typeof file.request === 'object' ? file.request : {},
        reply: file.reply && typeof file.reply === 'object' ? file.reply : {},
      };
    });
    if (owner) {
      Object.keys(family).filter(function (n) { return n.indexOf('FS.') === 0; }).forEach(function (n) {
        out[n] = { description: family[n].description || '', request: family[n].request || {}, reply: family[n].reply || {} };
      });
    }
    return { relay: out };
  }

  function answerSelfInner(hash, text, who) {
    var asked = null;
    try { asked = JSON.parse(text); }
    catch (e) { asked = null; }
    var body = (asked && asked.body) || null;
    var out = { ok: false, status: 404, error: 'no such peer' };
    var owner = isOwner(who);
    if (body === 'api') return sendSelfAnswer(hash, who, relayApi(owner));

    // THE GATE comes first (goal/G30.3): a verb outside the caller's category is refused before any verb below can see
    // it. FS.* is an owner verb (goal/G30.4), answered from the folder.
    var only = body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 1 ? Object.keys(body)[0] : '';
    var isFs = only.indexOf('FS.') === 0;
    if (only && (isFs || OWNER_VERBS.indexOf(only) !== -1) && !owner) return sendSelfAnswer(hash, who, notGranted());
    if (isFs) return sendSelfAnswer(hash, who, answerFs(only, body[only]));
    // Set by the search branch: a roll walk to run before anything is sent.
    var searching = null;

    // WHAT A PARTNER MAY ASK (search, forward) and the `partners` verb
    // STOOD HERE; partnering is gone (goal/G22.6). A key this relay does
    // not hold never reaches this function: the door answers it the card
    // ask and a claim (answerPublic) and refuses it everything else.
    // ── SEARCH, BECAUSE A LIST DOES NOT SCALE ──────────────────────────
    //
    //   Andy: "This approach will not be sustainable if there's even just
    //   a thousand people in this list… We want the partner-space
    //   searchable."
    //
    // The node used to fetch every roll WHOLE and subtract what it
    // knew. At ten members that is a list; at a thousand it is 150 KB per
    // relay to render something nobody can read. So the relay answers the
    // question instead of shipping the material to answer it with.
    //
    // ANY MEMBER MAY ASK. The roll is already public in full, so a search
    // over it gives away nothing new — what it saves is the transfer, and
    // that saving is the entire point.
    //
    // A FLOOR ON THE QUERY, because substring matching with no floor is
    // the roll again with extra steps: `a` would return everybody.
    //
    // CANDIDATES, NEVER AN ANSWER (R1). Three johns come back as three
    // rows and the caller confirms by key, exactly as contacts does for a
    // local handle. A search that implied "this is the john you meant"
    // would be the thing R1 exists to prevent.
    //
    // OWN MEMBERS ONLY. The fan-out to partner relays and the merge of
    // their answers went with partnering (goal/G22.6).
    if (body && body.search) {
      var q = String((body.search.q) || '').trim().toLowerCase();

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
      // as many as fit, and `more`.
      //
      // An EMPTY query is not an error either. It matches everyone
      // connected (walkRoll) and the cap takes the top of that — which is
      // "who is around", answered by the same verb rather than by a
      // second one.
      {
        // ── THE RANKING IS NOT THIS FILE'S ───────────────────────────
        //
        //   Andy: "i want the graded search logic and that stuff isolated
        //   from relay or other core components, since quality-of-result
        //   measurements etc. are up in the air and we need to have this
        //   block separately tested and verified, and give it an
        //   independent evolution path."
        //
        // So this maps each member into the plain row the ranker (peerRank, goal/G29.17) takes and
        // does nothing else. Presence is resolved HERE, into a field,
        // because `presentNow` is a relay concept with a live socket
        // behind it and the ranker must stay drivable from a test with
        // nothing running.
        //
        // What this file is no longer entitled to an opinion about: what
        // a good match is, what beats what, and how many fit.
        // THE WALK IS ASYNCHRONOUS (cycle 3). The roll is read a page at a
        // time off disc, with the event loop between pages (walkRoll), so
        // a search over a large roll never stalls every other request on
        // this relay. The answer is composed when the walk ends —
        // `searching` hands the rest of this function to it.
        searching = { q: q };
      }
    }

    // What the walk produced, turned into this relay's answer. Only the
    // timing moved: this ran inline, straight after the walk, until the
    // walk stopped blocking.
    function composeSearch(found) {
        // ONE BUCKET, offered every row. Never a list of everyone — this
        // relay may hold a million members and `q` may be one letter.
        var matches = found.matches.map(function (row) {
          // `via` is the merger's field and means nothing in a reply that
          // had one source. It goes back on at the point a reply carries
          // several (tier three), not here.
          return {
            publicKey: row.publicKey,
            publicLabel: row.publicLabel,
            claimedAt: row.claimedAt,
            // `owner` and `present` STOOD HERE (2026-09-19). A row does not
            // know who owns the relay, and every row found is connected
            // (walkRoll).
          };
        });
        var more = found.more;

        // `more` rather than a page: a caller who sees it types another
        // letter, which is cheaper for everybody than a cursor — and with
        // results ordered by quality, the ones that did not fit are the
        // ones they wanted least. That now covers two kinds of "did not
        // fit": too many for the slots, and too many for the wire.
        // Cut to what fits the envelope this relay is about to send.
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

    // ── A MEMBER HANDS OVER ITS CARD (cycle 10, R20) ──────────────────
    //
    // The claim carries a card, and every member enrolled before this
    // cycle has none — so the relay cannot seal an answer to them, and it
    // mints an invite, spends the seat and answers with silence. Found by
    // checking whether Andy's own boxes could be updated, before one was
    // touched. **A flag day nobody can cross is not a flag day.**
    //
    // ── WHY THE NODE PUSHES RATHER THAN THE RELAY ASKING ─────────────
    //
    // Decided with Andy. The relay could ask when it finds it holds none,
    // and that was the other candidate — but:
    //
    //   ROTATION NEEDS THIS PATH ANYWAY. A node that changes its cipher
    //   key must tell every relay it is enrolled at, and a relay cannot
    //   know to re-ask. Build it here and the rotation requirement's rotation is the same
    //   message, verified the same way.
    //   IT IS SELF-HEALING. Any node on the new code, connecting to any
    //   relay, delivers its card: no migration script and nothing for an
    //   owner to run. That is what makes the flag day crossable rather
    //   than merely declared.
    //   THE NODE OWNS THE FACT. It is the only party that knows when its
    //   card changed; a relay asking can only ask at moments it thinks of.
    //
    // ANY MEMBER MAY, and not only the owner: everybody needs a card on
    // their row or the relay can answer none of them.
    //
    // VERIFIED, NEVER TRUSTED. `cardFor` checks the blob against the key
    // this sender signed the post with, so a member can only ever deliver
    // its OWN card — and it is the same check the claim route makes,
    // which is why it is that function and not a second one.
    if (body && typeof body.card === 'string' && body.card) {
      var mineNow = findByKey(who.id);
      if (!mineNow) {
        out = { ok: false, status: 404, error: 'no such peer' };
      } else {
        var offered = cardFor(who.id, body.card);
        if (!offered) {
          out = { ok: false, status: 400, error: 'that card is not yours' };
        } else {
          // NEWER, OR NOT AT ALL (cycle 10's C1). A validly signed old
          // card can be re-served after a rotation and it verifies — a
          // downgrade needing no forgery, only a copy, possibly back to
          // the very key whose compromise caused the rotation. The roll
          // takes a card only when its counter is strictly higher.
          var held = mineNow.card ? nodeCard.verify(mineNow.card) : null;
          var fresh = nodeCard.verify(offered);
          if (held && fresh && !(fresh.at > held.at)) {
            out = { ok: false, status: 409, error: 'not newer than the card on file' };
          } else {
            store.members.put({
              publicKey: mineNow.publicKey,
              publicLabel: mineNow.publicLabel,
              claimedAt: mineNow.claimedAt,
              card: offered,
            });
            rememberActive(who.id);
            out = { ok: true, status: 200, card: 'taken', at: fresh ? fresh.at : 0 };
          }
        }
      }
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

    // ── relay.debug — READ AND SET, OWNER ONLY, IN ONE VERB ───────────
    //
    //   Andy, 2026-09-26: "DEBUG is Off by default, returned and set by
    //   owner-only api" — and, on why it must reach a live box: "when
    //   spirit-3 shows hickups, rather than taking it down, the owner should
    //   be able to flip the DEBUG switch remotely and get even more valuable
    //   data.... for remote diagnosis, that cannot be easily had and brought
    //   back by ssh."
    //
    // ONE VERB AND NOT TWO, so a caller cannot read one thing and set
    // another: `{ debug: {} }` reports, `{ debug: { on: true|false } }` sets
    // and reports the state that resulted. A suite can therefore establish
    // its own precondition instead of trusting that somebody flipped it,
    // which is what "returned and set" buys.
    //
    // NO REFUSAL FOR A LIVE RELAY. The design recommended refusing once the
    // roll holds members other than the owner; Andy reversed it, because a
    // relay with members showing hiccups is exactly when this earns its
    // keep. And his second point retires the risk argument: it is only
    // AFTER the first claim that this verb can be reached at all, since an
    // owner verb needs the owner to be a member. The claim is the
    // precondition, not the hazard.
    //
    // The `owner` guard is the same one every verb in this block uses, so a
    // non-owner is refused `not-owner` by the path below rather than by a
    // second opinion written here.
    if (body && body.debug && owner) {
      // Already proved, exactly as the monitor verb records: this arrived
      // signed by the owner over bytes that bind sender, recipient and this
      // text — so a captured `on` cannot be replayed as an `off`.
      if (Object.prototype.hasOwnProperty.call(body.debug, 'on')) {
        require('./kernel').core.util.debug(!!body.debug.on);
      }
      out = { ok: true, debug: require('./kernel').core.util.debug() };
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

    // REGISTERING A FACE NAME AND EMAIL, own row, no owner path (goal/G30.1; faceSelf above).
    if (body && body.face && typeof body.face === 'object') {
      out = faceSelf(who, body.face.name);
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

    // ── THE OWNER RESIZES HIS OWN BOX, FROM HIS OWN NODE (cycle 9) ──
    //
    //   Andy, 2026-09-22: "i want interfaces to do this remotely." —
    //   "remote adjustment with possibly restart must be there, at least
    //   in the core, not neccessarily in UI."
    //
    // The figures used to be reachable only by SSH, which meant the owner
    // of a relay in a datacentre could not answer "how many may join?"
    // without a terminal. This is that answer as a packet, signed by the
    // key in allow.json, arriving down the same wire as every other owner
    // grant — no door, no console, no credential on the box.
    //
    // WHAT IT DOES NOT DO: change anything that is live. The
    // configuration is still read once, at boot (relayConfig.js), and
    // this writes the FILE. A live ceiling that moved under a running
    // relay would be a limit nobody could reason about, and cycle 1's
    // scope says configuration is not a real-time tool. So the answer
    // says what will apply at next start, and `restart` asks for that
    // start to be now.
    if (body && body.config && owner) {
      out = reconfigure(body.config);
    }

    // The owner's `partner` and `unpartner` verbs STOOD HERE. Partnering as
    // a permission is gone (Andy's decision, goal/G22.6); asked now, they
    // fall through to `no such peer` like any verb nobody has heard of.

    // `body.lever` — the owner's lever verb — STOOD HERE, deleted with the
    // Governor (cycle 8). Nothing is left to move; a lever is a gauge now.

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
      out = mint(ownerLabel(), ask.label, ask.days, ask.token, hash);
    }

    // `body.setDevice` STOOD HERE. It was the verb that proved a relay
    // should answer more than its owner — and then the same reasoning
    // carried one step further showed a relay should not hold a device
    // key at all. The door it opened stays open: removing yourself is
    // still an own-row verb, and that is what keeps the gate honest.

    // ── SENT WHEN THE ANSWER EXISTS ────────────────────────────────────
    //
    // Every verb answers at once except search, which answers when its walk
    // of the connected members ends. The partner fan-out that also waited
    // here went with partnering (goal/G22.6).
    if (searching) {
      walkRoll(searching.q, function (found) {
        if (!found) {
          out = { ok: false, status: 503, error: 'search failed' };
        } else {
          composeSearch(found);
        }
        sendSelfAnswer(hash, who, out);
      });
      return;
    }
    sendSelfAnswer(hash, who, out);
  }

  // ── THE CONNECTED MEMBERS, WALKED WITHOUT BLOCKING ───────────────────
  //
  //   Andy (2026-09-19): "Search should respond with active/online members
  //   only. A node can reconcile with its contact list to conclude that a
  //   contact is offline (or dead, or currently rebooting...)."
  //
  // So the walk is over `activeRows` — the rows of members whose stream is
  // open, cached at connect and dropped at close — and never the disc.
  // Bounded by the connection allowance the Governor moves, so a search
  // costs what connections cost and no more. Discovery serves active
  // participants ("the most precious"); somebody offline is not found, and
  // a node that already holds their key still posts to them by key.
  //
  // *This supersedes the cycle 3 walk, which paged the whole roll off disc
  // (`store.members.page`) and ranked the present first. Every row found
  // here is present, so rows carry no `present` and the ranking weighs no
  // presence signal.*
  //
  //   Andy: "the nature of all wire comms is asynchronous. And blocking
  //   hurts the resources of relays."
  //
  // Still paged, SEARCH_PAGE keys a turn with the event loop between, over
  // a snapshot of the keys: a member arriving mid-walk is simply not seen,
  // one leaving mid-walk is skipped when its row is gone.
  //
  // RANKED ON THE PROBABILITY MODULES (goal/G29.17): the walk gathers the
  // connected members' rows, and peerRank, the node's ranker too, keeps the
  // best peerRank.SLOTS of them. `done(result)` gets {matches, more}.
  function walkRoll(q, done) {
    var rows = [];
    var keys = Object.keys(activeRows);
    var at = 0;
    (function step() {
      var end = Math.min(at + SEARCH_PAGE, keys.length);
      for (; at < end; at += 1) {
        var p = activeRows[keys[at]];
        if (!p || !p.publicKey) continue;
        rows.push({
          publicKey: p.publicKey,
          publicLabel: labelOf(p),
          claimedAt: p.claimedAt,
          via: null,
        });
      }
      if (at >= keys.length) {
        var ranked = peerRank.rank(rows, q, peerRank.SLOTS);
        done({ matches: ranked.rows, more: ranked.more });
        return;
      }
      setImmediate(step);
    })();
  }

  // partnerFromHints STOOD HERE: which partner a member's signed route
  // hints named. With no partner roll there is nobody to carry to, and the
  // hints are no longer read (goal/G22.6).
  //
  // ── THE ORIGINATOR'S BUDGET, TIGHTENING INWARD ───────────────────────
  //
  //   Andy: "N1 sets a limit on its patience, which gets reduced down the
  //   chain by the formula you proposed." — "part of the request's
  //   sidecar/envelope." — "the willing to wait time in a request is
  //   informational, and the next station down the chain better hurry."
  //
  // `budgetMs` is how long the ASKER is still willing to wait, as a
  // remaining DURATION and never a deadline — a timestamp would need this
  // box and the asker to agree about the clock, which is the same reason
  // the hash is computed and never carried (0011).
  //
  // It is informational: this relay grants min(asked, its own ceiling), so
  // the number can only ever buy LESS than the box already allows. A hold
  // time a member could lengthen would not be a limit, it would be a
  // default.
  //
  // `clientKey` is the address the post came from (relayServer.js), read
  // only for a sender this relay does not hold: the strangers' table.
  function routePost(fromToken, toToken, text, sig, budgetMs, clientKey) {
    var to = String(toToken == null ? '' : toToken);
    // AN EMPTY TARGET IS THIS BOX (Andy's decision, goal/G22.6): "A stranger
    // addresses the relay itself with an empty target (to: \"\"), since it
    // does not know the relay's key yet."
    var selfAddressed = to === '' || postedToSelf(to);
    var target = selfAddressed ? null : senderIdentity(to);

    // ── WHO IS ASKING: A MEMBER, OR A STRANGER ────────────────────────
    //
    // Andy's decision (goal/G22.6, 2026-10-13): "The door first looks at
    // packets addressed to the relay itself: one from an unknown key is
    // read and answered if it is the card ask (answered with the relay's
    // key) or a claim, and refused otherwise; only packets for others need
    // a known sender." And "a relay carries posts to its members from any
    // relay". So a key this relay does not hold may post to THIS BOX (its
    // public services, decided below once the post is opened) and to one
    // of THIS RELAY'S MEMBERS. A post for anybody else needs a sender this
    // relay holds: it is refused with the sentence that names the sender
    // (goal/G19.1), the same on the post, the reply and the stream.
    var who = senderIdentity(fromToken);
    if (!who) {
      var strangerKey = String(fromToken == null ? '' : fromToken).trim();
      if (!strangerKey || (!selfAddressed && !target)) {
        return { ok: false, status: 403, error: 'your id is not a valid sender here' };
      }
      // HELD BY ITS ADDRESS, FIRST (strangerAdmit; Andy's address table).
      var admitted = strangerAdmit(clientKey);
      if (!admitted.ok) {
        monitorEvent('refused', strangerKey, to, { why: admitted.busy ? 'busy' : 'too early' });
        return admitted;
      }
      who = { id: strangerKey, publicKey: strangerKey, owner: false, stranger: true };
    }

    // ── ONE LIMIT, FOR EVERY POST A MEMBER SENDS ─────────────────────
    //
    //   Andy: "the relay-to-relay hop is just normal protocol-compliant
    //   traffic, like all other traffic... measurable, throttleable."
    //
    // ABOVE THE self-addressed BRANCH ON PURPOSE: a member's verb addresses
    // the BOX, and a relay that meters packets to its members and not
    // packets to itself is measuring the half of its work that is easiest
    // to measure. A stranger is not charged here: the address table above
    // holds it.
    //
    // AFTER THE SIGNATURE, NOT BEFORE IT (goal/G16.2, S4 of the review of
    // 2026-10-10). It sat first, so a flood could not make this box verify
    // signatures; but a charge before the proof is a charge to whoever the
    // sender CLAIMS to be, and junk carrying a member's public key spent
    // that member's budget: anyone who knew a key could rate-limit its
    // owner off the relay. Andy folded the fix into G16.2: "the charge moves
    // after the signature check". So the post is proven first, once, over
    // the key it is addressed to, and only a proven sender is charged.
    //
    // KEYED ON THE RESOLVED SENDER — a member key — never on anything the
    // sender chose. The note on the old send limit is the reason, and is
    // worth not relearning:
    // "30 sends per minute per name, with the name chosen by the sender,
    // is 30 per minute per made-up string — rotate it and the budget
    // resets, which is exactly what an abuser does and never what a real
    // client does."
    //
    // 429, and it NAMES THE NUMBER. Everything else this route says is
    // deliberately incurious; this is the exception, because
    // it is temporary, and a client that knows the cap
    // waits instead of guessing.
    // THE PROOF. Over the key the post is addressed to, as the sender signed
    // it: this relay's own key (or the empty target) for a question to
    // itself, the member's canonical key for a member, and the token as
    // given for a key this box does not hold.
    var signed = null;
    try {
      signed = auth.postSignatureFor(who.publicKey, who.id, target ? target.id : to, text, sig);
    } catch (e) { signed = null; }
    if (!signed) return { ok: false, status: 403, error: 'bad post signature' };

    if (!who.stranger && !rateOk(memberHits, who.id, MEMBER_PER_MIN)) {
      monitorEvent('refused', who.id, to, { why: 'rate', pool: 'member' });
      return {
        ok: false, status: 429,
        error: 'too many posts — limit is ' + MEMBER_PER_MIN + ' a minute',
        perMin: MEMBER_PER_MIN,
        pool: 'member',
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
    // Checked before senderIdentity is asked about the target, because
    // the relay's own key is deliberately not a row and never will be —
    // publishing it as one would put it in every roll.
    if (selfAddressed) {
      var selfSigned = signed;
      if (typeof text !== 'string' || !text) {
        return { ok: false, status: 400, error: 'text required' };
      }
      if (Buffer.byteLength(text, 'utf8') > MAX_ROUTED_TEXT) {
        return { ok: false, status: 413, error: 'too big' };
      }
      // OPENED ONCE, AND ONE VERB (goal/G16.2): see openSelfAsk
      // and selfAskVerbCount. Refused before a route is opened, so a second
      // verb never runs by riding along with the first.
      var asked = openSelfAsk(text, who);
      if (asked.plain != null && selfAskVerbCount(asked.plain) > 1) {
        return { ok: false, status: 400, error: 'one verb per request' };
      }
      // THE PUBLIC SERVICES, AND ONLY THEY, FOR A STRANGER (Andy's
      // decision, goal/G22.6): the card ask and a claim. Anything else from
      // a key this relay does not hold is refused with the sentence that
      // names the sender. A post that did not open is told so, on its post.
      var isPublic = asked.plain != null && isPublicAsk(asked.plain);
      if (who.stranger && !isPublic) {
        if (asked.refusal) return asked.refusal;
        monitorEvent('refused', who.id, mineKey(), { why: 'not a public service' });
        return { ok: false, status: 403, error: 'your id is not a valid sender here' };
      }
      var selfHash = auth.requestHash(selfSigned);
      // Registered before it is answered, exactly as a peer-to-peer post
      // is: nothing leaves until the thing that will match its answer
      // exists. Its target is this relay's own key whatever `to` said, so
      // the empty target and the key are one route (router.js, selfKey).
      var opened = routes.open(selfHash, who.id, mineKey(),
        function () { return true; },
        null, { kind: routerTable.MEMBER, ttlMs: budgetMs });
      if (!opened || !opened.ok) return opened;
      // METERED LIKE ANY OTHER POST.
      meterNote(text.length);

      // ── A PUBLIC SERVICE IS ANSWERED ON ITS OWN POST (goal/G22.6) ──
      //
      // The card ask and the claim, for anybody: a stranger holds no
      // stream, and neither learning a relay's key nor claiming a seat
      // may need one. The post stays open until the answer exists (at
      // once, for both), or until the time this relay granted runs out,
      // and the reply to the post IS the answer. The waiter exists before
      // the answer runs, because both answer before it returns.
      if (isPublic) {
        var heldAnswer = holdOnPost(selfHash, opened.grantedMs);
        answerPublic(selfHash, asked.plain, who);
        return { ok: true, status: 200, hash: selfHash, held: heldAnswer };
      }
      answerSelf(selfHash, asked, who);
      return withStatus(opened, selfHash);
    }

    // THE TEXT IS JUDGED BEFORE ANYTHING ELSE IS DONE WITH IT (the Low of
    // the review of 2026-10-10, folded into goal/G16.6). A stranger's post
    // has the same size limit as any post (Andy's decision, goal/G22.6).
    if (typeof text !== 'string' || !text) {
      return { ok: false, status: 400, error: 'text required' };
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_ROUTED_TEXT) {
      return { ok: false, status: 413, error: 'too big' };
    }

    // `target` was resolved above, with the proof. The carry to a partner
    // named by the sender's route hints STOOD HERE; a relay carries nothing
    // onward now (goal/G22.6), so a key not on this roll is `no such peer`.

    // ── A POST AT A KEY NOBODY HOLDS IS STILL SOMETHING THAT HAPPENED ──
    //
    // Found screenless, 2026-09-23, running the monitor drill against the
    // live relay: four posts deliberately aimed at a key on no roll, and
    // the owner's feed showed nothing at all — not as `refused`, not in
    // any form. Every other refusal on this path reports itself
    // (`minting incomplete`, `peer not reachable`); this one returned in
    // silence, so the one shape that most deserves an owner's attention
    // — somebody posting at addresses that do not exist — was the one
    // shape he could not see.
    //
    // Andy's procedure is why it was found before a screen existed:
    // *"you both verify screenless first."*
    //
    // The TOKEN is reported, not a resolved identity, because there is
    // nothing to resolve: that is the fact. Bounded like every other
    // event here by the caller's rate gate, and it reaches the owner's
    // sink alone.
    if (!target) {
      monitorEvent('refused', who.id, String(toToken), { why: 'no such peer' });
      return { ok: false, status: 404, error: 'no such peer' };
    }

    // The message that VERIFIED, not a yes/no — the ±1 minute window
    // means three strings could have made this signature and the hash
    // must be over whichever one did. Recovering it is what lets the
    // minute stay off the wire entirely.
    // Proven above, over target.id, before the rate was charged.

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
    // EVERY POST SITE HANDS OVER WHAT IT HOLDS, and all three do it the same
    // way, because a site that forgot would make DEBUG silently partial —
    // the owner would see some traffic proved and some unexamined, with
    // nothing saying which.
    monitorEvent('post', who.id, target.id, {
      bytes: Buffer.byteLength(text, 'utf8'), hash: hash, held: text,
    });
    // AND THE METER, counted where the bytes are known and the decision to
    // carry them has been made. Aggregate: `who` is not passed, and there
    // is nowhere in `meterNote` to put it if it were.
    meterNote(text.length);
    function deliver() {
      return presentNow.send(target.id, 'request', {
        from: who.id,
        to: target.id,
        text: text,
        sig: sig,
      });
    }

    // ── A STRANGER'S POST TO A MEMBER, ANSWERED ON ITS OWN POST ─────────
    //
    // Andy's decision (goal/G22.6): "a relay carries posts to its members
    // from any relay". A stranger holds no stream here, so the member's
    // reply comes back as the answer to the post that asked (routeReply,
    // through the route's `carry`), and is otherwise exactly the reply a
    // member gets on its stream. The member's slot is counted per sender
    // (router.js), so no stranger can keep a member busy for anybody else.
    if (who.stranger) {
      var heldReply = holdOnPost(hash, routes.ttlMs);
      var carriedTo = routes.open(hash, who.id, target.id, deliver, {
        answer: function (packet) { return settleOnPost(hash, packet); },
      }, { kind: routerTable.MEMBER, ttlMs: budgetMs });
      if (!carriedTo || !carriedTo.ok) {
        settleOnPost(hash, carriedTo || { ok: false, status: 502, error: 'target could not be reached' });
        return carriedTo;
      }
      return { ok: true, status: 200, hash: hash, held: heldReply };
    }
    return withStatus(routes.open(hash, who.id, target.id, deliver, null, {
      kind: routerTable.MEMBER,
      ttlMs: budgetMs,
    }), hash);
  }

  function withStatus(result, hash) {
    if (!result || !result.ok) return result;
    return {
      ok: true, status: 202, hash: hash,
      // Passed on rather than dropped: this is the number that lets the
      // asker give up exactly when this relay does.
      grantedMs: result.grantedMs,
    };
  }

  // The answer, coming back. The hash finds the request; being its
  // target is the permission — anyone who saw the bytes could compute
  // the hash, so the two are never the same check.
  function routeReply(fromToken, hash, text, sig) {
    var who = senderIdentity(fromToken);
    if (!who) return { ok: false, status: 403, error: 'your id is not a valid sender here' };
    if (!hash) return { ok: false, status: 400, error: 'hash required' };
    if (typeof text === 'string' && Buffer.byteLength(text, 'utf8') > MAX_ROUTED_TEXT) {
      return { ok: false, status: 413, error: 'too big' };
    }

    // Signed over the hash AND the reply text (S1, goal/G16.1), so the relay
    // can neither manufacture a receipt for a request nobody answered nor
    // carry this one with the answer rewritten.
    if (!auth.receiptSignatureOk(who.publicKey, hash, text, sig)) {
      return { ok: false, status: 403, error: 'bad receipt signature' };
    }

    var matched = routes.answer(hash, who.id);
    if (!matched.ok) {
      monitorEvent('refused', who.id, '', { why: matched.error || 'no such route', hash: hash });
      return matched;
    }
    monitorEvent('reply', who.id, matched.requester || '', {
    // A SIZE IN THIS SYSTEM IS BYTES. Andy, 2026-09-26: "the payload cap is
    // BYTES. that's the design, and the attitude, of node and relay." It was
    // .length, a count of UTF-16 units under a name that says bytes, and it
    // undercounted every non-ASCII payload.
      bytes: typeof text === 'string' ? Buffer.byteLength(text, 'utf8') : 0, hash: hash,
    });

    // ── A REPLY TO A STRANGER'S POST (goal/G22.6) ─────────────────────
    //
    // The member answered a post from a key this relay does not hold, which
    // holds no stream here: the reply goes back as the answer to the
    // stranger's own post, still open (routePost, holdOnPost). THE MEMBER'S
    // REPLY TRAVELS WHOLE — its text and its signature over the hash — so
    // the stranger verifies the member's receipt itself, exactly as one on
    // a stream. (The partner tunnel that also answered through here went
    // with partnering.)
    if (matched.carry && typeof matched.carry.answer === 'function') {
      var landedOnPost = matched.carry.answer({
        hash: hash,
        from: who.id,
        text: typeof text === 'string' ? text : '',
        sig: sig,
      });
      return { ok: true, status: 200, delivered: !!landedOnPost };
    }

    // ── A SIBLING IS A ROUTE TOO ─────────────────────────────────────
    //
    //   Andy: "when a request is made via relay to a node that is a
    //   sibling on the same relay, the route must be streamed back to the
    //   node as well, then stashed in contacts exactly the same as if the
    //   post target was on a foreign node." — "because the node doesn't
    //   KNOW it is a sibling."
    //
    // THAT LAST CLAUSE IS THE WHOLE ARGUMENT, and it defeats the obvious
    // objection. It looks as though a node already knows which relay
    // carried a local post, since it chose one. It does not: when no
    // relay of its own names that key, `hub.handlePost` posts through
    // whichever relay it is connected to, and THIS BOX decides whether the
    // packet is delivered. So the delivery says so, on the `route` event:
    // `at` is THIS relay's key, which is exactly what it means — the peer
    // was reached here.
    //
    // NOT BROADCAST — to the member who asked and nobody else: a route is
    // the asker's to keep, and everyone else's business is their own
    // (NODE-AND-RELAY §9b).
    var landed = presentNow.send(matched.requester, 'reply', {
      hash: hash,
      from: who.id,
      text: typeof text === 'string' ? text : '',
      sig: sig,
    });
    // BOTH ENDS, because both learned something and neither can infer it.
    //
    //   Andy: "this must be done for requestor and replier."
    //
    // The asker learns where the target lives; the target learns where
    // the asker lives, which is what it needs to reach back without a
    // search.
    //
    // Neither can be inferred by the node itself: the asker did not
    // choose this relay for this peer when it had no route to choose by,
    // and the target never chose anything — a request simply arrived.
    //
    // Safe to send to anybody, because the NODE decides what to keep:
    // The node keeps this in its shadow and never in the address book
    // (server.js), so a route about a stranger is one lookup and gone.
    // ── AND THE LABEL RIDES WITH THE ROUTE ───────────────────────────
    //
    //   Andy: "streamed route updates should need to be accompanied by
    //   updated labels."
    //
    // This box holds it — `senderIdentity` hands the label back beside
    // the key — and was sending the key alone. The same shape as
    // everything else found discarded this cycle: known at the moment of
    // throwing away, and expensive to go back for.
    //
    // ONLY FOR ITS OWN MEMBERS. A relay is the authority on who is on IT.
    //
    // ── WHY NOT ON THE REQUEST AND THE REPLY, WHICH WOULD BE FREE ────
    //
    //   Andy: "we may want to (free-of-charge) stream update labels with
    //   peerPost responses" — "which would impact post-overhead
    //   calculations" — "not decided yet, but we are trending toward
    //   label-key-tuplets."
    //
    // Tried and backed out the same day. Those packets are already
    // travelling, so carrying the pair on them costs no EVENT — but it
    // costs BYTES on every request and every reply, and
    // `limits.WIRE_OVERHEAD` is 246 and measured. Adding two fields to
    // the hot path would invalidate a measured constant, on a wire change
    // that is not decided.
    //
    // A route announcement is the narrow place: it fires once per
    // exchange between siblings, not on every packet, and the node is
    // its only reader.
    if (landed) {
      var asker = senderIdentity(matched.requester);
      presentNow.send(matched.requester, 'route', {
        key: who.id, at: mineKey(), label: who.label || '',
      });
      presentNow.send(who.id, 'route', {
        key: matched.requester, at: mineKey(), label: (asker && asker.label) || '',
      });
    }
    return { ok: true, status: 200, delivered: !!landed };
  }

  // THE ROSTER WITH STATES stood here: the whole roll pushed to every
  // member on stream open, deleted 2026-09-19 as a served member list
  // (0012 widened; test/boundedByTime.js). Presence travels as `route`
  // events, one member at a time.
  // THE RELAY'S OWN CONDITION, TO ITS OWNER AND TO NOBODY ELSE.
  //
  // The delivery rule lives here rather than in relayStatus.js because
  // this is the only place that knows who the owner is, and because
  // getting it wrong is the whole risk: this report carries live invite
  // labels, which are in no roll and on no public route.
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

  // ── DEBUG: THE ROW CARRIES WHAT THE RELAY HELD (PROVING-IT-CANNOT-READ)
  //
  //   Andy, 2026-09-26: "DEBUG is not persisted. it lives in RAM only" —
  //   and on the mechanism: "DEBUG is Off by default, returned and set by
  //   owner-only api".
  //
  // RAM ONLY, AND THAT IS A FAIL-SAFE RATHER THAN A LIMITATION. A restart is
  // the off switch, nothing on disc can leave it on for a box nobody is
  // watching, and it cannot be set before boot. It is also why relayConfig's
  // rule survives: configuration is not changed while the relay runs, and
  // DEBUG is not configuration.
  //
  // NOT CLEARED WHEN THE OWNER LEAVES, deliberately, unlike `monitoring`
  // below. Monitoring stops because there is nobody to send to; DEBUG only
  // decides what a row CARRIES, and monitorEvent already refuses when the
  // owner is absent — so nothing leaks while the owner is away, and a
  // connection that blips does not silently disarm the instrument the owner
  // is in the middle of using on a sick box.
  //
  // wsl-claude, challenging this and arriving at a better reason for it:
  // PRESENCE FLICKERS DURING EXACTLY THE FAULT BEING DIAGNOSED, so clearing
  // on absence would disarm the instrument on its own symptom.
  //
  // AND WHAT MAKES NOT CLEARING SAFE IS `held` ITSELF, which is why this
  // paragraph is here rather than in a commit message: a row populated with
  // the carried bytes ANNOUNCES the instrument, on every event, to the only
  // party who can see it. An owner cannot leave DEBUG on for weeks without
  // noticing. So anyone who later adds a quiet mode, or drops `held` from the
  // row, removes that safety WITHOUT TOUCHING THIS SWITCH — and would then
  // have to give the switch back its own timeout or clear-on-absence.
  // The switch itself is the kernel's DEBUG (desk/G2.5), off at every start.

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
    if (!ownerKey || !presentNow.isPresent(ownerKey)) return false;
    var row = {
      at: new Date().toISOString(),
      kind: kind,
      from: from || '',
      to: to || '',
    };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });

    // ── DEBUG CHANGES A VALUE AND NEVER THE FIELD SET ─────────────────
    //
    // wsl-claude's first recommendation, made mechanical: if DEBUG decided
    // WHICH FIELDS EXIST, every later assertion would add one and the flag
    // would be fifty switches in a year — Andy's "it becomes untestable when
    // 50 places think it is easy enough to do inline", inside the relay.
    //
    // So `held` is ALWAYS on the row. Empty unless DEBUG is on, and then a
    // BYTE-FOR-BYTE copy of the string this relay is carrying — Andy: "it may
    // only send byte-for-byte copies of observed items to the owner." Nothing
    // is re-parsed or re-stringified on the way: a round trip would reorder
    // keys, and then a test could only assert "contains", which cannot tell a
    // copy from a truncation.
    //
    // ── AND IT SPENT ONE COMMIT IN THE WRONG FUNCTION ─────────────────
    //
    // It landed in `ownerEvent` instead, whose callers are claim and revoke
    // notices carrying no payload — so the gate was unreachable and the three
    // post sites' `held` went onto every monitor row VERBATIM, DEBUG or not.
    // Not a confidentiality breach: owner-only, monitoring-gated, and sealed.
    // But the instrument did not instrument, and "off by default" was false of
    // the behaviour while being true of the verb.
    //
    // THE CAUSE IS WORTH MORE THAN THE FIX. Both functions contain the line
    // above, character for character, and a replace-first put the gate under
    // the first one. The same mistake put a prose fix on an unused copy of a
    // renderer earlier the same day. A file with two identical lines has two
    // places a change can land, and the diff looks right from either.
    //
    // Found by wsl-claude, whose relayCannotRead.js caught it as its CONTROL
    // rather than as an assertion — C3, "DEBUG off means no payload".
    row.held = require('./kernel').core.util.debug() && extra && typeof extra.held === 'string' ? extra.held : '';
    // THE FULL REPORT, EVERY TIME SOMETHING HAPPENS (cycle 8). Andy: the
    // owner "receives also the full stat package whenever events occur" —
    // and no coalescing: "if the relay can handle 500 near-simultaneous
    // connects, AND broadcast them … the owner certainly can handle the
    // incoming updates." A report is counts, not lists, about a kilobyte.
    var sent = !!presentNow.send(ownerKey, 'relay-event', row);
    statusToOwner();
    return sent;
  }

  function statusToOwner() {
    if (!ownerKey) return false;
    if (!presentNow.isPresent(ownerKey)) return false;

    var mem = {};
    try { mem = process.memoryUsage(); } catch (e) { mem = {}; }
    var snap = snapshot();

    return !!presentNow.send(ownerKey, 'relay-status', relayStatus.report({
      snapshot: snap,
      // THE SEATS, handed to the report by name (goal/G16.9). The snapshot
      // has carried them since they were built, but relayStatus reads
      // `seats` off its own argument, so the owner's live report never had
      // them: the one number that says the relay is full did not arrive.
      // Absent, as in the snapshot, on a relay with no configuration.
      seats: snap.seats,
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
      // not built. One budget, the members' (the partner budget went with
      // partnering, goal/G22.6).
      caps: { memberPerMin: MEMBER_PER_MIN },
      // THE BOUND THE OWNER CONFIGURED, and the gauges fixed inside it at
      // boot (cycle 8 — the Governor that moved them is gone). Absent on a
      // relay with no configuration.
      ramLimitMB: config ? config.ramLimitMB : undefined,
      // AND THE DISC BOUND BESIDE IT (cycle 9), with which of the two the
      // next member will meet. An owner told only "256 MB of RAM" cannot
      // tell whether the box will refuse the next claim for space or the
      // next connection for memory.
      //
      // `binding` is decided here, where both figures are known: disc
      // once the roll is within a tenth of its limit — that is the one
      // that refuses people outright — otherwise RAM, which only refuses
      // connections.
      discLimitMB: discLimit.limitMB() === null ? undefined : discLimit.limitMB(),
      discUsedMB: discLimit.limitMB() === null ? undefined
        : Math.round((discLimit.usedBytes() / (1024 * 1024)) * 100) / 100,
      binding: (function () {
        if (discLimit.limitMB() === null) return undefined;
        var room = discLimit.limitMB() * 1024 * 1024 - discLimit.usedBytes();
        return room <= discLimit.limitMB() * 1024 * 1024 * 0.1 ? 'disc' : 'ram';
      }()),
      // EVERY GAUGE, KEYED BY ITS OWN LABEL — never a list the app has to
      // know the order of, and never one named in the app's code. Sent
      // under `levers`, the name the owner's monitor already draws.
      levers: gauges ? Object.keys(gauges).reduce(function (o, k) { o[k] = gauges[k].readOut(); return o; }, {}) : undefined,
      // WHAT IT HOLDS, IN PARTS (goal/G30.15).
      capacity: capacity(),
      // WHEN THIS WAS TAKEN. Without it a stale view reads as a live one:
      // a setting applied while the owner's stream was down is not seen
      // until the next report, and "as of 14:02" is the difference
      // between a monitor that is behind and a monitor that is wrong.
      at: new Date().toISOString(),
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

  // ── streamRoster STOOD HERE — THE WHOLE ROLL, TO EVERY MEMBER ─────────
  //
  //   Andy: "why on earth is a streamRoster required?" — "the whole design
  //   implies clearly that access to member rolls is facilitated by search
  //   only."
  //
  // Deleted in cycle 3. It sent every member the whole membership on every
  // connect — a served member list, which 0012 (widened) forbids to anybody
  // by request or by broadcast, and past PAYLOAD_MAX at ~190 members (0013).
  // Nothing needed it: the relay refuses an absent target itself (0006,
  // `503 peer not reachable`), a node learns presence from the `presence`
  // broadcasts and filters them by its own contacts, and the relay's own key
  // is pinned (relayKeys) from its card ask. A roll is reached by key
  // or by search, never as a list.

  // The gate. Order is load-bearing at every step.
  function streamOpen(token, sig, sink) {
    // 1. Unknown identity first, before any bucket and before any crypto.
    //    B1's rule: a registry keyed by caller-chosen input grows when a
    //    stranger reaches it, so a stranger must not reach it. A stranger
    //    holds no stream: what it asks is answered on its own post
    //    (goal/G22.6).
    var who_ = senderIdentity(token);
    if (!who_) return { ok: false, status: 403, error: 'your id is not a valid sender here' };

    // 2. The signature, against THAT identity's own row key. Never the
    //    owner's house key — owning the relay is not owning a row — and
    //    never a device key, for the reason deviceGate gives: a borrowed
    //    phone must not open the wire its owner is on.
    //    Over THIS relay's own key (goal/G16.12): a header signed for
    //    another relay is refused before anything is evicted.
    if (!auth.streamSignatureOk(who_.publicKey, who_.id, relayPublicKey(), sig)) {
      return { ok: false, status: 403, error: 'bad stream signature' };
    }

    // 3. AUTHENTICATE, THEN TOSS. connect() evicts any live connection
    //    for this identity, so it must be unreachable until the caller
    //    has proved they are that identity — otherwise anybody could
    //    knock any peer offline by connecting badly in their name.
    //
    //    THE OWNER IS THE FLOOR OF THE ALLOWANCE (cycle 1): admitted
    //    whatever the count, so the monitor never goes blind under the
    //    load worth watching. Everyone else is measured against it and
    //    refused with 503 when the relay is full.
    var opened = presentNow.connect(who_.id, sink, who_.id === currentOwnerKey());
    if (!opened.ok) return opened;
    // An active member's row is held in RAM while the stream is open.
    rememberActive(who_.id);

    // 4. The fact that this one arrived. (The roster that went first, the
    //    whole roll to the newcomer, was deleted in cycle 3 — see above.)
    presentNow.broadcast('presence', { key: who_.id, present: true });

    // 5. And the owner learns what its box now looks like. Sent after the
    //    roster so an owner opening its own stream gets the membership
    //    first and the condition second, and sent on every arrival
    //    because "who is connected" is half of what the report says.
    //    Silent when the owner is not here — see statusToOwner.
    statusToOwner();
    return { ok: true, status: 200, id: who_.id, label: who_.label };
  }

  function currentOwnerKey() {
    return ownerKey || '';
  }

  // `governorTick` STOOD HERE (cycle 1): read the heap, let the Governor
  // move the allowance, close the idlest streams, tell the owner. Deleted
  // in cycle 8 — the allowance is fixed at boot, and the owner hears on
  // every event instead of on a timer (ownerEvent, below).

  // ── A READER THAT STOPPED READING, AND THE ROUTES IT LEAVES (R35) ────
  //
  //   Andy: "this needs only documenting, and checking if a pending
  //   foreign request is still pending, so that one can be returned with
  //   an error" — "and vice versa".
  //
  // ONLY FOR THE CUT, NOT FOR EVERY CLOSE. A member whose stream simply
  // dropped may still hold a request it read, and answer it by POST —
  // /reply needs no stream — so failing its routes on close would beat a
  // real answer with a false error. A member cut for not reading never
  // read what was sent: those bytes died in the buffer that was
  // destroyed, and no answer can come.
  //
  // WHERE IT WAS ASKED, the asker is told now rather than at its
  // deadline, in whichever way that asker waits: a stranger on its own
  // held post, and a member holding a stream by a reply signed by this relay.
  // `peer not reachable` is the word, and it is literally true from this
  // moment — they are absent. The REASON goes to the owner's monitor and
  // not onto the wire: the asker can do nothing different about a peer
  // who stopped reading than about one who left.
  //
  // WHERE IT ASKED, the route is simply gone. Nobody is waiting on this
  // side any more, so a late answer from its target now meets `no such
  // request` rather than being pushed into a stream that is not there.
  function failRoutesOf(id) {
    var why = 'stopped reading';
    routes.release(id).forEach(function (r) {
      if (r.as === 'requester') {
        monitorEvent('refused', id, r.target, { why: why, hash: r.hash, as: 'requester' });
        return;
      }
      // Asking yourself leaves nobody to tell.
      if (r.requester === id) return;
      monitorEvent('refused', r.requester, id, { why: why, hash: r.hash });
      var refusal = { ok: false, status: 503, error: 'peer not reachable' };
      if (r.carry && typeof r.carry.answer === 'function') {
        r.carry.answer(refusal);
      } else {
        replyAsRelay(r.hash, r.requester, 503, 'peer not reachable');
      }
    });
  }

  // Idempotent, because both `close` and `error` fire on a dying socket
  // and both call this. The broadcast happens only if this sink was
  // actually the live one — a teardown arriving after the same identity
  // reconnected must not announce an absence that is not true.
  //
  // `why` is 'stalled' when the stream was cut because its reader had
  // stopped reading (R35, streamSink.js), and absent for every other
  // close. Only the cut settles the routes: see failRoutesOf.
  function streamClose(token, sink, why) {
    // THE SAME IDENTITIES streamOpen ADMITS — members and the owner.
    var who_ = senderIdentity(token);
    if (!who_) return false;
    if (!presentNow.disconnect(who_.id, sink)) return false;
    forgetActive(who_.id);
    if (why === 'stalled') failRoutesOf(who_.id);

    // A MONITOR DIES WITH THE STREAM IT WAS WATCHING ON. A browser that
    // crashed must not leave this relay pushing into nothing, and a timer
    // to notice would be a second thing to get wrong: the socket closing
    // IS the notice.
    if (monitoring && ownerKey && who_.id === ownerKey) monitoring = false;

    presentNow.broadcast('presence', { key: who_.id, present: false });
    // Somebody leaving changes the report as much as somebody arriving.
    // A no-op when the leaver IS the owner, which is correct: there is
    // nobody left to tell.
    statusToOwner();
    return true;
  }

  // ── A NODE JOINS BY ITS USER'S EMAIL (goal/G30.2, "Onboarding a node onto a relay") ──────────────
  //
  // Andy's design, 2026-10-19: the node sends a signed join request, the email and its port, its key the signer;
  // the relay mails a link to the user's own node, http://127.0.0.1:<port>?join=<code>; the node sends the code
  // back under the same key, and a right code within 10 minutes takes the seat at once. Only the key that asked can
  // finish, so a code is worth nothing to anyone else. join and joinConfirm are the two door posts for it, accepted
  // by Andy; this is what they call, as claim is for a claim.
  //
  // KEPT IN MEMORY, 10 minutes: the pending join (email, port, a hash of the code, the card it came with). Nothing
  // of it reaches the disc, and the email is never published: the seat's public label is the part before the @.
  var JOIN_MS = 10 * 60 * 1000;
  var JOIN_GAP_MS = 60 * 1000;
  var JOIN_PER_HOUR = 5;
  var pendingJoins = new Map();      // publicKey -> { email, port, hash, until, card }
  var joinAsks = new Map();          // 'key:<k>' or 'mail:<address>' -> [times]
  var sendMail = typeof deps.sendMail === 'function' ? deps.sendMail : null;
  function joinHash(code) { return require('crypto').createHash('sha256').update(String(code)).digest('hex'); }
  function joinCapped(what) {
    var t = clock();
    var times = (joinAsks.get(what) || []).filter(function (x) { return t - x < 60 * 60 * 1000; });
    if ((times.length && t - times[times.length - 1] < JOIN_GAP_MS) || times.length >= JOIN_PER_HOUR) { joinAsks.set(what, times); return true; }
    times.push(t);
    joinAsks.set(what, times);
    return false;
  }
  function joinSweep() {
    var t = clock();
    pendingJoins.forEach(function (p, k) { if (p.until < t) pendingJoins.delete(k); });
    joinAsks.forEach(function (times, k) { if (!times.some(function (x) { return t - x < 60 * 60 * 1000; })) joinAsks.delete(k); });
  }
  // The public label a join seats under: the email's part before the @, made to fit the label rule.
  function labelFromEmail(email) {
    var local = normalizeName(String(email || '').split('@')[0]).slice(0, 32);
    return local && !labelProblem(local) ? local : 'member';
  }
  function join(publicKey, email, port, card) {
    joinSweep();
    var key = String(publicKey || '');
    var mail = String(email == null ? '' : email).trim().toLowerCase();
    var p = Number(port);
    if (!key) return { ok: false, status: 400, error: 'a join needs the key that asks' };
    if (Buffer.byteLength(mail, 'utf8') > 254 || !/^[^\s@]+@[^\s@]+$/.test(mail)) return { ok: false, status: 400, error: 'an email is one address with an @' };
    if (!(p >= 1 && p <= 65535 && Math.floor(p) === p)) return { ok: false, status: 400, error: 'a join needs the port of the node' };
    // A SEATED KEY JOINING AGAIN CHANGES ITS EMAIL (goal/G30.1, box v28): the same mail, link and code, 10 minutes
    // and caps; it takes no seat, so a full relay does not refuse it.
    if (!findByKey(key) && seats.fullForMembers()) return seatsFull();
    if (!sendMail) return { ok: false, status: 503, error: 'this relay sends no mail, so it takes no join' };
    if (joinCapped('key:' + key) || joinCapped('mail:' + mail)) return { ok: false, status: 429, error: 'a join was asked a moment ago; wait a minute' };
    var code = require('crypto').randomBytes(24).toString('base64url');
    pendingJoins.set(key, { email: mail, port: p, hash: joinHash(code), until: clock() + JOIN_MS, card: typeof card === 'string' ? card : '' });
    Promise.resolve(sendMail({
      to: mail,
      // A seated key is changing its email, not joining (goal/G30.1, box v31).
      subject: findByKey(key) ? 'Confirm your email address' : 'Join this relay',
      text: 'Open this link on the computer where SpiritOS runs, within 10 minutes:\n\nhttp://127.0.0.1:' + p + '?join=' + code + '&app=join\n\nIt counts once.',
    })).catch(function () { /* the pending join lapses on its own */ });
    return { ok: true, status: 200 };
  }
  function joinConfirm(publicKey, code, card) {
    joinSweep();
    var key = String(publicKey || '');
    var p = pendingJoins.get(key);
    if (!p || p.until < clock() || !code || joinHash(code) !== p.hash) return { ok: false, status: 403, error: 'no join waits for that code under this key' };
    pendingJoins.delete(key);
    // THE CODE PROVES THE ADDRESS (goal/G30.1, box v28): only now is it written on the member's row, verified; until
    // then the old email stood. A seated key keeps its seat and its label; a new key is seated as a join seats it.
    var out = findByKey(key)
      ? { ok: true, status: 200 }
      : claim(labelFromEmail(p.email), '', key, '', '', '', typeof card === 'string' && card ? card : p.card, true);
    if (!out || !out.ok) return out;
    store.members.setEmail(key, p.email);
    refreshActive(key);
    out.peer = findByKey(key);
    out.email = p.email;
    out.emailVerified = true;
    return out;
  }

  // ── A MEMBER'S FACE, AND LOGGING IN ON IT (goal/G30.9) ───────────────
  //
  // The relay serves <face>.<its domain> to anyone while that member has a verified email, a face name and his home
  // node present (its stream open); logged out the page is the empty face shell with its login app. The relay decides
  // the login (Andy, 2026-10-21: "the relay decides, it has all the info it needs"): one field takes the member's
  // verified email, which gets a mail with a token and a link, or the token itself, which logs in once within 10
  // minutes. Anything else gets the email's answer, so the page never says which it got. A login is a session in this
  // relay's memory, valid until 7 days after the last interaction ("the login expires after it is idle for 7 days");
  // Log out ends it. NOT ON DISC: a stored shape would be new, so a relay restart logs faces out.
  //
  // THE DOMAIN is the owner's to say, in relay-state/face.json {domain}, placed as mail.json is (bash/face-setup
  // writes it). Without it the relay serves no face.
  var FACE_TOKEN_MS = 10 * 60 * 1000;
  var FACE_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
  var faceDomain = (function () {
    try {
      var f = JSON.parse(fs.readFileSync(path.join(rootDir, 'relay-state', 'face.json'), 'utf8'));
      return String((f && f.domain) || '').trim().toLowerCase().replace(/\.$/, '');
    } catch (e) { return ''; }
  }());
  var faceTokens = new Map();    // face name -> { hash, until }: the one token a login mail carries
  var faceSessions = new Map();  // session id -> { name, until }
  function faceSweep() {
    var t = clock();
    faceTokens.forEach(function (v, k) { if (v.until < t) faceTokens.delete(k); });
    faceSessions.forEach(function (v, k) { if (v.until < t) faceSessions.delete(k); });
  }
  // The member a face name belongs to, when he has a verified email.
  function faceMember(name) {
    var m = store.members.byFace(String(name || '').toLowerCase());
    return m && m.emailVerified && m.email ? m : null;
  }
  // The face a host asks for, when this relay serves it now.
  function faceAt(host) {
    // `face` says whether the host is a face name at all: anything else is the relay's own door.
    if (!faceDomain) return { ok: false, face: false, status: 404, error: 'this relay serves no faces' };
    var name = faceRoute.nameOf(String(host || '').toLowerCase().replace(/:\d+$/, ''), faceDomain);
    if (!name) return { ok: false, face: false, status: 404, error: 'not a face' };
    var m = faceMember(name);
    if (!m) return { ok: false, face: true, status: 404, error: 'no such face' };
    if (!activeRows[m.publicKey]) return { ok: false, face: true, status: 503, error: 'this face\'s node is not present' };
    return { ok: true, face: true, status: 200, name: name };
  }
  function faceLogin(name, text) {
    faceSweep();
    var n = String(name || '').toLowerCase();
    var t = String(text == null ? '' : text).trim();
    var neutral = { ok: true, status: 200, loggedIn: false };
    var m = faceMember(n);
    if (!m) return neutral;
    var tok = faceTokens.get(n);
    if (tok && t && joinHash(t) === tok.hash) {
      faceTokens.delete(n);
      var sid = require('crypto').randomBytes(24).toString('base64url');
      var fresh = { name: n, until: clock() + FACE_IDLE_MS, written: 0 };
      faceSessions.set(sid, fresh);
      keepLogin(sid, fresh);
      return { ok: true, status: 200, loggedIn: true, session: sid, name: n };
    }
    // The member's own email: a mail with the token and the link, within the join's caps (one a minute, five an hour).
    if (sendMail && t.toLowerCase() === String(m.email).toLowerCase() && !joinCapped('face:' + n)) {
      var code = require('crypto').randomBytes(24).toString('base64url');
      faceTokens.set(n, { hash: joinHash(code), until: clock() + FACE_TOKEN_MS });
      var link = 'https://' + n + '.' + faceDomain + '/?' + code;
      Promise.resolve(sendMail({
        to: m.email,
        subject: 'Log in to your face',
        text: 'To log in, paste this token into the Log in field:\n\n' + code + '\n\nor open this link:\n\n' + link + '\n\nIt counts once, within 10 minutes.',
      })).catch(function () { /* the token lapses on its own */ });
    }
    return neutral;
  }
  // ── A FACE LOGIN KEPT ON THE MEMBER'S ROW (goal/G30.15) ──────────────
  //
  // Andy: "why would the relay not stash my login on my member-row?", "save the cookie 1. after login 2. after
  // re-connect 3. every day", "delete it on logoff/logout", and one login per device. The memory map stays the working
  // copy; the row holds the cookie's hash and its idle deadline (relayStore faceLogins), so a restarted relay finds a
  // login it has never seen in memory and the face's own 5-second retry brings it back.
  var FACE_LOGINS_MAX = 8;                    // devices per member; the oldest goes when a ninth logs in
  var FACE_WRITE_MS = 24 * 60 * 60 * 1000;    // "every day"
  function keepLogin(sid, s) {
    var m = s && faceMember(s.name);
    if (!m) return;
    var h = joinHash(sid);
    var t = clock();
    try {
      var list = store.members.faceLogins(m.publicKey).filter(function (l) { return l && l.hash !== h && l.until > t; });
      list.push({ hash: h, until: s.until });
      if (list.length > FACE_LOGINS_MAX) list = list.slice(list.length - FACE_LOGINS_MAX);
      store.members.setFaceLogins(m.publicKey, list);
      s.written = t;
    } catch (e) { /* the memory copy still holds it until a restart */ }
  }
  function dropLogin(sid, publicKey) {
    var h = joinHash(sid);
    try {
      store.members.setFaceLogins(publicKey, store.members.faceLogins(publicKey).filter(function (l) { return l && l.hash !== h; }));
    } catch (e) { /* it ends at its deadline anyway */ }
  }
  // A login this relay has no memory of: found on its member's row, if still within its deadline.
  function recallLogin(sid) {
    var h = joinHash(sid);
    var m = null;
    try { m = store.members.byFaceLogin(h); } catch (e) { m = null; }
    if (!m || !m.faceName) return null;
    var kept = store.members.faceLogins(m.publicKey).filter(function (l) { return l && l.hash === h; })[0];
    if (!kept || !(kept.until > clock())) { dropLogin(sid, m.publicKey); return null; }
    var s = { name: m.faceName, until: clock() + FACE_IDLE_MS, written: 0 };
    faceSessions.set(sid, s);
    keepLogin(sid, s);    // a reconnect after a restart writes the new deadline
    return s;
  }
  // A session, moved to 7 days from now by this interaction; gone after 7 days idle. Written to the row once a day.
  function faceSession(sid) {
    faceSweep();
    var id = String(sid || '');
    var s = faceSessions.get(id) || (id ? recallLogin(id) : null);
    if (!s) return { ok: false, status: 401, error: 'not logged in' };
    s.until = clock() + FACE_IDLE_MS;
    if (clock() - (s.written || 0) >= FACE_WRITE_MS) keepLogin(id, s);
    return { ok: true, status: 200, name: s.name };
  }
  function faceLogout(sid) {
    var id = String(sid || '');
    var s = faceSessions.get(id);
    var m = s ? faceMember(s.name) : null;
    if (!m) { try { m = store.members.byFaceLogin(joinHash(id)); } catch (e) { m = null; } }
    if (m) dropLogin(id, m.publicKey);
    faceSessions.delete(id);
    return { ok: true, status: 200 };
  }

  // ── THE FACE REACHES ITS HOME NODE (goal/G30.14) ─────────────────────
  //
  // Two relay additions, each approved by Andy (2026-10-21):
  //   - A FACE REQUEST IS A STREAM EVENT: the logged-in face's request goes into the member's stream as a 'face' event
  //     { id, request }, with no route and no in-flight slot; the face's response waits for the answer.
  //   - faceStream: node-internal, the owner's node to the owner's face, this relay only shovelling bytes. The home
  //     node answers a request by an upload signed for its id (relayAuth.faceSignatureOk), which is piped straight into
  //     the waiting response as it arrives; the live updates are one long upload, piped into the face's own stream.
  //     Not a peerPost: no post limit and no size cap, nothing held whole here. The relay neither seals nor opens it.
  // A request the home node never answers is ended with 504 after FACE_CALL_MS.
  var FACE_CALL_MS = 30 * 1000;
  var faceCalls = new Map();    // request id -> { key, sink, timer }: the face responses waiting for their answer
  var faceStreams = new Map();  // member key -> { sink, sid, source }: the face's open stream, its login, the feed into it
  var faceFeeds = new Map();    // member key -> the home node's open feed upload, counted in the ceiling (goal/G30.15)
  // The member a login belongs to, its session moved on by this interaction.
  function faceOwner(sid) {
    var s = faceSession(sid);
    return s.ok ? faceMember(s.name) : null;
  }
  function faceCall(sid, request, sink) {
    var m = faceOwner(sid);
    if (!m) return { ok: false, status: 401, error: 'not logged in' };
    if (!activeRows[m.publicKey]) return { ok: false, status: 503, error: 'this face\'s node is not present' };
    var id = require('crypto').randomBytes(12).toString('base64url');
    var timer = setTimeout(function () {
      var c = faceCalls.get(id);
      if (!c) return;
      faceCalls.delete(id);
      try { c.sink.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' }); c.sink.end('the home node did not answer'); } catch (e) { /* the face went */ }
    }, FACE_CALL_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
    faceCalls.set(id, { key: m.publicKey, sink: sink, timer: timer });
    presentNow.send(m.publicKey, 'face', { id: id, request: request == null ? null : request });
    return { ok: true, status: 202, id: id };
  }
  // The home node's answer to one face request: signed for this relay and that id, piped whole into the response.
  function faceAnswer(key, id, sig, source, meta) {
    var k = String(key || '');
    var rid = String(id || '');
    if (!findByKey(k) || !auth.faceSignatureOk(k, k, relayPublicKey(), rid, sig)) return { ok: false, status: 403, error: 'bad face signature' };
    var c = faceCalls.get(rid);
    if (!c || c.key !== k) return { ok: false, status: 404, error: 'no face request with that id' };
    faceCalls.delete(rid);
    clearTimeout(c.timer);
    var m = meta || {};
    c.sink.writeHead(Number(m.status) || 200, { 'Content-Type': String(m.type || 'application/octet-stream'), 'Cache-Control': 'no-store' });
    source.pipe(c.sink);
    return { ok: true, status: 200 };
  }
  // The face's own stream, by its login. The home node hears face-open, and face-close when it ends.
  //
  // ONE FACE STREAM PER MEMBER (goal/G30.12, Andy's box): the same login reconnecting (a reload, a dropped network)
  // replaces its own stream without a word; another login, another device, is refused with the warning until its
  // Connect here press (opts.here), which moves the stream: the face it replaced gets a last line, taken, and ends.
  // Either way the home node hears face-open again and feeds the new stream; its old upload is cut from the old one.
  // A new face stream counts in the one stream allowance (presence.js, others), so a full relay refuses it 503.
  function faceOpen(sid, sink, opts) {
    var m = faceOwner(sid);
    if (!m) return { ok: false, status: 401, error: 'not logged in' };
    // A reconnect writes the login's deadline to the row (goal/G30.15, "after re-connect").
    var kept = faceSessions.get(String(sid || ''));
    if (kept) keepLogin(String(sid || ''), kept);
    if (!activeRows[m.publicKey]) return { ok: false, status: 503, error: 'this face\'s node is not present' };
    var key = m.publicKey;
    var s = String(sid || '');
    var before = faceStreams.get(key);
    if (before && before.sid !== s && !(opts && opts.here)) {
      return { ok: false, status: 409, code: 'face-elsewhere', error: 'your face is open on another device; connecting here ends it there' };
    }
    if (!before && presentNow.full()) return { ok: false, status: 503, full: true, error: 'this relay is full' };
    var entry = { sink: sink, sid: s, source: null };
    faceStreams.set(key, entry);
    if (before && before.sink !== sink) {
      if (before.source) { try { before.source.unpipe(before.sink); } catch (e) { /* gone */ } }
      try {
        if (before.sid !== s) before.sink.write(JSON.stringify({ event: 'taken', data: {} }) + '\n');
        before.sink.end();
      } catch (e) { /* gone */ }
    }
    sink.on('close', function () {
      if (faceStreams.get(key) !== entry) return;
      faceStreams.delete(key);
      if (entry.source) { try { entry.source.unpipe(sink); } catch (e) { /* gone */ } }
      presentNow.send(key, 'face-close', {});
    });
    // The face's sealing key, when it has one (goal/G30.11): the home node seals this stream to it.
    presentNow.send(key, 'face-open', { key: String((opts && opts.key) || '') });
    return { ok: true, status: 200 };
  }
  // The home node's long upload of the face's live updates, piped into the face's open stream as it arrives. A new
  // upload takes the place of the one before it.
  function faceFeed(key, sig, source) {
    var k = String(key || '');
    if (!findByKey(k) || !auth.faceSignatureOk(k, k, relayPublicKey(), 'stream', sig)) return { ok: false, status: 403, error: 'bad face signature' };
    var entry = faceStreams.get(k);
    if (!entry) return { ok: false, status: 409, error: 'no face is open' };
    if (entry.source && entry.source !== source) { try { entry.source.unpipe(entry.sink); } catch (e) { /* gone */ } }
    entry.source = source;
    // Counted in the one stream ceiling while it is open (goal/G30.15), one per member: a new upload replaces the last.
    faceFeeds.set(k, source);
    var gone = function () { if (faceFeeds.get(k) === source) faceFeeds.delete(k); };
    if (typeof source.on === 'function') { source.on('close', gone); source.on('end', gone); }
    source.pipe(entry.sink, { end: false });
    return { ok: true, status: 200 };
  }

  // WHAT THE RELAY HOLDS, IN PARTS (goal/G30.15): the owner's RAM, the relay's own memory at rest, the streams it holds
  // by kind and what they cost at 16 a megabyte, the RAM still free, and the members it serves at three streams a seat.
  function capacity() {
    var nodes = presentNow.present().length;
    var faces = faceStreams.size;
    var feeds = faceFeeds.size;
    var streamKB = Math.round(1024 / STREAMS_PER_MB);
    var ram = config ? Number(config.ramLimitMB) : null;
    var usedMB = Math.round((atRestMB + (nodes + faces + feeds) * streamKB / 1024) * 10) / 10;
    return {
      ramLimitMB: ram,
      atRestMB: atRestMB,
      streamKB: streamKB,
      streams: { nodes: nodes, faces: faces, feeds: feeds },
      usedMB: usedMB,
      freeMB: ram === null ? null : Math.round((ram - usedMB) * 10) / 10,
      seatStreams: SEAT_STREAMS,
      members: seats.members(),
      membersPerMB: Math.round(STREAMS_PER_MB / SEAT_STREAMS * 10) / 10,
    };
  }

  return {
    // The face (goal/G30.9): which face a host is, the one-field login, the session and Log out.
    faceAt: faceAt,
    faceLogin: faceLogin,
    faceSession: faceSession,
    faceLogout: faceLogout,
    // The face reaches its home node (goal/G30.14): a request as a stream event, the answers and the live updates
    // piped from the home node's uploads.
    faceCall: faceCall,
    faceAnswer: faceAnswer,
    faceOpen: faceOpen,
    faceFeed: faceFeed,
    // goal/G30.15: the relay's memory at rest, set by relayServer at the end of boot, and what it holds in parts.
    atRest: atRest,
    capacity: capacity,
    // The owner's config verb, as their post reaches it (goal/G30.15: exported so it can be driven in-process).
    reconfigure: reconfigure,
    claim: claim,
    forgetPeer: forgetPeer,
    join: join,
    joinConfirm: joinConfirm,
    // The card a card ask is answered with (goal/G30.2: its services read in-process by the suites).
    relayCard: relayCard,
    // Where this relay keeps its data. In-process only, for the suites that
    // inspect the roll on disc (test/rollOf.js) — nothing on the wire reads
    // it, and there is no whole-roll read on the relay itself (cycle 3).
    rootDir: function () { return rootDir; },
    relayPublicKey: relayPublicKey,
    // What posts to this box are sealed to, and the signature over both
    // keys and the label together (cycle 10, R9). Signed as one statement
    // because a signature over the cipher key alone could be lifted onto
    // another relay's answer.
    relaySealKey: relaySealKey,
    relayKeyStatement: relayKeyStatement,
    // The other half of the pair. Read by server.js for the public
    // roll; set through the `relayLabel` verb in answerSelf.
    relayLabel: relayLabel,
    // Who runs this box — key and label, part of the relay's card (the
    // answer to a card ask on the one door, goal/G22.6).
    ownerPublic: ownerPublic,
    // Exported for the suite that drives it directly (ownerLog). The
    // browser reaches it through the `relayLabel` verb, like any peer.
    setRelayLabel: setRelayLabel,
    // The partner roll (partners, setPartner, clearPartner) stood here,
    // removed with partnering (goal/G22.6).
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
    // The fixed connection allowance (cycle 8), for the suites that check
    // it was set from the owner's RAM and nothing else.
    allowance: function () { return allowance; },
    // Watching, on demand — asked for as a packet (answerSelf), never as
    // a verb of its own. Read-only from out here, and it dies with the
    // owner's stream.
    monitoring: function () { return monitoring; },
    monitorFilter: function () { return monitorFilter; },
    // The presence wire. streamOpen is the gated entry a route may call;
    // the registry below is in-process and ungated, for tests that drive
    // it directly.
    routePost: routePost,
    routeReply: routeReply,
    routes: routes,
    streamOpen: streamOpen,
    streamClose: streamClose,
    presence: presentNow,
    // WHAT THE RING MAY BE SHRUNK TO. Exposed so the governor has one
    // place to ask rather than three constants to respect, and so a suite
    // can check the floor without driving a box out of memory.
    meterFloor: meterFloor,
    // The byte budget a search answer is cut to. Exposed so a suite can
    // drive the cut rather than recompute it — the number and the rule
    // have to be the same ones the wire gets.
    matchBudget: function () { return MATCH_BUDGET; },
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

// goal/G33.5 (box v11, Andy's choice): the admission rule is exported as it is, so the generated documentation states
// what this relay admits and can never drift from it. Nothing about its behaviour changes.
module.exports = { createRelay: createRelay, streamSignatureFrom: streamSignatureFrom,
  allowanceFor: allowanceFor, SEAT_STREAMS: SEAT_STREAMS, STREAMS_PER_MB: STREAMS_PER_MB };
