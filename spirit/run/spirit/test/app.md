# app.js

`spirit/run/spirit/app.js` and its folder are the `app` family (goal/G43.2). Its test is `./app.js`.

Andy, box: *"we build a skeleton core-api-family, not a separate server, precisely the OLD way, the new family is called "app""*.

## Requirements

- `spirit/app.js` beside `spirit/app/`, which holds what every core family holds: `api.js`, `AGENTS.md`, `data.js`, `search.json`.
- One verb, `app.search`, one optional search string, no filters: *"it's minimum, no filters, just a search string."* A filter is refused at the door.
- The node's api names the family beside the others.
- `spirit/app/server/server.json` has `identity.icon` and `identity.label`. The plugins are exactly the folders of `spirit/app/` that hold their own `<name>.json`, as apps move in one by one. No app may take the name of a verb of the family: a folder named `search` is no app (goal/G43.6).
- It answers as other searches do, key and label rows. It finds `server` on an empty search and on its label, and not on words that fit nothing. The row carries the icon.
- A folder counts only with its own `<name>/<name>.json`, read from the disk: a second one is found, and one without its file, `appSelector/` and `test/` are not.
- A face may call it: *"and yes, a face with no star can call appSearch"*; since goal/G43.18 (box v29) a face is whole or there is none, so the face rule refuses only contact.own. The hidden filter that comes with that is out of scope.

## app.active (goal/G43.9)

Andy, box: *"spirit.app gains a verb: "active"."* Peer review: wsl, yes.

- *"app.active { key, active } sets it; only the owner may."* `api.js` names it with both arguments, and it has `active.json`. Who may call it is the gate's (all APIs are the owner's until granted); this test calls as the owner and does not assert it.
- *"The user sets active, so Monitor and server start off."* Monitor is intrinsic since then (below), so always on: the test judges the Agent and server, neither active before a press, in the file, and no row active before a press but an intrinsic app's.
- *"The node writes spirit/state/<key>/node.json."* True and false both land there.
- Writing it also starts or stops the app's server, if it has one (goal/G43.12). Only this verb does that: a hand edit of the file counts at the next boot. Specified in `./appServerMount.md`.
- *"A key not in spirit/app is refused, so no path can be written through it."* Unknown keys, `..`, a path, `appSelector`, `test` and empty are refused, and write nothing.
- *"spirit/state/ is not servable."* A plain GET does not hand the file over.
- *"app.search stays "just a search string"."* Its only argument is `q`.

## app.label (goal/G43.9)

Q4, *"Do a label change and allow-as-shell go in spirit/state/<name>/node.json, through two new verbs app.label and app.shell?"*, Andy: *"yes."*

- Each names its arguments, has its file, writes `node.json` keeping what else it holds, and never writes `<name>.json`.
- `node.json` overrides `<name>.json`: a search answers the new label.
- Both refuse a key that is no app.
- app.shell went with the Allow row (goal/G43.18, Q10): whether an app may be a shell is its `<name>.json`'s alone, and node.json holds no shell.

Q6, *"Does a changed icon go in spirit/state/<name>/node.json through a third new verb, app.icon?"*, Andy: *"yes."* `app.icon` is held the same way.

The first activate, Andy: *"on first activate, spirit/state/<name>/node.json should be initialized with the values from spirit/app/<name>/<name>.json"*, and on Q7: *"it just holds active (boolean), icon (glyph), label(string) and shell (boolean),"*. It copies label and icon (shell no more since goal/G43.18), holds nothing else, and keeps what the node already chose.

## Intrinsic (goal/G43.14)

- An app whose `<name>.json` says `identity.intrinsic` true is always active: its row says so with no press and nothing written to its `node.json`.
- `app.active` with false does not switch it off.
- Before any press, no row says active but an intrinsic app's.
- goal/G43.15: an app's row carries `intrinsic`, true or false. `app.active` on an intrinsic app is refused by name, not 200, with a code, and writes nothing.
- Not asserted by this test (`spirit/app.js` does it; no test asserts it yet): the two G43.21 lines below.
- goal/G43.21: an app's row carries `run`, its `<name>.json`'s `node.run`, true or false.
- goal/G43.21: and `runOnly`, true when its `<name>.json` says `node.run` and neither `node.mount` nor `shell.mount`. Andy: *"and the node should know it, too."*: `app.active` on such an app is refused by name, `app-run-only`, 409, and writes nothing.
