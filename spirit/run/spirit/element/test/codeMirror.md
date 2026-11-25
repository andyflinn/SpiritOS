# spirit/element/codeMirror.js

The CodeMirror shell element (goal/G41.7; Andy, Q1: "make codeMirror a shell element by the same name. and make sure
that it supports both read and edit-mode, and that the text viewer uses that new element as well."). One CodeMirror 5
on a file's text, in one of two modes. The text element (`spirit/app/text/element.js`) edits with it; deskDetails,
introSpector, jobDetail and the agent tables' rows draw with it. The text viewer (`spirit/element/textViewer.js`) and the
TextEditor app are gone. It replaces `spirit/element/textView.js`, which is gone.

## API

`window.spirit.required.codeMirror.create(host, { mode, text, words, line, path })` → a Promise of the view
`{ mode, value(), mark(words), cm }`.

- `mode` `'read'` (the text shown, not editable) or `'edit'` (the text editable). Anything but `'edit'` is read.
- `text` what it shows; none is the empty string.
- `words` the search words: every match marked, the first put in view.
- `line` a 1-based line put in view instead of the first match.
- `path` the file's path; its extension picks the syntax colours.
- `value()` the text as it stands now, edits included: what the text element saves.
- `mark(words)` marks again, clearing the old marks; answers how many it marked.

## Requirements

- **It loads none of CodeMirror itself** (goal/G49.15, box v16: *"the page list goes. the vendored codeMirror will be loaded
  by face.html with a script tag"*, which ends G43.5's *"only access to codeMirror library is through the element!"*):
  face.html puts the library, its four add-ons, its five modes and its three sheets on the page by tags of its own,
  before the element runs. The element requires, reads and puts on the page no file of `spirit/element/codeMirror/`,
  and its code names none. **It never reads `index.html`** (goal/G40.7: the face never reads
  the old shell's page) and nothing of it asks for it.
- **Read mode** makes CodeMirror read-only; **edit mode** editable, and `value()` answers what was typed.
- **The syntax by extension**: `.js`/`.mjs` javascript, `.json` javascript with `json: true`, `.css` css, `.html`/`.htm`
  htmlmixed, `.xml`/`.svg` xml, `.md` markdown; any other none. Line numbers and line wrapping on, the theme
  `material-darker`.
- **Marks**: every match of the words by the list's one marking rule (`window.spirit.matchRanges`) is marked with the
  class `text-view-match`; the first match gets the cursor and is scrolled into view. A `line` wins over the first match.
- **Drawn once the page shows it**: CodeMirror is refreshed after the turn in which it was made, since a box still
  hidden measures nothing.

## What its test must try to break

- A read view that can be edited, or an edit view whose `value()` does not follow the typing.
- The library found by reading `index.html`, or not loaded by the element at all.
- A `.json` file coloured as plain javascript, an unknown extension given a mode.
- A line asked for that loses to the first match; marks left behind by a second `mark`.

## The CodeMirror library in spirit/element/codeMirror/

goal/G43.5: `spirit/element/codeMirror.js`'s part of the element move. Its test is the library part of `./codeMirror.js` (once `./codeMirror-library.js`). `spirit/element/codeMirror/` is the element's own folder: the library it brings.

### Requirements

- *"ALL move the fucking library inside run::/spirit/element/codeMirror/"*. CodeMirror's 15 files, licence included, stand there (that no file names its old place is `spirit/test/script-sibling-general.js`'s). On a real page the element draws from there with its sheet and search, and asks no other place.
- Since goal/G49.15 (box v16): the page starts with `window.CodeMirror` on it, from face.html's tags, and no product file but
  `spirit/shell/face.html` and `spirit/fs/fileSystem.js` (its one list of vendored folders) names the library's folder.

The rest of the element move is the elementMove part of `spirit/test/script.md`.
