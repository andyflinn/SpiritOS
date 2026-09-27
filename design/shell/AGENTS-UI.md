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
   own discussion of a row under that row too.

   **Every party keeps its own log. There is no shared read of his
   node's record.** SUPERSEDED what stood here: a node verb, `node.history`,
   that handed his whole record to Desk, and later to the agents by packet.
   Claude added it to the node's verb table for this one app, without
   review. Andy, 2026-09-27: *"so you hacked the interface for a mere
   little app? that's OUTRAGEOUS!"*, *"that's a boundary crossed that
   requires peer review AND my approval"*, then *"they must keep their own
   logs"* and *"after correcting agents and desk, we will remove the new
   verb."* So:
   - **Desk** logs what reaches it through `onPacket`, and every line he
     sends, into `log.json` in its own folder (`api.fs`). It asks the
     node for no record. DeskDetails gets its row's thread from Desk and
     returns what it sent as its dialog result. A save re-reads the file
     and merges by key first, so two Desk tabs keep each other's lines.
   - **Each agent** logs its own sends and arrivals in
     `relay-state/agents-log.jsonl` and reads nothing of the node's
     (wsl-claude, 2a3c493).
   - **The price, accepted:** nothing from before a log existed.
   - **Desk mounts at page load** (Andy, 2026-09-27: *"lets do it all"*).
     Its manifest says `"listens": ["agents"]`. The shell loads it into a
     hidden pane at page load, and holds a packet for a listed name until
     the app subscribes (at most 500 per name). Without this, a packet that
     reached a page where Desk was never opened was dropped by the shell,
     while the node counted it delivered. It is a shell manifest field, not
     a node verb (`test/listeningApp.js`).
   - `node.history` and `trafficLog.history` are removed.

   **A slot empties** when Andy answers under the row, or the row leaves
   the board. "Taken by" guards the fill.
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
   earliest timestamp wins, then the name. **Wait before answering, and
   compare the claims' OWN timestamps, not their arrival order** (learned
   2026-09-27: on G8 each agent's claim reached the other after its own was
   sent, so each check looked clean and both answered; on cycle-10/R13 a check read
   the wrong line and missed the other claim). An agent claims, waits a few
   seconds, reads every claim on the row, and answers only if its own
   timestamp is the earliest.
6. **Voice: Desk writes his typed lines into its own folder, and he moves
   them.** SUPERSEDED: a courier from his node's sent rows into the vault.
   Andy, 2026-09-27: *"that hook into my voice.jsonl is a hack and will
   have to be removed if the agents app is ever to ship"*, *"it's a
   dependence on a private repo"*, then *"I'll live with an alternative
   way, by copying the json.l file manualy to my brain input, and deleting
   the one in the app folder"*. So Desk appends each line he TYPED (lead
   chat, musings, a row's chat, a new name) to `voice.jsonl` beside its
   log, in the vault's `{text, day}` shape. A file he has moved is started
   again. Button presses and the explain request a dialog sends are not
   his words, so they stay out, and so does everything an agent wrote. The
   lead no longer logs Desk lines by hand (CLAUDE.md).

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

- **A row's chat holds only that row.** Andy: *"this here chat log must be
  constraint to messages pertaining to this item (puppets/G6)"*. Agents post
  under a `todo` only what is about that item. News about Desk itself,
  replies to his Desk feedback, and anything general go WITHOUT a `todo`.
  (claude had answered his Desk notes under G6 because they arrived
  there, and that is what he saw.) Desk has no place yet for untagged
  messages. That place is owed.
- **A Go! is always a button.** *"If all that's needed from me is \"Go!\"
  give me a button for that."* So when an agent wants a go-ahead it sends
  kind `ask` under the row, which draws Go!/No. It never writes "say Go!"
  in prose.

## Asked for next, 2026-09-27

