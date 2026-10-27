# shell/boot.js

The face's boot (goal/G41.3): face/shell.js moved into shell/ as shell/boot.js, and the rest of face/ with it, under the
same names. spirit.js loads it on a face page. It boots only itself and the home and Join components it needs; every face
app loads its own components, as a tree, through spirit.require.

## Where it lives, and what moved with it

- `shell/boot.js` is there; `face/shell.js` is gone, and so is every other file of face/: `shell/seal.js`,
  `shell/face.css`, `shell/favicon.svg`, `shell/login/login.js` and `shell/login/login.json` are there instead.
- spirit.js loads `shell/boot.js` on a face page (its FACE list).
- face.html, which stays at the run root, links `/shell/face.css` and `/shell/favicon.svg`.
- boot names its parts by their new paths: the seal as `shell/seal.js`, the login app under `shell/login/`; no old
  `face/` path is left in its code. (The relay's routes `/face/allowed`, `/face/call`, `/face/file`, `/face/stream` and
  `/face/api` are routes, not files, and stay.)

## What it loads

- Only what it runs itself (Andy: "shell boot.js will ONLY boot itself and the neccessary home and join components as
  the stand. that's the only pre-load allowed."): the paths of components in its code are spirit.js's own libraries, the
  shell's sheet, the seal, the login app, the Join app and the navigation it draws apps in. No other shell/js element,
  and no other app's file. (This reads "the home and join components" as the login app, the navigation, and Join with
  its steps.)
- Login and Join are its two mandatory components, hard-coded by path; boot disregards their sidecars.
- Both are core whole, as are boot, the seal, the sheet and the icon, so no page can change them. (A sidecar is a node's
  own state since goal/G41.1, box v16-v17, beside no code.)

## An app shows only while its server runs (goal/G27.16; goal/G41.1, box v14)

- boot reads the `server` a face app's manifest names, beside its face mark.
- An intrinsic app shows on every face (box v17, "minimal == intrinsic"), its face mark or not: with no face part of the
  node's, it takes its name and icon from its manifest (the icon a key into the icon table). Join and the login app stay
  boot's own: never app icons.
- The app's icon is on the desktop while its face mark is on and, if it names a server, while a server job of that
  module (`process/js/<server>`) is running or pending on the stream.
- When the server stops, or the face mark goes, the icon goes and every page of the app that is open is closed.
- A face part streamed (an `app-face` job, box v15) has boot read that shell app again, so it comes or goes at once.

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
- An app whose server stopped left on the desktop, or its page left open.
- An old face/ path left in boot, spirit.js or face.html.
