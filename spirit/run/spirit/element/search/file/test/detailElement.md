# spirit/element/search/file/detailElement.js, one file, its detail

goal/G43.32, the box: *"every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js,
rowElement.js and detailElement.js"*. The file search's detail is the file's info, drawn by fstat
(`spirit/element/fstat.js`; Andy: *"fstat is a file-info viewer"*). The Files app opens it for a file neither of its
openers takes (Andy: *"let fstat pop up for unknows file types (❔) only"*).

Its test is `./detailElement.js`: a real Chrome on a scratch node's face page, the detail mounted by itself on
`spirit/spirit.js`.

## Requirements

- `create(host, { path })` answers `{ destroy() }`, placed at `spirit.element.spirit.element.search.file.detailElement`.
- It loads fstat itself and draws the file with it: its MIME type, then its size.
- `destroy()` leaves its host empty.

## What its test must try to break

- A detail that loads, but shows nothing of the file.
- A detail that draws without fstat.
- A destroy that leaves something behind.
