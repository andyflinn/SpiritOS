# dataFamilies

The end state of goal/G43.7: every family at `spirit.data.<name>`, through `spirit/data.js`. Its test is `./dataFamilies.js`. Each family is checked on its own, so the count of what is owed falls as each one moves.

Andy, box: *"we rename it spirit/data.js and it IS the the spirit.data object."*

## Requirements

- `spirit/data.js` stands and the old module is gone.
- All 19 families, Andy: *"yes, of course all 19"*: each has a `data.js` where its old file stood, beside its `api.js`, and the old file is gone.
- *"with the SAME pattern"*: each `data.js` calls one and the same helper of `spirit.data` with the family's own name, and rolls no guard, no attach and no write on `spirit` of its own.
- *"instead of spirit.<name>Data"*: no code in the run tree reads a `spirit.<name>Data`, or names the old file or module. Comments are not judged, since a comment may quote Andy.
- On a page, the first level of `spirit` holds no `<name>Data`.
- *"spirit.data.<name>.data"* and *"spirit.data.<name>.cache"* stand for each family, under its own name (Q1), so `spirit.data.chatClerver` and `spirit.data.deskVerify`.
- *"this object has only helper functions and object <name> for every application"*: nothing else is on `spirit.data`, so the shared tree `spirit.data.data` is gone.
- Q5, *"Does spirit.data.<name>.cache hold a level per node, as the tree does today?"*, Andy: *"yes."* The app rows stand at `spirit.data.app.cache[<node>].apps`, and a row of another node stands under that node and not under this page's.
- The reads moved: `spirit.data.app.data` answers `rows` and `watch`, and `spirit.data.fs.data.watch` stands, which `word.js` follows.

## Assumed by this test

The box names no helper, so the test finds it by its call: a function called with the family's name as a string. A row of another node is written through `spirit.data.at(node, family)`, as nine families do today. If the build changes either, the verifier corrects the test.
