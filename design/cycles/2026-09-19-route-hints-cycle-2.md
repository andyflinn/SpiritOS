# 2026-09-19 — route hints end to end

**Status: OPEN.** First scaffolding cycle of the build sequence
([NODE-AND-RELAY.md](../principles/NODE-AND-RELAY.md), *Build sequence*),
locked in by Andy:

> *"Hints and the relay broadcast streaming new connections to nodes must
> come early, so that the current contacts files on the nodes slowly
> accumulate 'valid' data, and so that the relay development can deal with a
> relatively complete behaviour of nodes."*

The discrepancy it closes had dangled on both sides: the relay could forward
to a partner (`routePost` took `atRelayKey`) but no route carried one, and the
node never sent one — `peer.post` to a contact on a foreign relay was
`503 not reachable`. Contacts mixed relay URLs and relay keys in one list.

The shape was already designed (SURFACE.md §8, Andy): hints are **siblings**
of the signed packet, `{ from, to, text, sig, hints, hintSig }`, consumed and
dropped by the first relay, never inside `PAYLOAD_MAX`.

## Requirements

### R1 — hints on the wire, signed beside the packet

`POST /api/relay/post` accepts optional `hints` (relay keys) and `hintSig` —
the sender's signature over `relayAuth.hintMessage(sig, hints)`, bound to this
packet by its own signature so a hint block cannot be lifted onto another.
Bounded by `limits.HINTS_PER_POST` (4, a declared number — *"not vital"*,
Andy); their bytes sit in `limits.HINTS_MAX`, added to `BODY_MAX`, never in
the payload. No new route, verb or event.

**Verify:** `spirit/test/routeHints.js` — unsigned, lifted and over-bound
hints refused; and `spirit/test/hintWire.js` — accepted from the wire (202).

**Status:** DONE

### R2 — the relay chooses one partner: live, then minted, else refused

`relay.partnerFromHints`: of the hinted relays this relay partners with, a
**live** one first (the partner holds its own stream here), then a **minted**
one (partnered, not live). One partner, never a broadcast, no fallback to a
second on failure. None of them a partner: **409 "minting incomplete"**, at
once. *Starting the minting cycle with the owner is cycle 5 (acquisition);
here the refusal is the whole answer.* A target on this relay is delivered
locally whatever the hints say. Hints are dropped at this hop.

**Verify:** `spirit/test/routeHints.js` — [D, B] goes to B alone (live before
minted), [D] goes to D, a non-partner hint is 409, a local target is
delivered locally; `spirit/test/hintWire.js` — 409 over the wire.

**Status:** DONE

### R3 — the node sends hints from its contacts

Contact rows gain **`routes`** — relay keys only, newest first, a bounded few
(`contacts.js`). `learnRoute` writes there and never creates a row; `relays`
(URLs) is left as it was and no longer read on the post path.
`hub.handlePost`: target present on a relay this node holds → as before;
otherwise the contact's `routes` go as hints through the node's first
connected relay. `peerPost.post(relayUrl, toKey, text, hints)` signs them.
`router.post` is still called in one place.

**Verify:** `spirit/test/routeStash.js` — the route lands in `routes` as a
key, not in `relays`; `spirit/test/routeHints.js` — peerPost's own body is
accepted by the relay.

**Status:** DONE

### R4 — a proven route reaches other members as a relay key

A forward answered by the target is announced `('route', { key, at })`, `at`
= the partner's relay key — unchanged in shape, and now reachable from the
wire. A member whose node holds that key as a contact stashes it in `routes`.

**Verify:** `spirit/test/hintWire.js` — amy on A hears
`{ key: bertrand, at: B's relay key }` after alice's hinted post is answered.

**Status:** DONE

### R5 — nothing is tunnelled that cannot survive the tunnel

`limits.fitsWrapped(text, from, to, sig)` — exact, not a constant: build the
wrapper the relay would build and measure it. A node's `peerPost` checks it at
compose (`checkTunnel`, on for the node, off for a relay's own partner
posts); the relay checks it again in `carryToPartner`. Either refuses with
413 before anything leaves, never at the far hop after signing.

**Verify:** `spirit/test/routeHints.js` — 16,000 plain bytes fit wrapped,
9,000 quotes do not; refused by the relay and at compose;
`spirit/test/hintWire.js` — 8,300 quotes pass the socket and are refused at
A, never at B.

**Status:** DONE

### R6 — and the same on the way back

> **Andy:** *"Amend. And cover the reply route as well."*

A reply to a tunnelled post is wrapped whole into the far relay's answer to
its partner — `{ v, body: { ok, status, forwarded: { from, text, sig } } }` —
and had no size check at all on that path. `limits.fitsWrappedReply` measures
that wrapper. The far relay refuses an oversize reply in `routeReply` with
413 to the replier and tells the partner relay why; the replying node, which
cannot know whether the request crossed a partnership, checks at compose
(`checkTunnel`) and sends the receipt without the answer, logging
`reply too big to tunnel`.

**Verify:** `spirit/test/routeHints.js` — the predicate on both cases, the
far relay's 413 and its answer to the partner, and the node's compose check
with and without `checkTunnel`.

**Status:** DONE

### R7 — an error on the far side travels down the chain

> **Andy:** *"Before post arrives at N2 and an error occurs, only N1 will be
> informed. If N2's reply exceeds size limit, then B will notify N2 of its
> misconduct and send an error down the reply chain."* — *"Fix."*

- **Before N2**, refused at A: N1 is told at once, as before. Refused at B
  (the target not connected) after A accepted: B's refusal comes back to A,
  which now passes it on.
- **N2's reply oversized**: B tells N2 on the answer to its own reply
  request (413), and tells A "reply was oversized", which A passes on.
- **How A passes it on, with no new word on the wire:** an ordinary
  `reply` for the same hash, signed by **A itself** (`from` = A's relay
  key), body `{ ok: false, status, error, relayed: true }`. The route is
  cancelled first, so nothing is delivered twice. N1's `peerPost.onReply`
  settles a reply signed by anyone other than the target as a failure
  marked `relayed` — never as N2's answer. Registered in 0010.

**Verify:** `spirit/test/hintWire.js` — alice told "peer not reachable"
(bella not connected) and "reply was oversized", both signed by A;
`spirit/test/routeHints.js` — the asking node settles a relay-signed
reply as a relayed failure.

**Status:** DONE

## Open
- **`MATCH_BUDGET = PAYLOAD_MAX - 512`** left as it was: nothing measured in
  this cycle is evidence to move it (SURFACE.md §8 asks that it change only
  with evidence).
- **The route broadcast still goes to every member** — `members × changes`
  (0013). Scoping it to members who hold the key as a contact is the open
  item recorded in NODE-AND-RELAY.
- **"Minting incomplete" starts nothing yet.** The minting cycle is cycle 5.
