# spirit/app/desk/data.js

What the desk knows of its own rows at the receiving end, in the page and in a subscribing appServer alike: the desk's
translator into spirit.data (`spirit/data.js`, goal/G33.3, goal/G33.4) and its cache rules. Its test runs
it beside the real spirit.data, as the module runs.

**Where it lives** (goal/G41.24): in the desk's own folder, above its `family/api.js`, so it works in the browser and
in an appServer that subscribes, which reads it from its own disc.

- It is `spirit/app/desk/data.js`.
- Required in node, as the subscribing appServer requires it from its own disc, it answers `cache { keep, shed, answer }`:
  the cache rules of `family/cacheRules.js`, which it requires in node alone; `family/api.js` holds the verbs alone.
- deskClient's stream names it as its translator. The page loads it from the node that served it, with `spirit.require`.
- The cache file it fills stays appServer's: `spirit/state/<client appServerName>/<the sender's key in base64url>.json`,
  one per server followed (appServer.js, goal/G41.28).

## API

It registers a translator on `spirit.data` (its `onJob` reads jobs of module `spirit/app/desk` whose `app` is an
object) and answers `spirit.data.desk.data = { published(o), took(verb, args, answer), item, items, part, current, change,
... }`. Without `spirit.data` it does nothing. It writes only through `set`, `merge` and `del`, into the desk family's
view of the node that served the row (goal/G41.28, Andy, the box: *"The RAM-CACHE-is organized BY SERVER-NODE-ID at
it's lowest level."*): a row comes with its job's `fromNode`, appServer's sender. Its branches are its own and only it
names them; the test reads through `spirit.data.desk.data`: `item(id)` an item's facts, `items()` every one, `part(id)` the
parts read so far, `current()` the goal last pushed whole, `change()` the newest change number heard.

## Requirements

- **A row** (`item`, an object or a JSON string, with an id) is kept as the item's facts (`item(id)`); facts without an id, broken
  JSON and non-objects are dropped.
- **A goal pushed whole** (`verb: 'goal.whole'`) becomes `current()`, and nothing kept of other goals goes, rows or parts
  (goal/G41.12, box v15: *"The cache keeps everything the server sends, every goal, no filtering on the client side"*). No
  goal is treated apart since goal/G43.22 (Andy: *"G0 goes, from ui and server, kept in database."*).
- **A removed row** deletes the item's facts and its parts.
- **The change number** is raised, never lowered; a change that is not a number is not taken.
- **A bundle is appServer's**: it opens it and hands the rows in one by one, so the translator takes one row at a time
  and knows nothing of bundling (goal/G41.24, Andy: *"i think the translator has no business knowing anything about
  \"bundling\""*, and his decision: *"the three bundle checks go, and the other three assert my G41.12 words."*).
- **took** keeps a part only for an item that has a row, of the current goal, once a goal was
  pushed: `item.box` `{box, version}` (version a number), `item.chat` `{chat, chatMore}` (not an older page, `before`),
  `item.checks` `{checks}`, `item.files` `{files, filesMore}` (not files `under` a folder). Anything else keeps
  nothing and throws nothing.
- **A box or a chat line the stream brings is kept**, read or not (goal/G41.12: the cache keeps everything the server
  sends). A check or a file alone waits for a read.
- **Side rows** keep current a part already read:
  - `box` replaces the box and version;
  - `chat` adds a line, or replaces the same line (by, at, text); a removed or row-less one changes nothing;
  - `checks` adds or replaces by number; answered and cleared go; removed goes by `at`;
  - `files` one agent's path each: the same holder and path replaces, removed goes by `holder|path`; the entry is
    rebuilt as `{path, by, core (true only when true), grant}` plus `late: true` only when the row carries it
    (goal/G41.11); core first, then by path; `filesMore` false.

## What its test must try to break

- A goal pushed whole that drops another goal's rows or parts.
- A change number lowered.
- A box or chat line the stream brings left out; a part kept for an item of another goal, or for a narrower read.
- A late file losing its mark, or a mark appearing on a row that had none.
- The old file left, or still loaded anywhere; the cache rules left in api.js, or missing from this file in node.
