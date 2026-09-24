# The public app server — and `join` as its first app

**APPROVED 2026-09-24 by Andy, at the close of the sitting that produced
it.** *"so we will close this session by approving the design, and
updating the brain."* Signed by both agents: wsl-claude reported what he
checked and what he would refuse to be handed, per rule 15, and raised
four readiness findings of which three are closed.

**Nothing is built. The design is approved; a BUILD still needs its own
packet** — `CLAUDE.md`: *"Do not build. No patch, no cycle. Feasibility
and shape only, until a packet says otherwise."*

**CYCLE 2 OPENED 2026-09-24** — Andy: *"go 2"* — and the last
readiness finding was closed before either agent started: **G14, the
app contract**, which says how an app declares what it takes. Closing
it first was deliberate: writing it after wsl-claude began asserting
would repeat exactly what cost him a sitting on 2026-09-24, the spec
moving under him while he worked.

**Still open and unruled**, and a builder may meet them: the `MemoryMax`
two-writers hole, how units on a box are counted, and the fingerprint’s
ingredients (wsl-claude’s to measure once the first two are ruled).

> **Andy**, 2026-09-24, stopping this from becoming a cycle: *"no code
> yet, i hope, this is a design-brainstorm where we will discuss and plan
> two stages, asserting the general architecture (the part from which the
> skelleton for a publicSpiritApp template comes), and later in the second
> half of the design, comes the part that descibes what the joinApp does
> specifically"*.

