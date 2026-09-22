# SpiritOS Design & Architecture

This directory contains the vision, principles, and architecture decisions for **SpiritOS** — the sovereign personal operating system for your digital spirit.

## Core Principles
- [Node Architecture Principles](principles/NODE-ARCHITECTURE.md)
- [A node and a relay are two different things](principles/NODE-AND-RELAY.md)
  — **co-design, nothing built.** The node is a person, readable and
  inspectable; the relay is infrastructure that owes its owner *an account
  of itself*, not a readable disk. **Amended 2026-09-19:** box bounds
  configuration bounds Governor; every persisted dataset is bounded by disc;
  every lever declares floor and ceiling. The Governor is programming alone —
  the owner's only live tools are signed grants (inject a partner, mint an
  invite). A partnership needs both owners' signatures, lives as a row in one
  partner roll, and ends silently; the old peer-row model is deprecated.
  Routes are the node's, on contacts, as relay IDs — the relay keeps no route
  cache, and 0012's "never persisted" stands. The owner never duplicates
  member storage. **Limits exist only where a resource runs out:** hard
  floors, no hard ceilings, shares recomputed as members connect, a fixed
  owner reservation. The first claim needs an invite, minted by an installer
  over SSH. **Build sequence — scaffolding before optimization:** cycles 0
  (startup split) and 1 (config, allowance, one-lever Governor) done; then
  2 route hints end to end (**locked in, next**), 3 SQLite plus the owner
  token and installer, 4 the owner's visual monitor, 5 partner acquisition;
  shares, DISC and Governor tuning after. Open: version tolerance, what
  "capable of partnership" is checked against, recoverable expiry, the
  group post, and the open lever bounds.
- [The requester is responsible for the question](principles/THE-REQUESTER-IS-RESPONSIBLE.md)
  — *"the more specific my question, the more precise the answer."* A vague
  question earns a bounded answer or none, never everything. The reason
  behind 0012 and the census eradication, and what decides presence
  scoping.
- [A limited resource is released before it is claimed](principles/LIMITED-RESOURCES.md)
  — *"it's like member slots, you must evict before adding new ones."* A full
  resource refuses and names the obstruction; the holder releases first, and
  the system never frees on anybody's behalf. Behind the full-relay refusal,
  the shrink refusal, 0021's cache cap, and two relays sharing one box.
- [Storage Philosophy](storage/STORAGE-PHILOSOPHY.md)
- [A correspondent that is not a person](principles/A-CORRESPONDENT-NODE.md) —
  **sketch, nothing built.** A node whose `answer` hook is a model rather than a
  human, and what falls out: two sovereign logs holding the same packet under the
  same hash, reconcilable without a shared store. Adds no mechanism — the seam,
  the credential path and `re` all exist — but it changes why R16 is worth doing,
  from hygiene to the product. Says plainly that a corpus is not a model.
- [Agents post to each other, node to node](agents/AGENTS-POST-TO-EACH-OTHER.md) —
  **design, 2026-09-22.** The two Claudes coordinate through their SpiritOS nodes,
  as a real app outside the shell: `app: "agents"`, `note` / `ask` / `answer`,
  answers as new posts carrying `re`, both nodes' traffic logs as the record.
  Andy: *"connect through that."* Open: a node per agent, so the signature says
  which agent spoke.
- [Grok reviews — through the node, on a budget Andy grants](agents/GROK-REVIEWS.md) —
  **decided and built, 2026-09-22.** A review is agent work; Andy gets decisions.
  A thread per review with a message cap in his words; the node holds the key
  and fills it in for `api.x.ai` only; exact cost recorded per message.
- [The proxy — `net.fetch`, and the keys it carries](proxy/THE-PROXY.md) —
  **design sitting, opened 2026-09-22.** Who may use which key, where the rules live
  (an intrinsic app, Andy), how long and how big a call may be, and what it cost.
