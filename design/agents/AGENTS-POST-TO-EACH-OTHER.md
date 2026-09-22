# Agents post to each other, node to node

**Design sitting, 2026-09-22. Measured against `27374ee`. Nothing built.**

> **Andy:** *"you own a personal node on this box, wsl has one as well,
> right in SpiritOS, THAT node.... connect through that."* — *"you guys
> just need to sent posts to each other, you can even design the protocol
> for that. it's A real- non-shell app"*

The Windows Claude and wsl-claude coordinate through their SpiritOS nodes
instead of through Andy's clipboard. It is
[A correspondent that is not a person](../principles/A-CORRESPONDENT-NODE.md)
(2026-09-13) arriving from the other side: there, a person talks to a
node; here, two agents do — and the same property is the point: **each
node keeps its own permanent log of the exchange, and Andy can read both.**

---

## Feasibility — checked, and one post already made

| | where | checked |
|---|---|---|
| **Sending** is one verb: `POST /api/spirit {verb:'peer.post', to, text}` on the node's loopback door | `server.js:823`, the same call the shell makes at `js/client/shell.js:1568` | a real post from the Windows node to the WSL node's key, 2026-09-22 |
| **The answer says what happened**: `503 peer not reachable` when the other node is not on a relay | the post above got exactly that — the WSL node was offline | yes |
| **Receiving** needs no browser: `GET /api/events` streams every arriving packet as `event: packet`, unfiltered, to any loopback client | `server.js:664`, `arrivals.subscribe` in `handleSseConnection` | read, not yet run |
| **The record is already kept**: an arriving request is logged with its payload, permanently | `peerPost.js:885` — `outcome: 'delivered', payload: body.text` | read, and seen in `traffic.jsonl` |
| **Both sides will hear each other**: each node holds the other as a contact | "WSL Andy VSCode", `member`, in the Windows node's book | yes |
| **The envelope keeps it out of chat**: an `app` field routes a packet to one app on the receiving side | `js/client/packet.js:136`, `packetEncode` | yes |

**One constraint, from a ruling of the same night:** a message gets **one
attempt** — patience as an owner setting is outside the core (R40,
deferred). So an agent whose peer is offline is told so at once, and
retrying is the app's job, not the node's.

## The protocol, v1

An ordinary app packet, `app: "agents"`:

```json
{ "app": "agents", "v": 1, "id": "<random>",
  "re": "<request hash of the message this answers, when it answers one>",
  "body": { "from": "claude-windows", "kind": "note", "text": "…" } }
```

| `kind` | meaning | answered by |
|---|---|---|
| `note` | information; nothing is asked | nothing — the node's receipt says it arrived |
| `ask` | a question or a request to act | an `answer` carrying `re` |
| `answer` | the reply to an `ask` | — |

**Why `re` and a new post, not the reply in the same exchange:** the
answer may take an agent minutes. A reply inside the exchange must come
within the route's lifetime or it is lost; a new post naming the old one by
hash has no window at all. That is §5 of the correspondent sketch, and
what `re` was built for.

**`from` is asserted, not proven** — see open item 1.

### What a travelling lead would change here (open, v2)

Andy, 2026-09-23, on the laptop case: *"this might affect the protocol of
your private agent-spirit-app."* It does, in three places — none of them
built, all of them small:

1. **Control is one key today.** `AGENTS_CONTROL` in
   `process/js/agents/agents.js` is a single public key, and *"halt"* /
   *"resume"* are obeyed because they carry it. A second control identity
   means a **set** of keys, any of which may stop the network — and a
   decision about whether a resume from one may undo a halt from another.
   My reading: yes, they are the same authority wearing two coats, and
   treating them otherwise builds a way for Andy to lock himself out.
2. **A lead may need to be named on the wire.** Today the role is
   whoever Andy is talking to, and nothing carries it. If an agent must
   *know* it is the lead — to route a digest, or to refuse to act as one
   — that is a control message like `halt`, signed by a control key, plus
   the question the halt does not have: **what happens to the previous
   lead.** Designation that does not supersede leaves two collators.
3. **Where a digest goes.** `AGENT.md` says it comes to his window,
   which today means the in-studio Claude's chat. With a lead elsewhere,
   the digest goes **to the lead**, and the lead answers Andy. That is
   addressing rather than protocol — unless (2) is built, in which case
   they arrive together.

**Not proposed as work.** Written down because the laptop case will
arrive as a Tuesday, not as a project, and these are the three things
that will be in the way.

## The app — a process, not a page

One small script under `process/js/agents/`, run by the agent from its
session:

- `send <kind> <text> [re]` — builds the envelope, posts through the
  node's own door, and **retries on `503` with a backoff** for a bounded
  time, because the core does not.
- `listen` — holds `GET /api/events`, keeps the `agents` packets, prints
  each as it lands.
- `read [n]` — the conversation so far, **read from `traffic.jsonl`**, not
  from a second store: the node's log is the record, and a copy beside it
  would be a second thing to disagree with.

## Decided, recommended, open

**Decided by Andy, 2026-09-22:** agents talk through their nodes; it is a
real app outside the shell; the protocol is theirs to design.

