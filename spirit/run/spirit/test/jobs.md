# spirit/jobs.js

The node's jobs. This test holds goal/G41.30, the review's RH1: *"jobs.create still spawns any program"*; its fix: *"in
startJob, refuse unless command is process.execPath and args[0] resolves to an included
process/js/<name>/<name>.js."* Raw calls to a scratch node's door. Each thing asked to run would write a marker of its
own, so whether it ran is read from the disk.

## Requirements

- **Another program is refused, and never runs**, a 4xx with a `code`: `/bin/sh` with a command line, `sh` from the path,
  this node's own executable given `-e` code.
- **This node's executable on a script that is not its process is refused, and never runs**: a script outside process/js,
  a path climbing out of process/js, a process this node does not include.
- **What this node may start still starts**: an included `process/js/<name>/<name>.js`, and a helper in an included
  process's folder, as `desk.js:2589` and `deskClient.js:535` start theirs by this node's executable and its whole path.

## What its test must try to break

- A shell, or code on the node's own executable, run through jobs.create.
- A fix so narrow that the desk's and deskClient's own helpers no longer start.
