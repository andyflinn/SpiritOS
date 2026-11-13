# spirit/net/api.js — its own test

The net family: a fetch the node makes for the page. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The file is run as spirit.js runs the text `api {family}` answers (`loadInterface`: its text with
`module` and `exports` alone), every call checked by spirit.js's own check (`spirit.check`, its rules `spirit.rules`).
`server.js` is read as text only, for the table `loopbackVerbs.mount('net', ...)` mounts.

- It runs with nothing but `module` and `exports`, and exports its table of verbs and nothing else: it names
  no family of its own (goal/G32.3: the node maps it).
- Every argument's rule is one of spirit.js's standard rules, `?` optional.
- **"Every verb the node mounts for this family, each argument with its rule"** (its own header): it declares exactly
  the verbs server.js mounts for the family, and each verb exactly the arguments its handler's `request` carries.
- `fetch` takes an http or https address and nothing else (`file:///` refused); its `method`, `headers`, `body`
  and `timeoutMs` may be left out, each of its kind when given.

## What its test must try to break

- A verb mounted and not declared, or declared and not mounted; an argument the handler reads left out, or one it never
  reads added.
- A rule that is no standard rule, so every call of the verb is refused.
- A `require` or a global the node's `loadInterface` does not hand it.
- `url` loosened to a text, so the node fetches what is no web address.
