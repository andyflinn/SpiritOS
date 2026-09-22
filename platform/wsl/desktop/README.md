# WSL desktop — a desktop in the browser, for WSL

> **Andy, 2026-09-22:** *"wsl comes with now desktop, i want a littel
> server that present in a browser like a fake-desktop and allows me to
> launch linux UI-programs i installed from an icon...."* — *"let wsl
> build it and maintain it."* — *"we make the fake desktop standalone for
> now, later it might become a "group" in the shell."*

Built and kept by wsl-claude.

```
node platform/wsl/desktop/desktop.js          # http://127.0.0.1:45480
node platform/wsl/desktop/desktop.js --port N # or DESKTOP_PORT=N
```

Open it in Chrome on WSL, or in Chrome on Windows: WSL2 forwards loopback
from Windows into WSL, so the same address works on both sides.

## What it shows

One icon per program **on Andy's list**, `~/.config/wsl-desktop/apps.json`
— `{ "apps": ["google-chrome"] }` — in the order he lists them. Each id is
a `.desktop` file name; its name, icon and command are read from the XDG
entries (`~/.local/share/applications`, then `/usr/local/share` and
`/usr/share`, then snap's), a user's own entry winning over a system one.
An id that is not listed is neither shown nor launchable; an entry marked
`NoDisplay` or `Hidden`, or with no command, never shows. A missing list is
an empty one: the page says how to add a program.

**Beside the Windows Start menu:** WSLg already puts window programs there,
in the folder *Ubuntu-24.04* (Chrome, Text Editor, Zutty). It leaves out
programs that run in a terminal (Byobu, Vim, TeXInfo). This desktop shows
both, and starts a terminal program inside Zutty.

## What it refuses

A page that starts programs is what a hostile website wants, and a browser
will send it a request from any site. So it refuses:

- a connection from another machine, or naming another host (DNS
  rebinding);
- a request from another site — an Origin that is not its own, including
  `null`, or `Sec-Fetch-Site` cross-site or same-site — the gate the node
  got in `deb5978`;
- a launch that is not JSON, which a cross-site page cannot send without
  a preflight this server never answers.

And a launch can only name a program from the list. Its command comes from
the `.desktop` file, split into arguments and started **without a shell**.
Nothing in a request is ever run.

**The cost of the Windows side:** any Windows program can reach it too. It
can start only what is listed.

## Decided

- Folder `platform/wsl/desktop/`, plain Node, no dependencies, standalone
  (Andy, 2026-09-22).
- wsl-claude builds and keeps it (Andy, 2026-09-22).
- Only the programs Andy lists: *"it should only list chrome, and later on
  gimp and the stuff i actually use."* The list is
  `~/.config/wsl-desktop/apps.json`, on his machine and out of git.
- Counted in `spirit/test/oneDoor.js` at **2** — `require('http')` for its
  server, and the page's own `fetch` back to itself — with `platform/`
  walked, like `agents.js` and `grokReview.js`: *"wsl may proceed with the
  desktop project"* (Andy, 2026-09-22, relayed on the agent wire).

## Open

- Whether it should always run, as labMaster does, or be started by hand.
- Its future as a group in the shell — which would move it behind the
  node's door and retire this server.
- A program's own actions (Chrome's *New Window*, and so on) are not shown.
