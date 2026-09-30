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
node relayLab/probe.js https://spirit.andyflinn.com
node relayLab/hostCheck.js                          # the relay clone(s) on this box
```

Windows: `node relayLab\probe.js` from the clone root.

`hostCheck` is the one to reach for after anything touches the host. It reads
each clone's `.env`, then checks its unit, cron line, Caddy site, **Ed25519
identity** and whether it runs the commit origin is on. Reads only; needs no
key; exits non-zero on a problem, so it can be scheduled.

On spirit-3 it checks everything. Elsewhere the systemd, cron and Caddy
sections skip with a note and the TLS section still runs.

## Inbox

Agents drop work for you in `relayLab/open/`.  
You move a finished ticket to `relayLab/done/`.  
Shape: copy `TEMPLATE.md`. Name: `YYYY-MM-DD-short-kebab.md`.

Same rules as before: one sitting, no secrets, no `relay-state/`, no second Node on the public box, commit on `master`.
