# spirit/element/search/icon.js, what it offers

What the icon selector offers (goal/G43.11). Its test is `./iconSelector.js`.

Andy: *"run://spirit/iconSet.json IS the system set now."* The box: *"So the icon selector reads it too"*, and *"A page reads the file once"*.

Asked of a real Chrome on a scratch node's page: the selector made there and opened.

## Requirements

- It reads `spirit/iconSet.json` through `spirit.fs.loadFile`, and nothing else.
- It offers every icon of that file and nothing else.
- A glyph it was told to exclude stays off it.
- A selector and two lists made together on a fresh page read the file once, and the selector has all of it.

## What its test must try to break

- A selector left on the old path, offering the old file's icons.
- A selector that adds or drops a row of the file.
- A selector with a read of its own, or two reads started before the first answers.
