# Devices and ports — how you run a public HTML face on the internet

**Andy, 2026-09-24**, naming what the whole arrangement is for:

> *"that's how you run a public html-face on the internet"*

> *"now you can buy the power of a VPS making your home computer the
> wizard of oz"*

**Status: the model is DECIDED, in his words, recorded here the evening
it was given. The requirements that follow from it are OPEN and none are
built.** The vocabulary is already in `DICTIONARY.md` under *The show*;
this document is the model, what it costs, and what still needs ruling.

---

## Why this document exists at all

Two agents spent an hour designing capabilities for the wrong machine —
ears, memory, a roll, a posture, an answer vocabulary, selective access
— because **one word covered two things**. Every correction Andy made
moved one of those back to his node, five times, and neither agent saw
the pattern from inside.

**The vocabulary was written first and alone**, before any of this, for
that reason. What follows is only usable with those words.

## The model

**Everything the master owns is a DEVICE.** A relay is a device. An app
is a device. The owner's filesystem is a device. They are **siblings**:
the same kind of thing, differing in reach and in what they were granted,
never in kind.

> *"relay is also a device, a sibling device to the app"*

**A device has PORTS, and a port is an interface rather than a thing:**

| port | faces | reach |
|---|---|---|
| **control panel** | the master | loopback, in the shell |
| **public face** | the audience | the internet, on a bought box |
| **the wire** | the master's node | the relay — and not visual |

> *"an app is: a controll panel in the shell: and a screen in puclic"* —
> *"a visual IO port"*

**The master wires the ports. The device never wires its own.**

> *"so the owner provides interfaces to the app"*

## What runs where

**The app runs on the owner's node.** Logic, state, decisions. It is
developed exactly where every existing app is developed —
`spirit/run/app/<name>/<name>.js`, beside `natter` and `contacts`, and
sixteen apps already live there.

**The public box holds a face and nothing else.** It owns no store and no
connections: it uses its node's, as far as granted, and on a public box
that grant is nothing.

> *"The app actually lives on the owners node. the 'site' is just a
> screen"* — *"the node holds the store... the node hosts the store and
> the connections"*

**Which is where the properties come from, rather than from rules we
enforce:**

- **Breach the public box and you get a screen.** No user data — it owns
  no store. No credentials worth having — it posts to one key. No ability
  to act — it decides nothing.
- **Nothing to back up, migrate or leak.** Deployment is replacement,
  which is why G12 was right before anyone could say why.
- **The owner's data never leaves his machine**, because the disc holding
  it is in his house.
- **The box is disposable**, and cheap forever: it serves a face and
  carries one post, so nothing you add to the product makes it work
  harder. The expensive things stay home, where they are already owned.

**And the honest cost: the master has to be up.** A show with a sleeping
master is a screen that says so — which is why *"an owner who is live is
the suggested SOP"* was a ruling and not a convenience.

**`bash/systemd/` holds exactly one unit, `spirit-relay.service`. There
is no node unit.** Today a node stays up because a person left it
running. That is fine for a workstation and not fine for the thing behind
every public face.

## One protocol, including to one's own devices

> *"an then the node can commicate to the device over the same protocol
> is uses for other nodes"*

A device is addressed like a peer: sealed, signed, routed. **No second
mechanism**, which is the tree's first rule arriving at a new place.

Half of this is already true: the app server has an identity, claims a
seat, holds its owner's card and posts by `peerPost`. **What is missing
is the other direction** — it can be asked and cannot be told, so
shutdown, silence, and changing a face while nobody is looking have
nowhere to arrive.

