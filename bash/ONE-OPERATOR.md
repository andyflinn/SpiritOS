# One operator. root is spirit.

This host (`spirit.andyflinn.com`, spirit-3) is a single-user mailbox.
The person who SSHs as root **is** the spirit that owns the node.
There is no second Unix account to “manage” the first.

## What that means

- Clone stays at `/root/SpiritOS` (or whatever `SPIRIT_CLONE_DIR` you set).
- `spirit-relay.service` runs as root.
- `./bash/install-units` does **not** create a `spirit` user and does
  **not** refuse `/root`.
- `relay-state/` stays mode `700` on disk. It is still gitignored.
- Caddy may use the package’s `caddy` user. That is the TLS helper,
  not a second you.

## What we are not doing

- Moving the tree to `/opt` so an unprivileged user can `chdir`.
- `User=spirit` in the unit.
- Loosening `/root` to `0755` so someone else can read the clone.

## Collaborators

You inspect the mailbox with `./bash/status` and
`node relayLab/probe.js`. You do not get a separate login.
If the box is compromised, it is compromised as you. That is the
model. Do not document a split that the machine does not run.
