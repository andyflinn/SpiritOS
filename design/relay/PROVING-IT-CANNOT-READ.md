# Proving the relay cannot read it, by trying to read it

> **This is a SPECIFICATION, not a proposal.** Every question it opened
> has been ruled. Nothing below is offered for decision except the one
> section marked OPEN, which is empty.

> **Andy, 2026-09-26:** *"testing: 'prove the relay cannot read it, by
> trying to read it', that's what the DEBUG flag is for, in the relay it
> will stream the packet it sees, back to the owner node, where the test
> can examine it, the owner node may need a DEBUG set as well to catch
> the prove-packet ? possible?"*
>
> and: *"this will be a popular approach for assertion in the relay."*

Handed to wsl-claude with that second sentence attached as the design
remark: **the shape has to be declared now, not after the third test.**

Verified at `31826b7`. Nothing here is built.

---

## Feasibility: yes, and smaller than it sounds

**The channel, the gate and the addressing already exist.**

- `relay.js:4604` `monitorEvent(kind, from, to, extra)` is the one door
  events leave by.
- `relay.js:4609-4611` refuses unless the caller is the OWNER and the
  owner is PRESENT — `auth.ownerName(allow)` then
  `presentNow.isPresent(ownerKey)`.
- `relay.js:4626` sends the row to `ownerKey` and nobody else.
- A post already reports ABOUT itself: `relay.js:2756` passes
  `{ bytes: body.length, hash: innerHash, via: 'partner' }`.

**So the only thing missing is the payload itself.** Today the row says
how big the packet was and what it hashed to; DEBUG would decide whether
it also carries what the relay actually holds.

### The second flag is not needed — that question is answered

Andy asked whether the owner node needs a DEBUG of its own to catch the
proof packet. **No.** The owner node is already the subscriber: the row
goes to it over the held connection it already keeps
(`relay.js:4626`). A suite subscribes as the owner and reads the rows.

---

## DECIDED — by Andy, and recorded rather than proposed

- **The instrument is the monitor row.** Not a new channel, not a second
  door. *"this will be a popular approach for assertion in the relay."*
- **DEBUG is what makes the row carry the held bytes.**
- **The proof is by trying:** post a sealed message, read what the relay
  streamed, and look for the plaintext in it.

- **HOW IT IS TURNED ON**, and it answers the first open question:

  > **Andy, 2026-09-26:** *"DEBUG is Off by default, returned and set by
  > owner-only api"*

  **BOTH DIRECTIONS IN ONE VERB.** The owner-only api SETS the state and
  RETURNS it, so a suite can ask whether DEBUG is on rather than trust
  that something flipped it — *the proof establishes its own
  precondition*. No environment variable, no file, no restart.

  *wsl-claude's, on why the read half matters more than it looks:* a
  proof that assumes its own precondition is the paired-positive failure
  in another costume. "The streamed bytes contain no plaintext" is true
  of a relay with DEBUG off, and without a way to ASK, the suite cannot
  tell that case from a passing one.

- **IT IS NOT DROPPED WHEN A RELAY GAINS MEMBERS**, and it is not refused
  on a public relay — both follow from the ruling above, and both are
  the opposite of what this document first recommended.

## WHAT WAS RECOMMENDED AND WHAT BECAME OF IT

**All three of this document's recommendations have been ruled on, two
of them against.** Kept rather than deleted, because a specification
that shows only what survived teaches nobody why the other reading was
tempting — and both reversals were reversals of wsl-claude's caution, in
the direction of the switch being MORE available rather than less.

**1. DEBUG MAY CHANGE THE VALUE OF A DECLARED FIELD. IT MAY NEVER CHANGE
THE SET OF FIELDS.**

This is the design remark made mechanical. If DEBUG decides *which
fields exist*, then every new assertion adds a field, and in a year the
flag is fifty switches — which is Andy's own *"it becomes untestable
when 50 places think it's easy enough to do inline"*, inside the relay.

With one declared row shape, a new assertion CANNOT quietly add a field:
changing the row is visible, and the fifty-places growth is impossible
by construction rather than by discipline.

**2. ~~THE SAFEGUARD MUST BE SOMETHING THE RELAY CAN TEST~~ — OVERRULED,
AND THE RULING IS BETTER THAN THE RECOMMENDATION.**

> **Andy, 2026-09-26**, reading this document: *"PROVING-IT-CANNOT-READ:
> i disagree, when spirit-3 shows hickups, rather than taking it down,
> the owner should be able to flip the DEBUG switch remotely and get even
> more valuable data.... for remote diagnosis, that cannot be easily had
> and brought back by ssh."*

wsl-claude had recommended refusing DEBUG on a relay holding members
other than its owner. **That would have forbidden the case the switch is
most worth having for.** A public relay misbehaving is exactly when the
owner needs to see what it holds, and the alternative — take it down,
reproduce it over SSH — is the thing that cannot be done for a fault
that only appears under real traffic.

