# apiAuth.js: auth.bundle

`spirit/run/spirit/apiAuth.js` holds the auth family's verbs. This spec covers the one G41.13 adds, `auth.bundle`, and
its table in `node.db`. Its test is `./apiAuth.js`. The grant verbs are older and are covered in `spirit/test/`.

Andy, box v7: *"A bundle is a clearly defined subset of an API, with no user, process or agent tied to it."*

## Requirements

- `spirit/auth/api.js` declares `bundle { op, id, label, description, paths, text }`, flat, as the agent tables'
  verbs (*"akin to the <tableName> verbs of the agent app: op add, set, delete, get and search"*).
- `spirit/auth/bundle.json` describes the verb and its request.
- `createApiAuth` answers `bundle(a)` beside grant and revoke.
- A bundle is keyed by an ID in the shadow roll's form, an ed25519 public key made at add, and carries a label and a
  description.
- The node keeps one bundle table, in `node.db`:
  - `bundles (id, label, description)`, with `id` its key;
  - `bundle_paths (bundle_id, path)`, both its key and nothing else. A bundle's paths are rows of their own, grouped by
    its id. They have the grants' shape, so `spirit/authTableInterface.js` can hold them.
- A path is a family or `family.verb`. A bundle may span several families, hold one family, or hold a single path.
- The ops:
  - `add {label, description, paths}` answers `{ id }`.
  - `set {id, ...}` changes what it names and keeps the rest. `paths` replaces the whole list.
  - `delete {id}` removes the bundle and answers `{ id }`.
  - `get {id}` answers `{ id, label, description, paths }`.
  - `search {text}` answers `{ items, more }`. Each item is keyed by the bundle's id, its label the bundle as get shows
    it, best first. With no words it answers every bundle.
- Refusals, in `auth.grant`'s words:
  - an op it does not know is refused `bad-request`;
  - a path that is not one is refused `not-a-path`;
  - a path in the `fs` family is refused `owner-only`, as no grant may hold it (goal/G33.10);
  - a bundle that is not there is refused `no-such-bundle`;
  - a refused add makes no bundle.
- A bundle is not granted by reference (Andy, box v7): granting copies its paths, one `auth.grant` per path, so
  changing or deleting the bundle later changes no grant already made. A grant that exists already is not made twice.
- The bundles persist in `node.db`.

## What its test must try to break

- A bundle holding the `fs` family, or a malformed path.
- A set that empties the fields it did not name, or merges paths instead of replacing them.
- A grant that follows its bundle after the bundle changes or is deleted.
