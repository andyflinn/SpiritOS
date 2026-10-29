# shell/js/apiVerbSelector.js

The verb dropdown (goal/G41.5; Andy: "the Dropdowns for family and verb MUST be new or updated shell elements for those
data types. including test folders."): one shell element, the verbs of one family of an api tree. Since goal/G41.14
it is the verb half of the family selector, `apiFamilySelector.js`.

## Requirements

- A shell element of its own: it adds `createApiVerbSelector(options)` to `window.spirit.elements`.
- **Built on probabilitySearch**, as a dropdown (`face: 'dropdown'`); nothing of `shellCreateListSearch` (goal/G40.8).
- **It loads probabilitySearch itself**, through `spirit.require` (goal/G41.3; rule/26): its test runs on a bare page.
- Its root carries `value`, the chosen verb. Its first option, at the top, reads `All Verbs`: a valid choice whose value is the
  empty string, every verb (Andy, goal/G41.14: *"the apiVerbSelector element MUST offer a (valid) \"All Verbs\" option at the
  top, which results in an empty string as \"value\""*).
- `root.show(tree, server)` lists that family's verbs, `apiTreeIndex.verbs(tree, server)`, so DEBUG and DEPENDENCIES are
  never offered, and shows the root; with no server it hides, lists nothing, and clears the choice.
- A pick sets `value` and fires a bubbling `change`.

## What its test must try to break

- The file missing, or an old shell list made.
- DEBUG or DEPENDENCIES offered.
- The dropdown shown, or a verb kept, with no server.
- A pick that does not fire change, All Verbs among them.
- An All Verbs option that reads otherwise, or gives a value that is not empty.
