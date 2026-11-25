# spirit/element/search/file/detail/script.js, one file, its detail

goal/G43.32, the box: *"every branch's search is search/<branch>.js, the selector, and its folder holds list.js,
row.js and detail.js"*. The file search's detail is the file's info, drawn by fstat
(`spirit/element/fstat/script.js`; Andy: *"fstat is a file-info viewer"*). The Files app opens it for a file neither of its
openers takes (Andy: *"let fstat pop up for unknows file types (❔) only"*).

Its test is `./script.js`: a real Chrome on a scratch node's face page, the detail mounted by itself on
`spirit/script.js`.

## Requirements

- `create(host, { path })` answers `{ destroy() }`, placed at `spirit.required.spirit.element.search.file.detail`.
- It loads fstat itself and draws the file with it: its MIME type, then its size.
- `destroy()` leaves its host empty.
- It fills its host and scrolls its own body, so the panel's title bar above it stays (Q21: the panel itself never scrolls); judged by
  `spirit/element/test/search-child-browser.js`.

## What its test must try to break

- A detail that loads, but shows nothing of the file.
- A detail that draws without fstat.
- A destroy that leaves something behind.
