# branchEditor.js

`spirit/run/spirit/element/branchEditor.js` edits one bundle's branches (goal/G41.14), inside the closable tab a row of the bundles pane
opens (goal/G41.32).
Its test is `./branchEditor.js`.

Andy, box: *"the branchEditor page is always configured with a bundle key"*, *"first row: Title: \"Edit
<bundle-label-content>\""*, *"second row, add form: \"new\" [apiFamilySelector:dropdown] [apiVerbSelector:dropdown]
[Add-button]"*, and *"branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton
'Delete'"*. The two dropdowns are one element's halves (Andy: *"apiFamiliySelector.js will use apiVerbSelector as part
of itself"*). Since goal/G41.32 it is no page: it is drawn into a closable tab, and closing the tab is the way back.

DISCREPANCY WITH ANDY's RULES: goal/G41.14's box (v31) asks for *"first row: Title: \"Edit <bundle-label-content>\""*;
the code draws no title row (the tab's label, its mounter's, names the bundle), and no later box found revokes it.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/search/api.js`, `spirit/element/search/branch.js`,
  `spirit/element/rowForm.js` and `spirit/element/armingButton.js`, and the auth family's cache manager
  (`spirit.cacheManager('auth')`).
- **Its Delete row** (goal/G41.32): a rowForm below the list, ❌, *"Delete <bundle-name> bundle and branches"*, an armingButton whose
  second press asks `auth.bundle { op: 'delete', id }`; a refusal is said below it, in the node's words. Hearing that bundle's row gone in `spirit.data.auth.data.bundles`, from any screen,
  it calls `options.gone`. A bundle whose `options.owner` is not `node` is shown only: no form, no Delete column.
- It registers `branchEditor.create(container, options)`, and no page of its own, which draws the same editor into the container
  and answers a handle with `destroy` (the shell's element shape, goal/G41.19).
- Mounted, the page draws, each part made with its container (`<name>.create(container, options)`):
  - the add form, a rowForm (goal/G41.27; Andy: *"branchEditor:\n\n[➕] [choose a family… ▾] [Add]"*, then
    *"careful, there's a hidden verb selector there that only displays when a family is selected... !\n[➕] [choose a
    family… ▾] [All Verbs ▾] [Add]"*): it loads `spirit/element/rowForm.js` itself and makes one rowForm with ➕ and Add; its
    span holds the one family selector, `choose a family…`, its verb half with it (hidden until a family is chosen, the
    family selector's own), and nothing else; the rowForm's button is the only Add; the word `new` is gone;
  - the branchSelector, `spirit.element.search.branch.create(its box, …)`, a pane on that bundle, its columns `family`, `verb`, `delete`.
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
