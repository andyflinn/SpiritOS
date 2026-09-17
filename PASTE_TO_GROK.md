# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted. It is **overwritten each time**, so it always
holds the latest call and nothing else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

**This round (2026-09-17, second call): a correction to the one you just
answered.** The previous call is in git at
[`fec66ec`](https://github.com/andyflinn/SpiritOS/commit/fec66ec).

---

## We got the central thing wrong, and you reviewed it

**The "four gates" were an artefact of a misreading.** They described *A routing
a packet directly to a member of B*. Nobody proposed that, and PARTNERS.md's own
delivery diagram — written 2026-09-15, before either of us looked at this — says
the opposite:

```
N1 ──post──▶ A ──forward, signed as A──▶ B ──deliver──▶ N2
```

**A forwards to B. B delivers to its own member.** Andy, putting it as the
generalisation we had both missed:

> *"Partner-to-partner posts all follow exactly the same pattern. A
> gimme-all-members may be a simple string, a search-your-members also has a
> string, a forward-post request is just another standard partner-to-partner
> request, where the partner needs an exchange with a specific member before it
> can reply. They are ALL the same."*
>
> *"And all comms between partners ride the same bus."*

Under that framing **none of the four gates applies**:

| gate | why it does not apply |
|---|---|
| 1 — recipient lookup → `404` | A addresses **B's relay key**, so `postedToSelf` is true and the line is never reached |
| 2 — *"a partner may only address this box"* | the forward **is** addressed to the box. The rule being obeyed, not a blocker |
| 3 — `routeReply` members-only | B's member replies to **B**, its own member, so `deviceIdentity` resolves |
| 4 — `routes.answer` target mismatch | B opens its own internal route to its own member; A↔B is matched by B's own key, as `sendAnswer` already does |

And the machinery is already there. `answerSelf` defers a reply across a round
trip today, for exactly this reason: *"SENDING IS A FUNCTION NOW, because an
answer can arrive late… a search asked by a member is also asked of this relay's
partners, and their replies come back on held streams whenever they come back."*
A forward is that pattern with B talking to its own member instead of its
partners.

The wrong table is kept in the file under a retraction rather than deleted, so
the misreading stays visible.

---

## What that does to your verdicts

| your ruling | now |
|---|---|
| **gate 3: stream-only, don't add `partnerIdentity`** | **stands, and the reason is stronger than "unless"** — *"request by post, reply by stream, in both directions"* is the protocol, stated in tier two of the same file. `routeReply` is a POST endpoint, so a partner not being admitted there is adherence, not an omission |
| **cheap cert** | **accepted**, with two corrections below |
| **describe = register on the home row** | **overruled by Andy** — see below |
| **one governor, two meters** | **agreed**, and generalised: *"one governor, multiple meters"* — an open bag of readings, never a fixed pair, so a new meter is a new key rather than a new argument |
| **shed forwards → partnerships → claims** | **overruled by Andy** — see below |
| **30s stream interval** | decided, *lengthening under load* — but may retire for the partner side entirely; see "one bus" below |
| **dumb `rateOk` on `routePost` first** | **agreed and sharpened.** Andy: *"we already have packet delivery, that should be the bootstrap for rate-management, there we get first measurements."* The meter matters more than the gate: a governor tuned against hypothetical partner traffic is tuned against a guess |
| **stranger floor stays global** | agreed, unchanged |

### Two corrections to the cheap cert

**It is not already built, and the primitive must not be reused as-is.** The
relay-to-relay hop today carries `askPartner` → peerPost's post, signed by **the
relay as itself** over `(A, B, text)`. No member identity travels — correctly,
since search is a question about A's members in aggregate.

`relayAuth.streamMessage` is the same construction **one field short**:

```js
'stream\n' + key + '\n' + minute        // binds (memberKey, minute) only
```

Today its replay-safety comes entirely from *who verifies it* — the relay
checking against its own row, where a replay proves only what that relay already
knew. **In a forward that inverts:** B verifies a signature made for A, and with
no relay key in the bytes one signature would assert membership of every relay
in the mesh. Your `(memberKey, relayKey, minute)` is exactly the fix; the point
is that `streamMessage` cannot be borrowed unchanged.

**Its audience is B, not N2.** Andy: *"N2 can trust B that a trusted partner has
relayed the post."* The chain closes locally at every link — N1 trusts A, A and
B trust each other by pinned key, N2 trusts B — so **N2 never has to know A
exists**. It does not verify A's key, hold a partner list, or learn the mesh.
The cert is what lets **B** decide whether to accept a forward on behalf of a key
it has never seen. N2's decision is unchanged: verify the inner signature, apply
the front door.

### The two overrules, with Andy's reasons

**Shedding — *"on shedding: i win. grok loses. that's my decision."*** The ladder
puts partnerships second, and partnerships are **reach**. It also contradicts a
line already decided in that file: *"memory pressure degrades performance, not
connectivity. A relay that sheds every hint list it holds still routes everywhere
it did; it is just slower and chattier while it does."* The file already
separates dropping the hint list (performance, automatic) from cancelling the
partnership (reach, owner input only). Decided order: every performance
degradation first — lists, routes toward a floor of 1, rings, sample intervals,
announcement interval — then refuse **new** claims, and **never** cancel a
partnership automatically.

**Describe — no relay cache.** Andy: *"the peer must NOT cache its description on
its bound relay. The peerPost()-based obtaining of the description is the realest
proof of reachability."* This catches a contradiction inside tier three, which
wanted the description available while the peer is **asleep** *and* wanted
*"procuring a description on selection proves the route a post will take."* One
fetch cannot do both, and a cached one answers for a peer who is dead — worse
than no answer, because it is a false one.

It costs nothing, which is the second half: *"acquisition doesn't require
descriptions. Descriptions only give better information prior to the
acquisition-decision."* Acquisition reads the **public census** of the relay named
on the row — proven live, both directions — and never asks the peer anything.

### One bus, and an open question it may retire

> **Andy:** *"all comms between partners ride the same bus."*

One channel — a post out, the reply on the held stream — and everything uses it.
`partnerLink.onEvent` already enforces half of it (*"REQUEST AND REPLY, AND
NOTHING ELSE"*). So a new partner capability is **a new key in a body**, never a
new event, route or channel. A proposal needing one of those is wrong.

**Our recommendation, undecided:** let every reply carry the current cap. Then
there is no announcement mechanism at all — no new event, no push, no interval —
and the number arrives with the traffic it governs. That would retire *"30s,
lengthening under load, and what is the maximum"* for the **partner** side,
leaving it only for members, who may hold a stream for hours without posting.

---

## What is left to build

No gate moves. No persist shape changes.

1. **The partner allowance becomes a per-verb list.** `if (fromPartner && !(body
   && body.search)) body = null;` is currently both the permission and the entire
   vocabulary. The three asks differ in cost and authority: a member roll should
   be refused outright (the roster rule), a search is bounded at 32 slots, a
   forward asserts a third party.
2. **B originates a request to its own member** — `routePost` already does this
   via `presentNow.send(target.id, 'request', …)`.
3. **The inner packet travels intact** — N1's original text and signature nested
   inside A's forward, so N2 verifies `postSignatureFor(N1, N1, N2, …)` itself
   and A is a carrier rather than a re-signer.
4. **The cheap cert**, for B.

Plus, independently and first: a starting rate limit on `routePost` and the
measurement ring, on traffic that already exists.

### We attempted that last one, and it corrected two things we told you

It is on branch **`rate-meter`**, green (`relayMeter.js`, 9 checks; harness
84 suites, 2167), **not merged** — parked because bouncing the corrected
framing off you comes first. Two findings from the attempt:

**1. "routePost has no rate limit" was too strong**, and the distinction is
your own shape. `routes.open` already caps a requester's **outstanding**
posts — `too many in flight`, 429, `DEFAULT_PER_REQUESTER = 16` — and the
table caps the box at `DEFAULT_MAX = 256`. **That is the RAM half, built and
already fair per requester.** A naive flood loop is stopped at sixteen by it,
which is how we found out. What was genuinely missing is the **flow** half:
a post that completes promptly costs nothing against a stock limit, so a
polite, fast, endless conversation was bounded by nothing at all.

**2. The first attempt special-cased the thing Andy had just generalised.**
The gate went inside the member-delivery path, below the `postedToSelf`
branch — so a partner's search and a member's verb both took the early
return and were **neither counted nor capped**. A relay metering packets to
its members but not packets to itself. Andy's sentence is what exposed it:

> *"The relay-to-relay hop is just normal protocol-compliant traffic, like
> all other traffic… measurable, throttleable."*

Worth stating as a rule for the review: **if partner traffic needs its own
branch anywhere, the design is wrong.** One bus, one limit, one meter.

**And a third number we had been conflating.** Three things, and the code
comment had two of them as one:

| number | what it is |
|---|---|
| **starting limit** | what is in force before anything has been measured. Static, unmeasured, chosen only to stop a runaway while staying invisible to a person |
| **the floor** | the guarantee nobody can be pushed below, in units of work — *"one greeting and a handful of replies"*. Far smaller |
| **the published cap** | what the governor computes from the ring and streams, moving between the two |

Andy: *"is it a default initial rate-limit declaration — right now this is
the starting limit, adjustment to arrive later?"* Yes, exactly that. **Does
the starting limit belong in the protocol** — announced like any other cap,
so a fresh member is never guessing — or is it purely a relay-local
backstop that only ever surfaces in a refusal?

### And what can honestly be computed at boot (new, decided since)

Andy: *"the starting limit must be computed from initially known things:
available RAM… the number of members, so we already know memory/members
ratio. Anything else?"*

Working the list through splits it in a way that matters. A relay knows at
boot: RAM, member count, partner count, CPU count, `PAYLOAD_MAX` (16 KB, so
any post-rate **is** a byte-rate), the route TTL, and its own stock caps.
**Every one of those is a stock except the payload conversion** — so a flow
limit cannot be derived from them. The missing quantity is the uplink, and
it is the one thing genuinely unknowable at boot. That is why the ring
exists, and why a computed starting *rate* would be a guess wearing
arithmetic.

But the ratio has a better job than the rate: **memory ÷ members should size
`perRequester`, which is a flat 16 today** whatever the box and whatever the
membership. A stock limit from stock knowledge, no measurement needed — and
`createRouter(opts)` already takes `max`, `maxPerRequester` and `ttlMs`
while `relay.js` calls it with none.

**And the RAM figure is DECLARED, not measured.** Andy: *"cheap-skate
hackists like me may want to run two relays on a VPS, so available RAM can
be capped is a smart design decision."* Stronger than convenience — reading
`os.totalmem()` is **wrong on any shared host**: two relays on one box each
conclude they own it, size for all of it, and fight. The operator's intent
is the only correct source, so a declared budget is the normal path and
measurement is the fallback. It clamps to what is visible, so a declaration
can only ever narrow. (This also retires a trap we had written about
declared budgets reaching production config — the node floor is in
`peerPost.js` on a node, and a relay's budget is on a relay.)

**For you:** is `memory ÷ members → perRequester` the right derivation, or
does a stock cap want a floor and a ceiling more than it wants a ratio? A
relay with three members would hand each of them a third of the box.

---

## What we want from you

1. **Does anything break under the corrected frame?** You ruled on a picture we
   drew wrong. Gate 3 survives it; we believe the rest does too, but that is the
   thing to check.
2. **Is the per-verb list the right shape**, and should *give me your member
   roll* be refused outright rather than bounded?
3. **Per-member metering across a partnership.** B can currently only throttle A
   wholesale, so one abusive member of A degrades everyone at A — collective
   punishment, and a reach reduction by the back door, which is what the shedding
   ruling exists to prevent. Naming the originating member on the **search** hop
   would fix it, but that is the cert's mechanism borrowed for a different job,
   and it discloses who is asking (*"member M of A wants to know about sonny"*
   rather than *"A does"*). Worth the disclosure, with a use-don't-keep rule like
   the measurement ring? Or is wholesale throttling of a partner acceptable?

---

## Read

- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/PARTNERS.md
  — the retraction and everything after it are at the end of the file
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/CAPACITY.md
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/relay.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/relayAuth.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/partnerLink.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/peerPost.js

**Harness:** `83 suites, 2158 green, 0 red`. No relay code has changed — the last
commit to `spirit/run/js/relay.js` is `f5fcb16`, which predates all of this.

**How to answer:** findings first, and keep *regressions of closed gates* apart
from *design not implemented yet*. A short pasted verdict is enough.
