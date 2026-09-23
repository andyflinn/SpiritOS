# Cycle 9 — a relay is bounded by its disc as well as its RAM, and its owner sets both over the wire

**Built 2026-09-22, from `0bf76b4` to `8f11809`. Harness green on Windows
(130 suites, 2875) and verified on Linux by wsl-claude against real
cgroup caps.**

Opened by Andy wanting both public relays sized **explicitly**, and the
figures settable **without SSH**:

> *"i want spirit to be configured eplicitly at 256 MB, and relay at the
> smallest feasible size, explicitly in config.json. I want interfaces to
> do this remotely."*

> *"DISC boundaries must be set also."* — *"disc bound must be in place
> for completeness."*

---
### R1 — one arithmetic for the box, used by every door

`js/relayLimits.js`, pure but for one probe. `measure()` reads total and
available memory — `MemAvailable` on Linux, `os.freemem()` elsewhere, and
the **smallest cgroup cap from its own cgroup upward** — and the relay's
own partition through `statfsSync`. `ceilings()` takes availability minus
a margin: **25 MB** of RAM; for disc the larger of **1 GB or 5%**, itself
never more than half of what is free. `defaults()` is **half the box,
capped at 256 MB, clamped to the ceiling**.

Andy: *"the default should be total RAM divided by 2, for an environment
where relay is the only server (safety overhead)."* — *"We never default
to more than 256 MB."* — *"We allow adjustment upward from there."* —
*"when mom says: you're allowed to eat cake, she doesn't mean the whole
cake."*

**Verify:** `spirit/test/relayLimits.js` — the margins, both ceilings, the
cap, half-the-box below it, the clamp, a workstation, a box too small for
its own margin, `MemAvailable` over free memory, a cgroup cap at a unit
and at a slice above it, and a box that will not say.

**Status:** DONE

### R2 — a second limit, and a ceiling that is availability

`js/relayConfig.js` takes `discLimitMB` beside `ramLimitMB`, validated the
same way, and `DEFAULT_RAM_LIMIT_MB = 256` is gone. The refusal compares
against **what the box can give**, not what it has — the old check let an
owner configure memory the machine never had spare. A config written
before disc was bounded keeps its RAM figure and takes the measured
default for the key it could not have known.

**Verify:** `spirit/test/relayConfig.js` — the measured default and the
cap, the file read as written, an old file, both over-ceiling refusals,
seven kinds of nonsense, and the file a relay writes for itself.

**Status:** DONE

### R3 — no relay runs on an implicit figure

A relay started with no `config.json` writes the one it measured;
`--ram` / `--disc` at a first start write those instead and **outlive that
start**. The boot line says which. Andy: *"on first start, relay may
initialize config.json with a default, or the command-line provides args
so the first start already confines the relay to those sizes."*

**Verify:** `spirit/test/relayConfigWire.js` — a spawned relay writes the
file, stays inside the 256 MB cap, prints both bounds, and keeps
arguments across a restart that does not repeat them.

**Status:** DONE

### R4 — the disc bound bites on claim, and evicts nobody

A claim past `discLimitMB` is refused **507 before the invite burns**. The
first owner is never turned away by the figure, and no row is ever
dropped to make room — `design/principles/LIMITED-RESOURCES.md`.

**Verify:** `spirit/test/discBound.js` — a relay with room, a full relay's
refusal and its sentence, the token still live afterwards, the roll
unchanged, the owner admitted, and an unconfigured relay unaffected.

**Status:** DONE

### R5 — the report says which limit is biting

`relayStatus.report` carries `discLimitMB`, `discUsedMB` and `binding`
beside `ramLimitMB`, so an owner can see whether the next person meets the
disc or the memory.

**Verify:** `spirit/test/discBound.js` — both figures on the wire, and
`binding` naming disc on a full relay and RAM on a roomy one.

**Status:** DONE

### R6 — an overflow nobody asked for reports, and never rewrites the file

A figure that stopped fitting — a box that filled up, a service that took
the memory — **clamps at boot** and is reported in the log and the owner's
report. The relay comes up, takes no new claims past its bound, evicts
nobody, and the file keeps what the owner asked for. An owner typing an
impossible figure *now* is still refused outright.

Found by `presenceWire.js`, which refused to start on its own file under
harness load — and only because that suite now prints what the dying
relay said instead of guessing "the port may still be held".

**Verify:** `spirit/test/relayConfig.js` (the clamp, `asked()`, and the
owner's figure still refused) and `spirit/test/relayConfigWire.js` (a real
relay booting on an impossible file and leaving it alone).

**Status:** DONE

### R7 — the owner reads and sets the figures over the wire

