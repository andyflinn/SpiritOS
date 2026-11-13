# spirit/owner/api.js — its own test

The owner family: the owner's boxes and his commands to his puppets (puppets/G4). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('owner', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs server.js mounts for the family, and each verb exactly the arguments its handler's `request` carries.
- `boxSearch`'s q is optional; `boxGet` names the box.
- `command` names the puppet by its key (`to`) and the command, its `body` an object that may be left out.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `to` taking what is no key.
