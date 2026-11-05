# spirit/element/iconSelector.js, what it offers

What the icon selector offers (goal/G43.11). Its test is `./iconSelector.js`.

Andy: *"run://spirit/iconSet.json IS the system set now."* The box: *"So the icon selector reads it too"*.

Asked of a real Chrome on a scratch node's page: the selector made there and opened.

## Requirements

- It reads `spirit/iconSet.json` through `spirit.fs.loadFile`, and nothing else.
- It offers every icon of that file and nothing else.
- A glyph it was told to exclude stays off it.

## What its test must try to break

- A selector left on the old path, offering the old file's icons.
- A selector that adds or drops a row of the file.
