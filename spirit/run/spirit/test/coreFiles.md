# spirit/coreFiles.js

Which files are core, grant-locked: the one table the commit check reads. A commit touching a core file needs Andy's
grant on the item. It needs nothing of the desk's.

## Its parts

- `INTRINSIC`: the coded list of app and server folders whose code is core.
- `intrinsic(folder)`: true for an app folder (`shell/<name>`, `process/js/<name>`) on that list, or a path inside one,
  with or without the leading `spirit/run/`.
- `isCore(repoPath, repoRoot)`: true when the repo-relative, `/`-separated path is core.

## Requirements

### What was core before goal/G41.29

- The face's boot: `spirit/shell/face.html`, `spirit/shell/boot.js`, `spirit/shell/seal.js`, `spirit/shell/face.css`, `spirit/shell/favicon.svg`.
- Join, whole: every file under `shell/join/`, its `.json` included. The login app went (goal/G43.18, box v29: the login is spirit.login).
- Never a manifest: `shell/<name>/<name>.json` and `process/js/<name>/<name>.json`, an intrinsic app's included.
- Everything under `spirit/run/spirit/`, `spirit/run/spirit/element/`, `spirit/run/shell/json/` and `spirit/run/test/`.
- CodeMirror in `spirit/run/spirit/element/codeMirror/`, which `spirit/shell/index.html` loads on every boot (goal/G41.30,
  the review's H5; Andy: *"shell/node_modules/codemirror/ MUST BE \"core\""*).
- Never `spirit/run/shell/shared/`, where apps that are not intrinsic share modules (Andy: *"no \"core\" files should
  reside in shell/shared/"*); the progress bar it held lives in `spirit/element/`.
- The frame: `spirit/shell/index.html`, `spirit/spirit.js`, `spirit/shell/elements.css`, `spirit/shell/tokens.css`, and `shell/navigationWrapper.js`
  (goal/G41.30, Andy: *"make the nav wrapper \"core\""*), its companion tests with it.
- An intrinsic app's or server's code only (`.js`, `.css`, `.html`); its data files stay writable.

### A core file's companion test files are core (goal/G41.29)

Andy: "the red for a core file is a core file, too", and "change spirit/coreFiles as well, by making a coreFiles-companion
files in the test-folder core files as well."

- A file in a `test/` folder beside a core file, named after it (`test/<name>.js`, `test/<name>.md`), is core:
  `spirit/shell/test/boot.js` and `spirit/shell/test/boot.md` for `spirit/shell/boot.js`, `shell/apps/test/apps.md` for the intrinsic
  `shell/apps/apps.js`.
- A test named after a file that is not core stays writable: `shell/desk/test/desk.js` for `shell/desk/desk.js`.

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
- `shell/contacts` is off the coded list, and `spirit/app/contact/` is core in this tree.
