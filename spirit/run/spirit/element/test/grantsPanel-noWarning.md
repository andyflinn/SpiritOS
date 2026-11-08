# spirit/element/grantsPanel.js: no warning on a grant

goal/G43.27, requirement 7. Its test is `./grantsPanel-noWarning.js`: the tree read as it is, comments stripped.

Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our problem."

## Requirements

- **7. No warning on a grant.**
  - grantsPanel reads no `<verb>.warning.txt`.
  - `spirit/auth/grant.warning.txt` is gone, and no `<verb>.warning.txt` is left: grantsPanel was their one reader.
