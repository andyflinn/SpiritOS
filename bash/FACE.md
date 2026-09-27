# The face on spirit-3: `*.face.spirit.andyflinn.com`

What this sets up is step 1 of G17 (Andy, 2026-09-27: *"build and prove the
route from browser to owner-of-subdomain, and back"*). The design is
`design/shell/PUBLIC-APP-SERVER.md`, G17, *THE ROUTE*, and the step-by-step
map is `design/shell/FACE-ROUND-TRIP.md`.

```
browser ─https─ Caddy (on-demand cert) ─ face node :65434 (puppetPost → appFaceApp)
        ─packet via the relay─ YOUR node (appFaceApp: grants.json) ─ answer ─ back the same way
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
  - owned by your node through `relay-state/puppet.json`;
- **Caddy:** `/etc/caddy/sites/face.spirit.andyflinn.com.caddy`, plus one global block you add by hand.

Nothing else. `status` in each clone reports its own unit.

## Once, in this order

**1. On your node:** mint an invite for `face` on your relay (Natter, the
relay's panel, as for any member), and copy your node's public key
(`MCow...`).

**2. On spirit-3**, as root, from anywhere:

```
/root/SpiritOS/bash/face-install <YOUR_NODE_KEY> <INVITE>
```

It clones `/root/face/SpiritOS`, writes the face node's `face.json` and
`puppet.json`, installs and starts `spirit-face`, joins the relay with the
invite, and accepts your node as its contact. Its last lines print **the face
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
`systemctl reload caddy`, and `/root/SpiritOS/bash/face-tls`.

**4. On your node:**
- **Accept the face node's key as a contact**, the one step 2 printed. Your
  node has to let it in, or its questions never reach appFaceApp.
- **Put two files in your node's `spirit/run/app/appFaceApp/`:**
  - `face-domain.json`: `{ "faceDomain": "face.spirit.andyflinn.com" }`
  - `grants.json`, the name `join` given to your own node, merged with any
    names already in it: `{ "names": { "join": { "to": "<YOUR_NODE_KEY>" } } }`

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
| a TLS error | Caddy was refused a certificate. The face node said the name is not granted (grants.json, face-domain.json, or your node did not answer), or the global `on_demand_tls` block is missing. |
| `502 owner-unreachable` | the face node could not post to your node: it is not a member of the relay, or your node has not accepted its key. |
| `504 owner-did-not-answer` | the post went, and no answer came back in time. Your node may be off. |
| `404 no-such-route` | your node answered, and has no grant row for that name. |
| `501 last-leg-not-built` | **the route works**: browser, face, your node, and back. Step 2 is next. |

## Updating

`face-install` is idempotent. Run it again (without the invite) after a push,
and it pulls `/root/face/SpiritOS` and restarts `spirit-face`.
