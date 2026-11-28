# The app folder rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the part "1 to 6, for each sub-folder" (appRules) of `spirit/test/app-child-general.js`, with the checks of the sub-folders it is said on, moved into a rule module, that file its runner now.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted git tree, asked about a file of an app whose manifest holds identity icon, label and intrinsic, mount, shell and node, *"the app's manifest is valid"* is green; asked about one whose manifest has no label, red.
