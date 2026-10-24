# SpiritOS public relay — host scripts (`bash/`)

This is the operator manual for the **public mailbox** at
`https://spirit.andyflinn.com` (Kamatera VPS `194.37.81.237`, host
`spirit-3`).

Run these scripts **only on that box**, as root, from the clone:

```
ssh root@194.37.81.237
cd /root/SpiritOS
./bash/help
./bash/status
```

`./bash/help` prints `bash/README.md`. This file is the long version.

---

## What this machine is

A small VPS (~1 GB RAM). It is a **mailbox**, not a workstation.

It runs exactly two long-lived processes:

| Process | Port | Role |
|---|---|---|
| Caddy | 80, 443 | TLS, HTTP→HTTPS redirect, proxy |
| `node spirit/server.js --relay --port 65430` | 65430 | Mailbox only: the one door (`POST /api/relay/post`, `/reply`) and the members' stream. No brochure, no public key route, no `/api/version` (goal/G22.6) |

systemd unit: `spirit-relay.service`  
Working directory: `/root/SpiritOS/spirit/run`  
State that is **not** in git: `spirit/run/relay-state/` (`owner.json`, `relay.db`, `identity.json`).
`owner.json` comes from `install-units`, given `OWNER_KEY`.

---

## What this machine is not

Do **not** run on this box:

- labMaster (`http://127.0.0.1:65420`)
- a personal spirit (`node spirit/server.js` without `--relay`)
- Jobs, App Builder, LM Studio, the desktop shell
- extra Node processes “just to look”

`./bash/status` warns if port **65420** is listening. Kill that process.

labMaster lives on the coordinator laptop only.

---

## Memory on a relay box (goal/G40.4)

**Recommended: a 256 MB RAM limit (`ramLimitMB`) on a 1 GB VPS.** Andy,
2026-10-24: *"we stick with our own memory calculation, and document what
we know about the system overhead incurred, including the caddy's and we
recommend the 256MB figure for a 1GB RAM VPS."*

The limit is the relay's own calculation, not a measurement: what it holds
at rest (about 54 MB) plus 64 KB for each connection it admits, three
connections a member. At 256 MB that admits about 1,077 members.

Beside the relay, the box spends memory the relay does not count:

| Who | About, at a full 256 MB relay | Why |
|---|---|---|
| The system itself | 100 to 150 MB | the OS and its services on a small Linux VPS |
| Caddy | 100 to 200 MB | its own memory per connection, 30 to 60 KB each: the TLS state and a copy buffer for every connection it proxies |
| The kernel's socket buffers | tens of MB, more with slow clients | one buffer per socket, two per connection through Caddy (the internet side and the local hop); they grow when a client reads slowly |
| The relay | up to its service cap | see below |

These figures are typical values, not measured on our relays. Caddy's
memory and the socket buffers of its connections are charged to Caddy,
outside the relay's cap; only the box as a whole bounds them.

**The service cap is twice the limit.** systemd's `MemoryMax` for the
relay's unit is `2 × ramLimitMB` (512 MB at 256), because systemd counts
the socket buffers of the relay's own connections against it as well as
the relay's memory. Andy: *"the twice is safe. decision. period."*
`install-units` writes it, and the relay moves it itself, with
`systemctl set-property`, whenever its owner changes the limit.

**A raise is checked by its difference.** Raising a running relay from
256 to 512 MB passes when the 256 MB more fits in what the box has free,
less a 25 MB margin; the relay's own cap does not count against it. A
lowering always passes, and applies at the next start.

---

## Traffic plan (the thing these scripts implement)

```
browser  -- plain HTTP :65432 -->  personal spirit on the same machine
personal spirit  -- HTTPS :443 -->  Caddy at spirit.andyflinn.com
Caddy  -- HTTP 127.0.0.1:65430 -->  node --relay
```

- The companion UI never opens the public host.
- `relays.json` on a personal node must be `https://spirit.andyflinn.com`.
- `hub.js` on a personal node must use HTTPS and refuse a remote `http://` URL.
- Port **65430** is internal. ufw **denies** it from the internet.
- Port **80** exists only so Caddy can redirect and complete Let’s Encrypt http-01.

65430 is not the public port. **443 is.**

---

## Files in `bash/`

