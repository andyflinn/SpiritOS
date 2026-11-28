# The full path rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- Given no file, on a planted run whose `spirit/shell/face.html` loads `/spirit/script.js`, *"the face page loads the spirit object by its own path, /spirit/script.js"* is green; one that loads `/spirit.js` is red on it.
