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
- **A goal pushed whole** (`verb: 'goal.whole'`) of a goal other than the group chat (`goal/G0`) becomes
  `desk/current`, and nothing kept of other goals goes, rows or parts (goal/G41.12, box v15: *"The cache keeps
  everything the server sends, every goal, no filtering on the client side"*). The group chat never becomes current.
- **A removed row** deletes the item's facts and its parts.
- **The change number** is raised, never lowered; a change that is not a number is not taken.
- **A bundle is appServer's**: it opens it and hands the rows in one by one, so the translator takes one row at a time
  and knows nothing of bundling (goal/G41.24, Andy: *"i think the translator has no business knowing anything about
  \"bundling\""*, and his decision: *"the three bundle checks go, and the other three assert my G41.12 words."*).
- **took** keeps a part only for an item that has a row, of the current goal or the group chat, once a goal was
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

- A goal pushed whole that drops another goal's rows or parts, or the group chat.
- A change number lowered.
- A box or chat line the stream brings left out; a part kept for an item of another goal, or for a narrower read.
- A late file losing its mark, or a mark appearing on a row that had none.
- The old file left, or still loaded anywhere; the cache rules left in api.js, or missing from this file in node.
