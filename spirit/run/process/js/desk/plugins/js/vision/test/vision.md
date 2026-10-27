# process/js/desk/plugins/js/vision/vision.js

The Vision plugin (goal/G27.3): Andy's vision, item by item, in place of the musings tab. A simple standard desk plugin
(R2): its goal, plugin/vision, is made by the desk at its first mount, and its UI is the Vision tab under Apps. Decided
by Andy in goal/G27.3's box, 2026-10-14 to 17; the file is not to loosen it.

## Requirements

- It exports the plugin contract, `function (desk) -> { refuses, verbs }`; `verbs` is empty.
- **R3, at mount**: when the state holds its goal and the goal is not in design, it writes `press { id: <goal>, what:
  'start-design' }`, once; a goal already in design is written nothing; a goal the state does not hold is written
  nothing. A refused write is said on stderr (`vision: its goal could not be put in design: ...`) and the mount stands.
- `refuses(verb, args, ids)` answers `''` unless one of `ids` is in its goal (`desk.inGoal`). Then:
  - `claim` is refused: a vision item takes no claim.
  - On the goal itself: `end-design` and `design-complete` are refused (it stays in design); `close`, `done` and
    `abandon` are refused (it is its data scope).
  - `abandon` on any item is refused.
  - **R4, R5**: `go`, `go-all`, `done`, `code` and `claim-done` are refused: it offers Rename, Close and Delete.
  - Everything else passes: close, rename and delete of an item, its box, its chat, and **R9** blocking.

## What its test must try to break

- A start-design written to a goal already in design, or written twice.
- A mount that throws when the desk refuses the write.
- A Done, Go or code press let through on a vision item; a claim let through.
- Close or Delete refused on an item (it must always offer them).
- A call on another goal refused.
