# app.js

`spirit/run/spirit/app.js` and its folder are the `app` family (goal/G43.2). Its test is `./app.js`.

Andy, box: *"we build a skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called "app""*.

## Requirements

- `spirit/app.js` beside `spirit/app/`, which holds what every core family holds: `api.js`, `AGENTS.md`, `data.js`, `search.json`.
- One verb, `app.search`, one optional search string, no filters: *"it's minimum, no filters, just a search string."* A filter is refused at the door.
- The node's api names the family beside the others.
- `spirit/app/server/server.json` has `identity.icon` and `identity.label`. The plugins are exactly `monitor` and `server`. No app may take the name of a verb of the family: a folder named `search` is no app (goal/G43.6).
- It answers as other searches do, key and label rows. It finds `server` on an empty search and on its label, and not on words that fit nothing. The row carries the icon.
- A folder counts only with its own `<name>/<name>.json`, read from the disk: a second one is found, and one without its file, `appSelector/` and `test/` are not.
- A face with no star may call it: *"and yes, a face with no star can call appSearch"*. The hidden filter that comes with that is out of scope.

## app.active (goal/G43.9)

Andy, box: *"spirit.app gains a verb: "active"."* Peer review: wsl, yes.

- *"app.active { key, active } sets it; only the owner may."* `api.js` names it with both arguments, it has `active.json`, and a face with no star is refused.
- *"The user sets active, so Monitor and server start off."* Neither is active before a press, in the file or in a row.
- *"The node writes spirit/state/<key>/node.json."* True and false both land there.
- *"A key not in spirit/app is refused, so no path can be written through it."* Unknown keys, `..`, a path, `appSelector`, `test` and empty are refused, and write nothing.
- *"spirit/state/ is not servable."* A plain GET does not hand the file over.
- *"app.search stays "just a search string"."* Its only argument is `q`.

## app.label and app.shell (goal/G43.9)

Q4, *"Do a label change and allow-as-shell go in spirit/state/<name>/node.json, through two new verbs app.label and app.shell?"*, Andy: *"yes."*

- Each names its arguments, has its file, writes `node.json` keeping what else it holds, and never writes `<name>.json`.
- `node.json` overrides `<name>.json`: a search answers the new label.
- A face with no star is refused both, and both refuse a key that is no app.
