# SpiritOS

A sovereign personal operating system — a personal desktop, file system, job runner, and local-AI workbench, all running on your own machine under your own control.

**Run it:**
```
git clone https://github.com/andyflinn/SpiritOS.git
cd SpiritOS
npm start
```
Then open `http://localhost:65432`. No `npm install` needed — the server itself has zero external dependencies (only Node built-ins). A personal node binds loopback only, so nothing else on your network can reach it.

`npm start` is `cd spirit/run && node js/server.js`, and the `cd` is not optional: file paths resolve off the script's own location, but job spawning hands script paths to `child_process.spawn` relative to the *working* directory. The server refuses to start from anywhere else rather than fail silently later, so run it that way (or use `npm start`) — `node spirit/run/js/server.js` from the repo root is rejected on purpose.

**Running a public relay:** `node js/server.js --relay`, again from `spirit/run/`. A relay serves a static brochure plus the mailbox routes (`/api/relay/*`) and 404s everything else — Jobs, `/api/fs/*`, `/api/proxy`, `/api/hub/*`, the desktop shell — so it binds `0.0.0.0` and accepts any `Host`, since it's meant to be reached from the internet. The repo-root `Procfile` is exactly that command for a platform that assigns `PORT`; don't also pass `--port`, which wins over the environment. Its allow-list and key material live in `relay-state/`, which is gitignored and has to be created on the host. Personal nodes never take `--relay`.

A few optional process scripts (`spirit/run/process/js/imageCaptionClaude/`, `imageCaptionClaudeBatch/`, `imageStats/`) have their own small dependencies — only needed if you actually use those specific features. Run `npm install` inside that script's own folder before using it; nothing else on the server depends on them.

Created by **Andy Flinn** — Canadian-Swiss troubadour, musician, and visionary hacker.

## What's running today

`spirit/run/` is the whole product: a Node HTTP server (`js/server.js`) plus an isomorphic kernel object (`js/kernel.js`, `js/client/shell.js`) shared between Node and the browser. It has:

- A desktop UI with built-in apps (Stats, Files, Code Viewer, Media Viewer, Processes, Jobs, Groups) and dynamically-loaded apps (`app/<name>/`) discovered by manifest convention, including **App Builder** — ask Claude to build or modify a spirit app in plain language, review exactly what it proposes, and apply it live, no server restart.
- **Kernel-privilege capability injection**: every app's `mount(container, api, params)` receives an explicit, pre-scoped `api` object (its own isolated storage, HTML-escaping, one gateway for outbound network calls) rather than reaching for global state — see `design/decisions/0002-kernel-privilege.md`.
- **Proven identity over claimed identity**: an app's id, and what data it can touch, are derived from what the shell directly observes, never from what an app or manifest merely claims about itself — see `design/decisions/0001-proven-vs-claimed-identity.md`.
- A job subsystem (spawn, track, report progress, cancel) that's the backbone for running local scripts — including LM Studio and Claude integration for local and hosted model inference.
- A writable-root filesystem boundary (`app/`, `media/`, `published/`) — reads can see anything under the project root, writes are jailed to a short allowlist, with real test coverage (`spirit/test/`).
- A generic HTTP proxy and job-spawn API, deliberately unconstrained by an allowlist for a single-operator local tool, behind loopback + Host-header checks.

See `spirit/currentIssues.md` for what's actively being worked on, `design/reviews/` for periodic status-vs-vision assessments, and `spirit/test/` for how to verify the security boundaries yourself.

## Where this is going

The bigger vision — a portable `spirit.json` format, a consent engine, peer-to-peer relay between personal nodes, exportable "Spirit Packages" — is real, ongoing design work, not yet built on top of the running core above. See `design/` for that: `design/VISION.md` for the why, `design/spirit-json/ROOT-STRUCTURE.md` and `design/transforms/COMPOUND-REQUEST-SYSTEM.md` for the not-yet-implemented format, `design/principles/` and `design/storage/` for the philosophy already reflected in `spirit/run/` today.

## History

SpiritOS grew out of a decade-plus of earlier work (2016–2026) under the name ZS4, and a parallel experiment called `hxm`. Both were retired in favor of building `spirit/run/` fresh rather than modernizing them from the inside — see the git tag `archive/zs4-2016-2026` for that code as it stood at the cut.

---

**Website:** [andyflinn.com](https://andyflinn.com)  
**Creator:** Andy Flinn — hat-wearing, guitar-slinging spirit explorer from Bad Ragaz.
