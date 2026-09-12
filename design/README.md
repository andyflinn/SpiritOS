# SpiritOS Design & Architecture

This directory contains the vision, principles, and architecture decisions for **SpiritOS** — the sovereign personal operating system for your digital spirit.

## Core Principles
- [Node Architecture Principles](principles/NODE-ARCHITECTURE.md)
- [Storage Philosophy](storage/STORAGE-PHILOSOPHY.md)

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
  — **OPEN.** Implements 0008. Five requirements, none built: the two `/api/fs/`
  doors and their handling code, the absolute refusal that replaces them, three
  test specimens that must outlive their subjects, and the two apps.
- [2026-09-12 — transport, below the node boundary](cycles/2026-09-12-transport-below-the-boundary.md)
  — **OPEN.** Eight requirements, none built. What "complete compliance" costs:
  four connections and one deletion. The deletion is easy; the first connection
  does not exist — the router has no arrival interface, and the shell's packet
  fan-out is fed by Relay Chat's poll, the app the cycle exists to retire.
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

## Andy's frames
- [The POST API — route hierarchy](andy/spiritNodeAPI.md) — every POST route
  both servers dispatch and the function it lands in. Illustration only.

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