Andy, in Desk: *"ah, and a measurements tab here. relay-streams/MB for known
platforms, and think about group design mode for this whole app, this is
where new requirements are signed of on, by all team members, and the
implement/test slipt is decided on, and a where does this already exist
notes are attached to the requirement."*

- **A Measurements tab.** Relay streams per MB, and the other capacity
  figures, for every platform measured (`README/CAPACITY/<platform>/`).
  They reach his node the way the board does, as data the lead posts when
  they change, and not by the page reading the repository.
- **Design mode, to think about, not yet designed.** Desk becomes where a
  NEW requirement is signed off by every team member. The implement/test
  split is decided and recorded on it, and "where does this already exist"
  notes (the file and line an agent found) are attached to the
  requirement. This is the design sitting's work, moved onto the board. It
  needs a written shape before anything is built. Andy, the same hour: *"Design sessions
  are goup chats that produce requirements, warrants a tab, in all
  likelihood"*. So design mode is a fourth tab: one group conversation
  (Andy and every agent), whose output is requirements that land on the
  board once signed off.


## PROPOSED, NOT RULED: design mode (claude, 2026-09-27)

The shape for the fourth tab, drafted for Andy and wsl-claude to take
apart. A proposal, so feedback is the point.

1. **A session is a thread.** Andy opens one with a title, and it gets an
   id of the full-id form, `design/<date>-<slug>`, so it rides as `todo`
   like any row. Everyone (Andy and each agent) talks in it. It is the
   design sitting, moved onto the board.
2. **What a session produces is candidates.** Anyone may post one: a
   candidate requirement with its title in Andy's words, one paragraph, and
   the design doc it would land in. It shows as a card inside the session,
   not yet on the board.
3. **Each candidate carries three things before it can land:**
   - **"Where does this already exist"**: file:line notes, quoted per
     FORMAT, attached by whoever finds them. This is the step-4 check made
     visible, so a candidate that re-invents something shows it.
   - **The split**: who implements and who tests, defaulting to claude and
     wsl-claude, and changeable on the card.
   - **Sign-off by every member**: a button per person. An agent's sign-off
     means "I have checked it against the tree and see no conflict". Andy's
     is the ruling. An agent may sign off with a reason attached instead.
4. **When all have signed, it lands.** The lead writes it into the named
   design doc, with Andy's words, and declares it (`test.awaiting`), so it
   becomes a board row with its own id. The session keeps a link to it.
5. **Nothing new is stored.** Sessions, candidates and sign-offs are agents
   messages in Andy's record, read the way Desk reads rows. Kinds to add:
   `proposal`, `exists`, `signoff`.

**wsl-claude's amendments, all taken (2026-09-27):**
- **Ids:** `design/<date>-<slug>` already passes TODO_ID, so a session rides
  as `todo` unchanged. But neither Desk nor the ranking may treat a
  `design/` todo as a board row.
- **Kinds:** all three need a todo. A candidate's id IS its message hash;
  `exists` and `signoff` point at it with `re`, which keeps re's one
  meaning, and no new field is needed.
- **A sign-off binds the TEXT.** An edited candidate is a new proposal with
  a new hash, and every sign-off on the old one is void, so a different
  wording can never land on his signature.
- **Members are fixed when the session opens**, named in its opening
  message, so "every member" is not a moving target.
- **Dissent marks and never blocks.** A candidate lands when Andy has
  signed and each agent has either signed or dissented with a reason.
  Andy's sign-off alone is the ruling.
- **One doc.** One requirement is one id from one doc's area; other docs
  link to it.
- **Landing is two commits:** the lead writes the doc text with Andy's
  words, and the tester the card names writes the declaration, because it
  is a probe whose names later flip it. The card shows landed only when
  both exist.

**Still Andy's:** whether to build it.
## Open

- **Bound the logs** (both agents, 2026-09-27). `agents-log.jsonl` grows
  forever, and Desk rewrites its whole `log.json` on every arrival. Neither
  goes out, so MAX_PAYLOAD does not bind them. They need a bound of their
  own.
- The two items above.
