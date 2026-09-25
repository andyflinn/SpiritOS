# The requester is responsible for the question

**Stated by Andy, 2026-09-18.** A principle, not a mechanism: it is the
reason behind [0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md)
and the roll eradication in [../relay/SURFACE.md](../relay/SURFACE.md),
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

Both arguments arrive at the same place for the roll, and they are not
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
is usually asking the wrong question, and the roll's history is the
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

## The enforcement point — one return bound, both paths (2026-09-25)

Until now this was a principle the code could decline to follow, and
the verbs that return collections declined. It gets a mechanism here.

> **Andy, 2026-09-25**, on capping every return to one size whether it
> travels by `peerOwnerPost()` or over loopback: *"good, so all searches
> are subject to the same return limit."*

**Where it came from.** Designing the owner's proxy path to a puppet
(`PUPPETS.md`) turned up an asymmetry nobody had looked at: **every
bound in this system is on a request or a packet, and nothing anywhere
bounds a response.** `spirit/run/js/limits.js` has no response cap. So:

- `BODY_MAX` (23552) bounds what the local door ACCEPTS.
- `PLAINTEXT_MAX` (16384) bounds what a composer may BUILD, which is
  what a reply-as-packet can carry.
- A contact row of the shape `contacts.js:338` writes — key, two labels,
  `acquiredVia`, `blocked`, one relay id — serialises at **259 bytes**,
  so `peer.list` stops fitting a packet at roughly **63 contacts**, while
  on loopback it has no bound at all. *(A constructed representative row,
  not a survey of real ones; the order of magnitude is the point, and
  the arithmetic is 16384/259.)*

The failure that produces is the one worth spending money to avoid: it
works in development with a dozen contacts and fails in production with
a hundred, silently, at the far end. A uniform cap removes the
divergence rather than documenting it, and makes *"processes it as if it
were loopback"* literally true.

**Bounded and truthful, not refused.** The mechanism is the one this
document already asks for at `:127` — *"Successful means bounded, ranked
and truthful about being partial"* — and NOT a refusal, which `:146`
treats as the lesser branch: *"Nor is it a licence to refuse rather than
fix."* A caller handed 50 contacts and a "there are more" flag can ask a
narrower question; a caller handed `answer-too-large` can do nothing.

**The vocabulary already exists.** `peer.search` returns `{ rows, more }`
(`spirit/run/js/hub.js:2091`) — the one verb where the question is
obviously vague already answers this way. What is wrong there is the
UNIT, not the shape: it caps `searchMemoryRows` (default 1000, a row
count) rather than bytes, and a thousand rows at 259 bytes is ~259 KB,
sixteen times a packet.

**Which verbs feel it is DERIVED, NEVER COUNTED HERE.** Every verb that
returns a collection rather than a decided value — and the suite that
walks the verb table says which those are, at run time. A hand-counted
list in this file would be a remembered fact among citations that are
all re-derived, and the day a sixth verb returns a collection it would
be wrong and silent about it. *(wsl-claude, 2026-09-25, applying the
lesson `doorContract` taught the same day: it went red when the
catalogue grew because it re-derives rather than remembers.)*

**The suite is free.** Andy's already-ruled *"then you need only one
suite that makes every api call"* covers the owner-proxy shim's
completeness and this cap together — one instrument, two jobs, and it
cannot rot because it walks the table rather than a list.

**One deliberate exemption, written down rather than discovered.**
`spirit/run/js/server.js:927` — `if (verb !== 'net.fetch' && ...)`, with
the comment *"Every verb but the proxy keeps the packet's bound."*
`net.fetch` is unbounded on loopback by design, which makes it the one
verb that provably cannot travel as a packet. It is outside the proxy
and outside the cap. A uniform bound with one stated exemption is still
uniform; an unstated one is a bug waiting to be found in the field.

