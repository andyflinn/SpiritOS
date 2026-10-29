# apiAuth.js: auth.bundle and auth.branch

`spirit/run/spirit/apiAuth.js` holds the auth family's verbs. This spec covers the two bundle verbs of goal/G41.14,
`auth.bundle` and `auth.branch`, and their tables in `node.db`. Its test is `./apiAuth.js`. The grant verbs are older
and are covered in `spirit/test/`.

Andy, box: *"these four following NAMES will be used in SpiritOS: bundle > branch > family > verb"*, and *"A bundle is
a clearly defined subset of an API, with no ID (user, process or agent,....) tied to it."*

## Requirements

- `spirit/auth/api.js` declares, flat as the agent tables' verbs (*"op add, set, delete, get and search"*):
  - `bundle { op, id, label, text }`, `id` a number;
  - `branch { op, id, bundle, family, verb, text }`, `id` and `bundle` numbers.
- `spirit/auth/bundle.json` and `spirit/auth/branch.json` describe each verb and its request.
- `createApiAuth` answers `bundle(a)` and `branch(a)` beside grant and revoke.
- The node keeps two tables in `node.db`, and makes the old `bundles` and `bundle_paths` no more. What they held is lost
  (Andy: *"any bundle lost during these changed are LOST. OOS."*).
  - `bundle (id, label)`: `id` an integer key the node gives, hidden from the user; the label must not be empty when
    added.
  - `branch (id, bundle, family, verb)`: `id` the key; `bundle` an indexed reference to a bundle row; `family` required;
    `verb` the empty string for all of the family.
- Neither table records who made a row.
- `auth.bundle`:
  - `add {label}` answers `{ id }`. An empty label, or none, is refused `bad-request`.
  - `get {id}` answers `{ id, label }`; `set {id, label}` renames it.
  - `delete {id}` removes the bundle and every branch that names it, and answers `{ id }`.
  - `search {text}` answers `{ items, more }`, each item keyed by the id, its label the bundle as get shows it, best
    first; no words is every bundle.
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

## What its test must try to break

- A change, or a grant, not told; a refused one told.

- A branch naming a bundle, family or verb that is not there, on add or on set.
- A duplicate family and verb in one bundle, on add or on set.
- A bundle deleted with its branches left behind, or another bundle's branches taken with it.
- A filter that does not narrow, or an empty one that does.
- The old tables still made.
