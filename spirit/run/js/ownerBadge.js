'use strict';

// The owner badge, and nothing more: for each URL in app/natter/relays.json,
// does a signed GET /api/relay/status come back 200 with a report?
//
// That is the whole definition (DICTIONARY.md, "Owner badge"; CYCLE-A.md).
// The mailbox already answers "is this key the owner here?" every time the
// owner asks for a roll, so the badge gets no endpoint of its own: a
// second, cheaper "am I owner?" route would be a second authority on the
// same fact, and the two would drift.
//
// Nothing here opens a socket. The caller passes a request function — the
// hub passes the one that speaks HTTPS, tests pass one that answers from a
// relay object in the same process.

// Isomorphic, the way kernel.js is: the rules are shared, the filesystem
// and the signing are node-only. Natter runs in the browser and has to
// obey the same "how few mailboxes may this node be left with" rule the
// node side knows, and a rule copied into a second file is a rule that
// will be changed in one of them. Nothing below this line requires
// anything unless it is running under node.
const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
const fs = isNode ? require('fs') : null;
const path = isNode ? require('path') : null;
const auth = isNode ? require('./relayAuth') : null;
// Where this node holds a seat, and who each relay is. Both are records
// this node keeps about itself — see probe.
const relayKeys = isNode ? require('./relayKeys') : null;

function normalizeUrl(u) {
  return String(u == null ? '' : u).trim().replace(/\/+$/, '');
}

