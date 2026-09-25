# DICTIONARY.md — how Andy says it

**This file answers "what does Andy mean by this word". It is an analysis of Andy's usage, not a glossary explaining experts to him** (`ANDYS_RULES_FOR_AGENTS.md`, preamble). It goes stale when his usage changes. Where his word and the industry's differ, his is the one this project uses; where he has not drawn a distinction an agent needs, the agent draws it out loud and asks rather than importing one silently.

Agents describe the system with these terms and adapt to them, never the reverse. If you mean something else, say so; do not reuse a word from this file.

Format: **term** — aliases — meaning.

## People and machines

**Andy** — AF, the operator, one operator — The human who owns the repo and the public relay. Not a Unix user named `spirit`.

**Work box** — laptop, Windows box, coordinator machine — Andy’s personal computer. Checkout, browser, Claude’s shell. Not spirit-3.

**spirit-3** — VPS, Kamatera, public host, `194.37.81.237` — The rented box that runs the public relay. Root is spirit. Clone is `/root/SpiritOS`.

**Clone** — the checkout — A git copy of SpiritOS. Work box has one. spirit-3 has one. They are not the same process.

## Nodes and ports

**Personal node** — 65432, work node, companion spirit, default server — `node js/server.js` **without** `--relay`. Loopback HTTP only. The browser UI talks to this and only this.

**65432** — work port — Default listen port of a personal node on the same machine as the browser. Not the public relay.

**Public relay** — `--relay`, VPS relay — `node js/server.js --relay`. A **router**: it routes packets between personal nodes by public key, delivers or refuses at once, and **stores nothing on anyone's behalf** (decision 0006). On spirit-3 it binds **65430** behind Caddy, never as a public 65430.

> **"mailbox" was a synonym for this until 2026-09-15** and is retired. It described a real thing — a claim/send/inbox store — and R8 deleted that thing. `relay.js` has said *"there are no mailboxes in the system (Andy). An application may have something it chooses to call one; this layer does not"* since before the deletion; the word is dropped here so the two agree. Occurrences survive in comments about history, which is where a retired word belongs.

**65430** — relay port, internal Node port — Where the `--relay` process listens on spirit-3. ufw denies it from the world. Caddy proxies 443 → this.

**Caddy** — TLS front — On spirit-3, public `:443` / `:80` for `spirit.andyflinn.com`. Terminates TLS. Forwards to 127.0.0.1:65430.

**spirit.andyflinn.com** — public URL, relay URL — The HTTPS name personal nodes put in `relays.json`.

**Lab relay** — fake relay, temp relay — A `--relay` on the laptop (often 65410 / 65430 in temp) for tests. Not spirit-3.

**Fake node** — lab avatar, isolated copy — A temp copy of `spirit/run` made via `git ls-files`. Untracked files do not exist inside it.

## Programs in the tree

**Spirit-shell** — the shell, kernel UI, browser UI — HTML/JS served by the personal node. Apps mount here (Relay Chat, natter, …).

**Spirit group** — the Spirit app, launcher home — The shell's own group screen (Stats, Processes, Jobs, Apps, Groups). Every **intrinsic** app renders here and cannot be moved out — not to None, not to a user group, not back to the desktop. Not a `preferences.groups` entry, so the operator can neither delete nor rename it.

**Relay Chat** — relayChat — The chat app, for any human. Not an admin console: owner-only powers appear inside it only when this node’s key happens to own a relay.

> **Its receive path is BROKEN as of 2026-09-15** and is awaiting a retrofit. It polled `/api/hub/inbox`, which R8 deleted, and its `api.onPacket` handler is an empty stub. Andy's call, taken knowingly: *"I'd rather see apps breaking than apps faking."* Sending already moved to `/api/hub/post`.

**Natter** — relays.json, relay list — The list of public relays this personal node uses (`app/natter/relays.json`). First URL is what hub calls today. A row carries an **owner badge** when this node’s local public key matches the owner on that relay. Natter is an **intrinsic shell app**: it lives in the **Spirit group**, has no location control, and the App Builder cannot overwrite its script or manifest — a node with no relay list can reach nobody at all. Keeps its last public row (`canRemoveRelay`).

