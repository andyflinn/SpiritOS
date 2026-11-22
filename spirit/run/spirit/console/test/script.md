# spirit/console/script.js

The console's one door from a system shell (goal/G48.2, the box: *"there is only one system shell way into console:
"node spirit/console/script.js", the console itself knows that it must enter the loop if no arguments was specified."*). The
console is core (goal/G48, Andy: *"console is core."*); its parts are `./console/command.js`, the command processor, and
`./console/loop.js`, the interactive loop. Its test: `./console.js`.

## What it does

- With no words it enters the loop (`./console/loop.js`), which shows the prompt `spirit: ` at the root.
- With words it hands them to the command processor (`./console/command.js`) once, and ends.
- The card of goal/G48.1 is gone (*"the card feature from 48.1 will be completely dropped and the console will feature
  namevation only."*).

## What its test judges

On a scratch node of its own, the console of that node's tree run there: with no words it stays running and shows
`spirit: `, and a line typed there (`path app`) moves the stored path; with words (`path agent`) it does them once and ends,
the stored path then `app.agent`; `card` prints no card.
