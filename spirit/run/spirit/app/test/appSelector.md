# appSelector.js

`spirit/run/spirit/app/appSelector.js` is the app selector (goal/G43.2), following `spirit/element/bundleSelector.js`: a thin selector over its own list, which it loads itself. Its test is `./appSelector.js`, in a real browser on a scratch node.

    spirit.elements.appSelector.create(container, options) -> root
      root.value   the chosen app's key, '' while none is
      root.row     the chosen app, null while none is
      one bubbling `change` on a pick
      options.face 'pane' is the list itself; the default is the dropdown

## Requirements

- Andy, box: *"the appSelector will only show icon and label in the list."*
- It finds `server`. Typed words that fit nothing rank it at nothing and it stands, last, as in every list of the shared search: "a row the words miss scores 0 and still stands, last".
- A row pressed sets `value` and `row` and says `change`, and shows that app's detail.
- **Who paints, listens** (Andy, G41.32): `server.json` changed on the disk changes the row on the page, with no reload and no second search asked by hand.
- Destroy leaves its container empty.
