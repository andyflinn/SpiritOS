# spirit/server.js: an app's family at the app's top

goal/G43.27, requirement 2. Its test is `./server-appFamily.js`: a scratch node with the agent app switched on
(`app.active`), never a live one.

Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment."

## Requirements

- **2. The node finds the family there** (server.js familyDir looks for `spirit/app/<name>/api.js`; appServer.js withAgents takes the app folder itself as the family folder).
  - The interface the node serves for `agent` is `spirit/app/agent/api.js`.
  - `agent.FS.path` names `spirit/app/agent/api.js`, so the family folder is the app folder.
