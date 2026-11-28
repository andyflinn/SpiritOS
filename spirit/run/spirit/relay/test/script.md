# spirit/relay/script.js — its own test

The spirit.relay branch (goal/G49.25, box v25: *"the api portion of the spirit.relay branch is removed from
spirit/relay/processor and implemented properly as a system branch in the tree"*; *"the entire set of relay verbs moves into
spirit.relay.<verb>, with only ONE, SINGLE door: /spirit"*): every verb the relay mounts for the branch, each argument with its
rule (`?` optional). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Its verbs and
their arguments are read from it, never listed in the test.

## Requirements

- `spirit.requireScript('spirit/relay/script.js')` hands back the branch, its `verbs` table among it, and brings its client,
  `spirit/relay/client/script.js`, at `spirit.relay.client`.
- Every argument of every verb is a spirit.type rule: its script, by `spirit.requireScript`, answers `isValid`, and takes its
  own `defaultValue`.
- It declares exactly the verbs the relay's node work (`spirit/relay/server/script.js`) answers on a relay (`spirit.IS_RELAY`).
- On a scratch relay (`scratchRelay`, `spirit/server/script.js --relay`), each verb it declares is a verb at the one door, POST
  /spirit: as `{ call: 'spirit.relay.<verb>', args }`, or else as an upload named in `X-Spirit-Call`; never no-such-verb. A verb
  it does not declare is no-such-verb there.
- Called with no arguments, a verb with a required argument is refused 400 bad-request, naming one of the arguments it declares
  required; a verb that requires none is never refused for an argument.
- On a node it is no branch (box v25: *"the fs watcher, when !spirit.IS_RELAY, will never mark spirit.relay as a branch"*): a
  scratch node answers each verb it declares as no such verb.

## What its test must try to break

- A verb the relay mounts that the branch does not declare (it would pass the relay's check unchecked), or one declared and not
  mounted.
- An argument rule that is no spirit.type, or one the check does not ask for.
- The branch served on a node.
