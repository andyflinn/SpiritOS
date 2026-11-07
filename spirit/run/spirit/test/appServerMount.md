# appServerMount

The node starts a server from `spirit/app/<name>/` (goal/G43.12). Its test is `./appServerMount.js`. A real node runs on a scratch copy of the tracked files, with throwaway apps planted in that copy (`probe`, `quiet` with `node.mount` false, `always` intrinsic). The tree's own server app (`agent`) is not what it judges. Nothing is kept in the repo.

Andy: *"JUST loading functional server and associating the <name> as "familiy" name, in the new namespace"*.

## Requirements

### Starting and stopping

- It starts only if `<name>.json` says `node.mount` true and `spirit/state/<name>/node.json` says `active` true. Neither alone starts it.
- `active` starts and stops it while the node runs, through `app.active`, with no restart of the node.
- `active` is the one switch. `node.json` holds no `running`. A killed server comes back and `active` stays true.
- `active` true starts it at every boot, after a clean stop and after a power cut that left its door behind. `active` false does not.
- Turning `active` off keeps the row in the list, with `active` false. A stopped server stays stopped.

### What it is in the node

- `<name>` is its family in the flat table, and its verb answers through the node.
- `./api/` holds what `family/` holds in the old system. The interface, `FS.loadFile` and `FS.path` all read `./api/`. A `family/` folder beside it is ignored.
- `<name>.json` has no `kind` or `operated`. The node operates the server.
- Its module id is `spirit.app.<name>`.
- Its door is a socket in `spirit/state/<name>/`, on POSIX. None is in `relay-state/process/` or in `data/`.
- The node hands it `spirit/state/<name>/data` as `--state`.

### Pages and processes

- A page binds the family by its name, and its verb answers. An old server's family, bound the same way, is the control.
- `data.js` beside `<name>.js` is found on a page, in a process, and for a client's cache: what a client kept of a sender in the new family comes back at its start.
- The one `<name>.js` also runs on a page.

### The start rule

- A script of an inactive app is refused and does not run, its server script included.
- A helper of an active app runs.
- Refused and not run: a script of the shell, a file at the top of `spirit/app`, the same path in another tree, and a way out of an app's folder by dots.

### What stays

- `process/js` servers run under their old module ids, doors and state folders. Their interface stays in `family/`, and a sidecar still stops them.
- A process without its home switch is refused `process-not-included`. A script outside the two places is refused `not-a-process`.
- A member without a grant is refused and no server is asked. A member granted `<name>.ping` reaches it.

### Intrinsic (goal/G43.14)

- A server app whose `<name>.json` says `identity.intrinsic` true runs from the boot with nothing pressed, and nothing is written to its `node.json`.
- `app.active` with false does not stop it.

## Not judged here

- What the box puts out of this item: bundles, the process-less face-app, the app key, faces and puppets, and a name in both places.
