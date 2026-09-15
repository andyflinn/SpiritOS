# relayLab/ — portable relay lab (Node)

Not `bash/`. Not labMaster.

| Folder | What | Where it runs |
|---|---|---|
| `bash/` | `*.sh` host verbs | spirit-3 only, after SSH |
| `relayLab/` | `*.js` + tickets | Windows work machine **and** spirit-3 (`node` is on both) |
| `spirit/test/labMaster/` | multi-node lab | laptop only |

## Run

```
node relayLab/probe.js                              # one relay, up close
node relayLab/probe.js https://lab.andyflinn.com
node relayLab/hostCheck.js                          # is this box still TWO relays?
```

Windows: `node relayLab\probe.js` from the clone root.

`hostCheck` is the one to reach for after anything touches the host. It reads
both clones' `.env`, then asks whether the unit, port, domain, cron line and
**Ed25519 identity** of each are actually distinct — and whether each is
running the commit origin is on. Reads only; needs no key; exits non-zero on a
problem, so it can be scheduled.

On spirit-3 it checks everything. On the work machine the systemd, cron and
Caddy sections skip with a note and the TLS section still runs against both
public names — which is the half that catches the failure that costs something.

It exists because six faults of one shape surfaced in the two days after a
second relay appeared on the box: every one silent, every one fine with a
single clone, every one failing *toward* the live relay. The arrangement has
more ways to collapse into one relay than anyone will hold in their head.

## Inbox

Agents drop work for you in `relayLab/open/`.  
You move a finished ticket to `relayLab/done/`.  
Shape: copy `TEMPLATE.md`. Name: `YYYY-MM-DD-short-kebab.md`.

Same rules as before: one sitting, no secrets, no `relay-state/`, no second Node on the public box, commit on `master`.
