# spirit/element/search/job/row.js, one job as a row

The job search's row (goal/G43.32; Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*): the row the job list drew itself before (`spirit/element/job.js`, goal/G43.29). Its test is
`./row.js`: the browser file run in node on a bare window, the shared row element, the icon element and the
progress bar stand-ins, so what is judged is what this file says a job is.

`spirit.required.spirit.element.search.job.row.create(job, { latest })`; also `.kindOf(job)`, `.STATUS_ICON`, `.mark(id)` and `.actionOf(job)`.

## Requirements

- It places itself at `spirit.required.spirit.element.search.job.row`, with a create, and loads what it draws with:
  the shared row element, the icon element and the progress bar.
- A row is of kind `job`, keyed by the job's id, with no actions: a press opens its detail (the list's).
- Its fields, in order: latest, status, name, kind, progress, updated.
  - latest: the one green dot on the job that changed last, read from `latest()` when painted (goal/G29.14).
  - status: its glyph and its word.
  - name: its module, else its id.
  - kind: `node` for the node's own jobs, `server` for appServers, `transient` for a run (goal/G29.14).
  - progress: the shared bar from the job's own app object while it is open; none for a terminal job or one with no job
    cycle (goal/G29.14, G29.15).
  - updated: its time, or nothing.
- What it paints is escaped.
- Its rows share one index; `kindOf` and `STATUS_ICON` are what the list's filter and the detail's layer read.
- `actionOf(job)` is the one rule for the button a job offers (goal/G47.1; wsl: *"task.js should take that rule from there, not write a second one"*), read by the jobs detail and the task row (spirit/element/monitor/task.js): `cancel` for a running process or a user-operated server, `delete` for an ended job, else `''` (a node-operated server, the node's own jobs).
- `mark(id)` repaints the dot of every row of that job, and of no other: the list marks the job the dot leaves and the one it
  goes to, since a row repaints only what changed in its own job. No id, nothing.

## What its test must try to break

- A dot kept on a job after another changed last.
- A row the dot left that is never repainted, so two rows show it.
- A bar drawn for a finished job.
- A field missing or out of order, or a kind named wrongly.
- Unescaped text in a cell.
