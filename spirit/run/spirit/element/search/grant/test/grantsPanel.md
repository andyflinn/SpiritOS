# grantsPanel.js

`spirit/run/spirit/element/search/grant/grantsPanel.js` is the grants panel (goal/G41.16): grants of whichever ID table its caller hands it.
The Grants app draws it for contacts and the node's grants (`grantsPanel.nodeGrants`, below); the agent app for its jobs
and its grants by job. Its test is `./grantsPanel.js`.

Andy, goal/G41.16: *"the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js, and shell/js/grantsPanel.js is configurable with an ID table"*, and *"the callers (Grants and agent shell apps should
boody well know how to configure the damn grantsPanel element"*.

## Its configuration

`grantsPanel.create(host, { ids, grants })`, all of it the caller's:

- `ids`: the ID table, as the contact selector takes it (G41.13, Q2): `table` (its loopback api location), `key`,
  `label`;
- `grants`: the grants table those IDs are granted in, as the grant list and row take it: `branch`, `key`, `label`,
  `search(text)`, `grant(id, path)` (answering `{ ok }`, or `{ ok: false, code, error }`), `revoke(id, path)`,
  `watch(fn(id + newline + path, row))`, its cache manager's, answering its release (goal/G41.28);

**What it needs, it gets itself** (goal/G43.24; Andy: *"every fucking element gets the interfaces it needs"*): it asks its
verbs through the spirit object, `family.verb` called on that family as `spirit.ready` holds it, or, for a server's
family not there, as `spirit.require(spirit.familyPath(name))` binds it; its answer read through `spirit.outcome`, and its
markup escaped with `spirit.escapeHtml`. No `api.verb`, no `api.escapeHtml`, and no api handed on: its rows' arming buttons hear a click elsewhere themselves. No family carries an FS set (goal/G43.20).

Made without its ID table or its grants table, it throws nothing and says so (goal/G41.19, box v23: *"throws nothing
even when unconfigured (it says it is not configured)"*): one note, `not configured: ` and the table it lacks, and
nothing else drawn; its `destroy()` empties the host. It never falls back to one caller's setting.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/search/contact.js`, `spirit/element/search/bundle.js`,
  `spirit/element/search/api.js`, `spirit/element/search/grant.js` and `spirit/element/rowForm.js`, and the job and auth branches' interfaces (`spirit.require('spirit/job/api.js')`,
  `spirit.require('spirit/auth/api.js')`, the second for nodeGrants), each of which alone requires its data.js
  (goal/G47.1); no data script.
- The panel (`create`) names no grants table and no ID table: no auth grant verb, not nodeGrants, no agent verb, no
  loopback location, no branch. The node's bundles are the one dictionary both kinds of grant are made from, so reading a
  bundle's branches (`auth.branch`) is its own.
- Its selectors are made in the shell's element shape, `<name>.create(container, options)` (goal/G41.19), each in a
  container of its own, then set in the line it stands in.
- **The grant form, a rowForm** (goal/G41.27; Andy: *"grantsPanel:\n\n➕ [choose an ID… ▾][choose a bundle… ▾][Grant]"*):
  it loads `spirit/element/rowForm.js` itself and makes one rowForm, its icon ➕ and its button Grant; its span holds the ID
  selector then the bundle selector, nothing else; the word "grant" at its start is gone, and it draws no Grant button
  of its own; the rowForm's button is the Grant, the grant its `press`. Both ID selectors (the form's and the filter) search the
  ID table it was handed: its location, key and label.
- **Its selectors in the search's 🪣 row** (goal/G41.26; Andy: *"any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the user-can see, which elements belong to the search."*): it draws no filter line of its own and no
  deprecated button; it hands the grant list `selectors`, the ID filter then the family selector, each with a name and
  a test.
- **The list**: one grant list, handed the grants table it was given, in a `fill` box; nothing above it fills.
- **The selectors narrow it**: nothing chosen, every grant passes; the ID filter by the grants table's own key field;
  the family selector to that family's paths, and with a verb to that verb. Their change redraws the list, the search's
  own work.
- **Deprecated**: the tree is read through `spirit.tree()`, and the list told what it serves; a server job changed, the
  tree is read again, so a grant reads deprecated only while no server serves it. Its filter is a plain toggle of the search,
  its button drawn in the 🗜 row, off at first (a grant no server serves is left out); on, they are listed.
- **Grant**: with no bundle or no ID chosen, nothing is asked. Otherwise it reads the chosen bundle's branches
  (`auth.branch { op: 'search', bundle }`) and grants each through the grants table it was handed, `grant(id, path)`:
  `family.verb`, or the family alone for (ALL). Nothing is granted or read past that table. A path the ID holds already
  is counted done, never said as a refusal; any other refusal is said. No grant is read again: each new one arrives through
  the grants table's watch, and the panel says it arrived (rule/19).
