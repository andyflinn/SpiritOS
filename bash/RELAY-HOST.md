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
| `node js/server.js --relay --port 65430` | 65430 | Mailbox only (`/api/relay/*` + brochure) |

systemd unit: `spirit-relay.service`  
Working directory: `/root/SpiritOS/spirit/run`  
State that is **not** in git: `spirit/run/relay-state/` (`allow.json`, `mailbox.json`, optional `identity.json`)

---

## What this machine is not

Do **not** run on this box:

- labMaster (`http://127.0.0.1:65420`)
- a personal spirit (`node js/server.js` without `--relay`)
- Jobs, App Builder, LM Studio, the desktop shell
- extra Node processes “just to look”

`./bash/status` warns if port **65420** is listening. Kill that process.

labMaster lives on the coordinator laptop only.

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
| `tls` | 755 | Install Caddy + write Caddyfile |
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
- `GET https://spirit.andyflinn.com/api/relay/who`
- `GET http://127.0.0.1:65430/api/relay/who`

Does not change anything. First command after SSH.

### `./bash/install-units`

Copies `bash/systemd/spirit-relay.service` to
`/etc/systemd/system/spirit-relay.service`, rewriting `/root/SpiritOS`
to this clone’s path, then `daemon-reload`. Does not start the process.

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
allow-list.

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
`/etc/caddy/Caddyfile` from the template, enable + reload Caddy.

DNS A for `$SPIRIT_RELAY_DOMAIN` must already point at this box or
Let’s Encrypt will fail.

### `./bash/http-to-https`

The first-time / cutover script:

1. `install-units`
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
SPIRIT_CLONE_DIR=/root/SpiritOS
```

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
2. `spirit/run/js/hub.js` uses `https` and rejects remote `http://`
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
- HTTPS `who` returns JSON
- local `:65430` `who` returns JSON

`curl -I https://spirit.andyflinn.com/api/relay/who` may print **404**
because the mailbox has no HEAD handler. Use GET (`./bash/status` does).

---

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