> **CORRECTION, 2026-09-24, before this document was a night old.** It
> first said no app in the tree receives. **That is false and it was
> load-bearing** — wsl-claude, checking a premise its author had written
> without a citation:
>
> `app/relayChat/relayChat.js:1205` — `if (typeof api.onPacket === 'function')`
> `app/relayChat/relayChat.js:600` — *"Relay Chat receives through api.onPacket or it does not"*
>
> **An app-layer receive path EXISTS and `onPacket` is already in the
> surface vocabulary.** So the gap is not a missing mechanism at the app
> layer — it is that the app server hands `peerPost` no `onArrival`.
> Narrower than this document claimed, and in one file rather than in the
> design.
>
> *And the app that proves it is `relayChat`, which is parked. The
> mechanism a parked app is built on is not parked with it.*

## THE RELAY IS NOT A PRECEDENT. IT IS THE IMPLEMENTATION.

| the model | already built, in the relay |
|---|---|
| a device owned by a master | the relay, owned by the key that claimed it |
| a control panel in the shell | `app/relayMonitor/` |
| a public face | `relay.html` and the brochure |
| driven by its master over the protocol | the owner verbs — signed, routed, refusing everyone else |
| reports to its master | the status report only an owner receives |
| bounds set explicitly by the master | `ramLimitMB`, `discLimitMB` |
| holds a store and connections | `relay-state/`, the members table |

**So the app server's missing ears are not a mechanism to design.** This
agent was one step from designing that channel from scratch, with the
other reviewing it, while the tree has run it for cycles.

---

## DECIDED — his rulings, and they are not to be relitigated

- **A device never wires its own ports.** The master provides interfaces.
- **The app lives on the owner's node**; the public box holds a face.
- **One protocol**, including between a node and its own devices.
- **Through the master, never direct.** A public box must not hold the
  keys of the people it serves — *"breach the box and you get HTML and a
  list of names"* is true only while that holds.
- **`contacts` is never in an app's surface vocabulary.** An app that
  could add its own contacts would choose its own correspondents.
- **The owner is in charge of a device's contacts**, and chooses from the
  device's own roll and from his book.
- **Bounds are the master's**: explicit, never inherited, reported in
  state, and overflow reports rather than silently forgetting.

- **PERMANENT UPTIME IS THE OWNER'S, ALONE.** Andy, 2026-09-25: *"the
  system collapses when the owner sleeps. it is MY responsibility to keep
  my node always on and online"* — *"the owner of a public relay is alone
  responsible for keeping his box online permanently"* — **"because
  without that, it's an unreliable service system."**

  **This is a refusal to engineer around it**, and the reason is the
  third sentence. Durable caching on the public box, stale-serving,
  fallback routing: each buys a little availability and each makes the
  failure HARDER TO SEE. A service that is sometimes current, sometimes
  stale, and never says which, is worse than one that is either up or
  plainly off. That is `REFUSE, NEVER QUEUE` at the scale of a whole
  arrangement.

  **What it settles, so nobody re-opens it as diligence:** the stage
  holds nothing across a restart AND the lookup is live AND members'
  faces go dark when the owner's box does. Those do not conflict — the
  third is accepted rather than mitigated.

  **What it obliges:**
  - **A node unit.** `bash/systemd/` holds only `spirit-relay.service`.
    The node has no unit, no `Restart=always`, no bound, no host
    document — so today the foundation of the arrangement depends on
    somebody remembering to leave a program running. *Absent → the
    system's own precondition is unenforced.*
  - **Saying it where the role is taken on.** `bash/RELAY-HOST.md` tells
    a new owner how to install and nothing about what they are
    accepting.
  - **And telling the member.** *Alone* means Alice's face goes dark with
    the owner's box and she has no recourse. She should be told at grant
    time — one sentence, and it is the difference between a host and a
    landlord who does not answer the phone.

  **It also retires a question:** *how stale may a face be* is not a
  caching decision. Staleness is a symptom of the owner failing this
  responsibility, not a feature to tune.

## RECOMMENDED — both agents, not yet ruled

- **A device may hold nothing across a restart.** Ephemeral, in memory,
  bounded, gone when the process stops. That is not a store and does not
  become one — and it is assertable with the check that exists, using a
  restart as the control.
