# files/rowElement.js

`spirit/run/shell/js/files/rowElement.js` is one file or folder as a row element (goal/G30.18), and since goal/G41.16
what the fs-watcher's stream means for `data.files`, the page's mirror of the node's tree. Its test is `./rowElement.js`.

Andy, goal/G41.16: *"get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?"*: the
file tree's translation, `shell/js/files/data.js` until G41.16, is this element's (G30.18: rowElements carry the listeners
a subject needs), loaded with it.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/rowElement.js`; no data script.
- It registers `spirit.elements.fileElement.create(row)`.
- **What the stream means for data.files** (fs-watcher jobs, `data.command { op, path, size, modified, core }`):
  - before `treeComplete` the branch fills unready; `treeComplete` makes `data.files` ready;
  - `createDirectory` is a folder at `files/<path>`; any other create or change sets a file with its size, its time and
    its core flag (the node's word, kept), its kind kept when it was known;
  - `deleteFile` takes that file out; `deleteDirectory` the folder and everything under it;
  - another job's command, or a command with no path, writes nothing.
- **A row**: kind `file`, keyed by its path, its facts from `data.files`. Its fields are `name`, `size` and `changed`:
  - the name cell: an icon (📄, 📁 for a folder, ❌ once gone), where it lives and its name, escaped; a core file's name
    in yellow, titled `core: write-protected`;
  - the size through `formatBytes`, none for a folder; the time to the minute.
- **It repaints from data.files**: its path changed there, its cells repaint; its path gone, it is marked gone.
- **Its actions ask and paint nothing**: `open` hands its path to the viewer the page gave (`ctx.open`), or else the text
  launcher; `remove` asks `fs.delete { path }`; `expandInfo` asks `fs.stat` and `fs.annotations`.

## What its test must try to break

- A data script, or a part counted on that it did not load.
- A folder's children left behind its delete; a core flag dropped; another job's command taken.
- A name drawn unescaped; a folder given a size.
- A row that does not repaint, or is not marked gone.
