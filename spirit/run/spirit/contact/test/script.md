# spirit/contact/script.js — its own test

The contact family: the node's book of peers, people and relays in one table. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports`, and on a page `window.spirit.requireScript`, which it asks for its companion `spirit/contact/client/script.js` and nothing else: goal/G47.1, Andy's rule *"every api.js requires it's companion data.js, and is the only script to require that data.js"*), every call checked by spirit.js's own check (`spirit.checkArgs`, its rules `spirit.ruleNames`).
The table the node mounts is the one server's own (goal/G49.25, box v10: *"serveCommon will load the spirit.fs branch explicitly, then load all trunk branches, using the fs-cache"*): `spirit/server/script.js`'s `loadFs` and `loadBranches`, run as the node boots through them, what they mount under `spirit.contact` and hand its check caught, and the node's own `loadBranches` call and its check, `checkedVerbs`, read from the server's text.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs the one server mounts for the branch it finds in the fs cache; each verb's arguments are this script's own, handed to the
  node's check, which sets each verb's request to them and checks every call against them before its handler (goal/G49.15, box v23).
- **goal/G40.11**, the one table: `search` takes a filter per flag, `keep`, `mine`, `relay`, `seated` and
  `blocked`, each true or false and never `'yes'` (goal/G48.4: *"\"flags\" must be booleans"*).
- `get` names the contact by its key; `block`, `unblock`, `accept`, `label` and `forget` by its `publicKey`;
  `label`'s `myLabel` is needed and passes the name rule.
- **goal/G47.4** (box v33: *"😏 is the row field faceable, set by the new verb contact.faceable {key, faceable}"*,
  *"contact.own goes"*; Andy: *"\"faceable\" will do what \"own\" use to do."*): `faceable` takes a key and `true` or
  `false`; `own` is gone.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- A flag that takes `true`, or `own` taking a flag instead of true or false.
