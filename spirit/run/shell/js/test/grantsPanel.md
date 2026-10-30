# grantsPanel.js

`spirit/run/shell/js/grantsPanel.js` is the grants panel (goal/G41.16): grants of whichever ID table its caller hands it.
The Grants app draws it for contacts and the node's grants; the agent app for its jobs and its grants by job. Its test is
`./grantsPanel.js`.

Andy, goal/G41.16: *"the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js,
and shell/js/grantsPanel.js is configurable with an ID table"*, and *"the callers (Grants and agent shell apps should
boody well know how to configure the damn grantsPanel element"*.

## Its configuration

`grantsPanel.create(host, { ids, grants, api })`, all of it the caller's:

- `ids`: the ID table, as the contact selector takes it (G41.13, Q2): `table` (its loopback api location), `key`,
  `label`;
- `grants`: the grants table those IDs are granted in, as the grant list and row take it: `branch`, `key`, `label`,
  `search(text)`, `grant(id, path)` (answering `{ ok }`, or `{ ok: false, code, error }`), `revoke(id, path)`,
  `stream(job)`;
- `api`: the app's shell api.

Made without its ID table or its grants table, it throws nothing and says so (goal/G41.19, box v23: *"throws nothing
even when unconfigured (it says it is not configured)"*): one note, `not configured: ` and the table it lacks, and
nothing else drawn; its `destroy()` empties the host. It never falls back to one caller's setting.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/contactSelector.js`, `shell/js/bundleSelector.js`,
  `shell/js/apiFamilySelector.js` and `shell/js/grantSelector/listElement.js`; no data script.
- It names no grants table and no ID table: no auth grant verb, no agent verb, no loopback location, no branch. The
  node's bundles are the one dictionary both kinds of grant are made from, so reading a bundle's branches
  (`auth.branch`) is its own.
- Its selectors are made in the shell's element shape, `<name>.create(container, options)` (goal/G41.19), each in a
  container of its own, then set in the line it stands in.
- **The grant form, one row**: "grant", the ID selector, the bundle selector, the Grant button. Both ID selectors (the
  form's and the filter) search the ID table it was handed: its location, key and label.
- **The filter line, below it**: the ID filter, the family selector and the deprecated button, in one row
  (`data-grants="filters"`).
- **The list**: one grant list, handed the grants table it was given, in a `fill` box; nothing above it fills.
- **The filters narrow it**: nothing chosen, every grant passes; the ID filter by the grants table's own key field; the
  family filter to that family's paths, and with a verb to that verb. A change redraws the list.
- **Deprecated**: the tree is read through `spirit.tree()`, and the list told what it serves; a server job changed, the
  tree is read again, so a grant reads deprecated only while no server serves it. Its filter is a toggle the list draws
  no button for, off at first (a grant no server serves is left out); its button pressed, they are listed.
- **Grant**: with no bundle or no ID chosen, nothing is asked. Otherwise it reads the chosen bundle's branches
  (`auth.branch { op: 'search', bundle }`) and grants each through the grants table it was handed, `grant(id, path)`:
  `family.verb`, or the family alone for (ALL). Nothing is granted or read past that table. A path the ID holds already
  is counted done, never said as a refusal; any other refusal is said. No grant is read again: each new one arrives on
  the stream (rule/19).

## What its test must try to break

- A grants table, ID table, verb or branch named in the panel itself; a panel made without its configuration that
  throws, keeps silent, or draws more than its note.
- An ID selector that searches anything but the ID table it was handed.
- The form out of order, the filters off their line, a fill box above the list.
- A filter that narrows by a key field the grants table did not name, or does not redraw the list.
- A deprecated mark that does not follow a server starting or ending, or its filter on at first.
- A grant made past the grants table it was handed, or of anything but the bundle's branches.
