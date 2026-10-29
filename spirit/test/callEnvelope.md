# callEnvelope.js: a call keeps its verb name apart from its arguments

goal/G41.15. Today a call to a node's door, `POST /api/spirit`, is one object: the verb's name in a field named `verb`,
its arguments beside it. So no verb can take an argument named `verb`, and `auth.branch` (goal/G41.14) is the first that
needs one. Its test is `./callEnvelope.js`.

The box: *"ONE ENVELOPE for every call to a node's door: { call: \"<family>.<verb>\", args: { ... } }"*, *"The door ...
reads the name from body.call and hands body.args to the verb as they came: it never looks inside args"*, *"The flat form
{ verb, ...args } goes, everywhere, in the same item; the door refuses it bad-request"*, and *"An argument named \"verb\"
reaches its verb unchanged, by every path."*

## Requirements

- The builders send `{ call, args }`, and nothing else in the body; an argument named `verb` stays in `args`:
  - the shell's kernel, `spirit.core.ask` (`spirit/kernel.js`);
  - `spirit.js`'s `post`, the one builder every verb of the spirit object goes through (`spirit.tree()` asks
    `{ call: 'api', args: {} }`);
  - `shell/shared/ask.js`.
- The door, on a node of its own:
  - `{ call: 'api', args: {} }` answers the tree;
  - an app server's verb is reached by its envelope (`fileServer.status` answers its own refusal);
  - an argument named `verb` reaches the verb called unchanged: `fileServer.status`, which takes `{ hash }`, refuses it
    `no-such-argument` as its own argument;
  - the flat form `{ verb, ... }` is refused `400 bad-request`, and the refusal names the envelope it wants, `call` and
    `args`;
  - `args` that are not an object, or a field beside `call` and `args`, is refused `400`.
- No file on the item's list builds or reads the flat form any more: no payload built `{ verb: ... }`, no body
  stringified `{ verb, ... }`, no `body.verb` read at the door, no argument named `verb` dropped or skipped, and the
  face's request not read as `r.verb` in `faceHome.js`. This drift guard covers the paths the test cannot run here: the
  face's transport in `shell/boot.js`, `faceHome.js`, the shell's `spirit/client/shell.js`, `verbTable.js` and
  `events.js`. The nested `{ verb, body }` of an owner command (hub.js, ownerPost.js) is not a call to the door and is
  left alone. `deskClient.js` builds no flat call (goal/G30.6 renamed its argument for this clash).
- Not part of it: calls from node to node (nested under family and verb), the gate and the grants, which judge
  `<family>.<verb>` alone, and the relay's own `/face/api`.

## What its test must try to break

- A builder that still folds the arguments beside the name, or drops `verb` from them.
- A door that reads the name from anywhere but `call`, or looks inside `args`.
- The flat form still taken, or refused without saying what is wanted.
- A flat builder left somewhere on the list.