**What this does NOT rest on.** Decision 0020 (*"A value may cross. A
structure may not"*) does **not** support this cap, and an earlier draft
of the argument said it did, twice. `0020:40` lists *a contact's public
name* as something that CROSSES; what it forbids is *"the roll, its
size, its bounds"* — the collection as machinery. The same ambiguity was
named and resolved the other way in
`cycles/2026-09-23-relay-record-cycle-11.md:179-184`: what crosses is a
series of decided values, not rows. **0020 is about content; this is
about volume.** They are different limits and neither carries the other.
*(Correction: wsl-claude, 2026-09-25.)*

### What a list answers, ruled 2026-09-25

> *"the fetching of the jobs needs more lazyness, the acual list, should
> be ID's with Title, the rest is fetched when needed. similar for the
> processes app"*

**A list answers WHAT IS THERE. A get answers WHAT IT IS.** An id and a
title are decided values; the rest is the working-out, and 0020's test
already separates them.

**Measured, and it is why this is a ruling rather than a preference.**
`jobs.list` through the real door on an idle node returns **207,199
bytes in three rows**, of which 205,539 are one job's `data` — the
`fs-watcher` job, whose data is the whole file index
(`spirit/run/js/jobs.js:141`). The door refuses a REQUEST of 23,553
bytes and returns that.

Three things make it so, and all three were Andy's guesses before they
were measured:

- **There is no way to ask for one.** `getJob(id)` exists and is
  exported (`jobs.js:317`); no verb reaches it. Five jobs verbs and none
  of them is "get one".
- **The first rows are the same every time.** Exactly two permanent jobs
  at boot — `fs-watcher` and `server-stats` (`jobs.js:141`, `:243`) — so
  every caller is handed the same two rows, entire, to learn what it
  could have been told once.
- **Nothing cleans up.** `jobsMap.delete` is reached only from
  `deleteJob` (`jobs.js:123`), which needs a terminal status and an
  explicit call, and its only caller is `kernel.js:912` — **an XHR from
  the browser**. A finished job is removed when a person clicks it and
  never otherwise, so the list grows monotonically in RAM and on the
  wire.

**AND THE LIST IS A SEARCH, ruled minutes later:**

> *"processes come with a length description, they should be filtered
> via a seach function."* — *"same for jobs actually."*

Which makes this document's own prediction come true late. The section
*Anything with no argument to it* records that **five argumentless
callers were removed between 2026-09-17 and 2026-09-18** —
`peer.candidates`, `peer.find`, `relay.roster`, the device page's label,
`peer.list`'s sweep — and *"not one needed a replacement."*

**`jobs.list` is the same shape and survived that purge.** It takes no
argument, so it cannot be asked a specific question, so it answers the
general one — which is why it hands back 207KB. The rule was already
written; one verb was never held to it.

The replacement needs nothing invented, and this document already names
it: *"Search. Already built this way, which is why it is the replacement
everything else collapses into."* `peer.search` returns
`{ rows, more }` (`spirit/run/js/hub.js:2091`) — bounded, ranked,
truthful about being partial. `jobs` and `processes` take the same
shape, and a long description becomes a thing you search rather than a
thing you are handed.

**AND THE FILTERS ARE THE FIELDS, ruled minutes later again:**

> *"and a search approach with filters like sysjob / permanent / should
> filter the search be groups."*

Nothing to invent: a job row already carries `id`, `kind`, `type` and
`status` (`spirit/run/js/jobs.js:45-48`), and there are exactly two
kinds — `permanent` (`:141`, `:243`) and `process` (`:197`). Those ARE
the groups.

Which collapses the whole finding into one verb:

| the complaint | what the search answers |
|---|---|
| no way to ask for one | `jobs.get(id)` — the function exists and is exported (`:317`), unrouted |
| the same rows every time | they are `kind: permanent` — **a group you exclude by asking**, rather than a special case |
| nothing cleans up | filter by terminal status and the sweepable set IS the answer |
| long descriptions | the search term, over them |

**The second row is the one worth keeping.** "Do not re-ship the
constants" would have been a special case in a list verb. A filter makes
it a QUESTION instead — which is the no-special-case rule arriving from
the other side, and it needs no code to know which rows are boring.

**And the shape already answers a vague question correctly today.**
`peer.search` called with no argument at all, measured on a booted node:

```
{"q":"","matches":[...],"more":false,"asked":1,"remembered":0,
 "silent":["https://127.0.0.1:1"]}
```

Bounded, flagged partial, and truthful about who did not reply. Not a
refusal and not everything — `:127` working, with a receipt rather than
a principle.

**IT IS NOT ONE VERB, IT IS THREE.** wsl-claude measured the door: the
purge removed CALLERS and the door still offers three argumentless
collection verbs. Confirmed here on a booted node — `peer.list` 3,582
bytes, `proxy.list` 217, `jobs.list` 207,205. `jobs.list` is only the
biggest.

**What lazy fetching does NOT do, said so nobody expects it:** it does
not shrink the index. It stops every other caller paying for it — which
is this document's own argument, since the specific question keeps its
precise answer and the vague one stops being subsidised. **Whether the
file index should cross at all is a separate question**, and 0020 would
say it is working-out.

**And it is not a free trim.** wsl-claude named the consumers before
anybody starts: the Files app and an app's `scanDirectory` are
deliberately served by shipping the index and filtering at the far end.
Changing what the node answers changes what they get, so what REPLACES
it is a product decision rather than a smaller version of the same
answer.