| Path | Mode in git | Purpose |
|---|---|---|
| `README.md` | 644 | Short map (`./bash/help`) |
| `RELAY-HOST.md` | 644 | This manual |
| `lib.sh` | 644 | Shared helpers (sourced, not executed) |
| `help` | 755 | Prints the short map |
| `status` | 755 | Read-only health report |
| `install-units` | 755 | Install `spirit-relay.service` |
| `start` `stop` `restart` | 755 | That unit only |
| `boot-on` `boot-off` | 755 | Enable / disable at boot |
| `update` | 755 | Fetch + hard reset to `origin/master`; restart only if SHA changed |
| `cron-install` `cron-remove` | 755 | 10-minute update cron |
| `firewall` | 755 | ufw: 22/80/443 allow, 65430 deny |
| `tls` | 755 | Install Caddy + write `sites/<domain>.caddy` (never the main file) |
| `http-to-https` | 755 | One-shot cutover (unit + firewall + tls + start) |
| `logs` | 755 | Last 100 lines of `spirit-relay` |
| `systemd/spirit-relay.service` | 644 | Unit template |
| `caddy/Caddyfile` | 644 | Template (`__DOMAIN__` → `__PORT__`) |

Scripts that mutate the box require **root**. `status` and `help` are safe to run any time.

---

## Commands in detail

### `./bash/status`

Prints:

- repo path, domain, intended Node port
- `git` HEAD vs `origin/master`
- systemd enabled / active
- listeners on 65430 / 80 / 443
- warning if **65420** is bound
- a signed card ask on the relay's one door over HTTPS, by
  `node bash/card-ask.js https://spirit.andyflinn.com` (its card, `relayPublicKey` in it)
- the same on loopback, `node bash/card-ask.js http://127.0.0.1:65430`
  (the public `GET /api/relay/key` is closed since goal/G22.6)

Does not change anything. First command after SSH.

### `./bash/install-units`

```
OWNER_KEY=<the owner node's public key, MCow...> ./bash/install-units
```

Writes `relay-state/owner.json` from `OWNER_KEY`, then copies
`bash/systemd/spirit-relay.service` to
`/etc/systemd/system/spirit-relay.service`, rewriting `/root/SpiritOS`
to this clone’s path, then `daemon-reload`. Does not start the process.

**The owner is set here and nowhere else** (goal/G16.8). No claim, token
or invite makes an owner over the wire, so a relay with no `owner.json`
refuses every claim. Without `OWNER_KEY` the script refuses to install.
It also refuses to replace an `owner.json` that names a different key:
to change the owner, remove the file by hand and re-run. Once installed
and started, the owner's node claims the relay with no invite; everyone
else needs an invite the owner mints.

### `./bash/start` `stop` `restart`

`systemctl` on `spirit-relay` only. Does not touch Caddy.

### `./bash/boot-on` `boot-off`

`systemctl enable` / `disable`.

### `./bash/update`

```
git fetch origin
if HEAD != origin/master:
  git reset --hard origin/master
  systemctl restart spirit-relay
else
  no restart
```

`relay-state/` is gitignored. Hard reset does not delete the mailbox or
the owner file.

### `./bash/cron-install`

Installs one crontab line:

```
*/10 * * * * /root/SpiritOS/bash/update >> /var/log/spirit-host-update.log 2>&1 # spirit-host-update
```

`./bash/cron-remove` deletes lines containing `spirit-host-update`.

### `./bash/firewall`

If `ufw` exists: allow 22, 80, 443; deny 65430; enable ufw.  
If only `firewalld`: allow ssh/http/https.

### `./bash/tls`

Installs Caddy (apt + Cloudsmith repo) if missing, writes
`/etc/caddy/sites/<domain>.caddy` from the template, validates, then
enable + reload Caddy.

It **never writes `/etc/caddy/Caddyfile`** — that file is yours, and one
line (`import sites/*.caddy`) is all it needs. `tls` refuses to reload
until it sees that line, and prints the migration instead. It used to
write the main file with `>`, so running it from a second clone deleted
the live relay's config and replaced it with the new one's.

DNS A for `$SPIRIT_RELAY_DOMAIN` must already point at this box or
Let’s Encrypt will fail.

### `./bash/http-to-https`

The first-time / cutover script:

1. `install-units` (with `OWNER_KEY` set, as above)
2. stop `spirit-relay` (so Node leaves public :80)
3. `firewall` then `tls`
4. `start` then `boot-on`
5. `status`

### `./bash/logs`

`journalctl -u spirit-relay -n 100 --no-pager`

Caddy logs are separate: `journalctl -u caddy -n 40 --no-pager`

---

## Environment knobs

```
SPIRIT_RELAY_DOMAIN=spirit.andyflinn.com
SPIRIT_RELAY_PORT=65430
SPIRIT_UNIT_NAME=spirit-relay
SPIRIT_CLONE_DIR=/root/SpiritOS
```

---

## More than one clone on this box

