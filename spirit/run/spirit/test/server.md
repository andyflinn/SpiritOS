# spirit/server.js

The node's HTTP server. This file is its own test's spec (`./server.js`); its garbage and its app family are judged in `./server-garbage.js` and `./server-appFamily.js`.

## Requirements (goal/G43.30)

Andy: *"can we delete run://shell/, run://spirit/shell/index.html, and make face.html the default for "/" ???"* The box: *"In spirit/server.js, the home page is face.html."*

- `GET /` answers 200, as `text/html`, with `spirit/shell/face.html` byte for byte, as it stands on the disc.
- Opened in a real Chrome, the page at `/` has the spirit object, `spirit.ready` settles, and it loads face.html's own scripts.

## What its test must try to break

- A `/` that still answers the old shell's page, or a page that only looks like the face.
- A `/` whose spirit object never settles.
