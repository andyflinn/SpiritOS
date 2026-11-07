# shell/test/faceStarApps.js

goal/G41.33, Q9. Andy, of *"Should a star show every app on the face, Text Editor and Media Viewer too, or does each app's
face mark stay yours to set?"*: *"yes. for now."* A real Chrome reads the desktop, at home and on a real face.

## Requirements

- **No star: each app's face mark decides, as today**: Text Editor and Media Viewer are not on the face's desktop.
- **The star: every app the home desktop shows is on the face's**, the home's own first tile aside, named apart on each.
- **The star pressed at home with the face open: its desktop follows at once, with no reload** (goal/G41.32; Andy: *"every row's data, wherever it's visible OR invisible must update instantly, and when visible, paint immediately."*).
- **A relay's row in Contacts opens the relay, whichever came first** (goal/G41.32; Andy: *"No folding panels anymore"*): the presence stream reaches a face before the search does, and a row follows its row, so its panel opens with its folds, never the person's page.
- **Join and the login stay the boot's own**, never app icons (the login is `spirit.login`, in spirit.js, no app:
  goal/G43.18).
- **An app it shows opens**: pressing Text Editor's tile throws nothing in the page.
- **The star off: back to the face marks**, on the next drawing of the desktop.

## What its test must try to break

- A star that shows the two apps named and misses another.
- A face with no star that shows them too.
- A tile that is drawn and dies when pressed.
