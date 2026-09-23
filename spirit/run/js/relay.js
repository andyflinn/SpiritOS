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
// The relay's data on disc (cycle 3): members, invites, partners.
const relayStore = require('./relayStore');
// The same validation the file gets at boot, so the owner's `config` verb
// (reconfigure) cannot accept a figure a restart would then refuse.
const relayConfig = require('./relayConfig');
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
var lever = require('./lever');

// ── HOW MANY STREAMS THE OWNER'S RAM ALLOWS (cycle 8) ────────────────────
//
// The Governor's ceiling, kept as the whole rule now that nothing moves it:
// streams per megabyte of the RAM the owner configured. 16 was declared as
// a placeholder in cycle 1; R15 then measured ~58-63 KB a stream on Windows
// and ~42 KB on Linux in the process alone, i.e. 16-24 a megabyte — so 16
// holds, on the careful side, and README/CAPACITY.md is where it is argued.
var STREAMS_PER_MB = 16;

function allowanceFor(ramLimitMB) {
  var mb = Number(ramLimitMB);
  if (!(mb > 0)) return null;
  return Math.max(1, Math.floor(mb * STREAMS_PER_MB));
}

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

// ── THE ROLL IS ON DISC (cycle 3) ─────────────────────────────────────
//
//   Andy: "storage is actually moved from RAM to DISC, and RAM must become
//   a DISC-client."
//
// routingTable.json STOOD HERE — read whole at boot into a map, rewritten
// whole on every claim, rename and removal. The roll, the invites and the
// partner roll are tables in relay-state/relay.db now (relayStore.js), and
// every question about them is a query. A relay that still holds the old
// file imports it once and keeps it as routingTable.json.imported (D8, see
// design/DEPRECATIONS.md); its legacy handling (D1) went with the reader.
//
// Before that, mailbox.json was this file's name, and the read of the old
// name was deleted once spirit-3 had written the new one (2026-09-13). The
// same discipline holds: data on somebody's box is renamed and kept, never
// deleted by a boot.

// A HOP'S SHARE OF THE BUDGET, spent before the next hop sees it.
//
// What this relay hands a partner is what it was given, less enough to
// carry the partner's answer back to the member still waiting. Declared,
// not measured — like `HINTS_PER_POST`, and marked so nobody reads it as
// evidence. What must be true of it is only that it is greater than one
// return trip and small against the ceiling; 500 ms against 5 s is both.
//
// The consequence is the point: a partner is always given LESS than this
// relay has, so it finishes first, and this relay still has time to pass
// its answer on. Every hop inward is tighter, and no hop needs to know
// how deep it is.
var HOP_MARGIN_MS = 500;

// ── HOW LONG A PARTNER MAY BE QUIET AND STILL COUNT AS LIVE (R13) ────────
//
//   Grok (review): "N = 15 minutes. Quiet is normal. After 15 min still try
//   one post before you skip that partner for hints. Do not treat 'no
//   traffic' as dead at 2 minutes." Andy agreed (2026-09-22, cycle 8).
//
// Liveness used to be the partner's held stream. There is none now: a
// partner is live when it last ANSWERED within this window (R12's `last`),
// and a partner quiet for longer is still asked once — only a partner that
// has been quiet this long AND failed its one try since is skipped, and
// only until this long again has passed.
// Read from partnerAvailability.js, where the node reads it too (R42), so
// the relay's bench and a node's belief cannot drift apart.
var PARTNER_QUIET_MS = require('./partnerAvailability').QUIET_MS;

