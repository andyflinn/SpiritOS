# spirit/tempFolder/script.js

goal/G47.1, the box, OTHER STUFF, no pollution: names and folders. Andy, Q30: *"spirit/tempFolder/script.js is fine"*.

`tempFolder(route, { run })` answers the absolute path of a process's temp folder, made and empty; `tempFolder.path(route, { run })` answers the same path and makes nothing. Node only. Placed at `spirit.required.spirit.tempFolder` by `spirit.requireScript`.

Its test is `./script.js`: runs of its own with keys of their own, every folder under the system temp folder and removed after. It is the one test that reads the system temp folder itself, to check the helper's paths against it.

## Requirements

- It loads through `spirit.requireScript` and stands at `spirit.required.spirit.tempFolder`.
- A job's folder is the system temp folder, then `spirit`, then the node, then the route: `<temp>/spirit/<node>/spirit.app.zzJob`.
- A suite's path makes a folder of each of its parts.
- The node is named by the first 16 hex characters of the sha256 of its key (`spirit/state/identity.json`, `publicKey`); a run with no key yet by its own path, hashed the same way.
- Two runs with different keys never share a folder.
- No process id is in the path.
- Asked again, it hands the folder back empty.
- `path` names the same folder and makes nothing.
- A route with an empty part, a `.` or `..` part, or any character but letters, digits, `.`, `-`, `_` and `/` is refused.

## Every node's root is swept (goal/G49.27)

A hand-out in a fresh process sweeps every root under <tmp>/spirit: a dead process's spot in another node's root goes, and that root
with it once no live owner is left and it is an hour untouched; a root no process owns, an hour old, goes whole; a root whose
owner still runs stays, however old.
