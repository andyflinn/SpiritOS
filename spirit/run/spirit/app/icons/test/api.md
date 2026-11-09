# spirit/app/icons/api.js, the icons branch's interface

Its test is `./api.js`. The box (goal/G43.19, v16), 7: *"api.js is the branch's interface, the verbs and arguments the node checks a call against and a page binds by, not the code that handles a call (Andy: "appClient does NOT route to api.js, that file has a different purpose")"*; Q5: *"api.js at the app's top with no api/ folder"*; 5: *"the api branch is icons"*.

A scratch node with Icons switched on, raw calls and a real Chrome on its face page. Whether a call started a run is read from the job `spirit.app.icons`, which names the pid of its last run; a call it allows is shown to change that pid first, so its standing still means no run.

## Requirements

- It names its verbs, each argument with a rule; it requires no code.
- `api {family: icons}` answers this file, word for word.
- A call it allows starts a run; a page binds `spirit.icons.<verb>` by it, which answers a search, and refuses an argument it does not name.

## What its test must try to break

- A verb it does not name, an argument it does not name, a glyph that is no text, keywords that are no list, an op that is no id: each refused, and no run of `icons.js` started for it (the node checks a call against it).
