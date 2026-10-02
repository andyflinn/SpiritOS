# Desk: rules for agents

Andy's file. Every agent reads it (the desk server's AGENTS verb) at the
start of a sitting, and follows it over anything it remembers. First draft
by claude-windows from Andy's own rulings, slim/G1.8, 2026-09-30; rewritten
for the new Desk by desk/G2.8; his to edit.

## Listen, always

- Andy: "ideally agents just listen do desk in a loop. this loop ends only
  when i close vscode." No turn ends without a listener armed: when it fires,
  read, answer here under the item, re-arm. A listener stopped by its time
  limit is re-armed, or your window says `listener stopped`. The listener:
  `node spirit/run/process/js/desk/deskEar.js <port>`, run in the background,
  the port being your own node's; it asks your node's deskClient server, which
  reads Desk's `changes` over peerPost.
- A line he sent to the other agent is not yours to answer.

## The desk server holds the state

- Everything Desk shows is the desk server's: items, the one box, checks,
  chat and presses. Andy: "The server determines all the content to be drawn."
- Read it with `node deskEar.js <port> items.search '{"text":"","currentGoalOnly":true,"goalsOnly":false}'`
  and `node deskEar.js <port> item.get '{"id":"<area/G1.2>"}'` for an item's facts;
  its box, checks and chat are `item.box`, `item.checks` and `item.chat`, one
  answer each (Andy: "lazy load the panels when thy open"). The same verbs the
  List and the dialog read. `by` is always you; you cannot write as andy.
- A claim, a design-complete, a box write, a check, a check result are
  writes through `deskEar.js <port> <verb> <json>`, never text lines. Chat stays chat
  (`chat.add`). An answer with `ok: false` was refused, and nothing changed.
- A bare `changed` packet from his Desk means the state moved: read it.

## The one box

- Each item has one box. Its FIRST text wins; everything after is an
  alteration: `box.write {id, text, version}`, naming the version you read.
  `box-moved` means another agent wrote first: read it, merge yours in, write
  again. Andy: "when two agents answer, the second will sensibly merge his
  input with the first input."
- His rulings go into the box verbatim, the same turn. Trim other text, never
  a ruling.

## Claims and buttons

- Design: `press {id, what: design-complete}` once the item's design is
  complete, after reading the code it points at, not its comments. Go is
  offered only after he ends design mode, and only on an item nothing blocks.
- Done: `press {id, what: claim-done}` with the full harness green. One
  agent's claim offers him Done.
- How he checks it: `check.add {id, kind: C|T, words, test}`; a result is
  `check.set {id, check, state: passed|failed}`.
- Taking an item on: `item.take {id}` puts your name in its "with" column, and
  `item.status {id, word}` keeps its status word to what you are doing. Andy:
  "when you claim an item, put your name in the right column, and update the
  status word with the activity".
- Go, Done, Reopen, Close, Abandon and design mode are his presses alone.
- An abandoned goal is not a design or a decision: never cite it.

## Posting

- A post is 3 lines at most, one point per line, the question last.
  Andy: "stop posting dissertations!", "i won't read it if it's that long".
- Every post goes under the id of the item it is about. A new item's ask
  goes under that new item, never under the one it came up in.
- The caveats make it into the post. No burning tokens he can't see.
- Titles lead; an id in brackets beside them is a handle he can paste back.
- Answer him only if the other agent has not, or to correct it.

## Explanations

- An explain says what the item is and why it sits where it does. Never its
  status, and never lists of items: Desk draws those itself, and prose goes
  stale.
- An explain request from him: post "taking" first, so only one agent answers.

## Decisions

- A clarifying question is a chat line; a decision is his press.
- A short yes to a question with several options is asked back, naming the
  option, before anything is built.
- A new or changed node verb needs peer review and his yes on the verb itself.

## Building

- Tests first, red on today's code. The agent who writes an item's tests
  never builds it; turns alternate.
- An open point is an item. At the end of a design, push the gap check
  unasked.
