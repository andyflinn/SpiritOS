# What makes ours stand out — assessed 2026-09-23

**Asked by Andy:** *"what makes our's stand out?"*, after *"how many
thousand similar project are on github?"*

**Filed because he asked for it dated and kept.** This is an assessment,
not a decision. Nothing here has been ruled, and the weaknesses are in it
on purpose — a positioning note that lists only strengths is an
advertisement, and we would end up believing it.

---

## The field, measured

GitHub's **`p2p` topic holds ~6,071 repositories**; **`peer-to-peer`
~2,772** (overlapping). Before counting `decentralized`, `self-hosted`,
Nostr relays, Matrix homeservers, or the many that were never tagged.

So: **thousands**. In a field that crowded, *describing what it is* puts
us in the pile. Only what can be **shown** gets out of it.

Sources: <https://github.com/topics/p2p>, <https://github.com/topics/peer-to-peer>

---

## What actually stands out

### 1. A local HTTP port, so the app can be in any language

Most of that pile hands you a **library**: libp2p means Go, Rust or JS;
Nostr means their client stack. Ours is `POST localhost:65432`.

A Python script, a Bash one-liner, a C# desktop app, an Excel macro —
anything that can make an HTTP request gets signed, sealed peer-to-peer
messaging with **no SDK and no language commitment**.

Andy's own framing: *"so the developer, no matter what language, gets a
local port via which he can do secure p2p posting"*, and *"their apps will
be users of 65432 like the shell is."*

**This is the strongest differentiator and the least documented thing we
have.** `design/protocol/` does not exist. A curious developer who
believes the claim cannot act on it: there is no published verb list, no
error codes, no size or rate limits, and no worked example that is not
JavaScript. **Leading with this claim before that document exists would
be the worst version of the pitch** — an attractive promise with nothing
behind the link.

### 2. Claims that can be checked, not claimed

- **3,044 assertions** ship with the repository and are green.
- A capacity figure that is **measured, dated, and carries the command to
  reproduce it** — and a gate (`capacityFresh.js`) that turns the harness
  **red when a published number drifts from the tree**.
- A test that **tries to read the traffic and fails**, rather than a
  README bullet saying "end-to-end encrypted" — with a control proving the
  search can find the words when they are not sealed, so its passing means
  something.
- Guarantees asserted as **products, not halves** (`guarantees.js`): the
  promise is stated in the words a stranger would hear, and the suites
  that prove each half are named beside it.

Nearly nobody in that pile can show any of this. Most are a protocol
sketch and a demo that stopped.

### 3. A cost claim, not an architecture claim

**19,000 members on a 1 GB VPS.** Measured, not modelled, with one
assumption (150 MB for OS and web server) stated as an assumption.

Architecture claims are free and everyone makes them. A cost claim with a
reproduction command is falsifiable, which is why it carries.

---

## The sharpest single sentence we can defend

> **A relay that serves 19,000 people for $5 a month and cannot read a
> word of what passes through it — and the test that proves it ships in
> the box.**

---

## What does NOT stand out

Said plainly, because positioning built on a false differentiator fails
on first contact with a comparer.

- **The encryption is not differentiating.** Everyone claims it. Ours is
  merely *provable*, which is a claim about our harness, not our crypto.
- **Peer-to-peer is not differentiating.** It is the category name.
- **"No public IP needed" is not differentiating.** That is what every
  relay-based system does.

## The gap a comparer will find first

**No store-and-forward.** Matrix and Nostr hold messages while you are
offline. We do not — `relay.js` says it outright: *"a relay does not
queue"*.

What we guarantee is the **seat**, not the message: a member keeps their
place whether online or not, so they can always reconnect. That is a real
guarantee and it is asserted — but it is **not** the guarantee a chat user
expects, and the words are close enough to be mistaken for each other.

- Framed as a **chat app**, this reads as a missing feature.
- Framed as a **developer transport**, it is a design choice with a
  reason: the relay stores nothing, so there is nothing to subpoena, leak
  or pay for.

**Which reading a visitor takes depends entirely on how the front page
frames what this is for.** That is a positioning decision and it is
Andy's.

---

## What this implies for the README

Not ruled, recorded as the consequence of the above.

The front page currently spends its opening on **architecture** — a
node.js HTTP server, for machines without a public IP, routing POSTs
through a slim relay. Three sentences of what it *is* before anything
about what someone could *do*, and the differentiators above all sit
below wherever a skimmer stops.

Andy: *"humans will skim the first 100 words of the readme to decide if
they want to know more"* — and, on the number, *"i guessed the number
(100 words) just to make my point."* The number does not matter; the
finding does.

Also his, and the architecture for the tree: *"the readme is the pamphlet,
the tree below it backs it up"* — *"just because we can generate reams of
information doesn't mean we have to throw it at visitors to that repo."*

**So the test for the front page is not "is this true."** Everything on it
was true. The test is **whether a stranger is more likely to try this
after reading it**, with the tree there so that anyone who doubts a claim
can check it — most visitors never will, and that is fine. Its value is
that it *could* be opened.
