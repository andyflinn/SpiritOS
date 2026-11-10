'use strict';
require('./spirit.js');

// spirit/run/spirit/relayKeys.js
// Which relay is which, remembered across restarts. Personal nodes only.
//
// Andy: "anybody can build a crooked relay that pretends to be true…. the
// best guard against that is to only use a relay that is somehow
// certified by 'self'."
//
// ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────
//
// It is trust-on-first-use for a relay's own identity, made durable.
// `answerRelay.js` already pinned `mailboxPublicKey` and explained why
// that is sound:
//
//   "a relay's key is made on its first --relay boot and does not change
//    while it is the same relay"
//
// Exactly right, and it makes the key a near-perfect thing to pin. But
// that cache lived in RAM for the life of one process: it was forgotten
// on every restart and believed whatever answered next time, so a relay
// swapped underneath a node was silent. This is the same pin, written
// down.
//
// IT PROVES CONTINUITY, NOT INTEGRITY. It answers "is this the relay I
// accepted?" and never "was that relay ever honest?" — a box that was
// crooked from its first boot pins perfectly. Saying so is the difference
// between a guard and a comfort, and it is why `accept` is a deliberate
// act rather than something this module does on a caller's behalf.
//
// ── WHY A CHANGE IS NOT AN ERROR ─────────────────────────────────────
//
// A changed key is reported, never resolved here. It has two innocent
// causes — a relay rebuilt from scratch, a URL repointed at a new box —
// and one guilty one, and nothing at this layer can tell them apart. So
// `check` returns what it saw and the decision belongs to whoever is in a
// position to ask a human.
//
// NODE-ONLY BY USE rather than by a `relayMode` gate: a relay does not
// connect to relays, so nothing on a relay ever calls this.
//
// ── A RELAY IS A ROW OF THE ONE TABLE (goal/G40.11) ──────────────────
//
//   Andy's box, v24: "seen, the shadow in node.db, is the one table. contacts.json, the relays table and the peers
//   table move into it and go."
//
// A relay is a row of seen with `relay` set, and its url is a route: "an ID's own address, a relay's or a node's on a
// LAN, is a direct route through no relay" — via empty, at the relay's own key. That route IS the pin: "an answer
// from a URL must come from the ID whose route it is; a new one is accepted, a different one refused and reported"
// (check below, asked by answerRelay). The list is the rows kept ("The relays shown on screens are the relays
// kept"), and home is every relay this node is seated on.
//
// WHAT A SEAT CARRIES IS NOT KEPT (box v24: "no seat verb; the node pushes its row, the relay holds what it was
// given"). The name a relay calls this node by is the node's own name, pushed to every relay (nodeCard.setName,
// Info's rename); the email is the node's to type, never stored. So seatLabel answers that name for a relay this
// node is seated on, and nothing here records more of a seat than `seated`.
//
// relayKeys.json and relays.json, the stores before goal/G19.15, are not read: the one table is the record (goal/G43.23,
// the box's item 7; Andy, goal/G41.30: "let's get rid of those "rescue operations"").

const fs = require('fs');
const path = require('path');
// Required on first use, not at load (reviewCleanup): written when a relay
// loaded this file through presenceNode and must not pull the node's store in.
// A relay loads no node code now (relayServer.js), so neither happens.
const nodeStore = { open: function (rootDir) { return spirit.require('spirit/nodeStore.js').open(rootDir); } };

// A URL is the ADDRESS a relay answers at, held on its keyed record, and
// one relay per address: two spellings of one URL must not become two
// records. Trailing slashes go; nothing else is touched, because a host is
// case-sensitive in paths and this module is not in the business of
// rewriting addresses.
function normalizeUrl(url) {
  return String(url == null ? '' : url).trim().replace(/\/+$/, '');
}

// RANK 1 (seenPeers.HOST): the relay's own card says it answers there, the strongest word there is.
const OWN_ROUTE_RANK = 1;

function seen(rootDir) { return nodeStore.open(rootDir).seen; }

// The direct route a relay answers at: its url, or ''.
function urlOf(rootDir, key) {
  const own = seen(rootDir).routes(key).filter(function (r) { return r.via === '' && r.at === key && r.url; })[0];
  return own ? own.url : '';
}

// One relay as its callers read it: { key, url, label, myLabel, keep, seated, mine, blocked }, or null.
function shaped(rootDir, r, url) {
  if (!r) return null;
  const u = url || urlOf(rootDir, r.publicKey);
  return {
    key: r.publicKey, url: u, label: r.myLabel || r.label || u, myLabel: r.myLabel, publicLabel: r.label,
    keep: r.keep, seated: r.seated, mine: r.mine, blocked: r.blocked,
  };
}

