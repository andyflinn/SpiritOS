# spirit/app/backup/api.js — its own test

The backup server's family interface (goal/G32.3), where `spirit.familyPath('backup')` finds it (goal/G41.12). Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). Required as the node reads it; its
verb is judged by `spirit.check`.

- `spirit.familyPath('backup')` is this file.
- It exports `{ verbs }` and nothing else: it names no family of its own.
- Its one verb is `status.get`, and it is the one verb backup.js serves (*"A verb added to the server is added here, in
  the same commit."*).
- `status.get {}` takes nothing (*"The last check, copy and error; it takes nothing."*): any argument is refused.

## What its test must try to break

A verb listed that backup.js does not serve, or served and not listed; an argument status.get lets through.
