# preferences.json gone

goal/G43.17. Its test is `./noPreferences.js`: the tree read as it is, and a real node on a scratch copy of the tracked files, asked at its loopback door.

Andy: *"ignore or hold are enough, and safer that automatically adding a contact, this will be solved when we fix the filters in contact search"*, *"i want to remove that information and all the code that references it, gone."*, *"go do it!"*

## Requirements

- No `preferences.json` is tracked, and no code (tests aside, comments left out) names `preferences.json` or the policy it held (`UNKNOWN_PREFS`, `unknownPolicy`).
- The contact family has no `senders` or `setSenders` (removal reviewed by wsl); the Contacts app asks neither and draws no choice for strangers.
- On the node both are no verb, and the node writes no `preferences.json`.

- Andy: *"so NO, we don't need a "held" "status""*: a refused id stays in the traffic log, *"for as long as there is space"*, and nowhere else waits for a yes: `contact.search` has no `held` filter, the remembered row (`nodeStore.js` SEEN_FLAGS) no `held` flag, and `spirit/contacts.js` no `hold`.