// WHAT A NODE MUST NOT BE LEFT WITHOUT.
//
//   Andy: "That rule should be: a node keeps at least one working,
//   public relay"
//
// It used to be `count > 1` — pure arithmetic over rows — and that is
// satisfied by a list of two dead loopback lab relays, which is a node
// that cannot claim, cannot send, cannot read, and cannot be reached by
// anybody. Andy's own node was in exactly that shape: two rows, one of
// them a lab relay on 127.0.0.1 that was not running, sitting FIRST so
// every /api/hub verb dialled it.
//
// So the floor is not a number of rows. It is one PUBLIC relay.
//
// ── PUBLIC, AND WHY "WORKING" IS NOT PART OF THIS ────────────────────
//
// Public is a property of the URL and the same one hub.assertRelayUrl
// already enforces on the wire: https, or http only to loopback. A
// loopback relay is a lab fixture — no peer on the internet can reach
// you there, so it is not what keeps a node alive.
//
// "Working" is a live fact — a stream held right now — and it does NOT
// belong in a permission check, for a reason that only shows up in the
// case that matters: if your one public relay is down, a rule demanding
// a working one would refuse every removal, including removing the dead
// lab row that is causing the trouble. It would lock the door of the
// room it just set on fire.
//
// Working belongs in what a screen SHOWS — "your relay is not answering"
// — which is a different job from deciding whether a list may be edited.
//
// `relays` is the list as it stands and `url` the row being considered.
// The question is about what SURVIVES, which a count can never answer:
// removing the only public row from a list of five is still fatal.
function isPublicRelay(url) {
  var target;
  try { target = new URL(String(url || '')); }
  catch (e) { return false; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false;
  var host = String(target.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return false;
  // http to a public host is refused on the wire by assertRelayUrl, so a
  // node cannot rely on one and this must not count it either.
  return target.protocol === 'https:';
}

// ── WHY THIS STABILISES THE SYSTEM, FOR NOW (Andy, 2026-09-15) ───────
//
//   Andy: "for now spirit.andyflinn.com should be un-deletable, with a
//   comment why that stabilizes our system, for now."
//
// It already is, and no hostname is written down to make it so. There is
// exactly one public relay in the world this node can reach; the lab row
// is loopback http, which `isPublicRelay` refuses on both counts. So the
// rule below — a row may go only if another PUBLIC row survives — makes
// spirit-3 un-deletable as a consequence of what it is rather than of
// what it is called.
//
// WHAT IT IS PROTECTING, today: that relay carries the owner identity
// this node signs as, it is where every enrolment lives, the harness
// points at it, and `on-spirit-3.visual.json` builds against it. A node
// that dropped it from its list would keep its key and its seat and lose
// every way of reaching either — recoverable only by retyping a URL from
// memory. One click, and no way back through the screen that did it.
//
// AND WHEN IT LAPSES, which is the half a pin by name could not express:
// add a second public relay and this rule lets spirit-3 go, because by
// then a public path genuinely survives without it. That is the right
// moment for the protection to end, and it ends by itself.
function canRemoveRelay(relays, url) {
  // A count, from the version before this one. Answered false rather
  // than guessed at: a caller that still passes a number is asking a
  // question this rule no longer knows how to answer, and saying no is
  // the safe half of being wrong.
  if (!Array.isArray(relays)) return false;
  var going = String(url || '');
  return relays.some(function (row) {
    var u = String((row && row.url) || row || '');
    return u !== going && isPublicRelay(u);
  });
}

// Natter rows, in file order, deduped by URL. A row with no url is not a
// mailbox; a malformed file is no mailboxes, never a throw, because the
// browser asks for this on every claim.
function loadRelays(rootDir) {
  var raw;
  try { raw = fs.readFileSync(path.join(rootDir, 'app', 'natter', 'relays.json'), 'utf8'); }
  catch (e) { return []; }
  var list;
  try { list = JSON.parse(raw); }
  catch (e) { return []; }
  if (!Array.isArray(list)) return [];
  var seen = Object.create(null);
  var rows = [];
  list.forEach(function (row) {
    var url = normalizeUrl(row && row.url);
    if (!url || seen[url]) return;
    seen[url] = true;
    rows.push({ label: (row && row.label) || url, url: url });
  });
  return rows;
}

function configuredUrls(rootDir) {
  return loadRelays(rootDir).map(function (r) { return r.url; });
}

// ── A NODE WITH NO LIST AT ALL GETS ONE, ONCE, AT BOOT ───────────────
//
//   Andy: "for node boot. if relays.json doesn't exist, initialize with
//   spirit.andyflinn.com only (where we auto-initialize description as
//   well)."
//
// THIS IS THE OTHER HALF OF UNTRACKING IT. relays.json used to ship in
// git with two relays in it, and that is why `git reset --hard` reverted
// a node's own list on every update — the complaint this all came from.
// Untracking it fixed that and left a new hole: a fresh clone had no
// relays at all and opened to an empty Natter.
//
// The difference between the two, and it is the whole argument: a list
// SHIPPED IN GIT is code, so it comes back on every update and cannot be
// edited away. A list WRITTEN BY THE NODE is the node's own state — it
// is created once, into a gap, and from then on it belongs to whoever
// runs the box. Nothing ever overwrites it again.
//
// ONE RELAY, NOT TWO. A node must not be left without a working public
// relay (canRemoveRelay above), and one is what that rule asks for. The
// second row was a second thing to explain on a screen somebody is
// seeing for the first time.
//
// ABSENCE ONLY. An EMPTY list is not a gap — it is a state, and one the
// UI already refuses to create, since Natter will not let the last
// public relay be removed. A node whose list is empty got there some
// other way and should not have this quietly decide for it.
//
// Said plainly because it is a real choice and not a detail: this points
// a brand-new node at ANDY'S relay. It was already true when the file
// was tracked, and with one row rather than two it is less true than it
// was — but anybody forking this tree should change this line, and
// nothing else, to point their nodes somewhere of their own.
var FIRST_RELAY = { label: 'spirit', url: 'https://spirit.andyflinn.com' };

function ensureRelays(rootDir) {
  var file = path.join(rootDir, 'app', 'natter', 'relays.json');
  if (fs.existsSync(file)) return loadRelays(rootDir);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([FIRST_RELAY], null, 2) + '\n');
  } catch (e) {
    return [];
  }
  return loadRelays(rootDir);
}

// statusPath STOOD HERE, and it was the badge:
//
//   '/api/relay/status?name=' + name + '&sig=' +
//     sign(privateKey, statusMessage(name))
//
// Deleted 2026-09-15 (R3,
// design/cycles/2026-09-15-labels-are-not-identities.md).
//
//   Andy: "i don't understand the ownerbadge concept at all: the relay
//   knows its owner by key, and already filters requests by that, because
//   the owner gets a wider peer-post-api than non-owning peers."
//
// He was right, and it was redundant three ways over. The roll below
// already says `owner: true|false` on every row, unsigned, to anyone —
// and `claimedFrom` was already fetching and parsing that exact list to
// answer a different question, with the flag open in a variable and
// unread. `statusToOwner` reaches only the owner's key, so receiving one
// IS the badge. And `answerSelf` decides `isOwner` from the post's own
// signature, per verb, so there was never state to pre-fetch.
//
// IT WAS ALSO THE WORST SIGNATURE ON THIS WIRE. `statusMessage` is
// `status\n<name>` with no minute in it — the only credential in the
// system that could not expire — and it travelled on a QUERY STRING,
// where `relay.streamSignatureFrom` refuses its sibling outright. It was
// fired at every relay in relays.json, including boxes this node holds
// no row on.
//
// Deleting it fixes that by removing it rather than by patching it, and
// costs one fewer request per relay: the roll answers `owned` and
// `claimed` together.

