# spirit/element/search/job.js, the job selector

The job branch's search (goal/G43.32; Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*). Its test is `./job.js`: the browser file run in node on a bare window, its list a stand-in that keeps
what it was handed; the list is judged in its own folder (`../job/test/`).

`spirit.element.spirit.element.search.job.create(container, { open })` -> root.

## Requirements

- It places itself at `spirit.element.spirit.element.search.job`, with a create.
- `create(container, options)` appends its root to its container and answers it.
- It requires its own list, `spirit/element/search/job/listElement.js`, and draws it into its root, handing on the
  mounter's `open`, where a job's detail opens.
- `root.destroy()` lets its list go and takes the root out of its container; a selector destroyed before its list is
  here draws none.

## What its test must try to break

- A selector that is a second list, or draws its list anywhere but its root.
- An `open` dropped on the way, so a job's detail opens in a stack of its own instead of the mounter's.
- A list left behind after destroy, or drawn after it.
