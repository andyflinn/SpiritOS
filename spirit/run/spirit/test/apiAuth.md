# apiAuth.js: auth.bundle and auth.branch

`spirit/run/spirit/apiAuth.js` holds the auth family's verbs. This spec covers the two bundle verbs of goal/G41.14,
`auth.bundle` and `auth.branch`, and their tables in `node.db`. Its test is `./apiAuth.js`. The grant verbs are older
and are covered in `spirit/test/`.

Andy, box: *"these four following NAMES will be used in SpiritOS: bundle > branch > family > verb"*, and *"A bundle is
a clearly defined subset of an API, with no ID (user, process or agent,....) tied to it."*

## Requirements

- `spirit/auth/api.js` declares, flat as the agent tables' verbs (*"op add, set, delete, get and search"*):
  - `bundle { op, id, label, text, owner }`, `id` a number;
  - `branch { op, id, bundle, family, verb, text }`, `id` and `bundle` numbers.
- `spirit/auth/bundle.json` and `spirit/auth/branch.json` describe each verb and its request; `bundle.json` names the
  owner.
- `createApiAuth` answers `bundle(a)` and `branch(a)` beside grant and revoke.
- The node keeps two tables in `node.db`, and makes the old `bundles` and `bundle_paths` no more. What they held is lost
  (Andy: *"any bundle lost during these changed are LOST. OOS."*).
  - `bundle (id, label, owner)`: `id` an integer key the node gives, hidden from the user; the label must not be empty
    when added; `owner` below.
  - `branch (id, bundle, family, verb)`: `id` the key; `bundle` an indexed reference to a bundle row; `family` required;
    `verb` the empty string for all of the family.
- Neither table records who made a row.
- `auth.bundle`:
  - `add {label, owner}` answers `{ id }`. An empty label, or none, is refused `bad-request`.
  - `get {id}` answers `{ id, label, owner }`; `set {id, label}` renames it.
  - `delete {id}` removes the bundle and every branch that names it, and answers `{ id }`.
  - `search {text}` answers `{ items, more }`, each item keyed by the id, its label the bundle as get shows it, best
    first; no words is every bundle. `owner` narrows it to that owner's bundles; none, or an empty one, narrows
    nothing.
- **The owner** (goal/G41.25). Andy, box: *"the bundle table gains 1 field: \"owner\", which can contains either
  \"node\" (default), or the name of an appServer"*, *"the owner field can never be changed after a bundle is added"*,
  *"for bundles without a valid \"owner\" field, the auth.bundle verb will replace the content of the invalid \"owner\"
  field with \"node\", incoming or outgoing"*, and *"changes to the auth.bundle verb for the addition of the \"owner\"
  field are approved by andy and need no review."*
  - An add with no owner is owned by `node`; with an app server's name, by that server.
  - A set never changes the owner.
  - Incoming: an add whose owner is not valid (empty, not a text, not a name) is owned by `node`, and the table keeps
    `node` for it.
  - Outgoing: a kept row whose owner is not valid is answered `node`, by get, by search and on the stream.
  - The bundles from before (a `bundle` table with no owner column) are each owned by `node`.
  - Each row told for the stream carries its owner.
  - Open, asked in the item: is a valid owner any app server's name, or only a server this node has? The test's owners
    are servers of its tree, so it holds either way.
- `auth.branch`:
  - `add {bundle, family, verb}` answers `{ id }`; a verb left out is the empty verb.
  - `get {id}` answers `{ id, bundle, family, verb }`; `set {id, ...}` changes what it names and keeps the rest;
    `delete {id}` removes that branch alone.
  - `search {text, bundle, family, verb}` answers `{ items, more }`, each its branch as get shows it. Each filter
    narrows; an empty or absent one narrows nothing.
