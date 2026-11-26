# Desk — data structures

Desk keeps nothing in its own folder. Its record is the desk server's
(`spirit/run/spirit/app/desk/desk.js`), in the node's state and never in
git (desk/G1 D5: *"any appServer state is none of git's business"*). The
page reaches it by the server's verbs, `desk.<verb>`, on the flat apiDoor,
and hears every change as the server's publish, which the desk family's
cache manager (`spirit/run/spirit/app/desk/data.js`) keeps in
`spirit.required.spirit.data.desk.data`. Andy, 2026-09-28: *"this IS the official project
governance. NOW."*

## Where it lives

In `spirit/run/spirit/state/desk/data/desk.db`, the folder the node hands
the desk server as `--state` (`spirit/run/spirit/job/engine/script.js`, `runServer`).
There is no log of writes: the keyed tables are the store (goal/G33.4).
An id is two numbers, goal and item (0 for the goal itself), shown as
`goal/G<n>` or `goal/G<n>.<m>`.

| table, keyed by | what | Desk reaches it by |
|---|---|---|
| `items (goal, item)` | the item's own fields as JSON; a goal's row (item 0) also its goal's (design, members, special) | `items.search`, `item.get`, and the writes (`goal.add`, `item.add`, `item.rename`, `item.delete`, `press`, …) |
| `chat (goal, item, seq)` | one chat line, with `at` and `creator` | `item.chat`, `chat.search`, `chat.add` |
| `box (goal, item, version)` | the item's newest box, its version still counting (older versions are deleted by the write, goal/G47.1, Q16) | `item.box`, `box.write` |
| `checks (goal, item, number)` | one Q, G, C or T check | `check.add`, `check.set` |
| `desk_state (k)` | the desk's own few values: the change number, the current goal, the grants | — |

Every row carries its creator. Every write takes the next change number,
stamped on each row it changed and on each row it publishes.

## What the page holds

Only what it shows: the List is `items.search`'s answer and the publishes
seated in the desk's branch of `spirit.required.spirit.data`; an item's box, checks
and chat are its dialog's (`spirit/app/desk/element/deskDetails`). The List's toggles are
Current Goal Only (on when Desk opens), Goals Only and Include Closed.