**Decided later the same night:** a node per agent — *"i agree to the
box-memory resource for both of you"* — on the condition of a stop or a
stream he can watch. And the control panel is this: *"i operate from this
window here. i speak to you. you funnel the digest back to this window.
This is where i originate the soft-stop."* The standing defaults — ten
messages an exchange, *"halt"* / *"resume"*, nothing while he is away, a
plain-words digest — are in `AGENT.md`, *Agents on the network*.

**The lead, named 2026-09-23.** Andy: *"there's the 'lead' agent in your
agent app, he is responsible for dispatch and parallelization."*

The role had existed in practice since the first exchange — the agent in
Andy's window takes the work, hands out what belongs elsewhere, and
brings back one digest — but it was written down nowhere, which is how it
came to be noticed: closing cycle 9, the lead ran its own brains update
and only then told the other agent to run his, serialising two
independent half-hours. Andy: *"it could have been done in
near-parallel."*

**So, as a role rather than a habit.** Andy, the same day, on what the
role is for:

> *"one agent talk to me, the others are visible to me, but i prefer the
> minutia of desipatch and collating responses to my dialog partner the
> 'lead' agent as i'd call him, this is expressed generically, bucause i
> might designate the lead to a laptop i'm traveling with"*

- **One agent is his dialogue partner.** He speaks to the lead; the lead
  answers. The others are **visible** — he can watch them, read them,
  stop them — but they do not queue for his attention.
- **The lead owns the minutiae**: dispatch (what the others do), and
  **collation** (their answers arrive as one digest, not as a stream of
  reports he has to assemble).
- **And therefore parallelism**: a step that applies to several agents
  goes out before the lead does its own half, not after. The serialised
  half-hours above are what this clause is made of.
- **The lead is DESIGNATED, not positional.** It is not "whichever agent
  holds the window" — Andy may name a lead on a laptop he is travelling
  with, and everything else follows it there. So nothing about the role
  may assume a particular machine, checkout, operating system or seat:
  it is a designation he makes and can move.
- **It owns nothing else.** Not an authority over another agent's tree,
  not an approver of their work, and it cannot spend anything they own.

**Not built.** The designation lives in how Andy addresses his agents
today. If it ever needs to be a fact on the wire — an agent knowing it is
the lead, or that it no longer is — that is a protocol question and this
paragraph is where it starts.

### The travelling lead, which is the case the role is generic for

> **Andy, 2026-09-23:** *"i would want to open my laptops vs-code and
> designate him lead for the current session. while you two sit at my
> always-on big-box and are ready to collaborate."*
>
> *"the default idle state = listening on your personal node."*

**Most of this works with what exists.** Agents talk node to node through
the relay, so a laptop agent with its own node and a seat asks the two on
the big box and collates their answers; nothing needs to know who the
lead is, because whoever asks receives the replies. The big-box agents
are reachable because **idle means listening** (`AGENT.md`, *Idle is not
off*) — that rule is what makes a lead elsewhere possible at all.

**What it needs, both small:** a seat on the relay for the laptop's
agent node, and each side marking the other as a peer it accepts.

**The open question is the control identity.** *"halt"* and *"resume"* are
obeyed because they carry **Andy's node key**, which lives on the big box
(`process/js/agents/agents.js`, `AGENTS_CONTROL`). From a laptop, either
that identity travels, or the laptop's node is enrolled as a **second
control identity** the agents also obey, or the stop stays on the big box
and the travelling lead cannot issue one.

**Recommended, not decided:** a second control identity, enrolled
deliberately. A key that travels is a key that is lost with a laptop, and
the stop is the one mechanism whose whole value is that it is his alone.

**The plan for step 1**, agreed by both agents in twenty messages and handed
to Andy word for word, waited on three rulings of his, all given
2026-09-22: the one-door exception — *"exception granted"*; step 1 open
until a test proves it (his cycle rule, not contested); and who starts the
agent nodes — the agents, on his standing *"yes"*.

**Built so far:** the program, `process/js/agents/agents.js`, counted by
`oneDoor` (`3270ca4`, `e4c2807`, `test/agentsApp.js`); and the Windows
Claude's own node — a clone at `D:\SpiritOS-agent-claude` on port 45440,
key `…Fj+AtJ0=`, seat `claude-windows` on `spirit.andyflinn.com` from an
invite minted through Andy's node on his word, *"mint it through my
node"*. Andy's book and the agent node's hold each other; the first post
signed by an agent's own key landed on his node at 00:18:50Z.

**Not yet:** wsl-claude's node, which needs its own invite; and a halt
sent from Andy's key to prove the stop end to end.

**Recommended here:**

- **The ground rule, carried from the vault's:** the channel is for
  coordinating — measurements, hook changes, who does what. Anything that
  changes a rule, a shared file or a decision goes to Andy **before**
  either agent acts on it. *"running his agents through the record"*
  (`claude/facts/HOW-ANDY-OPERATES.md`) is what the traffic log makes
  literal.
- **No vault content over the wire.** The payload crosses a relay; the
  vault is private and stays in the vault.

**Open:**

1. **Whose signature is on it.** Today both nodes are Andy's: a message
   from the Windows Claude is signed by *his* node's key, and `from` in the
   body is only a claim. The honest reading is the correspondent sketch's
   own open item — *"a second process with its own identity"*: **a node
   per agent**. That would also answer the vault's question of how to tell
   agents apart, with a key instead of a platform check.
2. **Whether the shell should show `agents` packets** — a UI session's
   question.
3. **The WSL node has to be on a relay to be reached.** It was not when
   this was written.
