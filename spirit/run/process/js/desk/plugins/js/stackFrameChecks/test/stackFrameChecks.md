# process/js/desk/plugins/js/stackFrameChecks/stackFrameChecks.js

The stack-frame checks plugin (goal/G22.3), the first gg plugin: it governs its private goal of stack-frame items, one
item per door (goal/G27.2, D8), keeps the list of doors, runs a door's check itself (D5, D9) and commits its own list.
Decided by Andy (2026-10-13, 2026-10-17); the file is not to loosen it: nothing closes, finishes or abandons the goal.

## The list

`stackFrameList.json` beside the file, or the scratch list a suite names in the suite-only value `stackFrameList`
(the desk's first argument): an array of `{ id, gate, endpoint, paths?, suites, item }`. A door with no `d<n>` id gets
one past the highest, written back once; anything that is no object is dropped; a list that cannot be read is empty.
Written whole through a file beside it. An item named `plugin/stackFrameChecks.<n>` is read through `desk.idOf`.

## Requirements

- **At mount**: an open item titled `Rerun the stack-frame test` in its goal is deleted (a done one is left). Every door
  whose item is known to this desk but is not an open item of its goal, or is the item of a door before it, gets a
  fresh item (as the desk, D8); a door naming an item this desk never held is another desk's, left alone. When any
  door moved, the list is written, published (`list`) and committed once.
- **A door's item** (itemFor): titled `Nobody but <gate file>::<function> reaches <endpoint short name or node kinds>`,
  refused if the label rule refuses it or an open item of the goal asks the same; then its file
  `spirit/test/stackFrameTestItems.js`, its box (version 0, naming the door), and press code.
- **refuses** (only calls naming an id in its goal): session.set; abandon on anything; close or done on the goal; while
  its door is in the list, a door's item takes no item.delete, close or done.
- **make {gate, endpoint}** (the caller's item.add): the gate is one `spirit/run/<file>.js::<function>`, the file there
  and the function in it (a whole module is cheating; 256 characters at most); the endpoint a whole module of
  spirit/run that is there, or `node:<http|https|fetch joined by +>` with no kind twice, never a function; the gate not
  in the endpoint's module; no door already in the list with the same gate, endpoint and paths. Answers `{ id, door,
  change, commit }`; the door is added, `changed.json` under its state folder keeps when, `list` is published.
- **The commit** of the list: only the list file, in the repo it lives in, `plugin/stackFrameChecks: <what changed>`,
  pushed by pushOrigin (its own process). Other changes staged: not committed, said. A failed push: committed locally,
  saying pushOrigin's first line. One commit at a time. The reply's `commit` is that line.
- **paths/suites .add/.remove {id, path}**: one row a write; a path only on a node: door, a request path, none twice;
  removing the last path removes the field; a suite a file name of spirit/test that is there; refused while its door
  runs. **.search {id, text}**: ranked by text, the list's order with none, bounded.
- **update {id, gate, endpoint}**: under make's rules, its id, item, paths and suites kept, never its own duplicate;
  refused while it runs; marks it changed.
- **run {id}**: at once, the one-door suite (`spirit/test/oneDoorStacks.js`, in the repo, with SPIRIT_STACKS_DOOR,
  SPIRIT_STACKS_LIST and SPIRIT_STACKS_VERDICT); one run per door (`already`). Its end: the verdict file read and
  removed, the run kept as `runs/<id>.json`, `run` published, and `door.record` sent to deskVerify. No verdict: ran
  false, `the suite exited <code> with no verdict`.
- **runState {id}**: running, or the kept run; a run older than the door's last change reads as cleared (`the door
  changed after its last run`); never run reads `never run`. Its verdict carries the violator lines (violators.js) and
  the raw paths, each cut to 300 bytes, 2000 bytes of lines and 3000 of paths, the rest counted in violatorsLeft and
  pathsLeft.
- **doors.search {text}** and **door {id}**: each door with its last run; the search bounded to one answer.
- **remove {id}**: refused while it runs; the door struck, its item deleted (by the desk), committed.

## What its test must try to break

- A gate, endpoint, path or suite let in that the rules refuse; a duplicate door.
- A door's item closable while its door is in the list; its goal closable or abandonable.
- A commit that takes other staged work, or a push failure said as success.
- A change accepted while the door's run is under way.
- A stale verdict shown for a changed door; an answer past its byte budget.
- A door of another desk rewritten at mount.

## Not tested

The real one-door suite and the real pushOrigin (stood in for: their own modules'); the PUSH_MS kill of a pushOrigin
that hangs (three minutes).
