# spirit/app/contact/contact.js

Contacts in `spirit/app/contact/`, as Andy sees it (goal/G43.14). Its test is `./contact.js`: the tree read as it is, then a real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector, made as the shell app (`spirit/app/shell/shell.js`) makes it, on the face shell Andy uses, `/face.html`.

Andy: *"the new contact app will be exactly the same as the old, merely placed where it now belongs."*

## Requirements

### The renames

- `spirit/element/contacts/` is gone, and `spirit/element/search/contact/` holds `listElement.js` and `rowElement.js`. No code names the old folder.
- `shell/contacts/` is gone, and `spirit/app/contact/contact.js` is there. No code names `shell/contacts`.
- `contact.json`: icon 🤩, label Contacts, intrinsic true, `shell.mount` true, `node.mount` false.

### Always on

- Its tile is in the appSelector with nothing pressed.
- Its detail in the appSelector shows no Activate and no Deactivate.
- `app.active` with false leaves its tile there.

### The same app

- Its tile opens the app, and the contact a fresh node knows is listed.

### The peer counters are gone

- `spirit/peerStats.js` is gone, and no code names it.
- No row of `contact.search`, and not `contact.get`, carries `unansweredInbound`, `inboundPerDay` or `outboundPerDay`.
- A contact's detail opened from the app shows none of them.

Nothing throws on the page.

## Not judged here

- The core rule for `spirit/app/` (`../../../test/coreFiles.md`), and the always-on rule in the node (`../../../test/app.md`, `../../../test/appServerMount.md`).
- `spirit/state/peerStats/`, deleted by hand on each node.
