# lab-keeper — a second principal, and why it is not in TEMP

**Standing 2026-09-15.** A persistent personal node at
`C:\Users\Andre\OneDrive\repo\lab\SpiritOS`, owning the public relay at
`lab.andyflinn.com`.

> **Andy:** "I wanted you to have a normal personal node on this machine
> at `C:\Users\Andre\OneDrive\repo\lab\` so that you can be an owner of a
> public relay for the time being. It's way more useful to the development
> process."

## What it is

| | |
|---|---|
| clone | `repo/lab/SpiritOS` — a real checkout of origin/master, updated with `git pull` |
| node | `spirit/run`, port **65433**, not a relay |
| identity | `lab-keeper`, key `…GMiQ4z4okiU=` |
| owns | `lab.andyflinn.com` (relay key `…mkQfJdPVY=`) |
| relays.json | lab first, spirit-3 second |

**It is deliberately not a labMaster node.** I argued once that labMaster
already covered this and was wrong: `jazz` and `rock` live in
`TEMP/spiritos-relay-fakes`, which is the directory Windows cleanup
trashes and which Andy has lost before. They are throwaway fixtures with
borrowed lives. This is a principal: durable identity, in OneDrive,
holding an owner seat that cannot be transferred if it is lost.

## What it is for

- **Owning a public relay that Andy does not own.** That is the only way
  partnership can be demonstrated at all — `setPartner` refuses the
  owner's own row, so a person who owns both boxes cannot partner them.
- **A real live environment to check against.** Two public relays, real
  TLS, real latency, two distinct owners — the multi-relay code paths
  (per-relay bindings, pinning, `mustPick`, owner-versus-member badge
  states) have never run against anything but one real relay and a
  loopback one.
- **Somewhere the agent can act as an owner** rather than reading about
  one.

## The window that was open

`bash/lab-install` stood the relay up, published it, and **never claimed
it** — for about forty minutes it was `open` mode on the public internet,
where decision 0003 gives it to whoever claims first. The hostname was not
secret either: Caddy's certificate publishes it to Certificate
Transparency the moment it is issued.

Found by Andy asking *"did you claim your relay as your own?"*, which is
the question the tooling should have asked itself.

`lab-install` now checks the owner seat after `tls` and says so loudly if
there is none. **It does not claim for you** — which identity owns a relay
is a decision, and a wrong one is permanent: there is no transfer verb,
and the only undo is wiping `relay-state/`, which destroys the relay's own
key and every pin made against it.

## Running it

```
cd repo/lab/SpiritOS/spirit/run
node js/server.js --port 65433
```

Update it like any clone: `git pull` in `repo/lab/SpiritOS`. Its identity,
session and relay list live in `spirit/run/relay-state/` and
`spirit/run/app/natter/`, none of which are tracked, so a pull never
touches them.

## Still to do

- **lab-keeper has no seat on spirit-3.** It needs one before spirit-3 can
  partner with it: a partner is *a non-owner peer here who owns a relay
  elsewhere*, so Andy must invite `lab-keeper` onto spirit-3 first. Until
  then the partnership is half-buildable — lab can partner with andyflinn
  (who does hold a seat there), but not the other way round.
- Nothing runs it automatically. It is started by hand.
