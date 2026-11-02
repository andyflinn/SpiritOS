# spirit-sibling-garbageRules.js

The attacker's garbage, thrown at every door of a node (goal/G41.30). Andy, the box: *"all servers (node and relay, or
serveCommon) are tested by throwing malformed paths at them, and malformed, invalid arguments."*, *"all appServers are
systematically tested for dealing with bad arguments."*, *"an appserver api can be called outside a spirit object, and
an attacker trying to crash our servers will throw ANYTHING at the api. Imitate that attacker"*, and *"what counts as
passing: the server MUST not CRASH or HANG."*

## How

- A scratch copy of `spirit/run` on a node of its own (`test/headLessChrome.js`), its app servers turned on at home
  (agent, desk, deskVerify, backup, chatClerver; the file server runs on every node). Neither Andy's node nor an agent's
  is touched.
- **Introspect** (the box: *"introspect: each server's own api answer says its verbs and the shape of their
  arguments"*): the node's own api answer, every family and verb with its request shape.
- **Then throw garbage**, raw: over a bare socket, never through `spirit.js`, the request as written.
- It says up front how many asks it will make.

## What it throws

- **Bad arguments, every verb** (the box: *"every argument is filled with every type JSON.parse can make: string,
  number, boolean, null, object, array"*, *"missing or superfluous arguments"*, *"every string argument is supplied in a
  few sizes, containing bad characters"*): each argument varied alone, the others as the verb's own example: every JSON
  type it is not; for a string argument, strings empty, of one byte, a null byte, a path that climbs, encoded climbs, a
  lone surrogate, control characters, markup, `__proto__`, and long ones up to 3/4 of the payload; the argument left
  out; one argument too many; and arguments that are no object at all.
  - **A verb that acts** (deletes, rotates, stops, sends, writes, runs; known by a word in its name) is given only
    garbage that breaks the shape itself, a wrong type: never a string into a string argument, an argument left out or
    one too many, which a lenient check could take as a real call.
- **Raw bodies at the node's door**: not JSON, JSON that is no object, a bare string, null, a body cut off half-way, one
  byte past `BODY_MAX`, a Content-Length far past what is sent, nesting 5000 deep, `__proto__` and `constructor` keys and
  calls, no Content-Type, a wrong one, invalid UTF-8, a request line that is not HTTP, a header line with no colon.
- **Malformed paths, GET and POST**: `..`, climbs encoded (`%2e%2e`, `%2f`), a 9000-character path, bad
  percent-encoding (`%`, `%zz`, a cut-off UTF-8 escape), double slashes, climbs into `relay-state/` through the
  DEBUG, shell and api routes, backslashes, `*`, and a null byte (`%00`), thrown last since it may kill the node.

## What counts as passing

Per the box, *"the server MUST not CRASH or HANG"*:

- every ask is answered with a status within 10 s; never a 500, a 504, a 5xx that says nothing, or a handler that
  failed. A 502 or 503 that says why (a relay or a peer not reachable on a scratch node) is an answer;
- after every batch of 20 asks, and after every raw request, the node answers a plain call within 3 s;
- the node is still running at the end.

A body cut off, or shorter than it says, may be held by the node until its own time runs out; the node must still
answer everybody else. Each failing verb and each failing raw request is its own check, named by the door.

What it reports without judging (not a crash, so not red by the box's words): how many asks of garbage were answered
200 by each family (a lenient check), and the verbs that answer a bad argument 502 or 503 rather than 400.

## Owed

- **The relay's door.** The box names *"node and relay"*. A scratch relay on a free port is not yet made by any product
  test helper (`test/headLessChrome.js` makes a node only); until one is, the raw bodies and malformed paths are not
  thrown at a relay.
- **Pairs.** The box: *"Pairs, not every combination"*. This file varies one argument at a time, which is the first
  of the pairs; the pairwise set over two arguments at once is not made yet.
- **The shared gate in memory** (the box: *"Every permutation is thrown at that check directly, in memory"*) is
  `spirit/test/appServer.js`'s, not this file's.

## What its test must try to break

- A request that kills the node, or leaves it not answering.
- A verb that crashes or hangs on garbage.
- A 5xx that says nothing.
