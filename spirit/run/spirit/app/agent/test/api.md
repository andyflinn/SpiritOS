# spirit/app/agent/api.js

The agent's family at the app's top (goal/G43.27, requirements 1, 3 and 4). Its test is `./api.js`: the tree read as it
is, comments stripped; the tree before the move is commit 8baa09c3.

Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment."

## Requirements

- **1. The agent's family sits at the app's top.**
  - `spirit/app/agent/api.js` is in git, with provider, model, persona and job, and the publisher's subscribe and
    unsubscribe (goal/G43.32; Andy: *"for now, it needs to declare them in api.js"*).
  - `spirit/app/agent/api/` is gone, and no app keeps an `./api/` folder.
- **3. One `<verb>.json` per verb.** Each of the four verbs has its `<verb>.json`, with a description, as `spirit/job/get.json` has.
- **4. No file names `spirit/app/agent/api/`.**
