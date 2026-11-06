# The shell the node names

goal/G43.18, box v29, *The shell*. Its test is `./nodeShell.js`: the tree, then a real node on a scratch copy of the tracked files, with a shell-worthy app of the test's own (`zzshell`, its `<name>.json` saying `shell.true` true), asked at its own loopback door and started again. The page side is `spirit/app/shell/test/shell.js`.

## Requirements

- `spirit/app/shell/shell.json` is there and says `shell.true` true; `shell.js` loads `spirit/element/search/app.js` (*"an app that wraps the app search (spirit/element/search/app.js) as the shell"*).
- `spirit/app/appSelector/rowFormAppShell.js` is gone, and the app family has no verb `shell` (Q10). The node family has `shell { at, name? }`, reviewed by wsl.
- Q12: with no `spirit/state/shell.json`, `node.shell({ at: home })` and `({ at: face })` each answer `{ name: "shell" }`.
- *"A name that is no app, or whose <name>.json does not say shell:true:true, is refused with the reason, and the shell stays"*: `zzNoSuchApp` and `contact` are refused by the verb (not as "no such verb"), with a reason, and home stays `shell`; an `at` other than home or face is refused.
- *"node.shell({ at, name }) sets it and answers { name }"*: home set to `zzshell` answers it, is answered again, and face stays `shell`. *"Kept in a file of its own, spirit/state/shell.json"*: it holds `zzshell`, `config.json` holds no shell, and the node started again still names `zzshell`.
- Q10: `app.shell` is no verb, and `app.active` writes no `shell` into the app's `node.json`.
