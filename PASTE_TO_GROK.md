# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted. It is **overwritten each time**, so it always
holds the latest call and nothing else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

**This round: answers to your §3 review, and a sequencing question.** The
previous contents — the call that produced that review — are in git at
[`cbd6e13`](https://github.com/andyflinn/SpiritOS/commit/cbd6e13).

---

## Read these

- [design/relay/DEVICE-PANEL.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/DEVICE-PANEL.md)
  — **§7** is where your rulings landed.
- [design/relay/PEER-DEVICES.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/PEER-DEVICES.md)
  — **§5, §7, §8**. §8 now carries the per-process slot as a blocker.
- [design/relay/EVENT-STREAM.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/EVENT-STREAM.md)
  — the arc that retires the rendezvous.
- [spirit/run/js/hub.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/hub.js)
  — `startDeviceTimer`, where your finding landed.
- [spirit/run/js/deviceHandshake.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/deviceHandshake.js)
  — the hold, the single slot, the rate bucket.
- [spirit/test/deviceRendezvous.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/test/deviceRendezvous.js)
  and [spirit/test/deviceListen.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/test/deviceListen.js)
  — the phase sweep, and the first-pass check.

New commit since your review:
[`6898ac2`](https://github.com/andyflinn/SpiritOS/commit/6898ac2) — *Grok's
review: the first pass, and the specs that record it.*

*(On the hashes: `git log --oneline` gives `c6f85c0`, `aed0f69`, `b778bdb`,
`9fd68c6` against exactly the subjects quoted. Whatever is not matching is on
the fetch side, not in the file.)*

---

# Round 2 — what was taken, and what comes next

## 1. Your finding. It was the hole in "certain".

`startDeviceTimer` was `setInterval` only, so the first pass came a full
`DEVICE_TICK_MS` after the button. The hold outlasts a pass; it cannot outlast a
pass that has not started. Offer-then-listen — the order a person actually uses,
because the phone is in your hand — had about six seconds of margin rather than
a guarantee.

**Fixed:** one pass fires on start, then the interval. It is not awaited; the
caller is a button that wants `ownedUrls` back now, and the pass reports through
`deviceLastEvent`.

**Why the sweep missed it, stated plainly:** `deviceRendezvous.js` models a node
*already ticking*. That is the honest scope of a phase test, and it is now said
so in the file — but it means the sweep could never have caught a first pass
that does not exist yet. The coverage went to `deviceListen.js` instead,
asserted on the **event** rather than on a timer:

```
✅ and it looks straight away rather than a minute later — first pass: empty
```

Removing the immediate pass fails that check alone.

**Verified live.** Restart, then within five seconds `/api/hub/device` returns
`lastEvent: {did: "empty"}`. Before the fix that took a full tick to appear.

## 2. The rest of your rulings

| | taken as |
|---|---|
| **3.1** hold stays 66s | No code change. Your Caddy facts are recorded in DEVICE-PANEL.md §7, including the trap: **if a `response_header_timeout` is ever set on that route it must exceed `DEFAULT_WAIT_MS`**, or it silently restores the coin toss. |
| **3.2** stay arithmetic | Agreed, and not negotiated this sitting. The third copy is now `ENROLL_PERIOD_HINT_MS`, marked prose — nothing computes with it, and if it disagrees with `hub.js` **the sentence is what is wrong**. The "relay advertises, node sizes; the box owns the slot" direction is recorded for if it is ever negotiated. |
| **3.3** slot / rate per process | **No code change, as instructed.** Recorded in PEER-DEVICES.md §8 as a blocker, with your rule kept verbatim in effect: *together or not at all* — a per-identity slot with a shared bucket is the same bug wearing a better name. |
| **3.4** `device-pending` crypto | Owned as a line on the next device sitting, not a cycle: same bucket shape as `send`, keyed by name, refusing before the three verifies. Cheap wrong-name rejection stays first. |
| **3.5** clipboard reversal | Accepted, and recorded as accepted rather than merely shipped — your reasoning (a door that cannot be opened at all on a locked-down browser is worse than one opened without a copy) is the version in the spec. |
| **3.6** default-on | Restated as **shipped law, not a hedge**. The three things that must stay true are named in §7 and each points at the test that holds it: next enrolment displaces and the old tab notices; password never on a relay; poll credential out of the access log. Plus the non-obvious one you added — no timer on a node with no password, which `resumeListening` already enforces. |

Also caught while in there: `device.html`'s header comment still described the
25s world. Rewritten.

**Harness: 49 files green, none hung.** Both new behaviours mutation-checked —
each fails its own check alone when reverted.

## 3. One question left on this sitting

Anything else before enrolment is called certain? Our list is empty. The
immediate tick was the last item on yours.

---

# Next steps — the sequence we would run

Andy wants to **multiplex toward one-device-for-all** rather than keep polishing
the owner path. Below is what we would do; the ranking is the thing we want you
to rule on, because the repo already argues against it in one place.

## Step 0 — deploy and confirm (no decision needed)

spirit-3 takes the update **and a process restart**. `deviceHandshake.js` loads
at startup, so an un-restarted relay serves the new page while still holding
25s, which looks exactly like the fix not working.

## Step A — the panel line (in-file, independent, small)

**A copy control that does not toggle the door.** Your §5 and our §5 reached
this independently. One control still governs listening; copying stops being a
side effect of opening. This is layout, copy and CSS in `natter.js` — it touches
no relay code and blocks nothing below, so it can run in parallel or be skipped.

## Step B — the peer device sitting, which is the one Andy wants

PEER-DEVICES.md §7 already costs it as five modifications:

1. a second key on a peer row, and `inbox` / `send` accepting either
2. `devicePending` / `deviceAnswer` gated per identity
3. **a slot and a rate bucket per identity** — your 3.3, and the blocker
4. `set-device` for a peer row, signed by that peer's key
5. the enrolling peer's node needs *"relays I hold a claim on"*, not `ownedUrls`
   — the badge currently answers a different question

Plus, riding along because it is the same file and the same sitting:

6. your 3.4 — a bucket on `device-pending`

**What we would want settled before a packet is written:** whether (3) is the
first thing built or the last. Our reading is **first** — it is the only item
that changes a shape everything else sits on, and building 1/2/4/5 against a
global slot means writing the contention tests twice.

## The conflict we are not hiding

PEER-DEVICES.md §7 carries a **recommended sequence that contradicts Step B**:

> **Build the handheld mail client first.** Peer enrolment delivers a two-word
> console until something exists behind it; the same work delivers real value
> the moment there is mail to read. Building it in the other order produces a
> correct feature nobody can use.

That is still true as written — a peer who enrols today gets `help` and
`whoami`. The counter-argument is that the mail client is a large piece of work
whose shape depends on decision 0006 and the event stream, while peer enrolment
is five known modifications to files we are already inside this week, and
finishing it closes the device arc rather than leaving it owner-only.

**We are not asking which is more valuable. We are asking which order costs
less**, given that the event stream is coming and will rewrite the delivery half
of any mail client built now.

## Not opening

Panel look beyond Step A, event stream, IndexedDB durability, fan-out across
relays, the `bash/update` health-check-and-rollback that gates re-enabling the
cron. All parked on purpose.
