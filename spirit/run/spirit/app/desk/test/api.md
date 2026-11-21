# spirit/app/desk/api.js

The desk server's interface (goal/G32.3): every verb the desk serves, each argument with its rule, written to
spirit.js's standard (`'?'` after a rule makes it optional). The node answers this text to `api {family}` and maps it to
its name; the spirit object checks every call against it before the call leaves (`spirit.check`). Written by hand from
the handlers (Andy, 2026-10-22: "request validation worth a damn?").

## Requirements

- It exports `{ verbs }` and nothing else: it names no family of its own.
- Each verb's arguments are a plain object; each rule is one of spirit.js's rules (`spirit.rules`), with `'?'` optional.
- DEBUG is appServer's, not listed.
- **Every verb listed is served**: a handler in desk.js's verb table or appServer's
  streamPublisher (`subscribe`, `unsubscribe`).
- An argument is required wherever the handler needs it, optional only where the handler lets it be left out; the rule
  is the tightest every value the handler takes still passes:
  - `''` is a real value for `box.write` text, `chat.search`'s filters (all sent), `check.add` words and test,
    `press` id (start-design with nothing open).
  - Optional: `item.status` tone. `unsubscribe` takes nothing and refuses anything given.
  - `box.write` version is a number; `items.search`'s three flags are booleans.
  - `item.add` takes a goal and a title, its title passing the label rule, and `blocks`, the goal or item the new one
    blocks, left out or given (goal/G49, the plunger).
- An argument a verb does not take is refused (no-such-argument).

## What its test must try to break

- A rule spirit.js does not know (the call would be refused before it left, for every caller).
- A verb listed that the server does not serve.
- A `''` the handler takes refused by a rule too tight (`id` where `text` is meant).

## Found while reading, not asserted

The other direction of "a verb added to the server is added here": desk.js serves `item.rules.add` and
`item.rules.remove`, which this file does not list, and its `rule.add` and `rule.version` take an optional
`autoAttach` this file does not list. The test does not assert it, since the current code would go red.

## Rules go out of Desk (goal/G47.4, box v36)

Andy: *"Next we kill rules from desk. nobody observes them"*, *"are we ready to strip rules out of desk now?"*, *"go!"*.

- None of the seven rule verbs is declared (rule.add, rule.draft, rule.get, rule.version, rules.search, item.rules.add,
  item.rules.remove); the rules.search and rule.add checks go.

## The desk cut (goal/G48.8)

Andy: *"get rid of the fucking bubbles"*; all signoff logic goes; the profiles: *"no, they go"*; *"get rid of all item.files
logic"*; *"get rid of all item.checks verbs and their logic"*; *"get rid of \"seen\" verbs"*; *"get rid of all phase logic"*;
*"get rid of block unblock"*; *"get rid of claim"*; and of the gates, *"get rid of all the fake regulation in desk"*. Q7:
check.add and check.set *"fine, keep those"*.

- None of the 26 cut verbs is declared: agent.state, agents.search, signoff, profile.get, profile.set, box.take,
  box.release, item.take, item.release, line.take, item.files, item.files.add, item.files.remove, item.files.search,
  item.checks.search, seen.get, seen.set, phase.take, phase.may, phase.done, claim, work.open,
  item.claims.search, block, block.targets, unblock. Their argument checks go.
- check.add and check.set are still declared, for the red Qs; item.checks stays too (Q8, Andy: *"whatever you want"*).
