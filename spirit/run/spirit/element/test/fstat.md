# spirit/element/fstat.js

A file's info, the viewer text and media build on (goal/G43.17). Its test is `./fstat.js`: the tree read as it is, then the browser file run in node on a window of its own, the link, the page's fetch, the spirit object's fs and an old shell as stubs. What it draws, top down, is judged in a real Chrome by `spirit/app/file/test/file.js`.

Andy's box: *"It replaces fileViewer, which is renamed and trimmed into it, then deleted, its users naming fstat; mediaViewer goes too (Q7)."*

## Requirements

- `spirit/element/fstat.js` is there; `fileViewer.js` and `mediaViewer.js` are gone. No code names fileViewer or loads the mediaViewer element; its users load `spirit/element/fstat.js`.
- It asks nothing of the old shell (Q9): its code names neither the old shell, the owner app nor Open with, and with an old shell on the page `create` asks it nothing.
- It is `window.spirit.element.fstat`, with `create`, `read`, `mimeOf` and `kindOf`, as fileViewer had them:
  - `mimeOf` reads the extension, case ignored; none is `application/octet-stream`.
  - `kindOf`: image, audio, video, code (text, javascript, json), or null.
  - `read` goes through the sealed link on a face, a leading slash dropped, each piece handed on; at home the node's own GET, streamed.
- `create(host, { path })` asks `fs.stat` and `fs.annotations` for the file.
