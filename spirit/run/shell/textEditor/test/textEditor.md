# shell/textEditor/textEditor.js

The TextEditor app (goal/G29.8, goal/G29.12; face-able since goal/G41.7): edit any writable text file in the browser.
A file is picked with the files list's dropdown, shown and edited on the codeMirror shell element in edit mode, loaded
with Load and written with Save. It writes the same files on a face as in the old home shell (Andy, Q1: "same.").

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api, params), loadFile(path) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `shell/js/files/listElement.js` and
  `shell/js/codeMirror.js`, and takes them from `window.spirit.elements`. Never the old shell's `api.ui.elements`, never
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
  files as the old shell's. The status says `saving…`, then only what the node answered: `saved`, or
  `save failed: <reason>` (rule/19). An app's own script (`shell/<name>/<name>.js`) is refused before anything is asked.

## What its test must try to break

- `api.ui.elements` or `createTextView` reached; a part it uses not loaded by itself; `index.html` named.
- A view made read-only, or handed the wrong text, words, line or path.
- Save writing anything but what was typed, to anything but the current path; a refusal reported as saved; an app's
  own script asked for.
- A contents hit that loses its words or line; a folder row that loads.
