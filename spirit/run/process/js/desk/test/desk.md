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

- **The position** (Andy: "(if it restarts or similar) it calls the "subscribe/(connect)" verb do desk, (re-use that
  verb) with the position number as argument"): `subscribe {family, since?}`. Without `since`, or 0, the bootstrap is
  what it always was: the current goal's facts whole, no side row. With `since` = N it hands, after the goal's facts,
  every side row of the current goal and the group chat whose change is after N, oldest first, each as the row its
  write published; nothing at or before N, nothing of another goal. A line of his addressed to other agents (its `to`)
  never comes back to one it was not addressed to; one to the subscriber, or to nobody, does. The box has no change of
  its own: an item whose own row changed after N hands its box too.
- **Every push ends with `{ bootstrapped: true }`**, once, after its last row (Q5: the subscriber replaces its cache
  whole once the push has landed).
- **A subscribe does not expire** (Andy: "subscribes over peerPost should NOT expire"): a row a subscriber did not take
  stays first in its queue and is posted to it again after the publisher's wait, the same row; once it answers, its
  whole push and what was written meanwhile land, none dropped. Past QUEUE_MAX (1000) the oldest go; that cap is not
  driven here (over a thousand rows behind a 10 s wait), it is the publisher's own (spirit/appServer.js).

## Since goal/G41.12 (box v30), where it differs from the above

- **The position is spirit/appServer.js's** (run, since), not the desk's change number: a subscribe with it is handed
  what was published after it, every goal's, never a line addressed to another agent, no full push.
- **No initial push** (Andy: "there is NO initial push for desk server, it will only PUSH the current goal row when an
  agent reconnects"): a subscribe without a position is a full push of the current goal's row alone (and the group
  chat's), none of its items' rows; it ends in one end entry.
- **The push button** (Andy: "The user get's a \"push\" button the the detail of every goal or item, to force a server
  push of that item. chat's ar only pushed as lines happen."): his `press {id, what: 'push'}` hands that item's row, or
  the goal's, to the subscribers, and no other item's.
- **A delivery not answered in 3 s drops its subscriber** until it subscribes again with its position, then it is
  handed what it missed.

## What its test must try to break

- A list of paths refused, or only its first path landing.
- A goal pushed whole as one post per row.
- A code item green with no files; a Go taken on it; a late file not marked, or an early one marked.
- "all agents ..." or "wsl is ..." addressing anybody; an included agent left out of an ALL line.
- A red box write that offers no cap; a cap offered to an agent with cap off; a cap offered below red.
- A catch-up that hands nothing after the position, or the same again from before it, or another goal's lines.
- A line to cw handed to ubi in a catch-up.
- A push without its end, or with two.
- A subscriber dropped, or its row lost, because one delivery got no answer.