- [Considerations for early products](products/CONSIDERATIONS-FOR-EARLY-PRODUCTS.md) —
  **ideas, not plans (2026-09-22).** A VS Code plugin for developers far apart; developers
  joining spirit.andyflinn.com instead of running a relay; and end-to-end encryption
  between nodes as the precondition — the relay would carry only sealed text.

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
- [2026-09-19 — the first Governor](cycles/2026-09-19-relay-governor-cycle-1.md)
  — **CLOSED as a checkpoint.** 7 requirements: 5 done, 2 deferred by the
  build sequence. The relay's first configuration (a RAM
  ceiling, bounded by the box), one lever (the connection allowance, owner as
  its floor), one remedy (close the longest-idle streams), each move reported
  with its reason on the existing owner report — no new word on the wire.
  Proven on two relays with two owners confirming each other. Deferred: the
  panel Andy looks at (to cycle 4, the visual monitor) and the live run (to
  optimization).
- [2026-09-19 — route hints end to end](cycles/2026-09-19-route-hints-cycle-2.md)
  — **CLOSED.** 7 requirements, all done. The first scaffolding cycle: signed
  route hints beside the packet, the relay choosing one partner (live, then
  minted, else "minting incomplete"), contacts keeping relay keys in
  `routes`, proven routes announced as keys, and nothing tunnelled that
  cannot survive the tunnel, in both directions; errors from the far side
  travel down the chain to the asker, signed by the relay.
- [2026-09-19 — the relay's data on disc, and the owner's token](cycles/2026-09-19-disc-and-owner-token-cycle-3.md)
  — **CLOSED.** 16 requirements, all done. Part A: members, invites and the
  partner roll are in `relay.db` (node:sqlite), and RAM is its client: 10,000
  members cost about the heap of 10. Every operation is by key; no roster is
  served, so the relay broadcasts and the node filters. Search does not block,
  and goes to live partners only; a member answering a request a partner
  carried in learns the route back; the shutdown is proven on the wire. Part B:
  the first claim needs the owner invite that `install.js` mints over SSH (0003
  amended), and a relay with members but no owner refuses to start (exit 78,
  reported by `bash/restart` and `bash/update`). `open` mode, pending-owner and
  the Procfile are gone.
- [2026-09-22 — a relay bounded by its disc, and set over the wire](cycles/2026-09-22-relay-bounds-cycle-9.md)
  — **BUILT.** No relay runs on an implicit figure: the default is half the
  box capped at 256 MB, the ceiling is what the box can *give* at startup
  minus a margin, and a first start writes the file it measured.
  `discLimitMB` bounds the roll; a claim past it is refused and nobody is
  evicted. The owner reads and sets both figures from his own node — a
  signed packet, no new door — and may ask for the restart that applies
  them, which checks systemd's actual policy before promising. Verified on
  Linux against real cgroup caps. Left open: applying it to the two live
  relays, lab first, since they share a box.
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
  dying and cheats. **Amended 2026-09-18**: naming a cheat is not a resting
  state — identify, **plan**, eradicate, and the plan is written before any of
  it is built. One cheat stands named: the census.
  `spirit/test/protocolSurface.js` goes red if the tree holds a door the register
  does not, or the register names one the tree has lost.

- [0011 — The hash is computed, never carried](decisions/0011-the-hash-is-computed-never-carried.md)
  — a post carries no hash and no correlation id. Every party derives it from the
  signed bytes it holds, and it crosses the wire once: inside the responder's
  signature on the reply. Correlation and proof are the same number, which is why
  a forwarder cannot fake either. Also the browser's position — it has no key,
  cannot verify, and the hash is the one thread it has back to what it caused:
  on the immediate reply, and as `cause` on a streamed owner event.

- [0012 — A relay never asks for a member list](decisions/0012-a-relay-never-asks-for-a-member-list.md)
  — not refused, **absent**: there is no verb by which one relay can ask another
  for its members, so the partner vocabulary is two words, `search` and
  `forward`. Nobody needs it once A says *"forward this to your member K"*
  rather than routing to K, and once the node supplies the route. It deletes the
  `partners × members` term outright — 46 MB at a hundred partners of a
  thousand, on a 1 GB box, becomes **zero** — and makes *"a relay never persists
  a partner's members"* structural instead of a policy somebody has to remember.
  **Widened 2026-09-18**: nobody is *served* one either — not a stranger, not a
  member, not the owner, not by request and not by broadcast. Which names the
  census a cheat, condemns `streamRoster`'s member list with it, and settles
  that owning the box does not make an enrolment list necessary.
  The line that matters: a relay's memory stops being a function of decisions
  other people make. Cost is latency on a cold post, in the fallback mode the
  shedding policy already called safe.

