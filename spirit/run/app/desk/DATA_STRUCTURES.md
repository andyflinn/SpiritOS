# Desk — data structures

Desk keeps everything in its own folder, `spirit/run/app/desk/`. Andy,
2026-09-28: *"this IS the official project governance. NOW."*

## Files

| file | what |
|---|---|
| `log.json`, `log-1.json`, `log-2.json`, … | The log: every message in and out, in order. A JSON array per file. Only the last file is rewritten; a file is sealed at about 9 KB (`DESK_CHUNK_BYTES`), because a save is one request. |
| `state.json` | What Desk has decided, rewritten by Desk whenever it changes (below). No agent edits it. |
| `seen.json` | `{ "rows": { "<item id>": <ms timestamp> } }`: when Andy last opened each item, for the red `*` marks. |
| `voice.jsonl`, `voice-2.jsonl`, … | Andy's own typed lines, `{text, day}`, one per line. He moves them to his vault by hand. |
| `desk.js`, `desk.json` | The app and its manifest. |

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

## `state.json`

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

## How Desk works them out (from the log)

- **Design mode** — on while Andy's newest `start design mode.` is newer
  than his newest `end design mode.`.
- **Done** — Andy's latest `done.` / `reopen.` under an item. A `done.`
  counts only after an agent's note under that item opened with
  `READY TO CLOSE` (or `<id> is READY TO CLOSE`).
- **Open question** — an agent's `ask`, until Andy's next `answer` there.
- **Name** — Andy's latest `retitle:` for the item.
