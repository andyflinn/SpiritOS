# The live surface has no tests, and presence is the first thing that needs them

**Opened 2026-09-11 against `8688fc1`. Andy: *"we need a suite of tests
specifically to make sure public https connections behave, and also to
hammer our dear little spirit-3 with stress."***

---

## What the harness actually proves

Fifty-two suites, and almost all of them drive objects **in process**.
`createRelay(home)` and a fake request function; `presenceStream.js` drives
the wire with fake sinks precisely so `presence.js` need not know what
`http` is. That is the right shape for logic and it is why the suites are
fast and never flake.

It means the harness has never once proved:

| never tested | where it would bite |
|---|---|
| TLS at all | every request spirit-3 serves |
| Caddy's treatment of `text/event-stream` | presence arrives in lumps, or not until the connection closes |
| whether Caddy passes `X-Spirit-Sig` untouched | every signed read fails, and looks like a bad key |
| a held request surviving 66s through a proxy | device enrolment, silently back to a coin toss |
| connection reuse across polls | the TLS cost `PRESENCE.md` §2 says a held socket makes moot |
| behaviour under real concurrency | rate buckets, the single device slot, the presence registry |
| malformed and hostile requests | `GET /%zz` already took the box down once |

The last row is the one with history: a single unauthenticated bad request
from the internet killed the process, and `systemd`'s `Restart=on-failure`
turned it into a three-second outage per request. The comment recording
that is still in `server.js`. Nothing in the harness would have caught it,
and nothing in the harness would catch its successor.

## Why presence makes this urgent rather than tidy

Everything before it was **request-and-answer**. A proxy either passes
those or it does not, and you find out immediately.

A held connection fails in ways that look like something else:

- **Buffered rather than streamed** — the roster arrives eventually, so
  nothing errors, and every peer simply reads as absent for a while.
- **Killed while idle** — the 20-second `:` heartbeat exists for this, and
  whether 20 seconds is short enough for whatever sits in front of spirit-3
  is not known.
- **Half-dead** — the socket is gone and neither end has noticed, which is
  the exact case that leaves a peer reading as **present forever**. That is
  the relay lying, and lying is the one thing this design cannot afford.

None of those three can be reproduced in process, and the first two cannot
be reproduced without a real proxy in the path.

## Two suites, and they are not the same thing

**1. Does the public surface behave?** Correctness over real HTTPS against
a real Caddy. Small, fast, run after every deploy: a signed read works, a
query-string signature is still refused, an SSE roster arrives *whole and
immediately*, a heartbeat survives a quiet minute, a 66-second hold
completes, a malformed path is a clean 400 rather than an exit.

**2. Does it hold up under load?** Connection count, reconnect storms,
rate buckets under genuine concurrency, and what a 1 GB box does when
every member holds a socket. Slow, deliberate, run rarely.

The first is a gate. The second is an experiment, and `PRESENCE.md` §8
already says why its numbers are worthless today: *a relay that still
stores two hundred messages and answers a polled inbox is not the relay
whose limits matter.*

## Most of it does not need spirit-3 at all

Andy: *"we might run those tests by faking the local shell browser for the
fake nodes I configure in labMaster."* That is the right shape, and it
reaches further than it first looks.

labMaster already spawns **real `server.js` processes on real ports**. A
fake shell browser on top of that gives real sockets, real SSE framing,
real socket deaths and real concurrency across real processes — which
covers held connections, heartbeat delivery, teardown, rate buckets under
genuine parallelism, and the node-to-shell hop end to end. All of it
locally, and none of it anywhere near the live box.

**Two things it still misses, and both are the proxy.** labMaster speaks
plain HTTP on 65400-65429: no TLS, no Caddy. Those are exactly the two
that produce the failure modes above — buffering, idle kill, header
stripping.

**So put a Caddy in the lab path.** One local Caddy, `tls internal`,
`reverse_proxy` to a lab node, is a *real* Caddy doing *real* TLS in front
of a *real* node, and it closes the proxy question without a second host
and without touching spirit-3. That is an afternoon, not a project, and it
is cheaper than the throwaway host this document first proposed.

What remains untestable anywhere is the field: a hotel portal, a phone
changing masts, a carrier that kills idle connections. Those cannot be
reproduced in a lab by definition, which is why `device.html`'s retry
exists as **cover rather than guarantee** and why the same reasoning will
apply to the presence client's reconnect.

**One property worth engineering for while building it.** The fake browser
should read SSE with Node's `EventSource` — the flagged one
(`--experimental-eventsource`), which `PRESENCE.md` §4 declined for the
*node* and which is perfectly fine in a *test client*, where a flag costs
nothing and an experiment is the point. That makes it an **independent
implementation** of the same protocol, so the hand-rolled reader Stage 2
adds is checked against somebody else's parser rather than against
itself. A client tested only by its own author agrees with itself about
everything, including its mistakes.

## Rules these have to obey, because the target is alive

- **spirit-3 is Andy's.** No agent SSHes to it, no agent runs the
  installer, and **labMaster is never pointed at it** — those are standing
  rules and a stress suite is exactly the thing that would quietly break
  them.
- **A stress run is an outage.** Hammering a box you depend on for
  messaging, while depending on it, is a choice and needs to be made
  deliberately each time rather than scheduled.
- **The lab is the target, not the live box** — see above. spirit-3 is
  for confirming a deploy, never for finding out whether something works.
- **Fake-origin scaffolding in labMaster** was already named for the
  update-and-rollback work, and a local Caddy is most of it. Whoever
  builds either should build it once.

## Where this sits

Not scheduled. It becomes hard to defer at Stage 2 of
[PRESENCE.md](../relay/PRESENCE.md), because that is the point where a
personal node starts *depending* on a held connection through Caddy
behaving — and if it does not, the symptom is a screen full of peers
wrongly marked absent, with nothing in any log to say why.

The cheapest useful first step is not a suite at all: **one script that
signs with a node's own key, opens the stream, and prints what arrives and
when.** Point it at a lab node for the mechanics, and at a lab node behind
a local Caddy for the buffering question — which is the single unknown
blocking Stage 2.

Pointing it at spirit-3 is a one-line change and answers the same question
about the real path. Worth doing once, after a deploy, and not as the way
to find things out.
