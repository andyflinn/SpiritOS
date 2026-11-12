# peerPost.js marks no admitted

goal/G43.23, item 6 (after goal/G43.17). Its test is `./peerPost.js`, moved here from `spirit/test/nodeStore-noAdmitHold.js` (goal/G43.28): beside the file whose code it reads, its comments left out.

Andy, G43.17: *"Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."* The box: *"admit/hold left (G43.17): the traffic log's admitted mark (peerPost, trafficLog, arrivals, nodeStore), heldActions in the contact row, chatClerver's held / contact.accept code, the preferences migration in client/shell.js."*

## Requirements

- The code of `spirit/peerPost.js` names no admitted mark.
- The file is first shown read, its code still holding a line that is surely code, so a missing file or a stripper that ate the code is red, never a vacuous green.

## The route caching goes (goal/G47.1, box v69)

*"A post carries no hints: the node sends none, the hint signature goes"*. A peerPost on a scratch identity, its request
a hand that keeps the body (sealing off): `post()` handed hints sends a body with no `hints` and no `hintSig`.
