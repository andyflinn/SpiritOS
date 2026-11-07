# admit/hold left

goal/G43.23, item 6 (after goal/G43.17). Its test is `./noAdmitHold.js`: each file's code read with its comments left out, and the node's own store opened on a scratch folder under /tmp.

Andy, G43.17: *"Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."* The box: *"admit/hold left (G43.17): the traffic log's admitted mark (peerPost, trafficLog, arrivals, nodeStore), heldActions in the contact row, chatClerver's held / contact.accept code, the preferences migration in client/shell.js."*

## Requirements

- The code of `spirit/peerPost.js`, `spirit/trafficLog.js`, `spirit/arrivals.js` and `spirit/nodeStore.js` names no admitted mark.
- The traffic table the node's own store makes in `node.db` has no `admitted` column.
- The contact row (`spirit/element/search/contact/rowElement.js`) has no `heldActions`, nothing held.
- `process/js/chatClerver/chatClerver.js` asks no `held` and calls no `contact.accept` for a held key. The node verb `contact.accept` stays (it keeps a contact) and is not judged here.
- `spirit/client/shell.js` holds no preferences migration: no `migrateAppIds`, `APP_ID_RENAMES` or `withShellIds`.
- Each file is first shown read, its code still holding a line that is surely code, so a missing file or a stripper that ate the code is red, never a vacuous green.
