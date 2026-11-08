# spirit/test/faceHome-starApps.js

goal/G41.33, Q9. Andy, of *"Should a star show every app on the face, Text Editor and Media Viewer too, or does each app's
face mark stay yours to set?"*: *"yes. for now."* A real Chrome reads the desktop, at home and on a real face. What a face is
handed, by its relay's star, is `spirit/faceHome.js`'s, so it is judged beside it (goal/G43.28; moved from
`shell/test/navigationWrapper-faceStarApps.js`; its relay row section is
`spirit/element/search/contact/test/rowElement-relayOnFace.js`).

## Requirements

- **No star: each app's face mark decides, as today**: Text Editor and Media Viewer are not on the face's desktop.
- **The star: every app the home desktop shows is on the face's**, the home's own first tile aside, named apart on each.
- **The star pressed at home with the face open: its desktop follows at once, with no reload** (goal/G41.32; Andy: *"every row's data, wherever it's visible OR invisible must update instantly, and when visible, paint immediately."*).
- **Join and the login stay the boot's own**, never app icons (the login is `spirit.login`, in spirit.js, no app:
  goal/G43.18).
- **An app it shows opens**: pressing Text Editor's tile throws nothing in the page.
- **The star off: back to the face marks**, on the next drawing of the desktop.

## What its test must try to break

- A star that shows the two apps named and misses another.
- A face with no star that shows them too.
- A tile that is drawn and dies when pressed.
