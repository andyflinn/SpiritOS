# Commit and install: root is spirit

- Status: open
- Dropped: 2026-09-06
- Box: laptop then spirit-3
- Files: `bash/lib.sh`, `bash/install-units`, `bash/systemd/spirit-relay.service`, `bash/ONE-OPERATOR.md`

## Why

The live box already runs Node as root from `/root/SpiritOS`. Git still refuses that path and wants `User=spirit`. Make git match the machine.

## Do this

1. Replace those four files with the ones from this session.
2. Commit on master. Do not keep `RELAY_USER=spirit`.
3. On spirit-3 after cron or `./bash/update`:
   `./bash/install-units && ./bash/restart && ./bash/status`
4. `node relayLab/probe.js` still 200 on who.
5. Move `2026-09-06-root-clone-vs-spirit-user.md` to `relayLab/done/` (superseded).

## Done when

`./bash/install-units` succeeds on `/root/SpiritOS` and `systemctl show spirit-relay -p User` is empty or `root`.
