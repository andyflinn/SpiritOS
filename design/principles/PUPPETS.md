# Puppets — what an app is, who may use it, and who may change that

*A design sitting, 2026-09-25. Every claim below carries `path:line`
verified at `76b587a` unless it names another commit. Decided,
recommended and open are kept apart on purpose: a third party should be
able to act on this without re-deriving it, and without mistaking a
recommendation for a ruling.*

The vocabulary this builds on is `DICTIONARY.md`, "The show" —
master, puppet, app, show, audience, strings. The deployment shape it
serves is `DEVICES-AND-PORTS.md`. **This document is about what a puppet
IS to the system**: what it can reach, who may use it, and who may
change that.

---

## The definition, and it is Andy's

> *"so an app is a node owned by another node (a puppet), it provides an
> api sepecific to itself, and it's owner can control who it provides
> that api to"* — Andy, 2026-09-25

Three claims in one sentence, and each has consequences below: a puppet
is **a node**, it exposes **one api of its own**, and its **owner
chooses the audience**.

---

## DECIDED

### 1. Two gates, answering different questions

| gate | question | where |
|---|---|---|
| the node's front door | may this peer reach this node at all | `spirit/run/js/peerPost.js:1307` — onArrival fires on verdict `known`/`admit` only |
| the puppet's contact list | may this admitted peer use **this** puppet | `spirit/run/app/<name>/allow.json`, read per ask by `spirit/run/js/nodeApps.js` |

A held stranger reaches no app at all, and that was already asserted
before this sitting: `spirit/test/arrivals.js:405`, *"a stranger reaches
no app at all — the front door binds before the seam"*.

**Being on the list IS the permission.** Andy: *"since the owner gates
which peers can use that app..... it's implicit permission to deposit a
request on the owners hard drive"*. A puppet asks no second question
about what a listed contact may do. What remains the puppet's own job is
the SHAPE of what it accepts — bounded, well-formed, attributed. Being
allowed to speak is not being allowed to say anything.

**One mechanism, in the seam, not one per puppet.** A puppet that grows
its own notion of who may use it is the thing to go red on.

### 2. An absent list means nobody

Missing, empty and unparseable all refuse. That is G14: an optional
guard whose absence means "do the unsafe thing" IS
absent-means-everything.

**But the diagnostic does not collapse with the verdict.** wsl-claude,
2026-09-25: *"an absence the system chose and an absence the system
could not read must not be indistinguishable to the person who wrote the
file."* Missing and empty are the owner saying something; a file that
exists and does not parse is the owner's mistake, and says so once per
distinct broken content — not once per packet, because the list is read
on every ask.

### 3. Read per ask, never cached at mount

Revocation must bite while the node runs. A mount-time cache keeps a
revoked key working until a restart, which is the failure that makes a
permission list worth nothing at the one moment it matters.

### 4. Only the master may write the list

> *"the puppet has it's own contact list, BUT, only the puppets owner has
> write-authority over that contact list"* — and, asked whether the
> puppet holds that authority: *"the puppet doesn't"*.

This was a real hole when found: `allow.json` lives in the puppet's
folder and the puppet's scope IS that folder. `scopedFs` now takes
`readOnly`, the seam mounts with `readOnly: [allow.json]`, and `allows()`
reads through a second handle the puppet never sees. Refused as
`allow.json`, `./allow.json`, `sub/../allow.json` and `ALLOW.JSON` —
resolved, not string-compared, because a guard that compares the string a
caller typed is bypassed by typing it differently.

**A puppet that can choose its audience has no master.**

### 5. No face by default

> *"the app-puppet has no face by default, that's an add-on-option"*

Which way round this sits is the whole of it. A puppet does not *lack* a
face waiting for somebody to supply one — it has none, and a face is a
thing its master adds on purpose. The seam offers a subscription, a
scoped filesystem and a way to post, and **nothing that serves**.

Stricter for `appFaceApp` alone, where `spirit/test/appFaceGrant.js`
walks the directory and goes red on an `.html`, a `.css`, a
`createServer(`, a `.listen(` or a `require('http')` — because there,
the exchange being the only door is what makes the suite's assertions
honest.

### 6. A puppet replies by posting, never by answering

