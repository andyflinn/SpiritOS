# branchEditor.js

`spirit/run/shell/js/branchEditor.js` edits one bundle's branches (goal/G41.14). The bundle editor's Edit opens it.
Its test is `./branchEditor.js`.

Andy, box: *"the branchEditor page is always configured with a bundle key"*, *"first row: Title: \"Edit
<bundle-label-content>\""*, *"second row, add form: \"new\" [apiFamilySelector:dropdown] [apiVerbSelector:dropdown]
[Add-button]"*, and *"branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton
'Delete'"*. The two dropdowns are one element's halves (Andy: *"apiFamiliySelector.js will use apiVerbSelector as part
of itself"*). The way back is the shell's (*"the shell provides a back-button from there"*): the navigation's back arrow.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/apiFamilySelector.js` and `shell/js/branchSelector.js`. The
  navigation is the shell's own.
- It registers `spirit.elements.branchEditor.open({ bundle, label })`, which pushes a page on the shell's navigation,
  titled `Edit <label>`, and `branchEditor.create(container, options)`, which draws the same editor into the container
  and answers a handle with `destroy` (the shell's element shape, goal/G41.19).
- Mounted, the page draws, each part made with its container (`<name>.create(container, options)`):
  - the add form, reading `new`: one family selector, `apiFamilySelector.create(the add row, …)`, its verb half with
    it, and an Add button in the same row;
  - `branchSelector.create(the page, …)`, a pane on that bundle, its columns `family`, `verb`, `delete`.
- Add:
  - with no family it asks nothing;
  - otherwise it asks `auth.branch { op: 'add', bundle, family, verb }`, the family selector's `family` and `verb`,
    the verb `''` when left at All Verbs;
  - an answered add makes the list search again;
  - a refused add is said in the page, in the node's words (a duplicate is `already-in-bundle`).

## What its test must try to break

- A page on another bundle, or titled otherwise.
- A part counted on that the editor did not load itself.
- A part made into another container than its own.
- An Add sent with no family, or not followed by the list searching again.
- A refusal kept silent.
