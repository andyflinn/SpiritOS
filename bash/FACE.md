# The face on spirit-3: `*.face.spirit.andyflinn.com`

What this sets up is step 1 of G17 (Andy, 2026-09-27: *"build and prove the
route from browser to owner-of-subdomain, and back"*). The design is
`design/shell/PUBLIC-APP-SERVER.md`, G17, *THE ROUTE*, and the step-by-step
map is `design/shell/FACE-ROUND-TRIP.md`.

```
browser ─https─ Caddy (on-demand cert) ─ face node :65434 (puppetPost → appFaceApp)
        ─packet via the relay─ YOUR node (appFaceApp asks grantFace) ─ answer ─ back the same way
```

When it works, `https://join.face.spirit.andyflinn.com/` shows your node's
answer. Until the last leg is built (step 2), that answer is
`501 last-leg-not-built` with your node's key in it. That is the proof that
the route reached your node and came back.

## What is on this box afterwards

- **the relay:** `/root/SpiritOS`, `spirit-relay`, on 127.0.0.1:65430, unchanged;
- **the face node:** `/root/face/SpiritOS`, `spirit-face`:
  - its door on 127.0.0.1:65433;
  - its face (puppetPost) on 127.0.0.1:65434;
  - owned by your node through `relay-state/owner.json`;
- **Caddy:** `/etc/caddy/sites/face.spirit.andyflinn.com.caddy`, plus one global block you add by hand.

Nothing else. `status` in each clone reports its own unit.

## Once, in this order

**1. On your node:** copy your node's public key (`MCow...`). That is all:
the installer mints the face node's relay invite itself, on the box (your
*"the VPS creates an invite before installing appFaceApp puppet ... the
install of appFaceApp, then claims that invite"*).

**2. On spirit-3**, as root, from anywhere. The face node gets its own clone,
and its installer comes with it:

```
git clone https://github.com/andyflinn/SpiritOS.git /root/face/SpiritOS
/root/face/SpiritOS/bash/face-install <YOUR_NODE_KEY>
```

Not from `/root/SpiritOS`: the live relay's clone follows your **tags**, and
these scripts are not in a tag yet. Tagging would also restart the relay on
all of master, which is a separate decision.

It writes the face node's `face.json` and `owner.json` (your key as its
owner), installs and starts `spirit-face`, mints a one-day invite labelled
`face` on this box's relay and claims it, and accepts your node as its
contact. Its last lines print **the face
node's key**, and they may stop at *"no global on_demand_tls block"*. If they do,
step 3 is the fix.

**3. On spirit-3, only if face-tls asked for it:** put the global block it
printed at the very top of `/etc/caddy/Caddyfile`:

```
{
	on_demand_tls {
		ask http://127.0.0.1:65434/.well-known/spirit-name
	}
}
import sites/*.caddy
```

then `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`,
`systemctl reload caddy`, and `/root/face/SpiritOS/bash/face-tls`.

**4. On your own box**, where your node runs, with the face node's key that
step 2 printed. Each is one POST to your node's `/api/spirit` on
`http://127.0.0.1:65432`:

- let the face node in: `{"verb":"peer.acquire","publicKey":"<FACE_NODE_KEY>"}`,
  then `{"verb":"contact.accept","publicKey":"<FACE_NODE_KEY>"}`;
- write the face domain: `{"verb":"fs.save","path":"app/appFaceApp/face-domain.json","content":"{\"faceDomain\":\"face.spirit.andyflinn.com\"}
"}`;
- include `process/js/grantFace` in your node's list, then grant `join` to
  your own node's key: `{"verb":"jobs.api","ask":{"grantFace":{"grant":{"name":"join","id":"<YOUR_NODE_KEY>"}}}}`.

grantFace refuses a name another key holds (409 `slot-held`) and changes nothing.

**5. Test**, from anywhere:

```
curl -sS https://join.face.spirit.andyflinn.com/
```

The first visit takes a few seconds, while Caddy asks the face node about
`join` and fetches its certificate. Expected: a 501 naming `last-leg-not-built`
and your node's key. A name you never granted gets no certificate at all.

## What each failure means

| you see | it means |
|---|---|
| a TLS error | Caddy was refused a certificate. The face node said the name is not granted (grantFace, face-domain.json, or your node did not answer), or the global `on_demand_tls` block is missing. |
| `502 owner-unreachable` | the face node could not post to your node: it is not a member of the relay, or your node has not accepted its key. |
| `504 owner-did-not-answer` | the post went, and no answer came back in time. Your node may be off. |
| `404 no-such-route` | your node answered, and has no grant row for that name. |
| `501 last-leg-not-built` | **the route works**: browser, face, your node, and back. Step 2 is next. |

## Updating

`face-install` is idempotent. Run `/root/face/SpiritOS/bash/face-install
<YOUR_NODE_KEY>` again after a push (it mints nothing once the face node
holds a seat): it pulls
`/root/face/SpiritOS`, restarts `spirit-face`, and if the installer itself
changed, it reruns as the new one.
