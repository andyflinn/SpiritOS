# spirit/element/search/file/row/script.js

`spirit/run/spirit/element/search/file/row/script.js` is one file or folder as a row element (goal/G30.18). From goal/G41.16
to goal/G41.28 it was also what the fs-watcher's stream means for the page's mirror of the node's tree. Its test is `./script.js`.

Since goal/G41.28 the tree is the fs family's cache: its translator and its branch are
`spirit/run/spirit/fs/data.js`'s, filed in `spirit.required.spirit.data` under the serving node
(`<node>/fs/files/<path>`), and read through `spirit.required.spirit.data.fs.data`. The element requires the fs family's interface
(`spirit.requireScript('spirit/fs/api.js')`), which brings that data.js (goal/G47.1: *"every api.js requires it's companion
data.js"*); the test brings it as a page does, the page's node known (`spirit.nodeFacts.key`, `data.homeNode`).

Andy, goal/G41.16: *"get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?"*: the
file tree's translation, `spirit/element/search/file/data.js` until G41.16, was this element's (G30.18: rowElements carry the listeners
a subject needs), and is since goal/G41.28 the fs family's data.js's, which the fs api.js it requires brings.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/row/script.js`, `spirit/element/icon/script.js`, `spirit/word/script.js`,
  `spirit/element/fstat/script.js` and the fs family's interface, `spirit/fs/api.js`; no data script, since only an api.js
  requires its data.js.
- It registers `spirit.required.search.file.row.create(row)`.
- **What the stream means for the file tree** (`spirit.required.spirit.data.fs.data`) (fs-watcher jobs, `data.command { op, path, size, modified, core }`):
  - before `treeComplete` the branch fills unready; `treeComplete` makes the tree ready (`spirit.required.spirit.data.fs.data.ready()`);
  - `createDirectory` is a folder at its path (`spirit.required.spirit.data.fs.data.file(path)`); any other create or change sets a file with its size, its time and
    its core flag (the node's word, kept), its kind kept when it was known;
  - `deleteFile` takes that file out; `deleteDirectory` the folder and everything under it;
  - another job's command, or a command with no path, writes nothing.
- **A row**: kind `file`, keyed by its path, its facts from the file tree. Its fields are `name`, `size` and `changed`:
  - the name cell: an icon by its kind (goal/G43.17: text 📜, video 📹, image 🌇, audio 🔊, any other ❔; 📁 for a folder shut, 📂 open, ❌ once gone), where it lives and its name, escaped; a core file's name
    in yellow, titled `core: write-protected`;
  - the size through the spirit object's own `formatBytes` (2048 bytes is `2 KB`), none for a folder; the time to the
    minute.
- **It repaints from the file tree**: its path changed there, its cells repaint; its path gone, it is marked gone.
- **Its actions ask and paint nothing**: `open` hands its path to the viewer the page gave (`ctx.open`), or else the text
  launcher; `remove` asks `fs.delete { path }`; `expandInfo` asks `fs.stat`, and no annotations (goal/G43.20; Andy: *"ANNOTATIONS WILL BE NODE ONLY."*).

## What its test must try to break

- A data script required by the element, or a part counted on that it did not load.
- A folder's children left behind its delete; a core flag dropped; another job's command taken.
- A name drawn unescaped; a folder given a size.
- A row that does not repaint, or is not marked gone.

## goal/G43.4: the reserved words in colour

goal/G43.18, Andy: *"file app: please change the green colored paths/files in light blue instead."*, then *"ALL, ONLY REPLACE RED WITH LIGHT PURPLE, KEEP THE BLUE!!!!!!!!!!!!!!!!"*: G43.4's green is light blue, its red light purple, and no red is left.

`./row-words.html` shows real rows on a scratch node. The families the rows are coloured by, `spirit.app` and
`spirit.contact`, are bound first, each by requiring its `api.js`; a family is bound lazily, so one no file asked for is
not on the spirit object. Each path element is its own element, so its colour is its own:

- `spirit` is light blue. `spirit/app`, `spirit/element` and `spirit/contact` are light blue, as a folder row and in the path of a file inside.
- Light purple, where red was: the file `api.js` in `spirit/app` (no `spirit.app.api`), and `spirit/job` (a folder, no `spirit.processJob`).
- A name not reserved has no colour (`spirit/client`, `spirit/hub.js`), and outside `spirit/` no word holds (`shell/app`).
- A `word.json` gaining a word turns the open row light purple with no reload, an object at that path makes it light blue, and `word.json` gone takes the colour away.
