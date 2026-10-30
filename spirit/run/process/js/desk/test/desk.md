# process/js/desk/desk.js

The desk server: Andy's goals and items, their boxes, chats, checks and file lists, written as records and published
to his pages and to every subscribed deskClient. This spec holds what goal/G41.11 requires of it; the rest of the
module's behaviour is added here as its test folder grows (box v10: "The desk system scripts get their own test
folders").

## Requirements (goal/G41.11)

- **Bundles, for Desk only** (Andy: "agreed to publishing lists, FOR DESK ONLY, this is NOT a general rule"):
  - `item.files.add` takes a list of paths, `{ id, paths: [...] }`, the caller's list cut at one payload by a sized
    probabilityBucket; every path of it lands on the caller's list of the item in one write.
  - The desk's list publishes go out the same way: a goal pushed whole (made current, or a client subscribing) reaches
    a subscribed deskClient as bundles of rows, several rows a post, each post within one payload, not one post a row.
- **Files known in design**: a code item is not green while its file list is empty (its facts say `green: false`),
  and his Go on it is refused with a why that names the empty file list. Once a file is listed it is green and Go is
  taken. A file added after his Go is allowed, but its entry in `item.files` is marked `late: true`; a file listed
  before Go carries no such mark.
- **Addresses** (Andy: "an address is an agents nick, or all followed by any punctuation ... so that a wake up is no
  accident"):
  - `all` or a nick counts as an address only when punctuation follows it: "all agents seem busy" and "wsl is here"
    are addressed to nobody; "all: ..." and "wsl, ..." are addressed.
  - An ALL line is addressed to every included agent the desk knows: one it knows by its profile alone, and one it
    knows by its key alone (it said agent.state, no profile set). An agent Andy excluded is not addressed.
- **Auto-cap** (Andy: "red should trigger an auto-cap"): a box write that takes the box into red, 75% of one answer,
  has the desk offer the cap itself, as his "cap" line does: to every included agent with cap on. So an agent with cap
  off is refused the box (taken, the cap's why), and an agent with cap on takes it under the one-write hold. A box write
  below red offers nothing.

- **Every push ends with its end entry**, `{ run, n, full: true, end: true }` (spirit/appServer.js, the stream
  protocol of goal/G41.12, which replaced `{ bootstrapped: true }`), once, after its last row (Q5: the push has landed
  whole).
- **Gone** (goal/G41.22): *the position*, a subscribe with `since` = a desk change number, went with the one stream
  protocol (74ac4c65, goal/G41.12: "the desk's bundled() and its change-number catch-up" removed; a position is the
  publisher's `(run, since)` now). *A subscribe does not expire* went with 3ad44a6b (Andy: "take the 3 seconds out,
  appServer.js calls peerPost in the most basic way"): a delivery left unanswered drops its subscriber, which subscribes
  again when it is back. Their checks went with them.

## Requirements (goal/G41.22, box v22)

- **pushgoal** (Andy: "the current goal and all its items, get a new button in the detail panel: "push Goal", the ver
  on the desk is: "pushgoal""):
  - A verb of the desk: `family/pushgoal.json` beside the others, a description and its `request`; the family's
    `api.js` lists it (its header: "A verb added to the server is added here, in the same commit"); the server answers
    it. The test calls it with the request its own file declares, an `id` (if it takes one) being the current goal's.
  - Andy's alone: an agent calling it is refused `not-owner` (desk.js `ownerOnly`, as `item.rename` and his presses
    are), and nothing is pushed.
  - Called by Andy, it pushes the current goal whole, the goal's row and each of its items' as `goal.whole` facts rows
    (desk.js `pushGoalWhole`, as at start and at make-current), to every subscribed deskClient; no other goal's.
  - Agreed in the box: "it moves each agent's read pointer to the newest change, never back to the start". On the wire:
    every entry it sends a subscriber is numbered at or past the newest that subscriber had taken.
  - Agreed in the box: "in that same wake hands the agent every line of Andy's addressed to it that nobody took yet:
    nothing replayed, nothing lost." His line to cw that nobody took comes to cw again in the push, his line to ubi to
    ubi; a line cw took already, and a line to another agent, do not.
- **Auto pull** (Andy: "when the desk gets a claim red/build done. it pulls it's repo automatically"):
  - A red claim taken, and a build claim taken (verb `claim`), the desk pulls its own checkout: it then holds the
    commit pushed onto origin since.
  - Agreed: "it never pulls a checkout with edits of its own, or while a test run is going on in it: then it pulls
    nothing and says so under the item." Over a checkout with an uncommitted edit of a tracked file, the claim pulls
    nothing (HEAD unmoved, origin's new commit not in it), the edit stays as it was, and a line of the desk's (`by`
    desk) lands under the claimed item. While a run deskVerify took is going on (an item's `verifyRunning`: a
    `verify.answer` taken and no `verify.state` ended since), the same: nothing pulled, a desk line under the item.
  - **What the build must provide** (the test's seam): the checkout it pulls is `GOAL_REPO`, the manifest value
    `goalRepo` (default: the checkout holding desk.js), the repo the desk already names as its own for the goal file.
    The test points it at a scratch clone of a scratch bare origin, never this repo. A pull made as a node job
    (goalShare's way, `jobs.create`) or in the desk itself both work: the pretend node runs the jobs it is asked to.
    "A run going on" is the run the desk can know of, deskVerify's, seeded as a `verify.answer` record before the desk
    starts; a test run the desk cannot see is no case of this test.

### Owed, with the reason

- **The replace mark of pushgoal.** Agreed: "pushgoal replaces each agent's copy of the current goal whole, no merge:
  nothing stale survives." No mark on the wire says "replace" today: since goal/G41.15 a landed full push is placed
  row by row through the family's keep and drops nothing (spirit/appServer.js `landed`), and `pushGoalWhole` sends plain
  rows. Which mark tells a deskClient to drop its copy of the goal (a full push scoped to the goal, a row of its own, an
  entry flag) is the build's shape to name, and a check written now would guess it. Nothing stale surviving is seen in
  the deskClient (process/js/deskClient/test/deskClient.js), not here: an item gone from the goal, a stale box, gone
  from its cache after the push.
- **Its deskClient pointer.** The wire half is checked here; the deskClient's own read pointer (its place in
  `deskClient.db`) moving to the newest change is the deskClient's test's.
- **The "push Goal" button** on the current goal and its items in the detail panel is the desk page's, not the server's.

## The pretend node, brought up to date (goal/G41.22)

It read `{ verb }` at the door and each bundle element as a row; since goal/G41.15 the door is `{ call, args }`, and
since goal/G41.12 a bundle is entries `{ run, n, row }`. It reads both now: the same checks, which had gone red on the
format alone.

## What its test must try to break

- A list of paths refused, or only its first path landing.
- A goal pushed whole as one post per row.
- A code item green with no files; a Go taken on it; a late file not marked, or an early one marked.
- "all agents ..." or "wsl is ..." addressing anybody; an included agent left out of an ALL line.
- A red box write that offers no cap; a cap offered to an agent with cap off; a cap offered below red.
- A push without its end, or with two.
- pushgoal called by an agent, or pushing another goal, or a pointer sent back, or a line taken already handed again.
- A claim that pulls over edits or during a run, or that pulls nothing and says nothing.
- pushgoal missing, or taken from an agent; a push of it missing a subscriber, or an item of the goal, or carrying
  another goal.
- A pushgoal numbered below what a subscriber had taken (its pointer sent back).
- An untaken line to an agent missing from its wake; a taken line, or another agent's, replayed in it.
- A red or build claim taken and the checkout not pulled.
- A pull over an edit of its own (or an autostash that moves HEAD), or while deskVerify's run goes on; a refused pull
  that says nothing under the item.
