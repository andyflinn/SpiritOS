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