- A branch is checked against the live tree when added and when changed (Andy: *"refused if the values are not
  valid"*):
  - a bundle that is not there: `no-such-bundle`;
  - no family: `bad-request`; a family the tree does not serve: `no-such-family`;
  - a verb the family does not serve: `no-such-verb`;
  - the same family and verb twice in one bundle: `already-in-bundle`. Another bundle may hold the same.
- A branch that is not there is refused `no-such-branch`; an op a verb does not know, `bad-request`.
- A family that later leaves the node leaves its branches as they are (Andy: *"no unauthorized access will result from
  such a thing"*).
- A bundle is not granted by reference: a grant made from it stays when the bundle goes.
- Every change is told, row by row, for the node to publish on its stream (goal/G41.14, Andy: *"EVERY FUCKING element
  MUST FUCKING LISTING to anything that changes their data set"*): `onChange(fn)`, `fn({ table, row })` for a bundle or
  branch added or set, `fn({ table, row: { id }, gone: true })` for one deleted, a bundle's branches each told gone with
  it; a refused add tells nothing.
- So is a grant (*"SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????"*): one made is told
  `{ table: 'grant', row: { key, path, label } }`, one revoked `{ table: 'grant', row: { key, path }, gone: true }`; a
  grant refused `already-granted` or a revoke refused `not-granted` tells nothing.
- The bundles and branches persist in `node.db`.

Who may call the two verbs is the gate's: the owner, and whoever the owner grants them (Andy: *"can only be the node
owner, until the node owner grants access to those tables to someone else"*). That is `spirit/test/apiGate.js`.

### Each appServer's bundles, at the node's boot (goal/G41.24)

Andy, box: *"each appServer has a file process/js/<appServerName>/<appServerName>Bundles.json"*; *"this json file at it's
root has one key for each bundle ... and the objects held those keys, contain the value for one bundle \"row\", without
\"owner\" name, and all required branch rows"*; *"the apiAuth.js module, when the node boots, will check for all valid
... files, and update the auth.bundle and auth.branch, adding new verbs, when needed, and deleting verbs, if they are no
longer in the ... file, always using/asserting the server <appServerName> as \"owner\""*; *"when apiAuth.js adds a
bundle for the first time, it stores its key in the appServers state file
relay-state/process/<appServerName>/bundles.json, with its key, and and the same \"label\""*; *"if a USER deletes a
bundle owned by an Server, apiAuth.js it will create a new bundle it owns under the exact same key that was used
before"*; *"if a key is deleted from an ... file, apiAuth.js will delete that key from auth.bundle AND all its rows in
auth.branch."*

- The boot is `createApiAuth({ rootDir })`, as the node makes it; each folder of `process/js/` is an appServer.
- A row of `<appServerName>Bundles.json` is `{ label, branches: [{ family, verb }] }` (the shape is the red writer's,
  open to Andy's change): the bundle's label, and its branch rows as `auth.branch` keeps them, a verb `''` all of the
  family.
- At boot, each key is a bundle owned by `<appServerName>`, whatever owner a row names, with exactly its branches. The
  appServer's own verbs are written though no appServer is served yet at the node's boot.
- The state file `relay-state/process/<appServerName>/bundles.json` keeps each key as `{ id, label }`: the bundle's id
  and the same label.
- Booted again: a kept key is its bundle, so nothing is added twice; a verb added to the key is added, one taken out is
  deleted, the bundle the same.
- A key taken out of the file: its bundle and all its branch rows are deleted, and the key leaves the state file.
- A bundle of the appServer's that a user deleted is made again at the next boot, its new id kept under the same key.
- A bundle the user added for that appServer (the editor mounted for it, goal/G41.25) is under no key and left as it is.
- A folder with no Bundles.json, or one that is not valid JSON, gets nothing; the others are written all the same.

## What its test must try to break

- A change, or a grant, not told; a refused one told.

- A branch naming a bundle, family or verb that is not there, on add or on set.
- A duplicate family and verb in one bundle, on add or on set.
- A bundle deleted with its branches left behind, or another bundle's branches taken with it.
- A filter that does not narrow, or an empty one that does.
- The old tables still made.
- An owner changed by a set; an invalid owner stored or answered; a bundle from before with no owner; a search by owner
  that lets another owner's bundle through.
- A boot that adds a kept key twice, keeps a branch the file dropped, leaves a dropped key's bundle or branches, takes
  the owner a row names, touches a user's bundle, or stops at a file that is not valid.
