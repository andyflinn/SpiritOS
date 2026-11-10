# spirit/jobs.js

The node's jobs. This test holds goal/G41.30, the review's RH1: *"jobs.create still spawns any program"*, as goal/G43.20
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
  route, `spirit.app.<name>` (the refusal of a second start while one runs is `./jobs-routes.md`'s).
- **Plain `node` with such a script starts**: the word `node` is read as this node's own executable; a page sends it so
  (the app detail's Run, `spirit/element/search/app/detailElement.js:68`).

## What its test must try to break

- A shell, or code on the node's own executable, run through jobs.create.
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

- Icons, on in its `node.json` at boot, is in the api tree with no `app.active` asked, desk beside it.
- Switched off, `icons.<verb>` answers `app-not-served` and the tree holds no icons; on again, it is back with no restart.
- With no node part in `icons.json`, icons is still served.
- The attacker: an app with `api.js` and no `data.js`, one with `data.js` and no `api.js`, and one with both never switched on are not served, and their script never runs (a marker on the disc).
