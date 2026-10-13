# Partner relays — obsolete since 2026-10-13 (goal/G22.6)

**This design is withdrawn. Nothing in it is in force.** This page is only the
record of that, kept so a link to it lands somewhere that says so.

## The decision

Andy, goal/G22.6 box, 2026-10-13:

> Partnering as a permission goes, in this item: a relay carries posts to its
> members from any relay, the member's one slot in flight counted per sender
> (the October 10 review's M5) so no stranger can keep a member busy; the
> partner roll and the partner budget are removed; design/relay/PARTNERS.md is
> reduced to a dated record of its own obsolescence.

## What replaced it

- **A relay's one door takes signed posts from keys it does not hold.** A
  stranger may ask the relay itself for its card (its key) and for a claim, and
  may post to one of the relay's own members; everything else from a stranger
  is refused with "your id is not a valid sender here". Strangers are held by
  the relay's in-memory table of requesting addresses (relay.js,
  `strangerAdmit`). See [SURFACE.md](SURFACE.md).
- **A member's slot is counted per sender** (router.js), so one sender holding
  a request to a member does not make that member busy for anybody else.
- **A relay carries nothing onward.** The forward to a partner, the partner
  search fan-out, route hints read by the relay, partner liveness and the
  `partner` stream event are gone with the roll they depended on.

## What was removed (goal/G22.6)

- relay.js: the partner roll (`setPartner`, `clearPartner`, `partners`), the
  partner identity at the door, the partner budget (`PARTNER_FLOOR_PER_MIN`,
  `partnerHits`), the owner verbs `partner` and `unpartner`, the member verb
  `partners`, the `forward` verb, `carryToPartner` and its route hints, the
  search fan-out to partners, partner liveness and its `partner` broadcast.
- router.js: the `partner` requester class.
- relayStore.js: the `partners` table is no longer created or read. A relay.db
  that still holds one opens and keeps working; the table is left untouched.
- relayServer.js: the relay's own peerPost to its partners (`askPartner`).
- partnerAvailability.js, and the node's handling of the `partner` event.
- natterDetails: the Partner relays panel.

## Where the old text is

The full design as it stood — the one-hop rule, the memory arithmetic, tiers
one to three, the status at `9110393` — is in git, last at `d403629b`:
`git show d403629b:design/relay/PARTNERS.md`.
