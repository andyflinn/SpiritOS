# Pick one: keep root unit, or move the clone off /root

- Status: open
- Dropped: 2026-09-06
- Box: spirit-3
- Files: `bash/install-units`, `bash/lib.sh`, `bash/systemd/spirit-relay.service`

## Why

`a1bbac6` made `./bash/install-units` refuse a clone under `/root` and wants `User=spirit`. The live clone is `/root/SpiritOS`. Cron updates files and restarts the **old** root unit in `/etc`. Repo and machine disagree. That is the thing that will waste a collaborator’s hour.

## Do this

Choose A or B. Do not leave both half-true.

**A — stay on /root, stay root (fast)**

1. On the laptop, remove the `/root` `die` from `bash/install-units`.
2. Keep `User=root` in `bash/systemd/spirit-relay.service` (or drop `User=`).
3. Commit, push. On spirit-3, `./bash/update` is enough. Do not run `install-units` until that commit is on origin.

**B — unprivileged `spirit` (correct, more steps)**

1. SSH to spirit-3. Copy mailbox state aside:
   `cp -a /root/SpiritOS/spirit/run/relay-state /root/relay-state.bak`
2. Clone or move the tree to a world-readable place, e.g. `/opt/SpiritOS`.
3. Point git remote at `git@github.com:andyflinn/SpiritOS.git` if you still want push from the box.
4. `cd /opt/SpiritOS && ./bash/install-units && ./bash/restart && ./bash/status`
5. Confirm `who` over HTTPS still returns JSON.
6. Confirm `ps` / `systemctl show spirit-relay -p User` says `spirit`.
7. Put the new path in cron (`./bash/cron-remove` then `./bash/cron-install` from `/opt/SpiritOS`).
8. Only then remove `/root/SpiritOS` if you are sure.

## Done when

Either:

- `./bash/install-units` succeeds on the live clone **and** `systemctl show spirit-relay -p User` matches the unit file in git,

or:

- the `/root` refuse is gone from `install-units` and the live unit is documented as root.

## Out of scope

URIError. Caddy. labMaster. Moving DNS.
