# spirit/fs/node/script.js — its own test

The node half of `spirit.fs` (goal/G49.2): in a node process `spirit.js` answers the fs verbs through it, on the
process's own disc, through `spirit/fs/fileSystem/script.js`. Owed since the rule *"every production script has its own
test"* (goal/G47.1, box v72). The reads are asked of this tree; the writes of a copy of it in the suite's temp folder,
in a process of its own, since the file system is pinned to the run folder it stands in.

- `spirit.requireScript('spirit/fs/node/script.js')` hands back `{ answer }`; `answer(verb, args)` is `{ status, body }`,
  what the node's verb answers, or undefined for a verb it does not answer (`search` among them).
- `stat`: 200 `{ size, mtimeMs, birthtimeMs }`, or, for a file not there, 200 `{ ok: false, code: not-found }` (Q18). `load`: 200 `{ path, text }`, or 404 `not-found`
  for a file not there, one never served, or no path.
- `save` and `delete`: 204 `{}` when done (a delete of a file not there too); 403 `forbidden` for a root-level or core
  file; 400 `bad-path` for a name the disc will not take (a save onto a folder); 500 `failed` for any other failure
  (a delete of a folder).

## What its test must try to break

- A refused write that still writes; a refusal answered in other words than the node's; a file of this tree written.
