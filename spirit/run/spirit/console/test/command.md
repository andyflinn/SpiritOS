# spirit/console/command.js

The console's command processor (goal/G48.2, the box: *"the script run://spirit/console/command.js will be the consoles
command processor."*). It is reached through the console's one door, `node spirit/console.js <words>`. Its test:
`./command.js`.

## What it does

- Keeps the console's state in `spirit/state/console/node.json`: the current navigation path (`{ "path": "app.desk" }`, the
  root an empty path) and a 256 rolling command history, every command logged as if typed from the root prompt `spirit: `.
- `path` without argument shows the path stored in state.
- `path <name>` or `path <dot.sequence>` counts from the path in state; a path that is no folder under `spirit/` is refused
  with an error, and the path stays.
- `path <` goes to the parent, `path <<` to the root; at the root both are refused with an error.
- An error is printed as `JSON.stringify(error, null, 2)` (box v12: *"errors are return in JSON.stringify(error,null,2)
  format."*).

## What its test judges

On a scratch node of its own, one command at a time through `spirit/console.js`, the state file read where the box puts it:
`path app` stores app and logs `path app`; `path` shows app and leaves it; `path agent` stores app.agent and logs
`path app.agent`; `path nope` refused, the path kept; `path <` back to app; `path app.agent` at app refused (app.app.agent);
`path <<` to the root; `path app.agent` at the root stores app.agent; `path <<` straight back; `path <` and `path <<` at the
root refused, the path kept; every refusal printed as one JSON object, as `JSON.stringify(error, null, 2)` prints it; after 300 more lines the history holds 256, the newest last.
