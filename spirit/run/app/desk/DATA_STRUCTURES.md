# Desk — data structures

Desk keeps nothing in its own folder. Since desk/G1.4 its record is the desk
server's (`process/js/desk`), in the node's state and never in git (desk/G1
D5: "any appServer state is none of git's business"), and Desk reaches it by
`jobs.api` on the loopback door (D4). Andy, 2026-09-28: *"this IS the
official project governance. NOW."*

## Where it lives

In `spirit/run/relay-state/process/desk/`, the folder the node hands the desk
server as `--state`:

| where | what | Desk reaches it by |
|---|---|---|
| `desk.db`, table `lines` | The log: every message in and out, one row each, its whole JSON kept, with the columns it is searched by (key, at, todo, from, kind, text). A key is kept once. | `log.add {json}`; `log.search {text, todo, since, kind, before}`, newest first, cut by bytes and `partial` when cut; `todo: '-'` is a line under no todo |
| `desk.db`, table `docs`, `state` | What Desk has decided (below), as JSON text. | `state.get`, `state.set {json}` |
| `desk.db`, table `docs`, `seen` | `{ rows, team, agents, folds }`: when Andy last saw each item and chat, for the red `*` marks, and his folds. | `seen.get`, `seen.set {json}` |
| `voice.jsonl` | Andy's own typed lines, `{text, day}`, one per line, a plain file he moves to his vault by hand. | `voice.add {text, day}` |

Desk reads only what it shows: the newest session, each open item's own
lines, a chat's newest page (and older pages as he scrolls up). It never
reads the whole log. What Desk once kept in `app/desk/` (`log/`,
`voice/`, `state.json`, `seen.json`) the server imports once at start and
then removes; `desk.js` and `desk.json` (the app and its manifest) and this
file stay.

## One log message

```
{ key, at, dir, peer, outcome, from, kind, text, todo }
```

- `key` — the packet's hash (or a local key if nothing was sent). Unique; a
  message is taken once.
- `at` — ISO time. `dir` — `in` (from an agent) or `out` (Andy's).
- `peer` — the other side's public key. `outcome` — `sent`, `received`, or
  `undelivered: …`.
- `from` — `andy` or the agent's name. `todo` — the item id it belongs to
  (`team/chat` for the Team tab).
- `kind` and `text`:

| kind | text |
|---|---|
| `note` | talk |
| `ask` | an agent's question; shows Go/No until Andy answers |
| `answer` | Andy's decision: `go.`, `no.`, `done.`, `reopen.`, `closed.` (hides a done line), `retitle: <name>`, `start design mode.`, `end design mode.` |
| `explain` | an agent's explanation of an item |
| `session` | a design session, as JSON (below) |
| `board` | the harness's old board, as JSON (retired 2026-09-28) |

## A session (`kind: session`)

```
{ goal:  { id, title, description, check?, tests?[] },
  rules: [ { id, text } ],
  items: [ { id, title, description?, blocks?, check?, tests?[] } ] }
```

- `blocks` — an item id or a list of them; the goal when absent.
- `check` — how Andy can check it himself. `tests` — what proves it.
- The newest session is the board. It is hidden once Andy presses
  **Start design mode** after it was posted.

## The state (`state`)

Andy: *"persist … 1) design mode 2) Andy's latest "done"! 3) Open question.
4) andy's personal titles for items."* Every entry carries `at` and `key`,
the log message that set it.

```
{ designMode:    { on, started, ended },
  done:          { "<id>": { pressed: "done."|"reopen.", at, key, counts, claimed } },
  openQuestions: { "<id>": { from, text, at, key } },
  titles:        { "<id>": { title, at, key } },
  closed:        [ "<id>", … ] }
```

`counts` is false for a Done pressed before any `READY TO CLOSE` claim.

## How Desk works them out

All four are PERSISTED in the server's `state` (above), which Desk rewrites (`state.set`) whenever one changes. The log is what they are worked out from:

- **Design mode** — on while Andy's newest `start design mode.` is newer
  than his newest `end design mode.`.
- **Done** — Andy's latest `done.` / `reopen.` under an item. A `done.`
  counts only after BOTH agents have each posted a note under that item
  opening with `READY TO CLOSE` (or `<id> is READY TO CLOSE`).
- **Closed** — Andy's `closed.` under a done line: gone from the List and
  the Team bubble for good.
- **Verified** — a note opening `VERIFIED` (or `IN PLACE VERIFIED`) under
  an item; `UNVERIFIED` or `IN PLACE WITHDRAWN` takes it back. No Go shows
  on an item until it is verified.
- **Open question** — an agent's `ask`, until Andy's next `answer` there.
- **Name** — Andy's latest `retitle:` for the item.
