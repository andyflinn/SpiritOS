# preferences.json gone

goal/G43.17. Its test is `./nodeSettings-noPreferences.js`: the tree read as it is, and a real node on a scratch copy of the tracked files, asked at its loopback door.

Andy: *"i want to remove that information and all the code that references it, gone."*, *"go do it!"*

## Requirements

- No `preferences.json` is tracked, and no tracked code file (`.js`, `.html`, `.css`, `.json`), tests, install scripts and comments included, names `preferences.json` or the policy it held (`UNKNOWN_PREFS`, `unknownPolicy`). Andy: *"MAKE SURE the code referencing preferences.json will be gone from the codebase."* Only this suite and Desk's own data, `currentGoal.json`, are aside.
- The node writes no `preferences.json`.

