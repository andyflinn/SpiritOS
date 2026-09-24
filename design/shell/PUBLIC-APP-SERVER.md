# The public app server — and `join` as its first app

**A DESIGN IN PROGRESS. Nothing is built and nothing here is a
requirement yet.**

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

## SCOPE 1 — THE PUBLIC APP SERVER

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

## SCOPE 2 — `join`, THE FIRST PUBLIC APP

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
