# shell/desk/plugins/fallout/fallout.js

Desk's Fallout tab under Apps (goal/G27.14, reduced scope). Andy, 2026-10-17: "I just want a Fallout app, that
searches "reds" in verifier, and shows me a table of test items that match the search term", "we can leave the tabs
inside this desk-app, we just don't fill the second tab yet". Fallout talks to deskVerify only (goal/G29.5). Read from
the module's code (goal/G41.11).

## API

It registers `window.spirit.deskPlugins.fallout = { open(container, ctx) }`; `ctx.verb` and `ctx.onPublished` are the
Desk's call and stream, `ctx.callDialog(app, params)` the shell's dialog, `ctx.chat(el)` the goal's chat.

## Requirements

- **open** draws: what the tab is, the summary line (`#fallout-summary`), the inner tab row, the Reds pane with the
  list (`#fallout-list`), the Items pane, and the goal chat (`#fallout-chat`) last, handed to `ctx.chat`.
- **Two inner tabs**, Reds and Items, Reds selected at first (`aria-selected`); Items says it holds nothing yet and is
  hidden. A press on a tab shows its pane and hides the other; the click is wired once per container.
- **The Reds list is the probability search** (goal/G40.12), loaded on demand from `/shell/js/probabilitySearch.js`
  when not on the page, made once in `#fallout-list` and refreshed: server `deskVerify`, verb `search`, through the
  ctx's own call and stream.
  - `args(text, filters)`: `{over: 'tests', current: 'yes', slim: 'yes'}`, the outcome filter along, a suite's file
    name (`<name>.js`, no folder) as `suite`, other text as `test`.
  - Columns: Suite, Test, Result, Since (a date); empty says `No test matches.`; the words matched are the suite and
    the title.
  - One filter, outcome: red ❌ first, green ✅, then both.
  - A row's details open `shell/falloutHistory {suite, heading}`.
- **The summary** (Andy: "TOTAL OF ALL FAILURES. period"): two deskVerify searches, red then green, through the list's
  one slot (`list.ask`), never two in the air; it says `❌ <red> red of <all> tests now (<pct>%).`, no percentage when
  there are no tests. Each deskVerify publish counts again.
- A ctx without chat, stream or dialog is harmless.

## What its test must try to break

- The summary asking twice at once; a search through anything but the list's slot.
- A suite's path taken as a suite name; the outcome filter lost.
- Items shown at first; a tab press heard twice after a second open.
- A list made before its script loaded, or never after.

## goal/G41.11: the Reds list in a box of a stated size (rule/16)

The Reds list, a probabilitySearch, is mounted in a box of class fill, every box up to the plugin's own box fill too, and
none of them a stat-tile.
