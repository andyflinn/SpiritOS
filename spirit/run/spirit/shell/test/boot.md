# shell/boot.js

The face's boot (goal/G41.3): face/shell.js moved into shell/ as shell/boot.js, and the rest of face/ with it, under the
same names. spirit.js loads it on a face page. It boots only itself, the stream, its parts and the shell the node names
(goal/G43.18); every face app loads its own components, as a tree, through spirit.require.

## Where it lives, and what moved with it

- `shell/boot.js` is there; `face/shell.js` is gone, and so is every other file of face/: `shell/seal.js`,
  `shell/face.css` and `shell/favicon.svg` are there instead.
- `shell/login/` is gone (goal/G43.18, box v29: *"The login is spirit.login, in spirit.js, no app ... shell/login/ and its
  login.json go."*).
- spirit.js loads `shell/boot.js` on a face page (its FACE list): at home from the node; on a face, logged in, over the
  link spirit.js made.
- face.html, which stays at the run root, links `/shell/favicon.svg` and no sheet (box v29: *"boot.js, shell.css, face.css
  and every other part of the shell come from the home node over that link"*).
- boot names no old `face/` path and no login app. (The relay's routes `/face/allowed`, `/face/call`, `/face/file`,
  `/face/stream` and `/face/api` are routes, not files, and stay.)

## What it loads

- Only what it runs itself: the paths of components in its code are spirit.js's own libraries, the sheets (`shell.css`,
  `shell/face.css` last), Join, the navigation, and the file tree's row element (goal/G41.19). No other spirit/element element.
- Join is hard-coded by path; boot reads no sidecar of it.
- boot, the seal, the sheet, the icon and the Join app whole are core.

## The shell the node names, and no desktop of its own (goal/G43.18, box v29)

- Andy: *"boot should solve transport issues only, then load whichever shell the node has configured"*. boot asks
  `node.shell({ at })` (home or face) and loads `spirit/app/<name>/<name>.js`, the RULE being that a shell must be able
  to replace itself.
- No desktop of its own (Q23, Andy: *"yes."* to the old shell apps missing from the green shell for now): no drawDesktop,
  readFace, listApps, openApp, loadApp or serverUp.
- No link and no relay login of its own (Q22): `spirit.link` and `spirit.login` are spirit.js's.
- Join decides where it stands itself (Q18, Andy: *"join. not the shells job."*): boot works out no join step.

## No icon table on the face (goal/G41.1, box v19-v20)

- `spirit/client/iconIndex.js` (kernel's ICON table under another name) and `spirit/client/chatLog.js` are gone.
- boot loads neither and names no icon table: a step's icon and a manifest's icon are drawn as the glyph they are.
- Every app manifest names its icon as the glyph itself, never a key.

## Every face app loads alone

- Every face app shipped to date (agent, apps, contacts, files, icons, info, mediaViewer: named by the test, since a face
  mark is each node's own state) mounts with nothing on the page but a `spirit.require` that
  serves files from the run tree, de-duped, and an empty set of elements: what it needs it asks for, and what it asks
  for loads what it needs. The loader is spirit.js's: what a component requires while it runs is waited for before its
  own require answers, so an app that awaits its components has their whole tree. Mounting it throws nothing, and nothing it starts fails for a component it did not load.

## What its test must try to break

- A component an app uses without asking for it.
- A desktop, a link or a join step of boot's own.
- An old face/ path left in boot, spirit.js or face.html.
