# The requester is responsible for the question

**Stated by Andy, 2026-09-18.** A principle, not a mechanism: it is the
reason behind [0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md)
and the census eradication in [../relay/SURFACE.md](../relay/SURFACE.md),
and it decides cases those do not name.

> **Andy:** *"The relay has duties to the owner: survive, and get the job
> done. I never ask you: explain everything to me at once. The more
> specific my question, the more precise the answer. Or: the better the
> search-term, the better the result — a requester has that
> responsibility."*

---

## The rule

**A vague question earns a bounded answer or none. It never earns
everything.**

The burden of specificity sits on the party asking. A relay is not obliged
to compensate for a poor question by spending more, and a caller that will
not say what it wants has not been refused — it has not asked.

## Why this, rather than "protect the membership"

Both arguments arrive at the same place for the census, and they are not
the same argument. Privacy is about what may be disclosed; this is about
**who bears the cost of imprecision**, and it holds even where nothing is
secret.

That matters because the disclosure argument has a bounded-and-signed
escape hatch — *"make it owner-only and it is fine"* — and this one does
not. An enrolment list served to somebody entitled to it is still the
answer to *"tell me everything"*, and still costs the relay a term it
cannot control.

It is also the only one of the two that survives the relay's first duty:

> **The relay has duties to the owner: survive, and get the job done.**

A box that answers unbounded questions cannot promise either. It is
[0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md) — fixed
cost per time-unit — stated from the requester's side rather than the
operator's.

## The other half: don't ask what you could have heard

> **Andy:** *"the working relay will broadcast useful information to its
> membership. Members can filter/use that, because bandwidth is generally
> cheap. A route is established and verified — that's a broadcast. A member
> is added — broadcast it. Less work for the relay, more up-to-date
> information for the node."*
>
> *"So a node, also looking out for itself, is well advised to listen and
> not waste their request budget (variable) on requests."*

The principle is not "ask less". It is **ask well, and only for what
listening cannot give you.**

A relay that pushes deltas does less work than one that answers queries: a
broadcast is O(1) per event with one write per listener, bounded by the
relay's own business happening, where a query is O(members) per requester as
often as they care to ask. And the node is better off too — its picture is
current between refreshes rather than at them.

**This makes the rule self-enforcing, which is why it does not need
policing.** A node's request allowance is scarce and governed
([CAPACITY.md](../relay/CAPACITY.md)) — *variable*, so it moves with
behaviour. A node that fetches what it was already being told spends its own
budget on nothing, and under shedding the one that hammers is dropped before
the one that listens. Both parties are looking after themselves, and the
cheap path is the same path.

So the relay's duty and the node's interest point the same way:

| relay | node |
|---|---|
| survive, and get the job done | keep a budget for what matters |
| push what changed, once | listen, and filter locally |
| answer specific questions well | ask only what listening cannot give |

## What it decides

**Presence.** This section previously concluded that a member must **name
the keys it cares about**, and that a member which would not had asked
nothing. **That is withdrawn**: under the paragraph above, presence is
exactly the kind of fact a relay should push and a node should filter, and
scoping it would have sent a person's contact list to their relay to save
bandwidth that is cheap. Nothing is scoped, nothing leaves the node, and the
listener does the filtering.

**A member is added.** Broadcast, not fetched — and the listening node may
acquire, queue for acquisition, or disregard. It is what the auto-contacts
feature wanted, without the bulk question it was asking.

**A newly bound node needs no roster to start from.**

> **Andy:** *"a newly bound node is most likely to get broadcast items from
> currently active relay members. Just sitting there listening should
> populate its UI with opportunities to connect."*

This is the argument that closes the last hole, and it is not a concession —
**listening gives a better answer than the dump it replaces.** A roster
hands a new node the entire enrolment, the long-dead beside the live, in no
useful order. The stream hands it whoever is *active*, in the order they
were active, because activity is what generates a broadcast at all.

So "who could I connect to" is answered by sitting still, and answered
better: the set is already filtered to people who are actually there, and
already ranked by recency, which is what the screen wanted and what a list
sorted by label could never express.

It also means a node that has just joined is not a special case needing
catch-up. It starts empty and fills within minutes with the part worth
having — and what it misses is, by construction, the part nobody is using.

**Search.** Already built this way, which is why it is the replacement
everything else collapses into: a term comes back ranked and cut to slots
and a byte budget, and the answer says how much was dropped. A
one-character search is a poor term and gets a poor — but bounded and
honest — answer.

> **Andy, earlier:** *"searches for 'a' must be successful, even if there's
> a million potential peers."*

Successful means **bounded, ranked and truthful about being partial**. It
has never meant complete, and the two are easily confused by somebody
reading only the sentence.

**Anything with no argument to it.** A caller that cannot say what it wants
is usually asking the wrong question, and the census's history is the
evidence: five callers were removed between 2026-09-17 and 2026-09-18 —
`peer.candidates`, `peer.find`, `relay.roster`, the device page's label,
`peer.list`'s sweep — and **not one needed a replacement.** Each had a
specific question available and was asking the general one because the
general one was cheap to ask.

## What it does not say

It is not an argument for making answers hostile or stingy. A relay should
answer a **good** question generously and cheaply — `GET /api/relay/key`
returns four fields for a question worth asking, and costs 97 bytes flat.
Precision is rewarded; imprecision is simply not subsidised.

Nor is it a licence to refuse rather than fix. When a caller asks a vague
question, the first move is to find the specific question it actually had
([0010](../decisions/0010-fix-the-protocol-or-name-the-cheat.md)'s
identify / plan / eradicate), not to bound the vague one — **a narrower
cheat is a defended one.**
