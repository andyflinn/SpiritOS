# spirit/app/desk/data.js

goal/G43.22. Its test is `./data-noTeamChat.js`: the tree read as it is, comments left out.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*

## Requirements

- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: the desk page cache (`spirit/app/desk/data.js`) names no `goal/G0`.

## Found while reading, not asserted

- DISCREPANCY WITH ANDY's RULES ("removal of plugin support."): `spirit/app/desk/data.js` still handles a publish
  naming `plugin: 'stackFrameChecks'` and keeps the `deskDoors` / `deskDoorRuns` branches and their reads for it,
  though nothing publishes it any more. This test reads data.js only for `goal/G0`.
