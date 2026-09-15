'use strict';

// The owner badge, and nothing more: for each URL in app/natter/relays.json,
// does a signed GET /api/relay/status come back 200 with a report?
//
// That is the whole definition (DICTIONARY.md, "Owner badge"; CYCLE-A.md).
// The mailbox already answers "is this key the owner here?" every time the
// owner asks for a census, so the badge gets no endpoint of its own: a
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
function canRemoveMailbox(relays, url) {
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
// He was right, and it was redundant three ways over. The census below
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
// costs one fewer request per relay: the census answers `owned` and
// `claimed` together.

// readBadge STOOD HERE — *"200 alone is not the badge"* — parsing the
// owner-only report to decide whether this key owned the box. It went
// with the route it read (R3).
//
// IS MY KEY THE ONE MARKED OWNER? Asked of the public census, which
// publishes `owner: true|false` on every row
// ([relay.js] `who()`), so this costs no signature, adds no endpoint, and
// tells the relay nothing it did not publish.
//
// BY KEY, which is the whole point of the change. The route this
// replaces asked by NAME and proved it with a signature over that name —
// a label standing in for an identity, on a box where identity is a key
// and labels duplicate by design.
//
// THE ONE THING THIS IS WEAKER AT, stated rather than discovered: the
// census flag is written at claim time (`owner: firstOwner`) while
// `allow.json` is the live authority `checkOwner` reads. They are
// written together and can only diverge if somebody hand-edits
// allow.json on the box — the documented break-glass path — so the flag
// can go STALE, never false. A relay pushing `relay-status` reads
// allow.json every time and has no such gap, which is why that is the
// authoritative refresh and this is the opening answer.
function ownedFrom(answer, myKey) {
  if (!myKey || !answer) return false;
  var parsed = null;
  try { parsed = JSON.parse(answer.text); }
  catch (e) { return false; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return false;
  return list.some(function (p) {
    return p && p.publicKey === myKey && !!p.owner;
  });
}

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

// request(url, method, pathname) -> Promise<{ status, text }>
// Is one of this relay's rows ours? Asked of the PUBLIC census, which
// hands every label and key to anyone — so this costs no signature, adds
// no endpoint, and tells the relay nothing it did not publish.
//
// Only asked when the owner badge already said no: owning implies a row,
// so the second request is skipped on the mailboxes that matter most.
function claimedFrom(answer, myKey) {
  if (!myKey || !answer) return false;
  var parsed = null;
  try { parsed = JSON.parse(answer.text); }
  catch (e) { return false; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return false;
  return list.some(function (p) { return p && p.publicKey === myKey; });
}

// AND WHICH LABEL THAT ROW WEARS. The census already carries it and it
// was being thrown away — `claimedFrom` above reads the same list and
// answers only yes or no.
//
// It is here because Natter needs an answer to "is this label still
// mine?" and used to get one by signing an inbox read: a 403 meant the
// label had moved. R8 deleted that route on 2026-09-15, and the census
// answers the question better than the read ever did — it is the same
// fact, unsigned, off a route that is public by design, with no second
// request and no endpoint added.
//
// BY KEY, ANSWERING A LABEL, which is the only direction that is safe.
// Two peers may wear one label, so a label does not identify a row; a
// key does. Asking "what is my row called here" cannot be ambiguous.
// Asking "who is called andy" can.
//
// '' when this key holds no row — which is also what a relay that has
// forgotten you says, and the two are the same answer to Natter.
function claimedLabelFrom(answer, myKey) {
  if (!myKey || !answer) return '';
  var parsed = null;
  try { parsed = JSON.parse(answer.text); }
  catch (e) { return ''; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return '';
  var mine = null;
  list.forEach(function (p) {
    if (p && p.publicKey === myKey && !mine) mine = p;
  });
  return mine ? String(mine.publicLabel || '') : '';
}

// WHAT A MEMBER MAY SAY ABOUT A MAILBOX IT DOES NOT OWN.
//
// The census is already fetched to answer claimedFrom above, and was
// then thrown away — so a member's panel had nothing to show but the
// 403 from the owner-only status call, and opened onto the words "not
// the owner". An error is the wrong thing to put in front of somebody in
// the ordinary case of being a member.
//
// Only what /api/relay/who already hands to anyone who asks. No second
// call, no signature, and nothing here the mailbox did not publish —
// which is also why there is no question about a member reading it.
//
// Deliberately NOT the peer list itself: a wall of 48-character keys is
// machine detail wearing a person's clothes (UI_DESIGN_STYLE.md §6), and
// the count is what a person is actually asking.
function censusFacts(answer, myKey) {
  var parsed = null;
  try { parsed = JSON.parse(answer && answer.text); }
  catch (e) { return null; }
  var list = (parsed && parsed.peers) || [];
  if (!Array.isArray(list)) return null;

  var owner = '';
  var mine = '';
  list.forEach(function (p) {
    if (!p) return;
    if (p.owner) owner = p.publicLabel || '';
    // YOUR OWN LABEL ON THIS BOX, which is the fact that only exists
    // once a node is on more than one. Nothing says two mailboxes gave
    // you the same name, and with one browser now serving every relay
    // this node holds, "who am I here" is a question with a per-relay
    // answer.
    if (p.publicKey === myKey) mine = p.publicLabel || '';
  });

  return { owner: owner, peers: list.length, myLabel: mine };
}

// ONE REQUEST PER RELAY, and it is the public census.
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
// and both come from the census by key, so a caller without one gets
// nothing and should.
function probe(rootDir, request, myKey) {
  var relays = loadRelays(rootDir);
  return Promise.all(relays.map(function (relay) {
    return Promise.resolve()
      .then(function () { return request(relay.url, 'GET', '/api/relay/who'); })
      .then(function (census) {
        var badge = {
          url: relay.url,
          label: relay.label,
          status: Number(census && census.status) || 0,
          owned: ownedFrom(census, myKey),
        };
        // OWNING IMPLIES CLAIMING — the owner holds a peer row from first
        // claim — so this is true of an owner too, and `summarize` no
        // longer has to say `owned || claimed`.
        badge.claimed = claimedFrom(census, myKey);
        // Kept only for a row this node is actually on. A relay it merely
        // lists tells it nothing, and a panel is not offered for one.
        if (badge.claimed) {
          badge.census = censusFacts(census, myKey);
          // What this relay calls this node — see claimedLabelFrom for
          // why Natter needs it and what it replaced.
          badge.claimedLabel = claimedLabelFrom(census, myKey);
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
    censusFacts: censusFacts,
    normalizeUrl: normalizeUrl,
    canRemoveMailbox: canRemoveMailbox,
    isPublicRelay: isPublicRelay,
    loadRelays: loadRelays,
    configuredUrls: configuredUrls,
    // `statusPath` and `readBadge` STOOD HERE and went with the signed
    // status GET (R3). `ownedFrom` is what answers the same question now,
    // off the public census and by key.
    ownedFrom: ownedFrom,
    // Exported for the suite that drives it directly. Natter reads the
    // answer off a `rows` entry, never by calling this.
    claimedLabelFrom: claimedLabelFrom,
    summarize: summarize,
    probe: probe,
    chooseUrl: chooseUrl,
  };
} else if (typeof window !== 'undefined') {
  window.spiritOwnerBadge = {
    normalizeUrl: normalizeUrl,
    canRemoveMailbox: canRemoveMailbox,
    isPublicRelay: isPublicRelay,
  };
}
