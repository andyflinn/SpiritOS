# Partner relays — one hop, and no further

**Shape agreed 2026-09-15. Nothing here is built.** Every claim about the
tree below was checked at `02f4bd1`.

> **Andy:** "if you can verify a peer, and we can verify each other, then
> I can verify your peer."

That sentence is the whole contract, and it is also the reason it stops
where it does. It names exactly three parties — me, you, your peer — and
each link is one I can check myself. *Your peer's peer* would require me
to trust a relay I never verified, which is where a web of trust begins
and inspectability ends.

> **Andy:** "the partner nodes only reach one level. We're currently not
> needing 6 degrees of separation."

> **Andy:** "referrals must be verifiable."

That is the generalisation, and it is what makes the reciprocity check the
load-bearing part rather than a formality. A referral nobody can check is
a rumour, and a relay that routes on rumour is a relay that can be talked
into anything. Every link in the chain above is checkable **by the party
relying on it, against public data, by key** — which is the only kind of
referral this design accepts.

## And the memory model forbids the second hop anyway

> **Andy:** "the highest memory demand on a relay comes from peerlist ×
> peerlists… that can only go max one hop."

This is the stronger argument, because it does not depend on anyone
agreeing about trust. If a relay holds its partners' member lists:

```
held rows  =  partners × members          (one hop)
           =  partners² × members         (two hops)
```

Measured against the live box — spirit-3 answers 9 rows in 1390 bytes, so
~154 B/row as JSON and call it ~460 B/row held as objects:

| partners | members each | one hop | two hops |
|---|---|---|---|
| 10 | 100 | 1 000 rows · 462 KB | 10 000 rows · 5 MB |
| 50 | 500 | 25 000 rows · 12 MB | 1 250 000 rows · **578 MB** |
| 100 | 1 000 | 100 000 rows · 46 MB | 10 000 000 rows · **4.6 GB** |

spirit-3 is a **~1 GB VPS**. One hop stays comfortable to a hundred
partners of a thousand members each. Two hops kills the box somewhere
around fifty partners — and the growth is quadratic, so it kills it
suddenly, on somebody else's decision to add a partner.

**That is the rule's real enforcement.** "We do not need six degrees" is a
preference and could be revisited; `partners² × members` on a 1 GB box is
arithmetic and cannot.

---

## The problem it solves

A relay delivers **between its own members and nobody else**. Two nodes on
two relays cannot reach each other at all:

```
routePost:  sender has no row here  → 403 "no such identity"
            target has no row here  → 404 "no such peer"
```

So a second public relay — `lab.andyflinn.com`, standing up the same day —
is a second island. Everything per-relay can be tested against it
(bindings, pinning, labels, the auto-add policy, owning one while being a
member of another) but a packet cannot cross.

---

## What is already true, and it is most of the mechanism

| fact | where |
|---|---|
| `GET /api/relay/who` is **public and unsigned** — 0010 calls it "what a node reads *before* it has anything" | `decisions/0010` |
| every census row carries `publicKey` and `owner` | `relay.who()` |
| so **"this peer owns a relay over there" is checkable against public data**, by key, with no new wire | — |
| a peer row already carries a boolean status (`owner: true`) — `partner: true` is the same shape in the same store | `relay.js` |
| relays already have keys of their own, and nodes already pin them | `relayKeys.json`, `ownerBadge` |
| **the hash survives a hop for free** — 0011 made it a function of bytes, computed at every party and carried by none, so a forwarded packet correlates end to end unchanged | `decisions/0011` |

That last one was not designed for this and pays off anyway, which is
usually the sign the decision was right.

### And one that is not true

**`relay.js` makes no outbound request of any kind.** No `fetch`, no
`http.request`. It is purely a server; every outbound call in this system
is made by a *node*. A relay that fetches a URL is a relay with an SSRF
surface, a timeout budget and a retry policy, on a box whose whole design
is to do less.

This is the real threshold in the proposal — bigger than the flag.

---

## Decided (Andy)

1. **A relay may promote a peer to `partner` in its own peer ledger.** Not
   a new store: a flag on the row, beside `owner`.
2. **Reciprocity is the test.** A partner is a non-owner peer here who owns
   a relay elsewhere, and both sides establish that fact through owner
   input. Neither relay takes the other's word for it.
3. **One level. No transitivity.** B's partners are not A's partners — for
   the trust reason above *and* because `partners² × members` does not fit
   on the box.
4. **A referral is only acceptable if it is verifiable** by the party
   relying on it, against public data, by key.

## Recommended (Claude), not yet decided

5. **The node fetches; the relay stores the conclusion.** The owner's node
   already fetches censuses per relay (`ownerBadge.probe`). Let it do the
   reciprocity check and post the result. The relay keeps `partner: true`
   and never learns how to reach out.
6. **One hop, full stop.** A forwarded post is never forwarded again. With
   two relays there is no loop to prevent; the rule has to be written while
   that is still true, and it makes (3) enforceable rather than merely
   intended.
7. **The partner's member list is a HINT, never an authority.** B checks its
   own ledger when a forward lands, as it does for any post. A stale hint
   then costs a wasted hop and a refusal — never a wrong delivery — which
   removes most of what makes a synced copy frightening.
8. **Write the 0006 carve-out in the same breath as the flag.** "Nothing is
   stored on a relay on anyone's behalf" is the decision a member-list copy
   presses on. A hint that is never persisted, never served and never
   authoritative is closer to a DNS cache than a store — but that is a
   distinction to *decide*, in the decision, rather than assert in a commit.

## Open

- **What a partner may do, beyond carrying one hop.** Start with the
  cheapest useful allowance and add deliberately. "Partner exists" is worth
  having before "partner may".
- **Is `partner: true` public in the census?** It is a public statement of
  association between two relays. Probably fine, possibly useful, not
  obviously either.
- **How the hint list is obtained and refreshed.** On demand per question is
  simplest and always correct; a RAM copy with a TTL is the optimisation.
  At ten peers neither is measurable — and the table above says when it
  stops being free, which is later than it feels.
- **What B answers when it refuses a forward.** A's caller learns *what*,
  and A learns something about its hint. Both are log entries nobody has
  specified.

---

## The delivery path, if all of the above lands

```
N1 ──post──▶ A ──forward (signed as A) ──▶ B ──deliver──▶ N2
```

- N1 signs the post; A verifies against N1's row on A.
- A signs the *forward* with its own relay key; B verifies against the
  partner key it pinned at promotion.
- **N1 never gains a row on B.** B relays the bytes and stores nothing —
  which is what keeps 0006 intact on the delivery half.
- All four parties compute the same hash over the same bytes, and none of
  them carries it.

---

## Build order, when it is time

The flag first, because until the hint list exists A simply refuses and
nothing is broken — it is just not routing yet.

1. `partner` on the peer row, promoted by an owner verb, with the
   reciprocity check performed node-side
2. the partner's relay key pinned at promotion
3. one-hop forward, with no-transitivity enforced rather than documented
4. the hint list — last, and smallest

Each step is useful alone, and the first three change nothing about what a
relay stores.
