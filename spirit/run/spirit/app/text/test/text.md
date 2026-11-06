# spirit/app/text/text.js

For goal/G43.17, whose box builds it first: *"Four elements: file, fstat, text and media"*, and *"text and media take a file when mounted: with one they show no file picker, without one they show it (Q1, G43.16)."* With a file is judged where Files hands it one, `spirit/app/file/test/file.js`. Its test is `./text.js`, a real node on a scratch copy and a real Chrome on `/face.html`.

## Requirements

- `spirit/app/text/text.js` is there, names neither the old shell nor a `shell/` path, and loads `spirit/element/fstat.js` and `spirit/element/files/listElement.js`.
- `spirit.elements.text.create(container)` answers `{ destroy }`; mounted with no file it shows the file picker, the files list as a dropdown; destroy leaves its container empty.
- Nothing throws on the page.
