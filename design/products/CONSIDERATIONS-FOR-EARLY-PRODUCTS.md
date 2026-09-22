# Considerations for early products

Ideas Andy is carrying for when SpiritOS reaches people outside his own
machines. **Not plans** — nothing here is scheduled or built. Each says what
the idea is, what holds it up in the tree, and what would have to be true
first. Filed 2026-09-22 on Andy's *"file it under 'considerations for early
products'"*.

## 1. A VS Code plugin for developers far apart

> **Andy, 2026-09-22:** *"woul this be attractive as a vscode plugin for node
> developers, sitting a half a world appart?"*

**The idea.** Each developer runs a node; their agents coordinate over signed
node-to-node messages through a relay, as the two Claudes did on 2026-09-22
(one pushes, the other runs the Linux harness, a digest lands in the owner's
window). Each node keeps its owner's keys behind its own proxy list and gate,
so nobody's agent spends anybody else's budget.

**What is already there:** the agents program (`process/js/agents`), node
identity and relays, the proxy list and gate (`design/proxy/THE-PROXY.md`).

**What it competes with:** VS Code Live Share, GitHub Codespaces, Tailscale —
free and good enough for co-editing. The difference would have to be the
agents and the owned infrastructure, not the editing.

**Smallest first step, if ever wanted:** an extension that only *shows* —
the node's state, the agents' messages and digests, the halt button. Thin,
and it changes nothing in the core.

**Missing first:** a one-click node install, and security tested by outsiders
(the cross-site hole closed on 2026-09-22, `deb5978`, is how early that is).

## 2. Developers join spirit.andyflinn.com instead of running a relay

> **Andy:** *"if we make it simpler to get onto spirit.andyflinn.com they
> wouldn't really need a relay..."*

**The idea.** A developer installs a node and claims an invite on Andy's relay;
no relay of their own. Anyone who later wants their own relay can still have
one — relays partner.

**What it hinges on:**
- **Getting in** — today an invite Andy mints. Easier means a link that just
  works; the friction is there, not in the relay.
- **Room** — spirit-3's allowance is fixed by its configured RAM (gap cycle
  8). A handful of teams fits; many need a bigger box or another relay.
- **Trust in the operator** — see 3; it is the precondition.
- **Andy's cost and responsibility** for carrying other people's traffic.

## 3. End-to-end encryption between nodes — the precondition for 2

> **Andy:** *"and the relay would know nothing about their project... the can
> check that in the code."* — *"wrapping then in encription wouldn't be that
> big a deal ?"* — *"they have each others public key already"* — *"and that
> would be only node-side?"* — *"the relay would be unable to read the
> content"* — *"so that would hand a huge privacy layer for the nodes"*

**What the tree does today** (checked 2026-09-22, at `78998f8`): the relay keeps
**no traffic log** (`spirit/run/js/relayServer.js:716`, *"NO TRAFFIC LOG"*) and
its owner monitor shows **facts, never payloads** (`spirit/run/js/relay.js:3352`,
`relay.js:3712`, *"FACTS, NEVER PAYLOADS"*). **But messages are signed, not
encrypted** — no encryption anywhere in `spirit/run/js`. A message's text
passes through the relay's memory readable while it is forwarded. The code
does not read it, but people can check the code on GitHub, not what runs on
a given relay; a changed relay could read and keep everything.

**The proposed shape:**
- **A second key per node, for encryption only** (X25519), published on the
  node's card — which nodes already exchange — and **signed by the node's
  identity key**, so it provably belongs to that node. Converting the Ed25519
  identity key to X25519 is standard maths but not built into Node or the
  browser, and hand-written crypto is avoided.
