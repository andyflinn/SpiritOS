# spirit/auth/api.js — its own test

The auth family: who may call what on this node, the grants, and the node's bundles and branches. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('auth', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs server.js mounts for the family, and each verb exactly the arguments its handler's `request` carries.
- `query`, `grant`, `revoke` and `peer` name the peer by its public key; `relabel` takes a label the name rule passes;
  `search`'s text is optional.
- **goal/G41.14**: `bundle` and `branch` are one flat verb per table, `op` needed (`add`, `set`, `delete`, `get`,
  `search`), the rest left to the node per op (apiAuth.js); a bundle and a branch are named by a number.
- **goal/G41.25** (Andy, box: *"changes to the auth.bundle verb for the addition of the \"owner\" field are approved by
  andy and need no review."*): `bundle` takes an `owner`, any text, since one not valid the node reads as "node".

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `bundle` losing its owner, or its owner narrowed to a rule that refuses what the node reads as "node".
