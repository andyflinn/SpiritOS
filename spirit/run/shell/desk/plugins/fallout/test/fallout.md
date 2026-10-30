# shell/desk/plugins/fallout/fallout.js

Desk's Fallout tab under Apps (goal/G27.14, reduced scope). Andy, 2026-10-17: "I just want a Fallout app, that
searches "reds" in verifier, and shows me a table of test items that match the search term", "we can leave the tabs
inside this desk-app, we just don't fill the second tab yet". Fallout talks to deskVerify only (goal/G29.5). Read from
the module's code (goal/G41.11).

## API

It registers `window.spirit.deskPlugins.fallout = { open(container, ctx) }`; `ctx.verb` and `ctx.onPublished` are the
Desk's call and stream, `ctx.callDialog(app, params)` the shell's dialog. `ctx.chat(el)`, the goal's chat, is the Desk's to offer and Fallout's never to call (box v25).

## Requirements

- **open** draws: what the tab is, the summary line (`#fallout-summary`), the inner tab row, the Reds pane with the
  list (`#fallout-list`), and the Items pane. No goal chat since goal/G41.22, box v25 (below).
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

## goal/G41.22: product tests only, and icons for the outcome

Andy: "fallout needs a filter that show me product tests only, and the "green"/"red" column must use icons". Agreed:
product tests are the tests under spirit/run; the repo's spirit/test is hidden by the filter. The icons are the
reporter's own: ✅ green, ❌ red.

### Requirements

- The Result column's cell reads ✅ for a green test and ❌ for a red one; no cell says green or red in words.
- A filter of the list shows product tests only: a row whose suite is what the reporter sends for a test under
  spirit/run, `/<path>/<module>` (test/testReport.js, SUITE), stays; a row of the repo's spirit/test, its bare file
  name (`relayGates.js`), is hidden. Off again, both show. It goes with the outcome filter: ❌ and product tests is the
  red product tests.

### What its test must try to break

- The words green or red still in the column; an icon on only one of the two outcomes.
- A spirit/test row shown with the filter on; a product row hidden; the filter stuck on; the outcome filter lost when
  both are set.

### What the test assumes

- It judges what the real probabilitySearch draws on the page (its three libraries loaded before it), with deskVerify a
  stand-in answering its search as deskVerify does today: slim rows `{suite, title, outcome, at}`, key suite + newline +
  title. So the icon is the Desk side's to draw, not a new field of deskVerify's.
- The filter's shape is the build's: it is found as any filter button the list draws whose words name product. Off is
  another choice of its group, or the same button again for a toggle. The filter is the list's own (as the outcome
  filter is), as deskVerify's search has no key for it.
- The checks of the filter's on and off run once that button is there; until then the check that finds it is the red.

## goal/G41.22, box v25: no chat

Andy: "The chat needs to be removed from fallout". The goal chat Fallout carried since goal/G27.14 (Andy, 2026-10-17: "add
the goal chat at the bottom.") goes. The Desk mounts a plugin's chat only in the box the plugin hands `ctx.chat`
(shell/desk/desk.js), so this is judged on what Fallout does, not on its source's words.

### Requirements

- `ctx.chat` is never called.
- Nothing it draws is a chat: no element whose id or class names chat, no textarea, no field to say a line in.
- Opened with the real list, nothing it asks over the wire names chat.

### What its test must try to break

- The chat block drawn but left empty; `ctx.chat` handed some other box; a chat input left behind; a chat read asked
  through the list's slot or the ctx's call.

## Requirements (goal/G41.23)

- **Each ✅ or ❌ through the icon element** (Andy, goal/G41.21: *"this element will replace icons painting all shell
  elements and apps."*; then *"fix the fucking code."*): the list draws each test by a row element (`element(row)`, as
  Contacts and Icons do), and the Result cell holds the icon element alone, its class the one an icon made on the page
  carries. Fallout loads `shell/js/rowElement.js` and `shell/js/icon.js` itself. Deskverify's rows and the Desk's call
  are untouched, the column's field is `outcome`.
- The real-list page runs a shell file Fallout asks for once, as it runs the list's libraries, and its markup is made
  from what each element holds now, as a page's is.
- What its test must try to break: a ✅ or ❌ drawn as text; icon.js not loaded.
