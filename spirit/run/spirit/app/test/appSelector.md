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

## One appSelector, three faces (goal/G43.9)

- *"spirit/app/appTiles.js will be removed."* *"spirit.app.appTiles() will be removed."*
- *"in :pane mode (list) i want to see a list of all rows, activated AND deactivated, with the (de)activate buttons at the end of each row."* Both apps are listed, and each row ends in its one button, which says Activate or Deactivate. The row still shows nothing else but icon and label.
- A press writes `spirit/state/<key>/node.json`; the stream brings `active` to the row and the button follows, no search asked. A search seated over the row does not lose `active`.
- A pick in the pane launches nothing.
- *"in :tiles mode, only activated apps will appear."* Reached by the toggle or from the start; an app made active appears and one made inactive leaves, no search asked.
- *"in :tiles mode, appSelector icons will 'launch'"*: Andy left "(or mount?)" open and raised no objection to today's behaviour, so a tile opens its app inside through `spirit.app.<name>.createApp`, and the close icon brings the tiles back.
