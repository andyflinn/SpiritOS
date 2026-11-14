# pushOrigin, run with no repo

goal/G43.21. Its test is `./pushOrigin.js`: a scratch clone with a bare origin of its own in the temp folder, holding a copy of `pushOrigin.js` where the app keeps it, run with no argument from a folder that is no repo.

Andy, Q1: *"it will push the repo it's in."*

## Requirements

- Run with no argument, as Run starts it, it ends well.
- Its origin then holds the commit of the repo the script lives in.

## pushOrigin({repo}), tried on what can go wrong

Each case its own clone with a bare origin in the temp folder; the module's own function, required.

- Given no repo, or one that is no clone, it answers `{ ok: false, reason }` and throws nothing.
- A detached HEAD is refused, saying so (goal/G19.6, the box: *"it refuses a detached HEAD"*): the clone and origin as they were, and no branch called HEAD on origin.
- A rebase already in progress is refused, saying so, and is still in progress after (an `am` stopped on its patch, which keeps HEAD on its branch).
- A clash with origin (goal/G5.1): ok false; the clone's HEAD as it was, its unsaved edit and untracked file back, no rebase left in progress; origin unchanged.
- Behind origin with no clash it pushes (Andy: *"ensures my commits go through"*): origin holds both commits, and the unsaved edit is back.
- It puts back only its own stash (goal/G19.6, the box: *"pushOrigin puts back exactly its own stash, or says it could not"*): a stash made meanwhile, by a pre-push hook, stays in the list, untouched.
