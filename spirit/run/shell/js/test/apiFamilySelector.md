# shell/js/apiFamilySelector.js

The family selector (goal/G41.14): a family of an api tree, and a verb of it, side by side. It was `apiBranchSelector.js`,
renamed (Andy: *"apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper name for it."*), its
verb half kept (Andy: *"apiFamiliySelector.js will use apiVerbSelector as part of itself, because the verb selector
NEEDs the family selector to have any meaning at all."*). Its test is `./apiFamilySelector.js`.

## Requirements

- `shell/js/apiFamilySelector.js` is there and `shell/js/apiBranchSelector.js` is not; the rename leaves no copy.
- It registers `apiFamilySelector.create(container, options)`, and `createApiFamilySelector` and
  `createApiBranchSelector` no more. The control is appended to the container and answered (box v23: *"every element
  gets a container and appends itself"*).
- Nothing of `shellCreateListSearch` (goal/G40.8).
- It loads its two halves itself (rule/26): the family dropdown, `shell/js/appServerSelector.js`, and the verb selector,
  `shell/js/apiVerbSelector.js`. Two probabilitySearch dropdowns.
- Its families are the tree's; one that did not answer is left out. `options.all` is what the family half reads
  unchosen.
- Its root carries `family`, `verb` and `value`:
  - nothing chosen: all three `''`, the verb half hidden;
  - a family picked: `family` is it, `verb` `''`, `value` the family; the verb half shows that family's verbs, DEBUG never
    (DEPENDENCIES is gone, goal/G41.24);
  - a verb picked: `verb` is it, `value` is `family.verb`;
  - All Verbs: `verb` `''`, `value` the family again;
  - another family clears the verb and lists its own verbs.
- Every change fires one `change`.
- `root.load(fn)` lists another party's tree, clears the choice and hides the verb half.

## What its test must try to break

- The old file left beside the new one, or the old factory still registered.
- A control not appended to its container.
- A part counted on that it did not load itself.
- The verb half shown before a family is chosen, or a verb kept across families.
- DEBUG offered as a verb.
- A wrong value after a family pick, a verb pick, or All Verbs.
- load leaving the old choice.
