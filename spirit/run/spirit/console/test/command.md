# spirit/console/command.js

The console's command processor (goal/G48.2, the box: *"the script run://spirit/console/command.js will be the consoles
command processor."*). It is reached through the console's one door, `node spirit/console/script.js <words>`. Its test:
`./command.js`.

## What it does

- Keeps the console's state in `spirit/state/console/node.json`: the current navigation path (`{ "path": "app.desk" }`, the
  root an empty path) and a 256 rolling command history, every command logged as if typed from the root prompt `spirit: `.
- `path` without argument shows the path stored in state.
- `path <name>` or `path <dot.sequence>` counts from the path in state; a path that is no folder under `spirit/` is refused
  with an error, and the path stays.
- `path <` goes to the parent, `path <<` to the root; at the root both are refused with an error.
- `api` (goal/G48.3): at a branch folder, its verbs' names in JSON, sorted, nothing more; where there is no api.js, a JSON
  error. `api <verb>` answers that verb's .json, its description and request as they stand, as `JSON.stringify(it, null,
  2)`, with a `usage` line at the very bottom; a verb the branch does not have is a JSON error.
- At a branch, a line typed as a verb's usage shows runs that verb, its answer printed as `JSON.stringify(answer, null, 2)`;
  a refusal of the node is a JSON error (goal/G48.3, box v7). A value with a space is put in double quotes; each value is read
  as its argument's rule says: a number as a number, a yes/no as true or false, a list or object as JSON.
- An error is printed as `JSON.stringify(error, null, 2)` (box v12: *"errors are return in JSON.stringify(error,null,2)
  format."*).

## What its test judges

On a scratch node of its own, one command at a time through `spirit/console/script.js`, the state file read where the box puts it:
`path app` stores app and logs `path app`; `path` shows app and leaves it; `path agent` stores app.agent and logs
`path app.agent`; `path nope` refused, the path kept; `path <` back to app; `path app.agent` at app refused (app.app.agent);
`path <<` to the root; `path app.agent` at the root stores app.agent; `path <<` straight back; `path <` and `path <<` at the
root refused, the path kept; every refusal printed as one JSON object, as `JSON.stringify(error, null, 2)` prints it; `api` at the root a JSON error; at spirit.node the names its api.js gives, sorted; `api card` card.json's description and
request with `usage` last, printed indented by two; `api nope` a JSON error; at spirit.app.desk `api item.get` with a usage
naming its id and `api` its verbs; at spirit.app.agent.test, no api.js, a JSON error; at spirit.node `card` shows the node's own card answer,
`setDescription description="said in four words"` stores those four words, `debug debug={"on":...}` turns the debug flag; at
spirit.auth `bundle op=get id=<n>` finds the bundle `bundle op=add` made, and an unknown id is the node's refusal as a JSON
error; at spirit.contact `search keep=true` answers its items; after 300 more lines the history holds 256, the newest last.

## The wait (goal/G48.6)

The box: an array of wait events in spirit/state/console/node.json, with `wait`, `wait add <event-description>` and `wait
remove <event-description-string>`; wait reads node.db's log through its one reader, trafficLog's arrivals, which hands
delivered inbound rows only; a listener's bundle is matched entry by entry; `wait add api=<branch>.<verb> <field>=<value>`;
the first wait starts at the newest row, and a wake reads every row past the pointer once; a match prints one JSON line per
row with its wait-row and ends 0, a timeout prints that nothing came and ends with a code of its own, no wait-row configured
is refused and ends 1; one wait at a time; `wait list`; `wait timeout <seconds>`.

What arrives is written into the scratch node's log by the log's own writer (trafficLog's note), each payload an envelope made
by the node's packet encoder, as a peer's call lands. The branch is a made-up zzwait; no app of the tree is named.

- `wait` with no wait-row is refused and ends 1, and not as an unknown command;
- `wait add api=zzwait.ping x=1` is then shown by `wait list`;
- with `wait timeout 3`, a match that came before the first wait does not wake it, and it times out after about 3 s with a
  code that is neither 0 nor 1, printing something;
- a delivered `zzwait.ping {x: 1}` arriving while it waits wakes it: a JSON line naming `api=zzwait.ping x=1`, and it ends 0;
- the row one wait read does not wake the next; `x: 2` does not wake it; an outgoing `zzwait.ping {x: 1}` does not wake it;
- a match that came while no wait ran wakes the next wait;
- `api=zzwait.listener by=andy` wakes on a listener bundle holding an entry by andy, and not on one whose entries are all by bob;
- a second wait while one runs is refused and ends 1, not as an unknown command, and the first ends by its timeout;
- `wait remove api=zzwait.ping x=1` takes it out of `wait list`, and the other stays.

## The console fixed (goal/G48.8)

wsl's three, and Andy: *"cw, fix the console. push it"*; then cw's own fix of the wait's state (200159f0):

- `api` at spirit.app.desk prints the verbs the console offers there (its verbsAt), sorted; which verbs those are, for
  every app, is spirit/test/app-child-general.js's rule 8 (Andy: *"let the verb list be checked by a general test like
  app-child-general"*);
- a double quote typed `\"` inside a quoted value arrives as one: `setDescription description="a \"quoted\" word"`;
- at spirit.app, `active key=icons active=true` answers ok, through the function the branch's api.js names for it;
- a wait-row added while a wait runs, with a row arriving meanwhile, is still in `wait list` once that wait has ended.

All four were red on command.js before the fixes (0cb8dbfb~1).
