# spirit/jobs.js

The node's jobs. This test holds goal/G41.30, the review's RH1: *"jobs.create still spawns any program"*; its fix: *"in
startJob, refuse unless command is process.execPath and args[0] resolves to an included
process/js/<name>/<name>.js."* Raw calls to a scratch node's door. Each thing asked to run would write a marker of its
own, so whether it ran is read from the disk.

## Requirements

- **Another program is refused, and never runs**, a 4xx with a `code`: `/bin/sh` with a command line, `sh` from the path,
  this node's own executable given `-e` code.
- **This node's executable on a script that is not its process is refused, and never runs**: a script outside process/js
  and `spirit/app/<name>/`, a path climbing out of process/js, a process this node does not include. The module also
  refuses a script of an app that is not active (goal/G43.12, Andy: *"it widens until all processes are migrated, then it
  tightens back to the new side..."*); this test does not ask it: the new side's start and stop are specified in
  `./appServerMount.md`.
- **What this node may start still starts**: an included `process/js/<name>/<name>.js` (one that is no intrinsic is
  included by its sidecar, `relay-state/process/<name>/<name>.js.sidecar.json` saying `face.home` true), and a helper in an
  included process's folder, as `desk.js:2608` starts `goalShare.js` by this node's executable and its whole path.
- **Plain `node` with an included process starts**: the word `node` is read as this node's own executable
  (`spirit/jobs.js:512`); a page sends it so (the app detail's run, `spirit/app/appSelector/detailElement.js:68`).

## What its test must try to break

- A shell, or code on the node's own executable, run through jobs.create.
- A fix so narrow that the desk's own helper no longer starts.

## goal/G41.33: a process's console goes to null

The box: *"Console output goes to null by default, at the source, for every process, except node and relay. Only DEBUG turns
it on. A crash is no exception: the exit code is enough to tell us to fix it, and we debug it by hand."*

- **DEBUG off: nothing a process writes to stdout or stderr is in its job's log**, by console or written raw, a crash's
  included.
- **What is structured stays**: the node's own lines, and a line the process published.
- **A crash still says its exit code on the job.**
- **A process that floods its console does not hang**: it ends by its own exit code.
- **DEBUG on: the lines are in the log.**
