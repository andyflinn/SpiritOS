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

## What its test must try to break

- A list of paths refused, or only its first path landing.
- A goal pushed whole as one post per row.
- A code item green with no files; a Go taken on it; a late file not marked, or an early one marked.
- "all agents ..." or "wsl is ..." addressing anybody; an included agent left out of an ALL line.
- A red box write that offers no cap; a cap offered to an agent with cap off; a cap offered below red.
