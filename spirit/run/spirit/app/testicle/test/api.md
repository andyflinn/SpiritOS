# spirit/app/testicle/api.js — its own test

The testicle server's family interface (goal/G32.3), where `spirit.familyPath('testicle')` finds it: every verb it
serves, each argument with its rule. Owed since the rule *"every production script has its own test"* (goal/G47.1, box
v72). Required as the node reads it; each verb's arguments are judged by `spirit.check`.

- `spirit.familyPath('testicle')` is this file; it exports `{ verbs }` and nothing else; every rule is one of
  `spirit.rules`.
- Its verbs are `busy`, `preferences`, `script.get`, `script.classify`, `suite.search`, `testicle.set`, `testicle.search`, `red`, `run`, `subscribe`,
  `unsubscribe`. Each is a handler of testicle.js, or, for subscribe and unsubscribe, of appServer's streamPublisher,
  which testicle.js asks for by its `publisher`; testicle.js serves no verb it does not list (*"a verb added to the
  server is added here, in the same commit"*).
- `busy {}` and `red {}` take nothing (goal/G47.1, the box).
- `script.get { name }`, required.
- `suite.search { script?, text }`.
- `testicle.set { script, suite, test, verified, severity }`: one test's result by itself, all required, verified a
  boolean, severity a number; a list of results is refused (goal/G47.1, the test-table cycle: "no bundling").
- `testicle.search { script?, suite?, test?, result?, from?, text }`, from a number.
- `run { script, suite, testicle? }` (goal/G47.1, the run cycle).
- `subscribe { family, run?, since? }`, family a non-empty id; `unsubscribe {}` (Andy, goal/G43.32: *"for now, it needs
  to declare them in api.js"*).

## What its test must try to break

A verb served and not listed, or listed and not served; testicle.set letting a field go missing, a severity as text,
or a bundle of tests; run without its suite; an argument busy or red lets through.