A second clone (the face, `bash/face-install`) is a second checkout with its
own `relay-state/` and `.env`, not a second machine and not a second Unix
user — `bash/ONE-OPERATOR.md` still stands, and root is still spirit.

### The clone decides, not the shell

**Do not source `.env`.** `bash/lib.sh` reads it, from whichever clone the
script you ran lives in, and a clone without one falls back to the defaults
with `SPIRIT_UNIT_NAME`, `SPIRIT_RELAY_PORT`, `SPIRIT_RELAY_DOMAIN` and
`SPIRIT_UNIT_TEMPLATE` **cleared**. So `cd <clone> && ./bash/<anything>` is
always about that clone, and nothing you did earlier in the shell changes it.

A one-off `SPIRIT_RELAY_PORT=9999 ./bash/serve`
does not work — to change what a clone is, edit that clone's `.env`. The
variables configure a clone, and which clone is not a question the shell
gets a vote on.

`./bash/update` fetches, compares, `reset --hard`s and restarts **its own**
unit. Per-clone, already, and now per-clone without help.

### What a clone follows: a tag, or master

> Andy: "let's make sure that my relay only restarts on my tags, and your
> relay is controlled by you."

`SPIRIT_TRACK` is `tag` by default and the default is the design. A clone
with no `.env` **is** the live relay, so the guarded setting has to be the
one you get by doing nothing; a clone that should follow master opts in, in
writing, in its own `.env`.

| clone | `.env` | follows |
|---|---|---|
| `/root/SpiritOS` | none | the newest tag reachable from `origin/master` |
| a second clone | `SPIRIT_TRACK=master` | `origin/master`, the moment it is pushed |

**A clone tracking tags that finds none stays exactly where it is.** It does
not fall back to master — that would hand back the whole gate at the one
moment it first means anything, which is before the first tag exists. It
says so and exits:

```
==> fetch origin (tag)
    !!  no tag on origin/master — staying at 1f34571
    this clone tracks tags (SPIRIT_TRACK=tag). Cut one to release:
      git tag -a v0.1.0 -m 'first release' && git push origin v0.1.0
```

To release: `git tag -a v0.2.0 -m '…' && git push origin v0.2.0`. The live
relay takes it at the next ten-minute tick.

**Why this was needed the day it was written.** `bash/update` never restarted
anything until 2026-09-16 — `grep -q` under `pipefail` turned every match
into 141 — so a push to master reached the live relay's *disk* and never its
process, and somebody restarted by hand when they meant to. That accident was
doing the work of a release gate. Repairing it meant every push restarted
`spirit.andyflinn.com` unattended within ten minutes: a capability nobody
asked for, created by fixing something else.

### Caddy is additive now

`./bash/tls` writes `/etc/caddy/sites/<domain>.caddy` and **never** touches
`/etc/caddy/Caddyfile`. It used to write the main file with `>` from a
single-site template — so running it from a second clone deleted the live
relay's config and replaced it with the second clone's, with no error until somebody
noticed the certificate was for the wrong name.

The main file becomes one line:

```
import sites/*.caddy
```

`tls` refuses to reload until it sees that line, and prints the migration.
It also runs `caddy validate` before reloading: a bad config rejected is a
message, a bad config reloaded is a box off the internet.

---

## First time on a new VPS

DNS must already resolve.

```
git clone git@github.com:andyflinn/SpiritOS.git /root/SpiritOS
cd /root/SpiritOS
./bash/http-to-https
./bash/cron-install
./bash/status
```

Need an SSH key on the box for `git@github.com` if you will push from here.
Fetch-only HTTPS remotes also work for `update`.

---

## Git from this box (already done 2026-09-05)

Remote is SSH:

```
git remote set-url origin git@github.com:andyflinn/SpiritOS.git
```

Commit author is only a label (`user.name` / `user.email`).  
GitHub identity is the deploy key / user key on `/root/.ssh/id_ed25519`.

Executable bits: `git add --chmod=+x bash/<script>` then commit. Windows
does not need `chmod`.

---

## Personal-node half (not these scripts)

On the **laptop**, after the box is on HTTPS:

1. `spirit/run/app/natter/relays.json` →
   `{ "label": "kamatera", "url": "https://spirit.andyflinn.com" }`
2. `spirit/run/spirit/hub.js` uses `https` and rejects remote `http://`
3. Restart the local spirit on `:65432`

Until those two files are live, a personal node may still open plain
HTTP to `http://194.37.81.237`. Caddy will 301 GET to HTTPS; POSTs from
old `http.request` are not the plan.

Lab relays on `http://127.0.0.1:654xx` stay allowed (loopback only).

---

## “Is it healthy?”

```
./bash/status
```

Good:

