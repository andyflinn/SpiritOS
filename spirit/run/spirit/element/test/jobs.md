# spirit/element/jobs.js, the Job Monitor's list

Its test is `./jobs.js`. The box (goal/G43.29, v3): *"Each works exactly as the old one, merely placed where it now belongs"*, *"What it draws is in separate files of spirit/element/, and the old apps' code moves there"*; Q1: *"a job row opens detail panel overtop of jobs."* Written from reading the old `shell/jobs/jobs.js`.

`spirit.element.jobs.create(container, { open })`, mounted alone in a box of a real Chrome on a scratch node's face page. A failed job and a running one come from two planted `node.run` apps, started through `jobs.create` as Run starts one.

## Requirements

- Every job of the node is a row, `spirit.fs` among them; its columns Status, Name, Kind, Progress, Updated; `spirit.fs` of kind node, running; a failed job shows ❌ failed.
- The kind filter, in order: all, node, servers, transient, failed (G29.16). failed lists the failed jobs only, node the node's own only, all every one again. A header row is no job and is never judged as one.
- One green dot, on the job that changed last (G29.14).
- A job cancelled on the node repaints its row with no reload.
- A row press hands its key and a fill to the mounter's `open`; with no `open` handed, a panel of its own over the whole list, the job on it, its close bringing the list back.
- destroy empties its container; the page throws nothing.
