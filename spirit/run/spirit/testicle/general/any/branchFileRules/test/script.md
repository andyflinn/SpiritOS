# The branch file rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- Handed a planted script that loads nothing by a branch name, *"it loads no branch file by the branch name, only by its full path"* is green; handed one calling `cacheManager('zz')`, red.
