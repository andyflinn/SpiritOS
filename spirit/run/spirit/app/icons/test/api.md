# spirit/app/icons/api.js, the icons branch's interface

Its test is `./api.js`. The box (goal/G43.19, v16), 7: *"api.js is the branch's interface, the verbs and arguments the node checks a call against and a page binds by, not the code that handles a call (Andy: "appClient does NOT route to api.js, that file has a different purpose")"*; Q5: *"api.js at the app's top with no api/ folder"*; 5: *"the api branch is icons"*.

Who checks a call is goal/G43.32's decided 9, which replaces the node in that 7: the app's run, `spirit/appServer.js` in front of `icons.js`, checks it, never the node. Andy: *"isolation, we don't want the NODE to run the validation"*, *"for one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js""*.

A scratch node with Icons switched on, raw calls and a real Chrome on its face page. Whether a call started a run is read from the job `spirit.app.icons`, which names the pid of its last run; a call it allows is shown to change that pid first, so a new pid means a run.

## Requirements

- It names its verbs, each argument with a rule; it requires no code.
- `api {family: icons}` answers this file, word for word.
- A call it allows starts a run; a page binds `spirit.icons.<verb>` by it, which answers a search, and refuses an argument it does not name.

## What its test must try to break

- A verb it does not name, an argument it does not name, a glyph that is no text, keywords that are no list, an op that is no id: each refused by a run of the app (a new pid), not by the node.
