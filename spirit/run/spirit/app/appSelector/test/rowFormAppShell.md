# spirit/app/appSelector/rowFormAppShell.js

Allow mount-as-shell for one app, a rowFormToggle that hides itself when the app does not mount on the shell (goal/G43.15). Its test is `./rowFormAppShell.js`, in a real Chrome on a scratch node's face page, with an app of the test's own planted on its disc.

Andy: *"correct, so does, allow mount-as-shell.."*

## Requirements

- `spirit.elements.rowFormAppShell.create(host, { key })`, loaded through `spirit.require`, answers `{ destroy }`.
- For an app whose json says `shell.mount` false it shows nothing and takes no space.
- For an app that mounts on the shell (the Agent), not allowed, it says "Allow Agent as shell". A press allows it, and it says "Don't allow Agent as shell". A second press takes it back.
