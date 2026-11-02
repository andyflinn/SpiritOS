# spirit/fs/api.js

The fs family's declaration and its kernel names. This test holds one part of it (goal/G41.30).

## Requirements

- **A refusal is not "nothing there"** (Andy, of a face with no star, its editor saying *"not found (or empty) — you can still
  Save to create it"*): `loadFile` refused by the node, such as `not-from-the-face`, rejects with the node's own code and words.
  A file that is not there still answers null; a file that is there answers its text.

## What its test must try to break

- A refusal read as an empty file.
