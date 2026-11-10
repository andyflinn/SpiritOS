# spirit-child-generalRules.js

The general rules of a module (goal/G40.6), judged in its code. It runs once per file, the file its argument:

    node spirit/test/spirit-child-generalRules.js spirit/app/desk/desk.js

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-child-` test beside `spirit.js` judges `spirit/spirit.js` and every
module in `spirit/` and below that has its own test. It stands in `spirit/test/` since goal/G43.32, and judges the same
modules as it did in the run root's old test folder.

Andy: *"it will assert, the require path rule it will assert that the spirit-object becomes a global at the top of all
modules"*; spirit.js itself is judged too: *"it must establish the global spirit object early in the code, it must
follow the require-path restrictions we discussed."* Each file is its own test id: *"create separate test id's for
every file called with that general-rule assertion"*.

## Requirements

- **The global early**: a module's first require is `spirit.js`, so `spirit` is a plain global before anything else is
  loaded. `spirit.js` itself sets the global before its first require.
- **The require rule** (goal/G40's box): *"a require path that starts with ../ may only add a file name, never descend
  into a subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling
  in the module's own folder is legal."* A package or a node built-in is not a path; a computed path cannot be read.
- A rule a file breaks fails that file's test, not the item that brought the test.

## What its test must try to break

- A module that requires anything before `spirit.js`, or a `spirit.js` that requires before it sets the global.
- A require that descends into an ancestor's subfolder.
- A file handed that is no module: nothing judged is red, never green.
