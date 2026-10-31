# process/js/desk/family/clientCacheManager.js

What the desk knows of its own rows at the receiving end, in the page and in a subscribing appServer alike: the desk's
translator into spirit.data (`shell/shared/js/spiritData.js`, goal/G33.3, goal/G33.4) and its cache rules. Its test runs
it beside the real spirit.data, as the module runs.

**Where it lives** (goal/G41.24). Andy: *"isn't the clean way of doing things to put \"shell/shared/js/deskData.js\"
where it belongs: \"process/js/desk/family/clientCacheManager.js\""*, *"where clientCacheManager.js must work in both
browser and an appServer that subscribes? and deskClient can get it form its own disc?"*, and *"if that's it, then DO IT,
now, in this item."*

- It is `process/js/desk/family/clientCacheManager.js`; `shell/shared/js/deskData.js` is gone, and no code file loads it.
- Required in node, as the subscribing appServer requires it from its own disc, it answers `cache { keep, shed, answer }`:
  the cache rules the desk family's `api.js` held, which now holds its verbs alone.
- deskClient's stream names it as its translator. The page loads it from the node that served it, with `spirit.require`.
- The cache file it fills stays appServer's: `relay-state/process/<client appServerName>/cache-<the sender's key in
  hex>.json`, one per server followed (appServer.js).

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
- The old file left, or still loaded anywhere; the cache rules left in api.js, or missing from this file in node.
