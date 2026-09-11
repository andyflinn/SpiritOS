# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted. It is **overwritten each time**, so it always
holds the latest call and nothing else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

**This round: Andy's decisions on your sequencing, and a request for the B
packet.** Round 2 is in git at
[`c970e4d`](https://github.com/andyflinn/SpiritOS/commit/c970e4d).

---

## Read these

- [design/relay/PEER-DEVICES.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/PEER-DEVICES.md)
  — **§5** the proposed shape, **§7** the five modifications, **§8** the blocker.
- [design/relay/DEVICE-PANEL.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/DEVICE-PANEL.md)
  — **§7**, where the rendezvous rule and your rulings live.
- [spirit/run/js/deviceHandshake.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/deviceHandshake.js)
  — one `pending`, one `perMin` bucket, for the whole box. The thing B changes first.
- [spirit/run/js/relay.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/relay.js)
  — `createQueue()` at the single call site; `devicePending`, `setDevice`.
- [spirit/run/device.html](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/device.html)
  — the enrolment page. **Frozen, see §2.**

---

# Round 3 — A is declined, B is the whole of the next sitting

## 1. Step A: declined, and it is a decision rather than a deferral

Andy's call, and he had already made it once before this review: **the copy
control is deferred until it actually bites.**

Your warning is on the record and accepted knowingly — he will meet
stop-then-start the first time he travels with the door already open. He is
willing to meet it. The reasoning:

- It is in-file UI. Layout, copy and CSS in `natter.js`, no relay code, no wire
  change. **Retrofitting it later costs exactly what building it now costs**, so
  there is nothing to protect by doing it early.
- The workaround is real, not theoretical: the password is already in the
  browser's password manager, which is the transport it was designed for. Stop
  and start is a second path to the same string.
- Andy would rather find out from use what the control should be than design one
  against a frustration he has not had yet. That is the same rule that killed
  other features in this repo once their cost was visible.

Treat A as closed for this sitting. If it bites, it comes back as its own small
in-file line, not as a dependency of anything.

## 2. The enrolment page is frozen, and that is deliberate

Unprompted, from use:

> *"I love the login page, and it's nice watch-the-water-boil user satisfaction.
> That should stay for now."*

The attempt counter, the elapsed clock and the countdown to giving up are not
scaffolding to be tidied away — they are doing a job. A wait nobody can see the
shape of is what made this feel like a coin toss in the first place, and the
visible one is what made the fix legible.

So `device.html` is **frozen for the B sitting** except where B forces a change
— the per-key address (`/device/<hex key>`, PEER-DEVICES.md §5) and the hidden
username field resolving from `/api/relay/who`. **No cosmetic edits, no removing
the counter, no "simplifying" the status line.** If B needs the page to say
something new, add it beside what is there.

## 3. What we are asking for: B, and only B

Andy: *"I understand the need for B-first, and want a plan that gets us past
B."* So this is not a request to start B — it is a request to **drive B to
done**, in one arc, before the next design discussion opens what follows it.

Nothing else runs alongside. Not A, not the panel, not the mail client.

### The order, as you ruled it

Using PEER-DEVICES.md §7's numbering:

| | what |
|---|---|
| **first commit** | (3) **a slot and a rate bucket per identity** — together, never one without the other |
| **same sitting** | (3.4) a bucket on `device-pending`, cheap wrong-name rejection kept first |
| then | (2) `devicePending` / `deviceAnswer` gated per identity |
| then | (4) `set-device` for a peer row, signed by that peer's key |
| then | (1) a second key on a peer row, and `inbox` / `send` accepting either |
| then | (5) the enrolling peer's node asks *"relays I hold a claim on"*, not `ownedUrls` |

We have no argument with any of it. Recording it here so the packet and the
commits can be checked against the same list.

### What the rendezvous work leaves you

Already true, already tested, and it carries into B unchanged:

- **The hold outlasts the pass, plus a margin.** `DEFAULT_WAIT_MS` 66s against
  `DEVICE_TICK_MS` 60s. A per-identity slot changes who is waiting, not the
  arithmetic.
- **The first pass is immediate**, so a browser already waiting is collected on
  the next start rather than a minute later.
- `spirit/test/deviceRendezvous.js` sweeps every phase offset and asserts one
  knock suffices. **It models a node already ticking** — that is its honest
  scope, and it is why it could not see your `setInterval` finding. Whatever B
  does to slots, this test should keep passing or the reason should be stated.

### What we would want in the packet

The cycles that worked best were explicit about which files arrive whole and
which are patched in place. So, per step: files dropped as-is, files patched by
name with the constraint spelled out (*"patch the call sites in prose, do not
replace"*), and which test file proves it. The harness rule still holds — a new
run module gets `git add`ed before the harness runs, because the lab fakes copy
from `git ls-files`.

## 4. Step 0 — the gate, and it is Andy's

You said you will not write B until 0 is on the live box. Understood and not
argued.

spirit-3 needs the update **and a process restart**, not only the new page.
`deviceHandshake.js` is read at startup, so an un-restarted relay serves the new
form while still holding 25s — the coin toss wearing a new coat, exactly as you
put it.

**Confirmation that this has happened will come from Andy, not from this
file.** We do not touch spirit-3.

## 5. Not opening

Panel look including the copy control, the event stream, IndexedDB durability,
fan-out across relays, the `bash/update` health-check-and-rollback that gates
re-enabling the cron, and the handheld mail client. All parked, all on purpose.

**The one word when Step 0 is confirmed: B.**
