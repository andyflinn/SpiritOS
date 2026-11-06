# shell/textEditor/textEditor.js

The TextEditor app (goal/G29.8, goal/G29.12; face-able since goal/G41.7): edit any writable text file in the browser.
A file is picked with the files list's dropdown, shown and edited on the codeMirror shell element in edit mode, loaded
with Load and written with Save. It writes the same files on a face as in the old home shell (Andy, Q1: "same.").

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api, params), loadFile(path) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `spirit/element/search/file.js` and
  `spirit/element/codeMirror.js`, and takes them from `window.spirit.elements`. Never the old shell's `api.ui.elements`, never
  `createTextView` (`textView.js` is gone).
- **Its comments speak of today's shells**: nothing of it names `index.html` or `discoverDynamicApps`.
- **The starting file**: `params.path` when "Open with" handed one, else `shell/textEditor/notes.txt`. Its text is read
  through the spirit object's `fs.loadFile` and shown by `codeMirror.create(box, { mode: 'edit', text, words, line,
  path })`; the path is shown beside the buttons. A file the node does not answer (null) opens empty, the status saying
  it was not found and Save will create it.
- **The picker**: the files list as a dropdown (`fileList.create(host, { face: 'dropdown', accept: [text types] })`). A
  file picked is loaded; one found by its contents (`row.line > 0`) opens marked with the picker's words, at that line.
  A row that is not a file loads nothing.
- **Load** reads the current path again. **`loadFile(path)`** (a second "Open with") loads that path.
- **Save** writes the view's `value()` to the current path through `fs.saveFile(path, content)`, the same writable
  files as the old shell's. The status says `saving…`, then only what the node says (rule/19): `saved` once the node's
  file tree has the save, or `save failed: <reason>`. An app's own script (`shell/<name>/<name>.js`) is refused before
  anything is asked.
- **What it saves, it listens for** (goal/G41.28): it loads the fs family's cache (`spirit.cacheManager('fs')`) and
  watches the open file's row in `spirit.data` under `spirit.data.fs.data.branch`. Any change of the open file that is not
  its own save says `changed on disk` (Andy, Q21); a change of another file says nothing.

- **A load the node refuses is said as a refusal** (goal/G41.30; Andy, of a face with no star: *"not found (or empty) — you can
  still Save to create it"*): the status says the node's own words, never not found, and offers no Save.

## What its test must try to break

- `api.ui.elements` or `createTextView` reached; a part it uses not loaded by itself; `index.html` named.
- A view made read-only, or handed the wrong text, words, line or path.
- Save writing anything but what was typed, to anything but the current path; a refusal reported as saved; saved said
  before the file tree has the save; an app's own script asked for.
- A change of the open file from elsewhere not said as `changed on disk`; a change of another file said.
- A contents hit that loses its words or line; a folder row that loads.
