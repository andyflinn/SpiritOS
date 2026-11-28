# The pollution rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (its node check uses the run's one shared scratch node).
- **Nothing on the global object or on process but spirit** (Andy: *"no developer will want to use a system that pollutes global name-spaces."*, *"go on this"*). In a scratch tree, `spirit/testicle/run/node/script.js` runs this module alone, handed the scratch tree as its run, as testicle hands one (`SPIRIT_MOUNT_RUN`). Two planted node scripts in `spirit/zzGlobal/`: `leaky.js`, which assigns `global.zzLeaked`, and `clean.js`, which hands out its value through `module.exports` alone. Handed `leaky.js`, *"loaded in a node, it adds nothing to the global object or to process but spirit"* is red, under that script; handed `clean.js`, green.
- **No temp path of its own** (the box: *"nothing else builds a temp path"*). A planted `spirit/zzGlobal/ownTemp.js` calls the system temp folder itself. Handed it, *"it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js"* is red, under that script; handed `clean.js`, green.
