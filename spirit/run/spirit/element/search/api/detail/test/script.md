# spirit/element/search/api/detail/script.js, one family's verbs

The api search's detail (goal/G43.32; Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*): what a family is, read from the api tree its list was painted from. The family list opens it under
itself in a pane when a row is pressed. Its test is `./script.js`: the browser file run in node on a bare window,
the real api tree reader (`spirit/fuckingGarbage/apiTreeIndex.js`) beside it.

`spirit.required.spirit.element.search.api.detail.create(host, { family, tree })` -> `{ destroy() }`.

## Requirements

- It places itself at `spirit.required.spirit.element.search.api.detail`, with a create, and loads the api tree
  reader itself.
- It lists each verb the family serves, as its path (`family.verb`), sorted, each with the fields its request takes.
- DEBUG is shown as any verb the family serves, `fs.DEBUG`: `apiTreeIndex.verbs` offers every verb (goal/G49.25; Andy: *"the only thing i'd hard-code protect from is ownership change"*, *"they go now"*).
- A family that did not answer, or a tree it was not handed, shows no verbs.
- It asks nothing and changes nothing: what it shows is the tree it is handed.
- What it paints is escaped.
- `destroy()` takes it out of its host; one destroyed before it drew draws nothing.
- It fills its host and scrolls its own body, so the panel's title bar above it stays (Q21: the panel itself never scrolls); judged by
  `spirit/element/test/search-child-browser.js`.

## What its test must try to break

- A verb the family serves left out (DEBUG).
- A call to the node for a tree it was already handed.
- Unescaped text.
- A detail left in its host after destroy, or drawn after it.