- **Ears are owner-only**: one correspondent, key held, card verified,
  everyone else refused by signature.
- **The filesystem scope is supplied at MOUNT, by the master.**
  `kernel.js:758`'s `createScopedFs` is already the right shape and says
  what it is not: *"an accident-prevention convenience, not a security
  boundary"* — the app scopes itself, and the server-side jail is
  per-tree rather than per-app. Supplying the scope at mount closes both.
- **The manifest becomes a REQUEST rather than a self-granting
  declaration.** Safe while every app is the owner's; unsafe the first
  time he installs one he did not write.

## THE CONDITION ON EARS — wsl-claude, and it is not optional

> **Nothing an unauthenticated packet can cause may reach the master.**
> Not a notification, not a log write that posts, not a refusal reported
> upward.

Owner-only-by-signature runs **after** a packet has arrived and been
parsed, so the property must be **re-established explicitly rather than
inherited**. Signature first; everything expensive or noisy after.

**Otherwise the box that exists to keep strangers away from his node
becomes the thing that carries them to it — and it arrives looking like a
feature.**

### Six things "port it properly" has to mean

Read out of `relay.js` rather than recalled:

- **Two limits, not one.** Members by **identity**, claims by
  **address** — different attacks. Identity-only is defenceless against
  an unauthenticated flood, because there is no identity yet.
  Address-only is beaten by a member with many addresses.
- **The limiter's own bucket is bounded** (`RATE_KEY_SWEEP_AT`, swept
  inside the check). A limiter keyed on an attacker-controlled value is
  **state an attacker can grow**. Without the sweep it is worse than no
  limiter, because it looks like protection.
- **The limit sits before anything that costs or notifies.** Order is the
  protection, not the presence of a check: *"an event fired before here
  would let a stranger drive the owner's notifications as fast as they
  can send."*
- **Limits are disclosed, not secret.** A hidden limit produces
  mysterious failures and teaches clients to retry harder.
- **Different numbers for different doors.** No single number both
  permits legitimate use and stops abuse.
- **The refusal at an unauthenticated door says one thing.** Rich errors
  there make it an **oracle** — answering questions for people who have
  not proved they may ask.

---

## THE GRANT AT THE BOTTOM — decided 2026-09-25

> *"so the bottom is the grant mechanism that underpins the installation
> of join into the DNS namespace as well as member subdomain
> assignments."*

**ONE MECHANISM, AND IT IS THE WORD THE SYSTEM ALREADY USES** at two
other heights: an app is granted its interfaces, a node is granted a
seat, a name is granted in a namespace. *(This agent proposed `slot.claim`
and was corrected — coining where the vocabulary existed, one day after
writing that error up.)*

**RESERVATION IS AN EVENT, NOT A LIST.**

> *"in development we put a skeleton for appShellApp in its proper
> folder, we assume that the installation of join on our VPS reserves its
> subdomain via a negotiation with appShellApp, and so is logged in
> appShellApp's subdomain-dataset"*

A name is taken because something took it. **A system face uses the same
grant path a member does** — *"itself first of all"* — so there is no
reserved-names concept, no policy list, no second code path, and nothing
to go stale. Both agents had built a structure for a problem that turned
out to have no instances.

**AND IT IS NOT HARDCODED**: the dataset lives on the owner's node, and
the namespace **is the domain** — another owner's stage is a different
namespace with different names in it.

### The minimum, and the two constraints on it

> *"the appShellApp could implement the bare minimum, and this is the
> no-face negotiation, without any local shell interface yet or
> anything."* — **"faceless, no shortcut."**

**FACELESS** — no public face, no control panel, no HTTP surface, no UI.
**NO SHORTCUT** — a packet even when both ends are on one node.

**Together they give it ONE DOOR**, and that is what makes its suite
honest: the test drives it the way join's installer will, because there
is no other way. No UI path to diverge from, no local path to skip.

