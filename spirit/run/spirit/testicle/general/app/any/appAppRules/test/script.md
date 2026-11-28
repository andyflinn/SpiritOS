# The app app rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the part "the app app" (appApp) of `spirit/test/app-child-general.js` and the two checks "no app is a shell any more" that stood after it at that file's top level, moved into a rule module, that file its runner now.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted git tree with no `spirit/app/appSelector.js`, *"the shell app, spirit/app/appSelector.js and spirit/app/appSelector/ are gone"* is green; with one, red.
