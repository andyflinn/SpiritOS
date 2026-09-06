# relayLab/ — portable relay lab (Node)

Not `bash/`. Not labMaster.

| Folder | What | Where it runs |
|---|---|---|
| `bash/` | `*.sh` host verbs | spirit-3 only, after SSH |
| `relayLab/` | `*.js` + tickets | Windows work machine **and** spirit-3 (`node` is on both) |
| `spirit/test/labMaster/` | multi-node lab | laptop only |

## Run

```
node relayLab/probe.js
node relayLab/probe.js https://spirit.andyflinn.com
```

Windows: `node relayLab\probe.js` from the clone root.

## Inbox

Agents drop work for you in `relayLab/open/`.  
You move a finished ticket to `relayLab/done/`.  
Shape: copy `TEMPLATE.md`. Name: `YYYY-MM-DD-short-kebab.md`.

Same rules as before: one sitting, no secrets, no `relay-state/`, no second Node on the public box, commit on `master`.
