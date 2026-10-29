# grantSelector/rowElement.js

`spirit/run/shell/js/grantSelector/rowElement.js` is one grant as a row element (goal/G41.14), as
`shell/js/bundleSelector/rowElement.js` is one bundle. It was the grants app's own `grElement`; the grant list draws its
rows with it. Its test is `./rowElement.js`.

Andy: *"SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????"*, *"INCLUDING COMPLETE TEST FOLDER FOR THE
COMPONENTS INVOLVED!!!!"*.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/rowElement.js` and `shell/js/armingButton.js`; no data script.
- It registers `spirit.elements.grantElement.create(row)`: a row element of kind `grant`, keyed `<key>\n<path>`. Its row
  is the grant `{ key, path, label }`.
- Its fields are `name`, `path` and `revoke`, in that order, Revoke the rightmost. Whose grant (its label) and the path
  are drawn escaped. Revoke is a button naming its action, reading Revoke.
- Mounted, its Revoke is an `armingButton`: the first press asks nothing, the second asks
  `auth.revoke { key, path }`.
- It takes the node's grant rows from the stream itself, its kind's index (`shell/js/rowElement.js`, G30.18): the node
  publishes each grant row on the auth tables' job (type `bundles`, table `grant`), `{ row: { key, path, label } }`, and
  `{ row: { key, path }, gone: true }` when revoked. A grant published lands in `data.grants/<key>\n<path>`; gone takes
  it out; a bundle row, another job's, and a grant with no key or path write nothing.
- It repaints from `data.grants`: when its row there changes, whose grant it is repaints; another grant's row changes
  nothing.

## What its test must try to break

- A part counted on that the row did not load itself, or a data script.
- A label or path drawn unescaped; Revoke not the rightmost.
- A Revoke that asks on the first press, or revokes another grant.
- A grant row from the stream kept under another key, or kept when gone.
- A row that does not repaint from data.grants.
