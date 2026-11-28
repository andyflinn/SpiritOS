# spirit/peer/script.js — its own test

The peer family: packets to peers, and acquiring one. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports`, and on a page `window.spirit.requireScript`, which it asks for its companion `spirit/peer/client/script.js` and nothing else: goal/G47.1, Andy's rule *"every api.js requires it's companion data.js, and is the only script to require that data.js"*), every call checked by spirit.js's own check (`spirit.checkArgs`, its rules `spirit.ruleNames`).
The table the node mounts for the family is the one the branch's node work, `spirit/peer/server/script.js`, hands it (`verbs(node)`; goal/G49.25: the branches load themselves, where `spirit/server/node/script.js` held `loopbackVerbs.mount('peer', ...)`).

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs the branch's node work, spirit/peer/server/script.js, hands the node for the family, and each verb exactly the arguments its handler's `request` carries.
- `post` names the peer by its key and carries JSON text (spirit.type.string.json, goal/G48.4); `via`, `patienceMs` and `kind` may be left out.
- `acquire` names the key, with a label and an address it may be given.
- **goal/G40.11**: `acquire` takes no `via` (*"how a key arrived went with acquiredVia; acquiring keeps the row."*).

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `via` coming back on `acquire`.
