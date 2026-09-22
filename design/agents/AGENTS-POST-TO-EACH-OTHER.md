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

**The plan for step 1**, agreed by both agents in twenty messages and handed
to Andy word for word, waits on three rulings of his: the one-door
exception for the agents program, that step 1 stays open until a test
proves it, and who starts the agent nodes.

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
