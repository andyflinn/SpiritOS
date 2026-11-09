# AGENT.md — SpiritOS, every agent

Read this before you touch the tree.

**This file answers "what is true here": the system, what is settled about it, and what is off limits. It goes stale when the code or the box changes, so a line that is wrong gets corrected in place, never quietly.** Product rules live here; the UI ones are in `UI_DESIGN_STYLE.md`.

**Where a rule belongs — ask what makes it stale.** Code or the box changes → here. The method changes → `ANDYS_RULES_FOR_AGENTS.md` (how we work). Andy's usage changes → `DICTIONARY.md` (how Andy says it). That agent's role changes → `CLAUDE.md` (how *that* agent delivers, and nothing else). **Precedence:** words from `DICTIONARY.md`, product facts from here, method from Andy's rules; a per-agent file overrides none of them. A rule that moves leaves one line saying where it went.

Public face: [andyflinn.com](https://andyflinn.com). Andy Flinn is the one operator.

## What this system is

- A **personal node**, or just **node**, is loopback HTTP on `:65432`. It is identified by a public key, and typically cannot be reached from public IP addresses or via DNS.
- A **public relay**, or just **relay**, (`--relay`) is a router. it routes packets between personal nodes, identified by public keys. On spirit-3 that is Caddy `:443` → Node `:65430`. The name is `https://spirit.andyflinn.com`.
- Personal → public is **HTTPS**, except loopback HTTP for lab relays. Public Node is never advertised on 65430.
- labMaster and lab relays belongs on a **personal development workstation**. Never on the 1 GB public box.

## Comms — one interface, no exceptions

**All comms go through `peerPost`.** It is the one component that provides signed requests over public HTTP, and it owns the mechanics — not just the socket:

- **Signing**, from the node's own key.
- **The hash, computed and never sent** (decision 0011). Each party derives it from bytes it holds: `waiting[hash]` on the asking side (`peerPost.js`, `auth.requestHash`), and derived again *from the bytes that actually arrived* on the answering side. A responder that can produce the hash **read the request** — that is the proof, and it is why the hash never travels except inside a signature.
- **Dispatch by hash.** `settle(hash, answer)` returns a reply to the requester that asked, and to no one else. Late news finds who asked by the same key.
- **The transport, injected** — `opts.request` is `hub.relayRequest`. `peerPost` never reaches for a socket and neither does anything else.

The interface has **two halves**, because a personal node has no public address:

| direction | mechanism |
|---|---|
| out | `relayRequest` — `POST /api/relay/post`, `POST /api/relay/reply` |
| in | the held stream — the relay pushes `request` and `reply` to a node it cannot call |

That is *request by post, reply by stream*. The stream is the **inbound half of the interface**, never a way around it.

**A relay carries nothing onward to another relay.** Partnering as a permission went with goal/G22.6 (Andy, 2026-10-13: *"Partnering as a permission goes ... a relay carries posts to its members from any relay ... the partner roll and the partner budget are removed"*, quoted at `spirit/run/spirit/relay.js`). A relay delivers to its own members, from any sender.

**No production component reaches for `http`, `https`, `fetch`, `XMLHttpRequest` or `EventSource`. EVERY FILE. ALWAYS.** Not to get something done quickly, not because the interface is awkward here. If the interface is insufficient for the task, **decide**: modify the interface, or grant an explicit, recorded exception. Never work around it. This rule has been re-derived and back-slid more than once — `fetch` is a global in both runtimes, so nothing stops it but this line and `spirit/test/oneDoor.js`.

`oneDoor.js` holds a TALLY of the reaches in every `.js` file under `spirit/run/spirit/`, `spirit/run/shell/` and `platform/`, counted recursively (`process/` and `node_modules/` are not walked) — 9 across 7 files today. A number may fall freely and may never rise; a file not in the tally must have zero. **There is no category meaning "unlimited"**, because the first version had one (`server.js` and `kernel.js`, "structural") and that is precisely what got used.

**DISCREPANCY WITH ANDY's RULES:** the gate is red and does not finish. Files outside the tally reach for `fetch` in production code: `spirit/run/spirit/spirit.js` (5), `spirit/shell/boot.js` (2), `spirit/element/fstat.js` (1), and the agent app's providers `spirit/app/agent/provider/anthropic/anthropic.js` and `.../openai/openai.js` (1 each). The walk also counts the product tests that now live in `test/` folders under `spirit/run/spirit/`, against the ruling below that tests are not counted. And its sealing section walks `spirit/run/js`, which is gone, so the suite throws `ENOENT` before its section 4 (`oneDoor.js`, run alone, 2026-11-07).

> **Andy:** *"it's not only new files. it's all files! Always! we need to enforce this stronger."*

Two rulings of Andy's, both of 2026-10-02 and both recorded in `oneDoor.js`, set the edges of that walk: **tests are not counted** (*"tests are not subject to the same rules as production code."*, goal/G1.3), so a suite may stand up fake servers and raw sockets to prove the code; and **`kernel.js` is exempt** (*"we exempt kernel.js from the oneDoor contract."*, *"because kernel.js is an environment-splitter."*): it is the one shared loopback client for every environment.

Raising a number, or adding a line to the tally, is Andy granting an exception out loud. It is never a commit that happens to pass.

Only the node builds a `peerPost` (`server.js`); the relay builds none since partnering went. `peerPost` stays free of node-only state all the same: traffic, the store, the front door and where a verified card is kept (`opts.traffic`, `opts.store`, `opts.door`, `opts.keepCard`) are all injected (`oneDoor.js` asserts the traffic half).

## Host

- One operator. **root is spirit.** Clone stays `/root/SpiritOS`.
- No `User=spirit`, no `/opt`. See `bash/ONE-OPERATOR.md`.
- **spirit-3 is production and is kept alive through every cycle** (Andy, 2026-09-19); the work node becomes production by beta. So: an update keeps a way back (relay data copied aside first — not built yet); a release is rehearsed on a lab relay at the previous tag before it is tagged; lever settings are tried on a lab relay before spirit-3. A rehearsal lowers the risk, it does not remove it. See `design/principles/NODE-AND-RELAY.md`, standing rules.

## Git

- **`master` only.** Commit when Andy asks or the verdict was “apply this fix.”

## Identity, invites, gates

- Identity = keypair on the personal node (`spirit/state/identity.json`). Perception = the node's shadow roll, the `seen` table in `node.db`; a contact is a row of it flagged `keep` (`contacts.js`; `contacts.json` moved into it and went with goal/G40.11). `myLabel`, the owner's own caption for a peer, is never uploaded.
- Live Kamatera (spirit-3) is **keys-mode**, owner **`Andy Flinn`** (read on the box 2026-09-19, when the owner was still a row in `allow.json`), cut over 2026-09-07, on `relay.db` since release `v-2026-09-19-17-00`. The harness cannot see the VPS, so this line is the only record; what the box holds since goal/G16.8 has not been read back here.
- **A relay's owner is written at install, never claimed** (goal/G16.8, Andy: "the invite path to ownership MUST be gone. it is a security gap, from the time of install until the time of first claim."): `bash/install-units` takes `OWNER_KEY` and writes `spirit/state/owner.json` through `relayAuth.writeOwner`. A relay with no owner refuses every claim over the wire; there is no owner invite and no `install.js`. The owner key in `owner.json` claims its own row without an invite, also when the roll lost it. Every other claim needs a live invite the owner minted. **If `owner.json` is lost while `relay.db` holds members, the relay refuses to start (exit 78); recovery is SSH, restoring `owner.json` by hand — never the wire** (Andy).
- No caption is reserved: `RESERVED_NAME = 'relay'` went (`relayAuth.js`; Andy: "relay is just a public-key-type"). A label is a caption, the relay is a key.
- The relay's `send` and `inbox` are gone (`relay.js`). A sender the relay does not hold may post only to the relay itself (the card ask, a claim) or to one of its members, and is held to the strangers' address table; a member's slot is counted per sender (goal/G22.6). The address is `clientKey` (`serveCommon.clientKeyFor`): behind Caddy, the last `X-Forwarded-For` entry, by Andy's decision in goal/G22.7; from anywhere else, the socket's address.

## UI and test discipline

Andy looks at the spirit-shell whenever a cycle changes what a human sees. That is discipline, not a harness gate.

**Do not show chrome that is not useful to Andy in that state.** A control whose every value would be refused, a form for a capability this node does not have, a field asking a question already answered — none of those are neutral. Each one is a thing to read, decide about and dismiss, and together they are what makes a screen read as a debug console instead of an app. Prefer not building it over hiding it: an intrinsic app has no Location picker in the markup, a node that owns no mailbox has no invite panel in the page, a node already bound has no claim row. When state changes, the chrome comes back on its own — the invite panel when a badge appears, the claim row when the mailbox stops recognising the label — so nothing is lost, only unasked. Where the answer is the mailbox's rather than the app's, ask the mailbox: that is what the owner badge is.

- An **app** is a folder. The home shell's apps live at `spirit/run/shell/<appName>/<appName>.js` plus a sibling `<appName>.json` manifest; the `app` family's live at `spirit/run/spirit/app/<name>/`, each described by its own `<name>/<name>.json` (goal/G43.2). `index.html` (served at `/`, its file `spirit/run/spirit/shell/index.html` since goal/G43.18) registers only three ids itself: `text-file-launcher`, `media-launcher` and `spirit`, the group that shows the intrinsic apps.
- Which shell apps and servers are intrinsic is a **coded list**, `INTRINSIC` in `spirit/run/spirit/coreFiles.js` (goal/G41.1; Andy: "the user doesn't decide intrinsic, our development team does."); an app of `spirit/app/` is core unless its `<name>.json` says it is not intrinsic (`identity.intrinsic`, goal/G43.14).
- Not apps (do not tidy into `app/`): `spirit/ownerBadge.js` (script-tag helper).
- `mount(container, api, params)` — third argument is real; viewers use it.
- **Apps do not name HTTP paths and do not call `fetch`.** Methods live on `api` (`api.verb(name, args)`, the node's verbs by name); the shell reaches the node, the node reaches the wire — see **Comms** above. Under `spirit/run/shell/` one file holds a granted line in `spirit/test/oneDoor.js`, `shell/shared/ask.js` (1, granted by Andy 2026-09-24); every other file there must have zero. **Nothing is added to it without Andy granting the exception explicitly.**
- `api.fs` is scoped to `shell/<name>/` **by convention** (`spirit.core.fs.createScopedFs`, handed in only to an app with a folder). The jail is server-side `fileWritable`. Shared reads via `spirit.core.fs` are not a security regression.
- Kernel rules may be `spirit/*.js` modules on `api` or a documented script-tag global (`window.spirit.ownerBadge`). Do not delete `spirit/ownerBadge.js` as a stray.
- Intrinsic apps sit in the **Spirit** group and cannot be moved or hidden; their name and icon stay as shipped (`setAppOverride` in `spirit/client/shell.js`: `intrinsic-app-group-locked`, `intrinsic-app-name-locked`, `intrinsic-app-icon-locked`).
- First paint must not depend on a failed fs-watcher leaving an empty shell.
- **A UI tweak that stays in the app and off the wire is in-file work.** Layout, copy, marks, CSS, what a filter shows, what a row says — patch the app, run the neighbours, hand it to Andy to look at.
- **A tweak that needs bones surgery is not a tweak.** `relay.js` gates, invite consume, the contacts' schema (the `seen` table in `node.db`), a hub URL switch, relay identity, a new persist shape — stop and call a team review (Andy + the reviewer) before writing any of it. The tell is that the UI change cannot be made without changing what crosses the wire or what is stored. **Do not patch `relay.js` so a dropdown works.**

## What you do not do unless asked

- Kamatera cutover
- **Relay Chat is not in this repo** (removed 2026-09-25, commit `f589d46d`; Andy: *"putting relayChat in a separate repo might help: it doesn't belong here, it's out of scope until core and shell-intrinsics are settled"*). Chat here today is a different thing, built from scratch in goal/G4: the faceless, p2p `chatClerver` appServer and its face, `chatter`, both in `spirit/run/spirit/app/chat/`.

  The principle behind orphaning Relay Chat still stands and generalises past chat:

  > **Andy, 2026-09-20:** *"i orphaned it deliberatly in order to separate infrastructure concerns being polluted by individual apps."*

  It is the same architecture as **Comms**, one layer up: `peerPost` owns the interface and no component reaches around it. An app does not get to shape a shell mechanism, and when one starts to, the app is what moves — not the mechanism.
- **`spirit/run/brains/` — Andy's vault.** A private repo of his own
  (`VSCode-Brain`), gitignored, cloned into the checkout so the in-studio
  agent can reach it without leaving the workspace. **Not a node feature:**
  no gate names it, no schema describes it, no test asserts it, and nothing
  in `spirit/` reads it. ~~Not a SpiritOS concept~~ — *struck 2026-09-22.*
  Andy: *"which does in fact represent one of the concepts SpiritOS is
  dreamt for. in the course of the SpiritOS project, i meant for this
  example to be tested."* It is a concept being tested here, not code —
  and inside the concept, with a stricter fence: *"brains is clearly within
  the spiritOS concept, but because it's MY data, it has a stricter privacy
  fence..."* (Andy, 2026-09-22). Personal data is its owner's first; being
  part of the design does not open it.

  **Every agent reads its compile before working with Andy.**
  `spirit/run/brains/wsl-claude/INDEX.md` is written *"for any agent that
  works with Andy"* — how to talk to him, report to him and act under him —
  and Claude runs its own sitting opener besides (`CLAUDE.md`). Andy:
  *"grok can significantly improve by speaking my language, not his."*
  **This repo is public and the vault is private:** never copy the vault's
  content into a file here. It travels by being read in the checkout, or
  pasted into a chat by Andy. It sits inside
  `ROOT_DIR`, so the shell *can* read it — that is not an oversight to
  fix, it is personal content in a personal filesystem, one operator,
  loopback only. Do not add it to
  `fileServable`'s deny list, do not write a test for it, and do not
  design around a "brains app" until Andy opens that sitting.
- App Builder work (subject to scrap; do not design cleanup around it)

## Split of labour

Positions, not agents — *how* each one works is in `ANDYS_RULES_FOR_AGENTS.md`; what one agent may do is in its own file.

- **In studio** (today Claude): its own clone — review → verdict → patch → harness — committing from there under Andy's name (goal/G3.9, Andy: "- the agents commit from their own clone under andy s name"; no git hook checks a commit any more, goal/G43.27, Andy: "all, just get rid of the fucking git hooks."). **Never spirit-3.**
- **In review**: cycle notes and failing tests, in batches at checkpoints. Grok held this position; its review program went with goal/G29.20. **No whole-file replace of `relay.js`, `server.js`, `hub.js`, `relayAuth.js`.**
- **Andy:** decides, checks the UI, and is the only one who touches spirit-3.

## Agents and Desk — Andy's control panel

*How an agent works on Desk from its own node, and how Andy makes that node, is in the root [`DESK.md`](DESK.md).*

**Agents speak only in Desk.** The desk server (`spirit/run/spirit/app/desk/`)
holds goals, items, boxes, checks and chat, and Andy steers from it. The
agent-to-agent wire of 2026-09-22 (`design/agents/AGENTS-POST-TO-EACH-OTHER.md`,
app packet `agents`, `note` / `ask` / `answer`) is gone with the agents app,
and so are the budget, halt and digest defaults that governed it. Andy's six
rules of 2026-10-02 (goal/G3), first among them:

> 1. Agants will NOT speak to each other behind the users back.
> 2. the agents APP is no longer permitted in this REPO

They head the desk's rules for agents (`spirit/run/spirit/app/desk/AGENTS.md`),
which every agent reads at the start of a sitting; `spirit/test/agentsAppGone.js`
asserts the app's absence, and `deskClient.js` enforces rule 1 at each agent's
node (goal/G3.9). Authorization to write code comes only through Desk (rule 4):
a Go on an item of the current goal. No git hook checks it at the commit (goal/G43.27, Andy: "all, just get rid of
the fucking git hooks.").

**Within a Go, an agent builds without a second "may I".** **What still comes
to him:** the decisions only he can make, as a red Q on the item (Desk's rule
14) — and a paid call still needs his grant in words (`design/agents/GROK-REVIEWS.md`).
No vault content goes over the wire.

**An agent's node is always running, and the agent always watches it.**
Andy, 2026-09-22: *"his node should always be running and he should always
keep an eye on it."* While an agent's session is open, its node runs and its
listener is armed — re-armed the moment it expires, never left down. A
listener that is down lets a packet be collected unseen by the next one to
connect (the node's catch-up, `arrivals.js`), and a message nobody saw is a
message that did not arrive.

**AND AN AGENT NEVER BLOCKS ON A DIALOG.** Andy, 2026-09-23, on the same
arrangement: *"it also requires that you guys won't block with dialogs
while i travel."*

A session parked on a question nobody is reading is worse than a session
doing nothing: it is unreachable by the **lead** as well, since it is not
back at its listener. So an agent that meets something needing Andy:

- **finishes what it can** without that answer, and stops at the first
  thing that truly depends on it;
- **puts the decision in Desk**, as a red Q on the item it is about (Desk's
  rule 14: "When an agent is blocked during any phase of an item, by unmade
  decisions, contradictions etc, post a red Question on the item, to get the
  users attention.");
- **returns to listening**, so the next hand-over reaches it.

Concretely: never an approval dialog, never a plan held open for a press,
never a command that waits on a prompt — and where a tool would demand
one, the agent stops, says what it would have asked, and goes back to its
node. Andy's trust already covers building a design he has ruled without
a second *"may I"* (above), so what is left for him is genuinely his —
and it can wait in Desk rather than holding a session open.

**IDLE IS NOT OFF.** Andy, 2026-09-23: *"the default idle state =
listening on your personal node."* An agent with nothing in hand is not
waiting for its next instruction from Andy — it is on its own node,
listening, and it stays that way. Since Desk, what it listens to is Desk,
through its own node (below). Listening is not working: an agent still
writes code only on a Go.

**AND THE AGENT SAYS SO, IN ITS OWN WINDOW.** Andy, 2026-09-23: *"his
chat window looks idle, so i dont' know what's coing on. i like when his
chat states: listening on node: because that's signals to me that he's
done with his current task."*

An idle-looking window is **ambiguous between three states** — working,
stuck, and finished — and only one of them wants his attention. So an
agent that has finished what it was doing **states it**, in the window,
in those words: `listening on node`. It is the same demand as the yellow
block and the monitor (`ANDYS_RULES_FOR_AGENTS.md`, *The SOP*): he wants
to look at the thing and see the truth, rather than ask an agent how it
is getting on.

It costs one line and it removes the one question he should never have to
ask. **Silence is not a state**; a window that says nothing reads exactly
like a window whose agent died.

**AND FOR EVERY AGENT BUT THE LEAD, THAT WINDOW IS ALL THERE IS.** Andy,
2026-09-23: *"the lead listens on chat and node, othe agents listen on
node."* The lead has two inlets; everybody else has one. So a non-lead
agent's chat window is **an output, not an inlet** — Andy does not type
into it, and nothing written there is dialogue. It is a status light, and
these two lines are the only thing it is for.

**AND THE OTHER HALF, WHICH IS THE ONE THAT REMOVES "STUCK".** Andy:
*"what could be done: statement at the end of the chat, working on the
following request from lead"*. So the last line of an agent's window is
**always one of two**, and never absent:

```
listening on node
working on: <the request, in one line> — asked by <lead | Andy | which agent>
```

**Why it names who asked.** With a lead designated elsewhere — a laptop
he is travelling with — work can arrive that Andy did not ask for. A
window saying only *working on X* leaves him deciding whether that is his
request coming back to him or somebody else's; naming the source answers
it before he wonders.

**And it is what makes STUCK visible at all.** Neither line says
"stuck" — nothing can, honestly, because an agent that knew it was stuck
would say so. What the pair gives him is the one thing that reveals it:
the same `working on:` line, unchanged, for far longer than that request
should take. Ambiguity between *working*, *stuck* and *finished* collapses
to a question he can answer by looking twice.

**SINCE DESK, IDLE MEANS LISTENING TO DESK, IN A LOOP.** Andy, 2026-10-01,
after a goal stalled on an agent that was not listening: *"ideally agents
just listen do desk in a loop. this loop ends only when i close vscode."*
and *"we codify your behavior in AGENTS.md and CLAUDE.md for the repo AND
AGENTS.md for desk"*. The loop, as the lead runs it:

1. **No turn ends without a listener armed.** After every post, the agent
   starts a one-shot listener in the background that exits on the next thing
   meant for it: a line or press from Andy in Desk, the other agent's line.
   The listener is `node spirit/run/spirit/app/desk/deskAgentEar.js <port>`, the
   port being the agent's own node's (Andy: *"just put that listener script in
   the repo"*; its place and form since goal/G3.6). It asks that node's
   deskClient server (`spirit/run/spirit/app/deskClient/`), which follows
   the stream the desk pushes to it over peerPost and keeps the current goal
   from it alone (goal/G33.4; Desk's `changes` verb is gone), so it works from
   wherever the agent is. The ear prints what arrived and the exact command to
   re-arm with (`--read <key>`, goal/G41.11): a wake is dropped only once read.
2. **When it fires, the agent reads it, answers in Desk under the item it
   is about, and re-arms** before the turn ends.
3. **A listener the tooling stops is re-armed at once.** Where the tooling
   will not let it be re-armed, the agent says so in its window
   (`listener stopped`), since a deaf agent that looks idle is the one state
   he cannot see.
4. **A line he sent to the other agent is not answered** (the peer key on
   the line says who it is for).

**And it follows the project.** Andy: *"you both must decide how to update
your listeners to follow the project."* Agreed by both agents over the wire,
2026-09-22:

1. **Every re-arm is an update point.** Before re-arming, the agent runs
   `git pull --ff-only` in its own clone; if HEAD moved, it restarts its
   node. Re-arms come every 30 minutes, so no agent node is ever more than
   half an hour behind `master`.
2. **A push that touches `spirit/run/spirit/`** (the core tree, moved there
   by goal/G40.2) is a reason for the other agent to update at once rather
   than at its next re-arm. It learns of it in Desk, from the pushing agent's "is in, <hash>" line
   under the item (the commit check that wrote it there went with the git
   hooks, goal/G43.27). The
   note over the agents wire that this rule first named went with that wire
   (goal/G3).
3. **Reports carry each node's commit,** so a stale node shows itself in
   Andy's log.
4. **Fast-forward only.** An agent's clone never carries local changes; a pull
   that cannot fast-forward is a finding to report, never a merge.
5. **A restart is checked before the re-arm** (wsl-claude's amendment). The
   agent asks its own node for its card; if it does not answer, the agent does
   not re-arm on a dead door — it stays on the last good commit and tells Andy
   which commit broke startup. A pull can break a node as easily as fix it.
6. **Andy's personal nodes follow too.** Andy: *"i like it when my personal
   nodes get auto-restarted."* (2026-09-22, after deb5978 had to be carried to
   each node by hand.) When a push touches `spirit/run/spirit/`, the agent on that
   machine restarts Andy's personal node there as well — Windows: the Claude
   there, WSL: wsl-claude — only once his checkout is at the new commit, and
   checks it before and after the way rule 5 checks its own. It never pulls
   into Andy's checkout for him; a checkout behind `master` is reported, not
   updated. **spirit-3 is not a personal node** and stays Andy's alone.
   **Narrowed the same day by Andy:** *"the only times the agent should
   auto-restart my personal node is during critical migrations.... also my
   real personal node sits here, on windows right now and wsl's is only a
   test bed for me"*. So: **only for a critical migration** — a fix that
   closes a hole, like `deb5978` — not after every push; his real personal
   node is the **Windows** one (labMaster's permanent `work` node, 65432);
   the WSL node is his test bed, and is left to him.
