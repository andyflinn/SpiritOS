# platform/ — tools for Andy's machines, one folder per platform

> **Andy, 2026-09-22:** *"we need a folder in SpiritOS that fans out for
> platform-specific utilities."* — *"i'll go with your folder structure
> for platforms"*

| folder | for | maintained by |
|---|---|---|
| `wsl/` | WSL on Andy's Windows box | wsl-claude |
| `windows/` | Windows itself | the Windows Claude |
| `linux/` | a Linux machine that is not WSL | — |

**What belongs here:** small tools that make one of Andy's machines easier
to use — things a platform lacks and he wants. **What does not:** anything
the node runs or needs. `spirit/run/` stands alone and never reads this
folder, and `bash/` is the relay host's scripts, not a desktop's.

Each tool is plain Node with no dependencies, starts by hand, and answers
only on `127.0.0.1`. A tool here that serves a page counts its one reach
for `http` in `spirit/test/oneDoor.js`, the same as every other file
(`AGENT.md`, *Comms*).

## Tools

- [`wsl/desktop/`](wsl/desktop/) — a desktop in the browser for WSL, which
  has none: an icon per installed Linux program, click to launch.
