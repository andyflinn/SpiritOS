# 0012 — A relay never asks for a member list

**Decided 2026-09-17. Against `86b6fe2`. Not implemented — nothing to implement.**

> The get-complete-member-list could be dropped altogether. That's the slimmest
> initial load guaranteed at startup, with no instant explosive growth. (Andy)

## The decision

**There is no verb by which one relay can ask another for its members, and there
will not be one.** Not refused, not bounded, not paginated, not owner-only —
**absent**. The partner vocabulary is two words: `search` and `forward`.

This supersedes Grok's ruling of the same day, *"refuse member roll"*. Refusing
leaves the verb in the vocabulary, and **a refused verb is one somebody writes a
bounded version of in six months**, with a good reason and a small limit, and
then the limit is raised once.

## Why it can go: nobody needs it

It existed so a relay could resolve a key to a partner — the **hint list**,
`members × ~460 B` per partner, described earlier in `relay/PARTNERS.md`.

Two changes the same day removed every caller:

**1. A forwards to B; it does not route to B's member.** The corrected framing
is `N1 → A → B → N2`, where A's request to B says *"forward this to your member
K"*. So **A never has to know that B has K** — B knows. There is nothing to
look up, so there is no list to look it up in.

**2. The route comes from the node, not from the relay.** A search row already
carries the partner's URL (`hub.js` resolves `via` → a URL before the row
reaches the browser), and *"one route is the floor, the list is the point"* in
`PARTNERS.md` has the node persisting routing options and supplying them. **That
job moved off the relay, and the hint list did not notice.**

## Why it must go: demand, and structure

**It fails the test in `CAPACITY.md`, decided item 0** — *a relay spends nothing
in anticipation*. A member list is memory consumed before anybody asked for
anything, on the chance that somebody will. Everything else a relay holds is the
trace of a real request: a route while a post is in flight, a presence entry
while a socket is open.

**And it makes an existing rule structural rather than enforced.** *"A relay
never persists a partner's members"* has been policy since 2026-09-15 — a thing
a reviewer had to remember. It is now a fact about the protocol: **no verb could
deliver them.** That is the same shift the one-hop rule gets from `propagate =
!fromPartner` — a rule that cannot be broken needs nobody to police it.

## Impact on load

The figures are `PARTNERS.md`'s own, measured against the live box: spirit-3
answers 9 rows in 1390 bytes, so ~154 B/row as JSON, ~460 B/row held as objects.
spirit-3 is a **~1 GB VPS**.

**What the hint list would have cost, and now cannot:**

| partners | members each | held rows | one hop |
|---|---|---|---|
| 10 | 100 | 1 000 | 462 KB |
| 50 | 500 | 25 000 | 12 MB |
| 100 | 1 000 | 100 000 | 46 MB |

**All of it becomes zero.** Not smaller — the `partners × members` term does not
appear anywhere, at any hop count, so it cannot be reintroduced by a later
optimisation without adding a verb that this decision says does not exist.

**What a relay holds instead:**

| | before | after |
|---|---|---|
| at boot | own members **+ every partner's members** | own members |
| per partner added | `members × ~460 B` | one row in `partners.json`, one held stream |
| steady state, spirit-3 | 9 rows + partners' rows | **9 rows ≈ 4 KB** |
| growth as the mesh grows | linear in *other people's* membership | **none** |

The last row is the one that matters. Before this, **a relay's memory was a
function of decisions other people made** — a partner enrolling five hundred
members enlarged your box, and you found out by running out. After it, a relay's
footprint is a function of its own membership and its own traffic, both of which
its owner can see.

It also removes the only startup cost that was not bounded by a local number:
**boot is `O(own members)`**, always, whatever the mesh is doing.

## What it costs

**A cold post with no route becomes a hunt.** If the node cannot name the relay,
A must ask each partner *"do you hold K?"* — N small questions on the bus that
already exists, bounded by partner count (~19 in the worked example), rather
than one local lookup.

That is **latency, not memory**, and it is the state `PARTNERS.md` already calls
safe: *"memory pressure degrades performance, not connectivity. A relay that
sheds every hint list it holds still routes everywhere it did; it is just slower
and chattier while it does."* Dropping the roll means **always** operating in
the mode the shedding policy was designed to fall back to — so the fallback path
is now the only path, and gets exercised rather than rotting.

It is also the uncommon path and getting less common: the node persists routes,
so the hunt happens for a peer nobody has posted to before.

## What it does not change

- **Search is untouched.** It is a *question*, not a transfer — bounded at 32
  slots, candidates rather than a list. The thing this decision forbids is
  bulk, not enquiry.
- **Nothing becomes more private.** Every census is public in full at
  `/api/relay/who`; anyone who wants a partner's membership can fetch it as a
  stranger. What is refused is a relay **holding** it, which is 0006's
  distinction between a register and a custodian.
- **Partnering still costs almost nothing when idle** — one row and one stream —
  which is what makes two relays on one VPS reasonable
  (`CAPACITY.md`, decided item 8).

## Amended by 0013 — "does not appear anywhere" is too strong

This decision says the `partners × members` term **does not appear anywhere, at
any hop count**. [0013](0013-a-relay-is-fixed-cost-per-time-unit.md) permits a
relay to hold a **working set** of routes in RAM — keys its own members asked
about — which is a bounded form of that term. The sentence should read: **no
stored term, and no verb that fetches one.**

The distinction is what both decisions rest on:

- **never persisted** — a relay that reboots is re-primed by its members' next
  requests, so boot stays `O(own members)`;
- **never fetched as a roster** — there is still no verb that delivers a
  partner's members, which is this decision's structural guarantee intact;
- **bounded by member demand**, not by partner membership — so it is a function
  of this relay's own members, which is what 0013's invariant permits.

## Related

- **0006** — nothing is stored on a relay on anyone's behalf. This removes the
  last thing a relay would have held that was about somebody else.
- **0007** — a relay survives and earns its keep. Its survival no longer depends
  on other owners' membership decisions.
- `relay/PARTNERS.md` — the retraction of the "four gates", the two-verb build
  list, and the memory model these figures come from.
- `relay/CAPACITY.md` — decided item 0 (demand), item 8 (declared budget),
  item 10 (this decision's working).