- HEAD matches `origin/master`
- `spirit-relay` enabled + active
- Node on `:65430`, Caddy on `:80` and `:443`
- 65420 quiet
- HTTPS card ask answered, JSON with `relayPublicKey`
- local `:65430` card ask answered, JSON with `relayPublicKey`

A relay answers no curl GET any more: `/api/relay/key`, `/api/version` and
the brochure are closed (goal/G22.6) and answer **404**. Ask with
`node bash/card-ask.js <url>`, as `./bash/status` does. Behind Caddy every
stranger's request arrives from 127.0.0.1, so two card asks within a second
share one address-table entry; the script waits out the ban the relay names.

---

## The cycle-10 flag day — ORDER MATTERS, AND THERE IS NO MIXED MODE

**Read this before promoting anything to a cycle-10 tag.** Agreed with
Andy 2026-09-23.

Cycle 10 seals every peer post. A node refuses to post without a key to
seal to — *"if you can't get the card, you can't post anyways"* — and a
receiver refuses an unsealed post. That makes the cutover a cliff rather
than a ramp:

| | old relay | new relay |
|---|---|---|
| **old node** | works | posts refused — unsealed |
| **new node** | **mute outward** — nothing to seal to | works |

**Every combination is broken except all-old or all-new.** That is the
design, not a defect.

### The order

**1. The relay before any node.** A new node cannot reach an old relay at
all, so nodes that go first go silent AND cannot claim their way back. A
relay that goes first merely refuses old nodes, which is recoverable by
updating them.

**2. Then every node, in one pass.** Anything not updated in that pass is
off the network until it is.

### Proven, not predicted

This was observed live on 2026-09-23 between the two agents' own boxes:
wsl-claude's node was updated to cycle-10 code while spirit-3 was not, and
it went **mute outward** — posts left as `sent` and were never receipted,
because a receipt is itself an outward message. `GET /api/relay/key` on
spirit-3 returned no `sealKey`, which is the whole story in one field. (That
route is closed since goal/G22.6; a card ask on the door answers it now.)

### What the update does NOT do for you

- **`bash/update` does not reinstall the unit.** The unit gained
  `MemoryMax` and `Restart=always`; run `bash/install-units` where those
  are wanted. **That script has never run on Linux** — it is the least
  tested step in this procedure; watch it most.
- **The `card` column is added, not altered.** Rolling a relay back
  leaves a column nothing reads, which is harmless.
- **Members enrolled before cycle 10 have no card on the relay.** The node
  hands one over when its stream opens, so this heals itself — but only
  once both ends are updated. It does not rescue a node that updated
  early.

### What is NOT a reason to wait

Cycle 10's remaining requirements — R8, R10, R12, R15, R16 — are proofs
and padding, not protocol. **The wire is complete.** Waiting for them does
not make the flag day safer; it only delays it.

## Common failures

| Symptom | Likely cause | What to run |
|---|---|---|
| HTTPS who: connection refused on 443 | Caddy down / cutover not run | `systemctl status caddy` then `./bash/tls` |
| `tlsv1 alert internal error` | Cert still issuing (first minute) | wait, `./bash/status` again |
| HTTPS who fails, local :65430 works | DNS or cert name mismatch | `curl -vI https://spirit.andyflinn.com/` |
| Local :65430 dead | Unit crashed | `./bash/logs` then `./bash/restart` |
| Node still on `:80` | Old stitch, cutover not run | `./bash/http-to-https` |
| `git push` asks for HTTPS username | origin is still `https://` | `git remote set-url origin git@github.com:andyflinn/SpiritOS.git` |
| Push rejected, fetch first | Laptop and box both committed | `git pull --rebase origin master` then push |
| Port 65420 listening | labMaster started here | stop it; this box is a mailbox |
| Update restarts every 10 min | HEAD ≠ origin/master every time | check cron log; someone is pushing constantly or reset is fighting local edits |

Cron log: `/var/log/spirit-host-update.log`

---

## State as of 2026-09-05 (first cutover)

- Clone: `/root/SpiritOS`, branch `master`
- Executable-mode commit: `a45b13a`
- Unit `spirit-relay` active, Node `--relay --port 65430`
- Caddy 2.11.4 on 80/443
- Let’s Encrypt cert `CN=spirit.andyflinn.com` (issued that evening, ~90 days)
- ufw: 22/80/443 allow, 65430 deny
- Cron every 10 minutes → `./bash/update`
- Mailbox already had peer `andy` from earlier HTTP-era testing

---

## What never belongs in this folder

- labMaster start/stop
- SSH from the laptop into these scripts
- TLS inside `server.js`
- Binding Node to public 443
- Deleting `relay-state/` on update