// readBadge STOOD HERE — *"200 alone is not the badge"* — parsing the
// owner-only report to decide whether this key owned the box. It went
// with the route it read (R3).
//
// ── FOUR ROLL PARSERS STOOD HERE, DELETED 2026-09-19 ────────────────
//
// ownedFrom ("is my key the one marked owner?"), claimedFrom,
// claimedLabelFrom and censusFacts — each read a public roll list
// (`/api/relay/who` answering `peers`). The roll went on 2026-09-18;
// `probe` below had already stopped fetching it, and only suites still
// called these. Andy: "nothing is allowed to return a roster", and a row
// never says who owns the relay — "ownership is only determined by one
// identified key. The relay knows it." That key is what /api/relay/key
// answers, and `probe` compares it with this node's own.

function summarize(rows) {
  var ownedUrls = rows.filter(function (r) { return r.owned; })
    .map(function (r) { return r.url; });
  // A DIFFERENT QUESTION from owning, and the one a device needs. B2 gave
  // every identity with a row its own slot; this is how a node finds the
  // relays where it HAS a row. Owning implies claiming — the owner holds
  // a peer row from first claim — so the owned ones are in here too.
  var claimedUrls = rows.filter(function (r) { return r.owned || r.claimed; })
    .map(function (r) { return r.url; });
  return {
    rows: rows,
    ownedUrls: ownedUrls,
    claimedUrls: claimedUrls,
    // The picker is a question, not a default. One owned mailbox needs no
    // question; two do, and answering it by taking the first URL is the
    // habit this cycle exists to break.
    mustPick: ownedUrls.length > 1,
  };
}

// ONE REQUEST PER RELAY, and it is the public roll.
//
// It was two: a signed `GET /api/relay/status` to decide `owned`, and
// then `GET /api/relay/who` for `claimed` on every relay the first one
// said no to. R3 deleted the first, because the second was already
// carrying the answer — `claimedFrom` parsed the very list that has
// `owner` on every row and did not look at it.
//
// So this now signs NOTHING. A node asking which relays it is on, and
// which of those it owns, makes no credential of any kind and reveals
// nothing it did not already publish. That is the right shape for a
// question asked on a timer against every URL in relays.json, including
// boxes this node has no relationship with.
// `name` WAS THE SECOND ARGUMENT and is gone (R3). It existed to build
// `statusPath(rootDir, name)` — a signature over a LABEL, to prove a KEY
// owned a box. Nothing here asks by name any more, and a parameter kept
// for a call that no longer happens is the residue this whole cycle is
// about.
//
// `myKey` is REQUIRED now rather than optional. It used to refine the
// answer — `owned` came from the signed report, `claimed` needed a key —
// and both come from the roll by key, so a caller without one gets
// nothing and should.
// ── IT ASKS WHO THE RELAY IS, AND READS ITS OWN SEAT ────────────────
//
//   Andy: "doesn't the node persist the necessary connection information
//   when the bind occurs? … Like the relay, the node must record the
//   enrolment details. Simple, no?"
//
// It fetched the WHOLE ROLL of every configured relay, on a timer, and
// looked for its own key in the list — the last roll read in the tree,
// and the only one that was not a question about other people. It was
// asking each relay to remember what this node did.
//
// Now: `GET /api/relay/key` says who the box is and who runs it, at 97
// fixed bytes; `relayKeys` says where this node holds a seat, off disk.
// Neither answer has a membership term in it.
//
// `owned` is now a COMPARISON rather than a search — is the key this box
// names as its owner my key — which is the same fact the roll row
// marked `owner` carried, arrived at without reading anybody else's row.
function probe(rootDir, request, myKey) {
  var relays = loadRelays(rootDir);

  // One read for the whole pass. See relayKeys.seatedUrls for why a pinned
  // relay with no recorded seat counts as one: on a node that predates the
  // seat record, the pinned set IS the membership set.
  var seated = Object.create(null);
  if (relayKeys) {
    relayKeys.seatedUrls(rootDir).forEach(function (u) { seated[u] = true; });
  }
  function hasSeat(url) {
    return !!(relayKeys && seated[relayKeys.normalizeUrl(url)]);
  }

  return Promise.all(relays.map(function (relay) {
    return Promise.resolve()
      .then(function () { return request(relay.url, 'GET', '/api/relay/key'); })
      .then(function (answer) {
        var said = null;
        try { said = JSON.parse(answer && answer.text); }
        catch (e) { said = null; }

        var badge = {
          url: relay.url,
          label: relay.label,
          // `status > 0` is what tells "answered" from "unreachable"
          // downstream (natter.natterCheckBinding), and it still does.
          status: Number(answer && answer.status) || 0,
          owned: !!(said && said.ownerKey && myKey && said.ownerKey === myKey),
        };

        // OWNING IMPLIES CLAIMING — the owner holds a peer row from first
        // claim — so this is true of an owner too, and `summarize` no
        // longer has to say `owned || claimed`. It also covers an owner
        // whose seat predates the record and was never pinned.
        badge.claimed = badge.owned || hasSeat(relay.url);

        // Kept only for a row this node is actually on. A relay it merely
        // lists tells it nothing, and a panel is not offered for one.
        //
        // STILL CALLED `roll` AND IT IS NO LONGER ONE. The name is the
        // apps' and changing it is their commit, not this one
        // (SURFACE.md §10, step 2). What it carries is what the key door
        // answers; `roster`, `peers` and `myLabel` are gone, and every
        // reader of those already guards with `|| []`.
        if (badge.claimed) {
          badge.roll = {
            owner: (said && said.ownerLabel) || '',
            relayKey: (said && said.relayPublicKey) || '',
            relayLabel: (said && said.relayLabel) || '',
            // What this box calls this node. natterDetails draws it as
            // the "You" row, and it is the same fact as `claimedLabel`
            // below — two names for one thing, which step 2 collapses.
            myLabel: relayKeys ? relayKeys.seatLabel(rootDir, relay.url) : '',
          };
          // What this relay calls this node, as recorded when the claim
          // was granted. Empty on a backfilled seat — the label was never
          // written down, and inventing one would be worse than silence.
          badge.claimedLabel = relayKeys ? relayKeys.seatLabel(rootDir, relay.url) : '';
        }
        if (!badge.owned && !badge.claimed) badge.error = 'no row here';
        return badge;
      })
      .catch(function (err) {
        // A mailbox that is down is not a mailbox we own. It says so on
        // the row rather than failing the whole probe: one unreachable
        // URL must not hide the badge on the others.
        return {
          url: relay.url,
          label: relay.label,
          owned: false,
          status: 0,
          error: String((err && err.message) || err),
        };
      });
  })).then(summarize);
}

