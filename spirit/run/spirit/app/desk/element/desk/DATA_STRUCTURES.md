# Desk — data structures

Desk keeps nothing in its own folder. Its record is the desk server's
(`spirit/run/spirit/app/desk/desk.js`), in the node's state and never in
git (desk/G1 D5: *"any appServer state is none of git's business"*). The
page reaches it by the server's verbs, `desk.<verb>`, on the flat apiDoor,
and hears every change as the server's publish, which the desk family's
cache manager (`spirit/run/spirit/app/desk/data.js`) keeps in
`spirit.data.desk.data`. Andy, 2026-09-28: *"this IS the official project
governance. NOW."*

## Where it lives

In `spirit/run/spirit/state/desk/data/desk.db`, the folder the node hands
the desk server as `--state` (`spirit/run/spirit/job.js`, `runServer`).
There is no log of writes: the keyed tables are the store (goal/G33.4).
An id is two numbers, goal and item (0 for the goal itself), shown as
`goal/G<n>` or `goal/G<n>.<m>`.

| table, keyed by | what | Desk reaches it by |
|---|---|---|
| `items (goal, item)` | the item's own fields as JSON; a goal's row (item 0) also its goal's (design, members, special) | `items.search`, `item.get`, and the writes (`goal.add`, `item.add`, `item.rename`, `item.delete`, `press`, …) |
| `chat (goal, item, seq)` | one chat line, with `at` and `creator` | `item.chat`, `chat.search`, `chat.add` |
| `box (goal, item, version)` | one version of the item's box | `item.box`, `item.box.search`, `box.write` |
| `checks (goal, item, number)` | one Q, G, C or T check | `item.checks`, `item.checks.search`, `check.add`, `check.set` |
| `files (goal, item, holder, path)` | one file an agent listed, with its grant status | `item.files`, `item.files.search`, `item.files.add`, `item.files.remove` |
| `claims (goal, item, claimer)` | one agent's claim | `item.claims.search`, `claim` |
| `suites (goal, item, path)` | one suite a Verify of the item runs | `item.suites.search`, `item.suites.add`, `item.suites.remove` |
| `agents (agent)` | by key: its label, its last write, its word, Andy's profile of it | `agents.search`, `profile.get`, `profile.set` |
| `rules`, `rule_drafts`, `rule_chat` | every version of every rule (the newest row per rule is the rule), his draft between versions, a rule's chat | `rules.search`, `rule.get`, `rule.add`, `rule.draft`, `rule.version` |
| `desk_state (k)` | the desk's own few values: the change number, the current goal, the grants | — |

Every row carries its creator. Every write takes the next change number,
stamped on each row it changed and on each row it publishes.

## What Andy has seen

An item's `seenAt`, in its row, and its `alert` mark (brought back, or a
line from the agent holding it). The item's dialog presses `seen` as it
opens an item marked alert, which clears it; `seen.get {id}` and `seen.set {id, at}` read
and move `seenAt`.

## What the page holds

Only what it shows: the List is `items.search`'s answer and the publishes
seated in the desk's branch of `spirit.data`; an item's box, checks, files
and chat are its dialog's (`spirit/app/desk/element/deskDetails`). The List's toggles are
Current Goal Only (on when Desk opens), Goals Only and Include Closed.
