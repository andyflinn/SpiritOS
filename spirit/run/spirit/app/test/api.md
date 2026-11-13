# spirit/app/api.js — its own test

The app family on the spirit object (goal/G43.2): the node's apps, every verb the node mounts for the family, each
argument with its rule, and the page's function that implements each verb (goal/G43.7). Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). Required as the node reads it; each verb's arguments are
judged by `spirit.check`, the check the spirit object runs before a call leaves.

- It exports `{ verbs, functions }` and nothing else: it names no family of its own (the node maps it, goal/G32.3).
- Every rule is one of `spirit.rules`.
- Its verbs are `search`, `active`, `label`, `icon`, each one the node mounts for the app family (server.js), with the
  same arguments, and the node mounts no verb it does not list.
- `search { q? }`: a search string and nothing else (Andy: *"it's minimum, no filters, just a search string."*).
- `active { key, active }`: active a boolean, both required (goal/G43.9, Andy's yes on Q1).
- `label { key, label }`, `icon { key, icon }`: texts, required (Q4, Andy: *"yes."*).
- `functions` maps each verb to its own function, `searchApp`, `activeApp`, `labelApp`, `iconApp`; none is named as a
  verb (Andy: *"spirit.app.searchApp() which IMPLEMENTS the verb search, but isn't the verb itself."*).

## What its test must try to break

A filter added to search; active taking a text; a verb listed that the node does not mount, or mounted and not
listed; a function named as its verb, or a verb with no function.
