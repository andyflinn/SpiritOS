# dataFamilies

The end state of goal/G43.7: every family at `spirit.data.<name>`, through `spirit/data.js`. Its test is `./data-families.js`. Each family is checked on its own, so the count of what is owed falls as each one moves.

Andy, box: *"we rename it spirit/data.js and it IS the the spirit.data object."*

## Requirements

Each family's own (its `data.js` there, the old file gone, none of it rolled by hand, `data` and `cache` in node and
on a page) is judged on each branch folder by `./spirit-sibling-branchRules.js` since goal/G43.32. Here, what judges
no one branch: one helper for all, no old names in the code, the shape of `spirit.data` and `spirit.app`, the cache by
node, the reads moved.

- `spirit/data.js` stands and the old module is gone.
- All the families, Andy: *"yes, of course all 19"* (18 since fileServer went with run://process, goal/G43.20): each has a `data.js`, a node family at `spirit/<name>/data.js`, a server at `spirit/app/<name>/data.js` (chatClerver's in `spirit/app/chat/`), and the old file is gone.
- *"with the SAME pattern"*: each `data.js` calls one and the same helper of `spirit.data` with the family's own name, and rolls no guard, no attach and no write on `spirit` of its own.
- *"instead of spirit.<name>Data"*: no code in the run tree reads a `spirit.<name>Data`, or names the old file or module. Comments are not judged, since a comment may quote Andy.
- On a page, the first level of `spirit` holds no `<name>Data`.
- *"spirit.data.<name>.data"* and *"spirit.data.<name>.cache"* stand for each family, under its own name (Q1), so `spirit.data.chat` and `spirit.data.deskVerify`. All 18 are judged in node (fileServer went with run://process, goal/G43.20), and on a page all but `agent`, `chat` and `deskClient`, which a scratch node does not offer to a page.
- *"this object has only helper functions and object <name> for every application"*: nothing else is on `spirit.data`, so the shared tree `spirit.data.data` is gone.
- Every helper on `spirit.data` has a capital in its name, Andy: *"all the helperFunctions in objects like spirit.data should potential \"words\" the should have a capital in it"*, and on Q10: *"it belongs to \"Fix 'data'\", THIS item."* A word is a to z, so no family can land on a helper.
- Q5, *"Does spirit.data.<name>.cache hold a level per node, as the tree does today?"*, Andy: *"yes."* The app rows stand at `spirit.data.app.cache[<node>].apps`, and a row of another node stands under that node and not under this page's.
- On `spirit.app`, Andy: *"the helpes must not be words there either, this goes for all spirit.app contained objects."* No function on it, or on an app it holds, is a word. `FS` is left out: it is every family's, and an app cannot land inside it.
- The reads moved: `spirit.data.app.data` answers `rows` and `watch`, and `spirit.data.fs.data.watch` stands, which `word.js` follows.

## Assumed by this test

The box names no helper, so the test finds it by its call: a function called with the family's name as a string. A row of another node is written through `spirit.data.viewAt(node, family)`, and the page node comes from `spirit.data.homeNode()`, the builder's names.
