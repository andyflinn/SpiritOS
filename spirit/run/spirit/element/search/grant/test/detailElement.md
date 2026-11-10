# spirit/element/search/grant/detailElement.js, one grant, its detail

goal/G43.32, the box: *"every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js,
rowElement.js and detailElement.js"*. Of whichever grants table its caller hands it, as the grant list and row take it
(goal/G41.16): it names no table. One rowForm: whose grant it is, its path (marked deprecated when no server serves it
today), and its Revoke, an armingButton (Andy, on G41.13: *"a armingButton [Revoke], which must revoke/delete that grant in
the database"*).

Its test is `./detailElement.js`: a real Chrome on a scratch node's face page, the detail mounted by itself on a grant of a
table of the test's own, so nothing of a node is revoked.

## Requirements

- `create(host, { row, grants, serves })` answers `{ destroy() }`, placed at
  `spirit.element.spirit.element.search.grant.detailElement`.
- It says whose grant it is (the row's field the table names as its label) and its path; a path `serves` says no to is
  marked deprecated.
- Revoke is an armingButton: the first press arms it, the second asks the table's `revoke(id, path)` and says what came of
  it below the bubble.
- Who paints, listens (Andy, G41.32): it follows its own row through its table's `watch`, keyed `<id>\n<path>`; a new
  label repaints it, another grant's does not, and its grant gone, revoked anywhere, it says so. `destroy()` lets the watch go.
- With no row or no table it says it is not configured, and throws nothing.
- `destroy()` leaves its host empty.

## What its test must try to break

- A detail that leaves out whose grant it is, or its path.
- A deprecated mark on a served path, or none on an unserved one.
- A Revoke that revokes on the first press, or revokes another grant.
- A detail that misses its row's change, takes another grant's, or keeps its watch after destroy.
- A throw when unconfigured, or a destroy that leaves something behind.
