# AGENT.md — SpiritOS, every agent

Read this before you touch the tree. `CLAUDE.md` and `GROK.md` only add how that agent delivers work. Product rules live here.

Public face of this project: [andyflinn.com](https://andyflinn.com). Andy Flinn is the one operator.

## What this system is

- A **personal node** is loopback HTTP on `:65432`. The browser never talks to the public net.
- A **public relay** (`--relay`) is a mailbox. On spirit-3 that is Caddy `:443` → Node `:65430`. The name is `https://spirit.andyflinn.com`.
- Personal → public is always **HTTPS**. Public Node is never advertised on 65430.
- labMaster and extra Node processes belong on a **laptop**. Never on the 1 GB public box.

## Host

- One operator. **root is spirit.** Clone stays `/root/SpiritOS`.
- No `User=spirit`, no `/opt` migration, no second Unix identity for the same person.
- See `bash/ONE-OPERATOR.md`. `hostHardening.js` asserts this. Do not re-open it as a finding.

## Git

- Work on **`master` only.** No feature branches, no PRs “to be safe,” no “I’ll land this on a side branch.”
- Commit when Andy asks, or when the sitting’s verdict was “apply this fix.” Do not commit a second product cut in the same breath.
- This overrides any default of branching before touching the default branch.

## Identity vs perception

- **Identity** = Ed25519 keypair on the personal node (`relay-state/identity.json`). Private key never leaves the box.
- **Perception** = captions. Public label on the mailbox; private `myLabel` + route list in `whoBook` (`relay-state/who.json`). That file is never uploaded.
- After handshake the **wire should use keys**. Labels may collide. Two johns are two keys.
- Today’s live Kamatera mailbox is still **names-mode**. Do not cut `relay-state/` there unless Andy says so.

## First owner, keys mode, invites

- Fresh relay: `node install-public-relay.js <name>` writes `pending-owner.json`. Only that name may take first claim, and only with a key.
- First successful signed claim writes `allow.json` keys and deletes pending. That key is owner.
- Reserved name `relay` cannot be claimed. `GET /api/relay/status` is owner-sig only. Send-to-`relay` is accepted; the **census reply is owner-only**.
- After owner exists, **extra signed keys may claim**. That is bones so two johns work. “Later names need the owner” = **`invites.json`, not implemented.** Do not slam keys-mode shut to “fix” 0003.
- Acquisition is invites + a zip, not SSH-editing `allow.json`.

## Gates that must stay

- Inbox is signed (`checkInbox` / `checkInboxKey`). Anonymous `?name=` is 403.
- `send(..., clientKey)` rate-limits on the **socket**, then sweeps buckets.
- Behind Caddy, `remoteAddress` is `127.0.0.1` for everyone. Do not invent `X-Forwarded-For` trust unless asked, and then only when the peer is loopback.

## What you do not do unless asked

- labMaster on spirit-3
- Pretty Relay Chat chrome (title bar, dropdown) before the wire is keys + invites
- Human-gate sidecars (`:65421`, “click OK on another port”)
- Rewriting all of `server.js` when four functions would do
- Moving the clone, creating a `spirit` user, or “hardening” past ONE-OPERATOR.md
- Running invite mint or `install-public-relay.js` against the live Kamatera mailbox

## Split of labour

- **Claude** — in-checkout on the **work box**: review → Andy’s verdict → in-file fix → comment foreign decisions → run the harness there. Design suggestions yes; implement only when told. No shell on spirit-3.
- **Grok** — outside the checkout: bones, host scripts, file drops with repo-shaped paths. Reads *pasted* VPS and PowerShell. No TTY on the work box and none on spirit-3 unless Andy pastes output.
- **Andy** — commits when he wants a second pair of eyes off the loop, SSH to spirit-3, Kamatera cutover.

## How work lands

- Prefer **full replacement files**, not “change line 40” — except Claude, whose job is in-file patches in the checkout.
- Name the **repo path** next to every drop (`spirit/run/js/relay.js`).
- After a review, send a short verdict. Do not open a second product cut in the same commit as a gate restore.

## Tests that matter right now

```
node spirit/test/firstOwner.js
node spirit/test/identityPerception.js
node spirit/test/hostHardening.js
```

Plus `relayGates.js` on master. Green means stop.