- [0013 — A relay is fixed-cost per time-unit](decisions/0013-a-relay-is-fixed-cost-per-time-unit.md)
  — the invariant that turns out to be the reason for most of the others: a box
  costs the same per month whether the mesh holds ten peers or ten million, so
  the test for any proposal is *does this make a relay's cost a function of
  anything other than time?* Growth lands on **nodes**, where each person pays
  for their own — **the network's durable memory lives in nodes; relays are
  fast, ephemeral, and re-primed by the nodes they serve.** The owner's
  incentive to externalize cost points the same way, bounded by *externalize
  memory, never service — to the demanding node, never to a peer relay.*
  Exposes a live defect: `streamRoster` ships the full member list to every
  member on every connect, 19 KB past `PAYLOAD_MAX` at 190 members, and the
  presence broadcast is `members × changes`. Carries the `about:[keys]`
  mechanism that answers routing and presence in one call, and the precise
  amendment 0012 needs.

- [0014 — Deprecations expire at releases](decisions/0014-deprecations-expire-at-releases.md)
  — code that only reads or converts an older format is marked with an
  expiry release. At every official release each expired one gets a risk
  assessment and is eliminated or kept, recorded; a release with an expired
  deprecation and no decision does not ship. The register is
  [DEPRECATIONS.md](DEPRECATIONS.md); `spirit/test/deprecations.js` keeps
  markers and rows in step, and `--release <name>` is the gate.

- [0015 — The owner watches a lever; the programme moves it](decisions/0015-the-owner-watches-a-lever-the-programme-moves-it.md)
  — the Governor is the result of programming, so the loop is observe →
  record → analyse → reprogram and the owner's hand enters it between
  cycles, not at runtime. A lever declares `settable` (every lever in the
  tree ships `false`, guarded by a census the way `oneDoor.js` guards
  reaches) and `worseAt`, because a green-to-red meter asserts a direction
  of badness an app that names no lever cannot know. Cycle 4.1's owner
  verb is kept dormant rather than deleted: a proven seam, not a
  temporary shape.

