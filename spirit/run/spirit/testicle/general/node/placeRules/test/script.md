# The node place rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the whole of the old -node runner of spirit/test/ (it had no parts) moved into a rule module, its runner now `spirit/testicle/run/node/script.js`.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `true` (it turns the apps of its scripts on in its copy and writes the copy's environment).
- Handed two scripts in one run, it makes one copy of the tree with a node of its own for both.
- A planted script whose `module.exports` is its value keeps *"on the node, the script loads, answers at once and stands at spirit.<path minus spirit>"*; one whose `module.exports` is a promise is red on it.

## Its contract, as the old runner's spec said it (moved here, goal/G49.27, step 3: the runners of spirit/testicle/run/ have no part of their own)

The -node general test beside spirit.js (goal/G47.1, box v94, 2: *"there will be, from now on only 3 types of general
tests"*, *"existing general tests fold into the appropriate of the 3 new general test name-formats"*): generalRules'
checks that load a script on the node (goal/G43.32, the box, testing point 3; Andy: *"a general test for any
scriptFile.js is to spirit.requireScript() it."*, Q5: *"I'm NOT demanding that all scripts load in all environments, I'm
demanding that they're placed in the spirit object according to these rules IF they are required."*).

**Its rule module** (goal/G49.27, step 2b): this file is the runner of `spirit/testicle/general/node/placeRules/script.js`, which holds all its checks, every title kept; the copy of the tree is the module's, made once for the run. The module's own test is beside it, `test/script.js`.

    node the old -node runner of spirit/test/ [<script> ...]

### Requirements

- Each script is required in a process of its own, in a copy of the tree, so a server script never starts on the live
  checkout. The copy is a scratch node's tree (its tracked files), with the apps of the scripts handed turned on (every
  app, handed none) and its environment naming that node's port (goal/G47.1, cleaning: an app's api.js binds its family
  through the node, and spirit/app/backup/api.js went red "this VM has no node" in a copy without one).
- No argument: every tracked product script but spirit.js; of those that load on the node, each answers spirit.requireScript at
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

### What its test must try to break

A script that answers a promise, or stands nowhere in spirit.required; a server started on the live checkout; a script
of several judged under another's name.