**Owner badge** — owned row — The Natter mark meaning *this node’s key is `owner` on that relay*. Zero, one, or several rows may carry it. It is what unlocks create-invitation in Relay Chat. Decided (Andy): the badge is a **signed status 200** on that Natter URL — no extra endpoint unless one proves necessary. The same probe answers *"is this label still mine?"* off the public roll (`claimedLabel`), which is where Natter's binding check went when R8 deleted the signed inbox read it used.

**Hub** — hub.js — Personal-node code that signs and forwards claim, post and invite to a relay over HTTPS (or loopback HTTP for a lab relay). It forwarded `send` and `inbox` until R8 (2026-09-15).

**whoBook** — private who, perception book — `relay-state/who.json` on a **personal** node. publicKey, publicLabel, myLabel, relays[]. Never uploaded.

**labMaster** — 65420 — Laptop control plane that starts fake nodes. Forbidden on spirit-3.

**Harness** — the test suite, `spirit/test/*` that Claude runs — In-process and loopback tests. No spirit-3 required. “Harness green” means those files’ last lines, not `./bash/status`.

**probe** — relayLab/probe.js — Manual curl-like check of public HTTPS + local 65430. Not part of the harness.

## Identity

**Identity** — keypair, identity.json — Ed25519 keys on the personal node. Private key never leaves the box.

**Public key** — pubkey — The half that may go to a relay on claim.

**Public label** — claim name, caption on the wire today — The string peers see in a relay's roll (`andy`, `john`). May collide after peer-by-key. **Stored once per membership, set once for all of them:** the ledger holds one label per key per relay and two relays may legally disagree, but a person has one name, so **Info** keeps it and posts it to every relay this key holds a seat on. A relay that was down or that refuses (a live invite holding the name) stays out of step, and Info's table is where that shows. *Natter Details used to set it one relay at a time; that panel is gone — Andy: "i have no idea which 'relay' contains which 'label' of mine."*

**My label** — private caption, perception — What *you* call that key in whoBook (`lovelyJohn`). Never on the wire.

**Peer-by-key** — peers keyed by public key — Identity on a relay is the key. Same public label can exist twice (two johns).

**Peer** — the other end, for a node — *Nodes have peers.* Another identity a node corresponds with, named by key. A peer is a person's box.

**Partner** — the other end, for a relay — *Relays have partners.* Another **relay**, promoted by an owner and pinned by its relay key (`partners.json`). Never a person: a relay's counterpart is a box like itself, which is why partnership survives banning the human who owns it.

**Member** — an enrolled row — Who claimed a name on a relay. A relay *has* members; it does not have peers. Note `routingTable.json` still calls this map `peers`, and the public roll still answers `{ "peers": [...] }` — naming them from the node's vantage rather than the relay's, and the one place the tree contradicts the line above.

**Roll** — member roll, `GET /api/relay/who` — The list a relay keeps of the members enrolled on it. **It was `census` until 2026-09-23** — Andy: *"i hate the word census now, but for the relay it's true... the relay can't falsify the record in the member roll (not census)?"*, then *"we loose census from the dictionary."* A census is something a counter performs on a population; a roll is a list a body keeps of its own members and is answerable for — and cycle 10 makes it answerable in writing, since a roll entry now carries the cipher key everything sent to that member is sealed to. Renamed inside cycle 10's flag day. `acquiredVia: "roll"` is also the **lowest contact rank** — seen on a roll is not knowing somebody — and rows on disc still reading `"census"` fall through to it (`contacts.js`, `acquiredVia`). A file's count ledger is a **tally**, never a roll (`oneDoor.js`, `cycleCitations.js`).

**Owner** — first claim, allow.json keys[0] — The key that first-claimed (or pending-owner redeemed). Mints invites. Reads `/api/relay/status`. Gets the chat-to-relay roll.