- [0016 — A relay's capacity is its membership](decisions/0016-a-relays-capacity-is-its-membership.md)
  — the request budget stops being chosen constants and becomes a
  function of one configured bound: `MAX_MEM` → member roll size → routes
  in flight → request RAM. Caps of 1 in both directions, requester
  classes separated, a node that queues rather than fails, and rolls
  bounded by age as well as space. Supersedes `DEFAULT_MAX = 256` and
  `DEFAULT_PER_REQUESTER = 16` — whose product is exactly 4 MB, sized
  against memory by somebody and then written as slot counts so the
  reasoning vanished. Working note:
  [REQUEST-BUDGET.md](relay/REQUEST-BUDGET.md).

- [0017 — The core design supersedes, and is healed before the periphery](decisions/0017-the-core-design-supersedes-and-is-healed-before-the-periphery.md)
  — the relay design outranks earlier decisions **before it is built**,
  because building against rules already known to be wrong then has to be
  unbuilt. And a flaw found in the core from the periphery stops the
  peripheral work: the core is fixed, documented and pushed reconciled
  first. Amended the same day — a decision does not merely note beside a
  rule it obsoleted, it **strikes** it, in place, saying what replaced it.
- [0018 — The route cache belongs to the machine, not the human](decisions/0018-the-route-cache-belongs-to-the-machine.md)
  — a node's readability rule covers what its owner acquired, not what
  the network produced. The line is not the box, it is whose information
  it is; `server.js` is the exemption that always existed and was never
  named. So `routes` leaves the contact row (base64 relay keys nobody has
  ever read) and the shadow may be stored in whatever shape serves the
  machine.
- [0019 — A public label is broadcast at every level, and presence is last-known](decisions/0019-a-label-is-broadcast-and-presence-is-last-known.md)
  — two rulings. A rename fans out to **every** relay the person is a
  member of and each relay broadcasts it to its members: the cheapest
  broadcast there is, because a rename is rare, durable and unobtainable
  any other way. And presence stops being a claim about now — *"present,
  as of this row's last update"* is true for ever, so the shadow dates it
  and a stranger's mark comes from the node's own traffic rather than any
  new broadcast, including the `503 peer not reachable` that was being
  thrown away. Obliges one thing: last-known is only honest if the age is
  visible.

- [0020 — The node's machinery is not a client surface](decisions/0020-the-machinery-is-not-a-client-surface.md)
  — the shadow roll and the request scheduler stay opaque: no verb, no
  route, no app surface. Andy: *"if the harness can assert the proper
  functioning of the machine, I want shadow-roll and request-scheduling to
  remain invisible to the client... or else we propagate more complexity
  into shell and its harness."* The line it draws: **a value may cross, a
  structure may not** — a presence dot and its age, yes; the row, the
  queue depth, the backoff timer, no. Settles that patience is an owner's
  node setting rather than a per-post argument from an app.

- [0021 — Choosing is a mark on what the machine remembers](decisions/0021-choosing-is-a-mark-on-what-the-machine-remembers.md)
  — the node remembers every peer it meets, and forgets only for space;
  the list is a mark on that memory, and the mark is the protection. Shed
  in order: unchosen, ignored and blocked, held — never added; a full
  memory refuses the next add. Andy: *"ignoring means only: mark this row
  as "ignored"."* Behind the verbs that exist; no new interface.

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
- [Everything is a post](relay/SURFACE.md) — the case that 0010's three granted
  GET exceptions can all go: the key arrives with the row, `version` is a file,
  and the stream becomes `stream.initialize()` / `stream.close()` — an ordinary
  peerPost whose reply is the channel it created. Leaves the protocol statable
  without naming a transport, which is the point. Design, nothing built.
- [The relay as a router](relay/ROUTER.md) — a peer drops a packet on a peer
  and gets a signed receipt. Decision 0006 implemented, plus the receipt.
- [Partner relays](relay/PARTNERS.md) — *"if you can verify a peer, and we can
  verify each other, then I can verify your peer."* One hop between two relays
  and no further, so the trust stays inspectable. Shape agreed, nothing built;
  decided, recommended and open are kept apart. **Tier three (2026-09-16)**
  adds the public record: why a relay publishing a peer's self-description is
  a register rather than a custodian and so does not touch 0006, why the
  search row stays closed at key/label/present, and why procuring a
  description on selection proves the route a post will take.
  **Status at 9110393 (2026-09-17)** supersedes the "nothing is built"
  header: partner streams and fanned search are built, and the four gates
  that still refuse a packet across a partnership are named with their
  lines — plus Andy's ruling that a relay vouches only for *"the fact
  that they are verified by a trusted partner"*, and that vouching is what
  a partnership consists of rather than an extra grant.
- [A member's request budget — announced, and honoured](relay/REQUEST-BUDGET.md)
  — a relay tells its members nothing about what they are allowed, so a
  node learns its limits by being refused; and `peerPost` has no queue, so
  a refusal is a failure rather than a wait. The bound that matters is not
  even configurable: `DEFAULT_PER_REQUESTER = 16` with
  `createRouter()` called with no options. Concurrency x bytes x duration
  is the RAM a router costs — 4 MB at the table cap, reachable by sixteen
  members — which makes requests-in-flight a lever beside `connections1`
  and `requestTimeout1`, on the same axis and multiplying.

- [The Relay Monitor](relay/RELAY-MONITOR.md) — **for approval, screen work
  only.** What an owner watches and what he may not touch: the two bounds
  with `binding` saying which is nearer and the 70% warning against that
  one; the member curve from the node's own record; a live traffic console
  filtered at the relay, in the shape of the jobs app's log panel; the
  configuration readable but not settable. Supersedes §4 of NODE-AND-RELAY,
  which cycles 8 and 9 made false in four places — recorded there rather
  than deleted.
- [A relay governs itself by what it can observe](relay/CAPACITY.md) —
  **first cut, nothing built.** Andy: *"a relay's capacity is primarily
  governed by its own RAM and by its network bandwidth."* If that is true a
  relay can *measure* its capacity, and a measured limit beats a typed one.
  Two units are two limits (RAM is a stock, bandwidth a flow); the ceiling is
  discovered from throughput-against-latency rather than declared; the floor
  is a requirement in units of work rather than a number; the value is
  streamed and in force until superseded. Records the measurement that
  prompted it: **`routePost` has no rate limit at all** — `rateOk` has two
  call sites, and neither is posting.
- [The shadow peer list — its structure, and what feeds it](relay/SHADOW-PEER-LIST.md)
  — **designed, nothing built.** The companion to WHAT-A-NODE-KNOWS: what
  shape the row is, and which relay events earn a broadcast. Extracts
  **rank first, recency second** — the shadow keeps the last thing said
  rather than the best-sourced thing, so a second-hand search answer
  overwrites a rename from the peer's own relay. Finds the eighth discard,
  the largest by volume: `presenceNode.js:181` drops a presence event about
  a stranger and the URL it arrived on with it — the highest-authority
  route in the system, arriving free, for every member of every relay this
  node is on. And finds that `peer-renamed` and `claim` already fire and go
  to the **owner alone**, though 0012 as corrected licensed them for every
  member in Andy's own words. Carries the arithmetic that bounds the
  instinct: a broadcast is O(members) per event, so the events that earn one
  are the rare, durable ones — which is the set currently not broadcast.
- [Collaborative route discovery, on demand](relay/ROUTE-DISCOVERY.md) —
  **designed, nothing built.** Andy: *"as fundamental as proper tunnelling, with
  a higher cost impact"* — the tunnel decides whether a packet crosses; this
  decides what every discovery costs for as long as the network runs. A node
  asks only relays it is bound to, sending the keys it lacks routes for **and
  the tuples it already holds**, so the relay answers its own members locally,
  culls tuples for relays it does not partner with, and fans out only the
  remainder. Collaborative because neither end has the answer and both keep it —
  and because a rebooted relay is re-primed by its members rather than by a
  disk. Carries the arithmetic that forces a by-reference reply (nine keys per
  call by value, ~330 by reference), and names the load-bearing open ones: a
  partner that lies about holding a key can harvest one packet per lie, and
  negative results need a lifetime or every post to an unroutable contact is a
  fan-out for ever.
- [What a node knows about a peer, and where it keeps it](relay/WHAT-A-NODE-KNOWS.md)
  — **planning, and most of it built at `7806b3d`.** One rule: *"a node
  learns a route at every opportunity, and policy never gates the
  learning."* Andy: *"Any peer a node could possibly connect to, the route
  to it can be known to the node."* Seven places were holding the answer
  and discarding it — a search kept the URL and dropped the key, an
  arriving packet learned nothing, siblings on one relay announced
  nothing to either end. It lands in a **shadow** keyed by peer
  (`seenPeers.js`): not the contact book, not a duplicate of a member
  roll, *"like a browser's cache… it tracks the node's traffic with the
  contacts IT knows"* — it may guess, may never assert, and has no reader
  outside the node. Carries `0018` (the route cache belongs to the
  machine, so `routes` leaves the contact row with the store), and keeps
  open: label-key tuplets on the wire, cache-first search, and
  `MAX_AGE_MS`. **Read before ROUTE-DISCOVERY.md below**, which it
  reorders rather than contradicts.
- [One object, three densities](shell/OBJECT-PRESENTATION.md) — the UI half of
  the same sitting. Dropdown, selector surface and tooltip as three densities
  of one object; label is what it calls itself, description is what you say
  about it. Source material for a future `UI_DESIGN_STYLE.md` §11, which is
  Andy's to write.
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