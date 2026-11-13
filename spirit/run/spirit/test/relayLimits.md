# spirit/relayLimits.js — its own test

What the box can actually give, and what a relay takes of it by default: one arithmetic for the installer and a relay's
first start (Andy, 2026-09-22). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72).
Pure figures, and one probe whose dependencies are planted.

- The margins: RAM 25 MB; disc 1024 MB or a twentieth of what is free; a default never above 256 MB.
- `ceilings`: available less the margin, never below 1 MB; the disc margin never more than half of what is free; an
  unmeasured figure absent.
- `defaults`: half of the total, at most 256 MB, clamped to the ceiling, for RAM and disc.
- `parseMemAvailable`: MemAvailable in MB, null without it. `parseCgroupAvailable`: limit less usage, null for `max`,
  the v1 sentinel or nothing, never negative. `cgroupDirs`: v2 and v1 paths from the leaf to the root.
- `measure`: MemAvailable on Linux, os.freemem() otherwise; the smallest cgroup cap from leaf to root bounds
  `availableMB` while `hostAvailableMB` stays the host's; the disc of `spirit/state`; an unreadable disc absent.

## What its test must try to break

A default above 256 MB on a big box; a ceiling built on total memory instead of availability; a disc margin that eats
a small volume; a cgroup cap read only at the root; `hostAvailableMB` cut by the relay's own cap (goal/G40.4).
