# appSelector.js

`spirit/run/spirit/app/app/element.js` is the app selector (goal/G43.2), following `spirit/element/search/bundle.js`: a thin selector over the app list, `spirit/element/search/app.js`, which it loads itself. Its test is `./appSelector.js`, in a real browser on a scratch node.

    spirit.element.spirit.app.app.element.create(container, options) -> root
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

## No tile without shell.mount, and a face for every app that says it (goal/G43.20)

Andy: *"all, MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!"*, *"where is your test that scans the app folders ... and doesn't show tiles for ANY app with shell:mound:false?"*, and *"where is the test that verifies that an app who claims to have a face, also actually supplies a fucking face?"*

- Planted apps, each made active first: one saying `shell.mount: true` (its tile must show, or nothing is judged), and every way of not saying it: `false`, absent, `"true"`, `1`, a `null` shell, no shell part, and a `node.run` app. None shows a tile.
- Every app folder of the tree whose json does not say `shell.mount: true` shows no tile. An app that says `node.run` is never active (goal/G43.21), so it is judged as a row.
- Judged on the tiles from the start, the tiles reached by the toggle, and the shell's own tiles (`hide: ['shell']`).
- An app whose json drops `shell.mount` on disk loses its tile with no reload; with its shell part gone it does not come back; saying it again brings it back.
- Every app of the tree that says `shell.mount: true` but the shell has its `<name>.js`, and its tile pressed opens a layer that draws something; a failure names the page errors and the layer.

## The nodeRun part: An app that is run, not mounted

goal/G43.21. Its test is the nodeRun part of `./element.js`: a real Chrome on a scratch node's face page, with the tree's apps whose `<name>.json` says `node.run` true, pushOrigin and publishData. The scratch tree is no git clone, so a pushOrigin started there pushes nothing.

Andy, the box: *"spirit app search will list these jobs (node:run) only in pane mode, bacause it they have no shell-mount. the app detail will show a run button."*, and *"the Andy user on each box will run those scripts when he feels like it"*.

### Requirements

- The app search in pane mode lists every app that says `node.run`.
- In dropdown mode, pressed open, it lists the apps that mount, and none that says `node.run`.
- The app detail of each such app shows a Run button; the detail of an app that mounts and says no `node.run` shows none.
- Andy: *"in the app list and details: an app that only has node:run and no node:mount or shell:mount cannot be "activated" show rowForms should knows that."*: such an app's row in the app list and its detail show no Activate, where an app that mounts shows one.
- Andy: *"and the node should know it, too."*: the node refuses `app.active` for such an app, and it stays inactive.
- A press on Run starts `spirit/app/<name>/<name>.js`, a job of `spirit.app.<name>`, though the app is not active.

## The shell part: The shell app, and a shell that replaces itself

goal/G43.18, box v29, *The shell* and *Join*. Its test is `./shell.js`: a real node on a scratch copy of the tracked files, with a shell-worthy app of the test's own (`zzshell`, which draws one line and knows nothing of Join), and real clicks in a real Chrome on `/face.html` at home. The verb itself is judged by `spirit/test/nodeShell.js`.

### Requirements

- Q12, with no shell chosen: the page loads `spirit/app/app/element.js`, and the app search is on it, Contacts listed.
- Andy: *"the shell should exclude itself completely from the app-list, haha..."*: the shell app's list shows Contacts, and no `shell` row or tile.
- *"RULE: a shell must be able to replace itself"*, *"boot.js does the link home and the face stream only, then loads the shell the node names"*: with `zzshell` named at home, the page loads and draws it, and shows nothing of the other shell nor a desktop of boot.js's own.
- Q18, *"Join shows a new user its steps on its own ... neither boot.js nor any shell decides it"*: on the new scratch node, under `zzshell`, Join shows itself.
- The app detail's two rows, *"shown only for an app whose <name>.json says shell:true:true"*: none in Contacts' detail; a Home shell and a Face shell row in zzshell's. The Home shell dropdown first shows the configured home shell, the shell app's label.
- *"Both dropdowns list only the apps whose <name>.json says shell:true:true"*: opened, each lists Zz Shell, and no other app; not the shell app either (Q28, Andy: *"no, the shell icon is now properly missing :)"*).
- *"[armingButton-'Set']"*: Zz Shell chosen in Home shell, Set armed by its first press and pressed again, the node names `zzshell` at home, and face stays `shell`.
