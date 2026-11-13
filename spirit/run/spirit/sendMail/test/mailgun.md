# spirit/sendMail/mailgun.js — its own test

A sendMail driver: Mailgun (goal/G30.2). `create(settings, fetch)` answers `{ send }` or null; `send` is one HTTPS post
per mail. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Every send goes to a
planted fetch; the settings and key are made up, and the platform fetch refuses anything past the loopback.

- `create`: null with no url, a url that is not https, no domain or no key; `{ send }` over good settings.
- `send`: one POST to `<url>/v3/<domain>/messages`, the url's trailing slash and the domain's case gone; HTTP basic,
  user `api` and the trimmed key; a form of `from` = `postmaster@<domain>`, `to`, `subject`, `text`, each empty when
  not given.
- Answers: `{ ok: true }` when taken; `{ ok: false, status, error: 'the mail service refused the mail' }` when refused
  (502 with no status); `{ ok: false, status: 502, error: 'the mail service did not answer' }` when the fetch rejects,
  never a throw.
- The key never leaves the module: not on the sender, nor in a success, a refusal or a failure (even when the failure's
  own error names it).

## What its test must try to break

An http url accepted; the key or its basic header in an answer or an error; a from that is not postmaster@<domain>; a
rejected fetch that throws instead of answering 502.
