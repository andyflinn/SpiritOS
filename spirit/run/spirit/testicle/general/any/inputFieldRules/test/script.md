# The input field rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- Handed a planted script that makes an input and hands it to `fieldInput.attach` with `spirit/type/string/script.js`, *"each input field it makes is handed to fieldInput.attach with the full path of its field's type file"* is green; handed one that hands it `'text'`, red.
