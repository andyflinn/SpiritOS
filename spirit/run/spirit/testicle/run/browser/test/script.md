# spirit/testicle/run/browser/script.js

goal/G49.27, step 3. The box (Andy's Go): *"all browser modules run in one runner: one Chrome, one scratch node, a fresh page and a fresh spirit object per module, never a Chrome per file"*, *"setup is its own timed step with its own limit: a node or Chrome that does not come up is red as that, by name"*. Its test is `./script.js`.

`node spirit/testicle/run/browser/script.js [<script> ...]` runs every rule module whose resource is `browser`, found as `../none/script.js` finds them: the tree's page rules (placeRules), the page rules of a script (pageRules) and the app mount rules (mountRules).

- **One node and one Chrome for the whole run**, booted side by side before any module runs: the node when a module sharing it applies, with the agent's server and the server of every app of a script handed whose manifest mounts one, each answering its interface; the Chrome when any browser module applies. Each its own step, limited to `test.limit.slow`, reported as *"the shared scratch node comes up"* and *"the shared Chrome comes up"*. They are named to every module and every process the run starts (`SPIRIT_MOUNT_BASE`, `SPIRIT_MOUNT_RUN`, `SPIRIT_CHROME_PORT`); what testicle hands its run is taken in place of either.
- Every page is a fresh page of that Chrome. A module with `own: true` (mountRules: it turns servers on and apps active) starts a node of its own.
- **Each module goes over every script before the next module starts**, a module whose checks answer a promise (a page drawn) waited for before its next call; handed several scripts, they are drawn in a batch (`tools.batch`). A script judged again by a later module has its success sent again (spirit/testicle/testReport/script.js).
- Handed nothing, placeRules runs each page script alone through this file (`tools.runner`), with `SPIRIT_RULE_MODULES` naming the page rules, on the run's node and Chrome.
- Its Chrome is closed and its node let go once the run ends.

The test plants two browser modules, each drawing a page for 50 ms, and one of no browser, and runs `main()` on a reporter it keeps, its node and Chrome stand-ins:

- its node not coming up, the setup step is red by its name; no Chrome found, red by its name, one found, green;
- it runs every browser module and no other, each handed this runner;
- handed several scripts, each module draws them one after the other, in a batch;
- the servers of a script of an app whose manifest mounts one are turned on with the agent's.
