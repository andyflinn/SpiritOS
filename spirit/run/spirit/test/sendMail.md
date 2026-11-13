# spirit/sendMail.js — its own test

The relay sends mail through a driver, never a vendor (goal/G30.2): `createSender(rootDir, { fetch })` reads
spirit/state/mail.json and loads the driver it names from sendMail/. Owed since the rule *"every production script has
its own test"* (goal/G47.1, box v72). Every mail.json is written in a scratch home; no mail leaves the machine (the
sender gets a planted fetch, and the platform fetch refuses anything past the loopback).

- No mail.json, one that is not JSON or not an object: null.
- A mail.json naming no driver sends no mail, whatever settings it holds: no fallback in core (decided by Andy).
- A driver with no file in sendMail/: null. The name must be a plain word, so a path, a dot, a slash, an upper first
  letter or a leading digit loads nothing outside sendMail/.
- Settings the driver will not take (mailgun with no key): null.
- A mail.json naming mailgun: `{ driver: 'mailgun', send }`, the name trimmed first; `send` goes through the driver on
  the fetch the caller handed, never the platform fetch; the answer holds no settings and no key.

## What its test must try to break

A default driver when none is named; a driver name that walks out of sendMail/; the caller's fetch dropped so a mail
goes out on the platform fetch; settings or the key handed back on the sender.

Not tried: a driver whose `create` throws, which would need a planted file in the production folder sendMail/.
