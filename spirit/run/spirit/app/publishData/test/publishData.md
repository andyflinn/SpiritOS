# publishData, an app of its own

goal/G43.21. Its test is `./publishData.js`: the tree read as it is, and the script run once with no argument from a folder that is no git clone, so it stops before it asks any node anything.

Andy: *"spirit/app/publishData/publishData will be fixed to point at the correct files/folders"*, and *"the Andy user on each box will run those scripts when he feels like it, that will take the running of those scripts out of the agents hands. much simpler."*

## Requirements

- Run with no argument, as Run starts it, it does not stop at its usage: the node port comes from the node that starts it (`SPIRIT_CALLBACK_URL`), and it goes on to its first step.
- It reads deskVerify's `verify.db` where deskVerify keeps it, `spirit/app/deskVerify/`.
- `agentReadme.js` stands beside it in `spirit/app/publishData/` and loads.
- No agent starts it: `spirit/app/deskClient/publishData.js` and `agentReadme.js` are gone, and `deskClient.js` names no publishData.
