# shell/shared/js/deskData.js

The desk's translator (goal/G33.3, goal/G33.4): what the desk's stream means for spirit.data (`shell/js/spiritData.js`),
in the page and in node alike. A desk component's shared part, so in `shell/shared/js` (goal/G41.11; Andy: "desk
components can make their own shared stuff in spirit/run/shell/shared/js"). Its test runs it beside the real
spirit.data, as the module runs. Read from the module's code (goal/G41.11).

## API

It registers a translator on `spirit.data` (its `onJob` reads jobs of module `process/js/desk` whose `app` is an
object) and answers `spirit.deskData = { published(o), took(verb, args, answer) }`. Without `spirit.data` it does
nothing. It writes only through `set`, `merge` and `del`:

- `deskItems/<id>` an item's facts; `deskItem/<id>` the parts read so far; `desk/current` the goal last pushed whole;
  `desk/change` the newest change number heard.

## Requirements

- **A row** (`item`, an object or a JSON string, with an id) is kept as `deskItems/<id>`; facts without an id, broken
  JSON and non-objects are dropped.
- **A goal pushed whole** (`verb: 'goal.whole'`) of a goal other than the current and the group chat (`goal/G0`):
  everything kept of other goals goes, rows and parts; the group chat's items stay, and so do rows of the new goal that
  came before it; it becomes `desk/current`. The group chat never becomes current; a goal.whole of the current goal or
  any other row drops nothing.
- **A removed row** deletes the item's facts and its parts.
- **The change number** is raised, never lowered; a change that is not a number is not taken.
- **A bundle** (goal/G41.11) `{ change, rows: [...] }` sets `desk/change` and takes each row as the single row it is
  (two goal.whole rows of one goal keep both).
- **took** keeps a part only for an item that has a row, of the current goal or the group chat, once a goal was
  pushed: `item.box` `{box, version}` (version a number), `item.chat` `{chat, chatMore}` (not an older page, `before`),
  `item.checks` `{checks}`, `item.files` `{files, filesMore}` (not files `under` a folder). Anything else keeps
  nothing and throws nothing.
- **Side rows** keep current only a part already read:
  - `box` replaces the box and version;
  - `chat` adds a line, or replaces the same line (by, at, text); a removed or row-less one changes nothing;
  - `checks` adds or replaces by number; answered and cleared go; removed goes by `at`;
  - `files` one agent's path each: the same holder and path replaces, removed goes by `holder|path`; the entry is
    rebuilt as `{path, by, core (true only when true), grant}` plus `late: true` only when the row carries it
    (goal/G41.11); core first, then by path; `filesMore` false.

## What its test must try to break

- A goal pushed whole that leaves another goal's rows or parts behind, or drops the group chat.
- A bundle that keeps only its last row, or a change number lowered.
- A part kept for an item of another goal, for a narrower read, or for a part never read.
- A late file losing its mark, or a mark appearing on a row that had none.

## goal/G41.12, box v39

- **Checks and file lists learned from rows** (Andy: "checks and file lists learned from rows"): a check row or a file
  row of an item never read starts its list; a file list so started is `filesMore: true`, maybe incomplete (cw). The
  word that a Push ends with to mark the lists whole is not asserted yet: cw names it.
