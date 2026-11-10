# spirit/element/joinList.js

All of Join (goal/G43.26): the Join app (`spirit/app/join/element.js`) only mounts it. Its steps are join.json's, read once;
where the node stands is the join news on the node's spirit job, as the jobs family's cache keeps it
(`spirit.data.job.data`), and the steps are drawn by `spirit.required.spirit.element.joinSteps`.

    spirit.element.spirit.element.joinList.create(container, {}) -> { destroy() }

Its test is `./joinList.js`, on a bare window; it is also the proof the general rules take that what it watches redraws
it (Andy, goal/G43.32: *"cw, yes"*, to *"shall join's own test prove that it redraws, as you ruled for deskDetails in
Q24?"*): a marked row in the jobs or the contacts cannot change the steps it draws.

## Requirements

- It places itself at `spirit.element.spirit.element.joinList`, and says it waits for the node until the job is read.
- Each step is drawn with its name and its icon exactly as join.json gives it; a done step marked ☑️, an open one ⬜;
  with every step done it says "Every step is done." with ☑️.
- It watches the jobs family's cache once; a new join on the spirit job redraws the steps, another job's change draws
  nothing.
- Destroy lets its watch go and empties its container; destroyed before the job is read, it keeps no watch and draws
  nothing.

## What its test must try to break

- A join that changes on the spirit job and leaves the steps as they were.
- A redraw for a job that is not the spirit job.
- A watch kept after destroy.
