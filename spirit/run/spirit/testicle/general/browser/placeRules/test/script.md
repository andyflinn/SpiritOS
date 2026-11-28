# The browser place rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the part "given no file: the tree's rules, then every page module" of `spirit/test/script-sibling-browser.js` moved into a rule module, that file its runner now.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `browser`, own `false`.
- It applies to the tree, given no file, and to no one script handed (the page rules judge that one).
- On a scratch node that serves them and a git run that lists them, a planted product script that stands at its place once required loads on a page and keeps *"every product script that loads on a page stands on the spirit object under its own path"*; one that takes itself off its place as soon as it is placed loads on a page and is red on it.
- The run of every page module again, its last check, is not run here: it runs the runner on every page script of the tree.
