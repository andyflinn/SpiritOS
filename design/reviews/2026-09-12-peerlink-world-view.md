# Peerlink — the system reviewed against its own world view

**Review only. Against `26205fe` (2026-09-12). Nothing was built.**

Andy:

> our new world view: nodes are people, relays are satellites, and we are
> "Peerlink".

Three claims. **They are not equally new, and that turns out to be the
useful part of the review.** One of them is the oldest written principle
in the repository and the code has been quietly converging on it for
months. One is genuinely new and is about 70% true, with the gap
measurable. One is a name that does not appear in the tree at all, and it
has a hard boundary around it that is worth drawing before anybody starts
renaming things.

Every claim below carries a file and a line. Where the frame and the code
disagree I say which one I think is wrong, and that goes both ways.

---

## 1. "Nodes are people" — already decided, mostly built, one fossil

This is not a new world view. It is
[NODE-ARCHITECTURE.md](../principles/NODE-ARCHITECTURE.md), **16 May 2026**:

> A SpiritOS Personal Node is not a server that hosts data about a person.
> It **is** the digital embodiment of that person.

and [VISION.md](../VISION.md) the following day: *"Every Personal Node
belongs to exactly one human. No multi-tenancy. No shared accounts."*

### Where the code already agrees

| the claim | where it is true |
|---|---|
| one node, one person | `relayAuth.js:283` — `identity.json` is a single keypair with a single name. There is no users table anywhere in the tree |
| nobody else reaches your node | `server.js:723` — a personal node refuses any request that is not loopback, and binds `127.0.0.1` (`server.js:1232`) |
| your perception is yours | `whoBook.js:92` — `who.json` is never uploaded; the private label never reaches a wire |
| your record is yours | per-peer files, `peerStats.js:24` under `app/contacts/`, `chatLog.js:49` under `logs/` |
| a person is a key, not a name | `relay.js:211` — two peers may wear one label and remain two identities; `devicePeers.js` proves it |

That last row is the one that matters most for the other two claims. **The
key is global and the label is local.** A person carries the same identity
to every relay and may be called something different on each. Nothing had
to be designed for the satellite frame to make that true; it already is.

### Where the code disagrees — and the code is wrong

**A person's private files live in a directory named after the other kind
of box.** On a personal node, `relay-state/` holds:

| file | what it is |
|---|---|
| `identity.json` | the person's keypair |
| `who.json` | the whoBook — who this person thinks everyone is |
| `device.json` | the door password |
| `traffic.json` | every packet in and out, payload included, for 24h |

That is the most personal directory in the system and it is named
`relay-state`. It is a fossil from when a relay was the only thing with
state, and it reads as a category error the moment "nodes are people" is
said out loud. `.gitignore:49` and every path constant would move
together; it is contained, and no wire sees it.

**The word "mailbox" is still in the code.** 276 occurrences under
`spirit/run`, most of them prose. The ones that are identifiers:

- `peerPost.js:56` — `var mailbox = []`, the node's own inbound list.
  Purely internal, free to rename, and it is exactly the word Andy said
  does not exist.
- `natterDetails.json` — the app's manifest `name` is **"Mailbox"**. That
  is the title bar of the screen rebuilt this afternoon. A human reads
  this one.
- `relay.js:276` `mailboxPublicKey` — **on the wire**, see §3.

**`natter.json`'s description still says** *"Server #3's future public-IP
hub nodes"* — a sentence from before spirit-3 existed, describing a
future that arrived.

### The genuine tension, and it is not a contradiction

*"Other people never log into your node — they connect as peers"*
(NODE-ARCHITECTURE.md). The device page looks like a violation: a browser
somewhere else signs in. It is not — a device is **the same person**, and
it does not reach the node at all. It reaches a relay, which posts to the
node, which decides. The rule survives intact, and the device arc is
arguably the cleanest proof of it in the system.

### What is unproven, and it is load-bearing

**A node is up around the clock.** Decision 0006 rests its entire answer
to *"this ends asynchronous messaging"* on that sentence:

> presence is the node's, not the human's. A personal node is on around
> the clock.

Nothing measures it. There is no uptime record, no alert, no history of
how often a node is actually reachable. The whole argument for deleting
store-and-forward is an availability claim with no evidence behind it, and
the traffic log shipped yesterday is the first thing in the tree that
could produce some — a day of `outcome:"refused"` entries is exactly the
number that argument needs.

---

## 2. "Relays are satellites" — the new claim, and it is testable

Tested property by property, because a metaphor that is 70% true is more
useful than one taken whole.

