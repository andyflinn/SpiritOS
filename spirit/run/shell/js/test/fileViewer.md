# shell/js/fileViewer.js

One file, shown (goal/G30.16; goal/G41.7): what the text viewer and the media viewer share, a shell element on both
faces.

## Requirements

- It puts `fileViewer` on `window.spirit.elements`: `create`, `read`, `mimeOf`, `kindOf`, `fStatViewer`,
  `annotationManager`.
- `mimeOf(path)` reads the extension, case ignored, from the spirit object's MIME table; none is
  `application/octet-stream`. `kindOf(mime)` is `image`, `audio`, `video`, `code` (text, javascript, json) or `null`.
- `read(path, onPiece)` answers `{ status, type, bytes }`, asynchronously only: on a face through the sealed link
  (`spirit.transport.file`), at home by the node's own GET, streamed, each piece handed to `onPiece` and the bytes
  joined; a response with no stream is read whole. A leading slash is dropped.
- `fStatViewer(host, path)`: the path in its own tile, a span a directory; the MIME type at once, then size, changed
  and created when `fs.stat` answers; a stat that fails leaves the MIME type alone.
- `annotationManager(host, path)`: nothing when the file has no face part; else "More Information", each key
  prettified, a list folded, a number past 1e11 a date.
- `create(host, { path, launcherId })` answers `{ path, slot(name) }`, the slots stat, owner-app, open-with, body and
  notes. **Space is granted top-down** (rule/16; Andy, on G41.7: the text "must produce a scroll bar, JUST FOR THE
  TEXT AREA"): the frame is a fill column and its body slot a fill box, so a viewer takes what is left and scrolls
  inside it. The owner app and Open with are drawn at home only, by the old shell.

## What its test must try to break

- A frame or body that is not a fill box.
- A read that does not hand on each piece, or does not join them.
- Facts drawn when the stat failed.
- Annotations drawn raw.