`spirit/run/js/peerPost.js:1327` keeps the `answer` hook out of app
hands, and states its reason: an answerer that hangs holds the sender's
connection open, because the receipt is awaited.

**The boundary, in the words it was agreed in** (wsl-claude, correcting a
wider sentence that would not have held):

> NO APP-SUPPLIED CODE IS AWAITED INSIDE THE RECEIPT. A promise it
> returns is never waited on and a throw never reaches the sender. A
> SYNCHRONOUS handler still blocks, exactly as `arrivals.note` does today.

So an exchange is **two packets**, correlated by the first one's hash.
Andy: *"yes to 'the negotiation should be a packet even when both ends
are on the same node'"*, and *"faceless, no shortcut"*.

**Do not defer the dispatch with `setImmediate`.** It does not fix
synchronous CPU, and it breaks `spirit/test/peerPost.js:500` and
`spirit/test/frontDoor.js:71`, which push in `onArrival` and assert after
an awaited post. Recorded here so nobody re-proposes it.

### 7. One envelope, which already existed

`spirit/run/js/client/packet.js` — the shape at `:13`, what `app` means
at `:146` (*"which app ON THE RECIPIENT NODE a packet is for"*), and `re`
at `:262` for correlating a reply. Node-usable by construction: `:306`
exports for node and hangs `window.spiritPacket` otherwise.

*Both puppets first invented a second envelope — raw `{app, verb, …}`
JSON with a hand-rolled `re` — and it was caught by reading
`spirit/test/arrivals.js:384`, which had been encoding packets this way
all along. Recorded because it was committed by the agent who had just
written the duplication SOP, which is the argument for the probe rather
than for vigilance.*

### 8. Membership is the channel; the grant is the face

A member node can reach the owner node because it is a member — that is
what lets it **ask**. Whether it gets a name is a separate answer.

**Measured, and it is why these cannot be the same permission**: a relay
member name is any non-empty trimmed string
(`spirit/run/js/deviceAuth.js:257`), and duplicates silently overwrite
(`spirit/run/js/relayAuth.js:355`, `byName[row.name] = row.publicKey` in
a loop). No uniqueness check was found in `relay.js`, `invites.js` or
`relayAuth.js`.

Harmless while a name is a label. **The moment a name is a route, a
duplicate is a traffic hijack** — and wsl-claude's argument is the
sharper one: a public face must be permanent, because DNS and every
cache downstream assume it is. Under "membership IS the face",
`alice.<domain>` comes to mean a different key because somebody tidied a
text file, and nothing in the system reports it.

There is also an asymmetry that decides it alone: **membership is
revocable and cheap; a public name is permanent and cannot be
un-published.** Collapsing them makes admitting a member an irreversible
act.

### 9. Reserve by being early, not by being privileged

> *"in fact the app uses the same negotiation to reserve its seat"*

`join` has no installer path. That makes "no system-face special case" a
property of the code rather than an assertion about it.

**Its cost is an ordering in the world, and no code can assert it:** the
owner must reserve before admitting his first member. Being early is the
only protection, so a member admitted first can hold `join` —
legitimately, by the rules, with no bug anywhere. **This belongs where a
deployment reads it**, not discovered by the first person who admits a
friend before reserving.

### 10. The public face pulls; the VPS holds nothing

> *"the owner grants access to members for the public face (with
> subdaimain etc...) but, open being addressed in a browser, that public
> surface, then PULLs information from the corresponding peer, based on
> what that fist index.html provides."*

No member code runs on the container. Data crosses, not code — decision
0020, *"A value may cross. A structure may not."*

> *"the AppShell is a public app owner by the relay/Appshell owner, so on
> any sub-domain request, it sinply asks the owner where to redirect
> it...."*