**This file was opened as `design/cycles/…-cycle-12.md` with eighteen
numbered requirements, and that was wrong twice over**: a design sitting
produces a document and not a cycle (`CLAUDE.md`: *"Do not build. No
patch, no cycle. Feasibility and shape only, until a packet says
otherwise"*), and no packet had said otherwise. It is kept rather than
deleted because the measurements in it are real and were taken against
the tree; the numbering is not.

**Read the two stages below as an agenda, not a board.** Stage 1 is being
worked. **Stage 2 is not designed** — the requirements listed under it
are the alpha plan's shape carried forward for discussion, and several
will not survive it.

---



## THE PURPOSE — the criterion everything here is judged against

> **Andy**, 2026-09-24: *"my purpose for this design cycle is:
> delieating all the mandatory and optional boundaries and layering, so
> our join-app doesn't have to be retro-fitted forever as the system
> evolves"*.

So the deliverable is **the boundaries**, and the test of the design is
not whether it is elegant but whether a boundary moves under `join`
later.

**THE SCOPE TEST THAT FOLLOWS.** A boundary must be settled in this cycle
if getting it wrong would change `join`'s **shape**. If it would only
change `join`'s **contents**, it can stay open without costing anything.

| | |
|---|---|
| **shape — settle now** | which part of `api.*` a standalone app may rely on; mandatory vs optional at each layer; whether the module's identity is *public app* or *app*, since that rides in the unit file `join` ships with |
| **contents — may stay open** | how style adoption is facilitated; which elements exist; the look itself; badges |

**And the cheaper half of the same insurance: the less `join` depends on,
the fewer boundaries can move under it.** Every dependency is a boundary
with a future. So *what does `join` touch* is not an inventory — it is
what bounds this cycle. The design must be complete over what `join`
stands on, not over everything that could be layered.

**THE ASYMMETRY.** If something **optional** later becomes **mandatory**,
every app that skipped it is retrofitted. If something **mandatory**
later becomes **optional**, nothing breaks — apps keep what they already
have. The boundary is safe to move in one direction only.

> **SUPERSEDED, and marked rather than rewritten.** This agent concluded
> from that asymmetry: *"where a call is genuinely unclear, make it
> mandatory — the cost is a fatter core."* Andy replaced it the same
> hour: *"plan with foresight, reduce implementation to the minimum that
> must cater to the foresight."*
>
> His removes the payment mine accepted. **The PLAN carries the
> foresight; the CODE carries only what the foresight requires.** Making
> a thing mandatory *and built* is the bloat, not the insurance — and
> erring toward a fatter core would have spent exactly what this project
> spends least of.

**SO EACH BOUNDARY IS A SMALLER QUESTION THAN IT LOOKS:** what is the
minimum that must exist **now** so the absent part can arrive **without
moving this**? Usually that is the seam and not the thing — one
declaration where there will be many, a named subset rather than a full
surface, a slot rather than a mechanism.

**AND IT GIVES THE DESIGN A TEST IT CAN BE HELD TO.** Anything deferred
must be **addable without changing anything already built**. If adding it
later would edit existing code, the seam is in the wrong place — and that
is a design fault to find here, while it costs a sentence, rather than in
the cycle that trips over it.

This is also the reconciliation with the instinct the tree already has —
*"Later keys (a disc limit) arrive with the cycle that uses them"*
(`relayConfig.js:26`). That instinct was never wrong; it is about
**features**. The foresight is about **boundaries**. A missing feature is
added later at its own cost; a boundary that moves retrofits everything
standing on it.

---

## HOW A BOUNDARY ACTUALLY ROTS — three narrownesses in one day

**Added at wsl-claude's request when signing the cycle-report**, and it
belongs in a document whose deliverable is boundaries: *"it is evidence
about how boundaries rot: not by being wrong, but by a tool quietly
narrowing what counts."*

Three times on 2026-09-24 a reader could not see something true, and each
was found the same way — by a declaration citing something that existed:

```
  a CONDITION could not reach the board      the reader knew only ### R<n>
  a DESIGN could not reach the board         the reader walked only design/cycles
  a CORRECT CITATION reported as naming       the reader matched the document
  nothing                                     name case-sensitively
```

**AND EACH HAD THE SAME TEMPTING ESCAPE: move the document to where the
tool looks.** Rename `C3` to an `R`. Put the design under `cycles/`.
Rename the file to lower case. **Each would have worked**, each would
have been the tool teaching the tree where to keep its own design, and
each would have cost a true thing to keep a narrow reader comfortable.

**Why this is not a note about a test file.** A boundary is only as wide
as what can be said inside it. A reader that silently refuses a valid
citation does not announce a limitation — it reports the citation as
naming nothing, which reads exactly like a mistake by the person who
wrote it. So the pressure is always on the writer to conform, and the
narrowing never appears as a decision anybody made.

**The rule it produces, for this design and after it:** when a tool and a
true thing disagree, the tool is the thing that changes. And a tool that
narrows what counts should be suspected first whenever a correct
statement is reported as wrong.

---

## THE CURRENT REQUIREMENT LIST — stage 1, after five reconciliations

**This list supersedes `S1-S8` further down**, which are kept for the
reasoning inside each but carry the pre-negotiation wording. Where they
differ, this list is the one that holds.

**Stage 2 (`J1-J10`) is an agenda for a later cycle and is NOT
requirements** — Andy postponed it to its own design-implementation
cycle.

### What this phase proves, which had no answer until Andy asked

The settlement said *greenfield proves the boundary can be built on; the
first migration proves it is general* — and the first migration is the
**next** cycle's acceptance test. But `join` was already postponed, which
left this phase building the layer **with no consumer at all**. Both
agents had argued that a boundary validated without something built on it
is worth nothing, and then agreed a sequence that does exactly that.

> **Andy:** *"the second consumer is the offical hello-world app for this
> layer."*

**A throwaway consumer rots; the official sample cannot** — the artefact
that proves the layer is the artefact every stranger copies, so it is
exercised for ever and its comments are the documentation. And `join`
stops being the user the abstraction was fitted to: it becomes the
**second instantiation of a template that was already proven.**

---

### G1 — `appServer.js` is a third startup module

**Status:** OPEN. Nothing built.

Dispatched from `server.js` before any node code is required, exactly as
`--relay` is (`server.js:13-16`), so it loads no shell code and no relay
code. **Not named for publicness** — publicness is deployment, so the
mode names what the process *is*: one app, no dispatch.

### G2 — one app, one whitelist, no dispatch

**Status:** OPEN. Nothing built.

A whitelisted set of paths, `noindex`, loopback behind Caddy, no
directory listing. Key-addressing available on `device.html`'s terms — a
locator that grants nothing.

**Open:** offering shell files widens the whitelist. It must be *these
files are offered*, never *the shell's folder is servable*.

### G3 — `ask` has one home, and the app server uses it

**Status:** OPEN. Three divergent copies exist.

Fourteen lines, not `kernel.js` wholesale. Existing copies are **not**
migrated in this cycle; no fourth is written.

### G4 — the shell provides the optional layer, as files

**Status:** OPEN. Zero `.css` files exist.

Elements and style adoption are **separately optional**. The provider is
the shell's **folder**, not its process — every clone carries
`app/shell/` whether or not anything launches it. *"Paints, never
decides"* is the condition of being offerable at all.

**Out of scope:** whether a given page conforms to the tokens. That is
one app's business, and stage 2's.

### G5 — the mode's NAME is decided here; its rendering is not

**RULED 2026-09-24: the mode is `--app`, and the module is
`appServer.js`.** Andy: *"1 agreed."* It names what the process IS
— one app, no dispatch — rather than where it sits, because
publicness is a deployment fact. A builder no longer stops on line
one of the first file.

**Status:** OPEN. One hardcoded `--relay` blocks it.

`join` ships a unit file carrying the mode, so a later rename retrofits
join's own deployment artefact — which puts the **decision** in scope by
Andy's shape test. The rendering, the variable renames and the
compatibility shims are implementation and stay **out**.

### G6 — an app server serves exactly one relay, and learns its owner

**Status:** OPEN. Nothing built.

Bound to one relay, learns `ownerKey` from it, **waits while the relay is
unclaimed**, refuses to start if it is not a member. No owner key and no
domain in the tree or in its configuration.

**AND TWO PROPERTIES THAT LIVED ONLY IN THE NEGOTIATION UNTIL NOW**, which
wsl-claude flagged at the readiness check as the gap he would least like
to ship — *"built as written, 'learns its owner' IS the hostile-relay
hole we closed in conversation"*, and the most dangerous item on his list
**because the requirement reads complete without them**:

- **PIN THE RELAY'S IDENTITY KEY, NEVER THE URL.** A URL is a name
  somebody else controls: an expired domain, a DNS change, a restored
  backup or a typo answers once and, under `learns its owner`, owns the
  app for good. The bind is to the key the relay proved at first contact.
- **THE FIRST BIND IS FINAL: a later different answer is REFUSED, KEPT
  AND REPORTED.** Not accepted, not silently ignored. Refused so the
  wrong owner cannot take over; kept so the contradiction survives; and
  reported because a relay that has started answering with a different
  key is either a migration the owner made or an attack, and only the
  owner can tell which.

This is cycle 10's card-ordering argument arriving at the bind: *accepted
once, from whoever got there first* is not the same as *accepted from
anywhere the signature holds*, and the difference is the whole value of
pinning.

### G7 — the node's role is asked, never cached, and fails CLOSED

**Status:** OPEN. No such constant exists.

`nodeIsOwnerNode`, `nodeIsPublicApp`, derived on demand. **Unknown means
NOT the owner node** — never "assume yes because it was yes a minute
ago", because the tempting implementation is a one-minute cache that
reintroduces the exact failure the rule exists to prevent.

### G8 — layer 1 splits by PROMISE, and the stable half is named

**Status:** OPEN. One undivided bucket today.

The app contract must hold for ever; box concerns change per deployment.
**Anything in the stable half needs a deprecation path and anything in
the other half does not** — so the test is mechanical: *if removing it
would break an app that never changed, it is in the stable half.*

### G9 — strict posture: one enforced half, one declared half

**Status:** OPEN. Nothing built.

**Persist nothing about a visitor** falls out of the writable-scope
declaration and is checkable. **Refusals are members of a declared closed
set** — and the set is *both* platform and app:

- **the platform owns the refusals the platform produces** — unbound,
  full, owner asleep, key mismatch, not a member — identical in every
  app, so a stranger meeting *"this relay is full"* in two apps meets one
  sentence;
- **an app owns its own, declared the same way** — closed, literal, no
  interpolated figures, reviewed once.

*"Nobody has to agree to a vocabulary they did not write; they have to
agree to declare theirs."* And the assertion is the same either way:
**every refusal is a member of SOME declared set, and nothing outside a
set is emitted** — which is walkable, so *which* set is a question of
ownership rather than of enforcement.

**The honest limit:** a closed set does not make a sentence good. It
converts a continuous prose problem into a one-time review of N sentences
plus a mechanical check. Written as a guarantee, it would be the check
that cannot fail, in a document.

### G10 — a server reports the box it sits on: four fields, one opinion withheld

**Status:** OPEN. Nothing built. **Interface deferred by Andy; the
OWNER-SIDE MINTING IS IN**, ruled 2026-09-24: *"the owner is needed for
minting and onboarding features."*

The owner s node is the minting party by design — it already mints
invites (`relay.js:3677-3684`) — so a box label minted at bind is the
same kind of act rather than new territory. wsl-claude raised it at the
readiness check: the interface being deferred does NOT defer the
minting, because without it a server has no label to report and the four
fields below become three, so a builder would do the server half and
stop.

**AND THE REASON IT CANNOT BE DEFERRED IS VERIFIABILITY, NOT
COMPLETENESS.** Andy, closing it: *"the owner half is needed to verify
the server half?"* Yes — and that is stronger than the completeness
argument recorded a commit earlier. The server half COULD be tested
with a hand-supplied label and would pass, and the pass would certify
the FIXTURE rather than the product. That is wsl-claude’s finding from
the same morning arriving in a new place: *"a suite that supplies the
one thing the tree never did is a green that certifies the test’s own
scaffolding."*

So the label must arrive **the way it really arrives**, or the server
half is verified against a world that does not exist — the same
discipline as *build the fixture with the production writer, never
hand-assemble it*.

**What the owner s node owes: assign a label at bind, refuse a
duplicate, remember it.** It is the one party holding the whole list,
which is what makes a collision impossible rather than merely visible.

**AND THE SCOPE LINE, held so the two do not merge:** the BOX LABEL
minting is stage 1. `join` s OAuth minting program is stage 2. Same
party, different cycles.

```
  assigned box label      minted by the OWNER when the server binds
  opaque fingerprint      derived locally; identifies nothing
  allotted at install     what this server was given
  box total as measured   free; measure() already produces it
```

**A server reports facts and never an opinion.** It never says "this box
is over-committed" — it holds one report and the contradiction lives
across several. The arithmetic belongs to the party holding all the
reports, which is the owner's node. **No server needs to know its
siblings exist**, which is what keeps the deferral honest.

**Deliberately absent: anything about what the server is FOR.** A box
view carrying app facts is how the general layer acquires its first
join-shaped wart.

### G11 — no failure-state lever; the states are reachable from outside

**Status:** OPEN. Nothing built.

The template ships **no switch**. Every failure state must be reachable
by **arranging the world around an unmodified instance**: start a real
relay and do not claim it; start one whose seat figure is zero; do not
start the owner's node; stand up a second relay with a different key.

**And the four runs are the sample's own README** — the four commands
beside the sample, not a suite elsewhere describing them. *A sample whose
failure states are only reachable by our harness has taught the stranger
nothing about the states they will actually meet.*

**If a state cannot be reached from outside, it is not testable by
anyone, ever — and that is the finding rather than an inconvenience.**

### G12 — app code and app state do not share a directory

**Status:** OPEN. Today `app/<name>/` is both.

The convention that code and data share a folder was written when apps
were files in a private shell. **A public app is deployed by
replacement**: replacing the folder destroys whatever sat beside the
code, and merging leaves orphans nobody can reason about — *"both are
wrong and the second is worse, because it looks fine."*

So an app's state has its own home keyed by the app's name, beside the
node's state rather than inside the app. **The tree already has that
shape in `relay-state/`**: gitignored, deployment-safe, never confused
with code.

**It costs nearly nothing today**, because a public app persists nothing
about a visitor by default — and it prevents the one unrecoverable
failure: a redeployment silently eating data an app was trusted with.
*Decide it now and the sample demonstrates it; decide it after two apps
exist and it is a migration.*

### G13 — the official sample instantiates the template, and IS the acceptance test

**Status:** OPEN. Nothing built. **Named `app/starter/`, ruled by Andy 2026-09-24.**

It binds, learns its owner, serves a page, posts to the owner's node —
and nothing else. No GitHub, no seats, no visitor story, so the stage
split holds exactly where Andy drew it.

**The acceptance test of this phase:** the sample, unmodified, driven
into all four failure states from outside (G11). If it cannot be, the
boundary is wrong and we learn it **before `join` exists**.

**THE NAME, three proposals and one ruling owed:**

- **`hallo`** (Andy) — distinguishes by spelling. Against it: *the first
  thing a copier does is rename it to something they can spell, so the
  distinguishing property is destroyed by the artefact's own purpose.*
- **`app/hello/`** (this agent) — convention followed, told apart from
  `process/js/hello/` by path. Against it: *works in a tree and fails in
  a sentence — "run hello" costs somebody an afternoon, and it will be a
  stranger's afternoon rather than ours.*
- **`app/starter/`** (wsl-claude) — named for its job. *"It says COPY ME
  in the name, which is the one thing the artefact needs a stranger to
  understand."* And "hello world" is a convention for a language's first
  program; this is a template instantiation whose comments are the
  product.

**RULED: `app/starter/`** (Andy, 2026-09-24), and his reason adds to
wsl-claude’s rather than repeating it. wsl argued from the artefact —
*it says COPY ME in the name*. Andy argued from the person: *"i
actually agree with wsl, it indicated a forward direction for the early
adopter."* **"Hello world" implies a demo you run once and leave; a
starter is where somebody BEGINS something.** That is the reason to
keep written down, because it is the one that stops a later session
renaming it back to a greeting.

**One artefact carries the name** — a tree with two
things called `hello` is a defect a board can hold rather than a matter
of taste.

---

### G14 — an app DECLARES what it takes, in its manifest, and gets nothing it did not ask for

**Status:** OPEN. Nothing built. **This closes wsl-claude's readiness
finding 1**, raised at the sign-off and the only one still standing when
the build opened: *"G2 offers files, G3 gives `ask` one home, G4 makes
elements and tokens separately optional — and NOTHING SAYS HOW AN APP
DECLARES WHICH IT TAKES. A builder reaching G4 must invent that
mechanism, and inventing it is inventing the boundary, which is the one
thing this cycle exists to fix."*

**The vehicle already exists and nothing new is invented.** An app is a
folder plus a sibling manifest of pure data — `name`, `description`,
`icon`, `hidden`, `intrinsic`, `owner`. No behaviour. That is the plugin
pattern this design arrived at three times from different directions, and
it is already proven one level down: **the type declares data, and
inherits the mechanism.**

So the app contract is **three keys in the manifest an app already has**:

```json
{
  "surface": ["verb", "peerPost", "onPacket", "fs"],
  "utilities": ["elements", "dialogs"],
  "posture": "strict"
}
```

| key | says | absent means |
|---|---|---|
| `surface` | which members of `api.*` this app relies on | **nothing** — an app that declares no surface is handed none |
| `utilities` | `elements`, `dialogs`, `tokens` — separately, as G4 requires | none of the optional layer |
| `posture` | `strict` for an app serving strangers (G9) | ordinary — and a public app server **refuses to serve an app that is not strict** |

**ABSENT MEANS NOTHING, AND THAT IS THE LOAD-BEARING CHOICE.** The
tempting default is *absent means everything*, because it makes the first
app easy to write. It is wrong in the direction that cannot be undone:
every app then depends on the whole surface by accident, and **the
boundary becomes unmovable the day the second app ships.** An app that
asks for nothing and gets nothing fails immediately and obviously, in
development, at the hands of the person who can fix it.

**THE DECLARATION IS DATA AND NEVER CODE**, which is what keeps this from
becoming a fork. A manifest that could declare *behaviour* would let two
apps disagree about what `fs` means; a manifest that names members can
only be right or wrong, and being wrong is visible.

**AND IT IS WHAT MAKES THE BOUNDARY ASSERTABLE AT ALL.** Until now
*"which part of `api.*` may a standalone app rely on"* could only be
answered by reading code. With a declared surface it is walkable: every
member an app touches is in its `surface`; every member in a `surface` is
one the server can hand it; **and a member no app has ever declared is
dead surface**, which is the same counting discipline as `oneDoor` and
the closed refusal set.

**Asserted by:** an app declaring no `surface` receives no `api` members;
an app touching a member it did not declare fails, and fails in
development rather than in front of a stranger; `utilities` are
independently grantable; a public app server refuses a non-`strict`
app; and every declared member exists in the `api` the server builds.

**Open inside this, and deliberately so:** whether `surface` may name a
member the shell has and the app server does not. **Recommended:
no** — one vocabulary, and a member the app server cannot supply is
refused at load with the member named, rather than at the moment the app
reaches for it. That is the difference between a boundary and a surprise.

---

### MOVED OUT OF SCOPE, and why

- **The Relay Monitor representing a second server type** (was S8) — a
  consequence of the boundary existing, and a screen. Later.
- **Page conformance to the style tokens** (S4's second half) — one app's
  business, stage 2's.
- **The unit template's rendering and the `SPIRIT_RELAY_*` renames**
  (S5's implementation) — deployment infrastructure, not a boundary.
- **The owner's box-management interface** — deferred by Andy; only the
  data it will need is in scope (G10).

**Keeping them in would not make the cycle wrong — it would make it an
implementation cycle wearing a design cycle's name**, which is the error
that has already cost this sitting two false starts.

---

## SETTLED BETWEEN THE AGENTS — the four contested points

**Reconciled 2026-09-24. No divergence sent to Andy**, who asked for the
negotiation to happen between the agents rather than through him.

### 1. Layer 1 splits by PROMISE, not by audience

wsl-claude found layer 1 defined by exclusion ("not painting") and argued
two audiences. This agent argued the stronger form — **two stability
promises in one bucket** — and he took it over his own: *"mine was a
readability argument and yours is a correctness one. An audience mix-up
costs a reader a minute; a promise mix-up is the retrofit Andy opened the
cycle to prevent."*

**AND THE CONSEQUENCE THAT MAKES THE SPLIT ENFORCEABLE RATHER THAN
DECORATIVE**, his: *"anything in the stable half needs a deprecation path
and anything in the other half does not."* That one sentence tells a
later session which half a new thing belongs in without re-deriving the
philosophy — **if removing it would break an app that never changed, it
is in the stable half.** Mechanical, and independent of who is reading.

### 2. Strict posture is half-enforceable, and the closed set is the half

*Persist nothing about a visitor* falls out of the writable-scope
declaration and is checkable. *Refuse in sentences a stranger can act on*
is prose quality and no declaration reaches it. A **closed set of refusal
sentences** converts most of the second half into something mechanical:

- every refusal an app can emit is a **member** of the set, assertable by
  walking the emission sites the way `oneDoor` counts doors;
- **no member carries an interpolated figure**, which makes cycle 10's
  leak rule structural instead of a habit — members are literals, and
  anything dynamic is a named slot with its own whitelist;
- a member nothing can emit is **dead vocabulary**, and shows up as such.

**AND THE HONEST LIMIT, which belongs beside it:** *"a closed set does
not make a sentence good. It converts a continuous prose-quality problem
into a ONE-TIME review of N sentences plus a mechanical check that
nothing outside the set is emitted. That is a real improvement and it is
not a guarantee, and if we write it as a guarantee we have built the
check that cannot fail, in a document."*

### 3. The `__MODE__` DECISION is in scope — and it must not be named for publicness

wsl-claude conceded: *"join ships that unit file, so join's deployment
artefact IS join's, and a rename retrofits it."* The **decision** is in
scope; the rendering, the variable renames and the compatibility shims
are implementation and stay out.

**AND THE DECISION IS ALREADY HALF-MADE BY SOMETHING BOTH AGREED:** if
publicness is not an architectural axis, **the mode must not be named for
publicness.** It should name what the process *is* — one app, no dispatch
— not where it sits. So `--app` or `--appserver` rather than `--public`,
and **`publicAppServer.js` becomes `appServer.js`.** The same module on
loopback is the same module, which is the open question answering itself.

### 4. The failure-state lever is WITHDRAWN, and the replacement is better

wsl-claude proposed that a public app be able to enter each of its own
failure states **on command**. This agent objected that such a switch is
a live lever — *pretend unbound, pretend full, pretend the owner is
asleep* — in a process strangers can reach, on the one box with no shell
and no operator watching. He withdrew it.

> **DO NOT PRETEND THE STATE — BUILD THE WORLD THAT PRODUCES IT, FROM
> OUTSIDE THE PROCESS.** Do not fake an unclaimed relay: start a real
> relay and do not claim it. Do not fake a full one: start one whose seat
> figure is zero. Do not fake a sleeping owner: do not start the owner's
> node. Do not fake a swapped key: stand up a second relay and point the
> app at it.

That is the shape of the cycle-9 systemd rehearsal and of this evening's
fresh-clone run in a private network namespace — **both produced findings
nothing in-process could have produced.**

**SO THE REQUIREMENT CHANGES SHAPE.** The template ships **no lever**.
What it must have instead is that **every one of its failure states is
reachable by arranging the world around an unmodified instance** — a
design constraint on the app server rather than a feature of it. It
forbids a failure state that can only be produced by a condition nobody
can construct, which is the trap that would otherwise hide inside *"waits
while the relay is unclaimed"*.

**And the sharp form:** *if a state cannot be reached from outside, it is
not testable by anyone, ever — and that is the finding rather than an
inconvenience.*

---

## SETTLED BETWEEN THE AGENTS — the box a server sits on

Andy found the gap and ruled half of it: *"are you guys proposing that an
owner node gets a comprehensive interface to manage depoyed public
servers… and provides help for tuning two public servers on same VPS?"* →
**"interface deferred. yes. you and wsl settle on the shape."**

**THE GAP:** remote resource configuration is **per server**; division of
a box is **per box**; nothing reconciles them. An owner can legitimately
raise two servers on one VPS to eighty percent each from his own node and
nothing notices until the box does — the `MemoryMax` two-writers problem
one level up. The **interface** is contents and is deferred; the **data**
is shape, because adding it later touches every deployed server.

### A server reports facts and never an opinion

wsl-claude's addition, and it decides where the logic lives: a server
says **which box it believes it is on**, **what it was allotted**, and
**what that box measures in total**. It does **not** say "this box is
over-committed", because it cannot know — it holds one report and the
contradiction lives across several.

**The reconciliation belongs to the party that holds all the reports** —
the owner's node, which is also the party that will one day draw the
interface. **Data per-server, arithmetic per-owner, and no server ever
needs to know its siblings exist**, which is what keeps the deferral
honest rather than half-kept.

### The box label is MINTED BY THE OWNER, like an invite

Over-commitment is **reported, not refused** — refusal would need sibling
figures, which needs the deferred box view, dragging it back in through
the cellar.

And "which box" is neither declared by the operator nor derived:

- **declared by the operator collides silently** — two different boxes
  both saying `box-1`, and the owner tunes a pair that does not exist;
- **derived is fragile** — *"this box reports itself as Linux and behaves
  like NTFS underneath, cloned VMs share a machine-id, and containers
  inherit one from an image, so 'unique per box' is a property no derived
  value actually has."*
- **minted by the owner makes collision impossible rather than visible**,
  and it is the pattern this system already uses for the only other thing
  that must be unique across strangers: **an invite**. The owner mints
  it, the server carries it and echoes it back, and nobody else can
  produce one.

### And the half neither agent had: a label cannot notice it has become wrong

A server moved to another VPS, or an image cloned with its state, carries
its label with it — **still unique, now attached to the wrong machine,
failing in the direction of looking correct.**

**So the server reports BOTH: the assigned label, and an opaque local
fingerprint it derives itself.** Not to identify the box — the
fingerprint identifies nothing to anybody and carries nothing about a
person — but so the owner's node can **see a contradiction**: two servers
claiming one label with different fingerprints, or one server whose
fingerprint changed between reports. **Neither value is trustworthy
alone. Together they are loud.**

**This is the morning's rule arriving in a new place:** *freshness and
citation are gates on provenance; the only gate on meaning is an
independent derivation.* The label is the claim; the fingerprint is the
independent derivation; the owner has to trust neither.

### Four fields, and one deliberately absent

```
  assigned box label      minted by the owner when the server binds
  opaque fingerprint      derived locally; identifies nothing, contradicts loudly
  allotted at install     what this server was given
  box total as measured   free — measure() already produces it
```

The last is what lets the owner compute over-commitment without asking
anybody, **and lets two servers on one box contradict each other about
the box's own size**, which is another way the same lie surfaces.

**One field deliberately NOT added: anything about what the server is
FOR.** That is the app's business — *"a box view that starts carrying app
facts is how the general layer acquires its first join-shaped wart."*

**Open, and deliberately left so: the fingerprint's ingredients.** It
must survive a reboot, change when the machine genuinely changes, and
reveal nothing — and on WSL half the obvious ingredients lie. The
requirement is that a server reports **a stable opaque value** and that
the owner treats **a change as a contradiction rather than as an
update**; which ingredients produce it is **contents**, and wants
measuring on both platforms first. That measurement is wsl-claude's.

---

## SETTLED BETWEEN THE AGENTS — implementation order

**Reconciled 2026-09-24, no divergence.** Andy asked whether an
implementation plan would first retrofit existing modules into compliance
(*"so an iplementation plan will first retrofit existing modules, to be
in compliance with the new structured layering proposal?"*), agreed it
would not, and asked the two agents to settle it between themselves. The
result is a third position, not either agent's.

**NO RETROFIT FIRST, and the deciding reason is structural rather than
about risk.** A boundary drawn by looking at four existing modules and
then proven by moving those same four onto it has proven nothing — it is
wsl-claude's own *"an abstraction proven by its first user is a shape
fitted to that user"*, with the existing tree as the user. The risk
argument and Andy's foresight rule both agree, and are secondary.

**THE ORDER:** name the boundary (design only) → build the new consumer
greenfield, because a thing built *only* on the boundary is the honest
test of whether the boundary works → migrate existing modules later, one
at a time, each migration a test of the boundary rather than a chore.

### But a sentence is too weak an instrument — wsl-claude's finding

This agent proposed that each module which ought to move gets **one
written line** saying what would have to be true for it to move, and
flagged it as the part it was least sure of. It was right to be unsure,
and the reason is better than "people are lazy":

> **A SENTENCE IN A DESIGN DOCUMENT CAN NEVER BECOME FALSE.** It sits
> there being equally true the day it is written and two years later when
> the thing it describes has quietly become impossible. Nothing about it
> changes when the world does, so nothing ever tells anyone to look at it
> again.

That is the same disease caught three times in one evening wearing three
costumes: a card counter nothing advanced, a migration nothing called, a
condition no board could see.

**AND A DATE IS WORSE THAN A SENTENCE.** A dated commitment in a
repository nobody polices is a sentence with a number in it. It rots into
an embarrassment people learn to scroll past — *which teaches the habit
of scrolling past.*

**THE INSTRUMENT ALREADY EXISTS**: the `### C<n>` declared condition,
built the same morning. A condition is on the tally line every run, it is
counted, and it **turns red the day somebody does the thing** — which
tells the next person to replace the declaration with a real assertion.

**And the test of a declaration is the test of everything else here: if
it cannot turn red, it is prose with a counter.** *"`device.html` calls
the shared `ask`"* can — walk for the hand-rolled `fetch`.
*"`relayLimits.js` has an honest name"* cannot, and should stay a
sentence rather than pretend to be a gate.

### The synthesis: the layer is not done when this cycle ends

**Greenfield proves the boundary can be BUILT ON. The first migration
proves it is GENERAL. Those are different claims and they need different
evidence.**

So: **the general layer is not considered done at the end of this cycle.
It is done when ONE EXISTING MODULE HAS MOVED, and that migration is the
acceptance test of the cycle that follows.** Not retrofit-first —
**retrofit-as-proof, second, and named as the proof rather than as
tidying**, which also means the first migration is chosen for what it
would **teach** rather than for how easy it is.

**`device.html` teaches most**: it is the other interactive enrolment
flow, it hand-rolls the door call, and it is somebody else's file.

### The renames wait, and the reason is sharper than "not now"

> **A RENAME IS THE ONLY CHANGE THAT TOUCHES EVERY CALL SITE WHILE
> CHANGING NO BEHAVIOUR.** Maximum diff, minimum information.

And it lands on the two files this cycle has promised not to change — so
it would **destroy the one assertion that holds that promise**, by making
a byte comparison fail for a reason nobody cares about. *A tidy-up that
breaks the guard protecting the cycle's central claim is not a tidy-up.*

---

## THE `api.*` INVENTORY — measured at `b03ed80`, not proposed

Both agents named this the first deliverable and the whole cycle: **the
subset a standalone app may rely on IS the boundary.** So it is counted
rather than argued. `buildApiFor(app)` (`shell.js:1216`) hands an app
**28 members**. Sorted by whether they mean anything with no shell
present:

```
COULD STAND ALONE — the node is all they need           13
  verb                 1228   the door: POST /api/spirit, api.verb is
                              "its only public form" (shell.js:1207)
  peerPost             1605   ── the whole point of a public app
  sendMessagePacket    1556
  onPacket             1571
  onRelayEvent         1577
  onRegarding          1667
  fetchExternal        1238   the proxy, owner-gated at the node
  fs                   1709   ← scoped, and ONLY for a dynamic app
  readProject          1483   an unscoped read, deliberately
  onFiles              1491
  onJobs               1502
  nodeLabel            1680
  escapeHtml           1218   a string function; it needs nothing

SHELL NAVIGATION — meaningless with one app                10
  launchApp  callDialog  setDialogResult  closeDialog
  addTitlebarLink  setScreenTitle  setScreenMark
  armUntilElsewhere  isVisible  nodeLabelChanged

SHELL CATALOGUE — about OTHER apps                          4
  listApps  listGroups  getAppOverride  setAppOverride

PAINTING                                                    1
  ui.elements.createIconSelector    1469
```

**THE BOUNDARY IS ALREADY VISIBLE IN THE SHAPE OF THE COUNT.** Thirteen
of twenty-eight need nothing but a node; fourteen are the shell's own
job — navigation for a stack that a one-app node does not have, and a
catalogue of apps it does not host. That is not a subset somebody has to
negotiate. It is a line the existing code already draws and nobody had
counted.

**Two that need deciding rather than sorting:**

- **`fs` is conditional today** — it is attached only when
  `app._scriptPath` exists (`shell.js:1707-1710`), i.e. only for a
  dynamically loaded app. A standalone app is always "dynamic" in that
  sense, so this is likely a non-issue; it is listed because a
  conditional member is a boundary with a hole in it.
- **`readProject` is an unscoped read by design** — *"the Process Browser
  lists files under `process/`, the Files app walks the whole tree, and
  neither is doing anything `api.fs` (scoped to `app/<name>/`) can
  express"* (`shell.js:1475-1478`). On a one-app node there is no Files
  app and no Process Browser. Handing a public app an unscoped read of
  the whole tree is a decision, not an inheritance.

**And one observation that belongs with the dialog question.**
`callDialog` launches *another app* as a dialog and waits for its result.
On a one-app node there is no other app — so a standalone app does not
need `callDialog` at all, and a modal inside one app is ordinary UI. The
dialog **rule** (*"a dialog can only return"*) governs a thing that
cannot occur there. That strengthens the ruling rather than weakening it:
the rule travels with the painting precisely because the painting can
travel where the rule has nothing to govern.

---

## THE TERMS — APPROVED, AND NOW THE DICTIONARY’S

**APPROVED 2026-09-24, so these are no longer provisional** and have
moved to `DICTIONARY.md`. They were held out of it while the layering was
unsettled, because that file records settled usage and filling it with
proposals would turn it into a proposal store.

**They were written down here anyway while the design ran**, and that was
the point: So these words are **not** in `DICTIONARY.md` and must not be
put there until they are agreed — that file records settled usage, and
filling it with proposals would turn it into a proposal store, which is
the one thing it is not.

They are written down anyway, and here rather than nowhere, because two
agents working a design need the same words or they diverge on vocabulary
before they diverge on substance — and a divergence about wording is the
most expensive kind to find late, because it looks like agreement.

**Use them while the design runs. Move them to `DICTIONARY.md` when, and
only when, the layering is approved. If the layering is corrected, these
are corrected with it — they carry no authority of their own.**

| provisional term | interface | present? |
|---|---|---|
| **core** | `spirit.core.*` | always — it is what being a node is |
| **app surface** | `api.*` | only if the node serves an app |
| **app utilities** | `api.ui.*` | optional |
| **the node's app** | — | exactly one per node |
| **sibling app** | — | a peer of the shell, not hosted by it |
| **public app** | — | a node's app reached by strangers |
| **declaration** | — | what a type plugs into core: data, never code |
| **appetite** | — | a type's declared share of a box |

**Two are flagged as weak by their author.** `core` is the most
overloaded word in software, though it has the merit that the interface
already carries the name. And **`app surface` is the one least likely to
survive** — it names the layer this sitting kept circling without naming,
which makes it the one that matters most and the one thought about least.
What it means is *what one app is handed, and nothing beyond it*.

---

## DECIDED IN THE SITTING — 2026-09-24

Attribution marks authority, not authorship: these are named so a later
session does not relitigate them. Everything below this section is
proposal until it appears here.

- **The design has two stages, and both are in it.** Andy: *"it's
  both"*. Stage 1 is the general architecture, whose output is a
  **skeleton for a publicSpiritApp template**. Stage 2 describes what
  the joinApp specifically does.
- **Stage 2 is postponed to its own design-implementation cycle.** Andy:
  *"now is the time to design the general layer, and we postpone the
  join-specific stuff with a separate design-implementation cycle"*. The
  `J`-items below are an agenda for that cycle, **not requirements**.
- **The two halves must be distinguishable in the suite arrangement.**
  Andy: *"these two halfs must also be distinguishable in the
  suite-arrangement"*. A stage-1 suite that names GitHub, OAuth, a seat
  or `join` is a stage-1 suite that has stopped being general — so the
  separation is asserted rather than trusted.
- **`join` is a sibling to the shell, not a child of it.** Andy: *"i
  agree that join is a sibling to shell"*. So `app/shell/`, `app/join/`,
  `app/contacts/` are peers. This follows from the model below: apps
  belong to the **node**, and the shell is merely the one whose job is to
  fan out to others. Nesting would say apps belong to the shell.
- **An app owns the inside of its own folder.** Andy: *"it is up to
  join, if it needs subfolders or not"*. So the platform fixes the
  **contract** — where the entry point is, the sibling manifest, and
  which of `api.*` may be relied on — and fixes nothing below it. This is
  why the layout is not the first deliverable: the interior was never the
  platform's to specify, and the boundary is the surface an app is handed.

- **THERE ARE TWO LAYERS, AND THE SECOND IS OPTIONAL.** Andy: *"there is
  two layers: the configuration-basics and app-utils-and-dialogs
  (optional on top of that)"*.

  | layer | holds | who takes it |
  |---|---|---|
  | **configuration-basics** | the process and its door: bounds, allotment, remote configuration, the unit, `ask`, the app contract | every node — relay, shell node, public app node |
  | **app-utils-and-dialogs** | the painting: shared elements, dialogs **and the rule that governs them**, the look tokens | whoever wants it |

  **This replaced a proposal of three layers with sibling
  `shell-basics` / `public-app-basics` on top.** Two consequences make
  the simpler shape the right one:

  - **Fanning is not a layer.** It has no home in either, and it should
    not: the shell is an app, and fanning out to other apps is *what
    that app does*. The sibling layers dissolve — what distinguishes the
    shell from `join` is only how much of the optional layer it takes,
    plus its own job.
  - **The dialog rule travels with the dialogs.** The shell enforces one
    dialog-result slot and *"a dialog can only return"*
    (`shell.js:1289`). Moving the painting alone would leave the rule
    behind with no shell to enforce it. In the optional layer the rule
    goes with them: take the dialogs, take the rule — and an app that
    takes neither never needs either.

- **Resource allotment belongs to the process, not to the app, and not
  to publicness.** A personal node on a shared box has the same need as
  a public one. Putting it anywhere "public" would repeat the mistake
  that named box arithmetic `relayLimits.js` — deliberately, this time.

- **A box's resources are divided among the units installed on it; no
  unit assumes it is alone; adding a unit re-divides.** This replaces the
  premise the defaults were written under — Andy, 2026-09-22: *"the
  default should be total RAM divided by 2, for an environment where
  relay is the only server (safety overhead)"*, and
  `relayLimits.js:25-27`: *"the other half is the safety overhead for a
  box where the relay is the only server, **which is the case this
  assumes**"*. That stopped being true when `lab-install` made a second
  unit possible, and a public pair breaks it outright.

  **The ceiling does not catch it**, which is why it is latent rather
  than visible: `MemoryMax` is a cap, not a consumption, so whichever
  unit boots second measures a box that looks empty and defaults to half
  of it again.

  **Division is by declared appetite, never by headcount.** Equal shares
  between a relay holding thousands of connections and a page that
  stores nothing would starve the one to feed the other. Andy, on
  whether this becomes the owner's job: **it must not.** Cycle 9's
  standard was measured defaults, not a diligent operator — *"No relay
  ever runs on an implicit figure"* was answered by the box, not by the
  owner. Diligence is for **overriding**, never for being correct, and
  an explicit figure the owner wrote survives a re-divide (*"a busy box
  never shrinks a configuration"*).

- **A type declares one conversion, and inherits the layer.** Enforcement
  is systemd's and type-blind; **self-limitation** is what needs the
  type — the relay turns MB into a connection allowance at 16 streams
  per MB and refuses work before the wall. So a type states *what a
  megabyte buys it in its own unit of work*, or **states that it does
  not know** — because "this server has no self-limit" and "nobody got
  round to it" look identical from outside and only one is defensible.

- **Every owned public server answers the owner's remote resource
  configuration**, by the same mechanism the relay already uses, and
  boot-only as that mechanism already is.

  **OPEN, and it is a real hole rather than a detail:** the cap lives in
  the systemd unit and only `install-units` writes it — *"THE CAP DOES
  NOT FOLLOW A LATER RECONFIGURE"*. So an owner who raises a figure
  remotely gets a process that believes it has more than systemd will
  give it, and is killed doing the work rather than refusing it. That is
  the same class of defect wsl-claude measured on 2026-09-24 in the
  installer, arriving from the other direction. Three ways out are
  argued in the open questions.

- **THE SHELL PROVIDES THE OPTIONAL LAYER, and it provides it as FILES.**
  Andy: *"the shell is provider of optional ui-elements and optional
  style adoption, however the style adoption is facilitated."* So there is
  no `app/uielements/` owned by nobody — the elements are the shell's to
  give, and **elements and style adoption are separately optional**: an
  app may take one, both or neither.

  **The provider is the shell's FOLDER, not the shell's PROCESS.** Every
  clone carries `app/shell/` whether or not anything launches it, so a
  public app node already has the elements on disk. Provision costs
  nothing at deploy time and creates no second copy.

  **And "paints, never decides" stops being good practice and becomes the
  condition of being offerable at all** — *"the deciding is done in an
  isomorphic module (js/iconIndex.js) that node can drive, and what lives
  here is only the painting"* (`shell.js:1465-1468`). An element that
  only paints survives a version skew between a shell and an app that was
  never tested against it; one that decides does not.

  **Open:** a public app server's whitelist is *one app*, so offering
  shell files widens it. That widening must be *these files are offered*
  and never *the shell's folder is servable*, or a one-app whitelist
  quietly becomes two folders and the next app makes it three. And *how*
  style adoption is facilitated is undecided — from a clean start, since
  there are zero `.css` files in the tree today.

- **LOOK AND FEEL: THE DEVELOPER OWNS THEIR LOOK; THE MARKS THAT CARRY
  MEANING ARE OFFERED.** Andy raised the tension — *"3rd party single app
  developers will likely want their own look-and-feel. we likely want a
  unified look-and-feel"* — and shared the view below.

  **Enforcement was never available, so it cannot be the plan.** A
  third-party app on a one-app node **is** the whole page: no module
  boundary, no system chrome beside it, nothing to police it with — the
  same reason browser-side `api.fs` scoping is a declaration rather than
  a jail. Any rule that third-party apps must look like us would be
  unenforceable exactly where third parties live.

  | | who decides |
  |---|---|
  | colour, font, spacing, layout, voice | **the developer, entirely.** It is their page |
  | marks that carry meaning — a key ending, a refusal, a signature, fine print | **offered**, and worth making good enough that not adopting them is the harder path |
  | the *rules* — the dialog contract, *"a dialog can only return"* | **not look at all.** Behaviour, and it travels with what it governs |

  **Where unification genuinely matters is not "our apps should look nice
  together".** It is **where a user is asked to trust or decide
  something.** If every app invents its own way of showing *this is your
  key ending*, a user cannot carry recognition from one app to the next,
  and recognition is the whole defence. That is a **trust** property of
  look-and-feel, not an aesthetic one.

  **The shell is the one place unification is a constraint rather than an
  offer**, because there apps share a surface with system chrome and an
  app painting something that resembles a system statement is a phishing
  surface. That is already the shell's business
  (`UI_DESIGN_STYLE.md`, 418 lines) and does not become the platform's.

  **So what we actually get:** third parties own their look, and we get a
  unified look among those who adopt it. That is not weaker than
  enforcement — it is the only outcome that was ever available, and it
  has the merit that adoption is evidence the elements are good.

- **NOTED AND WAY OUT OF SCOPE: look-and-feel badges.** Andy shared the
  view and marked the scope. Offering a house style to strangers is
  offering a badge: a user may reasonably read an adopted look as
  endorsement. Written down while it costs nothing rather than discovered
  with a live example we would rather not be associated with. **Nothing
  is proposed, nothing is designed, and no cycle owns it.**

- **The launcher is the companion object to the shell's lowest layer.**
  Andy: it *"should be named `run/js/publicAppServer.js`, be the
  companion-object to shell-lowest-layer"*. **Open within this
  decision:** whether *public* is the right axis at all — see the open
  questions.

## THE MODEL THE SITTING ARRIVED AT

**A node serves exactly one intrinsic app.** The tree already uses those
words: *"an intrinsic app is what this node IS"*
(`spirit/run/js/client/shell.js:478`).

| node | its one intrinsic app | what that app does |
|---|---|---|
| personal | the shell | fans out to other apps |
| public app | `join` | one thing |
| relay | `relay.html`, `device.html` | already two, ad-hoc |

**The shell is an instance of this description, not an exception to it**
— and it is not one yet. `AGENT.md:72`: *"Target: every app will live at
`app/<appName>/<appName>.js` plus sibling manifest. Today nine ids still
live in `index.html`… They move only per `CLEANUP-PLAN.md`."* So the
direction is already decided and scheduled. **The design is shaped by the
unification and does not require the shell's conversion**, or it would
inherit a far larger job than its own.

## OPEN — put to Andy, not yet ruled

> **STALE IN PART, and marked rather than silently edited.** The first
> three entries below were SETTLED later the same day, and are kept only
> so the reasoning that settled them stays visible:
>
> - *Is `public` the architectural axis?* **No** — it is deployment, and
>   the module became `appServer.js`.
> - *Where do shared UI elements live?* **The shell provides them, as
>   files**, with elements and style adoption separately optional.
> - *Dialogs are a rule, not a widget.* **The rule travels with the
>   dialogs** — take the painting, take the rule.
>
> The remaining entries are genuinely open.

- **Is *public* the architectural axis?** If a node serves one intrinsic
  app, then publicness is a **deployment** fact — a Caddy block, a
  whitelist, `noindex`, a DNS record — and not a property of the server
  module. The same `joinApp` on loopback is the same app. Under that
  reading the module is an *app server* and the template gets smaller.
- **Where shared UI elements live.** `app/uielements/` puts a **library**
  in a directory where everything else is something a node can *run*,
  which forces the app-discovery rule to special-case a folder. Note that
  `app/shared/` already exists and already is not an app — it holds
  `aiStatus.json` and `claudeModels.json` for two apps. So there is
  either a precedent to build on or a thing to fix before it gets a
  second citizen.
- **Dialogs are a rule, not a widget.** The shell enforces a single
  dialog-result slot and *"a dialog can only return"*
  (`shell.js:1289`). Moving the painting to a shared folder leaves the
  rule behind, and a standalone app has no shell to enforce it. Either
  the rule travels with them, or standalone apps do not get dialogs.
- **How remote resource configuration reaches the cap.** The figure the
  owner sets and the `MemoryMax` that enforces it have two different
  writers, and only one of them is remote. Three ways out, and they are
  genuinely different decisions rather than variants:

  1. **The answer tells the truth** — the verb reports *"this applies at
     next start; the cap will not follow until `install-units` is re-run
     on the box"*. Cheap and honest, and it leaves a trap a remote owner
     cannot clear remotely, which rather defeats the verb.
  2. **The server re-renders its own unit.** Feasible: these are
     one-operator hosts and the process runs as root, so it could
     rewrite the unit and reload systemd. The most capable answer and
     the one most worth being suspicious of — a server that edits its
     own resource limits is a different kind of thing from one that
     reads a file.
  3. **The cap is set generously once and only the soft figure moves
     remotely.** `MemoryMax` becomes the box's guard rail at install
     time and the owner tunes underneath it. No unit rewriting and no
     two writers racing over one file — at the cost of the ceiling no
     longer being tight, which is what it was for.

  **Recommended, not decided: the third.** It is the least clever, it
  keeps the two numbers in a fixed relationship instead of a race, and
  that relationship can be gated — which is how this repository keeps
  promises of exactly this kind.

- **Where "what else this box runs" is read from.** Declared up front
  (`SPIRIT_BOX_UNITS`) is stable but can be forgotten silently; observed
  by counting installed units is unforgettable but is only correct if
  the **re-cap of the other units actually happens**. A count without a
  re-cap is worse than no count, because the numbers then look
  considered. **Recommended: observed, with the re-cap as the
  load-bearing half and the gated one.**

- **THE FIRST DELIVERABLE, and it is not a folder layout: which part of
  `api.*` may a standalone app rely on?** The shell hands apps
  `ui.elements`, `readProject`, `onFiles`, `fs` and more
  (`shell.js:1469-1495`). A public app server has no shell, so it
  provides some subset — **and that subset is the template**. The layout
  falls out of it; choosing folders first is choosing the shape before
  knowing what goes in them.

  One rule in there is worth carrying over verbatim, because it is what
  keeps a shared element shareable: *"the deciding is done in an
  isomorphic module (js/iconIndex.js) that node can drive, and what lives
  here is only the painting"* (`shell.js:1465-1468`). An element that
  decides anything cannot be shared; one that only paints can.

---

## THE TWO SCOPES

Ruled by Andy. They are separated because one is reusable and the other
is policy, and mixing them is how a pattern ends up with a stranger's
OAuth provider baked into it.

**Scope 1 — the public app server.** Structural. Where a public app sits,
what it may be, what infrastructure it shares, and how it binds to a
relay. **No GitHub anywhere in it.**

**Scope 2 — `join`, the first public app built on it.** Policy. GitHub,
the code the site never exchanges, seats, the visitor's story. All
replaceable without touching scope 1.

---

## HOW THE SHAPE WAS ARRIVED AT

Recorded because the reasoning is the deliverable, and because a later
session that cannot see it will re-propose the version that was
discarded.

Andy asked five questions in order, each answered against the tree:

1. **Does the shell have a bottom layer that is merely a proxy for the
   node API?** — Yes. `spirit.core.ask`, fourteen lines
   (`spirit/run/js/kernel.js:642`), *"the shell asks here, apps ask the
   shell (api.verb), and nothing else opens a socket"* (`:635-637`).
2. **Will there be `spirit/run/join.html`?** — There can be. The relay
   already serves a public page whitelist (`relayServer.js:542`).
3. **And `spirit/run/js/joinServer.js`?** — Yes, and the pattern is
   already decided: *"node and relay are separate startup modules, so a
   relay loads no node code"* (`server.js:1-15`, cycle 0,
   `design/principles/NODE-AND-RELAY.md`).
4. **And a subdomain?** — One file. *"a site block is now its own file
   under `/etc/caddy/sites/`, named for the domain… Additive by
   construction: a third relay costs a file and nothing else"*
   (`bash/tls:29-31`).
5. **Or does it share `./bash/` with the relay, since who has a relay
   might want a join server as well?** — It shares. `bash/lib.sh` is unit
   infrastructure, not relay infrastructure, already parameterised by
   `SPIRIT_UNIT_NAME`, `SPIRIT_UNIT_TEMPLATE`, `SPIRIT_RELAY_PORT`,
   `SPIRIT_RELAY_DOMAIN`, `SPIRIT_CLONE_DIR` (`bash/lib.sh:55-70`, `:99`).

**And then the move that named the cycle.** Andy: the launcher *"should
be named `run/js/publicAppServer.js`, be the companion-object to
shell-lowest-layer"*. `join` is the first public app, not the mode.

| | client half | server half |
|---|---|---|
| **private** | `spirit.core.ask` → loopback | the shell: many apps, dispatch, fanning |
| **public** | the same `ask` | `publicAppServer.js`: one app, no dispatch |

---

## MEASURED AT `5cd0b12`

Every premise, checked against the tree rather than remembered.

### The pattern has two instances already, and nothing owns them

- **`device.html` is a public app, not a brochure.** Served publicly by
  the relay, key-addressed at `/device/<key>`, guarded by
  `relay.deviceIdentityPublic()` with a 404, carrying noindex:
  *"Unlisted rather than hidden… What protects them is the password and
  the window, not obscurity. The key in the path is a LOCATOR, and
  holding one grants nothing"* (`relayServer.js:550-557`, served at
  `:686-693`). It runs an interactive **enrolment** flow — the same
  problem domain as `join` — and calls `fetch('/api/relay/device')`
  directly (`device.html:375`) because there was nothing to call.
- **`relay.html` is the public brochure** (`relayServer.js:594-599`), 22
  lines, its own inline style.
- **So `publicAppServer.js` names something that exists twice**, both
  ad-hoc and both inside `relayServer.js`. This is not a generalisation
  ahead of need.

### There is no shared UI layer at all

- **Zero `.css` files in the tree.** Three pages, three inline `<style>`
  blocks, three visual identities: `index.html` (1,244 lines, obeying
  `UI_DESIGN_STYLE.md`), `relay.html` (Georgia serif, 36rem),
  `device.html` (system-ui, 28rem).
- **`relay.html` is what a stranger sees at spirit.andyflinn.com**, and
  it is the one page sharing nothing with the product.
- **`UI_DESIGN_STYLE.md` is 418 lines of decided rules** that exactly one
  of the three pages obeys, and nothing enforces.

### The door call has already forked three ways

`spirit.core.ask` (`kernel.js:642`), `testSupport.browserAsk`
(`testSupport.js`, a copy taking its `fetch` as an argument), and
`device.html:375` calling raw `fetch`. A fourth copy settles it as a
pattern nobody owns.

### The shell holds no concept of a node's role

`spirit.core.const` is `ICON` and `MIME_TYPES`; `spirit.core.node.const`
is `ROOT_DIR` and `DEFAULT_SPIRIT_PORT` (`kernel.js:113-120`, `:936`,
`:1126`). **Four constants, none describing what kind of node this is.**
Owner-ness is discovered per call — `relay.status` answers rows marked
`owned`, and the Relay Monitor renders only those
(`app/relayMonitor/relayMonitor.js:27`, `:234`). `"owner": "system"` is
on all fifteen app manifests and means *system app*, not owner-only.

### The bind is forced by the relay, not chosen by us

- A relay is born unclaimed: `var firstOwner = allow.mode !== 'keys'`
  (`relay.js:1586`). *"An unclaimed relay takes one thing — a signed
  claim presenting the owner invite install.js minted over SSH — and
  refuses every other claim"* (`relay.js:1575-1578`).
- `becomeOwner()` runs only on that claim (`relay.js:1763`).
- **`ownerKey` answers the empty string until then** (`relay.js:1050`).
- Only an owner mints (`relay.js:3677-3684`), and seats are already
  counted at mint time and never cached, refusing with 507
  (`relay.js:1997-2014`).

**Consequence:** a public app server cannot be *configured* with an
owner. It can only *learn* one, from the relay it serves, after that
relay is claimed — which removes every hardcoded `andyflinn.com` and
every owner key from the design, and makes the thing self-configuring.

### The relay needs no change

Every relay-side mechanism `join` depends on is built, gated and asserted
at `5cd0b12`: the owner mint verb, mint-time seat counting, the proxy
gate read on every call (`server.js:490-492`), the claim route
(`relayServer.js:585`, `:799`). **A cycle-12 commit touching `relay.js`
is a signal that something was mis-designed, not progress.**

---

## THE BOOT-AND-BIND SEQUENCE

Three parties, and the order is forced by the measurement above rather
than chosen. Andy: *"there must be a bind-time-process that binds the
join-server to the relay. this must be after the relay is claimed by an
owner."*

| # | who | what | why it cannot move |
|---|---|---|---|
| 1 | owner node | exists, has an identity | it is the claimant |
| 2 | relay | installed, unclaimed; `install.js` mints the owner invite **over SSH** | the only credential an unclaimed relay accepts |
| 3 | owner node | claims → `becomeOwner`, `allow.mode = keys` | `ownerKey` is empty until this instant |
| 4 | owner node | hand-mints **one seat** for the public app | only an owner may mint |
| 5 | public app node | claims it → member | a relay routes between members |
| 6 | public app node | asks its relay for `ownerKey`, binds | nothing to bind to before 3 |

**They can be installed together and cannot be initialised together.**
Steps 1-3 are a human with SSH; 4-6 can be automatic once an owner
exists. **A public app server that boots before step 3 waits — it does
not fail.** It has a relay, no owner, and nothing wrong.

---

## SCOPE 1 — THE PUBLIC APP SERVER  **[SUPERSEDED]**

> **SUPERSEDED BY "THE CURRENT REQUIREMENT LIST" ABOVE**, and kept
> rather than deleted because the reasoning inside each item is still
> good. The WORDING here predates five reconciliations and is wrong in
> at least four places: S1 names `publicAppServer.js` (now
> `appServer.js`), S2 frames the module by publicness (not an axis),
> S4 and S5 are each half out of scope, and **S8 is out of scope
> entirely**. Where the two lists differ, the list above holds.

### S1 — `spirit/run/js/publicAppServer.js` is a third startup module

**Status:** OPEN. Nothing built at `5cd0b12`.

Dispatched from `server.js` before any node code is required, exactly as
`--relay` is (`server.js:13-16`), so a public app server loads no shell
code and no relay code.

**Asserted by:** the mode dispatches before the first `require` of node
code; starting it loads neither `relayServer` nor the shell's app layer.

### S2 — a public app is one page, one whitelist, no dispatch

**Status:** OPEN. Nothing built at `5cd0b12`.

The shell's app dispatch and fanning are explicitly **not** shared. A
public app server serves one app: a whitelisted set of paths, `noindex`,
loopback behind Caddy, and no directory listing. Key-addressing is
available where an app needs it, on `device.html`'s terms — a locator
that grants nothing.

**Asserted by:** a path outside the whitelist 404s; no app-dispatch code
is reachable; the door is loopback.

### S3 — `ask` has one home, and the public app uses it

**Status:** OPEN. Three divergent copies exist at `5cd0b12`.

Fourteen lines, not `kernel.js` wholesale (1,145 lines for the fourteen a
page needs). The existing copies are **not** migrated in this cycle — see
C1 — but no fourth is written.

**Asserted by:** the public app's page calls the shared `ask`; it
contains no raw `fetch` to `/api/`.

### S4 — the look is shared as tokens, not as a stylesheet

**Status:** OPEN. Zero `.css` files exist at `5cd0b12`.

From `UI_DESIGN_STYLE.md`: the **12px rhythm**, the **two sizes** (16px
reading, 12px fine print at 0.75 opacity, at the foot), and
`:empty { display: none }` rather than reserved space. A token block, not
a framework. **`index.html` is not touched** — taking tokens out is safe,
harmonising three pages is a UI session on Andy's own node.

**Asserted by:** the public app's page carries no font, size or spacing
literal that contradicts a token.

### S5 — one unit template serves both modes, and `./bash/` is shared

**Status:** OPEN. One hardcoded `--relay` blocks it at `5cd0b12`.

`bash/systemd/spirit-relay.service:10` hardcodes `--relay`; everything
else in `bash/` is already generic. `__MODE__` replaces it.
`SPIRIT_RELAY_PORT` and `SPIRIT_RELAY_DOMAIN` become misleading the
moment a non-relay uses them and are renamed with compatibility kept.

**Asserted by:** one template renders both units; the lab's existing use
of `SPIRIT_UNIT_NAME` still works; the old variable names still resolve.

### S6 — a public app server serves exactly one relay, and learns its owner

**Status:** OPEN. Nothing built at `5cd0b12`.

It is bound to one relay, learns `ownerKey` from that relay, **waits
while the relay is unclaimed**, and refuses to start if it is not a
member of it. No owner key and no domain in the tree or in its
configuration.

**Asserted by:** with an unclaimed relay it starts, serves a waiting
page, and acts on nothing; with a relay it is not a member of it refuses
to start and says why; no file under the public app names an owner key.

### S7 — the node's role is asked, never cached

**Status:** OPEN. No such constant exists at `5cd0b12`.

Andy named two: `nodeIsOwnerNode`, `nodeIsPublicApp`. They would be the
first of their kind — the shell holds no role concept at all. **The
danger is the reason to be careful:** a cached "I own this" is how a node
believes it owns something it no longer does. So they are derived on
demand from what the relay answers, never written down at boot.

**Asserted by:** revoking ownership changes the answer without a restart;
no persisted file holds either value.

### S8 — the Relay Monitor can represent a second server type

**Status:** OPEN. It knows only relays at `5cd0b12`.

The owner needs to see the public app the way he sees a relay: up or
down, gate open or closed, and — for `join` — mints against claims, which
are the alpha plan's tightening triggers. The monitor is owner-scoped by
**data** (`owned` rows), not by a flag, and that stays true.

**Asserted by:** the monitor renders a non-relay owned row without
inventing relay figures for it.

---

## SCOPE 2 — `join`, THE FIRST PUBLIC APP  **[AGENDA, NOT REQUIREMENTS]**

> **Andy postponed stage 2 to its own design-implementation cycle.**
> Nothing below is a requirement of this one. It is carried forward so
> the later cycle starts from something rather than nothing, and
> several of these will not survive contact with the settled
> boundaries above.

### J1 — `spirit/run/join.html`, served at `join.<domain>`

**Status:** OPEN. Nothing built at `5cd0b12`.

Beside `relay.html`. One Caddy file via `./bash/tls`, one DNS A record,
one unit. No repository directory, no second VPS.

**Asserted by:** the page is served by the public app server and by
nothing else.

### J2 — GitHub is the only identity, and nothing else is collected

**Status:** OPEN. Nothing built at `5cd0b12`.

Andy: *"our repo lives there, and github is in the loop already."* No
email, no mail sender, no address kept or deleted.

**Asserted by:** one identity provider; no field collects an address.

### J3 — the site receives the one-use code and does not exchange it

**Status:** OPEN. Nothing built at `5cd0b12`.

**The security claim of the whole design.** The exchange needs the client
secret, which is on the owner's box. A compromised site can deny service
or waste quota but cannot invent accounts, because a code issued for
another `client_id` fails.

**Asserted by:** no exchange request in the public app; the code leaves
only as a `peer.post` payload. **See divergence prediction 3.**

### J4 — the code travels to the owner's node sealed and signed

**Status:** OPEN. Nothing built at `5cd0b12`.

An ordinary `peer.post`, over the relay both are members of.
**Authenticated by signature** — no API key, no bearer token.

**Asserted by:** the post is sealed and signed; the relay carries
ciphertext; a post from an unknown key is not acted on.

### J5 — the owner's node exchanges, applies the policy, and mints

**Status:** OPEN. Nothing built at `5cd0b12`.

Through `net.fetch` under the proxy gate: POST
`github.com/login/oauth/access_token`, then GET `api.github.com/user`.
Then the seat policy, then the **existing** owner verb
(`relay.js:3677-3684`). The invite is posted back.

**Asserted by:** the minting program calls `net.fetch` and the owner
verb and nothing else; the same `redirect_uri` and `client_id` reach the
exchange.

### J6 — asleep means refuse, with a sentence the visitor can act on

**Status:** OPEN. Nothing built at `5cd0b12`.

Never queue: the code dies in ten minutes and queueing means storing it.
**See divergence prediction 1.**

**Asserted by:** with the owner's node unreachable the visitor gets a
refusal naming what to do, and nothing durable holds the code.

### J7 — closing the proxy gate turns onboarding off

**Status:** OPEN. Nothing built at `5cd0b12`.

The gate ships **closed** and is opened deliberately, so the off switch
is true on the day it matters.

**Asserted by:** with the host removed from `proxy.json`, the mint path
refuses; `proxyList.remove()` is the only action needed.

### J8 — a full relay is visible to the visitor, not only to the owner

**Status:** OPEN. Nothing built at `5cd0b12`.

The relay already refuses with 507 and a full sentence
(`relay.js:2008-2014`). `join` turns that into the **"run your own
relay"** door, without showing the relay's internal figures.
**See divergence prediction 2.**

**Asserted by:** a capacity refusal produces a visitor-facing page
offering the other door and naming no internal figure.

### J9 — the claim screen collapses from three fields to one

**Status:** OPEN. Nothing built at `5cd0b12`.

`natterDetails.js:590` asks public label, token and invite name because a
human minted it and said a word out of band. A self-minted invite knows
its name, so only the token is carried and the display name defaults to
the GitHub login. **`/api/relay/claim` is unchanged** — screen copy and
defaults, not a route.

**Asserted by:** one field; `relayServer.js:799` untouched.

### J10 — the record links a GitHub account to a node key, and says so

**Status:** OPEN. Nothing built at `5cd0b12`.

*"Nothing kept"* is not true: a delivered post is logged with its payload
and the log is permanent. An expired invite and a spent one-use code are
worthless — **accepted by Andy** — but that link is real and is stated
plainly on the page.

**Asserted by:** the page carries the sentence; nothing else about a
visitor is written anywhere durable.

---

## THE SENTENCES LIKELIEST TO DIVERGE

Recorded before either half starts. Cycle 11 flagged two and the
divergence came from a third — a better outcome than accuracy, and only
visible because the prediction was written down.

1. **"Refuse, do not queue" when the owner's node is asleep** (J6). The
   reason is settled; *what the visitor sees* and *what the public app's
   node does with the failed post* are two questions the sentence
   answers neither of.
2. **What the page shows when seats are gone** (J8). Whether `join`
   surfaces the relay's own sentence, a softer one, or only the other
   door is decided by nothing written so far.
3. **Whether J3 is observable** — whether "the site does not exchange the
   code" can be asserted **positively**, or only by absence. An assertion
   that the code is missing from outbound traffic is weaker than it
   sounds, and this is the security claim of the whole design.
4. **What S7's booleans are derived from.** "Asked, not cached" is a rule
   without a mechanism, and there are at least two candidates — the
   relay's `owned` rows, or the relay's published `ownerKey` compared
   against this node's own key. They differ when a relay is unreachable.

---

## CONDITIONS — discovered, not promised

### C1 — `device.html` is not migrated in this cycle

It is the **evidence the pattern is real**; it becomes the evidence the
pattern *works* only after `join` ships and it moves without a fight.
Migrating the existing instance while inventing the abstraction means
nothing tests whether the abstraction was right.

### C2 — three copies of `ask` and three style blocks are pre-existing drift

Scope 1 stops it growing; it does not fix it. `relay.html` and
`device.html` keep their own looks and their own door-calling until a UI
session on Andy's own node says otherwise.

### C3 — no account-age gate, by decision, and the trigger is the record

Andy: *"We're prepared to tighten requirements based on teh growth
curve."* The policy lives in the **owner's minting program**, so
tightening is a change on his box — no redeploy, no protocol change. The
cycle-11 relay record is the instrument that says when.

### C4 — the site's box is a second thing to harden, but not a second box

600/700, the node door loopback with only 443 open, the clock synced
because OAuth expiry depends on it, `Restart=always`. It is the relay's
own box now, so this is a unit's hardening rather than a new host's.

---

## WHAT THIS CYCLE DOES NOT DO

- **No relay change.** See the measurement. A commit touching `relay.js`
  is a signal, not progress.
- **No `device.html` migration** (C1).
- **No harmonising of the three style blocks** (C2).
- **No marketplace image, no affiliate, no reselling.**
- **No UI polish.** The visitor-facing pages are the minimum that carries
  J6, J8 and J10 honestly.
