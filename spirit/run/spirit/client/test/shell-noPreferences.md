# preferences.json gone, and the old shell's migration of it

goal/G43.17, and goal/G43.23 item 6. Its test is `./shell-noPreferences.js`: the tree read as it is. `spirit/client/shell.js`
read and wrote `preferences.json` until 7bfb9514, so its absence is judged beside it (goal/G43.28; moved from
`spirit/test/nodeSettings-noPreferences.js` and the last section of `spirit/test/nodeStore-noAdmitHold.js`).

Andy: *"i want to remove that information and all the code that references it, gone."*, *"go do it!"*, and G43.17:
*"Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."*

## Requirements

- No `preferences.json` is tracked, and no tracked code file (`.js`, `.html`, `.css`, `.json`), tests, install scripts and comments included, names `preferences.json` or the policy it held (`UNKNOWN_PREFS`, `unknownPolicy`). Andy: *"MAKE SURE the code referencing preferences.json will be gone from the codebase."* Only the suites that must name it (`*noPreferences.js` and `.md`) are aside.
- `spirit/client/shell.js` holds no preferences migration: no `migrateAppIds`, `APP_ID_RENAMES` or `withShellIds`. The file is first shown read, its code still holding `renderDesktop`, so a missing file or a stripper that ate the code is red, never a vacuous green.
