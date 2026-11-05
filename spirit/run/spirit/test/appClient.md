# spirit/appClient.js

The node's client of its app servers: it asks a server over its pipe and reads the answer. This file specifies it only
where a requirement here names it.

## Requirements

### A server of spirit/app/ has its door in spirit/state/<name>/ (goal/G43.12)

`pipePathFor(root, name, platform, 'app')` names it, and Windows gets a pipe name of its own. Andy: *"their new door.sock will
live in run://spirit/state/<name>/, owned by the node."* Judged in `./appServerMount.md`.

### The owner's answer on loopback comes back whole (goal/G41.28)

The ruling cw built to, for a manager bigger than one answer: the owner's call that came in on loopback is marked, and
appClient and appServer let that one answer past `ANSWER_MAX`; every other answer stays bounded.

- The owner, on loopback, saves a file past `ANSWER_MAX` into a server's family folder (`fileServer.FS.saveFile`) and
  reads it back (`fileServer.FS.loadFile`): the text comes back whole, byte for byte.
- Not tested here yet: the same answer asked through the relay is refused `app-answer-too-large`. It needs a relay in
  the test.

## What its test must try to break

- A cut answer, or a refusal, for the owner on loopback.
- A probe file left in the family folder.