| a satellite… | today | evidence |
|---|---|---|
| does not read what it carries | **true** | the payload is opaque end to end; `packet.js` forbids `relay.js` from learning the envelope, and the device offer had to use the relay's own shape rather than an app packet because of it |
| you can see several at once | **true** | `presenceNode.js:6` — "one held connection to every relay it holds a row on, merged into one table". 🟢 means *any* relay says present. This is a constellation, already |
| anyone can launch one | **true** | `node js/server.js --relay`, first claim is owner (0003) |
| carries you the same wherever you are | **true** | the key is the identity; the label is per-relay display |
| stores nothing | **false** | the 200-entry `messages` ring (`relay.js:18`), and `invites.json` |
| does not know who you are | **false** | you must `claim`; `allow.json` decides whether you may |
| serves no pages | **false** | `relay.html` and the device pages are served by the relay (`server.js:123`) |

### The structural finding: routing needs no disk

This is the part worth keeping.

**Presence is RAM-only and always has been** — `presence.js:3`: *"never
written to disk — presence is true only while a socket is open, and
written down it is a record of something that has stopped being true."*

So the live routing path touches no persisted state to route. `routePost`
asks `presentNow.isPresent(target.id)` and `routes.open(...)`, and that is
the whole of the delivery. What it consults the persisted table for is
`deviceIdentity(token)` (`relay.js:748`) — which resolves the owner out of
`allow.json` and everyone else out of `routingTable.json`, and whose
answer, when the token is already a public key, is only **"is this key on
my roll?"**

That means the table is not routing information. **It is a membership
roll**, and its two jobs are naming (label → key) and authorisation (may
this key use this box). Decision 0006 spotted half of this already:

> A relay that routed strictly by public key would need no directory: a
> key cannot be impersonated without its private half, so the claim exists
> to reserve a *name*, not to prove an identity.

The satellite frame sharpens it into a choice that is now clearly a
product decision rather than a technical one:

- **A satellite** carries anybody in line of sight. No claim, no allow
  list, no roll. Labels become a purely local matter — which they nearly
  are already, since perception lives in the whoBook and is never
  uploaded.
- **A ground station** decides who may use it. That is what the box is
  today, and 0006 says the allow list *"cannot go … drop it and the box
  routes for anybody — which is a coherent thing to be, but it is a
  different product."*

I have no view on which Andy wants. I do think the frame makes it
impossible to leave undecided, and that the answer determines whether
`claim` survives at all.

### The relay serves HTML, which is neither routing nor a service

`relay.html` and `/<key>/device` are the relay acting as a **terminal** —
a third thing beside routing and services, and the one the satellite
metaphor has no room for at all. It is also plainly useful and the
alternative (a browser reaching a personal node directly) is worse. Worth
naming rather than resolving: satellites do not have a login page, and
this one does, on purpose.

---

## 3. "We are Peerlink" — and the boundary around renaming

Zero occurrences in the tree. It is a new name for something that already
exists, so the first question is what it names.

**The proposal: SpiritOS is the node, Peerlink is what nodes do to each
other.** That split is already how the code is organised — `spirit/run/js`
splits cleanly into the shell and kernel on one side and
`relay.js` / `hub.js` / `peerPost.js` / `presence*.js` / `router.js` /
`answerRelay.js` on the other — and it keeps VISION.md's "personal digital
soul" intact rather than renaming it.

### Free to rename: the words humans read

`natterDetails.json` name ("Mailbox"), `natter.json`'s stale description,
`peerPost.js:56`'s `var mailbox`, `relay-state/` on a personal node, the
prose in DICTIONARY.md. None of it crosses a wire.

### Not free: the wire

Two things would break every deployed relay the moment they changed, and
the tree already has a rule about exactly this — `spirit/test/packet.js`
forbids `relay.js` from learning the app envelope, on the grounds that
*"change the envelope and no relay in the world needs updating."* The same
logic protects these:

| on the wire | who depends on it |
|---|---|
| `mailboxPublicKey` in `/api/relay/who` | `answerRelay.js:89` — and it is **the load-bearing check** in the device path. A node verifies an enrolment offer by comparing its sender against this field |
| the `/api/relay/*` route names | every node's `hub.js`, every relay, `relayProbe.js` |

A node and a relay are two machines on different release schedules — we
watched exactly that cost land two days ago when spirit-3 ran one build
behind and a fixed bug appeared to still be there. Renaming the wire buys
tidiness and pays in a flag day.

