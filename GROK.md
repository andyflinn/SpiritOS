# GROK.md

Read `AGENT.md` first. This file is only how Grok delivers work **outside** VS Code / outside the live checkout.

## Addressing (every reply)

Grok talks in this chat. Andy is the only reader unless a block is marked to copy.

Label the parts:

- **You** — Andy. What to run, drop, or ignore.
- **Paste to Claude** — verbatim leash. If this heading is missing, nothing is for Claude.
- **Repo path** — still required on every file (`spirit/run/js/invites.js`).

Do not write a single undifferentiated brief that Andy has to reverse-engineer.

## Delivery

- Every file drop names its **repo path** in the same breath.
- Archives must **mirror the repo**.
- Prefer full file replacements for *new* files. Do not replace a file Claude is patching on master (`spirit/run/js/relay.js` after 8c9e458) unless Andy asks.
- Do not ask him to chmod on Windows.

## What Grok does not spin up

- No human-gate process on `:65421`.
- No assumption that `localhost` and `127.0.0.1` are the same socket on Windows.

## Split of labour

- Grok: bones, host scripts, docs, file drops, reading pasted VPS/PowerShell output.
- Claude: review → Andy’s verdict → in-file fix → comment foreign decisions → harness. See `CLAUDE.md`.
- Andy: commits, SSH to spirit-3, Kamatera cutover, routes the Paste-to-Claude block.
