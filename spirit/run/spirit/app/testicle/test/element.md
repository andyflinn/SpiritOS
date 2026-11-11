# spirit/app/testicle/element.js, testicle's first-cut face

testicle is the test app (goal/G45): a robot that keeps the product tree's test status. This item, goal/G45.1, builds only
its first-cut face; its server, its watch and its database come later, and no table is made or filled here. Its test is
`./element.js`: a real node on a scratch copy of the tracked files, with planted files of every kind the face must tell
apart, and the face mounted in a real Chrome on `/face.html`.

The box: *"a first-cut face of testicle: a workBench with one 📁 icon, its file viewer showing production *.js files
only"*, *"testicle's face calls no verbs in this round: it shows a file pane in the leftmost workBench pane, and nothing
else"*, *"A face-only app is its manifest and its element.js, as contact and starter are"*, *"The file viewer is the
existing file list with a filter for production *.js files: no new list."*

`spirit.element.spirit.app.testicle.element.create(container, options)` -> `{ destroy() }`.

## Requirements

**A face-only app.**
- `spirit/app/testicle/testicle.json` is there and is JSON: an icon and a label; intrinsic (the goal box: *"an intrinsic
  app with a server and a face"*); a face, `shell.mount` true; no server yet, `node.mount` false, no `api.js`, no `data.js`.
- Its folder holds `testicle.json` and `element.js`, and its `test/` folder, nothing else; its `mount` names `element.js`.
- `spirit/app/test/` stays the app branch's test folder: no `test.json` there.

**No verbs, no list of its own.**
- `element.js` draws with the workBench element (`spirit/element/workBench.js`) and the existing file list
  (`spirit/element/search/file.js`), and makes no list of its own.
- It asks the node nothing itself: no verb through `spirit.ready`, no `peerPost`, no `fetch`.

**On the page.**
- It loads through `spirit.require` and stands at `spirit.element.spirit.app.testicle.element`; `create(container)`
  answers `{ destroy }`.
- A workBench whose left strip holds exactly one icon, 📁, and whose right strip holds none.
- Its leftmost pane shows the file list, and nothing else is shown: the centre is empty.
- The list shows production `*.js` files only: a `.js` outside any `test/` folder shows; a `.md`, a `.json`, and a test in
  a `test/` folder never show.
- `destroy()` leaves its container empty.

## What its test must try to break

- A manifest that gives it a server, or an `api.js` or `data.js` this round.
- A second icon on the strip, or a right strip.
- A list of its own beside the file list, or a verb the face asks itself.
- A file shown that is no production script: another type, or a test.
- Anything left in its container after destroy.

Vendored libraries' scripts are no production scripts either; the fs family's mirror never holds them
(`spirit/fileSystem.js`, `VENDORED_FOLDERS`), so the list cannot show them and the test does not ask.
