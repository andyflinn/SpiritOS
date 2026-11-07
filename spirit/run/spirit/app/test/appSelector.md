# appSelector.js

`spirit/run/spirit/app/appSelector.js` is the app selector (goal/G43.2), following `spirit/element/search/bundle.js`: a thin selector over the app list, `spirit/element/search/app.js`, which it loads itself. Its test is `./appSelector.js`, in a real browser on a scratch node.

    spirit.elements.appSelector.create(container, options) -> root
      root.value   the chosen app's key, '' while none is
      root.row     the chosen app, null while none is
      one bubbling `change` on a pick
      options.face 'pane' is the list itself, 'tiles' the apps as tiles; the default is the dropdown
      options.toggle true: a pane or tiles flips between the two
      options.hide   the app keys left out of every face

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
- The panel, Andy: *"the detail panel needs to open on top of the whole container"*. A pick in the pane opens it over the whole container, with the list out of sight, and its close icon brings the list back. It launches nothing.
- The title bar of all panels, a launched app's too, is one rowForm: *"[app-icon] "<app-label> [x]"*. Its close button keeps the class `.app-container-close`.
- *"row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]"*. It shows the app's icon; a changed icon writes `icon` to `node.json`, not to `<name>.json`, and the bar follows. The test sets it through `spirit.app.iconApp`; pressing the dropdown itself is not driven.
- *"row 1: rowForm: [✏️] "Label" [label input box] [Change]"*. Change writes `label` to `spirit/state/<name>/node.json`, not to `<name>.json` (Q4), and the row and the panel follow.
- Row 2: *"if inactive: [🔴] "Activate <app-label> "face" "and" "server" [🟢]"*, *"if active: [🟢] "Deactivate <app-label> "face" "and" "server" [🔴]"*. *"face"* only if `shell.mount`, *"server"* only if `node.mount`, *"and"* only if both.
- Row 3, the Allow row, is gone (goal/G43.18, box v29: "the Allow row of the app detail and its element, spirit/app/appSelector/rowFormAppShell.js, are deleted"): no row says Allow or Don't allow as shell, and <name>.json alone says whether an app may be a shell.
- *"in :tiles mode, only activated apps will appear."* Reached by the toggle or from the start; an app made active appears and one made inactive leaves, no search asked.
- *"in :tiles mode, appSelector icons will 'launch'"*: Andy left "(or mount?)" open and raised no objection to today's behaviour, so a tile opens its app inside through `spirit.app.<name>.createApp` where the app has one (monitor), else
  `spirit.elements.<name>.create`, and the close icon brings the tiles back.

## The app it switches (goal/G43.15)

Monitor is intrinsic since Andy's 7f6ebbbe, so always on. The suite plants an app of its own on the scratch node, Hearing, a copy of Monitor as it was before, and switches that. It counts only the forms that show, since a self-hiding row is drawn hidden.
