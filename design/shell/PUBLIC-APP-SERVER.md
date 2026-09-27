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

**ALPHA SCOPE.** Andy, 2026-09-26: *"alpha will only deliver a basic
appShellApp and join"*. Anything else in this file is after alpha unless a
later ruling says otherwise. That includes the front door and pass-through
(above G9), the box sheet (G10), and the rest of stage 2.

**THE ALPHA TOPOLOGY.** Andy, 2026-09-26: *"there is only an app server on
the app-owners node, the face is routed via appShellApp"*, then *"the VPS
only needs an appShellApp"*. So:
- **An app runs only on its owner's node**, as an app server there. No app
  runs on the VPS. (This withdraws a recommendation made an hour earlier,
  that `join` should run on the public box behind a Caddy block.)
- **The VPS runs appFaceApp and nothing else.** A browser asking for
  `join.spirit.andyflinn.com` reaches appFaceApp, which routes the request
  to the node holding that name. That node's app server answers.
- **One face allotment serves every app, members' apps included.** Andy,
  2026-09-26: *"one face-allotment for all apps, even member apps, which
  are appShellApp, by member-to-subdomain mappings on the owners node"*.
  The VPS's single appFaceApp is the public face for the owner's apps and
  every member's apps alike. There is no per-app process on the VPS and no
  second allotment there. A member's subdomain routes to that member's node
  by the member-to-subdomain mapping, which lives on the OWNER's node (the
  grant table, *"only on the owners node"*, appFaceApp.js). The lookup
  therefore needs the owner's node up. That is the owner's to keep, under
  the uptime ruling (DEVICES-AND-PORTS.md:154-174).
- **A member who wants more than one app puts a shell on their subdomain.**
  Andy, 2026-09-26: *"so members utlimately will have to use a shell on
  their subdomain, if they want to fan out further"*. One subdomain reaches
  one intrinsic app on the member's node, and fanning out is the shell's
  job (`faceServer.js:22-28`). So the VPS never needs a second entry per
  member app.
- **DIRECTION, and the reason for the mirroring: appFaceApp becomes a
  shell that fans out too.** Andy, 2026-09-26: *"the appShellApp will
  change into a shell that fans out as well, that's why i insist on
  mirroring the node interface at so many points"*. The VPS fans out to
  subdomains the way a personal node's shell fans out to apps. That is why
  appFaceApp takes the node's own interfaces (mounted by nodeApps, packets
  through peerPost, *"no system-face special case"*) and never grows its
  own. Each place it mirrors the node is a place the later shell will not
  need rewriting. Alpha delivers only the basic version. A proposal that
  gives appFaceApp a convenience the node does not have works against
  this, and should be judged by that. **And why it is shaped like a node:**
  *"because appShellApp is associated with a relay-owner, and reflects the
  wildcard levels of subdomains.... (all out of scope right now)"*. Each
  level of the wildcard name is one owner's appFaceApp fanning to the
  level below, just as a relay owner's node sits above its members.
  Recorded as direction only. Nothing past alpha's basic version is in
  scope.
- **So basic routing IS alpha.** The front door and pass-through sections
  below are out of scope only beyond what this path needs.
- **G17, restated for this topology.** The app's answer (for `join`, the
  invite) must travel back along that route to the browser.
  `faceServer.js:842` throwing the body away is the same defect in its old
  location. appServerBoundary.js:459: *"fatal for join, where the invite IS
  the answer."*
- **The VPS process that hosts appFaceApp is a NODE that mounts it, not an
  app server.** wsl-claude, 2026-09-26, checked at the tree. This corrects
  a recommendation made minutes earlier, which would have run appFaceApp
  as the app of an app-server process. An app server never EXECUTES app
  code. Its `servable()` (`faceServer.js:1030-1034`) hands `<app>.html` and
  `<app>.js` to the browser as static files. appFaceApp only runs when
  `nodeApps.mountAll` mounts it and hands it its api (`nodeApps.js:303-321`).
  Under the withdrawn shape, the grant exchange would never have run, and
  `GET /appFaceApp.js` would have served its source to anyone. Meanwhile
  `appFaceGrant.js` would have stayed green, because it drives the
  nodeApps path. The tested door and the used door would have diverged.
  Mounting it on a node is the path the suite already proves, and it needs
  no new loader. **Owed with it:** boot a node shaped like the VPS and
  assert, by what was actually mounted and not by folder text, that
  appFaceApp is mounted and nothing serves its source. **Still open:** what
  on the VPS takes the browser's request for a subdomain. A node's HTTP
  refuses anything that is not loopback with a valid Host (`server.js:675`),
  so that is new code either way.

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

### G1 — `faceServer.js` is a third startup module

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
`faceServer.js`.** Andy: *"1 agreed."* It names what the process IS
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

**Status:** NAMED, 2026-09-27. **The two halves are CONTRACT and PLUMBING.**
claude recommended them, wsl-claude withdrew his "the box" in favour of
plumbing, and Andy answered *"agreed."* and then *"go."* (asked to confirm
the second name).
His reason for plumbing: *"plumbing becaue it's in the puppet, on the box
and in the server process"*. It runs through all three, and none of them shows it.
- **Contract:** what an app, or the face carrying it, can see, and is
  promised: the one function its page calls (`puppetPost()`, today
  `app/shared/ask.js`), the flat door and its verbs. It changes only with a
  deprecation path.
- **Plumbing:** what no app sees and anyone may re-lay: the pipe path, the
  port, the memory cap, the unit. It changes freely, because something no app
  can see cannot break an app.

