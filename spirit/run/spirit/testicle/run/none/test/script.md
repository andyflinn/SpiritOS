# spirit/testicle/run/none/script.js

goal/G49.27, step 3. The box (Andy's Go): *"one runner per resource starts it once and runs every module needing it, each pulled in by spirit.requireScript"*, *"the runner of a resource requires every module naming it, asks each appliesTo, and runs its checks"*, *"cheapest first: modules needing nothing, then a node, then the browser"*, *"each red is shown the moment it happens, with its module and its check, not in a report at the end"*. Its test is `./script.js`.

`node spirit/testicle/run/none/script.js [<script or folder> ...]` runs every rule module whose resource is `none`. Handed nothing, each module whose `appliesTo('')` is true judges all it applies to; handed scripts, each script is judged by every module whose `appliesTo` takes it, its results reported for it (`test.forScript`).

- **No central list.** Every folder under `spirit/testicle/general/` holding `script.js`, outside a `test/` folder, is a rule module, pulled in by `spirit.requireScript` by its full path (`found()`). `SPIRIT_RULE_MODULES`, when set, names a folder under it: only the modules in it run.
- **A module that does not load, or whose checks throw, is red** under a fixed title of its own (the titles the old runners said), or *"a general part of it makes its tests without throwing"* for a module that had none.
- **Every module is handed** the reporter (its own, naming the module on each test), the run root, the spirit object, the run's node holder, and the forbids of every module found, by folder (Andy: *"All, cw's way"*).
- **A module with `own: true` gets a node holder of its own**, empty; every other module the run's one (`runModules`).
- **Each red is said on stderr the moment it ends**: `❌ <script> | <module> | <title>` (spirit/testicle/testReport/script.js, `opts.module`).
- The node and browser runners (`../node/script.js`, `../browser/script.js`) take `found`, `runModules`, `needed` and `timed` from here.

The test plants six tiny modules in a tree of its own (one of each resource, one judging only a file handed, one that does not load, one in a test folder) and runs them on a reporter it keeps:

- it finds every planted module by walking `spirit/testicle/general/`, none in a test folder; the one that does not load is found with no module;
- handed nothing, it runs every module of its resource and no other, each judging all; the one that does not load is red, as a part that throws;
- handed scripts, a module judges each it applies to, reported for that script, and none it does not apply to;
- a module that judges only a file handed (its `appliesTo('')` false, as the page rules) runs on a script handed, never on the whole tree;
- each test a module says names its module;
- a module with `own: true` gets a node holder of its own, a sharing one the run's;
- every module is handed the forbids of every module found;
- a setup step that does not come up within its limit is not up (`timed`);
- a resource is needed only when one of its modules applies to a script handed (`needed`).
