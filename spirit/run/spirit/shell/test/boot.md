# spirit/shell/boot.js

The face's boot (goal/G41.3): face/shell.js moved into shell/ as shell/boot.js, and the rest of face/ with it, under the
same names; since goal/G43.18 they are in spirit/shell/, served at the addresses they always had (spirit/serveCommon.js,
PAGE_FILES). spirit.js loads it on a face page. It boots only itself, the stream, its parts and the shell the node names
(goal/G43.18). The old shell's face apps it once loaded alone went with `shell/` (goal/G43.30).

## Where it lives, and what moved with it

- `spirit/shell/boot.js` is there; `face/shell.js` is gone, and so is every other file of face/: `spirit/shell/seal.js`,
  `spirit/shell/face.css` and `spirit/shell/favicon.svg` are there instead, with face.html, shell.css and
  ghost.svg (index.html went with the old shell, goal/G43.30), and spirit.js is in spirit/; none of them is left at the run root or in shell/.
- `shell/login/` is gone (goal/G43.18, box v29: *"The login is spirit.login, in spirit.js, no app ... shell/login/ and its
  login.json go."*).
- spirit.js loads `shell/boot.js` on a face page (its FACE list): at home from the node; on a face, logged in, over the
  link spirit.js made.
- face.html, served at `/face.html`, links `/shell/favicon.svg` and no sheet (box v29: *"boot.js, shell.css, face.css
  and every other part of the shell come from the home node over that link"*).
- boot names no old `face/` path and no login app. (The relay's routes `/face/allowed`, `/face/call`, `/face/file`,
  `/face/stream` and `/face/api` are routes, not files, and stay.)

## What it loads

- Only what it runs itself: the paths of components in its code are spirit.js's own libraries, the sheets (`shell.css`,
  `shell/face.css` last) and the file tree's row element (goal/G41.19). No other spirit/element element. The navigation
  wrapper is gone (goal/G43.30): nothing opens as a page any more.
- Join is an app (goal/G43.26): boot does not load it.
- boot, the seal, the sheet, the icon and the Join app (`spirit/app/join/`) whole are core.

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

## What its test must try to break

- A desktop, a link or a join step of boot's own.
- An old face/ path left in boot, spirit.js or face.html.
