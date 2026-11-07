# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5, G41.13, G41.14, G41.16): the owner's screen for who may call which api.
Intrinsic, so it shows on every face, the loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how
else can i give someone access when i travel?"). Its test is `./grants.js`.

Since goal/G41.16 it is a wrapper (Andy: *"the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js"*): its Grants tab is the grants panel, which knows no table; this app configures it (*"the
callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element"*). What the
panel draws and does is the panel's (`spirit/element/test/grantsPanel.md`).

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- Nothing of the old shell: no `shellCreateListSearch`, no `api.ui.elements`, no `apiBranchSelector`.
- It loads what it uses itself (rule/26): `spirit/element/grantsPanel.js`, `spirit/element/tabContainer.js` and
  `spirit/element/bundleEditor.js`. It draws nothing itself: no markup, no list, no selector of its own (by either shape,
  `createContactSelector` or `contactSelector.create`), no data script.
- Two tabs, one `tabContainer`: `grants`, the grants panel in its own box with the app's api; `bundles`, the bundle
  editor with the app's api.
- It configures the panel for contacts and the node's grants:
  - `ids`: the contacts' table, `loopback://api/contact/search`;
  - `grants`: the auth family's cache (`spirit.cacheManager('auth')`, its branch `spirit.data.auth.data.grants.branch`;
    goal/G41.28), keyed `key`, labelled `label`;
    - `search(text)` asks `auth.search { text }` and answers its `{ items, more }`, each found grant carrying whose it
      is in the label field, `label` (auth.search says it as `name`; found live by cw, goal/G41.16);
    - `grant(id, path)` asks `auth.grant { key, path }`, answering `{ ok: true }`, or a refusal as
      `{ ok: false, code, error }` in the node's words (`already-granted` among them);
    - `revoke(id, path)` asks `auth.revoke { key, path }`;
    - `watch(fn)`: a grant the auth family's manager keeps is heard as `<key>\n<path>` with its row, and once revoked
      with none; its release ends it. It has no `stream` of its own.

## What its test must try to break

- Anything the app draws or builds itself, or a data script.
- A Grants tab that is not the panel, or a panel handed another ID table or grants table.
- A grant, search or revoke asked of anything but the node's auth verbs; a refusal lost.
- A table of its own beside the auth family's cache, or a watch that goes on after its release.

## goal/G41.32, in a real browser on a scratch node

The box's bundle lines, judged by real clicks in the Grants app: no Edit or Delete in the pane; a row pressed opens a closable
tab in the app's own tab row, named owner-bundle (Andy: *"the tabs should name owner-bundle"*), its close button small and on the tab's right; the same row again makes that tab active; the
close button takes the tab away and the bundle stays. The branchEditor has a rowForm below the others: ❌, *"Delete
<bundle-name> bundle and branches"*, an arming button: one press only arms, the second deletes and the tab closes. A bundle
deleted at the door closes its tab. A server's bundle opens read-only, with no form and no Delete, and the node refuses its
delete. With no tabContainer configured, as in the agent app for now, the pane has no Edit or Delete, and a press throws nothing.