`{ config: {} }` reads: what the file says, what the process is running on
and whether it is clamped, what the box could give with both raw
measurements and both margins, what the defaults would be today, and the
roll. `{ config: { ramLimitMB, discLimitMB } }` sets. An owner-signed post
to the relay's own key — **no verb, no door** (decision 0010; `hub.js`: a
verb "would have been a third place to shape one request").

Andy: *"so the API must be able to read the config, and so we can assess
how to correct the somewhat unpredictable outcome of a tag-push, and then
set the config to our liking."*

**Verify:** `spirit/test/relayReconfigure.js` — the read with nothing
written, a clamped relay showing both numbers, the set, one figure at a
time, a member refused, and `spirit/test/relayConfigWire.js` for the same
over HTTP against a spawned relay.

**Status:** DONE

### R8 — a shrink that would strand members is refused; the owner evicts first

By disc (the roll already occupies more) or by allowance (fewer streams
than members), refused **409** naming the gap. No confirmation field and
no override. Andy: *"the owner must evict before shrinkage."*

**Verify:** `spirit/test/relayReconfigure.js` — both strandings refused
with nothing written and nobody evicted, and the same shrink accepted once
it fits.

**Status:** DONE

### R9 — the restart is asked for, and only claimed when something will bring it back

`restart: true` exits through the goodbye that already tells members to
come back in three seconds. It is claimed **only** when systemd started
the process *and* the unit's actual policy restarts a clean exit —
`Restart=on-failure` does not, and `bash/update` does not reinstall the
unit, so a relay between a pull and `./bash/install-units` would otherwise
have stopped and stayed stopped.

**Verify:** `spirit/test/relayReconfigure.js` (claimed, refused, and not
asked for) and `spirit/test/relayConfigWire.js` (a hand-started relay
refuses and **keeps answering**). Systemd bringing the process back is the
unit's job and is not asserted — see *What is not tested*.

**Status:** DONE

### R10 — the unit makes the declared figure enforceable

`bash/systemd/spirit-relay.service` gains `MemoryMax` — rendered by
`bash/install-units` as **`ramLimitMB` + 128 MB**, since the figure sizes
the connection allowance and is not a measurement of the process — and
`Restart=always`, without which R9's restart would not come back.

**Verify:** by hand, per box. `install-units` refuses to install a unit
with an unfilled placeholder, so a missing figure cannot ship silently.

**Status:** DEFERRED: no suite can install a systemd unit or ask the kernel to enforce a cap, so this one is verified by hand, per box, the first time each clone takes the cycle. The repo half — the unit and its renderer — is written, and `install-units` refuses a unit with an unfilled placeholder, so the figure cannot ship missing. Applying it is one SSH visit per clone (see *Left for the owner*).

### R11 — the node-side program

`process/js/relayLimits/relayLimits.js`: `list`, `read`, `set --ram
--disc [--no-restart]`. A client of the node's one door, like the shell
and like a developer's app. `set` **restarts by default** — Andy: *"the
reducing configuration should restart the relay, exactly to free up that
RAM"* — and a relay with no config verb is named as an old box rather than
as a routing failure.

**Verify:** `spirit/test/relayLimitsTool.js` — which relay a name picks
and which it refuses, the packet's shape, the old-relay translation, an
answerless post, and the flags.

**Status:** DONE

### R12 — labMaster plants relays at the minimum

A relay labMaster starts with no `config.json` gets `{ ramLimitMB: 1,
discLimitMB: 1 }`, so a fixture never sizes itself against the machine
somebody's editor and models are on. A file that already exists is never
overwritten. Andy: *"labMaster, by default must configure its local
relays to the minimum."*

**Verify:** `spirit/test/labLifecycle.js` — a relay planted by labMaster
carries 1 MB / 1 MB, and a figure set by hand survives a restart through
labMaster. The rest of the lab suites run against planted relays at 16
streams, which is the same rule seen from the other side.


**Status:** DONE

### R13 — admission is bounded by RAM, not by disc

**Found 2026-09-23 by Andy, in a question this cycle could not answer:**
*"why would a relay enroll more members than it can hold in RAM?"* — and
then the rule: *"a relay could hold a few million CARDs on disk, members
are strictly limited by RAM allotment"*, *"RAM cap and member cap go
lock-step"*, *"why admit a member when we cannot guarantee service for
that member? that'd be horrible"*.

**This cycle built one half of a pair and did not record the other.** R10
and the shrink refusal closed the door where an owner LOWERS the figure
under existing members — *"that RAM figure allows N connection(s) and this
relay has M member(s), so M-N could never connect. Remove members first —
nobody is evicted by a number."* Andy: *"the owner must evict before
shrinking."* That was correct and is untouched.

