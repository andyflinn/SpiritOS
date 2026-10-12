# The face on spirit-3: `*.face.spirit.andyflinn.com`

What this sets up is step 1 of G17 (Andy, 2026-09-27: *"build and prove the
route from browser to owner-of-subdomain, and back"*). The design is
`design/shell/PUBLIC-APP-SERVER.md`, G17, *THE ROUTE*, and the step-by-step
map is `design/shell/FACE-ROUND-TRIP.md`.

```
browser ─https─ Caddy (on-demand cert) ─ face node :65434 (its appFaceApp process)
        ─api ask via the relay─ YOUR node (appFaceApp asks grantFace; appFaceAppServer answers) ─ back the same way
```

When it works, a json ask to `https://join.face.spirit.andyflinn.com/api/spirit`
is answered by your node's appFaceAppServer, naming itself and the verb. That
is the proof that the route reached your node and came back. (`GET /` is the
face's own page, served by the face node itself: it proves Caddy and the face,
not the route.)

## What is on this box afterwards

- **the relay:** `/root/SpiritOS`, `spirit-relay`, on 127.0.0.1:65430, unchanged;
- **the face node:** `/root/face/SpiritOS`, `spirit-face`:
  - its door on 127.0.0.1:65433;
  - its face, the appFaceApp process, on 127.0.0.1:65434 (the port in its `face.json`);
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

It writes the face node's `owner.json` (your key as its owner) and the
face server's own `face.json` (the port, in
`relay-state/process/appFaceApp/`, where the appFaceApp process reads it;
the node itself opens no door for visitors), lists `process/js/appFaceApp`
so the node starts it, installs and starts `spirit-face`, mints a one-day invite labelled
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
- list the three processes your node runs for the face, and it starts each at once:
  `{"verb":"config.setModules","path":"process/js/grantFace","on":true}`, then the
  same for `process/js/appFaceApp` and `process/js/appFaceAppServer`;
- write the face domain into appFaceApp's state folder, which your node made
  when it started it. By hand, in your clone: `fs.save` writes nothing under
  `relay-state`.
  `spirit/run/relay-state/process/appFaceApp/face-domain.json`:
  `{ "faceDomain": "face.spirit.andyflinn.com" }`. It is read on every ask, so
  no restart;
- let the face node ask your appFaceApp (route and serve come in through the
  api door, and denial is the absence of a grant):
  `{"verb":"jobs.authGrant","key":"<FACE_NODE_KEY>","path":"appFaceApp"}`;
- grant `join` to your own node's key:
  `{"verb":"jobs.api","ask":{"grantFace":{"grant":{"name":"join","id":"<YOUR_NODE_KEY>"}}}}`.

grantFace refuses a name another key holds (409 `slot-held`) and changes nothing.

**5. Test**, from anywhere:

```
curl -sS -H 'Content-Type: application/json' -d '{"verb":"app.state"}' https://join.face.spirit.andyflinn.com/api/spirit
```

The first visit takes a few seconds, while Caddy asks the face node about
`join` and fetches its certificate. Expected:
`{"ok":true,"app":"appFaceAppServer","verb":"app.state","host":"join.face.spirit.andyflinn.com"}`.
A name you never granted gets no certificate at all.

## What each failure means

| you see | it means |
|---|---|
| a TLS error | Caddy was refused a certificate. The face node said the name is not granted (grantFace, face-domain.json, or your node did not answer), or the global `on_demand_tls` block is missing. |
| `404 no-such-route`, `why: owner-unreachable` | your node refused the face node's ask, or it never reached it: the face node is not a member of the relay, your node has not accepted its key, or its key has no `appFaceApp` grant (step 4). |
| `404 no-such-route`, `why: owner-did-not-answer` | the ask went, and no answer came back in time. Your node may be off. |
| `404 no-such-route`, `why: not-granted` | your node answered, and has no grant row for that name. |
| `503 app-not-running` | your node's appFaceAppServer is not running: list `process/js/appFaceAppServer` (step 4). |
| `{"ok":true,"app":"appFaceAppServer",...}` | **the route works**: browser, face, your node, and back. |

## Updating

`face-install` is idempotent. Run `/root/face/SpiritOS/bash/face-install
<YOUR_NODE_KEY>` again after a push (it mints nothing once the face node
holds a seat): it pulls
`/root/face/SpiritOS`, restarts `spirit-face`, and if the installer itself
changed, it reruns as the new one.
