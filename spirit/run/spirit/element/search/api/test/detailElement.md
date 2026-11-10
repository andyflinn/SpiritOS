# spirit/element/search/api/detailElement.js, one family's verbs

The api search's detail (goal/G43.32; Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*): what a family is, read from the api tree its list was painted from. The family list opens it under
itself in a pane when a row is pressed. Its test is `./detailElement.js`: the browser file run in node on a bare window,
the real api tree reader (`spirit/client/apiTreeIndex.js`) beside it.

`spirit.element.spirit.element.search.api.detailElement.create(host, { family, tree })` -> `{ destroy() }`.

## Requirements

- It places itself at `spirit.element.spirit.element.search.api.detailElement`, with a create, and loads the api tree
  reader itself.
- It lists each verb the family serves, as its path (`family.verb`), sorted, each with the fields its request takes.
- The owner's DEBUG is not shown: `apiTreeIndex.verbs` never offers it (Andy: *"DEBUG/... are owner only and will never
  be offered to peerPost clients."*).
- A family that did not answer, or a tree it was not handed, shows no verbs.
- It asks nothing and changes nothing: what it shows is the tree it is handed.
- What it paints is escaped.
- `destroy()` takes it out of its host; one destroyed before it drew draws nothing.

## What its test must try to break

- A verb shown that the tree reader would not offer (DEBUG).
- A call to the node for a tree it was already handed.
- Unescaped text.
- A detail left in its host after destroy, or drawn after it.
