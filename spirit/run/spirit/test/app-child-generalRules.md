# spirit/test/app-child-generalRules.js, the rules for the sub-folders of spirit/app/

A `-child-` general test beside `spirit/app.js` (`./TEST_SYSTEM.md`): it judges `spirit/app.js` and `spirit/app/` and
below. Given a file, it judges the app that file is in; given none, or a file of the app branch itself, every
sub-folder. Judged on disc, from the files and their code with comments left out; no node is started.

goal/G43.32. Andy, the box: *"rules for sub-folders of run://spirit/app/"*, rules 0 to 6, and of the name: *"if
app-child-generalRules.js works that is my decision."*

## Requirements

**Rule 0, job and event.** Andy: *"\"jobs\" and it's face spirit/app/jobs/ will be renamed, \"job\" (singular) and the
same will happen for \"events\", which will be renamed \"event\""*.
- No file or folder is named `jobs` or `events` (`jobs/`, `jobs.js`, `jobs-<what>.js` and the like).
- `spirit/job/` and `spirit/event/` are branches, with `api.js` and `data.js`; `spirit/app/job/` is the face.
- `spirit/job/api.js` declares search, get, create, cancel and delete; `spirit/event/api.js` subscribe and publish:
  the words unchanged. Andy: *"all, the verb changes are approved."*
- No product file calls a verb by its old name (`'jobs.get'`, `'events.publish'` ...), nor `spirit.jobs` or
  `spirit.events`.

**The app app** (the box, decided).
- `spirit/app/app/app.json` says `shell.true` true.
- `spirit/app/app/element.js` is its element (today's app selector).
- `spirit/app/shell/`, `spirit/app/appSelector.js` and `spirit/app/appSelector/` are gone.
- The app branch is intrinsic: changeAppIcon, changeAppLabel, detailElement, rowFormAppActive, rowFormSetShell,
  rowFormToggle and serverDEBUG stand in `spirit/element/search/app/`.
- The node's default shell is `app` (`spirit/nodeShell.js`).

**The sub-folders.** `spirit/app/test/` is the app branch's own test folder, the one sub-folder with no manifest. For
every other sub-folder `spirit/app/<name>/`:
- Rules 1 and 2: *"sub folders of this folder are meant for plugin-applications."*, *"a manifest called
  run://spirit/app/[name]/[name].json must exists ..., and it must be valid."* Valid: it parses; `identity` has an
  icon, a label and `intrinsic` true or false (the box, decided); `mount` is an object; `shell` has `true`, `mount`
  and `tile`, `node` has `mount` and may have `run`, each true or false.
- Rule 3: *"does it have a face? a server? Is it a persistent server process that lives while the node lives, or only
  while handling a request?"* It says at least one: `shell.mount` (a face), `node.mount` (a server living with the
  node), `node.run` (a run).
- Rule 4: *"if the application has a face, its main screen element must be spirit/app/[name]/element.js."* With a
  face, `element.js` is there and places a create through installSpiritElement by its own path; with none, there is no
  `element.js`.
- Rule 5: *"if the app is intrinsic, its additional elements belong in spirit/element/ if the app is not intrinsic, the
  additional elements belong in spirit/app/[name]/element/."* An element is a script that places a create through
  installSpiritElement (Andy: *"helpers with no create are no fucking elements. they live in require."*). An intrinsic
  app's folder holds none but `element.js`; a non-intrinsic app's others stand in its `element/`.
- Rule 6: *"an app that serves verbs must also contain, in the spirit/app/[name]/ folder a valid api.js, a data.js and a
  json description file for each verb it serves."* An app with a server has an `api.js`. With one, it loads and declares
  verbs, `data.js` is there, and each verb has a `<verb>.json` that parses to an object.

## What its test must try to break

- A plural name left on a file, a folder, a verb or a call.
- The shell app or the app selector's old folder left standing beside the app app.
- A sub-folder with no manifest, or a manifest missing intrinsic or holding a non-boolean.
- A face whose main element is `<name>.js` or `browser<Name>.js` instead of `element.js`.
- An element left in an intrinsic app's folder, or outside a non-intrinsic app's `element/`.
- A verb served with no description file, or an app with a server and no `api.js`.

What a placed element does on a page is judged by `spirit-sibling-generalRules.js`; what an `api.js` serves, by
`spirit-sibling-branchRules.js`.
