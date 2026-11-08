# An app's family at its top

goal/G43.27, requirements 1-4 and 6-8, `spirit/run/spirit/app/test/api-appFamilyShape.js`.

Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment."

The tree is read as it is, with comments stripped. The node's answers come from a scratch node with the agent app switched on (`app.active`). The tree before the move is commit 8baa09c3.

## Requirements

- **1. The agent's family sits at the app's top.**
  - `spirit/app/agent/api.js` is in git, with provider, model, persona and job.
  - `spirit/app/agent/api/` is gone, and no app keeps an `./api/` folder.
- **3. One `<verb>.json` per verb.** Each of the four verbs has its `<verb>.json`, with a description, as `spirit/jobs/get.json` has.
- **2. The node finds the family there.**
  - The interface the node serves for `agent` is `spirit/app/agent/api.js`.
  - `agent.FS.path` names `spirit/app/agent/api.js`, so the family folder is the app folder.
- **4. No file names `spirit/app/agent/api/`.**
- **6. A page finds `data.js` by the folder shape.** spirit.js's cacheManager asks no `FS.path`, and spirit.js asks `FS.path` nowhere. On a real page of a scratch node, every family the node names whose data.js is in the tree is loaded by `spirit.cacheManager`, contact among them (an app and a system family share that name).
- **7. No warning on a grant.**
  - `spirit/auth/grant.warning.txt` is gone, and no `<verb>.warning.txt` is left.
  - grantsPanel reads none.
- **8. AGENTS.md through `spirit.fs.loadFile`.** appServer.js's AGENTS paragraph says AGENTS.md is read with `spirit.fs.loadFile` at its path, not through the family's FS.
