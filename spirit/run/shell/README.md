# `shell/` — apps of the loopback shell, and what they share

Each folder `shell/<name>/` is one app: `<name>.js` is its code and
`<name>.json` its manifest (`runs`, `name`, `description`, `icon`,
`hidden`, `type`, `server`, `owner`). The loopback page
(`spirit/run/spirit/shell/index.html`) loads the old shell,
`spirit/run/spirit/client/shell.js`, which reads these manifests, lists the
apps that run at home and mounts one by its script path
(`shell/<name>/<name>.js`). An app's own files are kept in its own folder
through `spirit.core.fs.createScopedFs('<name>')` (`kernel.js`).

| folder | what it is |
|---|---|
| `chatter/` | the face of this node's chatClerver (`spirit/run/process/js/chatClerver/`) |
| `desk/`, `deskDetails/` | Andy's desk and one row of it, over the desk server (`spirit/run/spirit/app/desk/`) |
| `falloutHistory/` | the flips of one tested thing (its manifest runs nowhere) |
| `grants/` | who may call which api |
| `info/` | the name and the sentence this node says about itself |
| `introSpector/` | call what a party lets you call |
| `jobs/`, `jobsDetails/` | the Job Monitor and one job |
| `join/` | the steps a new node takes; the face's boot (`spirit/run/spirit/shell/boot.js`) loads `join.js` at home itself |
| `relayMonitor/` | the relays this node owns |
| `rotateKey/` | replacing this node's key |
| `ruleDetails/` | one rule of the desk |
| `shared/` | modules apps share: `ask.js`, and `shared/js/` the desk's elements (`deskChat`, `deskElement`, `deskRunStatus`) |

`navigationWrapper.js` is the shell's one stack of pages
(`spirit.elements.navigation`); the face's boot loads it from home with
its other parts.

## What is core

`spirit/run/spirit/coreFiles.js` decides it. Here: `navigationWrapper.js`,
all of `join/`, and the code files of the folders on its coded `INTRINSIC`
list (`grants`, `info`, `introSpector`, `jobs`, `jobsDetails`, `join`,
`relayMonitor`, `rotateKey`). A manifest is never core. `shared/` holds
no core file (Andy: *"no "core" files should reside in shell/shared/ since
that folder was meant to be a place where non-intrinsic apps could share
modules"*).

The shell's frame and its style sheets (`index.html`, `face.html`,
`boot.js`, `tokens.css`, `elements.css`, `shell.css`) are not here: they
are in `spirit/run/spirit/shell/`.
