# The node place rules module

goal/G49.27, step 2b. Its test is `./script.js`; the module is `../script.js`, the whole of `spirit/test/script-sibling-node.js` (it had no parts) moved into a rule module, that file its runner now.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `true` (it turns the apps of its scripts on in its copy and writes the copy's environment).
- Handed two scripts in one run, it makes one copy of the tree with a node of its own for both.
- A planted script whose `module.exports` is its value keeps *"on the node, the script loads, answers at once and stands at spirit.<path minus spirit>"*; one whose `module.exports` is a promise is red on it.
