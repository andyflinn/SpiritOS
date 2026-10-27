# process/js/desk/desk.family/api.js

The desk server's interface (goal/G32.3): every verb the desk serves, each argument with its rule, written to
spirit.js's standard (`'?'` after a rule makes it optional). The node answers this text to `api {family}` and maps it to
its name; the spirit object checks every call against it before the call leaves (`spirit.check`). Written by hand from
the handlers (Andy, 2026-10-22: "request validation worth a damn?").

## Requirements

- It exports `{ verbs }` and nothing else: it names no family of its own.
- Each verb's arguments are a plain object; each rule is one of spirit.js's rules (`spirit.rules`), with `'?'` optional.
- DEBUG and DEPENDENCIES are appServer's, not listed.
- **Every verb listed is served**: a handler in desk.js's verb table, in its stackFrameChecks plugin, or appServer's
  streamPublisher (`subscribe`, `unsubscribe`).
- An argument is required wherever the handler needs it, optional only where the handler lets it be left out; the rule
  is the tightest every value the handler takes still passes:
  - `''` is a real value for `box.write` text, `chat.search`'s filters (all sent), `check.add` words and test,
    `claim` commit, `press` id (start-design with nothing open), `profile.get` agent, `item.files` under.
  - Optional: `item.add` blocks, `item.files` under, `item.status` tone, `phase.done` pass and why, `profile.set`
    included and cap.
  - `box.write` version is a number; `items.search`'s three flags are booleans; `rules.search` types and statuses lists.
  - `item.add` title and `profile.set` name pass the label rule; `rule.add` text the paragraph rule.
  - One row a write (goal/G40.3): every `.add`/`.remove` of files, suites and paths takes one path, never a list.
- An argument a verb does not take is refused (no-such-argument).

## What its test must try to break

- A rule spirit.js does not know (the call would be refused before it left, for every caller).
- A verb listed that the server does not serve.
- A `''` the handler takes refused by a rule too tight (`id` where `text` is meant).
- A list sneaked into a one-row-a-write verb.

## Found while reading, not asserted

The other direction of "a verb added to the server is added here": desk.js serves `item.rules.add` and
`item.rules.remove`, which this file does not list. The test does not assert it, since the current code would go red.