**Pending owner** — pending-owner.json — Installer-set name that must win first claim. Cleared after that claim.

**Reserved name** — `relay` — Cannot be claimed. Send-to-`relay` is accepted; roll reply is owner-only.

## Allow and invites

**Allow list** — allow.json — Who *may* claim. **Two modes: `open`** (no file — a relay before its first claim) **and `keys`**. `names` was a third and went on 2026-09-15: nothing in the tree ever wrote one, and the two gates that gave it meaning died with the ring. Not the same as who has claimed, which is `routingTable.json`.

**Names-mode** — names allow list — Only listed strings. Not what live Kamatera runs any more (see Keys-mode).

**Keys-mode** — keys allow list — After first-claim-is-owner. Extra claims need a live **invite** (cycle 4). Owner key may reclaim without invite if `routingTable.json` was lost. **Live Kamatera runs this since the cutover on 2026-09-07, owner `andy`.**

**Invite** — invite row — `{ token, label, expiresAt, invitedBy, consumedAt }` in `invites.json`.

**Token** — invite token, secret — Random hex. Friend needs this plus the label unless we later mint a speakable token.

**Label** (invite) — invited public label — The public caption the token unlocks (`saint`). Not the token.

**Mint** — POST invite — Owner-signed create of an invite row. Works in keys-mode only.

**Create-invitation** — the invite UI — Where a human mints. Lives in **Relay Chat**, and is shown only if at least one Natter URL carries the owner badge. Several owned rows → the user picks which relay to mint on; it is never guessed from “first URL”. Design only — cycle A.

**Redeem** — consume on claim — Successful claim burns the token before the peer is written.

**Cutover** — Kamatera cutover — Deliberate change of live `relay-state/` (usually names → keys + pending-owner). Never implied by a lab-green harness.

## Process words

**Sitting** — this turn’s work — One opened cycle. Green means stop.

**Cycle** — numbered slice (invite 1–4, A, …) — Spec + test; Claude patches; harness; stop.

**Cycle A** — the create-invitation UI slice — Relay Chat gains create-invitation behind the Natter owner badge. **Not open.** Nothing of A is implemented until Andy opens it; the words above are picture, not backlog.

**Leash** — Paste to Claude — Short verdict Andy copies. No leash in a Grok reply means nothing is for Claude.

**Bones** — ugly implementation — Behaviour without chrome.

**Gates** — inbox sig, send clientKey, bucket sweep, owner roll — Must survive bones commits.

**clientKey** — socket key — Rate-limit identity. Behind Caddy this is often `127.0.0.1` for everyone. Not `X-Forwarded-For` until we say so.

**Drop** — file Andy puts in the checkout — New path: full file. Path already on master: cycle `.md` + failing test only.

**Master-only** — no feature branches, no courtesy PRs.

**Divergence** — divergency — **A difference between two halves worked independently, found at the reconciliation stop and shown to Andy unresolved.** Not a bug, not a fault in an agent, and not a disagreement to be settled quietly on the way past: *"on-the-go reconciliation will hide the divergence"* (2026-09-23). It is the **output** of working in parallel, not a cost of it — *"that's a stop in the cycle. i want to see the divergence."*

> **It is often a hole in the writing rather than a misreading.** Cycle 11's only divergence was two requirements in one document contradicting each other on a case neither sentence mentioned — neither agent had read it wrong. So a divergence is logged with **what it was about**, not only that it happened.

> **He sometimes hands it back:** *"sometimes, sometimes i'll leave it to you both to reconcile."* That is his ruling to make at the stop, and an agent does not assume either way.

> **The count is tracked and its meaning is NOT yet decided.** *"the divergence-count for reconciliation will be a measurement for the quality of the design, and will be tracked as well?"* — and, correcting an agent that had already written an interpretation into the rules on the strength of one cycle: *"we track divergency and learn it's meaning as we go"* (2026-09-24). So the number is recorded with its context and read later. A count from independently-worked halves and a count from a negotiation are not the same measurement.