The line between them is his: *"what you call \"the other half\" the
appFaceApp never even knows. it's invisible to itself."* What remains is the
written test that sorts a new thing by it (wsl-claude's declaration).

The app contract must hold for ever; box concerns change per deployment.
**Anything in the stable half needs a deprecation path and anything in
the other half does not** — so the test is mechanical: *if removing it
would break an app that never changed, it is in the stable half.*

**The app server is a process type, and that is a basic.** Andy,
2026-09-26: *"so the app is a process? process type = server?"*, then *"the
process type is a basic though"*. An app with a face runs as its own
process: the third startup mode, beside the personal node and the relay
(`node js/server.js --app <name>`, `faceServer.js:3-12`, loopback only at
:1371). The owner node does not `require` the app. Code loaded into the
owner node could read the owner's keys, would sit outside any allotment on
the box sheet (G10), and would take the node down when it crashed.

**Out of scope until the basics are done** (Andy, the same sitting: *"still
out-of scope, until some basics ar done"*): the pass-through itself. Andy's
flow is this: a browser asks for `join.spirit.andyflinn.com`, the name is
matched to the node holding the wildcard assignment table, and that node
passes the request through to its local `join`. Recorded so it is not
re-derived:
- **Something new catches the request, and it is not appFaceApp.**
  appFaceApp stays faceless (*"faceless, no shortcut"*,
  `appFaceGrant.js:96-118`). The new front door asks it by packet who
  holds the name. No code today reads the Host header to route
  (`server.js:675` only validates it).
- **The pass-through is app-agnostic and flat.** It forwards a file by
  name, or a body to the one door (`POST /api/spirit`, verbs in the body,
  `faceServer.js:1201-1209`), to that app's loopback port, and never looks
  inside. **Recommended:** introspection is one more verb that lists the
  declared surface, not an API tree. A flat list stays a closed set (G9),
  and a tree would need the front door to understand paths.
- **Open:** whether the owner's node is reachable directly. If it is not,
  the pass-through rides on the stream it already holds to its relay.

**Sharpened by Andy, 2026-09-27, in Desk:** asked about the two halves,
*"what you call \"the other half\" the appFaceApp never even knows. it's
invisible to itself."* So the line is VISIBILITY: the stable half is
everything an app, or the face carrying it, can see (the one function its
page calls, the flat door, the verbs). The box half is invisible to them:
the pipe path, the port, the memory cap, the unit. Something no app can see
cannot break an app when it changes, which is why only the visible half
needs a deprecation path. The names are still his to give.

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

**When the interface is built, it is visible on demand, and over-committed
is a warning only.** Andy, 2026-09-26: *"that must be visible-on-demand in
a UI"*, then *"over-committed is a "warning" state only."* The owner's node
groups servers that share a fingerprint and compares their allotments with
the box total. The owner opens that view when he wants it. An over-committed
box shows a warning. It is not an error, and nothing is refused or stopped
because of it: allotting is the owner's, just as uptime is (Andy,
2026-09-25, *DEVICES-AND-PORTS.md*). The interface itself is still
deferred. This records its shape so that building it later does not
reopen the question.

**The box panel is a sheet.** Andy, 2026-09-26: *"the RAM and DISC
allotments can be right in the box panel, like an account sheet of rows,
that must add up to less or equal the the total resources"*, then
*"spread-sheety..."*. There is one row per component on the box, with RAM
and disc columns and a total line checked against the box total. Going
over is the warning above. Each row carries an icon link to that
component's own screen: natterDetails for a relay, and the app's own UI
for an app. Being a spreadsheet, it edits in place.

**Each row names its server type; the link is optional.** Andy, 2026-09-26:
*"so links to the detail panel are optional, it'd be nice to know server
type... relay, puppy (puppet) etc"*. The type is a fact the component
reports about itself, such as relay or puppet (DICTIONARY.md, *Puppet*).
It does not breach the exclusion below: the type says what KIND of server
occupies the row, not which app it serves or what that app does.

**What this depends on, still open:**
- **Editing in place needs the `MemoryMax` question ruled** (below, *How
  remote resource configuration reaches the cap*). The recommended option
  is a generous cap at install, with the sheet moving only the figure
  under it. A read-only sheet needs nothing ruled.
- **A relay row needs the relay to report its box.** G10 covers app
  servers only. Adding the same fingerprint to a relay is a relay.js
  change, so it needs a team review.
- **What "the correct passthough-UI for an app" (Andy's words) names** has
  not been pinned. The reading so far is the app's own screen, reached
  through the owner's node.

**The warning is a guess, and the owner may know better.** Andy, 2026-09-27:
*"overcommitments is a warning and always a guess. maybe the owner/operator
knows better, maybe he has a temporary process running on the VPS, to test
exactly that very thing...."* So nothing ever acts on it, and it is never
worded as a fact about the box.

**The owner node keeps the box reports in memory, by design, not as a
stopgap.** Andy, 2026-09-27: *"Maybe unnecessary: ... the date is used on
he spot to make decisions, and would immediately go stale on disc"*. The
reports are read at the moment he looks, so a copy on disc would be a copy
of the past. After a restart the view fills again as servers re-report.
This is not a new persisted shape, and it needs no team review.

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

**Status:** DONE (2026-09-24, `ac0c283`): `contractOf`, `SURFACE_MEMBERS`, absent-means-nothing and
`checkContract` in `faceServer.js:84-160`, refusing an undeclared member at load
(`app-surface-undeclared`); asserted in `appServerBoundary.js:729-740`. This line said
OPEN until 2026-09-27, when wsl-claude found the tree and the doc disagreeing.
**This closes wsl-claude's readiness
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
app easy to write.

**THE DECIDING REASON IS wsl-claude’s, NOT THIS AGENT’S, AND IT IS
STRONGER.** The argument offered was that absent-means-everything becomes
unmovable when the second app ships — true, and a **prediction**. His:
*"absent-means-everything is UNASSERTABLE. If an undeclared app gets the
whole surface, then 'every member an app touches is in its surface' is
vacuously satisfied by every app that declares nothing, and dead surface
can never be counted, because no member is ever provably unused. Your own
walkability argument dies with the default."*

**So it is not a taste about first-app ergonomics: absent-means-everything
would make G14 a check that cannot fail** — in the requirement written to
make the boundary checkable. An app that asks for nothing and gets nothing
fails immediately and obviously, in development, at the hands of the
person who can fix it.

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

### G15 — the named interface, so a suite need not guess it

**Status:** OPEN. Nothing built. **Written 2026-09-24 in answer to
wsl-claude, before he wrote three hundred lines**: *"the document
specifies BEHAVIOUR and does not name the INTERFACE, and I cannot assert
a name I invented — if I guess and you guess differently, every assertion
is red at the close for a reason that is not a defect."*

Five names. Each one is decided here rather than discovered in source,
because under the working agreement he does not read the source — and
*"inferring the interface from your source is reading you with extra
steps."*

#### 1. Starting one

```
node js/server.js --app <name> --port <n> [--relay <url>]
```

`--app` carries the app's name, so the mode and its argument are one
thing. `--relay` is accepted **at first start only** and written to the
config below; afterwards it is read, and passing a different one is
refused rather than obeyed — that is G6's *first bind is final* at the
command line, where it would otherwise be trivially bypassed.

#### 2. The seam a suite drives

`faceServer.js` **exports and does not self-start.** Requiring it does
nothing:

```js
const app = require('./faceServer');
const h = app.create({ rootDir, appName, port, relay, invite, inviteLabel });
h.start(); h.stop(); h.state();                            // create: no listen
```

**`invite` and `inviteLabel` were added in cycle 3 and are here for the
reason this requirement exists.** wsl-claude met them by asking rather
than by reading the source, which is correct under the working agreement
and cost a message: *"a parameter added after the document was written is
a parameter I can only learn by asking or by reading you."* **G15 is only
true if it is kept true** — a named interface that stops being updated is
a guess with a date on it.

- **`invite`** — a relay invite **the owner minted and installed**. It is
  taken here and **never from `argv`**: an invite is a bearer token, and
  `argv` is the process list, the shell history and the unit file. The
  installed home is `app-state/<name>/config.json`, beside the pinned
  relay key.
- **`inviteLabel`** — the word **the owner wrote on the invite**, which is
  *not* the name the app asks to be called. The relay matches it and then
  forgets it. **An app cannot derive this**: it is a word in the owner's
  head at the moment of minting, so it is installed with the invite.

Both are first-start-only, like `--relay`, and for the same reason.

`server.js` dispatches with `require('./faceServer').fromArgv(process.argv)`
before any node code is required, exactly as `--relay` does
(`server.js:13-16`). **The split is cycle 0's** — startup separate from
logic — with one module rather than two because there is far less of it
than a relay.

#### 3. The manifest

`app/<name>/<name>.json`, which is the convention the tree already
enforces: `MANIFEST_PATTERN = /^app\/([^/]+)\/\1\.json$/`
(`kernel.js:220`), protected from being written by anything. So the
starter's is **`app/starter/starter.json`**.

#### 4. App state (G12)

**`app-state/<name>/`**, beside `relay-state/` and never inside
`app/<name>/`. Gitignored, deployment-safe, and holding the config, the
pinned relay key and anything the app persists.

`relay-state/` is the shape being copied and the reason is the same: a
deployment replaces **code**, and code and state in one folder means a
redeployment either eats the state or leaves orphans — *"both are wrong
and the second is worse, because it looks fine."*

#### 5. Refusals (G9)

**The platform's set already exists and is already walkable.**
`spiritErrors.js` is a closed catalogue of `define(code, {status, texts,
…})` with `byCode()` and `all()` (`spiritErrors.js:80-96`, exports at the
foot), and a suite already holds it honest. The app server's own refusals
— unbound, full, owner asleep, key mismatch, not a member — are entries
there.

**An app's own refusals are declared in its manifest**, same shape, which
is G14's pattern rather than a second mechanism:

```json
"refusals": { "<code>": { "status": 400, "text": "…" } }
```

**The wire shape adds one field to what the door already answers.**
Today a refusal is `{ok:false, status, error}`; it becomes
`{ok:false, status, error, code}`. The `code` is what makes G9 walkable
— prose cannot be matched against a set, and wsl-claude asked exactly
that: *"prose makes it unwalkable and I would rather know that now than
assert it at the close."*

**Open, recommended and not decided:** whether a `surface` may name a
member the shell has and the app server does not. **Recommended no** —
one vocabulary, and an unsuppliable member is **refused at load with the
member named**, never at the moment the app reaches for it. wsl-claude
agreed and gave the reason one level down: *"refused at reach, the
failure names a runtime symptom and the app author guesses; refused at
load, it names the member."*

### G17 — join's answer travels back to the browser

**Status:** CLOSED 2026-09-27. Andy, in Desk: *"ok. aoff to the team chat.
this R is closed."* Met for the owner's own apps: a visitor's request for
a name granted to the owner's node reaches that app's server on his box, and
the reply comes back through the face, live
(`hello.face.spirit.andyflinn.com`, with tests in faceRouteWorld.js,
faceLastLeg.js and appServers.js). `join` itself is not built: faceProof
stands in for it. Routing to the apps of MEMBERS is not met, and moves to a
requirement of its own; its design so far is *MEMBER APPS* below.

It was declared on the board before any document named it
(`appServerBoundary.js:485`), and it was ALPHA (see *ALPHA SCOPE* and *THE
ALPHA TOPOLOGY* at the head of this file).

**What alpha needs is for the app's answer to reach the visitor.** For
`join`, that answer IS the invite. appServerBoundary.js:459: *"Invisible for
starter, which has nothing to show; fatal for join, where the invite IS the
answer."* The transport half is done: peerPost unseals a reply into
`answer.text` (`peerPost.js:363-373`). Two parts are owed:
- **Stop discarding the body.** `faceServer.js:842` returns only the status,
  `if (a.ok) return { ok: true, status: a.status || 200 };`.
- **Something on the owner's node that answers with one.** That is the
  master, and it is the real work. Probably the same unit as *an app can
  reply* (transport/R12). wsl-claude has been asked to confirm the edge.

Under Andy's topology (an app runs only on its owner's node, and the VPS
routes by appFaceApp), the answer travels back along the route the
request came in on, to the browser.

**appFaceApp signs, as proxy for the visitor.** Andy, 2026-09-27: *"the
appShellApp has to sign (as proxy for all user-interaction with an app, the
owner node sees appShellApp as carring a package with the domain name
attached)"*. A browser visitor has no key, so the VPS node carrying
appFaceApp signs the packet. The signature vouches for the ROUTE ("this
came in on `join.spirit.andyflinn.com`"), never for the person. The
receiving node uses the attached domain to hand the packet to the right
app. The answer is an ordinary reply to that packet, and the VPS turns it
into the browser's HTTP response. **The VPS reads that traffic in clear:**
it ends the browser's TLS, so nothing between visitor and app is sealed
end to end. That is fine for `join`. A member app that is not public needs
to know it.

**The trust comes from the route, and the route is negotiated.** Andy, the
same sitting: *"the route creation is negotiated between app and owner
(registering a subdomain) the appShellApp is implementing a routing table
managed by the owner."* So no separate proxy grant is needed. Registering a
subdomain is the existing grant exchange between app and owner
(`appFaceApp.js`, two packets). The result is a row in a routing table the
owner manages and appFaceApp implements. A node accepts a packet that
appFaceApp carries because a row the owner granted names that route.
**The same negotiation runs between a member and the owner, down the road**
(Andy: *"and between member and owner, down the road."*). A member
registering a subdomain for their own node is the same exchange. That is
after alpha.

**The reply is told apart by `re`, which already exists.** Andy, 2026-09-27:
*"because the appShellApp must post to the owner (via stream) and the reply
must be distinguishable as a reply by an api.."*. A reply is a packet whose
envelope carries `re`, the hash of the packet it answers
(`client/packet.js:15`, encoded :229-230, decoded :322 and :348). appFaceApp
already uses it for grants (`appFaceApp.js:158-162`). For the proxy,
appFaceApp posts the visitor's request over its stream and keeps that
packet's hash with the waiting browser connection. An arrival whose `re`
matches a waiting hash is that visitor's answer, and a `re` that matches
nothing is refused (*"where a hash must match"*, transport/R12). **Owed:**
the table of waiting requests, and a time limit on each entry so a visitor
whose answer never comes is not held open for ever.

**The round trip, step by step** — every step with the code that does it today and what is owed: [FACE-ROUND-TRIP.md](FACE-ROUND-TRIP.md).

**THE PATH, as Andy laid it out** (2026-09-27): *"join lives as a
server-process on owners node. the node forwards a post from the face to
the app-server-process, and the reply is return to appShellApp via that
special puppyRely() interface, the appShellApp return that to the
browser."* And the page itself: *"there will be the lowest layer shell with
the index.html that the app-process servers the browser on first request."*

```
browser → appFaceApp (VPS) ─appServerPost()─→ owner node ─loopback─→ join (app-server process)
browser ← appFaceApp ←─reply, re=hash── appServerReply() ←─ answer ─┘
```

- **The first request fetches the page** (`GET /` returns `join.html`,
  `faceServer.js:1031`, plus the shared `ask.js`). The page's posts then
  reach join's one door along the same route. So the node forwards only the
  two flat things: a file by name, or a body to the door.
- **THE NAMES, RULED.** Andy, 2026-09-27, "go." on: `appServerPost()` for the
  visitor's request leaving appFaceApp for the node that runs the app, and
  `appServerReply()` for the answer coming back, *"because that's the
  traditional webUI concept, the web programmer thinks of"*. Not
  `ownerPost`: ownerPost.js is the other direction, the owner commanding its
  puppet. appServerReply() was called `puppyReply()` until then.
- **`appServerReply()` is the one node-side function** that turns the app
  process's answer into a reply packet with `re` set to the carried
  packet's hash. It uses the same two-packet pattern as appFaceApp's
  grant. It is a named function, not a new wire verb, so the hash rule
  decides everything.
- **This path does not go through the browser shell**, so it does NOT wait
  on transport/R12. R12 is the shell discarding handler returns, and this
  path never enters the shell. A proposed dependency "G17 waits on
  transport/R12" was withdrawn on this ruling. **`faceServer.js:842` is off
  this path too:** that is an app server reaching out to its owner, and here
  the node calls in.
- **Built:** all of it. The VPS entry (`puppetPost.js`), `appServerPost()`
  and `appServerReply()` in appFaceApp, and the node's forwarder, which is
  *THE LAST LEG* below. It reaches the app over a pipe, not a loopback port.

**THE ROUTE, RULED 2026-09-27** (Andy, in Desk under G17, "go."). It
supersedes THE PATH's "the node forwards a post from the face to the
app-server-process" for every name that is not the owner's own, and it
supersedes PUPPETS.md §10's flat namespace (see there).

- **The face domain.** A setting on the owner node, default
  `face.spirit.<relay domain>`, changeable. Andy: *"i now think that face is
  a more appropriate name: e.... join.face.spirit... or the *.face.spirit.
  the face segment is what exactly represent the job of appFaceApp"*, and
  *"agreed: changeable"*. Apps and users both live under it: *"make all
  other apps and users negotiate their spot in the wildcard space"*.
- **DNS and Caddy, by hand, once.** `face.spirit.<domain>` and
  `*.face.spirit.<domain>` point at the VPS; one Caddy block serves both,
  with the wildcard certificate by DNS challenge, and forwards to puppetPost
  keeping the Host header. Caddy knows nothing about names.
- **A name is negotiated, and that is the whole grant.** join, or joe, asks
  for its segment by the signed two-packet exchange, node to node through a
  relay. Andy: *"the grant is at that point already implicit, by the signed
  packet exchange negotiating the slot"*. The row it leaves is
  `{ <name>: { to: <key of the slot's owner> } }`, kept only on the owner
  node.
- **The boot route.** Andy: *"so the owner.node.ID is the boot-route, for
  every other name segment"*. The puppet knows one route from the start,
  its owner (`relay-state/puppet.json`). A host it has no route for is
  asked there, and the owner answers one of three, as a reply signed by its
  key and carrying the question's hash:
  - **mine**: the owner serves the request itself (join on its own box);
  - **`{ name, to: <key>, until: <time> }`**: *"it's like an HTTP redirect
    then the node gives the puppet a signed reply, allowing the appFaceApp
    to cache that route in RAM for future use"*;
  - **no such route**: refused by name.
- **The puppet's route cache.** RAM only: *"at restart, the dance starts
  anew"*. A route is taken only when signed by the key in puppet.json and
  matching the question's hash, ownerPost's rule, so no other node can pull
  a name's visitors to itself. A route lives until its `until` (an hour) and
  is dropped the moment its target refuses. A "no such route" is kept a
  minute, so an unknown name cannot make the puppet ask on every hit.
- **Direct after the boot route.** With a route cached, the puppet posts the
  visitor's request (`appServerPost()`) straight to the slot owner's key,
  carrying the owner's signed route so that node can check a face it was
  pointed at sent it. The answer comes back to the puppet with `re` = the
  request's hash (`appServerReply()`). *"if it gets properly serviced there
  is a separate question."*
- **Only the owner node matches a name.** The VPS matches nothing; it asks
  and caches (decision 0018: the route cache belongs to the machine).

- **An app on the owner's box is the owner's name.** Andy, 2026-09-27,
  "go." on: apps on the owner's box have their names granted to the owner
  node's key, so the boot route answers "mine" and the owner node hands
  the request to the app's process locally. This keeps his ruling that an
  app server is *"a slave to it's owner"*, which receives nothing
  (`faceServer.js:692`, onArrival ABSENT); a route to the app server's own
  key could never be answered. The app's door is found on the same disk,
  from `app-state/<name>/` (`faceServer.js:65`) or G18's pipe per name,
  and never travels: the G10 box report stays its ruled four fields
  (wsl-claude's review). A member with a node of their own gets the signed
  redirect.

**SUPERSEDED 2026-09-27 by *MEMBER APPS* below, which Andy unparked the same day.** **Parked, not in scope (Andy, 2026-09-27: "it's not needed to reach that 3rd
face user..."):** a member with a node of their own serving a face. Whether
that node trusts face requests by construction or refuses any not carried
by the owner's appFaceApp key was asked and not ruled. Nothing is built for
it; `faceRoute.answerRoute`/`routeIsSigned` stay as tested pieces only.
The owner's answer on this path is the plain "the owner of this name is
<key>" (Andy: "the owner, of appFaceApp simple responds with the key of the
subdomain owner, or an error"), and the face forwards there, whoever it is.

**Open:** which DNS provider holds the domain (it picks Caddy's DNS module);
what answers the bare `face.spirit.<domain>`, which no grant names (a named
refusal until it has a page); whether the grant table's keeper keeps the
name appFaceApp, since today it is appFaceApp's faceless half on the owner
node.

**THE LAST LEG, RULED AND BUILT 2026-09-27.** Andy's order was *"step 1)
build and prove the route from browser to owner-of-subdomain, and back 2)
design the last leg. 3) implement the last leg"*. Step 1 was proven live on
spirit-3 the same day: `join.face.spirit.andyflinn.com` answered 501
last-leg-not-built naming his node's key. His scope for step 3: *"right now
we're only about to prove that we can connect any wild-card domain to a
server process"*. His rulings, in Desk under G17: *"the go is officail. also:
i explicitly permit the two new/proposed interfaces/api' for communication
from node to appserver"*, then *"Go. and two verbs approved."*
- **Which app serves a name: appFaceApp's own table, never the node's.** A
  grant row names it: `hello: { to: <key>, app: 'faceProof' }`. An app's
  manifest says only `"serves": true`, and the node knows it by its app
  name. Andy, 2026-09-27, ruling on wsl-claude's split: *"correct. the core
  only knows about puppets (nodes owned by nodes, not people). the
  face-name/app-or-member table must be owned by appFaceApp, not by the
  puppet-infrastructure."* It was first built with a `"face": "hello"` field
  that the node read, which put appFaceApp's knowledge into the node;
  `appServers.js` now fails a check if face vocabulary returns. A granted
  name with no `app` answers 404 `no-such-route`, why `no-app`.
  `face-owner.js --app <name>` writes the row's app.
- **The server process:** a third job kind, `'server'`, beside `'permanent'`
  and `'process'` (`jobs.startServerJob`). The node starts one per such
  serving app at boot and starts it again when it exits, with the wait doubling
  from 1 s to 60 s. Its heap is capped (128 MB). It is today's `faceServer.js`
  (`node js/server.js --app <name> --pipe <path>`). It is started over an IPC
  channel, so it exits when its node dies and no orphan keeps the pipe.
  **None on a puppet** (`relay-state/puppet.json`): app servers live on the
  owner's box, so the VPS face node never runs one.
- **The node's loopback door gains nothing.** `jobs.create` is untouched,
  because the node starts servers itself. The one new surface is
  `api.toLocalApp(name, { method, path, body, type })` on the api handed to
  booted apps, answering `{ status, body, type }`. appFaceApp may not reach
  for http (`appFaceGrant.js`), so the node makes this one hop for it,
  through `relayRequest.pipeRequest`, the one outbound door (Andy's "(a)";
  the oneDoor tally does not move).
- **One header crosses, each way: the content type.** A page arrives as a
  page, and a verb's POST as json. No cookies, no auth, no forwarded
  address. Text only; binary files wait.
- **Refusals by name** (`spiritErrors.js`): `app-not-served` 404,
  `app-request-too-large` 413, `app-not-running` 503, `app-did-not-answer`
  504 (the door's 12 s nests inside appFaceApp's 18 s, which nests inside
  puppetPost's 30 s), and `app-answer-too-large` 502. The answer must fit one
  sealed packet, half of `SEALED_MAX`.
- **The proof app is `app/faceProof`** (not `app/hello`: G13 keeps that sample name ruled out beside `app/starter`), a page and one verb (`app.state`),
  granted the name `hello`. It is proven on a pipe by `spirit/test/appServers.js`; the route,
  browser to owner and back, by `faceRouteWorld.js`.
- **Not designed, on purpose:** a local face for an app server, and `join`
  itself (Andy: *"that's acceptable and expected"*).

**MEMBER APPS: UNPARKED 2026-09-27, DESIGN, NOT BUILT.** Andy, once the last
leg worked for his own node: *"how about proving that this works for
member-apps as well as owner apps? right now we're only seeing the route to
my own node."* A member here is another node holding a name the owner
granted, such as the agents' node.

*Decided (Andy, in Desk under G17):*
- **No route question ever goes to a member.** *"a route ask should never
  happen to a member who is not the owner.... when the owner names the
  member the subdomain belongs to, then that is an extension of the grant
  to the appFacaApp puppet to route request from that subdomain to the
  respective member ID."* Built already: the face asks only `api.owner()`
  (appFaceApp `resolve`).
- **Members store their own subdomain on disk.** *"so the mechanist still
  needs, the members to store their own subdomain on disc"*.

*The three gaps, checked against the tree at 51d8de5:*
1. **The member does not know the name is its own.** Its appFaceApp reads
   the host against its own `grants.json` and `face-domain.json`, which a
   member does not have, and answers 404 `no-such-route`. wsl-claude
   reproduced this in a run: three nodes, with the relay faked. Fix, in app
   scope and ruled above: the member keeps the names its `granted` replies
   gave it, and the face passes on the name the owner's route answer
   carried. The face still reads nothing out of a host.
2. **The member's node holds the face's requests.** The face is a stranger
   to it; `hub.frontDoor` (`hub.js:778`) admits only its listen set and the
   relays it accepted, so the packet is held and never reaches an app.
3. **The face holds the member's answers,** for the same reason: its
   listen set is its owner.

*Recommended for 2 and 3, and it touches the front door, so it waits for
Andy's yes on the shape:* **the grant introduces them, with verbs that
exist.**
- **The face admits the member's answer; no contact is added.** Andy,
  rejecting a `contact.accept` step: *"Why would this be neccessary?"* and
  *"the grant is implicit by naming the route, when appFaceApp asks."*
  Proposed rule for the front door: **an answer to a question this node
  asked, from the key it asked, is never a stranger's packet.** The face
  posted `serve` to the key the route named; the reply carries that post's
  hash as `re` and comes from that key, so it is let in. Nothing else is,
  and no contact list changes. It is a rule in `hub.frontDoor`, which is
  core, so it waits for wsl-claude's review and Andy's yes on the rule.
  **wsl-claude's review, 2026-09-27: sound, on five conditions**, checked at
  7558faa. (1) The order is already right: signature, open, replay index,
  and only then the door (`peerPost.js:1093`, `:1166`, `:1252`, `:1289`), so
  `re` is readable there. (2) No record exists to check: `waiting[hash]`
  lives only until the receipt (`:360`). So a core table is needed, filled
  when a post is made with an explicit option (`expectAnswer: ms`, capped):
  `{ hash -> toKey, app, until }`. (3) It is one-shot: consumed by the first
  admitted answer. (4) The scope is this packet only: no contact row is
  written, and it is delivered only to the app that asked. (5) It covers
  gap 3 only. The `expectAnswer` option changes `peer.post`, and so
  `api.post`, which is the node's interface, so it needs Andy's yes on it.
- **The member admits the face** because its own agreement named it (Andy:
  *"the third box trusts the agreement it made"*). The `granted` reply
  carries the face's key. For the first proof, the member's operator
  accepts that key once, the way `face-owner.js` does on the owner's box, so
  no verb is added. Accepting it automatically needs a booted app to add a
  contact, which is a new node verb, and that goes under the gate.
- **The proof:** the agents' node asks for a name, holds `faceProof` under
  it, and a visitor gets its page through the live face. wsl-claude's
  three-node run is the suite.

**A route the face cannot learn is 404, whatever the reason.** Andy,
2026-09-27, asked whether an owner that cannot be asked should answer
502/504 ("try again"): *"404. not found"*, and *"that's the owners problem,
to keep his box online"*. Every way of not knowing where a name lives is
404 `no-such-route`, with a `why` in the body for the operator:
`not-granted`, `owner-unreachable` or `owner-did-not-answer`.

**How a peer learns what a node offers it: the verb `api`, ruled in shape, not
built.** Andy, 2026-09-27: *"the problem to solve then is: how does a peer
know about the silent/public part of that app on the owners box? solution
brain-storm: api.api. a public function on every node, that discloses api's
available to the ID that asks."* Then *"the response would be and api tree
with keys to apps at the bottom, and the value belonging those keys are the
verbs for that app. (all faceless)"*, *"it can be selectively returned,
depending on who asks"*, and *"no: the api.api is not specific, it simple
return a tree accessible to the caller. done"*, and its name: *"one new
verb: \"api\", it return the apis that are available to the caller."* Nothing about faces in it: it
is a general node verb, so building it needs peer review and his yes on the
verb. wsl-claude's facts: what a key may use is already computable from each
booted app's `allow.json` (`nodeApps.js:169-207`), but no app declares its
verbs today; they live only in its code.
- **One verb both finds and calls.** Andy: *"the app, api's if the caller
  sends on object to that verb, and it contains input-data on a leaf,
  that's an ap-api-call"*. `api` with no input answers the tree; `api` with
  `{ app: { verb: input } }` calls that verb and answers its result.
- **wsl-claude's peer review (at 9aebc49): yes to the shape, on four
  conditions.** (1) The gate is the node's, per verb: each manifest
  declares its verbs and who may call each (e.g. `grant: 'allowed'`,
  `serve: 'contacts'`). The node enforces that before any delivery, and
  `api` answers exactly that table, so discovery and dispatch have one
  truth. Today appFaceApp checks its allow list for `grant` only
  (`appFaceApp.js:406-413`). An undeclared verb is neither listed nor
  delivered. (2) It is a peer verb, answered by the node like the card; the
  caller is the signed `fromKey`. On loopback the caller is the box owner.
  (3) The front door still comes first: a stranger gets no answer at all,
  not an empty tree. (4) It is bounded and plain: the tree fits one packet
  or is refused by name; it names apps and verbs only, never a path, pipe
  or file; and it is read per ask, so a revoked key loses its leaf at once.
- **SUPERSEDED the same hour by Andy: the node routes by app, and apps
  describe themselves (introspection).** *"if api.api gets the request
  \"api\" it returns the available api tree, if the request is and object
  {appFaceApp:{}} and there is only one leaf (appFaceApp) then the object
  keyed by 'appFaceApp' is the request served by the appFaceApp server"*;
  the tree is *"a object with a key for every app on the ground level, and an
  object for every verb for that app, showing the request-structure for that
  verb"*; and *"the apps themselves can in fact deliver their portion of the
  tree.... MUST deliver it themselves since the core cannot know their api"*,
  named *"introspection"*, *"by layers"*. So the node never declares or
  checks a verb. On `api` it asks each app for its own part, passing the
  caller's key, and assembles the parts under the apps' names. On a
  one-leaf object it hands that object to that app's server. Condition (1)
  above (per-verb lists in manifests) is withdrawn by wsl-claude; (2)-(4)
  stand. wsl-claude's tests for this shape: (a) each app is asked with the
  caller's key and shows only that caller's leaves; (b) one function in the
  app decides both whether a leaf is shown and whether a call to it is
  allowed, so the tree and the calls cannot disagree (today appFaceApp
  checks its allow list for `grant` only); (c) the node adds no leaf of its
  own, bounds the answer to one packet, and an app that throws or times out
  contributes nothing. Reaching an app still loaded inside the node needs a
  describe hook; an app running as its own process is asked at its door.
- **Each verb's entry has one format.** Andy: *"the introspection return can
  even follow a format for a verb {verb{description:\"descrption
  text\",input:{},output:{}}}"*. So an app's part of the tree is
  `{ <verb>: { description, input, output } }`: a sentence for a person,
  and the shape of what to send and what comes back. The description may be
  as short as a label (Andy: *"or at least a label-length summary"*), so a
  verb always has something a list can show.
  The two shapes are named for the wire, not for a function: Andy, *"or call
  input and output, reqest and reply and reply could even be \"text/html\""*.
  So the entry is `{ <verb>: { description, request, reply } }`, and `reply`
  may be a content type instead of a shape, e.g. `"text/html"` for a verb
  that answers a page.
- **Public to members, and empty is an answer.** Andy: *"the api.api
  introspection is public (for members), because it can return {} if the
  requesting member is not allowed."* Any key the front door admits may ask;
  one that may use nothing gets `{}`. A stranger's packet never gets that
  far (wsl-claude's condition 3).
- **Its wire is peerPost.** Andy: *"peerPost('api')"*, and *"peerPost is the
  wire to the api introspection, NOT the face"*. A member asks `api`, and
  calls a leaf, with an ordinary packet to the owner's node.
- **The member's whole path, in Andy's words.** *"peerPost ask
  ownerNode('api') the reply is {grantFace:{verb:{},verb{}}}"*, then *"the
  member then uses that interface to obtain a domain element. then,
  miraculously, gets requests via the appFaceApp puppet."* So: the member
  asks `api`, calls `{ grantFace: { grant: { name } } }`, stores the name it
  was granted, and from then on the face forwards that name's visitors to it.
  grantFace, running on the owner's box, has meanwhile told the face by
  owner command to admit that member.
- **The member learns the face's key from grantFace.** Andy: *"the grantFace
  can even have a verb that tells the requester the ID of appFaceApp puppy,
  so the member can savely allow requests signed by appFaceApp..."* That
  closes gap 2: the member admits the face because the owner's own app told
  it which key the face is. Admitting it is the member's own act on its own
  node (its contact list, through its own door).
  It is safe because of the path. Andy: *"if grantFace tells the member the
  ID of appFaceApp puppet, that reply will automatically be signed by the
  owner node."* The member's call reaches the owner's node over peerPost, the
  node hands it to grantFace's server, and the node replies with grantFace's
  answer as its own packet, signed with the owner's key. **Rule: an app
  server's answers to peers always leave through its node, never under the
  app server's own key.** wsl-claude's test: the member takes the face key
  only from that reply (`from` is the owner, `re` is its own question), never
  from a packet claiming to be the face, and only for the face the owner
  names now.
  And the other direction: Andy, *"grantFace gets requests only when their
  explicitly forwarded via named pipe, by the owner-node"*. So grantFace takes
  no peer requests of its own. Everything reaches it through its node over
  its pipe (`api.toLocalApp`), and everything leaves through its node.
  Andy: *"and those request can only come from verified members with
  signature that the owner node automatically checks"*. Already how
  peerPost works: every arrival's signature is checked, and the front door
  admits only known keys, before the node forwards anything down the pipe.
  The app's allow list is the second gate. *Caveat (wsl-claude): "members
  only" holds by the DEFAULT stranger setting ('silent', `hub.js:713-718`),
  not by construction. An owner who switches it to 'acquire' lets any signed
  stranger reach the node.* **Ruled (Andy: *"say so in the design. and
  explain there, that it requires a member to be in the owners contact list
  before introspection works for that member"*): `api`, both the tree and a
  call, works only for a key already in the owner node's contact list. A
  member is added there first (an invite, or the owner accepting it by
  hand), and only then can it introspect or ask grantFace for a name. The
  stranger setting is not a way in: a key the owner has not accepted gets
  no answer from `api`, whatever that setting says.**
  Andy's name for it: *"that is exactly consent based access."*, and *"with multiple layers of consent"*, which he
  listed: *"1) consent to allow member on the relay, 2) consent to allow
  introspection 3) consent to grantFace access"*. Each is its own gate, and
  none implies the next: (1) the owner lets the member onto his relay (an
  invite he mints); (2) his node has the member in its contact list, so the
  front door admits it and `api` answers it; (3) the member is on
  grantFace's `allow.json`, which the owner writes and the app can only
  read (`nodeApps.js`, OWNER-ONLY).
  *Implied layers* (Andy: *"there are implied layers since the relay is owned
  by the same key as the appFaceApp puppet...."*): one owner key holds the
  relay, the face and grantFace, so one consent can stand for another. It is
  carried by the owner's own node or app acting for him (grantFace turning
  his grant into the face's contact), never assumed by a layer on its own.
  What the layers share: *"the owner has to issue grants all along the way"*.
- **grantFace first, and its client on the member's side.** Andy's case for
  building grantFace next: *"it's relatively simple and the main logic has
  already been exercised and proven. 2. we can test-drive the api
  introspection on that app. 3. we can make sure the app is visible in
  jobs-(monitor), and when it all works, the browser to app-server-process
  request loop should continue working just as before"*. And the member's
  half: *"make sure the client member of grantFace stashes to proper
  information in its fs. make sure the client member, also puts appFaceApp
  into contacts, in order to accept browser requests routed by appFaceApp"*.
  Tests for the client: it stores its name, the owner's key and the face's
  key in its own folder, and keeps them across a restart; it adds the face's
  key to its own node's contacts, taken only from the owner-signed reply; a
  browser request for its name then reaches it through the face, and a name
  with no handler answers "under construction". Adding a contact is a
  loopback verb on the member's own node, so the client needs the same door
  access as grantFace.
  wsl-claude adds two: the client acquires the face's key before accepting it
  (`contact.accept` answers 404 "no row for that key" on a node that has
  never seen it, `hub.js:1731`, as face-owner.js found), tested from a
  member node with no row for the face; and when the owner names a
  different face, the client drops the old one.
- **Many providers, so the client keys by owner.** Andy: *"our architecture
  allows multliple relays per personal node, and implicitly multliple
  face-providers, so we be carefull how the personal nodes grantFace dataset
  looks...."* Proposed (awaiting his Go!): the member's dataset is a list of
  grants, one row each, `{ owner, face, domain, name, app, at }`. **Keyed by
  face plus name**, not owner: Andy, *"and the owner may own several relay
  and face providers, too."* A request is matched to its row by the face
  that forwarded it. A replaced face changes only its own rows. The owner's
  side changes the same way: grantFace keys its grants by face domain plus
  name, and face-domain.json becomes a list of the owner's faces (domain and
  face key each). Today's single face is a list of one.
  wsl-claude's tests: two providers at once, each face admitted only for its
  own names; replacing one provider's face leaves the other untouched;
  freeing a name at one provider leaves the other's grants alone.
- **Contact rows say what a key is (proposed, awaiting his yes).** Andy asked
  whether contact rows should mark puppets, so a people list can leave them
  out, and *"like in member-type field, it could also help with relay ID's
  etc.... ?"* Proposed: a signed `kind` on the node card, `node`, `puppet`
  (with `owner`), `relay` or `app`. A row caches it, and lists filter by it. A
  puppet is hidden from people lists, never removed from the contact book.
  A card that says nothing reads as `node`.
- **Next after grantFace: one owner record on every server type.** Andy
  asked whether the install-time owner key could be *"a lowest level layer
  where relay and public puppies (like print service by a peer) they
  owner-key should be stored orthogonally on all VPS puppies/relays"*, and
  *"that is also cleanup i want to drive"*, *"that will be done after
  grantFace"*. Today a relay names its owner by the first row of allow.json
  (`relayAuth.js:650`), a puppet by the key in puppet.json, and an app
  server asks its relay. It gets a requirement of its own. It must not change
  how a relay gets its owner: first claim and pending-owner are decided
  (AGENT.md).
- **faceServer is to be named faceServer (ruled, rename not yet done).** Andy:
  *"lets face it. the only thing it actually does is giving face, while
  being the owners puppet"*; *"should a printing puppet come along, it will
  be printServer and not called or launched by faceServer"*; and *"it doesn't
  pick its own contacts, it doesn't set its own resource boundaries, it
  doesn't store it's own routes, it doesn't control its own file system ...
  it enherits the plumbing from node. ... it doesn't serve apps. it only
  serves face"*. The core's launcher (appServers.js, `"serves": true`, the
  pipe) stays generic: it starts whatever server an app names.
  What it is, in his words: *"it's a fanned screen"*, *"it's an io-device"*.
- **grantFace, ruled in shape (Andy, in Team).** *"i think it's lives while
  the node lives, because it is a server, as defined in the manifes. grantFace
  app owns grants.json, who else needs it on the owners node? 3) the server is
  a normal loopback client of the node interface, it can reach anything a
  local browser can. 4) the sync is executed by grantFace, every time a
  change occurs in grants.json. The sync is executed by owner command on the
  owners node interface, by loopback. the server is in fact given the same
  lowest layer node-client interface that is the shell has at its lowest
  layer. 5) the members client is a simple shell app, it used peerPost to get
  apis, it uses peerPost to negotiate a place int the grants file, it uses
  the local fs.api to store it's end of the domain grant."* So:
  - grantFace runs for as long as the node does, started from its manifest
    like any serving app.
  - It alone owns grants.json. The route and serve answers move into it.
  - It is an ordinary loopback client of its node. It gets the lowest layer
    the shell has (the spirit object's door call, aimed at its node), and so
    reaches whatever a local page can, owner.command included.
  - Whenever grants.json changes, it syncs the face's contacts by owner
    command.
  - **The member's client is a shell app, not a process.** It uses peerPost
    to ask `api` and to negotiate its name, and the fs api to store its side
    of the grant.
  The floor this needs: a server process runs the app's own code, with that
  spirit object. faceServer runs none today.
- **The face never asks; grantFace pushes.** Andy: *"there is no need for
  appFaceApp to access grantFace, because grantFace keeps appFaceApp in sync
  with grants.json. appFaceApp has permissible target-node-ID's for browser
  posts magically updated by grantFace using the owners owner command"*, and
  *"correct. appFaceApp is a puppet, it behavior is controlled by the owners
  node."* So the `route?` question, its RAM cache, the new-name budget and the
  negative cache all go. The face holds a pushed table (name to target key,
  those keys also its contacts), and Caddy's certificate check reads it. The
  owner's own `serve` stays. Recommended (claude, not yet ruled): the table
  is written through one narrow verb on the face's appFaceApp, e.g.
  `routes.set`, not by giving the owner the face's whole file system.
  Andy: *"appFaceApp holds the dns to member ID in memory only, it's contact
  list is on disc and only governs permissions."* After a face restart the
  table is empty until the next push (open: a start-up "I'm up" to the owner,
  a timed re-push, or both).
  **REVISED the same hour by Andy: the face learns routes lazily.** *"after
  boot, the first request from a browser arrives, it asks its owner for the
  route (it might actually be an access to grantFace app, who holds those
  routes (you were right!), if a route is returned, appFaceApp caches it in
  ram and then re-uses it on subsequent post from that subdomain."* So
  `route?` stays, answered by grantFace through the owner node, and cached in
  the face's RAM with today's expiry (an hour, so a name taken back stops
  routing within it). No pushed route table, and no restart gap. What
  grantFace pushes by owner command is permission only: the face's contact
  list.
  And the owner's node reads none of it: *"appFaceApps owner doesn't
  understant appFaceApp nor grantFace"*. The face's question is a packet
  addressed to grantFace; the node forwards it down grantFace's pipe by the
  packet's app name, and returns the answer signed, without looking inside.
  In one line (Andy): *"grantFace maintains a DNS-wildcard-subdomain compatible
  dataset, and appFaceApp accesses it via our generic packet routing"*.
  **grants.json is canonical.** Andy: *"the dataset grans.json is the
  canonical version of that dataset. upon every modification if that,
  grantFace uses the owner command of the owners local node, to sync the
  appFaceApp's contact list."* The sync makes the face's list match: it adds
  a row the face lacks (the face has no row for a key it has never seen,
  `hub.js:1731`), accepts it, and drops the keys of freed names.
  Deleting rows is deferred: Andy, *"deletions of rows in grants.json will be
  problematic, but not of concern right now."*
- **Open (claude):** one leaf per call, a batch being a separate design.
  A call needs the app's answer back, and today a handler's return value is
  dropped (transport/R12), so the call half depends on R12.

*Open:* whether the face should admit a member for everything or only for
answers to requests it forwarded there. The tree has only whole-key
admission today.

**The page waits its turn, a bet on low visitor frequency.** Andy,
2026-09-27: *"the shell-lowest layer in face-mode, may need a
request-queuer....(so as to not overload the relays transaction-per-member
limit."*, then *"with the expected visitor freuquency at least the shell is
capable of waiting its turn. I bet on that working fairly well."* So the
lowest shell layer in face mode (the page's `ask`, G3's one home) keeps one
request in flight and queues the rest. Across visitors, the VPS node's own
`postQueue.js` already serialises against decision 0016's one request in
flight per member, oldest first, and a refused request is requeued ahead
of newer ones. **Deliberately NOT added:** a cap on how many visitors may
wait at appFaceApp. That was offered and not taken, on the bet above. If
measured load proves the bet wrong, that is the lever. The per-request
time limit (above) stays owed either way. **And members make the bet
safer:** *"and member are expected to have lower visitor frequencies, AND
separate unique routes through relay"*. A member's visitors travel on that
member's own route. They add little load and do not pile onto the owner's.
**The mechanism under the bet is already proved** (Andy: *"lets be
honest, we already proved that throttle in peerPost)()"*): `postQueue.js`,
`queueUnderLoad.js`, `queueRestart.js`, and the burst fix pinned at
36f9e19. Delivery is not in question. Only waiting time is. Three limits
apply to a post the VPS carries (wsl-claude, read from the tree; Andy:
*"sending key is also throttled."*):
1. **The VPS node's own queue, per relay:** `postQueue.js:68`,
   `IN_FLIGHT_PER_RELAY = 1`. This is the one that binds.
2. **The relay, per sending key:** `router.js:27`,
   `DEFAULT_PER_REQUESTER = 16`. Every carried post has the VPS key as
   sender, so all routes share it, but at 16 it does not bind.
3. **The relay, per target:** `router.js:48`, `DEFAULT_PER_TARGET = 1`.
   Each member's node has its own slot.

So members' routes are separate for waiting purposes only when they go
through DIFFERENT relays. On one relay, every visitor to every member takes
turns through the VPS node's one slot. The suite measures it: two members
on one relay, one visitor each, fired together, gives at most one in
flight; on two relays, two.

**So every route served, by a node or a puppet, is negotiated and contracted** (Andy: *"so all
routes served are negotiated and contracted."*, then *"by nodes or puppets"*). No route is served
without a row the owner granted. A request for a domain with no row is
refused at the VPS, and a carried packet naming no row is refused at the
receiving node. There is no default route and no fallback app.


**THE ENTRY POINT ON THE VPS, BUILT 2026-09-27 on Andy's "go."** (his title
for G17: *"confirm the reply path from app-server-process back to the
browser"*; `spirit/run/js/puppetPost.js`, `spirit/test/puppetPost.js`): a listener on the VPS puppet node that exists only for face traffic.
Caddy terminates the browser's HTTPS and forwards to it, and it hands each
request to appFaceApp and nothing else. The node's own door stays
loopback-only (`server.js:675`), so a visitor never reaches the node's verbs.
Andy: *"you mean the entypoint on the pupped-node appFaceApp?"*: yes.
**Named after its caller**, Andy: *"maybe call it the same name as the
lowest-level shell function is called?"* The page's lowest layer calls
`puppetPost()`, and the listener that answers it on the VPS carries the same
name, so both ends of the one wire read as one thing. It is his mirroring
rule applied to a single call.

What slice 1 is, as built and reviewed by wsl-claude: `relay-state/face.json`,
`{ "port": n }`, switches it on, so every other node has no face. It listens
on loopback only. The one node app that claims it (`api.face(handler)`,
handed only on a node with a face) gets `{ host, method, path, body }` and
nothing else: no headers, no socket, no forwarded address. A face that hangs
gets 504, one that fails gets 502, and the next request is served. A body
over BODY_MAX is refused by name before the face runs. A second app cannot
claim it, and the same app may claim again after a remount.

**The answer is capped at MAX_PAYLOAD.** Andy, 2026-09-27, "go." on capping
it like everything else that goes out. Over the cap, in UTF-8 bytes, the
visitor gets 502 `face-answer-too-large`, never a page cut off partway.

### G18 — the app process serves its owner node over a named pipe, not a TCP port

**Status:** BUILT with G17's last leg, 2026-09-27 (*THE LAST LEG*, under
G17). The app server listens on the pipe the node names (`--pipe`): a named
pipe on Windows carrying a hash of the checkout, so two nodes on one box
never share one, and `app-state/<name>/door.sock` elsewhere. Andy, 2026-09-27, in Desk: *"hat's missing
here is the fact that processes use named pipes to serve requests from the
puppets.... and that mechanism needs a spot on the board sometime soon"*.
Earlier the same night: *"question, should the app connect via named pipe,
so we don't exhaust our TCP/IP port budget?"* and *"which gives that
connection a separate namespace"*.

**The shape discussed:** an app with a face runs as its own app-server
process on its owner's box (see *THE PATH* under G17), and the owner node
forwards to it. That forward goes over a **named pipe** on Windows, or a
Unix socket file on Linux, never a loopback TCP port.
- **Why, and it is not the port budget.** Loopback has about 64,000 ports,
  and memory runs out first. What a pipe changes is WHO CAN CONNECT: a
  loopback port answers every program on the box, so any local process
  could call the app's door past the owner node. A pipe is a name in the
  file system with file permissions, reachable only by the node's user,
  and invisible to a port scan. That is the "separate namespace".
- **What changes:** the app server's `listen(port, '127.0.0.1')`
  (`faceServer.js:1371`) and its `--port` flag take a pipe path; the owner
  node's forwarder names a pipe where it named a port; and the suites that
  open ports. The page and the door are unchanged, because Node's HTTP
  server listens on a path as it does on a port.
- **Verify:** the app process answers on its pipe; nothing listens on a TCP
  port for it; a second user on the box cannot open the pipe.
---

### G19 — A member's app answers through the face

**Status:** OPEN. Opened 2026-09-27 when G17 closed (Andy: *"ok. aoff to the
team chat. this R is closed."*), with his edit of the draft in Team.

**The requirement.** A visitor's request for a name the owner granted to a
MEMBER node reaches that member's app, and the reply comes back through the
same face. The owner's node answers where a name lives and forwards nothing
it understands; no route question ever goes to a member.

**Its design** is *MEMBER APPS* under G17 above: grantFace, consent in
layers, the face asking on a cache miss, `api` introspection, the member's
shell client, and the datasets keyed by face.

**Broken down, agreed 2026-09-28 (Andy: *"ok break it down like that and we iron out remaining wrinkles as we go."*), each blocked by
the one before:**

| R | what | blocked by |
|---|---|---|
| R1 | The process spec written (`design/node/PROCESSES.md`) and the server process type completed: a server job gets `SPIRIT_JOB_ID` and `SPIRIT_CALLBACK_URL`; `spirit.core.ask` works from a process; a serving app's own code runs as its job; a server job can be stopped from the jobs app | — |
| R2 | Passthrough: a packet for a serving app goes down its pipe, and the answer returns signed by the node | R1 |
| R3 | grantFace: grant, faceKey, the route answers, `grants.json` (canonical), the face's contact sync by owner command | R2 |
| R4 | The `api` verb, introspection by layers (needs Andy's yes on the verb) | R3 |
| R5 | The member's shell client | R4 |

Outside the chain: the `face-install` rerun on spirit-3 (Andy's), and the
`relayRequest` deadline.

---

### PROPOSED, NOT IN THIS CYCLE — a sweep for forks

**Andy, 2026-09-24, during the build:** *"can the tree be swept
periodically to detect those kind of repetition patterns? I noticed that
the editors in vscode don't seem to have a where-used memory for
functions....?"* — and *"that would seem to be a hardening-approach:
find repeated tricky code-segments solving the same problem."*

**The editor gap is real and worse than stated.** Where-used exists;
**what no editor offers is "what else already solves this"** — and only
that catches a fork, because a fork HAS NO REFERENCES TO FIND. It is new
code that never called the thing it duplicates.

**Six forks were found in one sitting, five of them this agent's**,
which is the evidence base rather than a hypothesis:

| what forked | its one home |
|---|---|
| `ask` — three copies | `kernel.js:642` |
| a fixed 8s timeout | `peerPost`'s negotiated `grantedMs` |
| a status-to-meaning table | `spiritErrors.classifyAnswer` |
| box arithmetic named `relayLimits` | generic all along |
| unit infrastructure named for relays | `bash/lib.sh` |
| `peerPost` wiring divergence | one factory, three shapes |

**They share one shape: an operation the tree already owns, performed
through new code.** Which is exactly what `oneDoor` detects for SOCKETS
— so the mechanism is built and proven, and all that is missing is
that it knows about one operation.

**RECOMMENDED: generalise `oneDoor`, do not build a clone detector.** A
declared table of owned operations — the socket, the wait, status
classification, identity and key generation, manifest reading — each
with its home and the shapes that indicate a re-implementation. Red on a
new occurrence outside the tally.

**AND THE CAUTION THAT DECIDES WHETHER IT IS WORTH DOING.** Generic clone
detection is easy to write and NOISY, and **a noisy gate gets ignored,
which is worse than no gate**: it teaches the habit of scrolling past —
the same failure Andy named about dated commitments rotting into
embarrassments. Start narrow, and let **every entry come from a fork that
actually happened.**

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
and **`publicAppServer.js` becomes `faceServer.js`.** The same module on
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
>   the module became `faceServer.js`.
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
> `faceServer.js`), S2 frames the module by publicness (not an axis),
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
