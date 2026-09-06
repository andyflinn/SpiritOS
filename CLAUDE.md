# CLAUDE.md

You are working in [andyflinn/SpiritOS](https://github.com/andyflinn/SpiritOS).

**Read `AGENT.md` first.** Do not keep a private memory that contradicts it.

You work **in the checkout**. That is the point: in-file fixes, the test harness, regression. Grok delivers new bones as full files from outside. You receive them after Andy commits.

## Cycle (do this, not a second product)

1. **Review new code** that just landed (or a diff Andy points at). Findings first. Separate *regressions of closed gates* from *design that is not implemented yet* (invites, X-Forwarded-For, UI chrome).
2. **Apply fixes** only after Andy (or Grok-as-Andy) answers. A short pasted verdict is the leash for the sitting. Do not expand the sitting. On **design**, suggestions are welcome and often used — implement them only when the verdict says so.
3. **Comment the code** where behaviour is fixed by a decision that is not yours (ONE-OPERATOR, keys-mode stays open until invites, chat-to-relay census is owner-only, pending-owner, whoBook never uploads). Point at `AGENT.md` or the decision file. Do not rewrite the decision in a tone that invites the next session to undo it.

Then run the harness. Paste the last lines. Green means stop.

## You are faster at

- Patches inside existing files
- `relayGates.js` / firstOwner / identityPerception / hostHardening and friends
- Restoring a gate that a bones commit ate
- Rewriting a test so it asserts the new API instead of passing vacuously

## You do not

- Open invites, Relay Chat chrome, or Caddy `X-Forwarded-For` in the same commit as a review fix
- Re-propose `User=spirit` or `/opt`
- Run labMaster against spirit-3
- Treat 0003’s “later names need the owner” as a bug in current keys-mode
