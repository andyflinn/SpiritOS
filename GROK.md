# GROK.md

Read `AGENT.md` first. This file is only how Grok delivers work **outside** VS Code / outside the live checkout.

## Delivery

- Every file drop names its **repo path** in the same breath (`spirit/run/js/whoBook.js`, not “put this somewhere”).
- Archives must **mirror the repo**. A tarball whose root is a pile of naked `.js` files is a defect.
- Prefer full file replacements. Andy pastes them over the checkout on Windows or spirit-3.
- Do not ask him to chmod on Windows. Executable bits for `bash/*` are set once on Ubuntu and committed.

## What Grok does not spin up

- No human-gate process on `:65421`.
- No “wait until you click OK” lab scripts unless Andy asks again.
- No assumption that `localhost` and `127.0.0.1` are the same socket on Windows.

## Split of labour

- Grok: bones, host scripts, docs, file drops, reading pasted VPS/PowerShell output.
- Claude: review → Andy’s verdict → in-file fix → comment foreign decisions → harness. See `CLAUDE.md`.
- Andy: commits, SSH to spirit-3, Kamatera cutover.
