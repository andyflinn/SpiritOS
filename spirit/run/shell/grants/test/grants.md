# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5, G41.13, G41.14, G41.16): the owner's screen for who may call which api.
Intrinsic, so it shows on every face, the loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how
else can i give someone access when i travel?"). Its test is `./grants.js`.

Since goal/G41.16 it is a wrapper (Andy: *"the shell app shell/grans/grants/ must be a wrapper for a new shell element:
shell/js/grantsPanel.js"*): its Grants tab is the grants panel, which knows no table; this app configures it (*"the
callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element"*). What the
panel draws and does is the panel's (`shell/js/test/grantsPanel.md`).

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- Nothing of the old shell: no `shellCreateListSearch`, no `api.ui.elements`, no `apiBranchSelector`.
- It loads what it uses itself (rule/26): `shell/js/grantsPanel.js`, `shell/js/tabContainer.js` and
  `shell/js/bundleEditor.js`. It draws nothing itself: no markup, no list, no selector of its own (by either shape,
  `createContactSelector` or `contactSelector.create`), no data script.
- Two tabs, one `tabContainer`: `grants`, the grants panel in its own box with the app's api; `bundles`, the bundle
  editor with the app's api.
- It configures the panel for contacts and the node's grants:
  - `ids`: the contacts' table, `loopback://api/contact/search`;
  - `grants`: branch `grants`, keyed `key`, labelled `label`;
    - `search(text)` asks `auth.search { text }` and answers its `{ items, more }`, each found grant carrying whose it
      is in the label field, `label` (auth.search says it as `name`; found live by cw, goal/G41.16);
    - `grant(id, path)` asks `auth.grant { key, path }`, answering `{ ok: true }`, or a refusal as
      `{ ok: false, code, error }` in the node's words (`already-granted` among them);
    - `revoke(id, path)` asks `auth.revoke { key, path }`;
    - `stream(job)`: the auth tables' job (type `bundles`, table `grant`) is its grants, gone when revoked; a bundle
      row, or another job, is none.

## What its test must try to break

- Anything the app draws or builds itself, or a data script.
- A Grants tab that is not the panel, or a panel handed another ID table or grants table.
- A grant, search or revoke asked of anything but the node's auth verbs; a refusal lost.
- A stream row taken for a grant that is none.
