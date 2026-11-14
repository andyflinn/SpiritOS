# spirit/element/search/app/serverDEBUG.js

A server's DEBUG, as a rowFormToggle (goal/G43.15). Its test is `./serverDEBUG.js`: a real node on a lab node reset to the files under test (goal/G47.3), with a throwaway server app planted before it boots, and a real Chrome on its face page.

## Requirements

### When it shows

- `spirit.element.spirit.element.search.app.serverDEBUG.create(host, { key })`, loaded through `spirit.require`.
- For an app with `node.mount` false it shows nothing and takes no space.
- For a server that is not running it shows nothing either (Q1).
- Running, with DEBUG off, it says "turn on DEBUG <label>", with one button. On, it says "turn off DEBUG <label>".

### What it switches

- A press switches the server's own DEBUG verb: `<name>.DEBUG {}` then answers true.
- DEBUG is on the server's job, in its data: `debug` true or false, kept past the server's next call.
- Switched from elsewhere, the page follows with no reload.

### Kept across a restart (Q2, Q3)

- Switched, the node writes `debug` into `spirit/state/<name>/node.json`.
- A killed server comes back with the DEBUG it had, and so after a restart of the node.

### In the appSelector's detail

- The detail loads `changeAppIcon.js` and `changeAppLabel.js`, as it uses them.
- The DEBUG row comes right after the Deactivate row.
- Every row of the detail carries its own 1em above it, and the gap between two rows is that 1em.

Nothing throws on the page.
