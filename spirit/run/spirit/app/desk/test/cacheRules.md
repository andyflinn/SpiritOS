# spirit/app/desk/cacheRules.js — its own test

The desk family's cache rules, for node alone (goal/G41.28, goal/G41.12): what a subscribing appServer keeps of the
desk's rows, what it sheds past its limit, and the reads deskClient answers from them. data.js requires it in node and
hands it its branch names (`rules({ items, parts, state })`). Owed since the rule *"every production script has its own
test"* (goal/G47.1, box v72). Pure, so each test hands it rows of its own, under names of its own, and a data set that
is a plain map.

- `rules(N)` answers `{ keep, shed, answer }`.
- `keep(rows, row)` places the row last and takes out the row of the same thing it makes old: an item's facts, one side
  row (a chat line by its time and author, the box by its item, a check by its number, a file by its author and path),
  a rule by its name. A part it does not know takes nothing out.
- `shed(rows, limit, bytes)`, Andy's order (Q2: *"FIRST YOU shed the longest untouched goal, lock, stock and barrel /
  when there is only one goal, then you shed the longest untouched item, LOCK, stock and barrel, / when there is only
  one goal with one item you shed the oldest chat line."*): nothing within the limit; past it the goal touched longest
  ago, whole; with one goal the item touched longest ago, whole, the goal's own row staying; with one item the oldest
  chat line. The rules are never shed, and it stops when nothing of a goal is left to shed. It measures by the `bytes`
  it is handed.
- `answer(verb, args, D, room)` answers as the desk would (goal/G41.11; box v15: *"The client queries its own cache
  through that api.js"*): `item.get` from the facts with their version and the desk's change; `item.box`,
  `item.checks`; `item.chat` the newest lines that fit the room, oldest first, `chatMore` when some were left out or the
  stream brought only the newest; `item.files` as many as fit one answer, under the path asked, `filesMore` when some
  were left out (goal/G33.7). Null when the cache does not hold it all, for a list kept only in part, or a verb it does
  not keep, so the desk is asked.

## What its test must try to break

A second copy of a row kept beside its first; a goal shed while it was touched last, an item shed while two goals
stand, a rule shed; a goal's own row shed with an item; a chat answer that is not the newest lines or overflows its
room; an answer made from a part the cache holds only in part.