// The relay whose direct route this url is, or null.
function byUrl(rootDir, url) {
  const u = normalizeUrl(url);
  if (!u) return null;
  const route = seen(rootDir).byUrl(u);
  if (!route) return null;
  return shaped(rootDir, seen(rootDir).get(route.publicKey), u);
}
function byKey(rootDir, key) {
  const r = seen(rootDir).get(String(key == null ? '' : key).trim());
  return r && r.relay ? shaped(rootDir, r) : null;
}
function rowFor(rootDir, keyOrUrl) {
  const k = String(keyOrUrl == null ? '' : keyOrUrl).trim();
  if (!k) return null;
  return byKey(rootDir, k) || byUrl(rootDir, k);
}

// What is on record for this URL, or '' for nothing.
function pinned(rootDir, url) {
  const row = byUrl(rootDir, url);
  return (row && row.key) || '';
}

// THE WHOLE QUESTION, in one word.
//
//   'new'      nothing on record — first contact, the caller may accept
//   'match'    the relay is the one this node accepted
//   'changed'  a different key answers at the same address
//   'nokey'    the relay did not say — refuse, never record an absence
//
// No side effects. A read that quietly wrote its answer down would turn
// every substitution into an accepted one.
function check(rootDir, url, publicKey) {
  const given = String(publicKey == null ? '' : publicKey).trim();
  if (!given) return 'nokey';
  const have = pinned(rootDir, url);
  if (!have) return 'new';
  return have === given ? 'match' : 'changed';
}

// A DELIBERATE ACT, and the only thing that changes a pin. It overwrites a
// changed key rather than refusing to, because by the time a caller
// reaches here the change has been decided about by somebody entitled to
// decide — this module's job was to make sure it could not happen
// silently, and that job is done by `check`.
//
// The row is the relay's key, flagged relay, and the url its direct route. A changed key at the same address takes
// the address: the old key's direct route there goes, its row stays (who that was does not change because a box was
// replaced). A key that answered at another address before answers at this one now: one key is one relay.
function accept(rootDir, url, publicKey, atMs) {
  const u = normalizeUrl(url);
  const given = String(publicKey == null ? '' : publicKey).trim();
  if (!u || !given) return false;
  const S = seen(rootDir);
  const here = S.byUrl(u);
  const before = urlOf(rootDir, given);
  nodeStore.open(rootDir).transaction(function () {
    if (here && here.publicKey !== given) S.dropRoute(here.publicKey, '', here.publicKey);
    if (before && before !== u) S.dropRoute(given, '', given);
    // First known now, when nothing knew it before: the list's order (listed) is oldest first.
    S.set(given, { relay: true, firstSeen: atMs == null ? Date.now() : atMs });
    S.putRoute(given, { via: '', at: given, url: u, rank: OWN_ROUTE_RANK, told: atMs == null ? Date.now() : atMs });
  });
  return true;
}

// Every relay this node has accepted, as a key set. This is what the
// front door needs: a relay posts to a node in its own name, and that key is no contact — a relay is known by
// being one this node accepted.
function acceptedKeys(rootDir) {
  const out = Object.create(null);
  seen(rootDir).flagged('relay').forEach(function (r) {
    const u = urlOf(rootDir, r.publicKey);
    if (u) out[r.publicKey] = u;
  });
  return out;
}

// ── THE SEAT, WHICH IS THIS NODE'S OWN HISTORY ──────────────────
//
//   Andy: "doesn't the node persist the necessary connection information
//   when the bind occurs? A slot is claimed on the relay — at that point
//   the node must know relay ID, url, etc. Why would it not have its
//   memberships registered in a way that allows rapid re-connect?"
//
// `seated` on the relay's row (goal/G40.11): "that ID holds this node, a relay its seat ... Set by any post it carried
// or answered, cleared by a refusal as no member." A url with no record has no key to file a seat under: a claim
// accepts its relay, key and all, before it seats.
function setSeated(rootDir, keyOrUrl, on) {
  const row = rowFor(rootDir, keyOrUrl);
  if (!row) return false;
  if (row.seated === !!on) return false;
  // THE STAR GOES WITH THE SEAT (goal/G41.32; Andy, of a relay left or one that removes this node: "yes."): a relay this node is
  // no member of can not be starred, and its star opens this node's face.
  seen(rootDir).set(row.key, on ? { seated: true } : { seated: false, mine: false });
  return true;
}
function seat(rootDir, url) { return setSeated(rootDir, url, true) || !!(byUrl(rootDir, url) || {}).seated; }
function unseat(rootDir, url) { return setSeated(rootDir, url, false); }

// THE OWNER'S SEAT, NOTED ON HIS NODE (goal/G40.10; Andy: "the relay on every boot has to fucking make sure the owner
// has a seat"). A relay's report to its owner says what it calls him (`owner`): that relay holds this node. The seat
// and nothing more. NOT THE STAR (goal/G41.30; Andy: "this button will put the star on relays and puppets. AND take it
// away."): any relay can send this report, and a relay's star opens this node's face, so only contact.own sets it. True
// when written, false when there was nothing to write or it already said so, so a report every few seconds writes
// nothing.
function ownerSeat(rootDir, url, label) {
  if (!String(label == null ? '' : label)) return false;
  const row = byUrl(rootDir, url);
  if (!row || row.seated) return false;
  seen(rootDir).set(row.key, { seated: true });
  return true;
}

