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

- The owner, on loopback, asks a throwaway app server planted in a lab node (goal/G47.3) for a text past `ANSWER_MAX`: it
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

## The node runs no app code (goal/G43.32)

Andy: *"isolation, we don't want the NODE to run the validation, because we want the node kept safe from "foreign"
code."*, *"so, really the appClient.js has no business running or parsing code. that must be done by the plugin. i don't
care if it's spirit/appServer.js, since it'll crash with the server process and leave the node intact."*, and *"for
one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js", then the appServer module
"requires" that script and passes it a ready-made spirit-object with it's spirit.check already done"*. The box: *"The
node starts every app server, one-shot and long-running alike, as appServer.js with the app's path"*.

- `appClient.js` loads no app's `api.js`, nor any other of an app's code (no `require` or `spirit.require` of it).
- A permanent app server runs as `spirit/appServer.js` with the app's script path after it (read from the process's
  command line, on Linux).
- A call that breaks a one-shot app's `api.js` (`icons.icon {op: 42}`, `op` not an id) is refused 400, and by the app's
  own run: a run of the app starts for it (the icons job names a pid it did not name before the call), and that run is
  `spirit/appServer.js` with the app's path. A node that refuses it itself, running the app's `api.js`, starts no run.

### What its test must try to break

- `require(row.api)`, or any load of an app's code, left in `appClient.js`.
- A node that still starts `spirit/app/<name>/<name>.js` itself, without `appServer.js` in front.
- A bad call refused before any run of the app: the node checking with the app's code.
