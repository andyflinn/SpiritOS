# spirit/test/headLessChrome.js

The test helpers: a Chrome page driven over its debugging port, and the scratch nodes and relays tests run on. Its own
test: `./headLessChrome.js`. This spec holds what goal/G47.3 requires of the nodes and relays it hands out.

## Requirements (goal/G47.3, "Redraw the lab environment")

The box: *"the move: headLessChrome.js scratchNode hands out a reset lab node instead of a fresh copy, so every test using it
moves at once"*. Each hand-out is asked from a child process of its own, as a test asks it, and judged from outside.

- **A lab node:** `scratchNode` hands out a node whose tree lies under the git-ignored `repo://lab/node/`, and no copy of the
  tree is made for it in the temp folder (*"the lab nodes made once, instead of one copy of the tree per test run"*).
- **Up, DEBUG on:** *"lab nodes run with DEBUG on, as scratch nodes do today"*.
- **The files under test:** *"a lab node takes the files under test: the checkout's commit and its uncommitted edits"*: a
  file the checkout has not committed is in the node it hands out.
- **Lab's own repo:** the node's tree is a git repo with no github remote (*"no github remote, so nothing made in it can
  reach github"*), and the checkout's branch and HEAD are what they were before the hand-outs (*"the checkout's own history
  is untouched"*).
- **Reset before each test:** a file one test left in its node's `spirit/state/` is gone when that node is handed out again
  (*"lab resets its node before each test (spirit/state/ wiped, node restarted), never the tests"*).
- **A lock per node:** with the three personal nodes held, a fourth ask waits, and is handed one of them when a holder ends
  (*"a lock file per lab node, one test on it at a time; a test that finds every lab node taken waits"*).
- **The relays:** `scratchRelay` hands out one of lab's two relays, under `repo://lab/node/`, and two asked at once are the two
  different relays (Andy: *"i specifically wanted two of them so that we can test members of one relay talking to members of
  another."*).

## The helpers a test's own world uses (goal/G47.3, the build)

Tests that made their world in plain functions, copying the tree and starting `spirit/server.js` themselves, moved onto lab
with three helpers, so every node a test uses is one of lab's:

- **`scratchTree()`**: a lab node reset to the files under test, no node on it yet, handed out without a promise (it waits
  by blocking while every node is taken). Answers `{ root, run, name, release() }`. One call takes one lab node, never more.
- **`startNodeOn(run, port, o)`**: `spirit/server.js` started on such a tree's `spirit/run` on the test's port, the child
  answered at once (`o.stdio`, `o.windowsHide` as spawn's). A `run` lab did not hand out to this process is refused.
- **`freeTree(x)`**: what a test did with its scratch root (deleted it) becomes freeing the lab node; nothing is deleted, lab
  resets it for the next test.

`scratchNode(o)` also takes `o.before(run)` (plant before the node starts), `o.start: false` (no node yet), `o.port`, and
answers `start()`, `stop()`, `restart()`, `release()`. Lab itself is `repo://lab/labNodes.js`: lab's repo `repo://lab/repo/`,
the nodes `repo://lab/node/<name>/`, their locks `<name>.lock` (the holder's pid), a node a holder started noted in
`<name>.pid`; a reset removes even a file whose name passes Windows' old path limit.

The layout of `repo://lab/` itself (labMaster moved there, the old test folder's leftovers gone, `.gitignore`, no test starting
`spirit/server.js` itself) is judged by `../spirit-sibling-general.js` over the whole repository.
