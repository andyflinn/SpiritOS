# How a family is found by its name

goal/G43.27, `spirit/run/spirit/test/familyFinder.js`.

Andy: "make sure there's a test for the module searching for api's that makes sure those rules are followed - less path elements get priority, - the target needs an api.js - and duplicate <name>/api.js raise a red.", and "spirit/app/contact/ does NOT have an api.js".

The tree is read as it is. The finding is judged on a real page (headless Chrome) of a scratch node. Folders that break the rules are planted into the scratch node's copy, never into the tree.

## Requirements

- **3. No `<name>/api.js` twice in the tree.** A family interface is any of `spirit/<name>/api.js`, `spirit/app/<name>/api.js` and `process/js/<name>/[family/]api.js`. A second relay/api.js planted into the scratch copy is seen as a duplicate.
- **2. The target needs an api.js.** A `spirit/app/contact/data.js` planted beside no api.js never runs, and contact loads `spirit/contact/data.js`.
- **1. The fewest path elements win.** A planted `spirit/app/relay/` with its own api.js and data.js loses to `spirit/relay/`, whose data.js is the one loaded.
- **An app's family is found where its api.js is.** The agent app's api.js is in `spirit/app/agent/` alone, so `spirit/app/agent/data.js` is loaded.
- **No data.js is asked that is not there (no 404).**
