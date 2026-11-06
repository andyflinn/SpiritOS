# spirit/app/media/media.js

For goal/G43.17, whose box builds it first: *"Four elements: file, fstat, text and media"*, and *"They take a file when mounted, and show their whole selves with it, the file picker too, also when launched from file."* With a file is judged where Files hands it one, `spirit/app/file/test/file.js`. Its test is `./media.js`, a real node on a scratch copy and a real Chrome on `/face.html`.

## Requirements

- `spirit/app/media/media.js` is there, names neither the old shell nor a `shell/` path, and loads `spirit/element/files/listElement.js`.
- `spirit.elements.media.create(container)` answers `{ destroy }`; mounted with no file it shows the file picker, the files list as a dropdown; destroy leaves its container empty.
- The picker sits in a bubble of the kind rowForm uses, `.shell-bubble`; in a pane 120px wide that row folds, nothing past its edge (*"Rows are inline, not boxes: they fold when the width gets smaller"*).
- Its title bar, opened from its tile with no file picked, is the one bar in view and reads the media viewer's own icon, from media.json, then "Media Viewer" (Q15).
- *"They are separate from fstat"*, what it shows with a file: judged where Files hands it one, `spirit/app/file/test/file.js`.
- Nothing throws on the page.