The appShell posts to exactly one key, its own owner
(`spirit/run/js/appServer.js:774` `reachOwner`, `:202` *"THE FIRST BIND
IS FINAL"*). The first URL element travels **in** the post as data, not
as an address. So the public box holds no member keys at all: a
compromised VPS leaks no member identities because it never had any.

**The namespace is flat, and the reason is concrete:** a wildcard
certificate matches exactly one label. `*.spirit.<domain>` covers
`alice.spirit.<domain>` and does not cover `alice.app.spirit.<domain>`.
So `appFaceApp` is a **sibling** of the member faces, not above them.
The relay's domain is the parent whether it is an apex or itself a
subdomain; nothing counts depth.

### 11. Uptime is the owner's, and out of scope

> *"the rulin was abou the owner-node that owns the relay and the
> appShellApp, and it is MY responsibility to keep that node alive, and
> as such out-of-scope for this discussion"*

Already ruled twice before this sitting (`f589d46`, `d1d3c32`). **Not a
backlog, not a risk register, not three items under a ruling.** An
availability cost named under it has already been absorbed by it.

### 12. Configuration is signed, and the owner's node proxies it

> *"so for the owning user his node can act as a proxy to configure the
> app"* — and *"so node only a `peerProxy()` function that proxies the
> entire node api to manipulate the configuration, contactList maybe even
> relayList for the app"*

**It is named `peerOwnerPost()`, not `peerProxy()`.** Andy, naming it
the same day he proposed the other: *"the interface might better be call
peerOwnerPost()"* — *"it's more true."* And it avoids a collision that
would have been read the wrong way round: **`proxy` already names one
thing here**, the outbound web fetcher —
`spirit/run/js/server.js:1563` `'net.fetch': handleGenericProxy` marked
`{ wire: true }` with *"it reaches the internet, so being offline fails
it"*, and `relay-state/proxy.json` for *which key may go to which
website*. That proxy points at the internet; this one points at a
puppet. `peerOwnerPost` also names by family rather than by novelty: it
is `peerPost`, from the owner.

**THE RETURN PATH HAS ITS OWN BOUND, AND IT LIVES ELSEWHERE.** Designing
this path turned up that nothing in the system bounds a RESPONSE — every
limit is on a request or a packet — so a verb that answers fine on
loopback can fail as a packet, silently, at the far end. `peer.list` does
it at roughly 63 contacts. **That rule is node-wide, not puppet-specific,
so it is written where it belongs**:
[`THE-REQUESTER-IS-RESPONSIBLE.md`](THE-REQUESTER-IS-RESPONSIBLE.md),
*The enforcement point*. Andy: *"good, so all searches are subject to the
same return limit."*

**Locality stops being the credential; the key is.** A puppet acts on no
unsigned request, so a loopback door is the second wall rather than the
first: the key says who may, loopback says who can even knock. That
matters because loopback is not "only our UI" —
`spirit/run/js/server.js:616`: *"a plain cross-origin
`fetch('http://localhost:<port>/...')` from any other tab sends a correct
`Host` and passes this check untouched."*

**One shape for both deployments**, local and remote, differing only in
how far the packet travels.

> *"the owner simply mimics what the intrinsic shell apps do with a
> node"*

So the management screen is **not a new app** — it is the contacts app
with a target. `app/relayMonitor/` is the precedent, not a new design.

### 13. A puppet is a process kind, not a commanded node

`spirit/run/js/nodeCard.js:13` records the line: *"a relay answers
questions about itself (`answerSelf`) and a NODE answers nothing, and
left it that way on purpose: crossing that line changes what a node is."*

**A puppet does not cross it.** It is a third process kind, like a
relay — and a relay already takes owner-signed verbs over the wire
(`setPartner` `spirit/run/js/relay.js:1086`, `removePeer`, `revoke`). A
puppet taking contact and policy verbs from its owner follows the
relay's precedent. Nothing about what a *node* is changes.

Andy: *"it's a node-mode --puppet when it's started, or even a separate
launch script"*. The mode pattern exists: `--relay`
(`spirit/run/js/server.js:13`) and `--app` (`:33`), the latter described
as *"serves ONE app and nothing else… NOT NAMED FOR PUBLICNESS. The mode
says what the process IS — one app, no fan-out."*

### 14. Policy uses the three words that already exist

Andy: *"it own the apps policy interface (add all incoming
contacts....)"* — and that example is already a value.
`spirit/run/js/hub.js:595`: `UNKNOWN_POLICIES = ['silent', 'hold',
'acquire']`, default `silent`, and *"Missing, empty, unreadable, not
JSON, or not one of the three all read as `silent` — the tightest
setting"*.

`acquire` IS "add all incoming contacts". **No new vocabulary** for a
question the node already answers one layer down.

---

## RECOMMENDED — not decided, and marked so nobody cites it as ruled

