# SpiritOS

A sovereign personal operating system — a personal desktop, file system, job runner, and local-AI workbench, all running on your own machine under your own control.

**Run it:**
```
cd spirit/run
node js/server.js
```
Then open `http://localhost:65432`. The server binds to loopback only and pins its own root to `spirit/run/` regardless of the directory you launched it from.

Created by **Andy Flinn** — Canadian-Swiss troubadour, musician, and visionary hacker.

## What's running today

`spirit/run/` is the whole product: a Node HTTP server (`js/server.js`) plus an isomorphic kernel object (`js/kernel.js`, `js/client/shell.js`) shared between Node and the browser. It has:

- A desktop UI with built-in apps (Stats, Files, Code Viewer, Media Viewer, Processes, Jobs) and dynamically-loaded apps (`app/<name>/`) discovered by manifest convention.
- A job subsystem (spawn, track, report progress, cancel) that's the backbone for running local scripts — including LM Studio integration for local model inference.
- A writable-root filesystem boundary (`app/`, `media/`, `published/`) — reads can see anything under the project root, writes are jailed to a short allowlist, with real test coverage (`spirit/test/`).
- A generic HTTP proxy and job-spawn API, deliberately unconstrained by an allowlist for a single-operator local tool, behind loopback + Host-header checks.

See `spirit/currentIssues.md` for what's actively being worked on, and `spirit/test/` for how to verify the security boundaries yourself.

## Where this is going

The bigger vision — a portable `spirit.json` format, a consent engine, peer-to-peer relay between personal nodes, exportable "Spirit Packages" — is real, ongoing design work, not yet built on top of the running core above. See `design/` for that: `design/VISION.md` for the why, `design/spirit-json/ROOT-STRUCTURE.md` and `design/transforms/COMPOUND-REQUEST-SYSTEM.md` for the not-yet-implemented format, `design/principles/` and `design/storage/` for the philosophy already reflected in `spirit/run/` today.

## History

SpiritOS grew out of a decade-plus of earlier work (2016–2026) under the name ZS4, and a parallel experiment called `hxm`. Both were retired in favor of building `spirit/run/` fresh rather than modernizing them from the inside — see the git tag `archive/zs4-2016-2026` for that code as it stood at the cut.

---

**Website:** [andyflinn.com](https://andyflinn.com)  
**Creator:** Andy Flinn — hat-wearing, guitar-slinging spirit explorer from Bad Ragaz.
