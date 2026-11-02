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

- The face's boot: `face.html`, `shell/boot.js`, `shell/seal.js`, `shell/face.css`, `shell/favicon.svg`.
- Login and join, whole: every file under `shell/login/` and `shell/join/`, their `.json` included.
- Never a manifest: `shell/<name>/<name>.json` and `process/js/<name>/<name>.json`, an intrinsic app's included.
- Everything under `spirit/run/spirit/`, `spirit/run/shell/js/`, `spirit/run/shell/json/` and `spirit/run/test/`.
- Everything under `spirit/run/shell/node_modules/` (CodeMirror), which `index.html` loads on every boot (goal/G41.30,
  the review's H5; Andy: *"shell/node_modules/codemirror/ MUST BE \"core\""*).
- Never `spirit/run/shell/shared/`, where apps that are not intrinsic share modules (Andy: *"no \"core\" files should
  reside in shell/shared/"*); the progress bar it held lives in `shell/js/`.
- The frame: `index.html`, `spirit.js`, `shell/elements.css`, `shell/tokens.css`, and `shell/navigationWrapper.js`
  (goal/G41.30, Andy: *"make the nav wrapper \"core\""*), its companion tests with it.
- An intrinsic app's or server's code only (`.js`, `.css`, `.html`); its data files stay writable.

### A core file's companion test files are core (goal/G41.29)

Andy: "the red for a core file is a core file, too", and "change spirit/coreFiles as well, by making a coreFiles-companion
files in the test-folder core files as well."

- A file in a `test/` folder beside a core file, named after it (`test/<name>.js`, `test/<name>.md`), is core:
  `shell/test/boot.js` and `shell/test/boot.md` for `shell/boot.js`, `shell/apps/test/apps.md` for the intrinsic
  `shell/apps/apps.js`.
- A test named after a file that is not core stays writable: `shell/desk/test/desk.js` for `shell/desk/desk.js`.

## What its test must try to break

- A companion of a core file left writable, its `.md` above all.
- A companion of a file that is not core turned core.
- A manifest or an intrinsic app's data file turned core.
