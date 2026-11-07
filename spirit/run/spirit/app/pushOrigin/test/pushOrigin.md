# pushOrigin, run with no repo

goal/G43.21. Its test is `./pushOrigin.js`: a scratch clone with a bare origin of its own in the temp folder, holding a copy of `pushOrigin.js` where the app keeps it, run with no argument from a folder that is no repo.

Andy, Q1: *"it will push the repo it's in."*

## Requirements

- Run with no argument, as Run starts it, it ends well.
- Its origin then holds the commit of the repo the script lives in.
