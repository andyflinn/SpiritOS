# Counting what a contact costs — a request for node-side support

**Date:** 2026-09-09
**From:** Andy, written up by Claude
**To:** Grok
**Touches:** `spirit/run/js/hub.js`, `spirit/run/js/whoBook.js`, `spirit/run/js/peerFile.js`
**Does not touch:** `spirit/run/js/relay.js`, spirit-3, or anything on the wire

---

## What already shipped, and the hole in it

Contacts' per-row panel now reads:

| Public Handle | My Label | Storage |
|---|---|---|
| bert | Bertie | 2 KB |

Andy asked for six facts in that bubble, in this order:

**Public Handle · My Label · Unanswered inbound · Inbound rate · Outbound rate · Storage**

Three are built. **Storage** needed no new state at all: `hub.js` walks `app/` for
anything `peerFile.js` named, decodes whose it is, and sums the sizes. It is right the
day a second app keeps a file per peer, and because nothing is written down, nothing can
drift out of step with the disk.

The other three cannot be built the same way, and this document is about why, and what
we are asking for instead.

---

## Why these numbers, and why Andy wants them

The question Andy actually asked was not "how many messages did bert send." It was:

> *How much is that contact a drain on my attention and my resources?*

That is a question with **three verbs attached to it**, and they are the three verbs
Contacts already has: accept, block, leave waiting. Today he answers it by remembering,
which means he answers it late — a key that has quietly become a burden looks exactly
like a key that has not, until he opens a thread and scrolls.

What each number decides:

| fact | the decision it serves |
|---|---|
| **Unanswered inbound** | messages received since the last one Andy sent. One-sidedness, with the direction attached: high because he is neglecting somebody, or high because somebody is haranguing him. Both are actions, and they are opposite actions. |
| **Inbound rate** | is this escalating? A key that went from two a week to forty is the one worth looking at *now*, and lifetime totals hide exactly that. |
| **Outbound rate** | reciprocity. Inbound alone cannot tell a conversation from a broadcast; the ratio can. |
| **Storage** | resource drain, and the one that says which log to prune. Already shipped. |

The window matters as much as the number. **Rates are over a recent window, not
lifetime.** A lifetime total only ever grows, so it ranks contacts by how long they have
been in the book — which is the opposite of what he needs to see.

## Yes, this is what platforms measure. That is the point, and so is the difference

These are the ordinary engagement metrics: volume, direction, recency, reciprocity,
storage. Every social platform computes them on every account it holds.

The differences are not cosmetic, and they are what make this defensible:

| | a platform | this node |
|---|---|---|
| **who is measured** | everyone, whether or not they consented in any real sense | only keys **Andy personally admitted to his own book** |
| **who reads it** | the operator, advertisers, ranking systems | Andy, on his own machine |
| **whose traffic** | other people's conversations with each other | traffic **addressed to and sent by Andy** — he is a party to every packet counted |
| **what it feeds** | a feed that decides what he sees | three buttons he presses himself |
| **where it goes** | off the device, permanently | nowhere. Same rule as `myLabel`: never uploaded |

The honest way to put the strongest version of the argument: **these numbers are not new
knowledge.** Every one of them is already on Andy's screen — he can see that bert wrote
eleven times and he never replied, by looking at the thread. What the counters do is stop
making him scroll to find out. A node that refused to total what it is already showing
him would not be protecting anybody; it would just be worse at its job.

The limit that follows from that, and which the design has to hold to: **nothing may be
counted that is not already visible to him as the recipient.** No content analysis, no
sentiment, no keyword tallies, no inference about a contact's state — those *would* be
new knowledge, and they are not on the table.

One thing to note rather than paper over: a contact does not know a count is being kept.
On a platform that is assumed; here it deserves saying out loud. Our position is that
counting metadata of messages sent *to you*, on your own machine, for your own use, and
never disclosed, is what any person with an inbox already does in their head. If Grok
disagrees, this is the paragraph to argue with.

---

## What we are asking for

### 1. Where the counting happens

Both directions have to be counted **by the node, at packet time**, because they cannot
be recovered afterwards:

- Chat's per-peer log is capped — `CHAT_LOG_CAP` is 500 and it is a ring. Any total
  derived from the archive **stops rising exactly when a contact becomes worth
  flagging.** A metric that saturates precisely on the interesting cases is worse than
  no metric.
- It would count only *chat's* traffic while being labelled with the node's name. The
  moment Chess or a contact card sends a packet, the number is a lie, and it is a lie
  that reads as a fact.

Outbound is easy: `/api/hub/send` is the single chokepoint, every app goes through it.

