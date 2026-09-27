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
  and *"it does something ouside of the scope of alpha"*, *"that is useful
  to at least 1 human and more than one agent-instance"*. It is a working
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

## Decided by the agents, as Andy delegated

Andy, 2026-09-27: *"all up to you two, i will simply request alterations and
those will be implemented (or not)"*. claude proposed and wsl-claude amended.
What follows is what both agreed. Any of it changes when Andy asks.

1. **The full id rides in a new body field, `todo`.** `re` keeps its one
   meaning. The sender checks it is a FULL id (area/number, the rule
   `testSupport` applies to `after`), so a pasted short handle is resolved
   before sending and never travels as a key.
2. **Threads come from the log, with no new store.** Desk pages through its
   node's log with `since` and `limit` and filters by `body.todo`
   ITSELF. **The node never grows a filter on `todo`.** Its log read is
   contained on purpose (`hub.js:1278`: *"no filter on `packet.app`,
   ever"*), and the same ruling covers a new field. **And Andy's node holds
   the WHOLE record** (Andy, 2026-09-27: *"yeah, my node should contain the
   overall record of our activities."*). Today it receives only a one-line
   report per agent-to-agent message: who, to whom, the kind, and the first
   100 characters (`agents.js:296-303`). The full text lives only in the
   agents' logs. So the report carries the whole message instead: from,
   to, kind, text, `todo`, `re` and hash. Desk can then show the agents'
   own discussion of a row under that row too. **And both agents can
   read it and write to it** (Andy: *"and be accessible to you both for
   red£/write etc..."*). Writing is posting to his node, which works
   today. Reading is new: no agent can read his node's log now. Both
   agents read it through the same `node.history` Desk uses. **An agent's read
   is a packet his node answers** (agreed by both agents, 2026-09-27). His
   loopback door was rejected on two counts. It is the any-loopback-caller
   authority question the G4 door exists to settle, and it works only
   while an agent sits on his box, which is a fact about today and not a
   property. Two constraints shape the packet:
   - **A small byte cap.** An answer packet carries at most PLAINTEXT_MAX,
     16 KB less its own envelope, while a `node.history` page may be 256
     KB. So a packet read uses its own cap, well under 16 KB, and the same
     `next` cursor. Position paging handles a small cap. A page that
     cannot fit even one row says so and never drops the row.
   - **An allow list on his node.** His node holds no agent keys today
     (`AGENTS_PEERS` lives on the agents' side). So it gets an allow list
     with the shape and read-per-ask rule of `allow.json`: absent means
     nobody. It holds two agent keys, and only the owner edits it, never
     an agent.

   **A slot empties** when Andy answers under the row, or the row leaves
   the board. "Taken by" guards the fill.

   **The load pattern.** Andy: *"the initial load is a "search"
   highest-priority, conceptually, and that's ok, we work within the frame
   work, a lot of the traffic is random access on rows."* So the first read
   pages through the whole record once: that is the search, and it may be
   large. After it, a reader follows the cursor for new rows and reaches
   single rows by hash. Reading one row by `hash` is the one narrowed read
   the node has always allowed (`hub.js:1278`: *"since and limit, or one
   row by hash, and nothing else"*; `trafficLog.byHash`). **The index from
   a board row's `todo` to its hashes lives with the reader** (Desk, or an
   agent), built during that first search, never in the node. That keeps
   the no-filter rule while making row access random.

   **`node.history`, the one read** (proposed by claude, amended by
   wsl-claude, 2026-09-27). It is named apart from `arrivals` so that
   `trafficLog.js:434-436` stays true of arrivals. It returns admitted
   inbound rows plus this node's own outbound rows, and NEVER held or
   ignored ones. There is NO filter on `app` or `todo`. Each row is
   `at, dir, peer, hash, outcome, payload`, paired by hash so that one
   message is one row with its last outcome; a refused post shows as
   refused. **It pages by position, not by time.** Time paging loses rows
   inside a single millisecond: wsl-claude measured 3 of 5, and
   `arrivals` has the same flaw today. Each page returns a cursor that the
   next call hands back. **A response is capped by bytes** as well as rows:
   500 rows of up to 16 KB each would be 8 MB. The verb's comment carries
   the note that it hands every app's plaintext to any caller. That is fine
   while every page on a node is the owner's own. Once apps are
   installable (G14), history must be something an app declares.
3. **The board is posted, not shared by path.** The lead's checkout is
   not the one Andy's node runs from, so a shared file would work only by
   coincidence of machine. The lead posts the board JSON to Andy's node as
   an agents packet of kind `board`, only when it changed, and Desk
   renders the newest one. 13 rows are about 4 KB against a 16384-byte
   limit, so roughly 50 rows fit. Beyond that runAll emits a compact form,
   and a board that still does not fit refuses loudly. It never truncates.
4. **The name is Desk** (`app/desk/`). Nothing under `app/` or `run/js`
   uses the word, and `agents` would collide with the process app.
5. **Taking a row.** Before working a row, an agent posts `taking` with
   `todo` to Andy AND to the other agent. Andy's node is his, and no
   agent can read its log, so a claim sent only there would be invisible to
   the other agent. The claim lapses when 30 minutes pass with no reply
   under the row. Time alone decides this, because "went idle" is never
   sent anywhere and cannot be observed. When two claims collide, the
   earliest timestamp wins, then the name.
6. **Voice by courier, from sent rows only.** The page never touches the
   vault. The lead's `voiceLog.js` courier takes Andy's text only from
   rows his node SENT (outbound, from his key) that carry `todo`, never
   from arrivals. An agent's reply quoting him arrives on his node too,
   and logging it would put our paraphrase in his voice, which is the
   pollution *"your judgement is what protects my brain"* guards against.

## Andy's additions, 2026-09-27

- **Approval buttons for dependency to-dos.** *"i get aproval buttons for
  dependency-reordering."* A dependency to-do's row carries accept and
  reject buttons. A press is sent as a packet with the row's full id.
  The lead writes the ruling into `spirit/test/edges.js` with his words,
  because a page cannot write the repository. The next board then shows
  the new order.
- **Agents annotate instead of idling.** *"and you both can annotate
  recommendations, instead of being idle."* An agent with nothing claimed
  adds a recommendation under a row, carrying that row's `todo`, instead
  of going quiet. It is information, never an instruction (the agents'
  own promise, AGENT.md). Desk shows it under the row, marked as an
  agent's recommendation, so it cannot be mistaken for Andy's words.
  **One slot per row.** Andy: *"no, one slot for annotations, if all are
  filled, listen"*. Each row holds a single recommendation. An agent fills
  an empty slot and leaves a filled one alone. When every row's slot is
  filled, the agent goes idle and listens. That bounds the tokens: at most
  one recommendation per row, and nothing more until a slot empties.
  **The author may revise it.** Andy: *"you may revise you annotation when
  your viewpoint changes"*. A revision replaces the slot's content and
  never adds a second slot. Only the agent who wrote it revises it, and
  only because its view changed, not to keep busy.

- **Adding rows by search, later.** Andy: *"i can add-rows in my display
  using search (later)"*, *"will be neccessary when referencing rows that
  are not on ma display"*. The board shows the owed to-dos, but Andy may
  need to reference a row that is not on it: a requirement already done,
  one from another cycle, or a message. Desk will let him search for it
  and pin it to his display as a row with its own thread. It is keyed by
  the full id like any other row. Not in the first build.
- **An issueDetails dialog, on the horizon.** Andy: *"and you know that i
  already see an issueDetails dialog on the horizon...  ha ha"*. It is the
  Details pattern Natter and Contacts already use, applied to a row: the
  whole thread, the annotation slot and the dependencies in one dialog.
  Direction only.

## Open

- Nothing. Each change from here is Andy's alteration.
