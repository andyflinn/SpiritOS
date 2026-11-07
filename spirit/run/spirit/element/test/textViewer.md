# spirit/element/textViewer.js

DISCREPANCY WITH ANDY's RULES: `spirit/element/textViewer.js` was deleted in Andy's commit faaf2b1b ("kill!",
2026-11-07). This spec and `./textViewer.js` describe a module that is no longer in the tree; the test fails as it
reads it. The old shell's `spirit/shell/index.html` still loads it, and `spirit/test/elementMove.js` still lists it
among the moved files. What follows is what the module did.

A text file, shown (goal/G30.16), on the file viewer's frame: read-only, its search words marked, the first in view,
or at a line. Since goal/G41.7 it draws with the codeMirror shell element (`spirit/element/codeMirror.js`) in read mode;
`textView.js` and its own CodeMirror loader (`ensureCodeMirror`, which read the old shell's `index.html`) are gone.
Editing stays the TextEditor app's. A process script with a manifest also gets its job form.

## API

`window.spirit.element.textViewer.create(host, { path, words, line, launcherId })` → a Promise of the frame
(`fstat.create`'s `{ path, slot(name) }`).

## Requirements

- **It loads what it draws with itself**, through `spirit.require`: `spirit/element/fstat.js` and
  `spirit/element/codeMirror.js`. Never `spirit/element/textView.js`, and it has no CodeMirror loader of its own: nothing of it
  reads `index.html` (goal/G40.7).
- **The frame**: `fstat.create(host, { path })`, no launcher (goal/G43.17, Q9); its `body` slot holds the job part and the text box.
- **The text**: the file read by `fstat.read(path)` is handed to `codeMirror.create(textBox, { mode: 'read', text,
  words, line, path })`. A file that does not answer 200 shows `(could not load file)`; a read that fails says
  `(could not load file: <why>)` in the text box. The Promise answers the frame either way.
- **The job form**, for `process/<lang>/<name>/<script>.js` only: its manifest (`.json` beside it) read; its args as
  fields; Start Job shown only when the node's sidecar face part says home (or intrinsic), else the note says why. Any
  other path reads no manifest.

## What its test must try to break

- textView.js loaded, `createTextView` called, or `index.html` read.
- A view made editable, or handed the wrong words, line or path.
- A missing or failing file that throws instead of saying so.
- A plain file that asks for a manifest.
