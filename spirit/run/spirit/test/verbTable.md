# spirit/verbTable.js — its own test

`createVerbTable()`: what the loopback client door can be asked, and who answers it. Owed since the rule *"every
production script has its own test"* (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 7). Each test makes a
table of its own, in process.

- `claim`: a namespace and its verbs, each answered by its handler; a namespace claimed twice refused, naming its owner;
  a verb outside the namespace refused; a claim must say `wire`; a bad namespace, a malformed verb and a verb that is no
  function each refused; a claim refused claims no namespace.
- `verbs` sorted; `handlerFor` null for an unanswered verb and for inherited names (`toString`, `constructor`);
  `needsWire` what the namespace claimed, null unclaimed; `namespaces` each owner, sorted, with its wire.
- `mount`: declarations of request, reply and handler, shown by `tree`; one missing any of the three refused.
- `call`: the handler's status and body; no-such-verb; a throwing handler, or one whose promise fails, handler-failed.
- `door`: its api is the app servers' tree with the table's own families in it; a verb nobody answers, no-such-verb.

## What its test must try to break

Last-wins on a second claim; a module answering in another's namespace; a claim without its wire; a handler found by an
inherited property name; a failing handler that hangs the caller instead of answering handler-failed.