**"agreed?"** — agree?, thoughts?, correct? — **When Andy asks it, it INVITES CRITICISM. It is not a request for assent.** Andy, 2026-09-24, confirming wsl-claude s reading: *"wsl noted that when i ask 'agreed?' it invites criticism. that is correct."* So the useful answer names what is wrong, what is missing, or what he has not been told — and says so before saying yes. An agent that reads it as seeking confirmation returns a yes, which is the one answer carrying no information.

> **AND IT IS ADDRESSED TO THE TEAM, NOT TO THE LEAD.** Andy,
> 2026-09-24: *"an agreed? therefore is solicitation of positions from
> the whole team, when approprate."* So the lead forms its own position
> **and** collects the others', unprompted. **Positions, plural** —
> returned as they were given, including where they disagree. A lead that
> merges them into one view has done the smoothing that
> `ANDYS_RULES_FOR_AGENTS.md` forbids for divergences, one level up.
>
> **"When appropriate" is the judgement, and the test is ownership:** if
> the question touches something another agent produced, owns, or would
> have to build, that agent's position is owed. A question about the
> lead's own work is the lead's alone to answer.
>
> **Measured the day it was written.** Andy asked *"lot's of clarity in
> those answers. agree?"* about wsl-claude's five answers. The lead gave
> its own position — correctly, pushing back on three of them — and
> stopped there, and Andy then had to instruct it: *"can you negotiate
> his response with wsl himself?"* The whole reconciliation that followed,
> including four readiness findings the lead could not have produced
> alone, should have started at the `agree?`.

> **THE WORD INVERTS WITH THE SPEAKER, which is why it is here.** Andy asking *"agreed?"* is soliciting objection. An agent answering *"agreed"* is supplying none — a stamp, and `ANDYS_RULES_FOR_AGENTS.md` rule 15 refuses it at a reconciliation stop in favour of naming what was checked and against what. Same word, opposite functions, and an agent that treats them alike fails in the direction that looks agreeable.

**Reconciliation stop** — the stop, the close — **The end of a cycle, where the two halves are exchanged and compared, and where autonomous work ends.** *"every cycle must have a stop for reconciliation. so that says how far you can go autonomously."* Every cycle has one, however short it was. An agent does not cross it into the next cycle.

## The app layers

Approved 2026-09-24 with the public app server design
(`design/shell/PUBLIC-APP-SERVER.md`). They were held out of this file
while the layering was unsettled, because it records settled usage.

**The node’s app** — intrinsic app, the one app — **The single app a
node IS.** Every node has exactly one. The tree already used the phrase:
*"an intrinsic app is what this node IS"* (`shell.js:478`). The shell is
one of these — its particular job is fanning out to others, which is the
shell’s own work and not a layer.

**Core** — `spirit.core`, configuration-basics — **The layer every node
has, whatever it serves:** the door (`ask`), the path jail, the bounds
and their allotment, the unit, remote reconfiguration, the app contract.
Not optional — it is what being a node IS, not a choice.

**App surface** — `api`, the handed surface — **One app’s scoped view
of core.** `api.fs` is `core.fs` narrowed to that app’s folder; `api.verb`
is `ask`. Present only if the node serves an app — a relay serving a
static brochure has none, which is why `device.html` had to hand-roll its
own `fetch`.

**App utilities** — app-utils-and-dialogs, `api.ui` — **The painting**:
shared elements, the look tokens, dialogs *and the rule that governs
them*. Optional, and **provided by the shell as FILES rather than by the
shell as a process** — every clone carries `app/shell/` whether or not
anything launches it. Elements and style adoption are separately
optional.

**Sibling app** — — **An app that is a peer of the shell rather than
hosted by it.** `join` is one; `contacts` is not. Apps belong to the
NODE; the shell is merely the one whose job is to fan out.

**Public app** — — **A node’s app reached by strangers.** Publicness
is a **deployment** fact — a Caddy block, a whitelist, `noindex`, a DNS
record — never a property of the app or of core. The same app on
loopback is the same app, which is why the module is `appServer.js` and
the mode is `--app`.

