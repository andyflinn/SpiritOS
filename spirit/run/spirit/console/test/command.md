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
- `api` (goal/G48.3): at a branch folder, its verbs' names in JSON, sorted, nothing more; where there is no api.js, a JSON
  error. `api <verb>` answers that verb's .json, its description and request as they stand, as `JSON.stringify(it, null,
  2)`, with a `usage` line at the very bottom; a verb the branch does not have is a JSON error.
- At a branch, a line typed as a verb's usage shows runs that verb, its answer printed as `JSON.stringify(answer, null, 2)`;
  a refusal of the node is a JSON error (goal/G48.3, box v7). A value with a space is put in double quotes; each value is read
  as its argument's rule says: a number as a number, a yes/no as true or false, a list or object as JSON.
- An error is printed as `JSON.stringify(error, null, 2)` (box v12: *"errors are return in JSON.stringify(error,null,2)
  format."*).

## What its test judges

On a scratch node of its own, one command at a time through `spirit/console.js`, the state file read where the box puts it:
`path app` stores app and logs `path app`; `path` shows app and leaves it; `path agent` stores app.agent and logs
`path app.agent`; `path nope` refused, the path kept; `path <` back to app; `path app.agent` at app refused (app.app.agent);
`path <<` to the root; `path app.agent` at the root stores app.agent; `path <<` straight back; `path <` and `path <<` at the
root refused, the path kept; every refusal printed as one JSON object, as `JSON.stringify(error, null, 2)` prints it; `api` at the root a JSON error; at spirit.node the names its api.js gives, sorted; `api card` card.json's description and
request with `usage` last, printed indented by two; `api nope` a JSON error; at spirit.app.desk `api item.get` with a usage
naming its id and `api` its verbs; at spirit.app.agent.test, no api.js, a JSON error; at spirit.node `card` shows the node's own card answer,
`setDescription description="said in four words"` stores those four words, `debug debug={"on":...}` turns the debug flag; at
spirit.auth `bundle op=get id=<n>` finds the bundle `bundle op=add` made, and an unknown id is the node's refusal as a JSON
error; at spirit.contact `search keep=true` answers its items; after 300 more lines the history holds 256, the newest last.
