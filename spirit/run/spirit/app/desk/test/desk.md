# spirit/app/desk/desk.js

The desk server: Andy's goals and items, their boxes, chats, checks and file lists, written into its keyed tables
(desk.db) and published to his pages and to every subscribed deskClient. This spec holds what goal/G41.11 requires of it; the rest of the
module's behaviour is added here as its test folder grows (box v10: "The desk system scripts get their own test
folders").

## Requirements (goal/G47.1, box v121): no ui rule comes from a file list

Andy: *"delete the desk dead ui-rule."* The desk attached every active auto-attach ui rule to an item when a file under
`spirit/run/shell/` joined its list (goal/G40.13); that folder is gone since G43.30. With an active auto-attach ui rule
standing, `item.files.add` of a file under `spirit/run/shell/`, by a single path and in a list, attaches no ui rule.

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
  protocol of goal/G41.12), once, after its last row (Q5: the push has landed whole).
- **Not required, so not checked**: a catch-up from a desk change number (a subscribe's position is the publisher's
  `(run, since)`, goal/G41.12), and a subscriber kept after a failed delivery (Andy: "take the 3 seconds out,
  appServer.js calls peerPost in the most basic way": a delivery left unanswered drops its subscriber, which subscribes
  again when it is back).

## Requirements (goal/G41.22, box v22)

- **Auto pull** (Andy: "when the desk gets a claim red/build done. it pulls it's repo automatically"):
  - A red claim taken, and a build claim taken (verb `claim`), the desk pulls its own checkout: it then holds the
    commit pushed onto origin since.
  - Agreed: "it never pulls a checkout with edits of its own, or while a test run is going on in it: then it pulls
    nothing and says so under the item." Over a checkout with an uncommitted edit of a tracked file, the claim pulls
    nothing (HEAD unmoved, origin's new commit not in it), the edit stays as it was, and a line of the desk's (`by`
    desk) lands under the claimed item. The desk knows of no test run (no verifier involvement with desk anywhere),
    so a run going on is no case it can see, and none of this test.
  - **What the build must provide** (the test's seam): the checkout it pulls is `GOAL_REPO`, the checkout the desk
    sits in, found by walking up to its `.git` (goal/G43.28, box line 9: no goalRepo is handed). The test runs each such
    desk from a copy of the run tree inside a scratch clone of a scratch bare origin, never this repo. A pull made as a node job
    (`job.create`) or in the desk itself both work: the pretend node runs the jobs it is asked to.
  - A red claim needs no suite rows: the desk keeps no suite list (Andy: "the desk also loses the suite-list (useless,
    since testicle is driven by script changes)").

## The pretend node

It reads the door's `{ call, args }` (goal/G41.15) and each delivery as a bundle of entries `{ run, n, row }`
(goal/G41.12).

## What its test must try to break

- A list of paths refused, or only its first path landing.
- A goal pushed whole as one post per row.
- A code item green with no files; a Go taken on it; a late file not marked, or an early one marked.
- "all agents ..." or "wsl is ..." addressing anybody; an included agent left out of an ALL line.
- A red box write that offers no cap; a cap offered to an agent with cap off; a cap offered below red.
- A push without its end, or with two.
- A claim that pulls over edits, or that pulls nothing and says nothing.
- A red or build claim taken and the checkout not pulled.
- A pull over an edit of its own (or an autostash that moves HEAD); a refused pull that says nothing under the item.

## goal/G43.3: the box, the phase wake, the List's search, the file list

From the item's box, in Andy's words. Each of these runs on a desk of its own.

- *"desk cannot refuse the box to the user. agent updates will fail it the user takes the box, and desk will note so in the chat."* His `box.take` is not refused while an agent holds the box, nor under the cap's one-write hold (this replaces his goal/G9.3 and goal/G21.1 words on a hold). The agent's `box.write` then answers `taken`, the box stays as it was, and a line by the desk appears under the item. His own write under his take lands.
- *"a red-claim or a code-done should automatically trigger a phase-wake for all agents"*. A red claim alone ends the red: the phase is `build`, nobody holding it. A code-done alone opens `verify` the same way. Each time, the row that says so reaches every subscribed client, the claimer's included. That row is what wakes a client (`deskClient.js`, streamed).
- *"or the same agent that did the red phase, if that's the only one available"*. With another agent here, the red's author does not take the build, and the other does. Alone, the author takes it with no press of his.
- *"the search needs only those fields of a row that it actually displays."* An `items.search` row holds only what the List's cells, presses and filters read. The goal's row also holds what the page draws from it: the agents here and known, who is working, the waiting count and the design state, because at open that answer is all the page has (found at the verify of f181acfb). On a goal of 25 open items, the first answer holds the goal and all 25. The server still searches what the row no longer carries (goal/G41.28): a chat word finds its item first.
- *"file list should not show duplicates"*. A path two agents added is one row of `item.files`.
- *"when i add a rule to an item or goal, it will not immediately display in the rule-list."* The row naming the rule is published to his page, on an item and on a goal.
- *"the search filter [include closed] doesn't mean "exclude open ones"!!!!"* With 40 closed items older than 5 open ones, the filter off shows the open only. On, every open item is in the answer, ahead of the closed ones, and closed ones show.
- *"if the ID has grants to desk, desk should list it as one of it's agents, it keeps all agent rows in its db, to preserve label and nick, but without grant, no matter how small, there's no point showing an agent bubble."*, and *"the desk listens to the grants and adds/removes thos bubbles accordingly"*. At start the desk reads the node's grants (`auth.search`, over loopback, needing no grant), then follows the node's `bundles` job. The goal row's `agents` and `live` hold each key with a grant that is exactly `desk`, or `desk.` then a verb, whether or not it has written, and no other: a key that has written with no grant has none, and a grant on `deskClient` is no grant to desk. A grant given brings the bubble at once. The last grant revoked takes it away, one of two does not, and the row stays in the desk with its nick.
