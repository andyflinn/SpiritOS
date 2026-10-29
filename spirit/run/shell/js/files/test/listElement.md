# files/listElement.js

`spirit/run/shell/js/files/listElement.js` is the files list (goal/G30.20): the node's files on the standard list tool,
each row a `fileElement`, the list a view of `data.files`. The Files app draws it as a pane, an app picking a file as a
dropdown. Its test is `./listElement.js`.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/files/rowElement.js`, `shell/js/probabilitySearch.js` and
  `shell/js/fileViewer.js`, and no data script (goal/G41.16): the file tree's stream is its row element's.
- It registers `spirit.elements.fileList.create(host, opts)`, drawing one probabilitySearch into a `fill` box of its host.
- It is a view of `data.files`, in path order (`sort('name', 'asc')`), filled as it is drawn. Its columns are `name`,
  `size` and `changed`; each row a `fileElement` of its path; a picked file is shown by its path, and reaches
  `opts.pick`.
- Names are answered from the mirror: a search of names asks the node nothing. By contents it asks
  `fs.search { q, contents: 'yes' }`; each find carries its facts from `data.files` and its matched line, a folder
  without its trailing slash; by contents a file ranks by the node's score, by names the list ranks.
- **The tree**: a filter drawn as no button. With no words a folder shows, and what is inside a folded one does not; a
  folder's press opens it and is never a pick, a file's press is no fold. `opts.accept` hides files of other types,
  never a folder.

## What its test must try to break

- A data script, or a part counted on that it did not load.
- A name search that asks the node; a contents search that loses its line or its score.
- A folded folder's files shown; a folder picked; a file of another type shown.
