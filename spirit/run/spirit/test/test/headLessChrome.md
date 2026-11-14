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

The layout of `repo://lab/` itself (labMaster moved there, the old test folder's leftovers gone, `.gitignore`, no test starting
`spirit/server.js` itself) is judged by `../spirit-sibling-general.js` over the whole repository.
