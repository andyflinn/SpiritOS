# SpiritOS Design & Architecture

This directory contains the vision, principles, and architecture decisions for **SpiritOS** — the sovereign personal operating system for your digital spirit.

## The door

- [The door — what a program may ask this node to do](protocol/THE-DOOR.md)
  — **the contract**, and the thing this project is actually for: a local
  HTTP port that any language can post to. 36 verbs, the limits, the
  rates, and what the relay cannot do. Every figure on it is checked
  against the running tree by `spirit/test/doorContract.js`, and the page
  names its own gaps — the two worked examples beside it are not
  RUN by the harness, no per-verb
  arguments, no stated version.

## Core Principles
- [Node Architecture Principles](principles/NODE-ARCHITECTURE.md)
- [Puppets — what an app is, who may use it, and who may change that](principles/PUPPETS.md)
  — **the rules**, 2026-09-25, from the sitting that built the first two:
  a puppet is a node owned by another node, with contacts of its own that
  only its master may write. Two gates, not one; no face by default;
  absent means nobody; membership is the channel and the grant is the
  face. Fourteen decided, two recommended, six open — kept apart so a
  recommendation is not cited as a ruling.
- [A shape that crosses is made by a factory](principles/A-SHAPE-THAT-CROSSES.md)
  — **the rule**, 2026-09-25: any object passed around, posted or
  received comes from a factory that validates in itself, carries
  serialize/deserialize, and where **neither succeeds on invalid data**.
  A refusal is a VALUE, not a throw. Not the deleted type system — that
  was schema as data; this is one artifact where construction IS the
  validation. The factory owns the shape; the verb owns the content.
  Governs objects that never cross a door at all, which is why it is a
  principle and `THE-DOOR.md` is its consumer.
- [The layers — a node, its one app, and what it declares](principles/PUBLIC-APP-LAYERS.md)
  — **the picture**, drawn 2026-09-24: a node serves exactly ONE intrinsic
  app, and the shell is an instance of that rather than an exception.
  Two layers, the second optional; publicness is a deployment fact and
  not an architectural axis. The argument is in
  [the design](shell/PUBLIC-APP-SERVER.md); this is the diagram.
- [The public app server — and `join` as its first app](shell/PUBLIC-APP-SERVER.md)
- [The face round trip — browser to app-server process and back, step by step](shell/FACE-ROUND-TRIP.md): each step, the code that does it today, and what is owed
- [Andy's UI to the agents app](shell/AGENTS-UI.md): a real app, ahead of the shell gate and outside alpha
  — **approved 2026-09-24, nothing built.** Thirteen boundary
  requirements (G1-G13), five reconciliations between the agents and no
  divergences, and the four readiness findings that came from asking the
  other agent what he would refuse to be handed. Its purpose, in Andy's
  words: *"delieating all the mandatory and optional boundaries and
  layering, so our join-app doesn't have to be retro-fitted forever as
  the system evolves."* **Approval is not a packet** — a build needs its
  own.
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
  behind 0012 and the roll eradication, and what decides presence
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
  permanently, and the roll published it — so an invite labelled with a phone
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
  it is built. One cheat stands named: the roll.
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
  roll a cheat, condemns `streamRoster`'s member list with it, and settles
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
  tree ships `false`, guarded by a roll the way `oneDoor.js` guards
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

## Reviews
- Periodic point-in-time assessments of status against vision. See [reviews/](reviews/).
- [Peerlink — the system reviewed against its own world view](reviews/2026-09-12-peerlink-world-view.md)
  — "nodes are people, relays are satellites, and we are Peerlink", tested claim
  by claim against the tree. One third of it is the oldest principle in the repo;
  one third is new and measurably ~70% true; one third is a name with a hard
  boundary around it. The finding that outranks the rest: Relay Chat still polls
  a 200-entry ring on the relay every two seconds.
- [What a local model is good for, measured on a night of it](reviews/local/LOCAL-MODEL-REVIEW.md)
  — gpt-oss:120b read 47 files unattended in fifteen hours and returned 242
  findings, untriaged. It held its format, marked its own uncertainty, and read
  AGENT.md — and it also FABRICATED, reporting a typo that is not in the file.
  It proves work CAN be delegated to a local AI; it also changes what we would
  delegate. Breadth with a checkable answer, not review, where a confident wrong
  answer looks exactly like a right one. The run is kept whole in the zip.
- [Local model performance history](reviews/local/MODEL-HISTORY.md)
  — one appended row per run, so we learn and track WHICH model is useful for
  WHAT rather than whether local models are any good. The two columns that
  decide it are fabrication and triage cost: GPU hours are nearly free,
  attention is not. One cell of the matrix is filled.
- [Close: desk/G2 and desk/G3](desk/G2-G3-CLOSE-REPORT.md) — the first SpiritOS
  close sourced from Desk's own records. Fourteen items, each tested before it was
  built and by the other agent. Five defects still reached Andy's screen past a
  green harness, because the suites mounted Desk on fakes that answered as their
  authors assumed.
- [Close: goal/G4, the chatClerver and chatter](chat/G4-CLOSE-REPORT.md) — a
  peer-to-peer chat server and its face in a day, with the contact label, the peer
  pane and fieldRules.js made on the way. The same lesson as desk/G2-G3, met again:
  a fake server that took short asks let chatter ship asks the real one refused;
  the fakes now read the real verbs' keys.

## Future Layer (not yet implemented)
- [Root Structure — spirit.json](spirit-json/ROOT-STRUCTURE.md)
- [Compound Request & Transform System](transforms/COMPOUND-REQUEST-SYSTEM.md)

## Archive
- Superseded design thinking, kept for the record rather than as current
  or planned direction — see [archive/](archive/).

## Other
- More documents will be added as we progress.