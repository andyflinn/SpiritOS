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
  - `get {id}` answers `{ id, label, owner }`. There is no `set` (goal/G41.26, Andy: *"A bundles label is determined when
    it's added, and cannot be modified ... the auth.bundle set op will be removed."*): a set is refused `bad-request`,
    the bundle as it was, and tells nothing.
  - `delete {id}` removes the bundle and every branch that names it, and answers `{ id }`.
  - `search {text}` answers `{ items, more }`, each item keyed by the id, its label the bundle as get shows it, best
    first; no words is every bundle. `owner` narrows it to that owner's bundles; none, or an empty one, narrows
    nothing.
- **The owner** (goal/G41.25). Andy, box: *"the bundle table gains 1 field: \"owner\", which can contains either
  \"node\" (default), or the name of an appServer"*, *"the owner field can never be changed after a bundle is added"*,
  *"for bundles without a valid \"owner\" field, the auth.bundle verb will replace the content of the invalid \"owner\"
  field with \"node\", incoming or outgoing"*, and *"changes to the auth.bundle verb for the addition of the \"owner\"
  field are approved by andy and need no review."*
  - An add with no owner is owned by `node`. An add naming an app server is refused `not-node-owned` (goal/G41.32,
    below): no verb makes a server's bundle; the test makes one in `node.db` directly.
  - A set never changes the owner.
  - Incoming: an add whose owner is not valid (empty, not a text, not a name) is owned by `node`, and the table keeps
    `node` for it.
  - Outgoing: a kept row whose owner is not valid is answered `node`, by get, by search and on the stream.
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

### No bundle sync (goal/G43.20)

The box: *"the bundle sync goes altogether (Andy: \"just delete that file auth bundles, auth is the ONE api that REALLY can
do without.\"): apiAuth reads no <name>Bundles.json and keeps no bundles.json record any more"*. Bundles stay rows in
`node.db`, made and changed through `auth.bundle`.

- A boot (`createApiAuth({ rootDir })`, as the node makes it) on a tree whose app folder holds a `<name>Bundles.json`
  makes no bundle of it.
- And writes no `bundles.json` record anywhere.

### No branch carries an FS set (goal/G43.20)

Andy: *"those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
to all those files, that's why they are now completely redundant."*

- The node's tree holds no `FS.` verb, so `auth.branch` add of one is refused as any verb no branch serves; a set onto
  one is refused the same, the branch kept as it was.
- The family's own verbs make branches as before.

## What its test must try to break

- A change, or a grant, not told; a refused one told.

- A branch naming a bundle, family or verb that is not there, on add or on set.
- A duplicate family and verb in one bundle, on add or on set.
- A bundle deleted with its branches left behind, or another bundle's branches taken with it.
- A filter that does not narrow, or an empty one that does.
- The old tables still made.
- An owner changed by a set; an invalid owner stored or answered; a search by owner
  that lets another owner's bundle through.
- A boot that adds a kept key twice, keeps a branch the file dropped, leaves a dropped key's bundle or branches, takes
  the owner a row names, touches a user's bundle, or stops at a file that is not valid.
- A set that renames a bundle, or is told.
- An FS verb taken into a branch, by add or by set, or granted; a refusal by any code but `owner-only`.

## goal/G41.32: unique labels, and a user changes node-owned bundles alone

The box: *"Bundle labels should be unique per owner."*; *"A user can only create, change and delete node-owned bundles and
branches, and sees the others read-only"*; *"no "old-data-rescue-missions""*. This overrules goal/G41.25's add naming an app
server: no verb makes a server's bundle, so the test makes one in `node.db` directly.

- The same label again, by the same owner, is refused and no row is made. The same label under another owner is another
  bundle. Only the exact same label is a duplicate. A label is free again once its bundle is deleted.
- Through the verbs: an add naming an app server is refused; a server's bundle cannot be deleted, nor its branches added to,
  changed or deleted; it is still read by get. On a node-owned bundle all of it works.
