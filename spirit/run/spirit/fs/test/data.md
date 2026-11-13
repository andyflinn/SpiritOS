# spirit/fs/data.js — its own test

What a client knows of a node's files (goal/G41.28): the tree the `spirit.fs` job streams (goal/G30.18), and the icon
set. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside the real `spirit/data.js`; the test reads through `spirit.data.fs.data` alone.

- In node, `spirit.cacheManager('fs')` finds it.
- **A connecting page's tree** comes as create commands, then `treeComplete`: the branch fills quietly and its watchers
  hear one word at the end (`''`); `ready()` is true then and never before. After that each change is told by path.
- A folder is kept as a folder, a file as a file with its size and modified time; a file changed keeps its kind.
  `core` is true only where the node says `true` (goal/G30.21).
- `deleteFile` lets the file go; `deleteDirectory` the folder and everything under it, nothing beside it
  (`media2/` stays when `media` goes). A command without a path, or a job of another id, keeps nothing.
- Reads: `file(p)`, `files()`, `ready()`, `watch(fn)`, `watch(path, fn)` (that file alone; goal/G43.32, Andy:
  *"a BRANCHE's what is called \"watch\""*), `branch` under the node that served it. Another node's tree is filed
  under that node.
- **The icon set**: `icons.keep(set)` keeps each glyph with its keywords (a list, else none), and a set kept again
  replaces it whole; `icons.row`, `icons.watch(glyph, fn)`, `icons.branch`, apart from the tree's.

## What its test must try to break

- Watchers told of each file while the tree arrives; `ready()` true early.
- `core` true for a value that is not `true`; a folder turned into a file by a change.
- A folder delete that takes a sibling sharing its prefix, or leaves its children.
- An icon set that only adds.