// Where this node holds a seat: its home (box v24: "Home is every relay this node is seated on").
function seatedUrls(rootDir) {
  return seen(rootDir).flagged('seated')
    .filter(function (r) { return r.relay; })
    .map(function (r) { return urlOf(rootDir, r.publicKey); })
    .filter(Boolean);
}

// What a relay this node is seated on calls it: this node's own name, which it pushes to every relay (see the head
// of this section). '' where it holds no seat.
function seatLabel(rootDir, url) {
  const row = byUrl(rootDir, url);
  if (!row || !row.seated) return '';
  try { return String(spirit.require('spirit/relayAuth.js').loadIdentity(rootDir).name || ''); }
  catch (e) { return ''; }
}

// ── THE FACE NAME THIS NODE HOLDS ON A RELAY (goal/G30.1, on the row since goal/G40.11) ──
//
//   Andy, 2026-10-26: "Face name: keep it, on the relay's row, as the node's own fact, like myLabel."
//
// The node set it itself (relay.face, the relay said yes; peerPost.keepFaceAnswer), so it is the node's own fact
// and not something the relay tells it. The name alone: no email is kept (box v24). A url with no record has nothing
// to file under: false.
function keepFace(rootDir, url, name) {
  const row = byUrl(rootDir, url);
  if (!row) return false;
  seen(rootDir).set(row.key, { face: String(name || '') });
  return true;
}
// The face name this node holds on that relay, { name }, or null.
function faceOf(rootDir, url) {
  const row = byUrl(rootDir, url);
  const r = row && seen(rootDir).get(row.key);
  return r && r.face ? { name: r.face } : null;
}

// ── THE NODE'S RELAY LIST: THE RELAYS KEPT (goal/G40.11) ─────────────
//
// ownerBadge keeps the rules (which relay is kept, which may go); these are its reads and writes. Kept relays, home
// first and then oldest first, as { label, url }: the first is the one hub.loadRelayUrl speaks to.
function listed(rootDir) {
  return seen(rootDir).flagged('keep')
    .filter(function (r) { return r.relay && !r.blocked; })
    .sort(function (a, b) { return (b.seated - a.seated) || (a.firstSeen - b.firstSeen) || (a.lastSeen - b.lastSeen); })
    .map(function (r) {
      const u = urlOf(rootDir, r.publicKey);
      return { label: r.myLabel || r.label || u, url: u, key: r.publicKey };
    })
    .filter(function (r) { return !!r.url; });
}

// Put a relay on the list. A url already on record keeps its key and its name; a url never met needs the key
// learned at first contact, or nothing can key it and nothing is written.
function list(rootDir, url, label, publicKey) {
  const u = normalizeUrl(url);
  if (!u) return false;
  if (!byUrl(rootDir, u) && !accept(rootDir, u, publicKey)) return false;
  const row = byUrl(rootDir, u);
  const fields = { keep: true };
  if (!row.myLabel && label && String(label) !== u) fields.myLabel = String(label);
  seen(rootDir).set(row.key, fields);
  return true;
}

// Off the list. The row stays, and with it the pin and the seat.
function unlist(rootDir, url) {
  const row = byUrl(rootDir, url);
  if (!row || !row.keep) return false;
  seen(rootDir).set(row.key, { keep: false });
  return true;
}

// ── THE SEEDS, ASSERTED AT BOOT (goal/G19.15) ────────────────────────
//
//   Andy, 2026-10-12: "on boot, the node asserts the contents of
//   "noderoutes.net" ... in the database, by creating those rows, if they
//   don't exist", "we will pre-seed WITH keys", and "we only list
//   noderoutes.net, spirit.andyflinn.com is OURS."
//
// A seed already on record by its key is left exactly as it is, kept or
// not. A seed whose url is on record under a different key is left too:
// that key is this node's own pin, and a change of key is check's to
// report, not boot's to overwrite. `seeds` is ownerBadge.SEED_RELAYS.
function assertSeeds(rootDir, seeds, atMs) {
  (seeds || []).forEach(function (s) {
    const key = String((s && s.key) || '').trim();
    const u = normalizeUrl(s && s.url);
    if (!key || !u || byKey(rootDir, key) || byUrl(rootDir, u)) return;
    accept(rootDir, u, key, atMs);
    seen(rootDir).set(key, { keep: true, myLabel: String(s.label || '') });
  });
}

module.exports = {
  normalizeUrl: normalizeUrl,
  byUrl: byUrl,
  byKey: byKey,
  pinned: pinned,
  check: check,
  accept: accept,
  acceptedKeys: acceptedKeys,
  seat: seat,
  unseat: unseat,
  setSeated: setSeated,
  ownerSeat: ownerSeat,
  seatedUrls: seatedUrls,
  seatLabel: seatLabel,
  listed: listed,
  list: list,
  unlist: unlist,
  assertSeeds: assertSeeds,
  keepFace: keepFace,
  faceOf: faceOf,
};
