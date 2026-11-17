# words.js, testicle's words in one place

goal/G47.1. Andy: *"why is the formatting of the status messages etc not shared code?????"*, *"can you make sure this is shared code and not diverging separate shit before you bring it to me?"* Its test is `./words.js`: every other script of testicle, outside its test folders, read as text, comments left out.

## Requirements

- `spirit/app/testicle/words.js` is there.
- No other script of testicle builds a result icon (✅, ❌) or a status phrase itself: "<x> of <n> reported", "running <suite> for <script>", "classifying <n> of <m>", the words success and failure.
- The server (`testicle.js`), the status box (`element/statusBox.js`) and the result row (`element/search/testicle/row.js`) each require `words.js`.
