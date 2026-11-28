# spirit/job/script.js — its own test

The job family: the node's jobs and the servers it runs. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports`, and on a page `window.spirit.requireScript`, which it asks for its companion `spirit/job/client/script.js` and nothing else: goal/G47.1, Andy's rule *"every api.js requires it's companion data.js, and is the only script to require that data.js"*), every call checked by spirit.js's own check (`spirit.checkArgs`, its rules `spirit.ruleNames`).
The table the node mounts is the one server's own (goal/G49.25, box v10: *"serveCommon will load the spirit.fs branch explicitly, then load all trunk branches, using the fs-cache"*): `spirit/server/script.js`'s `loadFs` and `loadBranches`, run as the node boots through them, what they mount under `spirit.job` and hand its check caught, and the node's own `loadBranches` call and its check, `checkedVerbs`, read from the server's text.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs the one server mounts for the branch it finds in the fs cache; each verb's arguments are this script's own, handed to the
  node's check, which sets each verb's request to them and checks every call against them before its handler (goal/G49.15, box v23).
- `search`'s q is optional; `get`, `cancel` and `delete` name the job, never by an empty name.
- `create` needs a command; its `args` are a JSON list in a string (goal/G48.4, Q6), its `type` a text, both optional.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `args` taking a text.