**Recommendation: rename what humans read, freeze the wire, and write down
that the wire keeps an old word on purpose.** A fossil that is documented
as deliberate stops being a fossil. An undocumented one gets renamed by
somebody in six months who does not know what it costs.

---

## The contradiction the frame makes impossible to ignore

**Relay Chat still rides the store-and-forward ring, and polls it every
two seconds.**

- `relayChat.js:1189` — `setInterval(refreshInbox, 2000)`
- `relayChat.js:589` — `fetch('/api/hub/inbox?name=' + …)`
- `relayChat.js:1128` — `hubPost('/api/hub/send', …)`

So while the chat window is open, every node makes **30 requests a minute,
forever**, to fetch messages out of a 200-entry ring on a public box —
beside a transport that delivers peer to peer in **24ms on loopback and
125ms through spirit-3** ([TRANSPORT.md](../relay/TRANSPORT.md)).

Today I deleted a poll from the device path that ran **once a minute**.
This one is thirty times larger and still running, in the app a person
actually looks at. The device-panel document called the same load
unacceptable when it was one request a minute:

> A 2s timer that never stops is 30 relay requests a minute, forever —
> which is exactly the load that must stay microscopic.

Every claim in the new world view fails at this one place at once. A
satellite that keeps 200 of your messages is not a satellite. A person
whose words rest on somebody else's box does not own them. And "Peerlink"
names a peer-to-peer link that the flagship app does not use.

### What the migration costs, measured

| goes | lines | where |
|---|---|---|
| `relay.js` `send` | 99 | plus the `messages` ring and `MAX_MESSAGES` |
| `relay.js` `inbox` | 53 | |
| the inbox credential machinery | ~18 references | `inboxMessage`, `inboxSignatureOk`, `checkInboxKey`, `inboxSignatureFrom` |

0006 already says to *"retire it deliberately, not by neglect"* — that
machinery solved a real problem well and simply stops being asked its
question.

**The behavioural cost is one sentence and it is the whole decision:** a
message to a peer whose node is down is refused, at once, instead of
resting on the relay until they next look. 0006 accepts that on purpose.
The traffic log is now how you would find out what it actually costs
before committing — run both for a week and count the refusals.

**One thing genuinely does not survive the move and needs an answer
first:** `consoleExchange` (`relay.js:489`), the chat-to-relay console,
talks to the *relay as a party*. There is no peer at the far end to post
to. It stores nothing already, so it is not store-and-forward — but it
rides `send`, and retiring `send` without deciding what the console
becomes would take it out silently.

---

## Scorecard

**Already true, and can be claimed out loud:**

1. A node is one person, and nobody else can reach it.
2. Payload-agnostic relaying, proven end to end and defended by a test.
3. A person's identity is a key that travels; a label is local decoration.
4. Many relays at once, merged into one presence — a constellation.
5. Near-instant authentic round trips, measured: 24ms / 125ms / 365ms
   against 0–60s for what they replaced.

**True as of today, and new:**

6. No poll and no backstop anywhere in the device path.

**Not true yet, in the order the frame makes them urgent:**

7. **Chat rides `post`, not `send`/`inbox`.** Everything else on this list
   is small; this one is the world view.
8. The `messages` ring is deleted. Follows from 7.
9. `invites.json` — the last non-routing state. 0006 has the stateless
   form already worked out and priced (the owner signs a grant bound to
   the invitee's key); the cost is a real change to the human flow, and
   it is a decision rather than a task.
10. `relay-state/` renamed on a personal node.
11. The words humans read stop saying "mailbox".

**Decided elsewhere, not by this review:** whether a relay keeps a
membership roll at all (§2) — satellite or ground station. It changes
whether `claim` and `allow.json` survive, and it is a product question.

**Unproven and load-bearing:** node uptime (§1). Everything in 7–9 rests
on it and nothing measures it.

---

## Housekeeping found on the way

- [0006](../decisions/0006-fast-and-true-not-guaranteed.md) says **"Not
  yet implemented"** and *"Implementation unscheduled"*. Both are now
  false — it is implemented on the routing path and on the whole device
  path. Its status line should say what is done and what is left, or the
  next reader will re-derive it.
- `relayProbe.js`'s surface list is how you tell a stale relay from a
  current one. `/api/relay/device-pending` came off it today; if that
  distinction is wanted deliberately it should be a named "retired routes
  must 404" check rather than an absence.
- `AGENT.md` still says *"A **public relay** (`--relay`) is a mailbox."*
  It is the first definition a new agent reads.
