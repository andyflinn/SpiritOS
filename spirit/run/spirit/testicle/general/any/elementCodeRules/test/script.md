# The element code rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- **What it changes, it listens for, through a child on a branch** (goal/G47.1; wsl, of the model table: *"the list it mounts ... is what shows the result, so it does listen, through its child"*; cw: *"A child it mounts on a branch counts as its listening"*). In a scratch tree (as the module rules' test makes it), `spirit/testicle/run/none/script.js` runs this module alone. Three planted elements in `spirit/element/zzListen/`: `child.js`, which loads the search element and makes its search on a branch worked out from the name it is handed; `writer.js`, which writes, requires `child.js` and hands it a branch by name; and `deaf.js`, which writes and has no watch, no search and no child. Handed `writer.js`, *"it sends writes and watches the store"* is green; handed `deaf.js`, red.