The original worry was that a relay shipping payloads to its owner hands
over other members' traffic. It does, and the ruling accepts it on the
grounds that WHAT IT HANDS OVER IS CIPHERTEXT, on a stream the owner
already receives, gated to the owner and only while present
(`relay.js:4609-4611`).

**SO THE SAFEGUARD IS NOT A REFUSAL. IT IS AN ASSERTION** — see 3, which
is now the only thing standing between this switch and a plaintext leak.

**2b. AND "IT ONLY CARRIES CIPHERTEXT" IS FALSE AS WRITTEN.**

`peerPost.js:725` — `nodeCard.asks(text) ? '' : sealKeyFor(toKey)` — and
`:731`, `if (!nodeCard.asks(text) && sealsPosts)`. **CARD TRAFFIC IS NOT
SEALED.** With DEBUG on, a relay would stream other members' card
requests and replies to its owner in plain.

Andy has been told, and it does not change his ruling: cards are
self-signed and public by design.

**BUT IT BECOMES AN ASSERTION RATHER THAN A CAVEAT.** *Probably harmless*
is a sentence. The suite must ENUMERATE WHAT THE RELAY HOLDS UNSEALED —
cards today — and assert the list is exactly that, so the first thing to
travel unsealed for a NEW reason travels loudly, under a switch whose
whole defence is that nothing does.

*Found by the Windows Claude, against the ruling rather than for it,
which is the half of a review that is easy not to do.*

**3. THE SECURITY CONTROL AND THE PROOF ARE THE SAME ASSERTION.**

The worry is not today's ciphertext — the owner is entitled to that on
their own box. It is that this switch becomes the way plaintext ships
later, quietly, when something upstream changes what the relay holds.

**The assertion that proves the relay cannot read a packet is also the
assertion that catches that day**: if the streamed bytes ever contain
the plaintext, both the proof and the safeguard fail together, loudly,
in the same test. Nothing else needs watching it.

**4. THE PROOF NEEDS ITS PAIRED POSITIVE OR IT IS GREEN ON A SWITCHED-OFF
RELAY.**

"The streamed bytes do not contain the plaintext" is TRUE OF A RELAY
THAT STREAMS NOTHING. So the suite asserts both halves:

- the streamed bytes do **not** contain the plaintext, and
- the streamed bytes **do** contain the ciphertext the sender sent

Without the second, the first passes with DEBUG off, with the monitor
gate closed, and on a relay that never saw the post at all.

## WHAT THIS UNBLOCKS, AND WHAT IT NEVER BLOCKED

Measured against `cycle10Pending.js:165-181`, and the second half is the
part worth acting on:

| proof | this instrument |
|---|---|
| R10 prove the relay cannot read it | **needed** — it is the purpose |
| R16 what the relay streams is unreadable | **needed** — the row IS the subject |
| R11 the layering | needed, by consequence: its own note says its proof is R10 |
| R12 the relay's hash differs from the words' | **NOT NEEDED** |
| R7 the agents seal like everybody else | **NOT NEEDED** |

**R12 IS PROVABLE TODAY, WITH DEBUG OFF.** The monitor row already
carries the relay's hash — `relay.js:2756`, `:2894`, `:4166`. A suite
subscribing as owner can compare it against its own hash of the
plaintext now, against today's tree.

**R7 NEEDS NO RELAY AT ALL.** Its own note says it "needs measuring
rather than declaring", and the measurement is in `trafficLog`, which
records every attempt with its payload.

So two of the five have been waiting on a switch they do not use. That
is a finding about the BOARD rather than about this design, and it is
worth more than the instrument.

## OPEN — nobody has ruled these

*(nothing)*

> **Andy, 2026-09-26**, asked which of the five sealed-post proofs this
> retires: *"answer: none, it only may make proof possible."*

**THE QUESTION WAS MALFORMED AND THREE AGENTS ANSWERED IT ANYWAY.** An
instrument retires nothing. A requirement is discharged by a PASSING
PROOF and never by the means of proving it — so all five stay owed, and
what this changes is only which of them can be attempted.

*wsl-claude's, since two of those answers were mine:* I wrote "three are
retired by it" and then, thinking I was being careful, "two do not need
this work at all". The second half survives and the first does not. The
distinction he is drawing is not pedantry — a board that closes a
requirement when an INSTRUMENT lands has recorded a proof that was never
run.
- **Which of the five sealed-post proofs this retires.**
  `cycle10Pending.js:165-181` lists them with reasons; spiritos-37 reads
  four as reachable through this. Not yet checked here.

---

*Verified at `31826b7` by wsl-claude. Andy's words are quoted; the
recommendations are wsl-claude's and are marked as such.*
