# AGENTS-UI.md — Andy's screen on the agents app

**This file answers "what Andy's UI to the agents app is, and what it is
built from". It goes stale when the app is built or the board's data
shape changes.**

Design only. Nothing here is built.

## Vision, in his words

- *"soon I'll ask you to make me a shell app that pipes my responses into
  the agent record."* It is *"my UI to the agents app"*, and *"it will be a
  REAL app"*.
- **Why:** *"it would allow me to send input without interrupting any of
  you, and your attention can thus be better organized, too"*.
- **The loop:** *"my input will be queued, any agent can adress issues in
  the table, respons to me under that heading, befor going idle
  (listening), my input arrives in bulk from you point of view as well"*.
  And *"it also allows us to attach questions and responses to issues,
  instead of a linear stream"*.
- **The board is its basis:** *"the uniform table will make the move into a
  shell app easier"*. *"in a shell app, the handle can be passed
  automatically, and i don't have to worry about it, and my Text is easily
  extracted for voice.jsonl"*.
- **Logging:** *"all inputs to a discussion will be logged."* And *"mine even
  can go to voice.jsonl"*.

## Decided

- **It moves ahead of the shell gate.** Andy, 2026-09-27: *"move it ahead.
  it adds only one app the group that has to survice the shell ovehaul
  (info,natter,contacts....)"*. The shell's lowest-layer design sitting
  stays gated on the owed list. This app joins Info, Natter and Contacts
  as an app that must survive the overhaul.
- **A real app, and outside alpha.** Andy: *"an it will be a REAL app"*,
  and *"it does something ouside of the scope of alpha"*. It is a working
  tool with a purpose of its own, not a sample. It is not part of alpha,
  and alpha does not wait on it. It lives in `app/<name>/` with a
  manifest, like Info (`app/info/info.json`). It uses the app contract
  only: no reach of its own, and no privilege the other apps lack.
- **The thread key is the full id** (`public-app-server/G10`), never the
  short handle. The handle can grow when a sibling id appears, and a
  thread keyed on it would be orphaned (wsl-claude). The app attaches the
  full id itself, so Andy never types one.
- **A row is a thread.** Andy's input queues against a row. Any agent may
  take the row and replies under it, and only then goes idle.

## What exists to build on (verified at 5105355)

- **The agents app** (`spirit/run/process/js/agents/agents.js`) already has
  send, read and listen. Its envelope carries `re` and a body of
  `{ from, kind, text }`, with kinds `note`, `ask`, `answer`, `report`,
  `halt`, `resume` and `blocked` (`agents.js:40`). Andy's node key is
  already the channel's controller (`AGENTS_CONTROL`).
- **The board** (`spirit/test/runAll.js`, `boardRank.js`, `edges.js`)
  ranks owed to-dos by what they unblock, asks Andy dependency to-dos, and
  gives every row a full id and a short handle.
- **The node signs.** A page never holds a key. Andy, 2026-09-26: *"the
  node handles all the signing. the shell doesn't worry about that."*

## Recommended shape

1. **The board as data** (wsl-claude, asked 2026-09-27): runAll writes the
   ranked rows as JSON next to the markdown, from the same rows, so the
   two cannot drift. Each row carries: id, handle, title, rank, frees,
   waits on (and whether accepted), owed since, there, and kind (to-do,
   dependency to-do, or question).
2. **The screen:** the uniform table. Each row opens to its thread, which
   holds Andy's queued input and the agents' replies in order, with a box
   to type into.
3. **Sending:** Andy's text goes as an agents envelope from his node,
   carrying the row's full id. His node signs it.
4. **Replies:** an agent answers with the same full id, so the reply lands
   under the same row.

## Open

- **Where the full id rides in the envelope.** A new body field such as
  `todo`, or inside `re`? `re` already means "the hash of the message this
  answers", so reusing it would give it two meanings. A new field is
  recommended.
- **Where the threads live.** The recommendation is that the traffic logs
  already on each node are the record, and the app renders a row's thread
  from Andy's node's log filtered by full id. Nothing new is persisted,
  in line with *"all inputs to a discussion will be logged."*
- **How the board data reaches the page.** The board is written in the
  repository root on the lead's box. A page reads only through the shell
  API, which does not serve the repository root today.
- **How Andy's text reaches `voice.jsonl`.** It lives in the vault, which
  the node does not know exists (`brains/README.md`: *"This is not a
  SpiritOS feature"*). So writing it from a page is a new route across
  that fence, and it needs a ruling.
- **The app's name.**
- **Which agent takes a row.** "Any agent may" needs a rule for two agents
  taking the same row at once.
