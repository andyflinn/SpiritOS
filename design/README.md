# SpiritOS Design & Architecture

This directory contains the vision, principles, and architecture decisions for **SpiritOS** — the sovereign personal operating system for your digital spirit.

## Core Principles
- [Node Architecture Principles](principles/NODE-ARCHITECTURE.md)
- [Storage Philosophy](storage/STORAGE-PHILOSOPHY.md)
- [A correspondent that is not a person](principles/A-CORRESPONDENT-NODE.md) —
  **sketch, nothing built.** A node whose `answer` hook is a model rather than a
  human, and what falls out: two sovereign logs holding the same packet under the
  same hash, reconcilable without a shared store. Adds no mechanism — the seam,
  the credential path and `re` all exist — but it changes why R16 is worth doing,
  from hygiene to the product. Says plainly that a corpus is not a model.

## Spring Cleaning
- [Morituri Te Salutant — Execution Roadmap](cleanup/MORITURI-TE-SALUTANT.md)
- [Icon convention](cleanup/2026-09-11-icon-convention.md) — what the circles
  fixed, and what is still outstanding repo-wide.
- [The live surface has no tests](cleanup/2026-09-11-live-surface-tests.md) —
  the harness proves logic in process and has never seen TLS, Caddy or a held
  connection. Presence is the first thing that depends on all three.
- [A scenario is a scenario](cleanup/2026-09-11-scenarios-and-suites.md) — one
  vocabulary read by two builders, so the world a suite explores and the world
  Andy looks at cannot drift apart. Plus `npm test`, and the four bugs the
  refactor found that were not failing.
- [labMaster](cleanup/2026-09-11-labmaster.md) — the control plane that runs a
  little network of fake nodes on one laptop, `labPopulate` for building a whole
  world from a scenario in one command, and the four things both learned the
  hard way.

## Cycles — what was agreed, and how it is known to be done
- [The method](cycles/README.md) — an agreement becomes a requirement the moment
  it is made, and a requirement is not done until something verifies it. Written
  after a confinement Andy and Claude had settled in detail was reported as part
  of a green sitting it was not in.
- [2026-09-12 — the device, and a node defending itself](cycles/2026-09-12-device-and-node-defence.md)
  — **OPEN.** 16 requirements: 10 done, 2 deferred, 4 still open.
- [2026-09-12 — app-building removed](cycles/2026-09-12-app-building-removed.md)
  — **CLOSED.** Implements 0008. Both `/api/fs/` doors gone, the refusal they
  were exceptions to now absolute, three test specimens re-pointed before their
  subjects were deleted.
- [2026-09-12 — transport, below the node boundary](cycles/2026-09-12-transport-below-the-boundary.md)
  — **OPEN.** 16 requirements, 13 done. The router had no arrival interface and
  the shell's packet fan-out was fed by Relay Chat's poll; both are fixed, the
  console is gone, the relay reports its own condition, and the log is permanent,
  append-only and readable as a table. The ring itself went on 2026-09-15 (R8).
  Left: an app being able to reply, and the log being able to prove what it
  claims.
- [2026-09-15 — labels are not identities](cycles/2026-09-15-labels-are-not-identities.md)
  — **CLOSED.** 3 requirements, all done. Peer-by-key settled that identity is a
  key and stopped halfway. The relay owner chose every peer's public name,
  permanently, and the census published it — so an invite labelled with a phone
  number published that number; now the invite label proves and the claimer
  names themselves. Claims, mints, revokes and removals reach the owner's log,
  to the owner's sink alone and bounded by the rate gate — the relay's only
  event channel used to carry traffic, which 0006 forbids it to keep, and
  nothing about membership, which the owner is entitled to. And the owner badge
  is gone: it signed a *name* to prove a *key*, so `/api/relay/status`,
  `statusMessage` and `checkOwner` went with it — which answers decision 0010's
  last open question by removal.
- `spirit/test/cycleRequirements.js` goes red if any requirement has neither a
  verification that exists nor a recorded deferral.

## Decisions
- Dated Architecture Decision Records — why a specific technical choice was made, not
  just what it is. See [decisions/](decisions/).
- [0006 — Fast and true, not guaranteed](decisions/0006-fast-and-true-not-guaranteed.md)
  — a relay delivers or refuses, and stores nothing. Changes what a relay *is*.
- [0007 — A relay survives and earns its keep](decisions/0007-a-relay-survives-and-earns-its-keep.md)
  — a relay is a box that must justify its own cost. Settles satellite-vs-ground-station
  from the Peerlink review (ground station: the roll is the ledger), and retires the
  byte-counting it nearly became — packaging is a deployment problem.
- [0008 — App-building is out of scope](decisions/0008-app-building-is-out-of-scope.md)
  — production code is written in VS Code. App Builder and Type Designer go, and
  with them the two doors through which a browser can write an app's own code.
  Withdraws 0004 entire; 0003's manifest protection becomes structural rather
  than enforced.
