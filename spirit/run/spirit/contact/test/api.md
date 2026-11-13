# spirit/contact/api.js — its own test

The contact family: the node's book of peers, people and relays in one table. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('contact', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs server.js mounts for the family, and each verb exactly the arguments its handler's `request` carries.
- **goal/G40.11**, the one table: `search` takes a yes-filter per flag, `keep`, `mine`, `relay`, `seated` and
  `blocked` (`''` or `'yes'`, never `true`).
- `get` names the contact by its key; `block`, `unblock`, `accept`, `label` and `forget` by its `publicKey`;
  `label`'s `myLabel` is needed and passes the name rule.
- **goal/G41.30** (Andy: *"this button will put the star on relays and puppets. AND take it away."*, *"this is a yes."*):
  `own` takes a key and `true` or `false`.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- A flag that takes `true`, or `own` taking a flag instead of true or false.
