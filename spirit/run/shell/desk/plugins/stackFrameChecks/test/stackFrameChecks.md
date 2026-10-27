# shell/desk/plugins/stackFrameChecks/stackFrameChecks.js

Desk's Stacks tab under Apps (goal/G22.3). Andy, 2026-10-13: "I want this plugin to RUN the show, so you give me the
complete toolset"; the door's detail is a shell dialog of its own (goal/G27.2's box, 2026-10-17). The add form's
fields are the shared door fields (`shell/shared/js/deskDoorFields.js`, tested on their own). Read from the module's
code (goal/G41.11).

## API

It registers `window.spirit.deskPlugins.stackFrameChecks = { open(container, ctx) }`: `ctx.goal` its goal, `ctx.ask`
the desk server, `ctx.onPublished` the stream, `ctx.chat(el)` the goal's chat, `ctx.callDialog(app, params)` the
shell's dialog.

## Requirements

- **open** draws, top to bottom: the add form (`#sfc-form`), the note, the door search (`#sfc-door-text`) and the
  doors (`#sfc-doors`), its items (`#sfc-items`), and the goal's chat (`#sfc-chat`), handed to `ctx.chat`.
- **The form** is `deskDoorFields.html('sfc-')` and `Add the door` (`#sfc-make`), checked at open and on every input
  in a door field. Without the fields on the page it says it is loading them, puts `/shell/shared/js/deskDoorFields.js`
  on the page once, and draws and checks the form when it loads.
- **Its items**: `item.get` of the goal, then of each id its `blocked` names; only items of its goal are rows (title
  escaped, id, status). None: `No items yet.`
- **The doors** (goal/G33.7): `stackFrameChecks.doors.search {text}` with the search box's text, at open and on every
  keystroke in it. One row per door (`data-door`): gate, endpoint (with `on <paths>`), suites (or `no suites measured
  yet`), the last verdict, the item, and Open (`data-open`). The verdict: `never run`; `running since <t>`;
  `stopped <t>`; `no verdict, <t>`; `green: N call(s) through the gate, <t>`; `red: N path(s) around the gate, of M,
  <t>` as an error; times with `T` a space and the milliseconds gone. `more` says there are other doors; none says
  `No doors yet.`, or `No door matches.` when text was typed. All text escaped.
- **Open** calls `shell/stackFrameCheckDetail {id}`; closed, the doors and items are read again. No dialog in the ctx:
  the note says so.
- **Add the door**: no gate or no endpoint, `Not sent: a gate and an endpoint are both needed.`; a field the door
  fields call wrong, `Not sent: <why>`. Otherwise `stackFrameChecks.make {gate, endpoint}`, then on the door it
  answers each path (`paths.add`) and each suite (`suites.add`), one write each, in order (goal/G40.3); then the form is
  emptied and checked, the note says `Made <item>: nobody but <gate> reaches <endpoint>. The door is in the list.` (`,
  with no suites yet.` when none), and items and doors are read again. Refused: `Not made: <why>`, the form kept.
- **Its own stream**, subscribed once: the plugin's own publish (`plugin: 'stackFrameChecks'`) reads the doors again;
  an item of its goal (object or JSON string) reads items and doors; anything else nothing.

## What its test must try to break

- Paths and suites sent inside the make, or before the door exists, or out of order.
- A make sent with a field the door fields call wrong, or without a gate or endpoint.
- A door's verdict worded wrong; a red not drawn as an error; door text drawn as markup.
- A second subscribe on a second open; the items re-read on a door's own publish.
