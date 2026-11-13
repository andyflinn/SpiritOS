# spirit/test/scriptClassify.js

The classifier (goal/G47.1, box v94, 1): a "special" general test under its own name, which testicle's server runs by
itself. It is named after no module, so `testModule.js` lists it in `SPECIAL`, not as a test, and the garbage rule keeps it
and this file.

    node spirit/test/scriptClassify.js [<script> ...]

## Requirements

- Andy: *"the script MUST be classified by loading it."* Each script given (none given: every tracked product script of
  `spirit/run/`) is loaded twice: once as a node script, in a process of its own (eight at a time), and once in a page, a
  fresh bare page for each script (spirit.js alone, served by its scratch node from a test folder of the copy at
  /DEBUG/<path>; plain scripts share a page's top-level scope, so one page for all would let one break the next), of
  its own scratch node (*"it ... runs where all tests run, in its own scratch node (booted once per run)"*), in headless
  Chrome. That node runs on a copy of the tree as it stands, every file under spirit/run but the state folders and
  .git: a script not yet committed is classified too, and a test's scratch tree, with no git, classifies as well.
- The class from the two answers:
  - a crash on the node for lack of a browser function (`window`, `document`, ...), none in the page: browser-only;
  - a crash in the page for lack of a node function (`require`, `process`, `module`, `fs`, ...), or a script the node
    will not serve to a page at all (it answers 404), none on the node: node-only;
  - no crash in either: it runs on both, neither flag;
  - anything else, a crash in both among it: not classifyable.
- Its scratch node has every app's server on (an app whose `<name>.json` mounts on the node), testicle's left off (it would
  classify again inside this one): an app's `data.js` asks its family's interface on a page, which a node answers only
  while that server is on. A page refused a family's interface (*no interface for the family …*, testicle's own) ran the
  script and has loaded it: the node refused, the script did not crash.
- No argument: every tracked product script, vendored code left out, as testicle never watches it.
- *"the node side counts only a thrown error, and reads its reason"*: the child loads the script inside a try and tells
  what it caught; a process that ends with nothing caught has loaded, whatever its exit code (an app server that exits at
  once, *"no --state"*, has loaded).
- *"a load that is not complete in 3 seconds counts as crash/hang: not classifyable"*, on either side.
- *"classify hard-codes server.js and relayServer.js as node-only"*: `spirit/server.js` and `spirit/relayServer.js` are
  never loaded.
- One test per script, titled `classifyable`, severity 0.8 (*"its severity is 0.8"*), reported for that script (testReport's
  `opts.script`). Classified, it tells the node's testicle by `testicle.script.classify {script, browserOnly, nodeOnly}`
  and passes; not classifyable, it fails, saying what each load answered. A refusal of the verb fails it too.
- *"the classify failing: not classifyable. No Chrome: tough luck"*: no scratch node, or no Chrome, fails every script of
  the run.

## testicle's side (spirit/app/testicle/testicle.js; its test, ../app/testicle/test/testicle.md)

- *"the testicle server continues classifying until all scripts are classified before moving to actual testing"*,
  *"interactive or not (auto)"*: while any script row has reClassify set, the runner's next job is this suite, given every
  such script, and no other suite starts.
- *"a script that cannot be classified gets an error row in the testicle table ... That row prevents it from being tested
  in any other way"*: no suite, pressed or flagged, starts for a script whose current `classifyable` row is red.
- When a classifying run ends, every script of it whose bytes have not changed since it started has its reClassify
  cleared; one it reported nothing for is failed `classifyable` there, at 0.8. A script changed during the run keeps
  reClassify, and the next run takes it.

## What its test must try to break

A browser script called node-only, or the reverse; an app server called not classifyable; a load left running past 3 s;
server.js loaded; a classified script left with reClassify set; a script with a red `classifyable` row tested anyway; a
suite started while a script waits to be classified; testing held back for ever by a script that cannot be classified.