**Inbound is the open question we need Grok on.** Today an inbox read happens when Relay
Chat polls, so counting there means the counters advance only while an app is watching.
That is a real hole and we do not have a preference on how to close it — a node-side
poller, counting on delivery, or accepting that the count means "seen by this node"
rather than "sent to this node". Which of those is cheap, given how the hub is built?

### 2. Where the counts live — sidecar, not the book

We think this should **not** be fields on the whoBook row, and would like agreement or a
correction:

- A whoBook row is **what a human decided** about a key. A packet counter is not a
  decision, and mixing them means the record of a decision changes without a decision.
- `who.json` is one file holding every row, so a counter on the row means a
  read-modify-write of the **whole book on every message** — O(contacts) per packet, and
  a corruption window on the one file the node cannot lose.
- Losing a sidecar loses a statistic. Losing `who.json` loses every accept, block and
  label ever made.

`peerFile.js` already anticipates exactly this. Its own header says: *"Anything that
keeps a file per peer goes through here — chat logs today, **whoBook sidecars later**."*
This would be the first of those. It also means `bytesHeld` counts the sidecars too,
which is correct: they are part of what a contact costs.

### 3. The shape, kept deliberately coarse

```json
{
  "peerPublicKey": "MCowBQYDK2VwAyEA…",
  "unansweredInbound": 11,
  "days": [
    { "day": "2026-09-09", "in": 3, "out": 0 },
    { "day": "2026-09-08", "in": 5, "out": 1 }
  ]
}
```

- **`unansweredInbound`** — increment on inbound, **zero on outbound**. O(1), needs no
  history, and cannot saturate. Replying is what resets it, which is the behaviour the
  number is trying to describe.
- **`days`** — a bounded ring of per-day buckets (14 is our guess; say if you would
  rather it were 7 or 30). Rates come from summing the window. Bounded size, survives a
  node being off for a week, and no unbounded log.

**Day granularity is a privacy decision, not a storage one.** Per-message timestamps
would be a second archive of when everybody wrote — a thing to leak, and a thing chat's
own ring was capped to avoid. You cannot reconstruct a conversation from a daily count,
and that is the intent.

**No message content, ever.** Not the body, not a length, not a subject, not a hash.

### 4. How it reaches the app

The precedent is already set by this week's work: `buildPeople` in `hub.js` adds computed
fields to each row of `/api/hub/who`, and Contacts renders them. `bytesHeld` and `tail`
both arrived that way. So:

```
unansweredInbound   number
inboundPerDay       number   (window sum / window days)
outboundPerDay      number
```

No new endpoint, no new capability, and the app stays a renderer. Absent counters read
as `0`, which is honest: **the counters start when counting starts.** We are explicitly
*not* backfilling from chat's logs — that is the dishonest number this whole document
exists to avoid.

### 5. The wire

Nothing here leaves the node, and **the relay must never be asked to count.** A public
mailbox keeping per-peer traffic statistics on behalf of its owner is a different product
with a different consent story, and spirit-3 hosts other people's keys. This is the same
rule `myLabel` already follows: what Andy thinks about a contact is his and stays on his
laptop.

---

## Three questions we cannot answer without you

1. **The inbound chokepoint.** Is there a point in `hub.js` that sees every delivered
   packet regardless of which app is polling — and if not, what is the cheap way to get
   one? This is the only genuine blocker.

2. **Does a held peer count?** Under `hold`, a stranger's line is dropped and they get a
   waiting row. Counting their traffic is arguably the most useful case — that is
   precisely the drain you want to see before deciding. But the line is not kept, so the
   count would become the only trace of it, which is more than `hold` currently promises
   anybody. We lean toward counting, and flag it rather than deciding it.

3. **Does a blocked peer count?** We lean **no** — refused at the door is refused, and a
   counter that keeps rising for somebody Andy already said no to is a drain in itself.
   But it does mean a blocked key's numbers freeze rather than fall, and the panel should
   probably say so.

---

## Division of labour

Per `CLAUDE.md` and `GROK.md`:

- **Grok** — the bones: the sidecar module and its shape, the counting call sites, and
  the answer to question 1.
- **Claude** — once Andy has a verdict: the `buildPeople` fields, the three facts in the
  Contacts bubble in the order above, the harness, and the comments recording that this
  shape was a decision and not a convenience.
- **Andy** — the verdict, and whether the paragraph about a contact not knowing is
  settled or still open.

Until then the bubble stays at three facts. Drawing the other three empty would be worse
than leaving them out: a fact with nothing in it still claims to have been measured.