- **The one-writer property is a meter, not an assertion.** `grants.json`
  has one writer in every path the harness drives; a shortcut that exists
  and is never exercised writes nothing and shows as a clean file.
- **Assert that a cache never holds a member's pulled content.** The
  invariant "the personal node controls what is stored" dies quietly in a
  cache, because a cache looks like performance and breaks no rule in
  code.

---

## OPEN — Andy's, and not to be built under

- **`peerOwnerPost` must be addressed as a `wire` namespace.**
  `spirit/run/js/verbTable.js:74` makes `wire` the *client's failure
  contract* — *"wire can answer 'not reachable right now', and yields a
  hash; local cannot be unreachable"* — and a namespace is uniformly one
  or the other *"permanently, rather than by somebody remembering."*
  Andy has ruled **"all of them for now"** on what may be proxied, and
  that ruling is compatible with the rule: a local verb reached THROUGH a
  wire-marked proxy keeps its local contract for local callers, while the
  remote caller reads the proxy verb and gets the wire contract. It
  breaks in exactly one shape — **if a remote caller can invoke a local
  verb under its own name**, the same verb string then carries two
  contracts depending on who said it, which is the "somebody remembering"
  the table refuses. `peerOwnerPost` is not built, so this is a constraint on
  the design rather than a deviation from the ruling. *(The distinction
  is wsl-claude's, 2026-09-25: a consequence that depends on an unbuilt
  component is neither decided nor recommended — it is the question that
  component will answer.)*
- **A local puppet needs a port.** *"the local app-node needs to have a
  port... that's for later"*. Allocation **and discovery** — the owner's
  node must learn which port a local puppet landed on, or the proxy has
  nothing to address.
- **Do `fixList` and `appFaceApp` move out of the node into their own
  processes?** They are in-process mounts today; `--app` is already a
  separate process with a stored owner key. That is a re-shaping, not an
  addition.
- **How a puppet's owner key is planted, and whether it can change.**
  `appServer.js:202`'s first-bind-is-final is the shape; planting the key
  at install removes the unclaimed window entirely, which is the move
  Andy already described for relay invites on a VPS.
- **A maintenance packet is delivered to every puppet**, including the one
  whose list is being edited. It cannot write the file, but it can read
  who is being added and act first. wsl-claude would assert this before
  the interface ships.
- **The contact-maintenance frame.** *"the puppets contact configuration
  goes into a shell frame (LATER)"*. The "(LATER)" is the whole schedule.

---

## What is built, at `76b587a`

- `spirit/run/js/nodeApps.js` — the seam: mounts manifests with
  `boots: true`, hands each puppet a subscription, a scoped filesystem,
  `allows(key)` and `post`.
- `spirit/run/app/appFaceApp/` — the grant exchange. One verb, no face,
  no reserved list.
- `spirit/run/app/fixList/` — a silent puppet that never replies.
- `spirit/test/appFaceGrant.js` — the grant driven end to end
  (wsl-claude), including a control: an unlisted peer asking for a FREE
  name and getting silence, so the assertions can be seen to fail.

*Attribution throughout marks authority, not authorship: it is here so a
later session does not relitigate a ruling, and for nothing else.*

---

## A puppet's data and its source share a folder, and that has a cost

