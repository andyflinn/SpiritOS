# spirit/testicle/run/node/script.js

goal/G49.27, step 3. The box (Andy's Go): *"one runner per resource starts it once and runs every module needing it"*, *"a module that changes its node (grants, files, contacts) says so (own: true), and gets a node of its own; every other module shares one"*, *"setup is its own timed step with its own limit: a node or Chrome that does not come up is red as that, by name"*. Its test is `./script.js`.

`node spirit/testicle/run/node/script.js [<script or folder> ...]` runs every rule module whose resource is `node`, found as `../none/script.js` finds them.

- **One scratch node for the whole run**, started once before any module runs, when a module that shares it applies: its own step, limited to `test.limit.slow`, reported as *"the shared scratch node comes up"*. The node testicle hands its run (`SPIRIT_MOUNT_BASE`) is taken in place of one of its own (`scratchNode({ shared: true })`).
- The modules sharing it get it as `tools.node.node`; a module with `own: true` an empty holder, so it starts its own.
- Each script handed is judged by every module it fits before the next script (its success goes out once).
- Its node is let go once the run ends, unless a module let it go first.

The test plants a module sharing the node, one with `own: true` and one of no node, and runs `main()` on a reporter it keeps, its node a stand-in:

- its node up, the setup step is green by its name; not up, red by its name, and the modules still run;
- it runs the node modules and no other;
- the sharing module gets the run's node, the own one an empty holder of its own;
- its node is let go once the run ends.
