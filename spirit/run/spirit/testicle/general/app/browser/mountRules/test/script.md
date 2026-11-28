# The app browser rule module, the browser tests on one page

goal/G47.1, box v144, *"this cycle, first: the browser tests on one page"*; goal/G49.27, step 2b: the module is `../script.js`, the whole of the old app -browser runner of spirit/test/, its runner now `spirit/testicle/run/browser/script.js`, and this the runner's test moved here with it. Its test is `./script.js`: the general test run as testicle runs it, handed six real elements of testicle's face and one planted script under `spirit/app/testicle/` that never ends (a file of its own for the run, removed after), watched from outside: the processes it starts, its time, and what reaches the testicle of the node this checkout reports to.

## Requirements

- The run ends by itself, within four minutes, the hung script among its scripts.
- The whole run starts one node (box: *"run on one node and one Chrome for the whole run"*).
- The whole run starts one Chrome.
- Every element after the hung script is judged, its results standing in testicle from this run (box: *"only a hung page is reloaded"*).
- The hung script is judged red.
- The first element's result stands in testicle while the run still goes (box: *"every result reaches testicle the moment the page knows it"*).
- The run takes at least 80% less than the time measured before, 3.7 s a script on Linux, 10 s on Windows, measured on spirit/testicle/general/browser/pageRules/script.js (box: *"the target: at least 80% less test time"*).
- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `browser`, own `true`.
- No fixed sleep in the old app -browser runner of spirit/test/ or its rule module `spirit/testicle/general/app/browser/mountRules/script.js` (box: *"no fixed sleeps in the checks: each wait ends the moment the page has settled"*).

The processes are counted on Linux only.

## Its contract, as the old runner's spec said it (moved here, goal/G49.27, step 3: the runners of spirit/testicle/run/ have no part of their own)

The -browser general test beside `spirit/app/manager/script.js` (goal/G47.1, box v140-142): it judges the scripts under `spirit/app/` and
below in a page, the page twin of `spirit/testicle/general/app/any/folderRules/script.js`. What holds for every page script is
`spirit/testicle/general/browser/pageRules/script.js`'s.

**Its rule module** (goal/G49.27, step 2b): this file is the runner of `spirit/testicle/general/app/browser/mountRules/script.js`, which holds all its checks in one world, every title kept. The module's own test, once this file's, is beside it, `test/script.js`.

    node the old app -browser runner of spirit/test/ [<script> ...]

Handed scripts, each in its reach is judged, its result reported for that script; handed none, every script under
`spirit/app/` the tree keeps.

### Requirements

Andy: *"i just want the fucking status box to fail a fucking test if it does NOT fucking mount its own shit by itself"*;
the box: *"a new general test, spirit/test/app-child-browser.js: every element under spirit/app/, mounted alone on a scratch
node with its app's server on, is red unless it loaded its own app's api.js and data.js."*

- Its reach: a script under `spirit/app/<name>/`, in no test folder.
- One scratch node (the tracked files) with the server of every app judged turned on, where the app's folder holds one
  (`spirit/app/<name>/<name>.js`; Andy: *"a server MUST be mounted if a mountable server exists in that app folder before a
  test is conducted"*); no page is opened before each of them answers its interface.
- Each script is opened alone on its bare DEBUG page, `spirit.js` and that file (`spirit/DEBUG/headLessBrowser/script.js`). Whether
  it installs an element the page says, no code read.
- An element, mounted: `spirit/app/<name>/api.js` and `spirit/app/<name>/data.js`, each that the app's folder holds, stand
  in the page's `spirit.required`. On a bare page nothing else loaded them, so a missing one is red at 0.8: it leans on its
  mounter. One title, reported for each script.
- A script that installs no element, or an app with neither file, is said as a comment, never green.
- No made-up data: nothing is planted (box v113).

### Each app does what its own manifest says (goal/G47.4)

Andy: *"THIS IS something that belongs in fucking app-child-browser"*, *"that fucking test is useless, it fucking assumes settings in fucking spirit/app/<name>/<name>.json"*, *"you make bloody well sure that such stupid hard-coded tests move to app-child-* immediately"*. Every judged app is read from its own `<name>.json`; no app's settings are written in this test. After the scripts, one face page on the same scratch node:

- Every app saying no `shell.mount: true` and not `node.run` is made active first, by the verb, else on its disc in the scratch run, so only its manifest can keep its tile away. The app selector mounted as boot.js mounts a shell, with no options, shows no tile of it.
- An app saying `shell.mount: true`: its `spirit/app/<name>/element.js` is there (red under its script if not), and, filed under that element.js when this run judges it, it mounted alone on its bare page.
- An app saying `node.run`: the app search as a pane lists it, as a dropdown pressed open does not, and its detail shows a Run button and no Activate.
- An app saying `node.mount: true` (with its server script there): its server, switched on in the scratch node, starts and answers its interface; and its folder `spirit/state/<name>/` holds only `node.json`, `cache/`, `data/` and, on Linux, `door.sock`. Moved here from the jobs test, which kept its own list of the tree's servers (goal/G47.4).
- Each app's results are filed under its `<name>.js`, else its `element.js`, whichever the run judges; the app selector itself is not judged as drawn. When the world or this phase did not run, each check is said red.
- Not judged here: that an app saying `shell.mount: true` shows its tile, which would make every such app active on the scratch node.