- [0009 — Memory is the training set, and it stays readable](decisions/0009-the-log-is-the-training-set.md)
  — the node's record of what it experienced is substrate, not diagnostics. Adds
  no rule: it records why STORAGE-PHILOSOPHY's existing one is worth more than it
  looked, and corrects a drift toward "files now, a database when reads get slow".
  Files in the core indefinitely; a database is a plugin; an enterprise fork is
  where a different answer may live. Also records the gap it exists for — the log
  holds what crossed the WAN, and experience is larger than that.

- [0010 — If the protocol cannot carry it, stop](decisions/0010-fix-the-protocol-or-name-the-cheat.md)
  — no code until it is decided: fix the protocol, name the cheat, or do not do
  the thing. Narrowed to the two shapes a new way of speaking has in this tree —
  a new `<verb>Message()` and a new `/api/relay/*` route — so most work is
  untouched. Carries the register of all 24, sorted into protocol, bootstrap,
  dying, and **five named cheats**, one of them a day old.
  `spirit/test/protocolSurface.js` goes red if the tree holds a door the register
  does not, or the register names one the tree has lost.

- [0011 — The hash is computed, never carried](decisions/0011-the-hash-is-computed-never-carried.md)
  — a post carries no hash and no correlation id. Every party derives it from the
  signed bytes it holds, and it crosses the wire once: inside the responder's
  signature on the reply. Correlation and proof are the same number, which is why
  a forwarder cannot fake either. Also the browser's position — it has no key,
  cannot verify, and the hash is the one thread it has back to what it caused:
  on the immediate reply, and as `cause` on a streamed owner event.

## Andy's frames
- [The POST API — route hierarchy](andy/spiritNodeAPI.md) — every POST route
  both servers dispatch and the function it lands in. Illustration only.
- [What each server would depend on, separated](andy/NODE_AND_RELAY_DEPENDENCIES.md)
  — a relay loads 22 modules and uses 11; 4,257 lines of node code sit on the
  public box unreached, `trafficLog.js` among them, held off by one boolean.
  Three modules are the entire shared surface. Measured at `e647e60`, with the
  method to re-derive it.

## Relay
- [Peer Devices](relay/PEER-DEVICES.md) — every identity attaching its own
  browsers. Designed, not built; the owner-only version shipped as device
  cycles 1–5.
- [What a device is](relay/DEVICE.md) — a node-shaped thing with a temporary key
  instead of an identity, no disk, and exactly one correspondent: its own node,
  which acts on its behalf and hands back the result. The relay holds the pairing
  in RAM and may never publish it. Design only, and it supersedes the device model
  in the two documents below. §6 is the red button, which this architecture
  reduces to a local write; **§7 is future layer and depends on nothing above it.**
- [The "Add one of my own devices" panel](relay/DEVICE-PANEL.md) — the surface
  in Natter for attaching a browser. **§1–7 superseded on 2026-09-12** and kept
  as the record: a switch, a poll, four states and a rendezvous rule, every one
  of them a consequence of the poll rather than of the feature. §8 is what
  stands — a copy button, a shortened link, and a paragraph.
- [The transport, and what it has been shown to do](relay/TRANSPORT.md) — one
  mechanism now carrying peer-to-peer, relay-to-node and browser-to-node alike:
  the measurements, and an explicit list of what has *not* been proven.
- [The relay as a router](relay/ROUTER.md) — a peer drops a packet on a peer
  and gets a signed receipt. Decision 0006 implemented, plus the receipt.
- [Partner relays](relay/PARTNERS.md) — *"if you can verify a peer, and we can
  verify each other, then I can verify your peer."* One hop between two relays
  and no further, so the trust stays inspectable. Shape agreed, nothing built;
  decided, recommended and open are kept apart.
- [The data architecture behind a verified ping](relay/ROUTER-PACKETS.md) —
  the same thing as a reference: every field on the wire, in plain English,
  with real bytes generated by the running code.
- [Presence](relay/PRESENCE.md) — the first cut of that wire, carrying who is
  reachable and nothing else. Staged, and the precondition for decision 0006.
- [The relay doorbell](relay/EVENT-STREAM.md) — one held connection per identity
  instead of polling. The destination; PRESENCE.md is the route to it.

## Reviews
- Periodic point-in-time assessments of status against vision. See [reviews/](reviews/).
- [Peerlink — the system reviewed against its own world view](reviews/2026-09-12-peerlink-world-view.md)
  — "nodes are people, relays are satellites, and we are Peerlink", tested claim
  by claim against the tree. One third of it is the oldest principle in the repo;
  one third is new and measurably ~70% true; one third is a name with a hard
  boundary around it. The finding that outranks the rest: Relay Chat still polls
  a 200-entry ring on the relay every two seconds.

## Future Layer (not yet implemented)
- [Root Structure — spirit.json](spirit-json/ROOT-STRUCTURE.md)
- [Compound Request & Transform System](transforms/COMPOUND-REQUEST-SYSTEM.md)

## Archive
- Superseded design thinking, kept for the record rather than as current
  or planned direction — see [archive/](archive/).

## Other
- More documents will be added as we progress.