// Which mailbox a mint goes to. `wanted` is the URL the human picked; it
// is honoured only if it is one this node actually lists, so a page (or a
// stale tab) cannot aim an owner-signed mint at a URL that is not in
// Natter. With nothing wanted there is a default only when there is no
// choice to make — never relays.json[0] out of habit.
function chooseUrl(urls, wanted) {
  var w = normalizeUrl(wanted);
  if (w) {
    if (urls.indexOf(w) === -1) {
      return { ok: false, status: 403, error: 'url not in app/natter/relays.json' };
    }
    return { ok: true, url: w };
  }
  if (urls.length === 1) return { ok: true, url: urls[0] };
  if (urls.length === 0) {
    return { ok: false, status: 503, error: 'no relay url in app/natter/relays.json' };
  }
  return { ok: false, status: 400, error: 'pick a relay url' };
}

// The node side gets everything. The browser gets the rules it has to
// obey and nothing that would need a filesystem — Natter reads
// window.spiritOwnerBadge, and if this script never loaded it finds no
// helper and draws no Remove at all, which is the safe way to be wrong.
if (isNode) {
  module.exports = {
    normalizeUrl: normalizeUrl,
    canRemoveRelay: canRemoveRelay,
    isPublicRelay: isPublicRelay,
    loadRelays: loadRelays,
    ensureRelays: ensureRelays,
    configuredUrls: configuredUrls,
    // The one row a node writes itself, exported so a test can assert the
    // default without repeating the string it is checking for.
    FIRST_RELAY: FIRST_RELAY,
    // `statusPath`, `readBadge`, `ownedFrom`, `claimedLabelFrom` and
    // `censusFacts` STOOD HERE (R3, then 2026-09-19): see where they stood.
    summarize: summarize,
    probe: probe,
    chooseUrl: chooseUrl,
  };
} else if (typeof window !== 'undefined') {
  window.spiritOwnerBadge = {
    normalizeUrl: normalizeUrl,
    canRemoveRelay: canRemoveRelay,
    isPublicRelay: isPublicRelay,
  };
}