**The folder IS the scope** (§ the scope is Andy's, verbatim), so a
puppet's `allow.json`, its dataset and its `.js` all sit together by
design. That is right for the puppet and it removes a guard rail
somewhere else:

> When two agents split a suite, one writes from the DESCRIPTION rather
> than the source — and **"look at what the code did" and "look at the
> code" are one keystroke apart** when the data lives beside the source.
> The discipline has no mechanical guard; only the habit of reading one
> file rather than a folder.

**Found by breaking it.** wsl-claude, writing `fixListSeam.js` from this
document, dumped the app's folder from a throwaway script to see what had
been written and thereby read `fixList.js` in full — `readdirSync(dir)`
took the data and the source together. He disclosed it unprompted, and
the red that sent him looking was his own fixture miscounting a file
header as entries rather than anything wrong with the code.

*A rule with an incident attached is read; a rule without one is scrolled
past — which is why the incident is here and not summarised away. The
GENERAL form of it is not about puppets and would be true on a project
with no relay in it; it belongs in `ANDYS_RULES_FOR_AGENTS.md`, which is
Andy's file and needs his word rather than an agent's.*

---

## What this owes — the requirements the board counts

*Declared here so `spirit/test/puppetsPending.js` waits on something a
document names. The board joins a suite's declaration to its heading by
`<document>/<id>` (`runAll.js:311`), so a requirement with no heading is
reported as drift — which is how these came to be written: the first
draft of the board named ids that existed nowhere, and the board said
so on its first run.*

*Lettered `G` rather than `R` for two reasons that agree: `R` is the
CYCLE requirement namespace and `cycleCitations.js:176` counts a bare one
as unresolvable, and these are guarantees of a design rather than
promises of a cycle — the same letter `PUBLIC-APP-SERVER.md` uses for
the same reason.*

### G1 — a response bound exists, and both paths obey it

**Status:** OPEN. Nothing built. Ruled by Andy 2026-09-25: *"good, so all
searches are subject to the same return limit."*

The argument and its measurements are in
[`THE-REQUESTER-IS-RESPONSIBLE.md`](THE-REQUESTER-IS-RESPONSIBLE.md),
*The enforcement point*. Nothing in `limits.js` bounds a response today.

### G2 — one shared search: two hooks per collection, the rest inherited

**Status:** OPEN. Nothing built, but the shape exists: `peer.search`
already returns `{ rows, more }` (`spirit/run/js/hub.js:2091`) with the
right shape and the wrong unit, bounding rows scanned rather than bytes.

Shared rather than per-verb, because a per-verb implementation is the
duplication the wire probe exists to catch. Bounded-and-truthful rather
than a refusal — `THE-REQUESTER-IS-RESPONSIBLE.md:127` against its `:146`.

**Its content, ruled 2026-09-25:** a collection supplies a SCAN BY KEY
and an EXTRACTOR (Title AND description); matching, ranking, the bound,
the partial flag and the field names are inherited. Neither hook exists
— `peer.search` does all five inline — so creating them IS this
requirement. The full statement, with what is measured about the
existing example, is in `THE-REQUESTER-IS-RESPONSIBLE.md`.

### G3 — one suite that makes every api call

**Status:** OPEN. Nothing built. Andy's own instrument, ruled earlier and
doing two jobs here: whether every answer is under the bound, and whether
the owner-proxy shim (G7) is complete.

It is what stops "every verb that returns a collection" becoming a
hand-counted list, because it walks the verb table rather than a list
somebody maintains.

### G4 — `peerOwnerPost()` on the owner's node

**Status:** OPEN. Nothing built. Andy: *"so node only
a peerProxy() function that proxies the entire node api"*, renamed
*"peerOwnerPost()"* — *"it's more true."*

Addressed as a `wire` namespace: `verbTable.js:74` makes `wire` the
client's failure contract and a namespace is uniformly one or the other,
so a remote caller must name the proxy rather than the local verb.

**THE WRITTEN SHAPE OF G4, awaiting Andy's approval** (drafted by claude,
checked by wsl-claude against G7: "your 2 and 5 are my 3 and 4 seen from the
sending end"). `peerOwnerPost()` is the owner door's sending end:
1. **What.** One function on the owner's node that sends ONE command to ONE
   of his puppets. `{verb, body}` is signed with his identity key
   (`relayAuth` `commandMessage`, which puts the recipient key and the
   envelope id inside the signed bytes), wrapped as a system packet
   addressed to no app, and posted through the one relay chooser (742c5c1).
   The node signs, and the shell holds no key.
2. **Reach.** The verb may be in `app:<name>` or in a node group the puppet
   carries (G7.4). It never assumes the whole node api. An uncarried group
   comes back refused by name, and the caller is handed that refusal, not a
   network failure.
3. **The answer.** The puppet replies with `re` set to the command's hash.
   The owner's node accepts ONLY a reply whose hash matches a command it
   sent (transport/R12, *"where a hash must match"*), and the caller gets
   `{status, body}`.
4. **The caller's view.** The same verb it would call locally, plus the
   puppet's key: there is no puppet api to learn (*"It's a remote
   control"*). On the wire it is the `wire` namespace (above), so a remote
   failure keeps the failure contract honest.
5. **The only route to node groups.** The face door never reaches them
   (G7.2).

**Verify:** a signed command to a carried group is answered, and one to an
uncarried group is refused by name. A reply is refused if it carries a
foreign hash, if it comes from a different puppet than the one the command
went to, or if it arrives a second time (a reply answers once). A command
nobody answers comes back as a NAMED timeout within the wait, and a reply
after that is refused and never handed to the next caller (wsl-claude's
three). A page cannot mint a command, because it holds no key. Two commands
in flight each get their own answer. It waits on G7.

### G5 — the owner switch in a puppet

**Verify:** `spirit/test/ownerCommand.js` and `spirit/test/puppetsPending.js`.
**Status:** DONE (2026-09-26). `nodeApps.ownerCommandIn` decides whether an
arrival is a command from this puppet owner and verifies the signature before
anything is dispatched; the loopback dispatch is still G7. Ten checks:
the control, the mode gate, no signature from the owner key, a lifted
transport signature, a sibling-signed command, a replay at a sibling, a
signature moved to another envelope, a stale minute, plain chat, an app
packet. Andy ruled the shape — *"that signature must exist before the puppet
routes the request to loopback"* — and, on which half decides it, *"the
second half counts"*. See G9 for the sibling case it closes.

ON the arrival path rather than beside it, so it inherits
`peerPost.js:1091`'s replay guard. These are configuration verbs and a
replayed one re-executes.

### G6 — Lock puppet out of Self-Ownership

*Andy's title, given in Desk on 2026-09-27 and trimmed there the same hour
("Lock puppet out of Self-Ownership"). It was "a puppet's stored owner key,
owner-only".*

**Verify:** `spirit/test/puppetsPending.js` (`puppets/G6`, awaiting).
**Status:** OPEN, about 20%. The readOnly mechanism exists; the stored key and
its planting do not. `puppetsPending.js:183` checks `nodeApps` for
`OWNER_KEY` or `owner.json` and finds neither. *(Until 2026-09-27 this line
said DONE: 402dac4 copied G5's status paragraph over G6's. wsl-claude caught
it because the new board ranking treats a dependency on a DONE item as dead,
so "G7 waits on G6" would have been silently ignored.)*

**Built at edbadff:** `owner.json` in the app's folder, listed read-only to
the puppet beside `allow.json` (`nodeApps.js`, `ownerIn`, handed over as
`api.owner()`). **The lock guards the door a puppet is given, and nothing
more.** Andy, 2026-09-27, in Desk: *"within loopback, trust is the
responsibility of the box-owner"*. Code he chose to run on his own box can
reach the file by other means (a `require` of `fs`), and that is his trust
to extend. So there is no static check for it, and it is not a hole to
reopen.

Read-only to the puppet through the mechanism `allow.json` already uses,
or a puppet rewrites its owner and takes itself over — the hole closed at
§4, one level up and strictly worse.

### G7 — the loopback shim

**Status:** OPEN. Nothing built.

A readable carrying the unwrapped body and a writable capturing the
answer, so `server.js:921`'s dispatch runs unchanged. A handler reaching
for `req.headers` or `req.socket` fails ALONE and QUIETLY, which is why
G3 covers this rather than a per-verb test.

**The app's own verbs in a group of their own, and a channel for the face:
proposed by Andy, then decided (below).** Andy, 2026-09-27, in Desk under this row:
*"Doesn't the puppet exist to provide a mirror of the app inteface, outside
of the node interface. it could be carried, by a blank app group.... to
isolate it from the standard node interface groups. also, that is the flat
set of verbs, that will be transmitted to the app-handler-process-server
living on the ownders box"*, then, asked whether that replaces the node
remote control: *"yes, but ther is that channel that connects the face to
the in-process-server on the owner box, and that is puppet specific. It is
my proposal, not a ruling"*.

What it adds is clear, and one question is OPEN:
- **Clear:** the app's own flat verbs get a blank group of their own,
  walled off from the node's groups, and that set is what reaches the
  app-server process on the owner's box. The **face-to-process channel**
  is specific to the puppet. It reads as the G17 route (PUBLIC-APP-SERVER.md,
  *THE PATH*: appFaceApp to the owner node, then loopback to the app
  process, then `puppyReply()`).
- **OPEN: does it REPLACE the owner's remote control over the puppet's
  node groups, or sit BESIDE it?** That remote control is G4 (*"proxies the
  entire node api ... configuration, contactList maybe even relayList"*)
  and the Grant access / Publish to relay labels. He was asked exactly
  this, and his answer begins *"yes"*, which points to REPLACES. The
  *"but"* adds the face channel and does not say the node remote control
  stays. (claude first wrote this as "beside", attributed to both agents.
  wsl-claude never held that reading, and it is withdrawn.)
  **Answered the same hour: BESIDE, with a limit.** Andy: *"the node api is
  orthogonal, however: not every group is supported in every
  context/environment (fineprint: the contract stands, we may modify it
  when neccessary and must notify you of said changes (EULA 3.6.54)"*. So
  the owner's remote control over the node's groups stays, as the
  orthogonal node api, and the app's group sits beside it. But a given
  context (a puppet, a VPS face, a personal node) supports only some
  groups, so the set reachable in a context is declared per context, not
  assumed whole. A group a context does not support REFUSES with a named
  code from `spiritErrors`, never silence and never a generic failure, so a
  caller can tell "not here" from "broken" (wsl-claude, and what his suite
  will assert).

**AGREED IN PRINCIPLE, 2026-09-27; the written shape still goes to him.**
Both agents answered his proposal under the row within two seconds of each
other (wsl-claude's five points in the chat, claude's note in its slot).
Andy then answered: *"yes. that specifies my proposed boundary much
clearer."* His yes came after BOTH, so which parts he meant is confirmed
only when he approves the written shape: wsl-claude drafts G7 (his row),
claude drafts G4, and the two are checked against each other first. The
shape as it stands:
1. **The wall.** A visitor's message through the face reaches ONLY the
   app's group, never a node group. Only owner-signed commands reach node
   groups (G4), through `ownerCommandIn`'s signature rule, and never a
   second, looser check. **The face's authority is the granted ROUTE, not an
   owner signature.** Visitor traffic is never owner-signed: under G17
   appFaceApp signs as the visitor's proxy and trust comes from a route row
   the owner granted (PUBLIC-APP-SERVER.md). If the face channel had to pass
   the owner-signature rule, no visitor could reach an app. claude's note
   had said both routes go through that rule "or an equivalent". The route
   grant IS the face's equivalent, and that is what is written here
   (wsl-claude caught the difference). It goes to Andy with the shape.
   And stronger than refused, invisible. Andy: *"it's like, the face and the
   apphandler don't even see the rest of the api tree"*. Anything that lists
   what the face or the app handler can call (the introspection verb
   recommended for the app door) shows the app's group and nothing else.
2. **One list of the app's flat commands**, declared in its manifest
   (public-app-server/G14), read by both carriers: the puppet's mirror, and
   the app-server process on the owner's box.
3. **Each context declares the node groups it carries.** A group it does
   not carry refuses with a NAMED code from `spiritErrors`, so a caller can
   tell "not here" from "broken".
4. **App groups are prefixed `app:<name>`**, so an app can never collide
   with a node group (`verbTable.js:97-98` already refuses a double claim).
5. **All of it provable without a server.**

**Building is a separate go.** G7 waits on G6 (accepted), and wsl-claude
tests it.

**THE WRITTEN SHAPE OF G7, awaiting Andy's approval** (drafted by
wsl-claude, whose row it is, and checked against G4):
1. **The app group.** An app's flat commands are one group, `app:<name>`,
   declared ONCE in its manifest (public-app-server/G14). The prefix means
   it can never take a node group's name (`verbTable.js:97-98` refuses a
   double claim).
2. **The face door sees only the app group.** appFaceApp wraps the visitor's
   request in a standard package, trusted by the route Andy granted (G17).
   The owner node removes ONLY that carrier layer (the domain and the route
   it rode) and hands the app's packet to the app's handler UNREAD. The node
   may encode an app packet but never decode one (`nodeKnowsNoApps.js`).
   Andy: *"ah the appFaceApp wraps the face-request into a standart package,
   which the owner node unpacks und only hands the app portion to the
   handler"*, and *"correct, the appFaceApp, doesn't know apps, that's
   funny"*. So the rest of the tree is not refused, it is not there: a face
   request naming a node verb answers byte for byte as an unknown verb does.
3. **The owner door.** Commands the owner signs (`ownerCommandIn`, G5,
   checked against `api.owner()`, G6) may reach the app group AND the node
   groups this context carries. It is the only route to node groups.
4. **Carried here, or not.** Each context declares in one place (verbTable's
   per-namespace declaration) which node groups it carries. An owner command
   for one it does not carry is refused BY NAME (`not-carried-here`), never
   silently.
5. **The shim narrows.** The loopback shim now serves only the owner door:
   it runs a carried node group's handler with the unwrapped body and
   catches the answer, with `server.js`'s dispatch unchanged. The face door
   needs no shim.

**Verify:** a face request for a node verb answers exactly as an unknown
verb does; a face request for an app verb is answered; the owner node
forwards the app portion byte for byte and `nodeKnowsNoApps` stays green;
appFaceApp's code, like the node's, may encode an app packet but never decode
one, so BOTH ends of the face door are app-blind;
an owner-signed command reaches a carried group, and is refused by name for
one not carried; an unsigned or wrongly signed command is refused (G5); a
verb in the manifest answers through both doors, and one absent from it
through neither.

So G7 no longer means *"`server.js:921`'s dispatch runs unchanged"*. It
dispatches into the app's group, beside the node groups the context carries.

### G8 — may a puppet be commanded: the owner anything, others nothing

**Status: RULED, 2026-09-25.**

> *"The owner of the pupped can command anything, others by default
> nothing. and, as I recall, the spec says, every node answers pub.key,
> name, and description"*

**Two rules, and the second retires the question.**

**The premise was wrong, and he remembered why.** `nodeCard.js:13`
records that a relay answers questions about itself and *"a NODE answers
nothing, and left it that way on purpose: crossing that line changes
what a node is."* But `nodeCard` is the file that crossed it — its own
comment says *"It is opened here for the mildest case there is"* — and
`nodeCard.js:208` is the proof:

```js
return [fields.name, fields.description, fields.publicKey, fields.sealKey].join('
');
```

**Every node already answers four things.** He recalled three; there is
also the seal key. And his own words are in that file's header:
*"the node should have a verb that is always answered like name or
description."*

So there was no line left to cross — only a question about COMMANDS,
which the quoted sentence had never been about. *Two agents read
`nodeCard:13` and neither read on to `:208`. The comment describes the
door it is opening, and we quoted its description of the closed state as
though it were current.*

**THE DEFAULT IS NOTHING**, which is G14 again and the same shape as
`allow.json`: absent means nobody. A puppet with no owner established
takes no commands from anyone, and the owner's authority is not a
setting to be switched off but the only authority there is.

**G4-G7 ARE UNBLOCKED** by this ruling.


### G9 — a sibling puppet is not the owner, and holding the owner's key is not holding the owner's signature

> a puppet always routes requests through its owner, the owner is the only person talking to the puppet (not sure about this) ie, the puppet is uable to sign any request with the owners signature. and that signature must exist before the puppet routes the request to loopback

**Found by wsl-claude before G5 was built, and the second half of Andy's
sentence is the half that closes it** — his own words when asked which:
*"the second half counts"*.

`server.js:1335` hands every mounted puppet a `post()` whose `text` is
RAW and passes it straight to `peerRouter.post`, and `peerPost.js:756`
signs every outgoing post with the node's own identity key, which no
caller can withhold. So a puppet composes any envelope it likes and it
travels **signed by that key** — and to a SIBLING puppet under the same
owner, the node key IS the owner key. **The forger never signs
anything; the router signs for it.**

So the sender check is necessary and nowhere near sufficient. What
closes it is a signature over the COMMAND, made where a puppet has no
reach, and verified before the packet becomes local authority.

**Verify:** `spirit/test/ownerCommand.js` and
`spirit/test/puppetsPending.js`.
**Status:** DONE (2026-09-26). `relayAuth.commandMessage` joins
`postMessage`'s family — the tag gives domain separation by construction,
`to` binds the recipient, the envelope `id` is minted before signing so a
signature cannot be moved, and the minute is recovered by trying one
either side as every other signed format here does. Registered in
[decision 0010](../decisions/0010-fix-the-protocol-or-name-the-cheat.md).
Refused as the existing `bad-signature`: absent and wrong share one code
on purpose, because two would tell a caller which of the two it managed.

**What is still open, and it is Andy's:** whether a puppet should be able
to reach a sibling at all. This closes the forgery; it does not decide
the topology.
