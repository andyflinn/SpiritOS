# spirit/coreFiles.js

Which files are core, grant-locked: the one table the commit check reads. A commit touching a core file needs Andy's
grant on the item. It needs nothing of the desk's.

## Its parts

- `isCore(repoPath, repoRoot)`: true when the repo-relative, `/`-separated path is core.
- `appIntrinsic(root, name)`: what `spirit/app/<name>/<name>.json` says of `identity.intrinsic`.
- No coded intrinsic list any more (goal/G43.30): it named `shell/` folders, and `shell/` is gone (Andy: *"can we delete
  run://shell/"*). coreFiles.js answers no `INTRINSIC` and no `intrinsic()`.

## Requirements

### What was core before goal/G41.29

- The face's boot: `spirit/shell/face.html`, `spirit/shell/boot.js`, `spirit/shell/seal.js`, `spirit/shell/face.css`, `spirit/shell/favicon.svg`.
- Join, whole: every file under `spirit/app/join/`, its `.json` included. The login app went (goal/G43.18, box v29: the login is spirit.login).
- Never a manifest that is not an app's own `<name>.json` (Desk's element manifests).
- Everything under `spirit/run/spirit/` and `spirit/run/spirit/element/`, the product's tests and their tools in `spirit/run/spirit/test/` among them (goal/G43.32).
- CodeMirror in `spirit/run/spirit/element/codeMirror/`, which the page loads on every boot (goal/G41.30,
  the review's H5; Andy: *"shell/node_modules/codemirror/ MUST BE \"core\""*).
- The frame: `spirit/spirit.js`, `spirit/shell/elements.css`, `spirit/shell/tokens.css`, `spirit/shell/shell.css`, `spirit/shell/ghost.svg`.
  index.html and `shell/navigationWrapper.js` left it with goal/G43.30, both gone.

### A core file's companion test files are core (goal/G41.29)

Andy: "the red for a core file is a core file, too", and "change spirit/coreFiles as well, by making a coreFiles-companion
files in the test-folder core files as well."

- A file in a `test/` folder beside a core file, named after it (`test/<name>.js`, `test/<name>.md`), is core:
  `spirit/shell/test/boot.js` and `spirit/shell/test/boot.md` for `spirit/shell/boot.js`, `spirit/app/grants/test/element.md` for the
  intrinsic Grants app.
- A test named after a file that is not core stays writable: `spirit/app/desk/element/desk/test/desk.js` for `spirit/app/desk/element/desk/desk.js`.

## What its test must try to break

- A companion of a core file left writable, its `.md` above all.
- A companion of a file that is not core turned core.
- A manifest or an intrinsic app's data file turned core.

## Intrinsic for the new apps (goal/G43.14)

Andy: *"i think in spirit/app/<name>/<name>.json (identity:intrinsic:true|false)"*, *"no dependency on git"*.

- `spirit/app/<name>/<name>.json` is always core, whatever it says.
- The code beside it (`.js`, `.css`, `.html`) is core while it says `identity.intrinsic` true.
- With false, nothing else in the folder is core: code, data and tests alike.
- Q2, Andy: *"anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not intrinsic."* A json saying nothing of intrinsic keeps the folder core, and so does a folder with no json, as `appSelector/` and `test/` are.
- The rule reads the json as it is on disc, on a tree handed as the repo root.
- `spirit/app/contact/` is core in this tree, its json saying intrinsic true.

## The dependency part: what a core file loads is core

Once `./coreFiles-dependency.js`, now a section of `./coreFiles.js`. A general rule over every core file of the run (goal/G41.30; Andy: *"it looks like we better make sure that those files
that core files depend on, are core-files, too."*).

### Requirements

- **What a core file loads is core.** A core file is grant-locked (`spirit/coreFiles.js`); a file it loads that is not
  could be rewritten by any page, and the core file would run what was written. For every tracked core `.js` and
  `.html` file outside a test folder, read from its code with comments left out:
  - a page's script and style tags (`src`, `href`), not an outside address;
  - a script's `require` of a file beside it;
  - `spirit.require` of a literal path.
  Each such file that exists must be core, or the test is red naming it and the core files that load it.
- **run://shell/ is gone** (goal/G43.30; Andy: *"can we delete run://shell/"*), shell/shared/ with it: the rule that it held
  no core file (goal/G41.30) has nothing left to hold, and the test finds no tracked file under it.
- It must have judged something: over 50 core files read and over 50 loaded files asked.

### What its test must try to break

- A file a core page or script loads left writable.

## The infoGrants part: Info and Grants intrinsic by their own json

goal/G43.24, requirement 2. Its test, once `./coreFiles-infoGrants.js`, is a section of `./coreFiles.js`: coreFiles.js loaded as it is.

Andy: *"i just moved them, didn't fix the manifest."*, *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

### Requirements

- `shell/info` and `shell/grants` leave coreFiles.js's INTRINSIC list; since goal/G43.30 there is no such list at all.
- `coreFiles.appIntrinsic` reads `info` and `grants` intrinsic from each one's own json.