### The interface (G15 — named so a suite need not guess it)

```
app: 'appShellApp'
body:     { grant: '<name>' }
answered: { ok: true, name, at }
          { ok: false, code: <declared>, name }
```

The dataset is one record per name — the name, the holder's key, when,
and which namespace — in the app's own folder, which
`WRITABLE_ROOT_NAMES` permits and `createScopedFs` scopes. The refusal is
a declared code, walkable like every other.

## THE TEST FOR THIS CYCLE — his, and better than the one we started with

> *"the minimum we plan to build must not block the way to this vision."*

**"Cater to the foresight" invites building for it. "Must not block the
way" does not** — it is a yes/no question about a specific future, asked
of each piece, answerable without building anything.

**And the filter that separates a blocking property from a fact wearing
one** (wsl-claude, applied to four candidates and rejecting two):

> **Name the future action that becomes impossible or expensive if this
> is absent.** If you cannot name it in one clause, it is not blocking —
> it is either already true or already decided, and both belong somewhere
> other than the test.

| what | absent → |
|---|---|
| an install grants a name | **granting the second name**, because the first collision is an eviction rather than a policy change |
| a local exchange goes over the wire | **the first VPS install**, where the remote path is exercised for the first time and found broken |
| the app server does not assume it owns its host | **mounting a second face on one host** — a rewrite rather than a configuration |
| the face is the generic shell layer | **building the second face**, which copies the first and the generic layer is never written |

*Stated POSITIVELY on purpose. "No local shortcut" as a negative would be
green on an empty tree — there is no shortcut because there is no
exchange — which is a check that cannot fail, declared deliberately, on
the board.*

## SEQUENCED, NOT DISCARDED

**The pamphlet.** *"a member's public face does not necessarily start
with the member's personal node becoming a web server, it starts with the
member's personal node being able to put a personal pamphlet on the
internet."* Pushed once rather than routed per request — so `PAYLOAD_MAX`
does not bite, no gateway is needed, and **Alice can be asleep**, which on
real hardware is the difference between a service and a demo.
`published/` is already a writable root and its filenames are already
domain-prefixed.

**The appfolder stays ours.** *"for starter: we still control all the
apps that are in the app-folder. if anybody decides to become a
relay/appShellApp owner, they can clone the repo and write their own
apps."* One population — so `oneDoor` walking the filesystem and
`plantRun` copying only non-ignored files are both correct as they stand.

**A finding deferred WITH its feature is a third category beside keep and
discard.** The payload bound travels with live serving; the
two-populations disagreement travels with third-party apps. Both are
correct unchanged when their feature arrives, and neither becomes
folklore or a file nobody asked for.

## OPEN — needs Andy

- **How stale may a face be?** A product question and his taste: a
  personal page tolerates minutes, a status board does not.
- **Does the granting step exist for his own apps**, defaulting to yes,
  or only when a third-party app arrives? It has to exist somewhere, or
  the decision has no home later.
- **The node unit.** Making a home machine as available as a relay is
  real work that nothing in the tree does yet.
- **Whether `device` keeps its current narrow meaning** (`device.html`,
  `deviceAuth.js`, `POST /api/relay/device` — an enrolled browser) or
  becomes the general word. They may be the same concept seen from two
  distances; that was raised as a collision and may not be one.

## NOT RECORDED, ON PURPOSE

The designs retired during the evening — the notary, the posture that
says what may be kept and from whom, the answer vocabulary, selective
availability at the app — **are deliberately not written down.**

They were made under the wrong premise, for a machine the app does not
run on. A designed thing sitting in the tree, looking finished, attached
to a condition nobody ruled, is exactly what this agent found in
`device.html` and reached for as a solution within two minutes.

**When one is wanted it will be designed then, with its own reasons.**
The test was run the same evening: a hosting service arrived needing the
owner-managed contact list, and the whole shape was reconstructed from
memory in one paragraph. **The cost of not filing it was zero.**
