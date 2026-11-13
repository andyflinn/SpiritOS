# spirit/test/spirit-sibling-node.js

The -node general test beside spirit.js (goal/G47.1, box v94, 2: *"there will be, from now on only 3 types of general
tests"*, *"existing general tests fold into the appropriate of the 3 new general test name-formats"*): generalRules'
checks that load a script on the node (goal/G43.32, the box, testing point 3; Andy: *"a general test for any
scriptFile.js is to spirit.require() it."*, Q5: *"I'm NOT demanding that all scripts load in all environments, I'm
demanding that they're placed in the spirit object according to these rules IF they are required."*).

    node spirit/test/spirit-sibling-node.js [<script> ...]

## Requirements

- Each script is required in a process of its own, in a copy of the tree, so a server script never starts on the live
  checkout. The copy is a scratch node's tree (its tracked files), with the apps of the scripts handed turned on (every
  app, handed none) and its environment naming that node's port (goal/G47.1, cleaning: an app's api.js binds its family
  through the node, and spirit/app/backup/api.js went red "this VM has no node" in a copy without one).
- No argument: every tracked product script but spirit.js; of those that load on the node, each answers spirit.require at
  once and stands at spirit.required.<its path> (a branch's api.js, which binds its branch, judged by its place alone); a
  script that does not load on the node is left unjudged. Titles: *the world: the product scripts, each required alone on
  the node and on a page*, *the world: some of them load on the node*, *on the node: all that load answer at once and stand
  at spirit.required.<path>*.
- One script: *on the node: it loads, answers at once and stands at spirit.required.<path>*; a script that does not load
  on the node fails it, saying why. A program, a script that ends its process when loaded with nothing thrown (an app
  server with no --state), has loaded (box v95, 1: *"A process that ends with nothing caught has loaded, whatever its exit
  code"*): it passes, its place not judged; on the whole tree it is left unjudged. Still loading after 20 s: a hang, red. Several scripts: each judged in this one run, its result reported for that script (testReport's opts.script), so a failure says which.
- *"node only scripts are tested by -general AND -node general tests ... if a script is NOT browser only AND NOT node only,
  it will be tested by all 3 categories"*: testicle hands it no browser-only script.

## What its test must try to break

A script that answers a promise, or stands nowhere in spirit.required; a server started on the live checkout; a script
of several judged under another's name.
