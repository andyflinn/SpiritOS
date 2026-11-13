# spirit/config/api.js — its own test

The config family, kept empty for later use (goal/G30.20; Andy: *"keep the config family for later use."*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('config', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- **It declares no verb**, and the node mounts none for it.
- `searchModules` and `setModules` went with the include list they read and set (slim/G1.3, server.js).

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- A verb declared for it, or one of the two gone verbs coming back.
