# Proving the relay cannot read it, by trying to read it

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

## RECOMMENDED — wsl-claude's, and each is a refusal of an easier version

**1. DEBUG MAY CHANGE THE VALUE OF A DECLARED FIELD. IT MAY NEVER CHANGE
THE SET OF FIELDS.**

This is the design remark made mechanical. If DEBUG decides *which
fields exist*, then every new assertion adds a field, and in a year the
flag is fifty switches — which is Andy's own *"it becomes untestable
when 50 places think it's easy enough to do inline"*, inside the relay.

With one declared row shape, a new assertion CANNOT quietly add a field:
changing the row is visible, and the fifty-places growth is impossible
by construction rather than by discipline.

**2. THE SAFEGUARD MUST BE SOMETHING THE RELAY CAN TEST, AND "IS IT
PUBLIC" IS NOT.**

The proposal was that DEBUG refuse to start on a public relay. **Every
relay is public** — `relayServer.js:1023` announces itself as *"PUBLIC,
no loopback or Host restriction"*, and a lab relay is the same module.
So that rule refuses always, which means it is not a rule.

The line the relay CAN test is who is on it:

> refuse DEBUG when the roll holds members other than the owner —
> `relayStore.open(ROOT_DIR).members.count()`, which `relayServer.js:156`
> already calls for a different refusal.

A relay with only its owner on it has no third party whose ciphertext
could reach anybody. That is a real boundary and it is one call.

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

## OPEN — nobody has ruled these

- **Off by default, and how it is turned on.** A flag, an env var, a
  file? Not decided, and it decides whether a test can set it without a
  restart.
- **Whether DEBUG survives a claim.** A relay that gains its first member
  while DEBUG is on should presumably drop it, per recommendation 2 —
  but that is a ruling about a running relay, not a design.
- **Which of the five sealed-post proofs this retires.**
  `cycle10Pending.js:165-181` lists them with reasons; spiritos-37 reads
  four as reachable through this. Not yet checked here.

---

*Verified at `31826b7` by wsl-claude. Andy's words are quoted; the
recommendations are wsl-claude's and are marked as such.*
