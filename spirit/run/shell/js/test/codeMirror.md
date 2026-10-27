# shell/js/codeMirror.js

The CodeMirror shell element (goal/G41.7; Andy, Q1: "make codeMirror a shell element by the same name. and make sure
that it supports both read and edit-mode, and that the text viewer uses that new element as well."). One CodeMirror 5
on a file's text, in one of two modes. The text viewer (`shell/js/textViewer.js`) and the TextEditor app
(`shell/textEditor/textEditor.js`) both draw with it. It replaces `shell/js/textView.js`, which goes.

## API

`window.spirit.elements.codeMirror.create(host, { mode, text, words, line, path })` → a Promise of the view
`{ mode, value(), mark(words), cm }`.

- `mode` `'read'` (the text shown, not editable) or `'edit'` (the text editable). Anything but `'edit'` is read.
- `text` what it shows; none is the empty string.
- `words` the search words: every match marked, the first put in view.
- `line` a 1-based line put in view instead of the first match.
- `path` the file's path; its extension picks the syntax colours.
- `value()` the text as it stands now, edits included: what TextEditor saves.
- `mark(words)` marks again, clearing the old marks; answers how many it marked.

## Requirements

- **It loads the CodeMirror library itself**, through `spirit.require`:
  `shell/node_modules/codemirror/lib/codemirror.js`, and the mode file of the path's syntax
  (`shell/node_modules/codemirror/mode/<mode>/<mode>.js`). Its stylesheets, `lib/codemirror.css` and
  `theme/material-darker.css`, are put on the page. **It never reads `index.html`** (goal/G40.7: the face never reads
  the old shell's page) and nothing of it asks for it.
- **Read mode** makes CodeMirror read-only; **edit mode** editable, and `value()` answers what was typed.
- **The syntax by extension**: `.js`/`.mjs` javascript, `.json` javascript with `json: true`, `.css` css, `.html`/`.htm`
  htmlmixed, `.xml`/`.svg` xml, `.md` markdown; any other none. Line numbers and line wrapping on, the theme
  `material-darker`.
- **Marks**: every match of the words by the list's one marking rule (`window.spirit.matchRanges`) is marked with the
  class `text-view-match`; the first match gets the cursor and is scrolled into view. A `line` wins over the first match.
- **Drawn once the page shows it**: CodeMirror is refreshed after the turn in which it was made, since a box still
  hidden measures nothing.
- **It replaces `textView.js`**: `shell/js/textView.js` is gone, and nothing in the tree loads it or calls
  `createTextView` (the old shell's element list, its page, and every app that drew with it draw with this element).

## What its test must try to break

- A read view that can be edited, or an edit view whose `value()` does not follow the typing.
- The library found by reading `index.html`, or not loaded by the element at all.
- A `.json` file coloured as plain javascript, an unknown extension given a mode.
- A line asked for that loses to the first match; marks left behind by a second `mark`.
- `textView.js` or `createTextView` left anywhere in the tree.
