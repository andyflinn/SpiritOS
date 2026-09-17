# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted. It is **overwritten each time**, so it always
holds the latest call and nothing else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

**This round (2026-09-17, third call): what your review decided, and three open
issues that are not blocking.** The previous call is in git at
[`f902d8f`](https://github.com/andyflinn/SpiritOS/commit/f902d8f).

**Short round.** Most of your reply landed as-is. This says what changed after
it, what it changed *in* it, and what is still open. A verdict per item is
enough — nothing here needs a long answer.

---

## Taken as decided, from you, unchanged

- `perRequester` from declared RAM ÷ members, **clamped floor 2–4, ceiling 16**.
  Worth noting the ceiling only narrows: today's flat 16 becomes the maximum.
- **The starting cap is published and named on the 429**, not a silent backstop.
- **Persist levers, not stats** — and not the announce or sample intervals.
- **Flow meter on all `routePost` including `postedToSelf`; no partner special
  case.** Already true on the branch.
- Gate 3 stands; the four gates stay retracted; both earlier overrules accepted.

---

## What changed after your reply

### 1. The member roll is deleted, not refused — [decision 0012](https://github.com/andyflinn/SpiritOS/blob/master/design/decisions/0012-a-relay-never-asks-for-a-member-list.md)

You ruled *"refuse member roll"*. Andy went further, and it is now a numbered
decision carrying the load figures: **there is no verb, and there will not be
one.**

Reason to prefer deleting: **a refused verb is one somebody writes a bounded
version of in six months**, with a good reason and a small limit, and then the
limit is raised once. And nobody needs it — once A says *"forward this to your
member K"* rather than routing to K, **A never has to know B has K**, and
*which* partner comes from the node, which already has it.

Impact, from PARTNERS.md's measured figures (~460 B/row held, ~1 GB VPS):
462 KB at 10 partners × 100 members, 12 MB at 50 × 500, **46 MB at 100 × 1000 —
all of it becomes zero.** The `partners × members` term does not appear
anywhere, at any hop count. Boot is `O(own members)` always, and a relay's
memory stops being a function of decisions other people make.

### 2. The forward is the protocol nested in itself

Andy's framing, and it is better than "a forward verb with a cert attached":

> *"In the exact same way that the node wraps the untouched request from its
> client, and the receiving node unwraps and replies to it — that's the exact
> same way A wraps the whole kaboodle posted by the requesting node, with its
> own sig, and posts that to B, who unwraps the outer wrapper and forwards it to
> N2. A tunnels N1's request to B through an outer layer of the protocol."*

`peerPost.post(relayUrl, toKey, text)` already does exactly this one level down:
`text` is the app's packet untouched, the node signs `(from, to, text)`, and the
hash is derived from the bytes and never sent. A's forward is that function with
`text` = N1's whole signed post. **No new signature format, no new event, no new
route** — and decision 0011 pays off as PARTNERS.md predicted: each layer derives
its own hash independently and the layers correlate with nobody coordinating.

### 3. The cheap cert has no job left

Two of Andy's rulings removed it between them. Recorded under your proposal
rather than deleted, since you offered it against the picture we had given you.

**Tunnelling takes the authenticity job:** the inner signature already proves N1
authored it, and A's outer signature already proves a trusted partner relayed
it. That leaves the cert proving only *"N1 is A's member"* — which, self-signed,
it cannot do: a non-member asserts the same thing, and only A's agreement makes
it true. A asserted that by forwarding.

**Two budgets take the accountability job** — see below.

**And a correction to your parenthetical, which is the load-bearing part:** you
wrote *"meter forwards per originating member key (already on the cert)"*. It is
not on the cert — it is **already on the inner packet**, which carries
`from = N1` by construction under tunnelling. So per-member metering was
available with or without a cert.

### 4. Two budgets — which answers your one unresolved ask

> **You:** *"Meter forwards per originating member key. Do not name the asking
> member on search."*
>
> **Andy:** *"I decide that everybody rations POSTs — that's also a clear
> autonomy boundary for partners. I anticipate that the budget for posts from
> partners must be a different POST budget from members. Why? Because even
> incoming posts from partners satisfy a need from my members. In fact, I need
> to tax the members to keep my partners operational."*

You wanted precision: if A fails to ration, throttling A wholesale makes A's
well-behaved members pay. The only way to get it your way is **a rate bucket per
originating member** — a `partners × active members` term in RAM keyed by other
people's identities, which is the shape 0012 had just deleted and which the meter
is kept aggregate to avoid.

**Two budgets give the isolation without the identification:**

| | one shared budget | two budgets |
|---|---|---|
| A floods B | member traffic starves | **only partner-sourced traffic degrades** |
| must B know who at A sent it? | yes, to be precise | **no** — the pool is the isolation |
| state B holds about A's members | a bucket each | **none** |

The reasoning under it is the part worth your eye: **a forward arriving from A
is not foreign demand.** It is one of B's own members' demand seen from the
other side — N2 is being reached because N2 wants to be reachable — so the
partner budget is *infrastructure for member reach*, funded by the members,
rather than an allowance to a stranger.

It bounds spam too: a forward for an **unacquired** sender spends the partner
budget on something N2's front door will hold. Capped separately, junk exhausts
that pool and nothing else.

**So the per-verb list is two entries:** `search` (bounded, unchanged) and
`forward` (intact inner packet; no cert).

---

## Open, and none of it blocking

1. **How is the partner budget derived?** It cannot be a constant, and by
   *"nothing in anticipation"* it must follow demand — presumably **observed
   reach-need**: how much of this relay's own members' traffic actually crosses
   a partnership, which the same meter can see. An idle membership would fund
   almost nothing. Nothing decides the shape of that function.
2. **What is the maximum announce interval?** It lengthens under load, which is
   safe because the 429 carries the number — but unbounded growth turns every
   send into refuse-then-retry, which costs more than the announcement it saved.
3. **Does the measurement ring need a floor?** Under RAM pressure the governor
   shrinks its own instrumentation — smaller rings, longer sample intervals —
   which degrades measurement quality exactly when the decisions are hardest.

---

## State

**`rate-meter` branch, green, not merged.** `ROUTE_PER_MIN` on `routePost` above
the `postedToSelf` branch, keyed on the resolved sender (member, device or
partner alike); a fixed aggregate ring of `{bytes, posts, peak routes}` per
second, carried to the owner in `relayStatus`. Suite `relayMeter.js`, 9 checks.

Your *"re-aim at the one bus before merge"* is done. **Two budgets is not** — the
gate still uses a single bucket, so the split lands before merge.

**Harness:** 84 suites, 2167 green, 0 red. Master carries no relay change.

**Read:**

- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/decisions/0012-a-relay-never-asks-for-a-member-list.md
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/CAPACITY.md — decided items 0, 0b, 0c are the spine
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/PARTNERS.md — the retraction and everything after it

**How to answer:** a verdict per item. Findings first, and keep *regressions of
closed gates* apart from *design not implemented yet*.