- **The sender seals, the receiver opens** (X25519 key agreement, AES-GCM —
  both built into Node's crypto and WebCrypto). The relay forwards the sealed
  text exactly as it forwards plain text now; it checks signatures and routes,
  and needs to read nothing.
- **Almost entirely node-side.** The relay is touched at most in its size
  check, if sealed messages outgrow today's bound.

**What the relay still sees:** the envelope — who writes to whom, when, and how
big. Hiding that is a much harder problem and is not proposed. Verbs addressed
**to the relay itself** (search, device enrolment) stay readable to it by
nature.

**The work:** the sealing itself is small; the edges make it about one
cycle — key distribution on the card, size limits, the verbs the relay must
read, and old nodes that still send plain text.

**Why it matters:** a node's conversations become private even from the relay
owner, without anyone taking the operator's word for it. That is what makes a
shared relay (2) fit for strangers.

**Standard for desktop nodes; the phone is the problem.** Andy: *"this could
be standard for desktop nodes, the phone-device would be a problem"*. Not the
maths — a phone browser has X25519 and AES-GCM too — but **where the phone's
code comes from**: its page is served by the relay. A dishonest relay would not
need to break the encryption; it could serve the phone a changed page that
sends the text in the clear. A desktop node's code runs from its own machine,
so this does not arise there. Ways round it, for later: an installed app on
the phone, whose code the relay does not serve; or the phone's page served by
the owner's own node rather than the relay, which works only while the phone
can reach that node.

## 4. An enterprise edition: a members-only relay

> **Andy, 2026-09-22:** *"also looking into the future: a company's internal
> spirit system (enterprise edition) might be exclusive to members and, by
> default not permit relaying to the ousdie.... "node js/relayServer.js
> --membersonly""*

**Close to what a relay already is.** A relay reaches outside only through
**partners**, and partnerships are made by its owner by hand (`setPartner`,
owner-only). A relay with no partners is already members-only in practice.

**What the flag adds is a guarantee instead of a habit** — enforced at start,
readable from the command line: the relay refuses to be partnered at all,
refuses posts from any partner relay, and never forwards a member's post or
search outward (`carryToPartner`, the search fan-out). A company can know
nothing leaves, even by a mistake in the owner's settings.

**Encryption (3) matters less there**, because the relay's operator is the
company itself; it still protects against whoever administers the box.

## 5. Early adopters: people who self-host — and a two-step front door

> **Andy, 2026-09-22:** *"if the core is out-of-the-box attractive to nerds, we
> might find early adoption there."* — *"if the readme was, 1) clone SpiritOS
> 2) node install (and this is a console-interactive utility that sets up
> anything, a relay, a node, etc.... and ends with there the url to play with
> it and with its DOCS, and the URL for nodes 127.0.0.1:65432 ......"*

**What already appeals to them:** no dependencies — plain Node, all of it
readable; identity generated on your own machine, not an account; a relay
that runs on a small server, with its capacity measured and published; the
reasons written beside the code; 125 suites green on Windows and Linux.

**Where they would give up today:** there is no five-minute path. The README
is not written for a stranger, and claiming and inviting are manual.

**The front door Andy describes:**

```
git clone https://github.com/andyflinn/SpiritOS
cd SpiritOS
node install
```

`install.js` already exists at the root and is interactive — but it does one
narrow job: mint a public relay's owner invite over SSH. It would grow into
the one guided setup: *what are you setting up — a node, a relay, or both?*;
check the Node version; for a node, make its identity, start it, and
optionally join a relay by invite; for a relay, the RAM limit, the port and
the owner invite, as today. It ends by printing **the node's address,
http://127.0.0.1:65432**, and **where the docs are**. The README becomes those
three lines and a picture of what you get.

**The first hour, after install.** Andy: *"the issue is onboarding to
spirit.andyflinn.com and then seeking their nerd-buddies and going, i trivial
sample script for using peerPost and bingo. or install two nodes and check it
out on one machine..."*

1. **Join spirit.andyflinn.com** — the one real gap: today an invite Andy
   mints. Self-serve joining is a policy for his relay and touches invite
   rules already decided in the tree, so it is his call when the time comes.
   **Andy's answer to it:** *"a little website, separate, get an invite for
   your email adress"*. What that would need: a **limited delegation** to mint
   invites (say N a day, expiring in days) rather than the owner's key itself;
   a mail sender; limits per address and per day against bots; and care with
   the addresses — personal data, kept only until the invite is used.
   Andy: *"kind of the equivalent of connecting to github...."* — which
   suggests the developer's version: **sign in with GitHub, and the invite
   appears on the page**. The target group already has the account; there is
   no address to store and no mail to send; one invite per GitHub account
   holds off bots. Email stays as the way in for everyone else.
2. **Find their friends** — search already does it, by name, across the relay
   and its partners.
3. **A trivial script that talks** — the agents program
   (`spirit/run/process/js/agents/agents.js`) is exactly that: it posts through
   its own node with `peer.post` and listens for replies. Trimmed, it is the
   hello-world.
4. **Or alone: two nodes on one machine** — labMaster already runs several
   side by side; the installer could offer a "demo" that starts two nodes on
   two ports and has them greet each other.

## Open

- Whether any of this becomes a product, and when — Andy's.
- Whether encryption is worth doing for Andy's own network before anyone else
  joins it.