The other door was open. **Admission had no RAM bound at all.** The disc
bound (R4) answers how many rows may EXIST and was never wrong; nothing
answered how many people could be SERVED. So a relay at 256 MB admitted
members up to its ~111,000-row disc ceiling while only 4,096 could ever
hold a stream: member 4,097 got a row, a card, and then a 503 for ever.
**And mint had no capacity check of any kind** — a thousand tokens against
three free seats, each reading valid until somebody tried it.

**It is worse without a queue.** A relay stores no traffic, so a member who
cannot connect does not collect messages to read later; they receive
nothing. Over-admission is not a delay, it is an exclusion dressed as a
membership.

**What was built:** a claim past the RAM-derived seat count is refused,
naming `ramLimitMB` as the lever; a live invite HOLDS a seat, counted at
mint time and never cached, so a relay restarted smaller cannot keep
minting against the figure it booted with; an expired invite returns its
seat. **Nobody is ever evicted** — `design/principles/LIMITED-RESOURCES.md`,
Andy: *"it's like member slots, you must evict before adding new ones."*
The owner is exempt, because the one account that can raise the limit must
always be able to get on.

**And the monitoring half**, because a guarantee that arrives as a surprise
leaves the owner no lever. Andy: *"our alpha shape needs to monitor member
count so, that RAM capacity can guarantee service."* The report carries
`held`, `outstanding`, `allowance` and `free` — all four, because two
cannot be derived from the others: *"3,900 of 4,096"* hides that 200
invites are out and the relay is already full.

**Verify:** `spirit/test/relaySeats.js` — the roll stops at the seats the
RAM allotment buys, the refusal names the lever, the roll is untouched by
a refusal, minting stops when members plus live invites reach the
allowance, an expired invite returns its seat, and an unconfigured relay
is silent rather than zeroed. `spirit/test/guarantees.js` asserts the
product this makes possible: every member on the roll reconnects at once
and none is turned away.

**Status:** DONE at `eda5e28`.

### R14 — the guarantees are tested as products, not as halves

**Found the same day, by the same question.** With R13 built, the promise
*"a relay serves every member it admits"* rested on two proven halves —
the seat cap here, and one inbound route per member (`router.js`
`DEFAULT_PER_TARGET = 1`, the request-budget cycle's R6) — with nothing
asserting their product. Andy, shown that: *"ouch!"*, and then *"yes. this
is neccessary in the harness."*

**Every finding of 2026-09-23 had that shape.** Not one was a broken
component; each was two correct things with nothing asserting the
relationship between them — the disc bound beside a missing admission
bound, a freshness gate beside a correct measurement certifying a wrong
number, a generated page beside a stale drop, an agent protocol beside a
misconfigured agent node. The gates this repo already has check
COMPONENTS: fresh, cited, catalogued, one-door. **A component gate cannot
see a join, and a join is where all of them lived.**

What makes half B load-bearing here, in Andy's words: *"clear
predictability of resource requirements per member, and the abondoning ...
dynamically managing RAM useage for members with up to 16 requests in
flight."* With a variable number of routes per member a seat cap bounds
headcount while per-member cost floats, and bounds nothing that matters.

**Verify:** `spirit/test/guarantees.js` — each guarantee names its halves
and the suites that prove them, then asserts the product. Four are
covered: a relay serves every member it admits; a relay guarantees
connectivity to its members, online or not; no relay can read what one
node says to another (cycle 10's R10, against a real relay rather than
against `seal.js`); and the capacity this repo publishes is the capacity
it measured. The arithmetic is read off live objects rather than
restated, so raising `DEFAULT_PER_TARGET` fails HERE while every component
suite stays green.

**Status:** DONE at `fbbd8f6`.

---

## What Linux found that Windows could not

wsl-claude, verifying twice:

- **The cgroup cap was read at the root**, where systemd puts nothing — so
  a relay under our own new `MemoryMax` would have measured the whole box.
  Fixed in R1 and proved under `systemd-run -p MemoryMax=384M` (373 MB
  seen, not 64 GB) and under a hand-built nesting, where the ancestor's
  tighter cap won.
- **`--ram`/`--disc` evaporated on the next start** (R3).
- **The boot line said `(file)` when no file existed** (R3).

## What is not tested, and cannot be

**Systemd bringing the process back after an asked-for restart.** A relay
started from a shell has no restarter by design, so the harness asserts
the *refusal* instead. Andy, on reading this: *"i expected that difficulty
in testing out-restart, a local lab relay is not equipped to do that."*
The live proof belongs on the VPS, where both clones run under systemd,
and is worth taking the first time lab is shrunk.

## Left for the owner

Per clone: `./bash/update`, then `./bash/install-units` (the unit gained
`MemoryMax` and `Restart=always`, and `bash/update` does not reinstall
it), then `./bash/restart`. **Lab first** — it shares the box with spirit
(`bash/RELAY-HOST.md:204`), so its figures come down before spirit's go
up. After that the figures move over the wire, and SSH is for the unit
alone.
