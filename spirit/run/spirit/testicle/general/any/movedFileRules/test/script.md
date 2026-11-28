# The moved file rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- Given no file, on a planted run whose `spirit/app/manager/script.js` holds `function createApp(`, *"spirit/app/manager/script.js is the manager: it holds createApp"* is green; without it, red.
