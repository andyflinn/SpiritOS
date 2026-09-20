# GROK.md

Read `AGENT.md` first. This file is only how Grok delivers work **outside** VS Code / outside the live checkout.

**It answers "how Grok delivers", and nothing else.** What is true about the system is in `AGENT.md`, how we work — including what happens to a review — in `ANDYS_RULES_FOR_AGENTS.md`, how Andy says it in `DICTIONARY.md`. This file overrides none of them; it goes stale when Grok's role changes.

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

## What Grok delivers

Grok holds the **in-review** position (`AGENT.md`, Split of labour): bones, host scripts, docs, file drops, and reading pasted VPS/PowerShell output — in batches at checkpoints.

What happens to a review once it arrives — the triage, the two-to-four rounds, and that a finding is input while Andy decides — is in `ANDYS_RULES_FOR_AGENTS.md` and not repeated here. The full split of the positions is in `AGENT.md`.
