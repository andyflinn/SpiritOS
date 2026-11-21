# spirit/app/desk/desk.js

The desk server: Andy's goals and items, their boxes, chats and checks, written into its keyed tables (desk.db) and
published to his pages and to every subscriber. This spec holds what its test asserts; the rest of the module's behaviour
is added here as its test folder grows (box v10: "The desk system scripts get their own test folders").

## The desk cut (goal/G48.8)

Andy: *"get rid of the fucking bubbles"*, all signoff logic, the profiles (*"no, they go. you know what i call each of
you."*), *"get rid of all the fake regulation in desk"*, *"get rid of all item.files logic"*, *"get rid of the idea that i
need files before i can end design"*, *"get rid of all item.checks verbs and their logic"*, *"get rid of \"seen\" verbs"*,
*"get rid of all phase logic"*, *"get rid of block unblock"*, *"get rid of claim"*, *"\"code\" and all its logic goes"*,
and *"kill ALL tests related to killed verbs and features, NO GARBAGE!"*. So the checks of file lists, seen, addressing by
nick and ALL, the auto-cap and the box hold, the phase wake, the agent bubbles and their grants, the auto pull on a claim
and the desk-owner mark went with them, and the seeded items carry no blocks.

- His Go on an item with no file listed is taken; there is no code press.
- **A line's first word is its `to`** (Andy: *"all desk needs to do is scan for a line starting with a \"word:\" ... and
  throw it into a \"to\" field, that your wait can check"*, *"desk doesn't need to know"*; of cw's *"the first word of
  every chat line, lowercased, goes into its to, checked against nothing"*: *"agreed, no punctuation."*): his lines
  "wsl, look here", "all: your thoughts?", "cw (a) leaves it clean" and "The plainest rule" are published, to his pages
  and to a subscriber, with `to` wsl, all, cw and the.
- A subscriber is another node's desk in client mode (`subscribe {family: desk}`, its deliveries to `desk.listener`),
  since deskClient went.

## Requirements (goal/G47.1, Q16): no old versions are kept

Andy, of old box versions among the unread logs: *"ALL OF THEM. KILL THEM. NOBODY READ THAT SHIT, THEY SHOULD NOT
EXIST."*

- After two writes of an item's box, desk.db's `box` table holds one row of that item, the newest, carrying the version
  `item.box` answers (the number keeps counting).

## Requirements (goal/G41.11)

- **Bundles, for Desk only** (Andy: "agreed to publishing lists, FOR DESK ONLY, this is NOT a general rule"): the desk's
  list publishes go out as bundles: a goal pushed whole (made current, or a client subscribing) reaches a subscriber as
  bundles of rows, several rows a post, each post within one payload, not one post a row.
- **The box's room**: a box write too big for one answer is refused with the room of one answer; a write to 80% of it
  lands.
- **Every push ends with its end entry**, `{ run, n, full: true, end: true }` (spirit/server/app.js, the stream protocol
  of goal/G41.12), once, after its last row (Q5: the push has landed whole). A subscribe with no since, or since 0,
  brings the current goal's facts whole and no chat line, check or box.
- **Not required, so not checked**: a catch-up from a desk change number (a subscribe's position is the publisher's
  `(run, since)`, goal/G41.12), and a subscriber kept after a failed delivery (Andy: "take the 3 seconds out,
  appServer.js calls peerPost in the most basic way": a delivery left unanswered drops its subscriber, which subscribes
  again when it is back).
- `chat.search` keeps the lines since a UTC time, and before one (goal/G48.4, Q5).

## The pretend node

It reads the door's `{ call, args }` (goal/G41.15) and each delivery as a bundle of entries `{ run, n, row }`
(goal/G41.12).

## What its test must try to break

- A goal pushed whole as one post per row.
- A push without its end, or with two.
- A Go refused for an empty file list.

## goal/G43.3: the List's search

From the item's box, in Andy's words. Each of these runs on a desk of its own.

- *"the search needs only those fields of a row that it actually displays."* An `items.search` row holds only what the
  List's cells, presses and filters read. The goal's row also holds what the page draws from it, the waiting count and
  the design state, because at open that answer is all the page has (found at the verify of f181acfb); the design state
  is as item.get says it. On a goal of 25 open items, the first answer holds the goal and all 25. The server still
  searches what the row no longer carries (goal/G41.28): a chat word finds its item first.
- *"the search filter [include closed] doesn't mean "exclude open ones"!!!!"* With 40 closed items older than 5 open
  ones, the filter off shows the open only. On, every open item is in the answer, ahead of the closed ones, and closed
  ones show.

## Rules go out of Desk (goal/G47.4, box v36)

Andy: *"Next we kill rules from desk. nobody observes them"*, *"are we ready to strip rules out of desk now?"*, *"go!"*.

- The three old rule tables (rules, rule_drafts, rule_chat), planted with a row each in the desk.db before the desk
  starts, are gone once it runs, and none is made.
- An item and a goal answer no rules and no phaseRules.

## The listener and the publisher's verbs (goal/G47.5)

The desk, a publisher only, names listener, subscribe, unsubscribe and remote in its api tree in server mode, and no
streamListener (Andy: *"they're both auto-verbs. MUST BE."*, *"PLEASE call the damn thing jus \"listener\""*).