**Declaration** — — **What a node type plugs into core: data, never
code.** A writable scope, an appetite, which app it serves. Because it is
data it can be closed, validated and asserted — and because it is not
code, two types cannot fork the mechanism between them.

**Appetite** — — **A type’s declared share of a box, in place of a
headcount.** A relay is greedy; a one-page public app is small. Equal
shares between unequal servers would starve one to feed the other.
Adding a unit re-divides by appetite and re-caps the others.

**Starter** — `app/starter/`, the starter app — **The official sample
app, and the acceptance test of the app layer.** Named for its job rather
than as a greeting — Andy: *"it indicated a forward direction for the
early adopter"*, and wsl-claude: *"it says COPY ME in the name"*. Not
`hello`: *"hello world"* is a convention for a language’s first program,
and `process/js/hello/` already holds the installer’s acceptance test.
**A throwaway consumer rots; the official sample cannot**, because the
artefact that proves the layer is the artefact every stranger copies.

## The show

Andy, 2026-09-24, in four sentences that retired an hour of design:
*"The app actually lives on the owners node. the 'site' is just a
screen"* — *"owner=master .... app=puppet"* — *"it's THE SHOW!"*

**Recorded first and alone**, before any of the design that followed,
because an hour was lost to the word *app* — and twice over. First both
agents read it as the thing on the public box and designed capabilities
for a machine the program does not run on; every correction Andy made
moved one of those back to the owner's node, five times, and neither
agent saw the pattern from inside. Then the first draft of this entry
over-corrected into **two kinds of thing**, which the tree refutes:
sixteen of the seventeen apps under `spirit/run/app` are neither public
nor autonomous, so *public* and *autonomous* cannot be what the word
means.

**ONE KIND, WITH AXES.** That is the correction, and the fork mechanism
underneath it is the one this file exists to stop: a word covering more
than one thing, with nothing linking the uses, invisible to whoever holds
it.

**Master** — the owner. Not a role an agent may take and not a thing a
puppet may become.

**Puppet** — **what an app IS.** A thing its master moves: it displays,
it carries, and it decides only what it was given leave to decide.

**AND IT OWNS NOTHING IT RUNS ON.** Andy: *"the node holds the store...
the node hosts the store and the connections"*. A puppet has no store and
no connections of its own — it uses its **node's**, and only as far as it
was granted. That is why a public puppet persists nothing about a visitor
and posts to exactly one correspondent: not restrictions placed on an app,
but the shape of a thing that owns neither the disc nor the wire.

**AND THE LOOPBACK APPS ARE THE SAME PUPPETS.** Andy: *"the loopback
apps on the node are the same, the intrinsic ones obviously"* — natter,
contacts, the relay monitor, the shell itself. They are not a different
kind of thing from the screen on a public box; they are puppets whose
audience is their own master, reached on 127.0.0.1 instead of from the
internet.

*Written first as two different things — app on the node, puppet on the
public box — and that was too narrow. One concept with axes, and the
axes are what the words below name.*

**App** — a puppet, described by how much it has been given:
**programmable, public, autonomous.** Andy: *"an app ist just a
programmable, public and autonomous puppet."* So the difference between
the shell's apps and a screen on a VPS is REACH and AUTONOMY, never kind.

| axis | private end | public end |
|---|---|---|
| **reach** | loopback — the master is the whole audience | a public box — strangers arrive |
| **autonomy** | decides what its master programmed it to | **decides nothing** — today, on every public box |

**A PUPPET THAT ACTS BEYOND ITS LEAVE IS BROKEN**, and on a public box
today that leave is NOTHING. Its emptiness is not a restriction: it
persists nothing because it has nothing OF ITS OWN to persist, it answers
no verbs because it is not the thing being asked, and it has one
correspondent because the program driving it is at the other end of that
link.

*Whether a puppet is the process or the page it serves is **not
distinguished, and nothing has needed it.** Left uncoined deliberately: an
unused term is a fork waiting for somebody to need one of its halves.*

