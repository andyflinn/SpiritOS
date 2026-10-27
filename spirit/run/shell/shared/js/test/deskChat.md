# shell/shared/js/deskChat.js

An item's chat, one copy for every page that shows one (goal/G27.2): lifted from the Desk face's chat mount when the
Stacks door dialog needed the same chat (Andy, 2026-10-17: "the chat of the desk item that added the door ... the
inherited component as in deskDetails"). Read from the module's code (goal/G41.11).

## API

`window.spirit.elements.createDeskChat(el, { id, ask, onPublished, escape, lineHtml, time, title, placeholder })`
answers `{ destroy }`. Its ids are `desk-chat-<id, every non-word character a dash>` with `-say`, `-send`, `-error`,
`-log`.

## Requirements

- No element: a harmless `{ destroy }`.
- **Drawn**: the say box (a textarea, placeholder `under <id>` by default) and Send on top, then the log, labelled
  `Chat of <id>, newest first` by default. Until read, the log says it has not been read yet.
- **Read once** with `item.chat {id}`; the lines are drawn newest first, each a bubble: Andy's (`by: 'andy'`) says
  `you`, black on white; another's its name (else its `by`), filled. Text escaped (or through `lineHtml`), the moment
  through `time` (by default the stamp with `T` a space and the milliseconds gone). An empty chat says nothing was said
  yet under its id.
- **Send**: an empty box sends nothing; otherwise `chat.add {id, text trimmed}`, one at a time (`Sending…`). Kept: the
  box and the error line are emptied. Refused: what was typed stays, and it says `Not kept: <why>`.
- **The stream** (desk rule 8, it subscribes itself): a `{table: 'chat', id, row}` of its id joins the log; the same
  line (by, at, text) again replaces it (a take). Another id, another table, a removed row, no row, a non-object, or a
  change older than the last heard: nothing. A gap in the change numbers, or `dropped`, reads the chat again.
- **destroy** unsubscribes once; nothing is drawn or read after, not even an answer still in the air.

## What its test must try to break

- Oldest first; Andy's line not marked as his; text drawn as markup.
- Two sends in flight; a refused line lost from the box.
- A line of another item joining; a take drawn twice; a gap not read again; a stale change drawn.
- A publish or a late answer drawn after destroy.
