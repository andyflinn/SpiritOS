# spirit/appClient.js

The node's client of its app servers: it asks a server over its pipe and reads the answer. This file specifies it only
where a requirement here names it.

## Requirements

### A server of spirit/app/ has its door in spirit/state/<name>/ (goal/G43.12)

`pipePathFor(root, name, platform)` names it, and Windows gets a pipe name of its own. Andy: *"their new door.sock will
live in run://spirit/state/<name>/, owned by the node."* Judged in `./appServerMount.md`.

### The owner's answer on loopback comes back whole (goal/G41.28)

The ruling cw built to, for a manager bigger than one answer: the owner's call that came in on loopback is marked, and
appClient and appServer let that one answer past `ANSWER_MAX`; every other answer stays bounded.

- The owner, on loopback, asks a throwaway app server planted in a scratch copy for a text past `ANSWER_MAX`: it
  comes back whole, every byte (no branch carries an FS set since goal/G43.20, so no server folder is read through one).
- Not tested here yet: the same answer asked through the relay is refused `app-answer-too-large`. It needs a relay in
  the test.

## What its test must try to break

- A cut answer, or a refusal, for the owner on loopback.

## Two kinds of row: permanent and one-shot (goal/G43.19, box v16)

Andy: *"there will simply be two kinds, permanent or one-shot processes."*, and *"the node must execute spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that process lives only as long as the request."* Icons, the first one-shot app, switched on in the same scratch; its verbs are its own `api.js`'s.

- The world: the process list finds the permanent server's script running, once, so it can judge a run.
- Icons switched on and idle: nothing runs `icons.js`.
- The api tree holds icons, asked of its one-shot row (the box, 8), the permanent row beside it; the run that answered has ended.
- The box, 9: six trees asked at once each hold icons; a run was seen; never two runs of `icons.js` at once; none is left running.
