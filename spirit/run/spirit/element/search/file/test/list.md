# spirit/element/search/file/list.js

`spirit/run/spirit/element/search/file/list.js` is the files list, drawn by its selector `../file.js` since goal/G43.32 (goal/G30.20): the node's files on the standard list tool,
each row a file row element (`spirit/element/search/file/row.js`), the list a view of the node's file tree, the branch the fs family's data.js keeps (`spirit.required.spirit.data.fs.data.branch`,
`<node>/fs/files` in `spirit.required.spirit.data`, goal/G41.28). The Files app draws it as a pane, an app picking a file as a
dropdown. Its test is `./file.js`.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/search/file/row.js`, `spirit/element/search.js` and
  `spirit/element/fstat.js`, and the fs family's interface (`spirit.require('spirit/fs/api.js')`), and no data script (goal/G41.16; goal/G47.1: only an
  api.js requires its companion data.js): the file tree's stream is the fs data.js's, which that api.js brings.
- It registers `spirit.element.search.file.create(host, opts)`, drawing one probabilitySearch into a `fill` box of its host.
- It is a view of the file tree (`spirit.required.spirit.data.fs.data.branch`), in path order (`sort('name', 'asc')`), filled as it is drawn. Its columns are `name`,
  `size` and `changed`; each row a file row element of its path; a picked file is shown by its path, and reaches
  `opts.pick`.
- Names are answered from the mirror: a search of names asks the node nothing. By contents it asks
  `fs.search { q, contents: true }`; each find carries its facts from the file tree (`spirit.required.spirit.data.fs.data.file`) and its matched line, a folder
  without its trailing slash; by contents a file ranks by the node's score, by names the list ranks.
- **The tree**: a filter drawn as no button. With no words a folder shows, and what is inside a folded one does not; a
  folder's press opens it and is never a pick, a file's press is no fold. `opts.accept` hides files of other types,
  never a folder.
- **Flat** (goal/G47.1, the box: *"The file list has one always hidden option, \"flat\", set only in code by the app
  that draws the list; no button shows or flips it"*): `opts.flat` true, set by the app, draws no button of its own. With
  it on no folder row shows, never the indented tree; with an empty field every accepted file shows, however deep, each
  with its path; typing narrows it. Off, the default, the list is the tree above.

## What its test must try to break

- A data script, or a part counted on that it did not load.
- A name search that asks the node; a contents search that loses its line or its score.
- A folded folder's files shown; a folder picked; a file of another type shown.
- With flat on: a folder row, the tree's indent (the path hidden), a deep file missing while the field is empty, a
  button for flat. With flat off: the tree lost.
