# spirit/devtool/moveScript/script.js

goal/G49.5. A tool for the agents: one command moves one script and fixes everything that names it, so a move is never
a sweep by hand again.

    node spirit/devtool/moveScript/script.js <old path> <new path>

run in the run root it moves in. Exit code 0 for a move made, any other for a refusal.

## What its test plants and asks

A scratch run root holding `spirit/element/foo.js`, its test `test/foo.js`, its `test/foo.md`, a page fixture of its
test `test/foo-laid.html`, and the files that name it: a relative require, a `spirit.requireScript`, its dotted name
`spirit.required.spirit.element.foo`, a `path.join` of its pieces, a script tag, a doc. One move to
`spirit/element/foo/script.js`, and then:

- the file is at its new place and gone from the old; its own `require('../spirit.js')` is one level deeper
- its test is at `foo/test/script.js`, its `.md` at `foo/test/script.md`, the fixture in `foo/test/`
- every reference names the new path: the moved test's require, the regex-escaped form, the relative require, the
  `spirit.requireScript`, the `path.join`, the script tag, the doc
- every dotted name is left as it was: a folder's `script.js` stands at its folder's name, `spirit.required.spirit.element.foo`
- no file of the tree names the old path

Refused, with nothing moved and nothing changed: a target that already exists, and a move into a folder holding an
`api.js` or a `data.js`, which would make that folder a branch.