- **No warning before a grant** (goal/G43.27; Andy: *"compare that to giving a linux user root authority, he then can fuck up
  the whole system, not our problem."*): it reads no `<verb>.warning.txt` and asks the owner nothing; the grant goes out at
  once. `spirit/auth/grant.warning.txt` is gone.

### grantsPanel.nodeGrants, the node's own grants table (goal/G43.24)

Moved here from the Grants app (the box: *"Still its own: the panel's data source, auth.search and auth.grant /
auth.revoke over the auth cache (GR_GRANTS). It moves into grantsPanel."*). The panel still knows no table of its own: a
caller picks this one by name, `grants: grantsPanel.nodeGrants`, and the panel takes it as any grants table.

- `branch` the auth family's cache, `spirit.data.auth.data.grants.branch` (goal/G41.28); keyed `key`, labelled `label`;
  no `stream` of its own.
- `search(text)` asks `auth.search { text }` and answers `{ items, more }`, each found grant carrying whose it is in the
  label field, `label` (auth.search says it as `name`; found live by cw, goal/G41.16); a row it cannot read is handed on
  as it came.
- `grant(id, path)` asks `auth.grant { key, path }`, answering `{ ok: true }`, or a refusal as `{ ok: false, code,
  error }` in the node's words (`already-granted` among them).
- `revoke(id, path)` asks `auth.revoke { key, path }`, answering as grant does.
- `watch(fn)`: a grant the auth family's manager keeps is heard as `<key>\n<path>` with its row, and once revoked with
  none; its release ends it.

### Grant waits, busy (goal/G41.23, goal/G47.1)

Box: *"first users: Ask in the agent's Update model list, and Grant in the grants panel"* (the Update model list is now
the agent's model table, `spirit/app/agent/element/table/model/elementTable.js`). Since goal/G47.1 (Q20; Andy: *"mark the
button busy from press until the mounter's answer comes"*) the grant is handed to the rowForm as `press`, and the rowForm's
own busyButton waits on it; the rowForm is tested in its own folder, and here a stand-in calls `press` on a press and keeps
what it answers.

- It attaches no busyButton of its own: a second one on the same button was cleared by the rowForm's at once.
- Its Grant is handed to the rowForm as `press`, the grant its request.
- A press grants, and the request it hands the button waits while a grant is not answered; it settles once every
  grant of the bundle is answered, so the button is plain again.

### The grants app's filters and Delete all (goal/G47.4)

Box: *"the dropdown filters are include ID (contact), branch (not fucking family) and verb (if a branch is selected)"*,
*"for any dropdown the default is (unselected==ALL)"*, *"the search therefore must find any user that has grants for any
branch/verb combination"*, *"every row still has a revoke button."*, and *"sticky, at the bottom, a rowForm for delete: ❌
[ID-dropdown] [branch-dropdown] [verb-dropdown] [Delete-armingButton]. It acts on what is chosen in it, not on what the
list shows"*: a contact alone revokes every grant of that contact, a contact and a branch every grant of that branch for
that contact, all three only that one grant; *"No new verb: the node revokes one exact grant, so the panel searches the
chosen contact, branch and verb, revokes each match, and asks again until none is left."* Andy, on its chat: *"the more i
modify the search, the more records will be cached"*. So the answer stays one packet, and each filter asks the node again.
The verb half showing only once a branch is chosen is the api selector's, tested in its own folder.

- Its branch filter says *every branch* when none is chosen, and none of its words says family.
- Choosing an ID, a branch, or a branch and verb asks the grants table's search again, with what was chosen in its text.
- A second rowForm, its icon ❌, its span an ID selector of the handed ID table then an api selector, its button Delete,
  an arming button (loaded by the panel itself), with no `press` of the rowForm; it stands last, below the grant list.
- Its first press arms it and revokes nothing. The second revokes, through the grants table, exactly the grants the row's
  choice names, even when the table answers two rows at a time and says more, best first by the words of the text as the
node ranks them (a revoked grant gone from it): a contact
  alone, all of that contact's; with a branch, that branch's; with a verb too, that one; the list's filters change nothing.

## What its test must try to break

- A grants table, ID table, verb or branch named in the panel itself; a panel made without its configuration that
  throws, keeps silent, or draws more than its note.
- An ID selector that searches anything but the ID table it was handed.
- The form out of order, a filter line of its own, its selectors not handed to the search, a fill box above the list.
- A filter that narrows by a key field the grants table did not name, or does not redraw the list.
- A deprecated mark that does not follow a server starting or ending, or its filter on at first, or hidden from the search.
- A grant made past the grants table it was handed, or of anything but the bundle's branches.
- A Grant not handed to the rowForm as its press, a busyButton of its own on it, or a press that answers before the grants do.
- A verb asked through an api instead of the spirit object.
- nodeGrants asking anything but the node's auth verbs, losing a refusal, or a watch that goes on after its release.

## The authSource part: spirit/element/search/grant/grantsPanel.js: Grants' data source

goal/G43.24, requirement 6. Its test is the authSource part of `./grantsPanel.js`: grantsPanel.js read as it is, comments stripped.

Andy: *"i just moved them, didn't fix the manifest."*, *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

### Requirements

- Grants' data source moves into grantsPanel: `grantsPanel.js` asks auth.search, auth.grant and auth.revoke, over the auth cache.

## The noWarning part: spirit/element/search/grant/grantsPanel.js: no warning on a grant

goal/G43.27, requirement 7. Its test is `./grantsPanel.js`, "Grant reads no <verb>.warning.txt" and "grantsPanel.js holds no warning reading and no confirm"; that none is left in the tree is `spirit/test/spirit-sibling-general.js`'s (goal/G47.1).

Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our problem."

### Requirements

- **7. No warning on a grant.**
  - grantsPanel reads no `<verb>.warning.txt`.
  - `spirit/auth/grant.warning.txt` is gone, and no `<verb>.warning.txt` is left: grantsPanel was their one reader.
