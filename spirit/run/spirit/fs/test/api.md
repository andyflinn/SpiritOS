# spirit/fs/api.js

The fs family's declaration and its kernel names. This test holds one part of it (goal/G41.30).

## Requirements

- **A refusal is not "nothing there"** (Andy, of a face with no star, its editor saying *"not found (or empty) — you can still
  Save to create it"*): `loadFile` refused by the node, such as `not-from-the-face`, rejects with the node's own code and words.
  A file that is not there still answers null; a file that is there answers its text.

## goal/G43.20: annotations are the node's only

Andy: *"ANNOTATIONS WILL BE NODE ONLY."* The branch has no `fs.annotations` and no `fs.annotate`, and no `getAnnotations`
among its kernel names.

## What its test must try to break

- A refusal read as an empty file.
- An annotation verb or name left on the family.
- A file verb climbing out of the run folder (goal/G47.6, box: *"a peer asking a file verb for ../, a full path or a drive
  letter is refused by the spirit object's path rule at the door"*): stat, load, save and delete, each asked for `../x`,
  `a/../../x`, `..\x`, `/etc/passwd`, `\x`, `C:/x`, `c:\x` and a path with a NUL, are refused by spirit.check against the verbs
  declared here; a plain path inside the run folder passes.
