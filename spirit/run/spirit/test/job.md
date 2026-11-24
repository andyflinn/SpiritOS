# spirit/job.js

The node's jobs. Its one test is `./job.js`, every test of `spirit/job.js` in it, a section each below. It holds goal/G41.30, the review's RH1: *"jobs.create still spawns any program"*, as goal/G43.20
rules it: *"jobs.create starts only an app's own script, spirit/app/<name>/<name>.js, of an app whose <name>.json says node
run true; anything else is refused (another command, another script, an app without node run)."* Raw calls to a scratch
node's door. Each thing asked to run would write a marker of its own, so whether it ran is read from the disk.

## Requirements

- **Another program is refused, and never runs**, a 4xx with a `code`: `/bin/sh` with a command line, `sh` from the path,
  this node's own executable given `-e` code.
- **This node's executable on a script that is not an app's own is refused, and never runs**: a script outside
  `spirit/app/`, a path climbing out of it, an app whose json does not say `node.run` true, and a second script in a
  node run app's folder (the box: *"A second script in an app folder is therefore never started."*).
- **An app's own script, its json saying `node.run` true, starts**, by this node's executable and its path; its job is its
  route, `spirit.app.<name>` (the refusal of a second start while one runs is judged under *A job's id is a route*, below).
- **Plain `node` with such a script starts**: the word `node` is read as this node's own executable; a page sends it so
  (the app detail's Run, `spirit/element/search/app/detail/script.js:68`).

## What its test must try to break

- A shell, or code on the node's own executable, run through job.create.
- A fix so narrow that an app's own node run script no longer starts.

## goal/G41.33: a process's console goes to null

The box: *"Console output goes to null by default, at the source, for every process, except node and relay. Only DEBUG turns
it on. A crash is no exception: the exit code is enough to tell us to fix it, and we debug it by hand."*

- **DEBUG off: nothing a process writes to stdout or stderr is in its job's log**, by console or written raw, a crash's
  included.
- **What is structured stays**: the node's own lines, and a line the process published.
- **A crash still says its exit code on the job.**
- **A process that floods its console does not hang**: it ends by its own exit code.
- **DEBUG on: the lines are in the log.**

## One-shot apps, registered by the node (goal/G43.19, box v16)

The box, 2: *"a one-shot app is an app with api.js and data.js at its top, node mount false or missing, and switched on. icons is the first."*; 4: *"the node registers each one-shot app where it reads the manifests and starts the permanent ones ... Switched off, its row goes, and a call to it answers app-not-served"*.

The apps judged are the test's own, planted in the scratch tree before the node starts (goal/G47.4; Andy: *"you make bloody well sure that such stupid hard-coded tests move"*): `zzshot`, a one-shot app (`api.js`, `data.js`, node mount false), and `zzserve`, a permanent server answering one verb. No app of the tree is named.

- The one-shot app, on in its `node.json` at boot, is in the api tree with no `app.active` asked, the planted server beside it.
- Switched off, a call to it answers `app-not-served` and the tree holds it no more; on again, it is back with no restart.
- With no node part in its json, the one-shot app is still served.
- The attacker: an app with `api.js` and no `data.js`, one with `data.js` and no `api.js`, and one with both never switched on are not served, and their script never runs (a marker on the disc).

## A job's id is a route

goal/G43.20, its box. Andy: *"they're supposed to identify a "route" in the spirit-tree, NOT some invented number."*,
*"ALL job id's will be routes to either a node supplied api (spirit.fs, etc...) or an app supplied id
(spirit.app.<name>)"*, *"a job cannot start if it is already running"*, and *"cw, box that only jobs in the app folder
with node:run:true can be started with jobs.create"*.

A real node on a lab node reset to the files under test (goal/G47.3), its planted server `zzserve` switched on; throwaway apps planted in that copy (`zzRun`, a run
app; `zzMount`, an app without node run) and a script in no app folder. Never a live node.

### Requirements

- No job id is a minted number (`job_<n>`); every job id is a route, `spirit` then names, dot by dot; an app server's job
  is its route, `spirit.app.zzserve`.
- One job per family (Q1, Q2, the box): the node's own jobs (kind `permanent`) are exactly `spirit`, `spirit.app`,
  `spirit.auth`, `spirit.contact`, `spirit.fs`, each id of at most two parts.
- A job carries no `type` field.
- `job.create` refuses another script, an app's script whose json has no node run, and another command; it starts a run
  app's own `spirit/app/<name>/<name>.js` under the route `spirit.app.<name>`.
- A second start while one runs is refused, "already running"; two starts at once: one gets in (pending counts as
  running).
- After a run ended, a new run is the same id, running again.

### Owed, with the reason

- **Each event carries only its own news** (contact rows and hits, presence; server-stats and join steps under
  `spirit`; the app list and app faces under `spirit.app`). The box decides it, but the fields an event carries are the
  build's to name; a check written before them would guess an API. Asserted once the build names them.
- **The Icons app initializes from spirit/iconSet.json.** Its own test, `spirit/app/icons/test/icons.js`, still reads
  `shell/icons/icons.js` with its run root one level short, and goal/G43.19 rewrites that app; the check belongs there.

### The attacker (rule/27)

- Ten starts of one run app at the same moment: exactly one gets in. Cancelled, its next start takes the same id over.
- Refused, each: the mount app reached through the run app's folder (`../`); a second script in the run app's folder;
  an app whose json says `"run": "true"`, a string; an app script with no json; a link elsewhere to the run app's
  script; the run app's script with a trailing slash; no script at all; the run app's script under `/bin/sh`.
- Ids that are no route (`..`, `../spirit`, `__proto__`, `constructor`, `spirit.app.`, `spirit..fs`, `spirit.fs/../..`,
  empty, `job_1`, `spirit.app.zzRun.extra`), asked of `job.get` and `job.cancel`: no job found, nothing crashes, the
  node still answers.

## What spirit/state/<name>/ holds

goal/G43.20, its box. job.js makes each app's folder and starts its server. Andy: *"WSL, YOU BETTER MAKE FUCKING SURE YOU
GUARD FUCKING spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not
fucking cheat with the fucking tests!!!!!!!!!!!!!!!!!!!!"*, *"put those in spirit/state/<name>/ since they belong to the
node."*, *"cache, which is written by spirit/server/app.js was ALWAYS supposed to go into spirit/state/<name>/cache/"*,
*"app data, which is written by the app, was ALWAYS supposed to go into spirit/state/<name>/data/"*.

A real node on a lab node reset to the files under test (goal/G47.3) with no `run:/process` and no `relay-state` in it; every app whose
`<name>.json` says `node.mount` true switched on, read from the app folders (Andy: *"where is the test that verifies that
an app who claims to be mountable, ACTUALLY can be mounted?"*), each judged on its own: it starts and answers its api.
Never a live node.

### Requirements

- The node starts on a tree with no `run:/process` folder, and every app server switched on starts again after a kill.
- Each app switched on has its folder in `spirit/state/` (the box: "spirit/state/<name>/ holds node.json, cache/, data/,
  and on Linux door.sock"; Andy: "so far, so good."). On Linux each server's `door.sock` is `spirit/state/<name>/door.sock`, waited for up to 10 s and judged once per app server, reported for its own script `spirit/app/<name>/<name>.js` (goal/G47.6: "the key then names the item that failed").
- That each app server starts and answers its interface, and that its own folder holds only `node.json`, `cache/`,
  `data/` and, on Linux, `door.sock`, is judged per app from its own manifest in `./app-child-browser.md` (goal/G47.4):
  this test keeps no list of the tree's apps.
- Every server is handed `spirit/state/<name>/data` as its `--state`.
- The node makes no `spirit/run/relay-state/` and no `spirit/run/process/`.

### What its test must try to break

- A server handed `spirit/state/<name>` itself as its state (its db then lands beside `node.json`): red, tried.
- A stray file in an app's state folder; a socket elsewhere; a `relay-state/` or `process/` made again.

### The attacker (rule/27)

After each, the layout holds (every app's folder only `node.json`, `cache/`, `data/`, `door.sock`; no `run:/relay-state`,
no `run:/process`):
- an app server switched off and on again (the first the tree's manifests give, none named);
- the node killed (SIGKILL) and started again on the same tree, every app server starting again;
- `app.active` with names of no app (`..`, `../..`, `relay-state`, `process`, `../relay-state`, `zzserve/../../x`, `.`,
  empty, `con`, `zzserve/`, `a b`, `__proto__`): every one refused, and no folder appears at the run root;
- an app's folder taken away while it runs: the node still answers.

## No run://node_modules/: chokidar and readdirp in spirit/job/

goal/G43.25: `spirit/job.js`'s part, the vendored libraries section of `./job.js`. The two libraries sit in `spirit/job/`, job.js's own folder, and job.js is the user that brings them.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. The watcher runs in a child process on a scratch folder inside spirit/run, removed afterwards. No node and no port are used. The tree before the move is commit 2fb29140, which holds spirit/run/node_modules/.

### Requirements

- **Both folders move whole.** All 12 files of chokidar and readdirp are in git under spirit/job/chokidar/ and spirit/job/readdirp/. Each file is byte for byte as it was, except chokidar's index.js. Each folder keeps its package.json and licence. spirit/run/node_modules/ is gone from the disk and from git.
- **chokidar finds readdirp by path.** index.js:6 imports from "../readdirp/index.js". No other line of index.js changes, and nothing in it names readdirp by name.
- **job.js requires it by path**, a path that resolves to spirit/job/chokidar/index.js. No script does require("chokidar") by name.
- **The file watcher works as before:** the node's fs-watcher job hears a file made in its folder as a createFile.
- **The core flag is kept on the file list** (goal/G47.1; Andy: *"stick that flag on the fucking file list, then you have to
  check each file once with isCore()"*): the fs-watcher job on the run folder, its tree asked twice, reads no app's
  <name>.json from disc; spirit/spirit.js comes with core, the `<name>.js` of an app whose json says intrinsic false
  (the first found in the checkout, none named) without, that json itself with. The flag follows an app's json: on a lab node reset to the files under test (goal/G47.3), a planted app
  zzKept whose json says intrinsic false has zzKept.js without core; the json changed to intrinsic true, zzKept.js comes
  with core; changed back, without again.
- **No file names spirit/run/node_modules.** That covers the .gitignore exception and the two installers.

deskClient's use of the library is the chokidar part of `spirit/app/deskClient/server/test/server.md`; fileSystem.js's one list of vendored folders is the vendoredFolders part of `./fileSystem.md`.

## The mount part: the node starts a server from spirit/app/<name>/ (once in ./appServer.js, goal/G47.1)

The node starts a server from `spirit/app/<name>/` (goal/G43.12). Its test, once `./appServer-mount.js`, is a section of `./appServer.js`. A real node runs on a lab node reset to the files under test (goal/G47.3), with throwaway apps planted in that copy (`probe`, `quiet` with `node.mount` false and no `data.js`, so no one-shot app either (goal/G43.19, box v16, 2), `always` intrinsic). The tree's own server app (`agent`) is not what it judges. Nothing is kept in the repo.

Andy: *"JUST loading functional server and associating the <name> as "familiy" name, in the new namespace"*.

### Requirements

#### Starting and stopping

- It starts only if `<name>.json` says `node.mount` true and `spirit/state/<name>/node.json` says `active` true. Neither alone starts it.
- `active` starts and stops it while the node runs, through `app.active`, with no restart of the node.
- `active` is the one switch. `node.json` holds no `running`. A killed server comes back and `active` stays true.
- `active` true starts it at every boot, after a clean stop and after a power cut that left its door behind. `active` false does not.
- Turning `active` off keeps the row in the list, with `active` false. A stopped server stays stopped.

#### What it is in the node

- `<name>` is its family in the flat table, and its verb answers through the node.
- its family is at its top, `api.js` beside `<name>.js`, as `spirit/<family>/` has it (goal/G43.27). The interface reads the app folder, and so does `fs.load` of a path in it; the branch carries no FS set (goal/G43.20). A `family/` folder beside it is ignored.
- `<name>.json` has no `kind` or `operated`. The node operates the server.
- Its module id is `spirit.app.<name>`.
- Its door is a socket in `spirit/state/<name>/`, on POSIX. None is in its `data/`.
- The node hands it `spirit/state/<name>/data` as `--state`.

#### Pages and processes

- A page binds the family by its name, and its verb answers.
- `data.js` beside `<name>.js` is loaded and run by its api.js, the one script that requires it (goal/G47.1), on a page
  (binding the family) and in a process (requiring the api.js; a tree app's too, the first with an api.js found, none named), and found for a client's cache: what a client kept of a sender in the new family comes back at its start, as it does for a node family (contact).
- The one `<name>.js` also runs on a page.

#### The start rule (goal/G43.20: "jobs.create starts only an app's own script, spirit/app/<name>/<name>.js, of an app whose <name>.json says node run true")

- A script of an app is refused and does not run, its server script included when its json says node mount and not node run.
- A helper of an active app is refused too: *"A second script in an app folder is therefore never started."*
- Refused and not run: a script of the shell, a file at the top of `spirit/app`, the same path in another tree, and a way out of an app's folder by dots.

#### What stays

- A script outside `spirit/app/` is refused `not-a-process`.
- A member without a grant is refused and no server is asked. A member granted `<name>.ping` reaches it.

#### Intrinsic (goal/G43.14)

- A server app whose `<name>.json` says `identity.intrinsic` true runs from the boot with nothing pressed, and nothing is written to its `node.json`.
- `app.active` with false does not stop it.

### Not judged here

- What the box puts out of this item: bundles, the process-less face-app, the app key, faces and puppets, and a name in both places.