**Show** — **the arrangement, and it is the unit.** A puppet with no
master is a poster; a master with no puppet has no stage. `join` is a
show whose act is turning a stranger into a member: a loopback puppet on
Andy's node that mints, and a public puppet on a VPS that displays —
*"The app actually lives on the owners node. the 'site' is just a
screen"*. Neither half is the product alone.

**Audience** — whoever arrives at the puppet. **They never see the
strings** — and that one is ASSERTABLE rather than merely said: it is the
generalisation of `appServerBoundary`'s *the refusal names nobody*. The
visitor-facing surface reveals no owner key, no label, no address.

**AND THE MASTER CHOOSES THE AUDIENCE, BY LIST.** Andy, 2026-09-25:
*"so an app is a node owned by another node (a puppet), it provides an api
sepecific to itself, and it's owner can control who it provides that api
to"* — and *"by setting the puppets contact list it limits who can make
use of puppet"*.

So a puppet has **contacts of its own**, and they are not its master's
contacts. Two gates, answering different questions:

| gate | question | where |
|---|---|---|
| the node's front door | may this peer reach this node at all | `peerPost` — verdict `known`/`admit`; a held stranger reaches no app (`arrivals.js:405`) |
| the puppet's contact list | may this admitted peer use **this** puppet | `app/<name>/allow.json`, read per ask by `nodeApps.js` |

**Being on the list IS the permission.** Andy: *"it's implicit permission
to deposit a request on the owners hard drive."* A puppet asks no second
question about what a listed contact may do — that is what the list said.
What stays the puppet's own business is the SHAPE of what it accepts:
bounded, well-formed, attributed. Being allowed to speak is not being
allowed to say anything.

**An absent list means NOBODY**, never everybody — G14. A puppet arrives
with no contacts and does nothing until its master gives it one, which is
the correct amount of nothing.

*One list mechanism for every puppet, in the seam rather than in each
one: a puppet that grows its own notion of who may use it is the thing to
go red on.*

**AND ONLY THE MASTER MAY WRITE IT.** Andy: *"the puppet has it's own
contact list, BUT, only the puppets owner has write-authority over that
contact list"* — and, asked whether the puppet holds that authority:
*"the puppet doesn't"*. The list lives in the puppet's folder because
that is where a puppet's things live, and the folder is where its scope
ends — so without this the puppet could write its own guest list and the
permission would be its own to grant. **A puppet that can choose its
audience has no master.**

**Face** — a puppet's visible surface, and **it has none by default.**
Andy: *"the app-puppet has no face by default, that's an add-on-option"*.
Which way round this sits is the whole of it: a puppet does not *lack* a
face waiting for somebody to supply one. It has none, and a face is a
thing its master adds on purpose. The seam gives a puppet a subscription,
a scoped filesystem and a way to post, and nothing that serves.

**Strings** — the post to the owner and **the answer coming back**.
Everything the audience does travels them; everything they see came down
them. A reply carries a body, already unsealed, to the original poster
(`peerPost.js:363-373`) — so a puppet needs nothing knocking on its door
to show what its master computed.

**And `surface` belongs to the PUPPET.** It is declared in the manifest
on the public box, read by the app server, and what it declares is what
**the screen and door** require. The program on the owner's node needs
whatever it needs: that is the node's own business, there is no contract
for it, and there may never need to be one — **a program on your own node
does not negotiate with you.**

## Do not confuse

| Do not say | If you mean |
|---|---|
| relay | personal node / 65432 |
| 65432 | public relay |
| 65430 | something the browser should open |
| harness | `./bash/status` or probe |
| allow list | the claimed peers in `routingTable.json` |
| token | public label |
| owner | anyone who claimed |
| Natter | Relay Chat |
| owner badge | owner (the key on the relay) |
| mailbox | a relay (the word is retired — see **Public relay**) |
| VPS | work box |
| GROQ | GROK.md |
| app | the puppet (the screen on the public box) |
| the site | the puppet — it is a screen, not the app |
| the app server | the puppet's server, which runs no app |
