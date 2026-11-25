# spirit/fs/filter/app/script.js

One of the fs cache's flag conditions (goal/G49.15, box v16: "One condition per flag, each its own small script"; "the flag
conditions live in spirit/fs/filter/<flagName>/script.js"). It answers, for a folder, whether it is an app's folder: a folder <name> holding <name>.json.

The checks: it is a function of the shape the fs cache's writer asks it with, and it answers true and false as above.