// `deps.askPartner(url, relayKey, text, budgetMs)` answers a promise of the partner's
// reply text, or null. INJECTED, never reached for: it is this relay's own
// peerPost over relayRequest, wired in server.js, which is the one
// interface everything speaks through (AGENT.md, Comms). A relay built
// without it simply does not propagate — which is every existing test, and
// is why they did not have to change.
function createRelay(rootDir, deps) {
  deps = deps || {};
  var askPartner = typeof deps.askPartner === 'function' ? deps.askPartner : null;
  // The clock partner liveness reads (R13), injectable so a suite can pass
  // fifteen minutes without waiting them.
  var clock = typeof deps.now === 'function' ? deps.now : Date.now;
  rootDir = rootDir || path.join(__dirname, '..');
  // THE ROLL, THE INVITES AND THE PARTNER ROLL — on disc, asked by query
  // (cycle 3, relayStore.js). Nothing of them is resident here.
  //
  // Fetched per use rather than held: open() is a cached lookup, so this
  // costs nothing, and a handle closed underneath the relay (a test
  // releasing the file to delete its directory) is simply reopened.
  var store = {
    get members() { return relayStore.open(rootDir).members; },
    get invites() { return relayStore.open(rootDir).invites; },
    get partners() { return relayStore.open(rootDir).partners; },
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
  //
  // ONE REQUEST MAY BE AIMED AT A MEMBER AT A TIME, and that number is
  // router.js's, not this file's and not the owner's. It was briefly read
  // from relay-state/config.json; a limit an owner can widen is not a
  // limit (2026-09-21), and it bounds what a PARTNER may aim at a member,
  // so it protects parties other than the owner.
  var routes = routerTable.createRouter();

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
  var allowance = config ? allowanceFor(config.ramLimitMB) : null;
  var gauges = allowance ? {
    connections1: lever.make('connections1', {
      floor: 1, ceiling: allowance, value: allowance, worseAt: 'floor',
    }),
  } : null;
  if (allowance) presentNow.setAllowed(allowance);

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
      usedBytes: used,
      full: function () { return limitBytes !== null && used() >= limitBytes; },
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
    if (reading) {
      var box = measure ? measure() : null;
      var room = box ? relayLimits.ceilings(box) : {};
      var onFile = relayConfig.asked(config);
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
      measure ? measure() : null
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
    // STRANDED BY RAM: the new allowance is fewer streams than there are
    // members, so somebody on the roll could never connect.
    var after = allowanceFor(checked.config.ramLimitMB);
    if (after !== null && held > after) {
      return {
        ok: false,
        status: 409,
        error: 'that RAM figure allows ' + after + ' connection(s) and this relay has ' + held +
          ' member(s), so ' + (held - after) + ' could never connect. Remove members first — ' +
          'nobody is evicted by a number.',
      };
    }

    var wrote = writeConfig(checked.config);
    if (!wrote) {
      return { ok: false, status: 500, error: 'could not write relay-state/config.json' };
    }

    var answer = {
      ok: true,
      status: 200,
      applies: 'next start',
      now: {
        ramLimitMB: config.ramLimitMB,
        discLimitMB: config.discLimitMB,
        allowance: allowance,
        members: held,
        discUsedMB: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
      },
      after: {
        ramLimitMB: checked.config.ramLimitMB,
        discLimitMB: checked.config.discLimitMB,
        allowance: after,
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
  // The router never needed it. `deviceIdentity` resolves a row by KEY,
  // which is what an address is on this wire, so the ambiguity a LABEL
  // creates cannot arise: two johns are two keys and always were. The
  // ring is what made labels addressable, and that is the half of the
  // old transport that is not worth rebuilding.

  // -- THE ROLL, OPTIONALLY NARROWED TO KEYS SOMEBODY NAMED ---------
  //
  //   Andy: "the most fetched because it bootstrapped concepts quickly,
  //   but is not scalable."
  //
  // Nine callers read this and six of them want one row. `peer.acquire` is
  // the sharpest: it pulls the whole roll -- 151 bytes a member, so
  // ~147 KB at a thousand -- to answer yes or no about ONE key.
  //
  // SAME DOOR, NARROWER ANSWER. Not a new route, so nothing is added to
  // 0010's register: a parameter that filters an existing response is not
  // a new way of speaking. And `key` on a query is explicitly allowed
  // there -- "it is the identity being asked for, not the permission to be
  // it" -- which is the distinction that keeps signatures off query
  // strings while letting this through.
  //
  // KEYS REQUIRED (cycle 3). Absent keys this used to answer the whole
  // roll, which is the member list 0012 (widened) forbids serving to
  // anybody — and, since the roll moved to disc, a whole-table read. Asked
  // without keys it now answers nothing. A count is store.members.count().
  function who(keys) {
    var wanted = (Array.isArray(keys) ? keys : []).map(function (k) {
      return String(k == null ? '' : k).trim();
    }).filter(Boolean);
    return store.members.byKeys(wanted).map(function (p) {
      return {
        // `name` STOOD BESIDE THIS, carrying the identical value. Two
        // spellings of one fact on a public route, so every reader had
        // to know which to trust and none could be told apart. Gone
        // 2026-09-15 — a roll row says a peer's label once.
        publicLabel: labelOf(p),
        publicKey: p.publicKey || null,
        // WHEN THIS KEY ENROLLED, published here all along with nothing
        // reading it. It is the human-usable way to tell two johns
        // apart — "the john who joined in March" rather than six
        // characters of key — and it must never be rewritten, or the
        // ledger stops being one.
        claimedAt: p.claimedAt,
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

  // ── WHO RUNS THIS BOX ────────────────────────────────────────────
  //
  // Two fields, both public: the owner's key and label, from allow.json —
  // the one place ownership lives. They were once also on every roll row
  // as `owner: true`; the roll went, and on 2026-09-19 so did the mark on
  // the row ("a row in the roll doesn't know who the owner is"). This is
  // how they are ASKED FOR, without asking for any membership.
  //
  // This is the last thing `handlePartnerCheck` needed the roll for.
  // A partner promotion has to be verifiable — "the key marked owner over
  // there is the key of the peer here" — and setPartner's own note leans
  // on that proof being a PUBLIC page: "a node reporting a public page is
  // not laundering privilege; it saw nothing this box could not have
  // seen." Still true, and now it is one page rather than a ledger.
  //
  // Empty on a relay nobody has claimed, which is a real answer: that box
  // has no owner yet, and partner promotion refuses it for that reason.
  function ownerPublic() {
    var label = auth.ownerName(allow);
    var key = label && allow.byName && allow.byName[label];
    return { ownerKey: key || '', ownerLabel: label || '' };
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
  // capture that is while somebody is looking at the roll that proves
  // the partnership.
  //
  // 0006 IS UNTOUCHED. Their ledger is not here and never will be — the
  // hard rule is that a relay never persists one — so routingTable.json
  // keeps its shape, `peers` and nothing else, which labPersistence
  // asserts.
  //
  // THE RECIPROCITY CHECK IS NOT HERE, and that is deliberate. The proof
  // is a public roll: anybody may read `/api/relay/who` and see which
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
    // the far roll showing that key marked owner — with one owner it
    // proves "one key owns both", which is true, public, and checkable
    // by key. No third party's consent is bypassed: partnering only
    // creates routes between the two relays' own members, and the other
    // relay's owner must promote this one in turn.
    if (theirKey === relayPublicKey()) {
      return { ok: false, status: 400, error: 'that is this relay' };
    }

    // THE PARTNER ROLL (cycle 3): a row keyed by relay key in the §5 shape,
    // not a flag on this member's row. This verb is the deprecated model
    // (NODE-AND-RELAY §6) writing to the new store until cycle 5 replaces
    // it with injection and the minting cycle. One partnership per member,
    // as before: promoting a member to a different relay replaces theirs.
    var had = store.partners.byOwner(peerKey)[0] || null;
    if (had && had.url === at && had.relayKey === theirKey) {
      return { ok: true, status: 200, unchanged: true, partner: partnerView(had) };
    }

    store.transaction(function () {
      store.partners.removeOwner(peerKey);
      store.partners.put({
        relayKey: theirKey, url: at, ownerKey: peerKey, status: 'partnered',
        // Written once, like claimedAt: it says when this partnership
        // began, and a re-promotion to the same relay does not reach here.
        since: (had && had.since) || new Date().toISOString(),
      });
    });
    var made = store.partners.get(theirKey);

    ownerEvent('partner-added', {
      key: peerKey, label: row.publicLabel || '', relayAt: at, cause: hash,
    });
    return { ok: true, status: 200, partner: partnerView(made) };
  }

  // The shape callers have always been handed for a partnership.
  function partnerView(p) {
    return p ? { url: p.url, relayKey: p.relayKey, since: p.since } : null;
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
    var was = store.partners.byOwner(peerKey)[0] || null;
    if (!was) return { ok: true, status: 200, unchanged: true };
    store.partners.removeOwner(peerKey);

    ownerEvent('partner-removed', {
      key: peerKey, label: row.publicLabel || '', relayAt: was.url, cause: hash,
    });
    return { ok: true, status: 200, removed: partnerView(was) };
  }

  // Everything this relay partners with, for the owner's own report. Not
  // in `who()`: a partnership is a public statement of association
  // between two relays, and there is no reason yet for a stranger to read
  // one. Owner-only until somebody needs otherwise.
  // ── A PARTNER RELAY, RECOGNISED BY THE KEY IT SIGNS WITH ───────────
  //
  // A partner is NOT a member and must never become one. Its relay key is
  // not a row in `peers`, is not in the roll, and cannot claim a label —
  // so `deviceIdentity` answers null for it, which is correct and is why
  // this exists separately rather than as a branch inside that.
  //
  // THE PINNED KEY IS THE WHOLE PROOF. It was written down at promotion,
  // by the owner, against a relay they had verified (PARTNERS.md item 2).
  // Nothing here trusts a URL, a label, or anything the caller says about
  // itself: the signature verifies against the pinned key or the caller is
  // a stranger.
  // ── THE PARTNERSHIP ANSWERED (cycle R12) ─────────────────────
  //
  // `since` said when a partnership began and nothing said when it last
  // worked, so the only liveness this relay had was the partner STREAM —
  // which R13 takes away. This is the column that replaces it.
  //
  // ANY ANSWER COUNTS, and that is deliberate. A partner replying "no
  // matches" has demonstrably worked; a partner refusing has worked. What
  // this records is that the partnership carried a packet there and back,
  // never that the answer was liked. Only a promise that rejects — no
  // answer at all — leaves the column where it was.
  //
  // Never an eviction: the roll is the reach (Andy). A partner silent for
  // a month is still the only route to its members.
  function partnerAnswered(relayKey) {
    if (!relayKey) return;
    delete partnerMissedAt[relayKey];
    // BACK, AND SAID SO (R42) — once, on the first answer after it was
    // announced unavailable, never on every answer.
    if (partnerSaidDown[relayKey]) {
      delete partnerSaidDown[relayKey];
      announcePartner(relayKey, true);
    }
    try { store.partners.touch(relayKey, new Date(clock()).toISOString()); }
    catch (e) { /* a column that will not take a stamp is not worth a dropped reply */ }
  }

  // ── IS A PARTNER LIVE? (R13) ─────────────────────────────────────────
  //
  // The held stream that answered this is gone (Andy + Grok, cycle 8). A
  // partner is live when it answered within PARTNER_QUIET_MS. Quieter than
  // that it is STILL asked, once: only a failed try since its last answer
  // benches it, and only for another PARTNER_QUIET_MS. So a quiet partner
  // costs at most one wasted post every fifteen minutes, and a partner that
  // comes back is found by the next of those.
  //
  // The miss is kept in RAM, keyed by relay key: it is a fact about this
  // process's last attempt, not about the partnership, and a restart that
  // forgets it merely gives every partner its one try again.
  var partnerMissedAt = Object.create(null);

  function partnerMissed(relayKey) {
    if (!relayKey) return;
    var row = null;
    try { row = store.partners.get(relayKey); } catch (e) { row = null; }
    // A MISS WHILE IT IS STILL LIVE IS NOT RECORDED (found by Grok's
    // review of the gap cycle, 2026-09-22). It was stamped regardless, so
    // the moment the last answer aged past PARTNER_QUIET_MS that old miss
    // benched the partner — with no post-quiet try, which gap R13 promises,
    // and no "unavailable" broadcast, because it was live when it failed.
    // Only a failure AFTER the quiet window is the one try that benches.
    var last = row && row.last ? Date.parse(row.last) : NaN;
    if (isFinite(last) && clock() - last < PARTNER_QUIET_MS) return;
    partnerMissedAt[relayKey] = clock();
    // UNAVAILABLE, AND SAID SO (R42) — at the moment it is benched: it was
    // quiet past PARTNER_QUIET_MS and its one try just failed.
    if (partnerSaidDown[relayKey]) return;
    if (!row || row.status !== 'partnered') return;
    if (partnerLive({ relayKey: relayKey, last: row.last })) return;
    partnerSaidDown[relayKey] = true;
    announcePartner(relayKey, false);
  }

  // ── A PARTNER'S AVAILABILITY, TOLD TO EVERY MEMBER (R42) ─────────────
  //
  //   Andy: "why put the answer in search when it could be broadcast?" —
  //   "the broadcast says "unavailable" (right now) it doesn't say
  //   "dead"" — "mechanism accepted, as just discussed." (2026-09-22)
  //
  // ON A CHANGE ONLY: benched, and back. With R13's fifteen-minute bench
  // that is at most two per partner per fifteen minutes, whatever the
  // traffic. `at` is what makes it "unavailable AS OF" — a node lets it go
  // stale after the same fifteen minutes and sends as usual, and that send
  // is this relay's next try (partnerAvailability.js).
  //
  // Its own event, not `presence`: presence is about members, and a node
  // filters it by its contacts, which a relay key never is. No partner
  // holds a stream (R13), so a broadcast reaches members only.
  //
  // RAM: which partners this process has announced as down, so each
  // change is said once. A restart forgets it, and the worst that costs is
  // one "back" never said for a partner nobody was told was gone.
  var partnerSaidDown = Object.create(null);

  function announcePartner(relayKey, live) {
    presentNow.broadcast('partner', {
      relayKey: relayKey, live: !!live, at: new Date(clock()).toISOString(),
    });
  }

  function partnerLive(p) {
    if (!p || !p.relayKey) return false;
    var now = clock();
    var last = p.last ? Date.parse(p.last) : NaN;
    if (isFinite(last) && now - last < PARTNER_QUIET_MS) return true;
    var missed = partnerMissedAt[p.relayKey];
    return !(missed && now - missed < PARTNER_QUIET_MS);
  }

  // DID THE PARTNER ANSWER AT ALL? What askPartner settles with is
  // peerPost's result, which resolves on silence too. A refusal from the
  // partner is an answer (R12: "a partner refusing has worked"); our own
  // wait running out, a connection that failed, or our own queue saying no
  // are not — the partner said nothing.
  function partnerSaidSomething(answer) {
    if (!answer) return false;
    if (answer.stillOpen || answer.queueFull) return false;
    if (typeof answer.text === 'string') return true;
    return answer.status !== 0 && answer.status !== undefined;
  }

  function heardFrom(relayKey, answer) {
    if (partnerSaidSomething(answer)) partnerAnswered(relayKey);
    else partnerMissed(relayKey);
  }

  function partnerByRelayKey(key) {
    var k = String(key == null ? '' : key).trim();
    if (!k) return null;
    // One seek on the partner roll's key (cycle 3). This was a scan of the
    // whole membership on the hot path — the unknown-token flood of §9b.
    var p = store.partners.get(k);
    return p && p.status === 'partnered' ? { publicKey: p.ownerKey, partner: p } : null;
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
    return store.partners.all()
      .filter(function (p) { return p.status === 'partnered'; })
      .map(function (p) {
        var owner = findByKey(p.ownerKey);
        return {
          key: p.ownerKey,
          label: (owner && owner.publicLabel) || '',
          url: p.url,
          relayKey: p.relayKey,
          since: p.since,
          // When this partnership last carried a packet (cycle R12). ''
          // for one that never has.
          last: p.last || '',
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
      // A COUNT, not the roll (cycle 3): the report says how many, which
      // is one query; the rows never leave the store to be counted.
      peers: store.members.count(),
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
  // labelled with a phone number put that number in a public roll.
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

    // ── UNCLAIMED: THE OWNER INVITE, AND NOTHING ELSE (cycle 3, Part B) ─
    //
    // 0003 amended: FIRST INVITED CLAIM IS OWNER. An unclaimed relay takes
    // one thing — a signed claim presenting the owner invite install.js
    // minted over SSH — and refuses every other claim. The pending-owner
    // name reservation and `open` mode that stood here are gone: a name
    // with no secret behind it let whoever guessed it take the box.
    //
    // MEMBERS BUT NO OWNER is not unclaimed, it is broken — allow.json
    // lost or trashed. relayServer.js refuses to START on it; this refusal
    // is the same rule for a relay built in process. Recovery is SSH,
    // never the wire (Andy: "if allow.json is trashed, there is no way of
    // proving ownership other than ssh, manually replace allow.json").
    var firstOwner = allow.mode !== 'keys';
    if (firstOwner) {
      if (store.members.count() > 0) {
        return { ok: false, status: 503, error: 'relay has members but no owner — restore allow.json over SSH' };
      }
      if (!publicKey || !sig) {
        return { ok: false, status: 400, error: 'first claim needs publicKey and sig' };
      }
      if (!auth.verify(publicKey, auth.claimMessage(asSent), sig)) {
        return { ok: false, status: 403, error: 'bad claim signature' };
      }
      if (!inviteToken || !onInvite) {
        return { ok: false, status: 403, error: 'owner invite required' };
      }
      var ownerInvite = redeem(inviteToken, onInvite);
      if (!ownerInvite.ok) return ownerInvite;
      if (!invites.isOwnerInvite(ownerInvite.invite)) {
        return { ok: false, status: 403, error: 'owner invite required' };
      }
      inviteRow = ownerInvite.invite;
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
      // is handled above, on the installer's owner invite, because there
      // is no owner yet to mint an ordinary one.
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
        // A leftover owner invite makes a member of nobody: the relay
        // already has its owner, and the token was for that one claim.
        if (invites.isOwnerInvite(keysInvite.invite)) {
          return { ok: false, status: 403, error: 'this relay already has an owner' };
        }
        inviteRow = keysInvite.invite;
      }
    }
    // AN `else` STOOD HERE for `open` mode (auth.checkClaim). There are two
    // states now, and both are handled above.

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
    // THE OWNER IS NEVER TURNED AWAY. A first-owner claim goes through
    // whatever the figure says — a relay that locked out the one account
    // that could raise its own limit would need SSH to undo a number, and
    // `firstOwner` is also how an owner returns to a box he already has.
    //
    // NOBODY IS EVICTED. Full means no new claims; it never means a row
    // is dropped — design/principles/LIMITED-RESOURCES.md, Andy: "it's
    // like member slots, you must evict before adding new ones."
    if (!firstOwner && discLimit.full()) {
      return {
        ok: false,
        status: 507,
        error: 'this relay is full: its state is at the configured disc limit of ' +
          discLimit.limitMB() + ' MB. Its owner must raise discLimitMB or remove members.',
      };
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
    // The owner invite burned, so this claim IS the owner: allow.json is
    // written and the relay is in keys mode from here on.
    if (firstOwner) becomeOwner(n, publicKey);

    var peer = {
      // ONE LABEL. `name` stood here carrying the same string, and went
      // on 2026-09-15 — see loadRoutingTable for the migration and
      // `who()` for what a roll row says now.
      publicLabel: n,
      publicKey: publicKey,
      // THE ENROLMENT LEDGER'S ONE DATE. Written once, never rewritten:
      // it says when this KEY joined, which stays true whatever the
      // label does later.
      claimedAt: new Date().toISOString(),
      // `owner: firstOwner` STOOD HERE. A row does not know who owns the
      // relay (relayStore.js, 2026-09-19): becomeOwner above wrote the one
      // key that does into allow.json. The claim's ANSWER still says so.
    };
    // KEYED BY KEY, always, because a claim without one is refused
    // above. The map used to be `publicKey || n`, which is how a row
    // could be filed under a label.
    store.members.put(peer);
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

  function claim(name, sig, publicKey, clientKey, inviteToken, inviteLabel) {
    var seen = { gate: false, label: '', invite: '' };
    var out = guardWrite('claim', function () {
      return claimAttempt(name, sig, publicKey, clientKey, inviteToken, inviteLabel, seen);
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
  // IT STOPS AT THE PARTNERSHIP (0019): partners' streams are skipped, and
  // so is the member themself.
  function announceMember(key, label) {
    var k = String(key || '').trim();
    if (!k) return 0;
    var row = { key: k, at: mineKey(), label: String(label || ''), seen: new Date().toISOString() };
    // Present only when it is true. A claim lands before its stream opens,
    // and a relay that said "present" of somebody it cannot see would be
    // the one lie this design cannot afford.
    if (presentNow.isPresent(k)) row.present = true;
    return presentNow.broadcast('route', row, function (id) {
      return id !== k && !partnerIdentity(id);
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
  // signs nothing: /api/relay/key names the owner's key, and the node
  // compares it with its own (ownerBadge.probe).
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
  // every roll — cannot be replayed as "install this key". That is
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

    // A TOKEN IS A KEY (cycle 3). This resolved the owner by label too, and
    // then fell back to findByLabel for everybody — residue from before
    // identity was a key, and the label scan in the unknown-sender flood
    // (NODE-AND-RELAY §9b). Every operation is by key now; labels serve
    // search and display only (Andy). One read, success or fail.
    var ownerLabel = auth.ownerName(allow);
    if (ownerLabel) {
      var ownerKey = allow.byName && allow.byName[ownerLabel];
      if (ownerKey && t === ownerKey) {
        return { id: ownerKey, label: ownerLabel, publicKey: ownerKey, owner: true };
      }
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

    // RELAY CLASS, AND THIS IS THE CALL THAT PROVED THE SPLIT NECESSARY.
    // Every post this relay makes on a member's behalf opens under ONE
    // key — its own — so on a shared budget the relay's second concurrent
    // self-post is refused by its own cap. `devicePeers` makes two
    // deviceOffer calls to two different members and would fail at a
    // ceiling of 1. A member is one person; this relay acts for all of
    // them at once, and the two cannot share a number (0016).
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
    }, null, routerTable.RELAY);
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

  // A PARTNER'S POST, HELD OPEN FOR ITS ANSWER (R13). By hash, like
  // awaitingReply, and for the same reason: what waits at this end is a
  // connection, not a socket. Settles with the reply packet a stream would
  // have carried — {hash, from, text, sig}, signed by this relay — or, when
  // the time this relay granted runs out, with the refusal the partner
  // would otherwise have learnt from its own timer.
  var heldForPartner = Object.create(null);

  function holdForPartner(hash, grantedMs) {
    return new Promise(function (resolve) {
      var slot = { resolve: resolve, timer: null };
      heldForPartner[hash] = slot;
      var wait = typeof grantedMs === 'number' && grantedMs > 0 ? grantedMs : routerTable.DEFAULT_TTL_MS;
      slot.timer = setTimeout(function () {
        if (heldForPartner[hash] !== slot) return;
        delete heldForPartner[hash];
        resolve({ ok: false, status: 504, hash: hash, error: 'no answer yet' });
      }, wait);
      if (slot.timer && typeof slot.timer.unref === 'function') slot.timer.unref();
    });
  }

  function settleForPartner(hash, packet) {
    var slot = heldForPartner[hash];
    if (!slot) return false;
    delete heldForPartner[hash];
    if (slot.timer) clearTimeout(slot.timer);
    slot.resolve(Object.assign({ ok: true, status: 200 }, packet));
    return true;
  }

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
    if (isOwner(who)) {
      try {
        auth.writeAllowKeys(rootDir, [{ name: next, publicKey: who.publicKey }]);
        reloadAllow();
      } catch (e) {
        return { ok: false, status: 500, error: 'could not move the owner record' };
      }
    }

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
    // The row, and any partnership it carried: a removed member's relay is
    // not this relay's partner either (as when the flag lived on the row).
    store.transaction(function () {
      store.members.remove(key);
      store.partners.removeOwner(key);
    });

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
  // A forward cannot be answered when it arrives: this relay has to ask
  // one of its members and wait. What it must hold meanwhile — the
  // function that answers the PARTNER who asked, and the originator and
  // the partner that carried it, so the member who answers can be told the
  // route back (cycle 3, NODE-AND-RELAY §9b) — rides IN the router's own
  // entry as its `carry`, and expires with it (router.js `open`). In RAM,
  // keyed by a hash nobody chose; not a route cache; never on disc.
  //
  // THERE WAS A `forwarding` MAP HERE until cycle 3. It was emptied only by
  // a reply, so a forward whose member never answered stayed in RAM for
  // good — while this comment said it was swept by the router's ttl.

  // inner hash -> { to, at } for a forward this relay sent to a partner.
  // Only so that a signed reply can name the route it proved. In RAM,
  // keyed by a hash derived from bytes, emptied on reply — or, when no reply
  // comes, by relayErrorToAsker once askPartner settles (peerPost's wait).
  var carrying = Object.create(null);

  // WHAT A PARTNER'S FORWARD ACTUALLY DOES HERE.
  //
  // Returns an answer object to send back at once, or `null` when the
  // packet is on its way to a member and the partner must wait.
  function forwardToMine(packet, answerPartner, viaKey) {
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
      // PARTNER CLASS. This opens under THIS relay's key like a device
      // offer does, but the traffic is a partner's, and 0016 keeps the
      // two apart: a partner is another box whose behaviour we do not
      // control, so it must not be able to spend the budget this relay
      // needs to serve its own members.
    }, { answer: answerPartner, from: from, at: String(viaKey || '') }, routerTable.PARTNER);
    if (!opened || !opened.ok) return opened;

    monitorEvent('post', from, target.id, { bytes: body.length, hash: innerHash, via: 'partner' });
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
  // SO THIS FAILS CLOSED. A forward goes to ONE named partner or nowhere.
  //
  // 0012 already said where the answer comes from — *"which partner comes
  // from the node, which already has it"*. Until cycle 2 that hint had
  // nowhere to ride and this door stayed shut. It rides now, as signed
  // route hints beside the packet (routePost, partnerFromHints), and the
  // relay picks ONE partner from them — still never a broadcast.
  //
  // Returns an answer to give the member now, or null when there is
  // nothing to try — in which case the caller falls through to its own
  // `no such peer`.
  function carryToPartner(who, toToken, text, sig, atRelayKey, budgetMs) {
    if (!askPartner || !atRelayKey) return null;
    var list = (partners() || []).filter(function (p) {
      return p.relayKey === atRelayKey;
    });
    // ONE, OR NONE. A named partner this box has actually promoted, or
    // the caller falls through to `no such peer` as it always did.
    if (list.length !== 1) return null;

    // WILL IT FIT ONCE WRAPPED? Checked here, before anything is sent,
    // because the wrapper below becomes the `text` of a post to the
    // partner and is bounded there by MAX_ROUTED_TEXT. A packet that fits
    // this hop but not the next would 413 at the far relay, after
    // signing, where nothing can trim it (SURFACE.md §8). The sending node
    // checks the same predicate at compose; this is the same rule, again,
    // at the last place it can still be said honestly.
    if (!limits.fitsWrapped(text, who.id, String(toToken), sig)) {
      return { ok: false, status: 413, error: 'too big to tunnel' };
    }

    var signed = auth.postSignatureFor(who.publicKey, who.id, String(toToken), text, sig);
    if (!signed) return { ok: false, status: 403, error: 'bad post signature' };
    var innerHash = auth.requestHash(signed);

    // REGISTERED BEFORE IT LEAVES, exactly as a local post is: nothing
    // goes out until the thing that will match its answer exists. The
    // route's target is the far member, so when the reply comes back up
    // the tunnel `routes.answer` checks it against the key the member
    // actually replied with.
    // WHAT IS LEFT FOR THE FAR SIDE. Undefined stays undefined: a caller
    // that declared no budget is asking this box for its default, and has
    // no opinion to pass on.
    var onward = typeof budgetMs === 'number' && budgetMs > 0
      ? Math.max(0, budgetMs - HOP_MARGIN_MS)
      : undefined;

    // AND REFUSE HERE IF THE FAR SIDE COULD NOT USE IT, which is the
    // whole of "the next station down the chain better hurry" — applied
    // one hop EARLIER than the station itself.
    //
    // The floor in `routes.open` guards what THIS box grants. It does not
    // guard what this box is about to hand on, and those differ by
    // HOP_MARGIN_MS: a 600 ms budget passes the local floor, leaves 100
    // for the partner, and is refused at the far end — after a round trip
    // spent learning something computable here. That is precisely the
    // failure this design keeps removing, arriving in the one place it
    // had not been looked for.
    //
    // So a forward that cannot leave the far side enough time is refused
    // before anything crosses the wire. The asker hears the same answer
    // either way; it just hears it now.
    if (onward !== undefined && onward < routerTable.MIN_USEFUL_MS) {
      return {
        ok: false, status: 503,
        error: 'not enough time to try',
        tooLittleTime: true, wouldHave: onward,
      };
    }

    var opened = routes.open(innerHash, who.id, String(toToken), function () {
      var wrapper = JSON.stringify({
        v: 1,
        body: { forward: { from: who.id, to: String(toToken), text: text, sig: sig } },
      });
      var p = list[0];
      askPartner(p.url, p.relayKey, wrapper, onward)
        .then(function (answer) {
          heardFrom(p.relayKey, answer);
          var said = null;
          try { said = JSON.parse((answer && answer.text) || ''); }
          catch (e) { said = null; }
          var out = (said && said.body) || null;
          if (out && out.ok === true && out.forwarded) {
            deliverForwardedReply(innerHash, out.forwarded);
            return;
          }
          // THE ERROR TRAVELS DOWN THE CHAIN (Andy, 2026-09-19): the far
          // relay refused — the target was not there, its reply was
          // oversized — or said nothing at all. Either way the asking
          // member hears it, rather than waiting out a silence.
          relayErrorToAsker(innerHash, who.id,
            (out && out.status) || (answer && answer.status) || 502,
            (out && out.error) || (answer && answer.error) || 'the partner relay did not answer');
        })
        .catch(function () {
          partnerMissed(p.relayKey);
          relayErrorToAsker(innerHash, who.id, 502, 'the partner relay did not answer');
        });
      // It is on its way. Whether that partner holds the key is its
      // answer to give, and saying `false` here would cancel the route
      // the answer needs.
    }, null, { kind: routerTable.MEMBER, ttlMs: budgetMs });
    if (!opened || !opened.ok) return opened;

    monitorEvent('post', who.id, String(toToken), {
      bytes: text.length, hash: innerHash, via: 'partner',
    });
    meterNote(text.length, false);
    // Which partner this went to, so that a reply -- if one comes -- can
    // say WHICH route was proven. Dropped as soon as it is used or the
    // route expires; it is a fact about a request in flight, like the
    // route table itself.
    carrying[innerHash] = { to: String(toToken), at: list[0].relayKey };
    return withStatus(opened, innerHash);
  }

  // The far member's reply, arriving as the answer to this relay's own
  // post to a partner. NOT through routeReply, for the reason sendAnswer
  // gives: that door begins with deviceIdentity, and the replier is not a
  // member here. Everything else is identical — same table, same check
  // that the replier is the route's target, same event on the requester's
  // stream.
  // -- A ROUTE THAT CARRIED A PACKET AND CAME BACK IS A FACT ----------
  //
  //   Andy: "what happens if the node, during a peer post, supplies
  //   routes, the relay verifies the first one and it is valid: broadcast
  //   then?"
  //
  // Yes -- and it dissolves the rule it looked like it was bending. The
  // earlier boundary was about PROVENANCE: a route a member supplied was a
  // hint, a route this relay found was a fact, and the first must never
  // become the second. Verification makes provenance irrelevant, because
  // **a false route cannot be verified.** The only thing anybody can get
  // broadcast is a route that works, which is harmless by construction.
  //
  // THE BAR IS THE SIGNED REPLY, not the partner's acceptance. Acceptance
  // proves only that a partner SAID it holds the key, which a partner that
  // wanted to harvest packets would also say. A reply signed by the target
  // key cannot be produced by anyone who does not hold that key -- so this
  // threshold trusts nobody, including the partner that carried it.
  //
  // AND IT IS BROADCAST, NOT KEPT. This relay does not hold a route table
  // (0012, 0013): it says what it learned and forgets, and the members
  // that care write it down. A relay that rebooted is re-primed by them.
  function announceRoute(innerHash, from) {
    var carried = carrying[innerHash];
    delete carrying[innerHash];
    if (!carried || carried.to !== from) return;
    presentNow.broadcast('route', { key: from, at: carried.at });
  }

  // ── AN ERROR FROM THE FAR SIDE, TOLD TO THE ONE WHO ASKED ─────────────
  //
  //   Andy: "before post arrives at N2 and an error occurs, only N1 will be
  //   informed. If N2's reply exceeds size limit, then B will notify N2 of
  //   its misconduct and send an error down the reply chain."
  //
  // NO NEW WORD ON THE WIRE. It goes as an ordinary `reply` for the same
  // hash — but signed by THIS RELAY, `from` its own key, never N2's. A
  // relay cannot manufacture N2's receipt and does not try: the asker's
  // node sees a reply signed by somebody other than the target and knows
  // it is the relay speaking (peerPost.onReply marks it `relayed`).
  // Registered in 0010.
  //
  // The route is closed first, so a late answer from the far side has
  // nothing left to settle and cannot be delivered twice.
  function relayErrorToAsker(innerHash, requester, status, error) {
    delete carrying[innerHash];
    if (!routes.cancel(innerHash, requester)) return false;
    monitorEvent('refused', requester, '', { why: String(error), hash: innerHash, via: 'partner' });
    return replyAsRelay(innerHash, requester, status, error);
  }

  // The reply itself, for a route already closed by the caller. Shared by
  // the partner error above and the stalled-reader cut (R35), which is
  // the same situation seen from the other end: this relay knows the
  // answer will not come, and says so for the hash the asker is holding.
  function replyAsRelay(innerHash, requester, status, error) {
    var mine = auth.loadIdentity(rootDir);
    if (!mine || !mine.privateKey) return false;
    return !!presentNow.send(requester, 'reply', {
      hash: innerHash,
      from: mine.publicKey,
      text: JSON.stringify({ v: 1, body: { ok: false, status: status, error: String(error), relayed: true } }),
      sig: auth.sign(mine.privateKey, auth.receiptMessage(innerHash)),
    });
  }

  function deliverForwardedReply(innerHash, reply) {
    var matched = routes.answer(innerHash, reply.from);
    if (!matched.ok) return false;
    monitorEvent('reply', reply.from, matched.requester || '', {
      bytes: (reply.text || '').length, hash: innerHash, via: 'partner',
    });
    // PROVEN, so everybody gets it. `routes.answer` has already checked
    // that the replier is the key the route was opened for, which is what
    // makes this a fact rather than a claim.
    announceRoute(innerHash, reply.from);
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

  // Every owner verb that writes — minting, renaming, forgetting,
  // partnering, reconfiguring — goes through here, so the disc guard sits
  // on the outside once rather than on each of them. A relay whose disc
  // is full still answers its owner, and the answer says why.
  function answerSelf(hash, text, who) {
    return guardWrite('owner verb', function () {
      return answerSelfInner(hash, text, who);
    });
  }

  function answerSelfInner(hash, text, who) {
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
    // Set by the search branch: a roll walk to run before anything is sent.
    var searching = null;

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
    // NOT ON THE PUBLIC ROLL, deliberately. A member learns the reach
    // they were given by joining; a stranger reading /api/relay/who
    // learns nothing about who this box talks to. Publishing the mesh is
    // a different decision and nobody has taken it.
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
    // ANY MEMBER MAY ASK, like `partners` above. The roll is already
    // public in full, so a search over it gives away nothing new — what it
    // saves is the transfer, and that saving is the entire point.
    //
    // A FLOOR ON THE QUERY, because substring matching with no floor is
    // the roll again with extra steps: `a` would return everybody.
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
      out = forwardToMine(body.forward, sendAnswer, who.id);
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
        // So this maps each member into the plain row peerSearch takes and
        // does nothing else. Presence is resolved HERE, into a field,
        // because `presentNow` is a relay concept with a live socket
        // behind it and peerSearch must stay drivable from a test with
        // nothing running.
        //
        // What this file is no longer entitled to an opinion about: what
        // a good match is, what beats what, and how many fit.
        // THE WALK IS ASYNCHRONOUS (cycle 3). The roll is read a page at a
        // time off disc, with the event loop between pages (walkRoll), so
        // a search over a large roll never stalls every other request on
        // this relay. The answer is composed when the walk ends —
        // `searching` hands the rest of this function to it.
        searching = { q: q, propagate: propagate };
      }
    }

    // What the walk produced, turned into this relay's answer. Only the
    // timing moved: this ran inline, straight after the walk, until the
    // walk stopped blocking.
    function composeSearch(found, q, propagate) {
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

    // ── PARTNERSHIP, AND THE PROOF WAS READ BEFORE IT GOT HERE ──────
    //
    // Owner-only: who this relay partners with is the owner's decision
    // about their own box, the same class as naming it.
    //
    // The reciprocity — that this peer really owns the relay at that url
    // — was checked against a PUBLIC roll by the owner's node before
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
    // replies come back as the replies to its posts, whenever they come (R13). So the
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
      var packet = {
        hash: hash,
        from: mine.publicKey,
        text: reply,
        sig: auth.sign(mine.privateKey, auth.receiptMessage(hash)),
      };
      // A PARTNER HOLDS NO STREAM (R13): its answer goes back as the reply
      // to the post it asked with, which is still open, waiting.
      if (settleForPartner(hash, packet)) return;
      presentNow.send(matched.requester, 'reply', packet);
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
    if (searching) {
      walkRoll(searching.q, function (found) {
        if (!found) {
          out = { ok: false, status: 503, error: 'search failed' };
        } else {
          composeSearch(found, searching.q, searching.propagate);
        }
        finish();
      });
      return;
    }
    finish();

    function finish() {
    if (pendingSearch) {
      // LIVE PARTNERS ONLY (cycle 3, NODE-AND-RELAY §10, decided by Andy).
      // Live was "holds its stream here now" until R13 took the streams
      // away; it is now "answered within fifteen minutes, or has not failed
      // its one try since" (partnerLive). Asking one that is down held
      // every search for the full timeout (the answer waits on all of
      // them); leaving it out loses no more than search already gave up
      // against a roll.
      var partnerList = askPartner
        ? (partners() || []).filter(partnerLive)
        : [];
      if (!partnerList.length) {
        sendAnswer(out);
        return;
      }

      var asked = partnerList.map(function (p) {
        var text = JSON.stringify({ v: 1, body: { search: { q: pendingSearch.q } } });
        return askPartner(p.url, p.relayKey, text)
          .then(function (answer) {
            heardFrom(p.relayKey, answer);
            var said = null;
            try { said = JSON.parse((answer && answer.text) || ''); }
            catch (e) { said = null; }
            var body = (said && said.body) || {};
            if (!body || body.ok !== true) return null;
            // A partner on an older release still answers its offline
            // members, marked `present: false`. Online only is this relay's
            // answer whoever else contributed (walkRoll), so those rows
            // stop here; a row with no `present` is from a relay that
            // only answers the connected.
            var rows = (Array.isArray(body.matches) ? body.matches : [])
              .filter(function (r) { return r && r.present !== false; });
            return { via: p.relayKey, rows: rows };
          })
          .catch(function () { partnerMissed(p.relayKey); return null; });
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
  // here is present, so rows carry no `present` and peerSearch weighs no
  // presence signal.*
  //
  //   Andy: "the nature of all wire comms is asynchronous. And blocking
  //   hurts the resources of relays."
  //
  // Still paged, SEARCH_PAGE keys a turn with the event loop between, over
  // a snapshot of the keys: a member arriving mid-walk is simply not seen,
  // one leaving mid-walk is skipped when its row is gone.
  //
  // `done(result)` gets peerSearch's result.
  function walkRoll(q, done) {
    var bucket = peerSearch.open(q, peerSearch.SLOTS);
    var keys = Object.keys(activeRows);
    var at = 0;
    (function step() {
      var end = Math.min(at + SEARCH_PAGE, keys.length);
      for (; at < end; at += 1) {
        var p = activeRows[keys[at]];
        if (!p || !p.publicKey) continue;
        bucket.offer({
          publicKey: p.publicKey,
          publicLabel: labelOf(p),
          claimedAt: p.claimedAt,
          via: null,
        });
      }
      if (at >= keys.length) { done(bucket.result()); return; }
      setImmediate(step);
    })();
  }

  // ── WHICH PARTNER, FROM THE SENDER'S HINTS (cycle 2) ─────────────────
  //
  //   Andy: "1. live partners 2. minted partners 3. non-minted,
  //   immediately returns error ('minting incomplete')."
  //
  // The hints are the sender's: the relays its contact is enrolled at,
  // from the node's own contact row (0012 — the node has the answer). This
  // relay knows which of them it partners with and which of those are
  // live, so the ORDER is its call. It picks ONE — a forward goes to one
  // named partner or nowhere (partnerTunnel.js, "never a broadcast") — and
  // does not fall back to a second on failure: a refused forward is the
  // sender's news, not a reason to disclose the packet to another relay.
  //
  // Live = answered within fifteen minutes, or not yet failed its one try
  // since (partnerLive, R13). It was "holds its own stream to this relay"
  // until the streams went. Either way a partner that is not live is still
  // chosen when it is the only one named: the order is a preference, never
  // a refusal.
  function partnerFromHints(hints) {
    var mine = (partners() || []);
    var named = hints.filter(function (k) {
      return mine.some(function (p) { return p.relayKey === k; });
    });
    var live = named.filter(function (k) {
      return partnerLive(mine.filter(function (p) { return p.relayKey === k; })[0]);
    });
    return live[0] || named[0] || null;
  }

  // THE FIFTH ARGUMENT NAMES THE PARTNER, and it has two shapes:
  //
  //   a string       a partner key, trusted — the in-process hook the
  //                  partner suites drive this path through
  //   { hints, hintSig }   what the public route passes (cycle 2): the
  //                  sender's route hints, signed beside the packet and
  //                  verified here before this relay acts on them
  //
  // Until cycle 2 nothing on the wire supplied either, and forwarding was
  // inert from outside. The hints are consumed here and never forwarded:
  // the far hop receives `{from,to,text,sig}` byte for byte (SURFACE.md §8).
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
  function routePost(fromToken, toToken, text, sig, route, budgetMs) {
    var atRelayKey = typeof route === 'string' ? route : null;
    var hints = route && typeof route === 'object' && Array.isArray(route.hints) ? route.hints : null;
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
    // publishing it as one would put it in every roll.
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
      // A PARTNER THAT ASKS IS A PARTNER THAT IS UP (R42). Stamped as an
      // answer is — R12's `last`, the bench cleared, and "back" said if it
      // had been said gone — so a partnership revives the moment EITHER
      // side speaks. Andy: "the partnership lies dormant without remedy ?"
      // Only after the signature verified: a stranger cannot revive a row.
      if (fromPartner) partnerAnswered(who.id);
      // Registered before it is answered, exactly as a peer-to-peer post
      // is: nothing leaves until the thing that will match its answer
      // exists.
      // THE SAME DISCRIMINATOR THE RATE LIMITER ALREADY USES. `who.partner`
      // picks memberHits or partnerHits a few lines above; it picks the
      // requester class here, so the two budgets cannot drift apart into
      // disagreeing about who a sender is.
      var opened = routes.open(selfHash, who.id, String(toToken),
        function () { return true; },
        null, {
          kind: fromPartner ? routerTable.PARTNER : routerTable.MEMBER,
          ttlMs: budgetMs,
        });
      if (!opened || !opened.ok) return opened;
      // METERED LIKE ANY OTHER POST. A search a partner asks costs this
      // box real work and real bytes; leaving it out of the ring would
      // make the governor blind to exactly the traffic partnering adds.
      meterNote(text.length, fromPartner);

      // ── A PARTNER'S QUESTION IS ANSWERED ON ITS OWN POST (R13) ─────
      //
      //   Grok (review): "The forward path is already request-in /
      //   reply-out. A held stream is a second bus." — "If a verb cannot
      //   answer on the same post, it is not a partner verb yet." Andy
      //   agreed (cycle 8).
      //
      // So the post stays open until answerSelf answers — at once for
      // most verbs, when this relay's member replies for a forward, when
      // the fan-out settles for a search — or until the time this relay
      // granted runs out, and the reply to the post IS the answer. The
      // waiter exists before answerSelf runs, because most verbs answer
      // before it returns.
      if (fromPartner) {
        var heldAnswer = holdForPartner(selfHash, opened.grantedMs);
        answerSelf(selfHash, text, who);
        return { ok: true, status: 200, hash: selfHash, held: heldAnswer };
      }
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
      // THE SENDER'S HINTS, CHECKED BEFORE THIS BOX ACTS ON THEM. Bounded,
      // keys only, and signed by the sender over this packet's own
      // signature — an unsigned or lifted hint block is a forged route
      // claim, and a relay that followed one would carry a packet wherever
      // a stranger pointed it.
      if (hints && hints.length) {
        if (hints.length > limits.HINTS_PER_POST ||
            !hints.every(function (k) { return typeof k === 'string' && k && k.length <= 256; })) {
          return { ok: false, status: 400, error: 'bad hints' };
        }
        if (!auth.hintsSigned(who.publicKey, sig, hints, route.hintSig)) {
          return { ok: false, status: 403, error: 'bad hint signature' };
        }
        atRelayKey = partnerFromHints(hints);
        // NONE OF THEM IS A PARTNER OF MINE. Refused at once, and said so,
        // because the sender can do something about it and a silence
        // cannot be told from a lost packet (Andy's third tier). STARTING
        // the minting cycle with this relay's owner is cycle 5, with
        // partner acquisition — here the refusal is the whole answer.
        if (!atRelayKey) {
          monitorEvent('refused', who.id, String(toToken), { why: 'minting incomplete' });
          return { ok: false, status: 409, error: 'minting incomplete' };
        }
      }
      var carried = carryToPartner(who, toToken, text, sig, atRelayKey, budgetMs);
      if (carried) return carried;
    }

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
    }, null, {
      kind: fromPartner ? routerTable.PARTNER : routerTable.MEMBER,
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
    if (matched.carry && typeof matched.carry.answer === 'function') {
      var carried = matched.carry;
      var answerPartner = carried.answer;
      // WILL IT FIT GOING BACK? (cycle 2) The reply is about to become
      // this relay's own answer to its partner, wrapped whole. One that
      // would not fit is refused HERE: the member learns its reply did not
      // travel, and the partner relay is told why (limits.fitsWrappedReply),
      // which passes it down the chain to its asking member as a reply
      // signed by the relay itself (relayErrorToAsker).
      if (!limits.fitsWrappedReply(typeof text === 'string' ? text : '', who.id, sig)) {
        // Two sentences, two audiences: the replier is told what it did,
        // the asker down the chain is told what happened to its answer.
        answerPartner({ ok: false, status: 413, error: 'reply was oversized' });
        return { ok: false, status: 413, error: 'reply too big to tunnel' };
      }
      answerPartner({
        ok: true, status: 200,
        forwarded: {
          from: who.id,
          text: typeof text === 'string' ? text : '',
          sig: sig,
        },
      });
      // THE ROUTE BACK, TO THE MEMBER WHO ANSWERED AND NOBODY ELSE
      // (cycle 3, NODE-AND-RELAY §9b). The request came from `from` through
      // partner `at`; a fresh signature from the originator, carried by a
      // minted partner, is the proof. Sent with this 200 on ANY signed
      // reply — a reply has no status, and whether the member took the
      // request in is in its text, which this relay never reads. The node
      // keeps it in its shadow (0018, R1). Not broadcast to the
      // other members: that is open in §9b.
      if (carried.at && carried.from) {
        presentNow.send(who.id, 'route', { key: carried.from, at: carried.at });
      }
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
    // whichever relay it is connected to and sends the contact's hints,
    // and THIS BOX decides where the packet goes. Delivered to a member
    // here, or forwarded to a partner — and until now only the second was
    // announced, so a node could learn where a peer lives only by
    // inference from a silence.
    //
    // So the local delivery says so, in the same event and the same shape
    // the partner path already uses (`announceRoute`, and the tunnel
    // branch above). `at` is THIS relay's key, which is exactly what it
    // means: the peer was reached here.
    //
    // NOT BROADCAST — to the member who asked and nobody else, which is
    // the rule the partner branch states: a route is the asker's to keep,
    // and everyone else's business is their own (NODE-AND-RELAY §9b).
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
    // search. The partner path already tells the replier (the tunnel
    // branch above sends `{ key: carried.from }` to `who.id`), so this is
    // the local half of a rule that was only ever half applied.
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
    // This box holds it — `deviceIdentity` hands the label back beside
    // the key — and was sending the key alone. The same shape as
    // everything else found discarded this cycle: known at the moment of
    // throwing away, and expensive to go back for.
    //
    // ONLY FOR ITS OWN MEMBERS. The partner branches above announce a
    // FOREIGN peer, whose label is a partner's to know and not this
    // relay's, so they carry none and must not invent one. A relay is the
    // authority on who is on IT.
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
      var asker = deviceIdentity(matched.requester);
      presentNow.send(matched.requester, 'route', {
        key: who.id, at: mineKey(), label: who.label || '',
      });
      presentNow.send(who.id, 'route', {
        key: matched.requester, at: mineKey(), label: (asker && asker.label) || '',
      });
    }
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
  // is pinned (relayKeys) from GET /api/relay/key. A roll is reached by key
  // or by search, never as a list.

  // The gate. Order is load-bearing at every step.
  function streamOpen(token, sig, sink) {
    // 1. Unknown identity first, before any bucket and before any crypto.
    //    B1's rule: a registry keyed by caller-chosen input grows when a
    //    stranger reaches it, so a stranger must not reach it.
    //    A PARTNER RELAY HOLDS NONE (R13, cycle 8). It used to, because a
    //    reply left this box only through `presentNow.send`; now a
    //    partner's answer is the reply to its own post (holdForPartner),
    //    so a partner stream would only take a place in the allowance
    //    members need. Refused by name, so an older relay that still dials
    //    learns why rather than retrying a bare 403.
    //    Grok (review): "A held stream is a second bus."
    if (partnerIdentity(token)) {
      return { ok: false, status: 403, error: 'a partner holds no stream here' };
    }
    var who_ = deviceIdentity(token);
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
    var ownerLabel = auth.ownerName(allow);
    return (ownerLabel && allow.byName && allow.byName[ownerLabel]) || '';
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
  // deadline, in whichever way that asker waits: a partner through the
  // tunnel's own answer, this relay's own post by settling it here, and a
  // member or partner holding a stream by a reply signed by this relay.
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
        delete carrying[r.hash];
        monitorEvent('refused', id, r.target, { why: why, hash: r.hash, as: 'requester' });
        return;
      }
      // Asking yourself leaves nobody to tell.
      if (r.requester === id) return;
      monitorEvent('refused', r.requester, id, { why: why, hash: r.hash });
      var refusal = { ok: false, status: 503, error: 'peer not reachable' };
      if (r.carry && typeof r.carry.answer === 'function') {
        r.carry.answer(refusal);
      } else if (awaitingReply[r.hash]) {
        settleHere(r.hash, {
          ok: false, status: 503, hash: r.hash, error: 'peer not reachable',
        });
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
    // THE SAME IDENTITIES streamOpen ADMITS — members and the owner. A
    // partner was admitted too until R13, and cycle 3 found this had to
    // close what it opened; with no partner stream there is none to close.
    var who_ = deviceIdentity(token);
    if (!who_) return false;
    if (!presentNow.disconnect(who_.id, sink)) return false;
    forgetActive(who_.id);
    if (why === 'stalled') failRoutesOf(who_.id);

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
    // Who runs this box — key and label, both already public on the
    // roll row marked `owner`. Served at GET /api/relay/key so a
    // partner promotion can be verified without reading a membership.
    ownerPublic: ownerPublic,
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
    // The fixed connection allowance (cycle 8), for the suites that check
    // it was set from the owner's RAM and nothing else.
    allowance: function () { return allowance; },
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
