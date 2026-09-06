# bash/ — coordinator verbs for a SpiritOS *public relay* host

This folder is what you run after SSH onto the public box
(`194.37.81.237`, `spirit.andyflinn.com` today).

It is **not** labMaster. labMaster stays on the coordinator laptop
(`http://127.0.0.1:65420`) and only ever spawns local lab nodes.

The public relay is a small machine (about 1 GB RAM). It runs one
Node process (`--relay`) behind Caddy. Nothing else.

```
ssh root@194.37.81.237
cd /opt/spirit-os
./bash/status
```

## Never on this box

- `node spirit/test/labMaster/labMaster.js`
- personal-node mode (`node js/server.js` without `--relay`)
- Jobs, App Builder, LM Studio, the desktop shell
- extra Node processes “just to check”

If `status` ever sees port **65420**, it will shout. That port is
labMaster. Kill it.

## The rule these scripts enforce

- Personal spirit (laptop, NAT): plain HTTP on loopback
  (`http://127.0.0.1:65432`). Browser talks only to that.
- Public relay: Node listens on `127.0.0.1:65430` with `--relay`.
- The world only sees `https://spirit.andyflinn.com` (Caddy on 80/443).
- `relay-state/` is never deleted by update.

## Commands

| Script | What it does |
|---|---|
| `./bash/help` | This map. |
| `./bash/status` | Units, ports, git SHA, `who` over HTTPS. Warns if labMaster is running, or if the relay is still running as root. |
| `./bash/install-units` | Create the `spirit` service account, own `relay-state/`, and install the systemd unit from `bash/systemd/` with this clone's own paths filled in. |
| `./bash/start` `stop` `restart` | The relay Node process only. |
| `./bash/boot-on` `boot-off` | Start relay at boot, or not. |
| `./bash/update` | `git fetch` + hard reset to `origin/master` + restart **only if SHA changed**. Leaves `relay-state/` alone. |
| `./bash/cron-install` | Every 10 minutes, run `update`. |
| `./bash/cron-remove` | Take that cron line out. |
| `./bash/firewall` | Publish 22, 80, 443. Do not publish 65430. |
| `./bash/tls` | Install Caddy + site file for `$SPIRIT_RELAY_DOMAIN`. |
| `./bash/http-to-https` | Move Node off public :80 onto localhost :65430, enable TLS + redirect. |
| `./bash/logs` | Last 100 lines of the relay unit. |

Run any script with no args. They print what they are about to do.

## First time on a new VPS

DNS for `spirit.andyflinn.com` must already point at this box.

```
git clone https://github.com/andyflinn/SpiritOS.git /opt/spirit-os
cd /opt/spirit-os
./bash/http-to-https
./bash/cron-install
./bash/status
```

Not `/root`. The relay runs as an unprivileged `spirit` account, which
cannot traverse `/root` (mode 0700) — `install-units` refuses rather than
installing a unit that dies at start with a bare `status=200/CHDIR`.

## Moving an existing box off /root

The relay used to run as root out of `/root/SpiritOS`, purely because
that is where it was cloned. Nothing it does needs privilege: it binds a
port above 1024, reads its own code, and writes one directory. Combined
with the ten-minute `update` cron, root there meant anything reaching
`origin/master` was root on this box inside ten minutes.

```
systemctl stop spirit-relay
mv /root/SpiritOS /opt/spirit-os
cd /opt/spirit-os
./bash/install-units      # creates the spirit user, chowns relay-state/
./bash/cron-install       # rewrites the cron line to the new path
./bash/start
./bash/status             # should now say: runs as spirit (unprivileged)
```

`relay-state/` moves with the directory — it is gitignored, so nothing
else holds a copy of `identity.json`. After the move the code stays
root-owned and read-only to the service account, and `relay-state/` is
`spirit`-owned and mode 700; the running relay can rewrite its mailbox
and nothing else, not even the app serving it.

## Environment knobs

```
SPIRIT_RELAY_DOMAIN=spirit.andyflinn.com
SPIRIT_RELAY_PORT=65430
SPIRIT_CLONE_DIR=/opt/spirit-os
SPIRIT_RELAY_USER=spirit
```

## What this is not

Not labMaster. Do not copy `spirit/test/` onto this box and start it.
Do not fold SSH into labMaster. One tool is local HTTP on the laptop.
This tool is “I am root on the mailbox.”
