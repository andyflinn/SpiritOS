# spirit/console/loop.js

The console's interactive loop (goal/G48.2, the box: *"the script run://spirit/console/loop.js will be the consoles
interactive user loop"*), entered by `node spirit/console/script.js` with no words. Its test: `./loop.js`.

## What it does

- Shows the prompt `spirit.` and the stored path, `spirit: ` at the root (`path app` makes it `spirit.app: `).
- Hands each line typed to the command processor, `./command.js`, as typed.
- On the up and down keys offers only the history items that can be used from the current path: the log speaks from the root,
  so the loop translates each back into its own scope (*"since the log stores all commands as if typed from root prompt
  "spirit: ", the loop must translate those back into its scope to see if they can be using from that navigation
  position."*).

## What its test judges

On a scratch node of its own, the loop's node told its input and output are a terminal (so it runs on every machine), its keys
written as a terminal sends them: `spirit: ` at the start; `path app` gives `spirit.app: `; `path agent` gives `spirit.app.agent: ` and app.agent
in state; `path nope` leaves the prompt; `path <` gives `spirit.app: `; there the up key offers `path agent` and never
`path app.agent` or `path app`; `path <<` gives `spirit: `, `path node` gives `spirit.nodeFacts: `, where the up key offers
neither `path agent` nor `path app.agent`; there `card`, which ran, is offered again by the up key, and `nope`, which
failed, is not (Andy: *"the up key isn't for navigation only, it's for every command that is successful."*).
