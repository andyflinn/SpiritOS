# shell/desk/plugins/vision/vision.js

Desk's Vision tab under Apps (goal/G27.3), in place of the musings tab. Decided by Andy, 2026-10-14 to 17: a simple
standard desk plugin (R2); its items open in the standard deskDetails dialog (R6); each item's chat is the record
(R7). Read from the module's code (goal/G41.11).

## API

It registers `window.spirit.deskPlugins.vision = { open(container, ctx) }`: `ctx.goal` its goal, `ctx.ask` the desk
server, `ctx.onPublished` the stream, `ctx.chat(el)` the goal's chat, `ctx.callDialog(app, params)` the shell's dialog.

## Requirements

- **open** draws, top to bottom: what the tab is, the add (`#vision-title`, carrying `data-field="label"`, and
  `#vision-add`), the note line, the items (`#vision-items`), and the goal's chat (`#vision-chat`), handed to `ctx.chat`.
- **Its goal's items from the goal itself** (Andy, 2026-10-17: "where is my list of vision items?"): `item.get` of the
  goal, then of each id its `blocked` names; only items whose goal is its goal are rows. A row: the title (escaped),
  its id, what it waits on when blocked, and Open carrying its id. None says `Nothing in the vision yet.`; a read that
  fails leaves the list as it was.
- **Add** is on only while a title is typed that the label rule (`spirit.fieldRules.problem`) takes; checked on every
  input. A refused title says `Not added: <why>` and sends nothing; a blank one sends nothing.
- **Add sends** `item.add {goal, title trimmed, blocks: ''}`: added, the box empties, Add goes off, it says
  `Added <id>.` and reads the items again; refused, it says `Not added: <why>` and the title stays. Enter in the title
  box adds (a held, repeating Enter does not); Enter elsewhere does not.
- **Open** calls `shell/deskDetails {id}`; the list is read again when the dialog closes. No dialog in the ctx: Open
  does nothing.
- **Its own stream**, subscribed once whatever the opens: a published item of its goal, or its goal itself (an object
  or a JSON string), reads the items again; anything else reads nothing.

## What its test must try to break

- An item of another goal listed; a title drawn as markup.
- Add on for an empty or refused title; a refused add that empties the box.
- A repeat Enter adding twice.
- A second subscribe on a second open; a publish of another goal reading again.
